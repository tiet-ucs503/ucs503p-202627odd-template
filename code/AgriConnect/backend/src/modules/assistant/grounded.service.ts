import {
  buildSystemPrompt,
  generateGeminiTextForGrounded,
  nativeLanguageLock,
  replyMatchesLanguage,
  resolveGeminiModel,
  wrapUserMessage,
} from './assistant.service.js';
import type { AssistantTurn } from './assistant.schema.js';
import { getEnv } from '../../config/env.js';
import { classifyAssistantRoute, type EscalationReason } from './knowledge/classify.js';
import {
  retrieveKnowledge,
  retrievalIsConfident,
  type RankedChunk,
} from './knowledge/retrieve.js';
import { fetchLiveWeather } from './knowledge/weather.js';
import { getPrismaClient } from '../../config/db.js';
import { createNotification, createNotifications } from '../../services/notification.service.js';
import type { Role } from '../../generated/prisma/client.js';

export type AssistantSource =
  | 'gemini'
  | 'local'
  | 'grounded'
  | 'escalated'
  | 'refused';

export interface AssistantCitation {
  id: string;
  title: string;
  source: string;
}

export interface AssistantQueryResult {
  reply: string;
  source: AssistantSource;
  mode: 'chat' | 'grounded' | 'escalated' | 'refused';
  citations?: AssistantCitation[];
  escalated?: boolean;
  escalationId?: string;
  escalationReason?: EscalationReason | 'low_confidence' | 'empty_retrieval';
  retrievalScores?: number[];
}

const REFUSE_REPLIES: Record<string, string> = {
  en: 'I do not have a trusted note for that in my field book yet, so I will not guess. Please ask about a crop, scheme (PM-Kisan / PMFBY / MSP), or weather practice I cover — or request an agronomist.',
  hi: 'मेरी खेत की नोटबुक में इसका भरोसेमंद जवाब अभी नहीं है, इसलिए मैं अनुमान नहीं लगाऊँगा/लगाऊँगी। फसल, योजना (पीएम-किसान / पीएमएफबीवाई / एमएसपी) या मौसम की बात पूछें, या कृषि विशेषज्ञ से बात करवाएँ।',
  pa: 'ਮੇਰੀ ਖੇਤ ਦੀ ਨੋਟਬੁੱਕ ਵਿੱਚ ਇਸਦਾ ਭਰੋਸੇਯੋਗ ਜਵਾਬ ਹਾਲੇ ਨਹੀਂ, ਇਸ ਲਈ ਮੈਂ ਅੰਦਾਜ਼ਾ ਨਹੀਂ ਲਾਵਾਂਗਾ/ਲਾਵਾਂਗੀ। ਫਸਲ, ਯੋਜਨਾ (ਪੀਐਮ-ਕਿਸਾਨ / ਪੀਐਮਐਫਬੀਵਾਈ / ਐਮਐਸਪੀ) ਜਾਂ ਮੌਸਮ ਬਾਰੇ ਪੁੱਛੋ, ਜਾਂ ਖੇਤੀ ਮਾਹਿਰ ਨੂੰ ਭੇਜੋ।',
};

const ESCALATE_REPLIES: Record<string, string> = {
  en: 'This needs a human agronomist (chemical dose / medical-adjacent / low confidence). I have raised an escalation — an expert will follow up. Meanwhile avoid spraying from chat advice.',
  hi: 'यह बात मानव कृषि विशेषज्ञ के लिए है (दवाई की मात्रा / स्वास्थ्य से जुड़ी / कम भरोसा)। मैंने एस्केलेशन दर्ज कर दी है — विशेषज्ञ जल्द जवाब देंगे। चैट से स्प्रे न करें।',
  pa: 'ਇਹ ਗੱਲ ਮਨੁੱਖੀ ਖੇਤੀ ਮਾਹਿਰ ਲਈ ਹੈ (ਦਵਾਈ ਦੀ ਖੁਰਾਕ / ਸਿਹਤ ਨਾਲ ਜੁੜੀ / ਘੱਟ ਭਰੋਸਾ)। ਮੈਂ ਐਸਕਲੇਸ਼ਨ ਦਰਜ ਕਰ ਦਿੱਤੀ ਹੈ — ਮਾਹਿਰ ਜਲਦੀ ਜਵਾਬ ਦੇਣਗੇ। ਚੈਟ ਤੋਂ ਸਪਰੇ ਨਾ ਕਰੋ।',
};

function refuseReply(language: string): string {
  const fallback = REFUSE_REPLIES.en;
  if (fallback === undefined) {
    throw new Error('Missing English refuse reply');
  }
  return REFUSE_REPLIES[language] ?? fallback;
}

function escalateReply(language: string): string {
  const fallback = ESCALATE_REPLIES.en;
  if (fallback === undefined) {
    throw new Error('Missing English escalate reply');
  }
  return ESCALATE_REPLIES[language] ?? fallback;
}

function toCitations(ranked: RankedChunk[]): AssistantCitation[] {
  return ranked.map(({ chunk }) => ({
    id: chunk.id,
    title: chunk.title,
    source: chunk.source,
  }));
}

function formatEvidence(ranked: RankedChunk[]): string {
  return ranked
    .map(
      ({ chunk }, index) =>
        `[${String(index + 1)}] ${chunk.title} — ${chunk.source}\n${chunk.text}`,
    )
    .join('\n\n');
}

function buildGroundedSystemPrompt(role: Role, language: string, weatherMode = false): string {
  const parts = [
    buildSystemPrompt(role, language),
    'You are answering ONLY from the EVIDENCE passages below (Grounded Kisan / RAG).',
    'Cite sources inline like [1], [2] matching the evidence numbers.',
    'If evidence is insufficient, say you do not know — do not invent pesticide doses, eligibility, or medical advice.',
    'Keep replies under 70 words unless the user asks for more detail.',
  ];
  if (weatherMode) {
    parts.push(
      'If a [live] OpenWeatherMap passage is present, open with those live conditions and the 24–48h rain outlook, then give the curated practice tip. Do not invent rainfall amounts beyond the evidence.',
    );
  }
  return parts.join(' ');
}

async function notifyAgronomists(escalationId: string, question: string): Promise<void> {
  const experts = await getPrismaClient().user.findMany({
    where: { role: 'AGRONOMIST', deletedAt: null, isSuspended: false },
    select: { id: true },
  });
  if (experts.length === 0) return;

  const preview = question.length > 160 ? `${question.slice(0, 157)}…` : question;
  await createNotifications(
    experts.map((expert) => ({
      userId: expert.id,
      type: 'ADVISORY_ESCALATION' as const,
      title: 'New advisory escalation',
      body: preview,
      params: { variant: 'escalation', preview },
      relatedEntityType: 'AdvisoryEscalation',
      relatedEntityId: escalationId,
    })),
  );
}

export async function createEscalation(input: {
  farmerId: string;
  question: string;
  reason: EscalationReason | 'low_confidence' | 'empty_retrieval';
  language: string;
}): Promise<{ id: string }> {
  const row = await getPrismaClient().advisoryEscalation.create({
    data: {
      farmerId: input.farmerId,
      question: input.question,
      reason: input.reason,
      language: input.language,
    },
    select: { id: true },
  });

  await createNotification({
    userId: input.farmerId,
    type: 'ADVISORY_ESCALATION',
    title: 'Escalated to agronomist',
    body: 'Your question was sent to a human agronomist.',
    params: { variant: 'farmer_ack', reason: input.reason },
    relatedEntityType: 'AdvisoryEscalation',
    relatedEntityId: row.id,
  });

  await notifyAgronomists(row.id, input.question);
  return row;
}

export async function answerGrounded(input: {
  message: string;
  history: AssistantTurn[];
  role: Role;
  userId: string;
  language: string;
}): Promise<AssistantQueryResult> {
  const env = getEnv();
  const ranked = retrieveKnowledge(input.message);

  if (ranked.length === 0 || !retrievalIsConfident(ranked)) {
    if (ranked.length === 0) {
      return {
        reply: refuseReply(input.language),
        source: 'refused',
        mode: 'refused',
        escalationReason: 'empty_retrieval',
        retrievalScores: [],
      };
    }
    const { id } = await createEscalation({
      farmerId: input.userId,
      question: input.message,
      reason: 'low_confidence',
      language: input.language,
    });
    return {
      reply: escalateReply(input.language),
      source: 'escalated',
      mode: 'escalated',
      escalated: true,
      escalationId: id,
      escalationReason: 'low_confidence',
      retrievalScores: ranked.map((row) => Number(row.score.toFixed(2))),
    };
  }

  const profile = await getPrismaClient().user.findUnique({
    where: { id: input.userId },
    select: { state: true, district: true, village: true },
  });
  const location = profile ?? undefined;

  if (!env.GEMINI_API_KEY) {
    // Still return citations so demos work without inventing prose.
    const citations = toCitations(ranked);
    const summary = ranked
      .slice(0, 2)
      .map((row, index) => `[${String(index + 1)}] ${row.chunk.text}`)
      .join('\n');
    const wantsWeather = ranked.some((row) => row.chunk.category === 'weather');
    let reply = `${summary}\n\n(${citations.map((c) => c.source).join('; ')})`;
    if (wantsWeather) {
      const live = await fetchLiveWeather(input.language, location);
      if (live) {
        reply = `${live.alertLine}\n\n${reply}`;
        citations.push(live.citation);
      }
    }
    return {
      reply,
      source: 'local',
      mode: 'grounded',
      citations,
      retrievalScores: ranked.map((row) => Number(row.score.toFixed(2))),
    };
  }

  const model = resolveGeminiModel(env.GEMINI_MODEL);
  let evidence = formatEvidence(ranked);
  const citations = toCitations(ranked);
  const wantsWeather = ranked.some((row) => row.chunk.category === 'weather');
  let liveAlert: string | null = null;
  if (wantsWeather) {
    const live = await fetchLiveWeather(input.language, location);
    if (live) {
      evidence = `${evidence}\n\n[live] OpenWeatherMap — live sample\n${live.evidence}`;
      liveAlert = live.alertLine;
      citations.push(live.citation);
    }
  }
  let reply = await generateGeminiTextForGrounded({
    model,
    system: buildGroundedSystemPrompt(input.role, input.language, wantsWeather),
    message: `${wrapUserMessage(input.message, input.language)}\n\n### EVIDENCE\n${evidence}`,
    history: input.history,
  });

  if (!replyMatchesLanguage(reply, input.language)) {
    try {
      const rewritten = await generateGeminiTextForGrounded({
        model,
        system: buildGroundedSystemPrompt(input.role, input.language, wantsWeather),
        message: `${nativeLanguageLock(input.language)}\n\nRewrite using the same citations [n]. Keep meaning. Do not add new facts.\n\n${reply}`,
        history: [],
        maxOutputTokens: 768,
        timeoutMs: 15_000,
      });
      if (replyMatchesLanguage(rewritten, input.language)) reply = rewritten;
    } catch {
      /* keep first */
    }
  }

  // Always surface the live alert so farmers see conditions even if the model omits them.
  if (liveAlert && !/live weather|लाइव मौसम|ਲਾਈਵ ਮੌਸਮ|openweathermap/i.test(reply)) {
    reply = `${liveAlert}\n\n${reply}`;
  }

  return {
    reply,
    source: 'grounded',
    mode: 'grounded',
    citations,
    retrievalScores: ranked.map((row) => Number(row.score.toFixed(2))),
  };
}

export async function handleEscalationRoute(input: {
  message: string;
  userId: string;
  language: string;
  reason: EscalationReason;
}): Promise<AssistantQueryResult> {
  const { id } = await createEscalation({
    farmerId: input.userId,
    question: input.message,
    reason: input.reason,
    language: input.language,
  });
  return {
    reply: escalateReply(input.language),
    source: 'escalated',
    mode: 'escalated',
    escalated: true,
    escalationId: id,
    escalationReason: input.reason,
  };
}

export { classifyAssistantRoute, refuseReply };

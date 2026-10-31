import type { Role } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { AssistantTurn } from './assistant.schema.js';
import type { AssistantQueryResult } from './grounded.service.js';

export const MISSING_KEY_REPLY =
  "I'm ready to chat, but my field notes aren't connected yet. Ask the AgriConnect admin to add GEMINI_API_KEY to the backend .env file (from Google AI Studio), then try again.";

const MISSING_KEY_REPLIES: Record<string, string> = {
  en: MISSING_KEY_REPLY,
  hi: 'मैं बात करने को तैयार हूँ, पर अभी खेत की नोटबुक जुड़ी नहीं है। कृपया AgriConnect एडमिन से GEMINI_API_KEY लगवाने को कहें, फिर दोबारा कोशिश करें।',
  pa: 'ਮੈਂ ਗੱਲਬਾਤ ਲਈ ਤਿਆਰ ਹਾਂ, ਪਰ ਹਾਲੇ ਖੇਤ ਦੀਆਂ ਨੋਟਾਂ ਜੁੜੀਆਂ ਨਹੀਂ। ਕਿਰਪਾ ਕਰਕੇ AgriConnect ਐਡਮਿਨ ਨੂੰ GEMINI_API_KEY ਲਗਾਉਣ ਲਈ ਕਹੋ, ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
};

export function missingKeyReply(language = 'en'): string {
  return MISSING_KEY_REPLIES[language] ?? MISSING_KEY_REPLIES.en ?? MISSING_KEY_REPLY;
}

const DEPRECATED_GEMINI_MODELS: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash-exp': 'gemini-3.6-flash',
  'gemini-2.0-flash-lite': 'gemini-3.6-flash',
  'gemini-1.5-flash': 'gemini-3.6-flash',
  'gemini-1.5-flash-8b': 'gemini-3.6-flash',
};

/** Maps retired model ids to a current default (also used when .env still names an old model). */
export function resolveGeminiModel(model: string): string {
  const normalized = model.trim().replace(/^models\//, '');
  return DEPRECATED_GEMINI_MODELS[normalized] ?? normalized;
}

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    thoughtsTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string; status?: string; code?: number };
}

type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/**
 * Gemini 3 models control reasoning with `thinkingLevel`; the 2.5 series uses `thinkingBudget`.
 * Sending the wrong one is a 400, and thinking tokens are billed against `maxOutputTokens`,
 * so leaving this unset lets a flash model spend the whole budget thinking and return nothing.
 */
export function buildThinkingConfig(
  model: string,
  level: ThinkingLevel = 'minimal',
): Record<string, unknown> | undefined {
  const normalized = resolveGeminiModel(model).toLowerCase();
  if (/^(?:models\/)?gemini-(?:[3-9]|\d{2,})/.test(normalized)) {
    return { thinkingLevel: level };
  }
  if (normalized.startsWith('gemini-2.5')) {
    return { thinkingBudget: level === 'minimal' ? 0 : -1 };
  }
  return undefined;
}

interface ReplyStyle {
  name: string;
  script: string;
  honorifics: string;
  greeting: string;
}

/** Also the fallback for any language we have not tuned a prompt for. */
const ENGLISH_REPLY_STYLE: ReplyStyle = {
  name: 'English',
  script: 'Latin',
  honorifics: 'please, thank you, and respectful address',
  greeting: 'Namaste or Hello',
};

const REPLY_STYLE: Record<string, ReplyStyle> = {
  en: ENGLISH_REPLY_STYLE,
  hi: {
    name: 'Hindi',
    script: 'Devanagari',
    honorifics: 'जी, कृपया, धन्यवाद',
    greeting: 'नमस्ते जी',
  },
  pa: {
    name: 'Punjabi',
    script: 'Gurmukhi',
    honorifics: 'ਜੀ, ਕਿਰਪਾ ਕਰਕੇ, ਧੰਨਵਾਦ',
    greeting: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ',
  },
  bn: {
    name: 'Bengali',
    script: 'Bangla',
    honorifics: 'দয়া করে, আপনি, ধন্যবাদ',
    greeting: 'নমস্কার',
  },
  ta: {
    name: 'Tamil',
    script: 'Tamil',
    honorifics: 'தயவு செய்து, நீங்கள், நன்றி',
    greeting: 'வணக்கம்',
  },
  te: {
    name: 'Telugu',
    script: 'Telugu',
    honorifics: 'దయచేసి, గారు, ధన్యవాదాలు',
    greeting: 'నమస్కారం',
  },
  mr: {
    name: 'Marathi',
    script: 'Devanagari',
    honorifics: 'कृपया, तुम्ही, धन्यवाद',
    greeting: 'नमस्कार',
  },
  gu: {
    name: 'Gujarati',
    script: 'Gujarati',
    honorifics: 'કૃપા કરીને, તમે, આભાર',
    greeting: 'નમસ્તે',
  },
  kn: {
    name: 'Kannada',
    script: 'Kannada',
    honorifics: 'ದಯವಿಟ್ಟು, ನೀವು, ಧನ್ಯವಾದಗಳು',
    greeting: 'ನಮಸ್ಕಾರ',
  },
  ml: {
    name: 'Malayalam',
    script: 'Malayalam',
    honorifics: 'ദയവായി, നിങ്ങൾ, നന്ദി',
    greeting: 'നമസ്കാരം',
  },
  or: {
    name: 'Odia',
    script: 'Odia',
    honorifics: 'ଦୟାକରି, ଆପଣ, ଧନ୍ୟବାଦ',
    greeting: 'ନମସ୍କାର',
  },
  as: {
    name: 'Assamese',
    script: 'Assamese/Bengali',
    honorifics: 'অনুগ্রহ কৰি, আপুনি, ধন্যবাদ',
    greeting: 'নমস্কাৰ',
  },
  ur: {
    name: 'Urdu',
    script: 'Nastaliq',
    honorifics: 'براہ کرم، جی، شکریہ',
    greeting: 'السلام علیکم',
  },
};

function getReplyStyle(language: string): ReplyStyle {
  return REPLY_STYLE[language] ?? ENGLISH_REPLY_STYLE;
}

export function languageLockPreamble(language = 'en'): string {
  const style = getReplyStyle(language);
  return `Reply language lock: answer ONLY in polite ${style.name} (${style.script} script). Use ${style.honorifics}. Do not answer in English or any other language unless the user explicitly asks to switch. Do not repeat this lock in the answer.`;
}

const NATIVE_LOCKS: Record<string, string> = {
  en: 'Write the full answer in clear, polite English.',
  hi: 'पूरा उत्तर केवल देवनागरी हिंदी में लिखें। अंग्रेज़ी वाक्य न लिखें। विनम्र रहें (जी, कृपया)।',
  pa: 'ਪੂਰਾ ਜਵਾਬ ਸਿਰਫ਼ ਗੁਰਮੁਖੀ ਪੰਜਾਬੀ ਵਿੱਚ ਲਿਖੋ। ਅੰਗਰੇਜ਼ੀ ਵਾਕ ਨਾ ਲਿਖੋ। ਵਿਨਮਰ ਰਹੋ (ਜੀ, ਕਿਰਪਾ ਕਰਕੇ)।',
  bn: 'সম্পূর্ণ উত্তর শুধু বাংলায় লিখুন। ইংরেজি বাক্য লিখবেন না। নম্র থাকুন।',
  ta: 'முழு பதிலையும் தமிழிலேயே எழுதுங்கள். ஆங்கில வாக்கியம் வேண்டாம். பணிவாக எழுதுங்கள்.',
  te: 'పూర్తి సమాధానం తెలుగులోనే రాయండి. ఆంగ్ల వాక్యాలు రాయవద్దు. మర్యాదగా రాయండి.',
  mr: 'संपूर्ण उत्तर फक्त मराठीत लिहा. इंग्रजी वाक्य लिहू नका. नम्र राहा.',
  gu: 'સંપૂર્ણ જવાબ ફક્ત ગુજરાતીમાં લખો. અંગ્રેજી વાક્ય ન લખો. વિનમ્ર રહો.',
  kn: 'ಪೂರ್ಣ ಉತ್ತರವನ್ನು ಕನ್ನಡದಲ್ಲಿಯೇ ಬರೆಯಿರಿ. ಆಂಗ್ಲ ವಾಕ್ಯ ಬೇಡ. ವಿನಯದಿಂದ ಬರೆಯಿರಿ.',
  ml: 'മുഴുവൻ ഉത്തരവും മലയാളത്തിൽ മാത്രം എഴുതുക. ഇംഗ്ലീഷ് വാക്യം വേണ്ട. വിനയത്തോടെ എഴുതുക.',
  or: 'ସମ୍ପୂର୍ଣ୍ଣ ଉତ୍ତର କେବଳ ଓଡ଼ିଆରେ ଲେଖନ୍ତୁ। ଇଂରାଜୀ ବାକ୍ୟ ଲେଖନ୍ତୁ ନାହିଁ।',
  as: 'সম্পূৰ্ণ উত্তৰ কেৱল অসমীয়াত লিখক। ইংৰাজী বাক্য নিলিখিব।',
  ur: 'پورا جواب صرف اردو میں لکھیں۔ انگریزی جملے نہ لکھیں۔ مؤدب رہیں۔',
};

const SCRIPT_RANGES: Record<string, RegExp> = {
  hi: /[\u0900-\u097F]/g,
  pa: /[\u0A00-\u0A7F]/g,
  bn: /[\u0980-\u09FF]/g,
  ta: /[\u0B80-\u0BFF]/g,
  te: /[\u0C00-\u0C7F]/g,
  mr: /[\u0900-\u097F]/g,
  gu: /[\u0A80-\u0AFF]/g,
  kn: /[\u0C80-\u0CFF]/g,
  ml: /[\u0D00-\u0D7F]/g,
  or: /[\u0B00-\u0B7F]/g,
  as: /[\u0980-\u09FF]/g,
  ur: /[\u0600-\u06FF]/g,
};

export function nativeLanguageLock(language = 'en'): string {
  return NATIVE_LOCKS[language] ?? NATIVE_LOCKS.en ?? 'Write the full answer in clear, polite English.';
}

export function wrapUserMessage(message: string, language = 'en'): string {
  return `${message.trim()}\n\n---\n${nativeLanguageLock(language)}\n${languageLockPreamble(language)}`;
}

export function replyMatchesLanguage(text: string, language = 'en'): boolean {
  if (!language || language === 'en') return true;
  const script = SCRIPT_RANGES[language];
  if (!script) return true;
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 8) return true;
  const hits = text.match(new RegExp(script.source, 'g')) ?? [];
  return hits.length / letters.length >= 0.3;
}

export function buildSystemPrompt(role: Role, language = 'en'): string {
  const roleLine =
    role === 'FARMER'
      ? 'The user is a farmer on AgriConnect. Help them list produce, set fair prices, manage orders, and care for crops.'
      : role === 'BUYER'
        ? 'The user is a buyer on AgriConnect. Help them browse listings, place orders, and understand fair farm prices.'
        : role === 'AGRONOMIST'
          ? 'The user is a human agronomist reviewing escalations from Grounded Kisan. Help them understand AgriConnect advisory handoff and marketplace context.'
          : 'The user is an AgriConnect admin. Help them understand how farmers and buyers use the marketplace.';

  const style = getReplyStyle(language);
  const languageLine = `Always reply ONLY in ${style.name} using ${style.script} script — even if the user types in English or another language. Never mix scripts. Do not switch language unless the user clearly asks to change language.`;
  const politenessLine = `Be warm, humble, and polite — like a respectful farm helper speaking to an elder. Use natural honorifics (${style.honorifics}). Greet with ${style.greeting} when starting a conversation. Never be blunt, sarcastic, or commanding. Thank the user when they share details.`;

  return [
    'You are Kisan, a friendly farm helper mascot for AgriConnect, a farm-to-market marketplace in India.',
    roleLine,
    languageLine,
    politenessLine,
    'If earlier chat turns were in another language, still answer THIS turn only in the required language.',
    'Answer clearly in plain language. Prefer 2–4 short sentences — no long bullet lists.',
    'Keep most replies under 45 words unless the user asks for more detail — farmers often listen aloud, so brevity matters.',
    'You can explain: listing produce, marketplace browsing, orders, notifications, fair pricing vs opaque mandi chains, general crop care, pests, harvest timing, and government-scheme awareness at a high level.',
    'Never invent listing prices, order statuses, or live mandi rates. If you do not know a current figure, say so and suggest checking listings or local mandi data.',
    'Do not give medical advice or prescribe specific pesticides/chemicals as if you were a licensed agronomist. For high-stakes crop disease or chemical use, tell the user to confirm with a local agronomist or Krishi Vigyan Kendra.',
    'Stay on farming, food markets, and AgriConnect. Politely decline unrelated topics.',
  ].join(' ');
}

export function toGeminiContents(message: string, history: AssistantTurn[]) {
  const contents = history.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });
  return contents;
}

function extractReply(payload: GeminiResponse, model: string): string {
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();

  const truncated = payload.candidates?.[0]?.finishReason === 'MAX_TOKENS';
  if (truncated) {
    logger.warn(
      {
        model,
        thoughtsTokenCount: payload.usageMetadata?.thoughtsTokenCount,
        candidatesTokenCount: payload.usageMetadata?.candidatesTokenCount,
      },
      'Gemini reply hit maxOutputTokens — raise the budget or lower GEMINI_THINKING_LEVEL',
    );
  }

  if (!text) {
    throw new AppError(
      502,
      'ASSISTANT_UNAVAILABLE',
      'Kisan could not prepare an answer. Please try again.',
    );
  }
  return text;
}

export async function queryAssistantChat(input: {
  message: string;
  history: AssistantTurn[];
  role: Role;
  language?: string | undefined;
}): Promise<{ reply: string; source: 'gemini' | 'local' }> {
  const env = getEnv();
  const language = input.language ?? 'en';
  if (!env.GEMINI_API_KEY) {
    return { reply: missingKeyReply(language), source: 'local' };
  }

  const model = resolveGeminiModel(env.GEMINI_MODEL);
  let reply = await generateGeminiText({
    model,
    system: buildSystemPrompt(input.role, language),
    contents: toGeminiContents(wrapUserMessage(input.message, language), input.history),
  });

  if (!replyMatchesLanguage(reply, language)) {
    try {
      const rewritten = await generateGeminiText({
        model,
        system: buildSystemPrompt(input.role, language),
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${nativeLanguageLock(language)}\n\nRewrite the following answer in that language only. Keep the same meaning. Be polite. Do not keep English sentences.\n\n${reply}`,
              },
            ],
          },
        ],
        // Bounded so a slow rewrite cannot double the worst-case wait on the whole turn.
        maxOutputTokens: 1024,
        timeoutMs: 15_000,
      });
      if (replyMatchesLanguage(rewritten, language)) {
        reply = rewritten;
      }
    } catch {
      /* keep the first reply */
    }
  }

  return { reply, source: 'gemini' };
}

/**
 * Public Kisan entry: marketplace/app chat stays on the legacy Gemini path;
 * crop/scheme/weather goes through Grounded RAG; high-stakes asks escalate.
 */
export async function queryAssistant(input: {
  message: string;
  history: AssistantTurn[];
  role: Role;
  userId: string;
  language?: string | undefined;
}): Promise<AssistantQueryResult> {
  const language = input.language ?? 'en';
  const { classifyAssistantRoute, answerGrounded, handleEscalationRoute } =
    await import('./grounded.service.js');

  const decision = classifyAssistantRoute(input.message);
  if (decision.route === 'escalate' && decision.reason) {
    return handleEscalationRoute({
      message: input.message,
      userId: input.userId,
      language,
      reason: decision.reason,
    });
  }
  if (decision.route === 'grounded') {
    return answerGrounded({
      message: input.message,
      history: input.history,
      role: input.role,
      userId: input.userId,
      language,
    });
  }

  const chat = await queryAssistantChat({
    message: input.message,
    history: input.history,
    role: input.role,
    language,
  });
  return { reply: chat.reply, source: chat.source, mode: 'chat' };
}

const GEMINI_TIMEOUT_MS = 25_000;
const GEMINI_MAX_OUTPUT_TOKENS = 768;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when the model rejected a request parameter, e.g. an unsupported thinking field. */
function isInvalidArgument(payload: GeminiResponse): boolean {
  if (payload.error?.status === 'INVALID_ARGUMENT') return true;
  return /invalid argument|unknown name|thinking/i.test(payload.error?.message ?? '');
}

export async function generateGeminiTextForGrounded(input: {
  model: string;
  system: string;
  message: string;
  history: AssistantTurn[];
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  return generateGeminiText({
    model: input.model,
    system: input.system,
    contents: toGeminiContents(input.message, input.history),
    ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
  });
}

async function generateGeminiText(input: {
  model: string;
  system: string;
  contents: ReturnType<typeof toGeminiContents>;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const env = getEnv();
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
  );
  url.searchParams.set('key', env.GEMINI_API_KEY ?? '');

  let thinkingConfig = buildThinkingConfig(input.model, env.GEMINI_THINKING_LEVEL);
  let retriedTransport = false;

  for (;;) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(input.timeoutMs ?? GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: input.system }],
          },
          contents: input.contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: input.maxOutputTokens ?? GEMINI_MAX_OUTPUT_TOKENS,
            ...(thinkingConfig ? { thinkingConfig } : {}),
          },
        }),
      });
    } catch (error) {
      if (!retriedTransport) {
        retriedTransport = true;
        logger.warn({ model: input.model }, 'Gemini text request failed, retrying once');
        await delay(600);
        continue;
      }
      throw new AppError(
        502,
        'ASSISTANT_UNAVAILABLE',
        'Could not reach the farm assistant right now.',
        { cause: error },
      );
    }

    const payload = (await response.json().catch(() => ({}))) as GeminiResponse;

    if (!response.ok) {
      if (response.status === 400 && thinkingConfig && isInvalidArgument(payload)) {
        logger.warn(
          { model: input.model, message: payload.error?.message },
          'Gemini rejected the thinking config, retrying without it',
        );
        thinkingConfig = undefined;
        continue;
      }

      if (response.status >= 500 && !retriedTransport) {
        retriedTransport = true;
        await delay(600);
        continue;
      }

      const status = response.status === 429 ? 429 : 502;
      const apiMessage = payload.error?.message ?? '';
      const userMessage =
        apiMessage.includes('no longer available') || apiMessage.includes('not found')
          ? 'Kisan is updating to a newer AI model. Restart the API after setting GEMINI_MODEL=gemini-3.6-flash in backend/.env.'
          : apiMessage || 'The farm assistant is busy. Please try again shortly.';
      throw new AppError(
        status,
        status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'ASSISTANT_UNAVAILABLE',
        userMessage,
      );
    }

    return extractReply(payload, input.model);
  }
}

export function getAssistantStatus(): {
  configured: boolean;
  connected: boolean;
  model: string;
  source: 'gemini' | 'local';
} {
  const env = getEnv();
  const model = resolveGeminiModel(env.GEMINI_MODEL);
  if (!env.GEMINI_API_KEY) {
    return {
      configured: false,
      connected: false,
      model,
      source: 'local',
    };
  }

  return {
    configured: true,
    connected: true,
    model,
    source: 'gemini',
  };
}

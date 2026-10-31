import { createHash } from 'node:crypto';
import { AppError } from '../../common/app-error.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const TTS_TIMEOUT_MS = 25_000;
const TTS_CACHE_MAX = 32;
/** Hard ceiling so a read-aloud request can never hang through every model in the list. */
const MAX_TTS_ATTEMPTS = 3;
/**
 * Long replies make Gemini TTS slow (especially Punjabi). Speak the opening beat;
 * the full answer stays on screen.
 */
const MAX_TTS_CHARS = 280;

/** Model + languageCode variant that last worked, so we stop re-probing dead models. */
let workingVariant: { model: string; includeLanguageCode: boolean } | null = null;

/** Small LRU of rendered audio so re-tapping "read aloud" costs no quota. */
const audioCache = new Map<string, Buffer>();

function cacheKey(text: string, language: string): string {
  return createHash('sha1').update(`${language}\u0000${text}`).digest('hex');
}

function rememberAudio(key: string, wav: Buffer): void {
  audioCache.set(key, wav);
  if (audioCache.size > TTS_CACHE_MAX) {
    const oldest = audioCache.keys().next().value;
    if (oldest !== undefined) audioCache.delete(oldest);
  }
}

const TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
] as const;

const TTS_LANGUAGE_CODES: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'or-IN',
  as: 'as-IN',
  ur: 'ur-IN',
};

const TTS_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  pa: 'Punjabi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  or: 'Odia',
  as: 'Assamese',
  ur: 'Urdu',
};

interface GeminiTtsResponse {
  candidates?: {
    content?: {
      parts?: {
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
        text?: string;
      }[];
    };
  }[];
  error?: { message?: string; status?: string; code?: number };
}

export function textForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keeps read-aloud short so TTS returns faster without changing the chat bubble. */
export function clipForTts(text: string, max = MAX_TTS_CHARS): string {
  const cleaned = textForSpeech(text);
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const breakAt = Math.max(
    slice.lastIndexOf('।'),
    slice.lastIndexOf('.'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf('?'),
    slice.lastIndexOf(' '),
  );
  return (breakAt > max * 0.45 ? slice.slice(0, breakAt) : slice).trim();
}

export function buildTtsPrompt(text: string, language = 'en'): string {
  const spoken = clipForTts(text);
  const name = TTS_LANGUAGE_NAMES[language] ?? 'English';
  return [
    `Read the TRANSCRIPT aloud in ${name}. Recite it exactly. Do not add extra words, titles, or instructions.`,
    '',
    '### TRANSCRIPT',
    spoken,
  ].join('\n');
}

export function pcmToWav(
  pcm: Buffer,
  sampleRate = 24_000,
  channels = 1,
  bitDepth = 16,
): Buffer {
  const blockAlign = (channels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseSampleRate(mimeType: string | undefined): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  const rate = match ? Number(match[1]) : 24_000;
  return Number.isFinite(rate) && rate > 0 ? rate : 24_000;
}

interface TtsVariant {
  model: string;
  includeLanguageCode: boolean;
}

function sameVariant(a: TtsVariant, b: TtsVariant): boolean {
  return a.model === b.model && a.includeLanguageCode === b.includeLanguageCode;
}

function pushVariant(queue: TtsVariant[], variant: TtsVariant): void {
  if (!queue.some((existing) => sameVariant(existing, variant))) queue.push(variant);
}

function isLanguageCodeRejected(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  return /invalid argument|unknown name|language_code|languageCode|not supported/i.test(
    error.message,
  );
}

function ttsModelCandidates(): string[] {
  const env = getEnv();
  const preferred = env.GEMINI_TTS_MODEL?.trim();
  // Prefer the pinned model, then one flash fallback — never walk the whole pro list.
  if (preferred) {
    const fallback = TTS_MODELS.find((model) => model !== preferred);
    return fallback ? [preferred, fallback] : [preferred];
  }
  return [...TTS_MODELS];
}

async function requestTts(input: {
  model: string;
  prompt: string;
  languageCode: string;
  includeLanguageCode: boolean;
}): Promise<{ pcm: Buffer; mimeType: string }> {
  const env = getEnv();
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
  );
  url.searchParams.set('key', env.GEMINI_API_KEY ?? '');

  const speechConfig: Record<string, unknown> = {
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: 'Kore' },
    },
  };
  if (input.includeLanguageCode) {
    speechConfig.languageCode = input.languageCode;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: [{ text: input.prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as GeminiTtsResponse;
  if (!response.ok) {
    const message = payload.error?.message ?? `TTS HTTP ${String(response.status)}`;
    throw new AppError(
      response.status === 404 || response.status === 400 ? 502 : response.status === 429 ? 429 : 502,
      response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'ASSISTANT_UNAVAILABLE',
      message,
    );
  }

  const part = payload.candidates?.[0]?.content?.parts?.[0];
  const inline = part?.inlineData ?? part?.inline_data;
  const data = inline?.data;
  if (!data) {
    throw new AppError(502, 'ASSISTANT_UNAVAILABLE', 'Kisan could not prepare audio.');
  }

  const mimeType =
    'mimeType' in inline
      ? inline.mimeType
      : 'mime_type' in inline
        ? inline.mime_type
        : 'audio/l16;rate=24000';

  return {
    pcm: Buffer.from(data, 'base64'),
    mimeType,
  };
}

export async function synthesizeSpeech(input: {
  text: string;
  language?: string | undefined;
}): Promise<Buffer> {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      502,
      'ASSISTANT_UNAVAILABLE',
      'Voice readout is not connected yet.',
    );
  }

  const language = input.language ?? 'en';
  const spoken = clipForTts(input.text);
  const key = cacheKey(spoken, language);
  const cached = audioCache.get(key);
  if (cached) {
    audioCache.delete(key);
    audioCache.set(key, cached);
    return cached;
  }

  const prompt = buildTtsPrompt(spoken, language);
  const languageCode = TTS_LANGUAGE_CODES[language] ?? 'en-IN';

  const queue: TtsVariant[] = [];
  if (workingVariant) queue.push(workingVariant);
  for (const model of ttsModelCandidates()) {
    pushVariant(queue, { model, includeLanguageCode: true });
  }

  let lastError: unknown;
  for (let index = 0; index < queue.length && index < MAX_TTS_ATTEMPTS; index += 1) {
    const variant = queue[index];
    if (!variant) break;
    try {
      const { pcm, mimeType } = await requestTts({
        model: variant.model,
        prompt,
        languageCode,
        includeLanguageCode: variant.includeLanguageCode,
      });
      workingVariant = variant;
      const wav = pcmToWav(pcm, parseSampleRate(mimeType));
      rememberAudio(key, wav);
      return wav;
    } catch (error) {
      lastError = error;
      if (error instanceof AppError && error.statusCode === 429) {
        throw error;
      }
      if (workingVariant && sameVariant(workingVariant, variant)) {
        workingVariant = null;
      }
      // Some models reject `speechConfig.languageCode`; only then is it worth dropping it.
      if (variant.includeLanguageCode && isLanguageCodeRejected(error)) {
        pushVariant(queue, { model: variant.model, includeLanguageCode: false });
      }
    }
  }

  logger.warn(
    { language, attempts: Math.min(queue.length, MAX_TTS_ATTEMPTS) },
    'Gemini TTS did not return audio',
  );

  if (lastError instanceof AppError) throw lastError;
  throw new AppError(
    502,
    'ASSISTANT_UNAVAILABLE',
    'Could not generate spoken audio right now.',
    { cause: lastError },
  );
}

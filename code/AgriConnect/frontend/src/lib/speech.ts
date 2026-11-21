'use client';

import type { Locale } from '@/lib/i18n/locales';
import { SPEECH_LOCALE_TAGS } from '@/lib/i18n/locales';
import { speakAssistant } from '@/lib/api/assistant';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type SpeechVoiceLike = {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
};

/** Ordered BCP-47 tags to try for TTS/STT when the exact locale voice is missing. */
export const SPEECH_LANG_FALLBACKS: Record<Locale, string[]> = {
  en: ['en-IN', 'en-GB', 'en-US', 'en'],
  hi: ['hi-IN', 'hi'],
  pa: ['pa-IN', 'pa-Guru-IN', 'pa', 'hi-IN', 'hi'],
  bn: ['bn-IN', 'bn-BD', 'bn'],
  ta: ['ta-IN', 'ta'],
  te: ['te-IN', 'te'],
  mr: ['mr-IN', 'mr', 'hi-IN', 'hi'],
  gu: ['gu-IN', 'gu', 'hi-IN', 'hi'],
  kn: ['kn-IN', 'kn'],
  ml: ['ml-IN', 'ml'],
  or: ['or-IN', 'or', 'hi-IN', 'hi'],
  as: ['as-IN', 'as', 'bn-IN', 'bn'],
  ur: ['ur-IN', 'ur-PK', 'ur', 'hi-IN', 'hi'],
};

const SPEECH_VOICE_NAME_HINTS: Record<Locale, string[]> = {
  en: ['english'],
  hi: ['hindi', 'हिन्दी', 'हिंदी'],
  pa: ['punjabi', 'panjabi', 'ਪੰਜਾਬੀ'],
  bn: ['bengali', 'bangla', 'বাংলা'],
  ta: ['tamil', 'தமிழ்'],
  te: ['telugu', 'తెలుగు'],
  mr: ['marathi', 'मराठी'],
  gu: ['gujarati', 'ગુજરાતੀ'],
  kn: ['kannada', 'ಕನ್ನಡ'],
  ml: ['malayalam', 'മലയാളം'],
  or: ['odia', 'oriya', 'ଓଡ଼ିଆ'],
  as: ['assamese', 'অসমীয়া'],
  ur: ['urdu', 'اردو'],
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

let speakGeneration = 0;
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
// Write-only on purpose: Chrome can garbage-collect a speaking utterance and cut the
// audio off mid-sentence, so the browser-fallback path keeps a live reference to it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let heldUtterance: SpeechSynthesisUtterance | null = null;
let keepAliveTimer: number | null = null;
let audioUnlocked = false;

function clearKeepAlive() {
  if (keepAliveTimer != null) {
    window.clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function releaseAudio() {
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

export function stopSpeaking(): void {
  speakGeneration += 1;
  heldUtterance = null;
  clearKeepAlive();
  releaseAudio();
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
}

/** Call from a tap so later auto-read is allowed to play HTML audio. */
export function unlockSpeechPlayback(): void {
  if (typeof window === 'undefined' || audioUnlocked) return;
  audioUnlocked = true;
  const silent = new Audio(
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
  );
  silent.volume = 0.01;
  void silent.play().catch(() => {
    audioUnlocked = false;
  });
}

function normalizeLangTag(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-');
}

/** Pick the installed voice that best matches the UI locale (needed — browsers ignore `utterance.lang` alone). */
export function pickSpeechVoice(
  voices: SpeechVoiceLike[],
  locale: Locale,
): SpeechVoiceLike | null {
  if (!voices.length) return null;

  const preferred = SPEECH_LANG_FALLBACKS[locale];
  const hints = SPEECH_VOICE_NAME_HINTS[locale].map((hint) => hint.toLowerCase());

  let best: SpeechVoiceLike | null = null;
  let bestScore = 0;

  for (const voice of voices) {
    const lang = normalizeLangTag(voice.lang);
    const name = voice.name.toLowerCase();
    let score = 0;

    preferred.forEach((tag, index) => {
      const t = normalizeLangTag(tag);
      const primary = t.split('-')[0] ?? t;
      const weight = (preferred.length - index) * 10;
      if (lang === t) score = Math.max(score, 200 + weight);
      else if (lang.startsWith(`${t}-`)) score = Math.max(score, 180 + weight);
      else if (lang === primary || lang.startsWith(`${primary}-`)) score = Math.max(score, 70 + weight);
    });

    if (hints.some((hint) => name.includes(hint))) {
      score += 45;
    }

    if (voice.localService) score += 4;
    if (voice.default && score > 0) score += 2;

    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return bestScore > 0 ? best : null;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', finish);
    window.setTimeout(finish, 1500);
  });
}

export function preloadSpeechVoices(): void {
  void loadVoices();
}

export function splitSpeakChunks(text: string, max = 180): string[] {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];
  const pieces = trimmed.split(/([।.!?…])/);
  const sentences: string[] = [];
  for (let index = 0; index < pieces.length; index += 2) {
    const sentence = `${pieces[index] ?? ''}${pieces[index + 1] ?? ''}`.trim();
    if (sentence) sentences.push(sentence);
  }
  const chunks: string[] = [];
  let buffer = '';
  for (const sentence of sentences.length ? sentences : [trimmed]) {
    const next = buffer ? `${buffer} ${sentence}` : sentence;
    if (next.length > max && buffer) {
      chunks.push(buffer);
      buffer = sentence;
    } else {
      buffer = next;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

function speakBrowserChunks(
  text: string,
  locale: Locale,
  generation: number,
  options?: { onEnd?: () => void; onError?: () => void },
): void {
  if (!isSpeechSynthesisSupported()) {
    options?.onError?.();
    options?.onEnd?.();
    return;
  }

  void loadVoices().then((voices) => {
    if (generation !== speakGeneration) return;
    const chunks = splitSpeakChunks(text);
    if (!chunks.length) {
      options?.onEnd?.();
      return;
    }

    const matched = pickSpeechVoice(voices, locale);
    let index = 0;

    const speakNext = () => {
      if (generation !== speakGeneration) return;
      const chunk = chunks[index];
      if (!chunk) {
        clearKeepAlive();
        heldUtterance = null;
        options?.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      heldUtterance = utterance;
      if (matched) {
        utterance.voice = matched as SpeechSynthesisVoice;
        utterance.lang = matched.lang || SPEECH_LOCALE_TAGS[locale];
      } else {
        utterance.lang = SPEECH_LOCALE_TAGS[locale];
      }
      utterance.rate = 0.92;
      utterance.onend = () => {
        index += 1;
        speakNext();
      };
      utterance.onerror = () => {
        if (generation !== speakGeneration) return;
        clearKeepAlive();
        heldUtterance = null;
        options?.onError?.();
        options?.onEnd?.();
      };
      window.speechSynthesis.speak(utterance);
    };

    clearKeepAlive();
    keepAliveTimer = window.setInterval(() => {
      if (generation !== speakGeneration || !window.speechSynthesis.speaking) return;
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 8_000);

    window.setTimeout(speakNext, 50);
  });
}

function playAudioBlob(
  blob: Blob,
  generation: number,
  options?: { onEnd?: () => void; onError?: () => void },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (generation !== speakGeneration) {
      resolve();
      return;
    }
    releaseAudio();
    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      if (generation !== speakGeneration) {
        resolve();
        return;
      }
      releaseAudio();
      options?.onEnd?.();
      resolve();
    };
    audio.onerror = () => {
      releaseAudio();
      reject(new Error('audio-play-failed'));
    };
    void audio.play().catch((error: unknown) => {
      releaseAudio();
      reject(error instanceof Error ? error : new Error('audio-play-failed'));
    });
  });
}

export function speakText(
  text: string,
  locale: Locale,
  options?: { onEnd?: () => void; onError?: () => void },
): void {
  const spoken = text.replace(/\s+/g, ' ').trim();
  if (!spoken) {
    options?.onEnd?.();
    return;
  }

  // Match the server TTS clip so we do not upload a long reply only for it to be trimmed.
  const forTts =
    spoken.length <= 280
      ? spoken
      : (() => {
          const slice = spoken.slice(0, 280);
          const breakAt = Math.max(
            slice.lastIndexOf('।'),
            slice.lastIndexOf('.'),
            slice.lastIndexOf('!'),
            slice.lastIndexOf('?'),
            slice.lastIndexOf(' '),
          );
          return (breakAt > 126 ? slice.slice(0, breakAt) : slice).trim();
        })();

  const generation = ++speakGeneration;
  releaseAudio();
  window.speechSynthesis?.cancel();
  heldUtterance = null;
  clearKeepAlive();

  void (async () => {
    try {
      const blob = await speakAssistant({ text: forTts, language: locale });
      if (generation !== speakGeneration) return;
      await playAudioBlob(blob, generation, options);
    } catch {
      if (generation !== speakGeneration) return;
      speakBrowserChunks(forTts, locale, generation, options);
    }
  })();
}

export function startListening(options: {
  locale: Locale;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}): { stop: () => void } | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = SPEECH_LOCALE_TAGS[options.locale];
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = last?.[0]?.transcript?.trim() ?? '';
    if (!transcript) return;
    const isFinal = Boolean((last as { isFinal?: boolean } | undefined)?.isFinal ?? true);
    options.onResult(transcript, isFinal);
  };

  recognition.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    options.onError?.(event.error ?? 'speech-error');
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    options.onError?.('start-failed');
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    },
  };
}

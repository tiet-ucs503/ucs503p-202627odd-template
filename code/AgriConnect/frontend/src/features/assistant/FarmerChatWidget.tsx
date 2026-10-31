'use client';

import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { getAssistantStatus, queryAssistant } from '@/lib/api/assistant';
import { ApiError, getErrorMessage } from '@/lib/api/errors';
import type { Role } from '@/lib/api/types';
import { cx } from '@/components/ui';
import { useLocale } from '@/features/i18n/locale-context';
import type { Locale } from '@/lib/i18n/locales';
import {
  isSpeechRecognitionSupported,
  preloadSpeechVoices,
  speakText,
  startListening,
  stopSpeaking,
  unlockSpeechPlayback,
} from '@/lib/speech';
import { FarmerMascot } from './FarmerMascot';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  locale?: Locale;
  citations?: { id: string; title: string; source: string }[];
  escalated?: boolean;
}

const AUTO_SPEAK_KEY = 'agriconnect.kisan.autoSpeak';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clipForHistory(content: string, max = 800): string {
  const trimmed = content.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function VoiceWave({ active, tone }: { active: boolean; tone: 'listen' | 'speak' | 'idle' }) {
  const color =
    tone === 'listen' ? 'bg-harvest' : tone === 'speak' ? 'bg-leaf' : 'bg-forest/25';
  return (
    <div className="flex h-8 items-end justify-center gap-1" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <span
          key={index}
          className={cx(
            'w-1 rounded-full transition-all',
            color,
            active ? 'kisan-wave-bar' : 'h-1.5 opacity-50',
          )}
          style={active ? { animationDelay: `${index * 70}ms` } : undefined}
        />
      ))}
    </div>
  );
}

export function FarmerChatWidget({
  role,
  name,
}: {
  role: Role;
  name: string;
}) {
  const { t, locale } = useLocale();
  const panelId = useId();
  const titleId = useId();
  const inputId = useId();
  const liveId = useId();
  const firstName = name.split(' ')[0] ?? '';
  const nameSuffix = firstName ? `, ${firstName}` : '';

  const greeting = useMemo(() => {
    if (role === 'FARMER') return t('kisan.greetingFarmer', { name: nameSuffix });
    if (role === 'BUYER') return t('kisan.greetingBuyer', { name: nameSuffix });
    // ADMIN + AGRONOMIST share the same helper greeting (expert uses escalations API).
    return t('kisan.greetingAdmin', { name: nameSuffix });
  }, [role, nameSuffix, t]);

  const chips = useMemo(
    () => [
      t('kisan.chips.list'),
      t('kisan.chips.fairPrice'),
      t('kisan.chips.cropCare'),
      t('kisan.chips.orders'),
    ],
    [t],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [assistantOnline, setAssistantOnline] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listenStopRef = useRef<(() => void) | null>(null);
  const pendingRef = useRef(false);

  const voiceReady = isSpeechRecognitionSupported();
  const voiceTone = listening ? 'listen' : speakingId ? 'speak' : 'idle';

  const visibleMessages = useMemo<ChatMessage[]>(
    () => [{ id: 'welcome', role: 'assistant', content: greeting }, ...messages],
    [greeting, messages],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(AUTO_SPEAK_KEY);
      // Read after mount on purpose: localStorage is not available while server-rendering,
      // so a lazy useState initializer would desync hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored != null) setAutoSpeak(stored === '1');
    } catch {
      /* keep default */
    }
  }, []);

  useEffect(() => {
    if (!open) {
      listenStopRef.current?.();
      listenStopRef.current = null;
      stopSpeaking();
      // Closing the panel tears down the mic and the speech engine, so the flags that
      // mirror those external systems have to be reset here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setListening(false);
      setSpeakingId(null);
      return;
    }
    unlockSpeechPlayback();
    preloadSpeechVoices();
  }, [open]);

  useEffect(() => {
    stopSpeaking();
    // Same reason: `speakingId` tracks the browser speech engine, which just stopped.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeakingId(null);
    if (!open || !autoSpeak) return;
    setSpeakingId('welcome');
    speakText(greeting, locale, {
      onEnd: () => setSpeakingId((current) => (current === 'welcome' ? null : current)),
    });
    // Re-bind spoken language when the header locale changes, not on every greeting tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    void getAssistantStatus()
      .then((result) => setAssistantOnline(result.data.connected))
      .catch(() => setAssistantOnline(false));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [visibleMessages, pending, open, listening]);

  useEffect(() => {
    return () => {
      listenStopRef.current?.();
      stopSpeaking();
    };
  }, []);

  function toggleAutoSpeak() {
    setAutoSpeak((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(AUTO_SPEAK_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function readAloud(id: string, content: string, spokenLocale: Locale = locale) {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    unlockSpeechPlayback();
    stopSpeaking();
    setVoiceError('');
    setSpeakingId(id);
    speakText(content, spokenLocale, {
      onEnd: () => setSpeakingId((current) => (current === id ? null : current)),
    });
  }

  function toggleMic() {
    if (!voiceReady) {
      setVoiceError(t('kisan.voiceUnsupported'));
      return;
    }
    if (listening) {
      listenStopRef.current?.();
      listenStopRef.current = null;
      setListening(false);
      return;
    }

    unlockSpeechPlayback();
    stopSpeaking();
    setSpeakingId(null);
    setVoiceError('');

    const session = startListening({
      locale,
      onResult: (transcript) => {
        // Show live transcript in the composer so the farmer can review before Send.
        setDraft(transcript);
      },
      onError: () => {
        setListening(false);
        listenStopRef.current = null;
        setVoiceError(t('kisan.voiceUnsupported'));
      },
      onEnd: () => {
        setListening(false);
        listenStopRef.current = null;
        inputRef.current?.focus();
      },
    });
    if (!session) {
      setVoiceError(t('kisan.voiceUnsupported'));
      return;
    }
    listenStopRef.current = session.stop;
    setListening(true);
  }

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    unlockSpeechPlayback();
    listenStopRef.current?.();
    listenStopRef.current = null;
    setListening(false);

    const userTurn: ChatMessage = { id: newId(), role: 'user', content: message };
    const nextMessages = [...messages, userTurn];
    setMessages(nextMessages);
    setDraft('');

    try {
      const history = nextMessages
        .slice(0, -1)
        .slice(-4)
        .map((item) => ({
          role: item.role,
          content: clipForHistory(item.content),
        }));
      const { data } = await queryAssistant({ message, history, language: locale });
      const replyId = newId();
      setMessages((current) => [
        ...current,
        {
          id: replyId,
          role: 'assistant',
          content: data.reply,
          locale,
          citations: data.citations,
          escalated: data.escalated,
        },
      ]);
      if (autoSpeak) {
        setSpeakingId(replyId);
        speakText(data.reply, locale, {
          onEnd: () => setSpeakingId((current) => (current === replyId ? null : current)),
        });
      }
    } catch (error) {
      const raw = getErrorMessage(error, t('kisan.errorUnreachable'));
      const friendly =
        raw.includes('Validation failed') || raw.includes('Too big')
          ? t('kisan.errorTooLong')
          : // Gemini/transport failures come back in English, so speak the farmer's language instead.
            error instanceof ApiError && error.code === 'ASSISTANT_UNAVAILABLE'
            ? t('kisan.errorUnreachable')
            : raw;
      setMessages((current) => [
        ...current,
        { id: newId(), role: 'assistant', content: friendly, locale },
      ]);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(draft);
  }

  const statusLabel = listening
    ? t('kisan.listening')
    : speakingId
      ? t('kisan.speaking')
      : pending
        ? t('kisan.sending')
        : assistantOnline === true
          ? t('kisan.online')
          : assistantOnline === false
            ? t('kisan.offline')
            : '';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end p-3 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:p-0">
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pointer-events-auto kisan-panel flex h-[100dvh] w-full flex-col overflow-hidden border border-forest/15 bg-paper shadow-[0_20px_60px_rgba(31,61,43,0.25)] sm:mb-3 sm:h-[min(36rem,72vh)] sm:w-[min(26rem,calc(100vw-2rem))] sm:rounded-3xl"
        >
          <header className="flex items-center gap-3 bg-gradient-to-r from-forest via-forest to-leaf/90 px-4 py-3 text-paper shadow-sm">
            <FarmerMascot size={44} className="ring-2 ring-harvest/40 shadow-xs" />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-lg font-bold leading-tight">
                {t('kisan.title')}
              </h2>
              <div className="flex items-center gap-1.5">
                <span
                  className={cx(
                    'h-2 w-2 rounded-full',
                    listening
                      ? 'bg-harvest animate-ping'
                      : speakingId
                        ? 'bg-leaf animate-pulse'
                        : assistantOnline
                          ? 'bg-leaf'
                          : 'bg-clay/70',
                  )}
                  aria-hidden="true"
                />
                <p className="truncate text-xs text-paper/85" aria-live="polite">
                  {statusLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg font-semibold text-paper/85 transition hover:bg-paper/15 hover:text-paper"
              aria-label={t('kisan.closeLabel')}
            >
              ✕
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-3.5 overflow-y-auto bg-cream/25 px-3 py-3"
            aria-live="polite"
            id={liveId}
          >
            {visibleMessages.map((item) => (
              <div
                key={item.id}
                className={cx('flex gap-2', item.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {item.role === 'assistant' ? (
                  <FarmerMascot size={28} className="mt-1 shrink-0 ring-1 ring-harvest/30" />
                ) : null}
                <div
                  className={cx(
                    'max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-xs',
                    item.role === 'user'
                      ? 'rounded-tr-xs bg-leaf text-paper font-medium'
                      : 'rounded-tl-xs border border-forest/10 bg-paper text-ink',
                  )}
                >
                  <p className="whitespace-pre-wrap">{item.content}</p>
                  {item.role === 'assistant' && item.citations && item.citations.length > 0 ? (
                    <ul className="mt-2.5 space-y-1 rounded-xl border border-forest/10 bg-sand/20 p-2 text-xs text-soil">
                      {item.citations.map((cite) => (
                        <li key={cite.id} className="leading-snug">
                          <span className="font-semibold">{cite.title}</span> — {cite.source}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.role === 'assistant' ? (
                    <button
                      type="button"
                      onClick={() => readAloud(item.id, item.content, item.locale ?? locale)}
                      className="mt-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-forest/10 bg-forest/5 px-2.5 text-xs font-bold text-forest transition hover:bg-forest/10 active:scale-95"
                      aria-label={
                        speakingId === item.id ? t('kisan.stopSpeakLabel') : t('kisan.speakLabel')
                      }
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"
                        />
                      </svg>
                      {speakingId === item.id ? t('kisan.stopSpeakLabel') : t('kisan.speakLabel')}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-soil">
                <FarmerMascot size={28} className="ring-1 ring-harvest/30" />
                <span className="kisan-typing rounded-2xl rounded-tl-xs border border-forest/10 bg-paper px-3.5 py-2 text-sm text-ink/75 shadow-xs">
                  {t('kisan.sending')}
                </span>
              </div>
            ) : null}
          </div>

          <div className="border-t border-forest/10 bg-paper/95 px-3 py-2.5 backdrop-blur-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <VoiceWave active={listening || Boolean(speakingId)} tone={voiceTone} />
              <button
                type="button"
                onClick={toggleAutoSpeak}
                className={cx(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                  autoSpeak
                    ? 'border-leaf bg-leaf/15 text-forest font-bold'
                    : 'border-forest/20 bg-paper text-ink/70',
                )}
                aria-pressed={autoSpeak}
              >
                {t('kisan.autoSpeak')}
              </button>
            </div>

            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={pending}
                  onClick={() => void sendMessage(chip)}
                  className="shrink-0 rounded-full border border-harvest/40 bg-harvest/15 px-3 py-1.5 text-xs font-semibold text-soil transition hover:bg-harvest/25 active:scale-95 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>

            {voiceError ? <p className="mb-2 text-xs font-medium text-clay">{voiceError}</p> : null}
            <p className="mb-2 text-xs text-ink/60">{t('kisan.voiceHint')}</p>

            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <label htmlFor={inputId} className="sr-only">
                {t('kisan.title')}
              </label>
              <textarea
                id={inputId}
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(draft);
                  }
                }}
                maxLength={800}
                rows={2}
                placeholder={listening ? t('kisan.listening') : t('kisan.placeholder')}
                className="min-h-12 flex-1 resize-none rounded-2xl border border-forest/15 bg-paper px-3 py-2.5 text-sm text-ink outline-none transition ring-harvest/40 focus:border-leaf focus:ring-3"
              />
              <button
                type="button"
                onClick={toggleMic}
                disabled={pending}
                className={cx(
                  'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50',
                  listening
                    ? 'bg-clay text-paper ring-4 ring-clay/35 animate-pulse'
                    : 'bg-forest text-paper hover:bg-forest/90',
                )}
                aria-label={listening ? t('kisan.stopMicLabel') : t('kisan.micLabel')}
                aria-pressed={listening}
                title={listening ? t('kisan.stopMicLabel') : t('kisan.micLabel')}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {listening ? '■' : '🎙'}
                </span>
                <span className="mt-0.5 line-clamp-2 max-w-[3.4rem] text-[9px] leading-[1.1]">
                  {listening ? t('kisan.stopMicLabel') : t('kisan.tapToTalk')}
                </span>
              </button>
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl bg-leaf px-4 text-sm font-bold text-paper shadow-xs transition hover:bg-forest active:scale-95 disabled:cursor-not-allowed disabled:bg-soil/40"
              >
                {t('kisan.send')}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            unlockSpeechPlayback();
            setOpen(true);
          }}
          className="group pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-forest shadow-[0_14px_32px_rgba(31,61,43,0.35)] transition duration-200 hover:scale-105 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-harvest sm:h-16 sm:w-16"
          aria-expanded={false}
          aria-controls={panelId}
          aria-label={t('kisan.openLabel')}
        >
          <span
            className="absolute -inset-1 rounded-full bg-leaf/25 opacity-75 blur-xs transition group-hover:opacity-100"
            aria-hidden="true"
          />
          <FarmerMascot size={56} className="relative z-10" />
        </button>
      ) : null}
    </div>
  );
}

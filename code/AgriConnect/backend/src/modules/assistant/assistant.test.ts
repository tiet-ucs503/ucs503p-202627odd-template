import { describe, expect, it } from 'vitest';
import { queryAssistantBodySchema, speakAssistantBodySchema } from './assistant.schema.js';
import {
  MISSING_KEY_REPLY,
  buildSystemPrompt,
  buildThinkingConfig,
  languageLockPreamble,
  missingKeyReply,
  replyMatchesLanguage,
  resolveGeminiModel,
  toGeminiContents,
  wrapUserMessage,
} from './assistant.service.js';
import { pcmToWav, textForSpeech, buildTtsPrompt, clipForTts } from './assistant-tts.js';

describe('assistant query schema', () => {
  it('accepts a short question with optional history', () => {
    const parsed = queryAssistantBodySchema.parse({
      message: 'How do I list wheat?',
      history: [{ role: 'assistant', content: 'Namaste!' }],
    });
    expect(parsed.message).toBe('How do I list wheat?');
    expect(parsed.history).toHaveLength(1);
  });

  it('defaults missing history and rejects empty messages', () => {
    expect(queryAssistantBodySchema.parse({ message: '  hello  ' }).history).toEqual(
      [],
    );
    expect(queryAssistantBodySchema.safeParse({ message: '   ' }).success).toBe(
      false,
    );
  });

  it('caps conversation history at four turns', () => {
    const history = Array.from({ length: 5 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${String(index)}`,
    }));
    expect(
      queryAssistantBodySchema.safeParse({ message: 'next', history }).success,
    ).toBe(false);
  });

  it('clips oversized history turns instead of rejecting them', () => {
    const longReply = 'a'.repeat(5000);
    const parsed = queryAssistantBodySchema.parse({
      message: 'Thanks',
      history: [{ role: 'assistant', content: longReply }],
    });
    expect(parsed.history[0]?.content.length).toBe(4000);
    expect(parsed.history[0]?.content.endsWith('…')).toBe(true);
  });
});

describe('assistant prompt mapping', () => {
  it('keeps Kisan grounded for each signed-in role', () => {
    expect(buildSystemPrompt('FARMER')).toMatch(/farmer on AgriConnect/i);
    expect(buildSystemPrompt('BUYER')).toMatch(/buyer on AgriConnect/i);
    expect(buildSystemPrompt('ADMIN')).toContain('admin');
    expect(buildSystemPrompt('AGRONOMIST')).toMatch(/agronomist/i);
    expect(MISSING_KEY_REPLY).toMatch(/GEMINI_API_KEY/);
  });

  it('asks Kisan to reply in Hindi or Punjabi when language is set', () => {
    expect(buildSystemPrompt('FARMER', 'hi')).toMatch(/Hindi/i);
    expect(buildSystemPrompt('BUYER', 'pa')).toMatch(/Punjabi/i);
    expect(buildSystemPrompt('ADMIN', 'en')).toMatch(/English/i);
  });

  it('locks replies to the selected language and asks for a polite tone', () => {
    const punjabi = buildSystemPrompt('FARMER', 'pa');
    expect(punjabi).toMatch(/ONLY in Punjabi/i);
    expect(punjabi).toMatch(/Gurmukhi/i);
    expect(punjabi).toMatch(/ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ/);
    expect(punjabi).toMatch(/polite/i);
    expect(languageLockPreamble('pa')).toMatch(/Punjabi/i);
    expect(languageLockPreamble('hi')).toMatch(/Hindi/i);
    expect(missingKeyReply('pa')).toMatch(/ਕਿਰਪਾ/);
    expect(missingKeyReply('en')).toBe(MISSING_KEY_REPLY);
  });

  it('wraps the farmer question with a native-script lock', () => {
    expect(wrapUserMessage('How do I list wheat?', 'pa')).toMatch(/ਗੁਰਮੁਖੀ/);
    expect(wrapUserMessage('How do I list wheat?', 'pa')).toContain('How do I list wheat?');
  });

  it('detects when a reply is still English instead of the selected script', () => {
    expect(replyMatchesLanguage('Create a draft listing and add photos.', 'pa')).toBe(false);
    expect(replyMatchesLanguage('ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਕਿਰਪਾ ਕਰਕੇ ਲਿਸਟ ਬਣਾਓ।', 'pa')).toBe(true);
    expect(replyMatchesLanguage('Hello', 'en')).toBe(true);
  });

  it('maps retired Gemini model ids to the current default', () => {
    expect(resolveGeminiModel('gemini-2.0-flash')).toBe('gemini-3.6-flash');
    expect(resolveGeminiModel('models/gemini-2.0-flash')).toBe('gemini-3.6-flash');
    expect(resolveGeminiModel('gemini-3.6-flash')).toBe('gemini-3.6-flash');
  });

  it('sends thinkingLevel to Gemini 3 and thinkingBudget to the 2.5 series', () => {
    // Thinking tokens are billed against maxOutputTokens, so an unset level truncates replies.
    expect(buildThinkingConfig('gemini-3.6-flash')).toEqual({ thinkingLevel: 'minimal' });
    expect(buildThinkingConfig('gemini-3.6-flash', 'low')).toEqual({ thinkingLevel: 'low' });
    // `thinkingBudget` is a 400 on Gemini 3, and `thinkingLevel` is a 400 on 2.5.
    expect(buildThinkingConfig('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 });
    expect(buildThinkingConfig('gemini-2.5-pro', 'high')).toEqual({ thinkingBudget: -1 });
    expect(buildThinkingConfig('gemini-1.5-flash')).toEqual({ thinkingLevel: 'minimal' });
    expect(buildThinkingConfig('some-other-model')).toBeUndefined();
  });

  it('maps assistant history to Gemini model turns', () => {
    const contents = toGeminiContents('What is a quintal?', [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Namaste!' },
    ]);
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'Hi' }] },
      { role: 'model', parts: [{ text: 'Namaste!' }] },
      { role: 'user', parts: [{ text: 'What is a quintal?' }] },
    ]);
  });
});

describe('assistant speech helpers', () => {
  it('accepts speak payload with language', () => {
    const parsed = speakAssistantBodySchema.parse({
      text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ',
      language: 'pa',
    });
    expect(parsed.language).toBe('pa');
  });

  it('wraps PCM in a valid WAV header', () => {
    const pcm = Buffer.alloc(4, 0);
    const wav = pcmToWav(pcm, 24_000);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.length).toBe(48);
  });

  it('strips markdown before TTS and labels the transcript', () => {
    expect(textForSpeech('**Hello** farmer')).toBe('Hello farmer');
    expect(buildTtsPrompt('ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'pa')).toMatch(/Punjabi/);
    expect(buildTtsPrompt('ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'pa')).toContain('### TRANSCRIPT');
  });

  it('clips long TTS transcripts so read-aloud stays fast', () => {
    const long = `${'ਫਸਲ '.repeat(200)}. ਅੰਤ।`;
    const clipped = clipForTts(long);
    expect(clipped.length).toBeLessThanOrEqual(280);
    expect(clipped.length).toBeGreaterThan(100);
  });
});

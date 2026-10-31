import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envState = {
  GEMINI_API_KEY: 'test-key' as string | undefined,
  GEMINI_TTS_MODEL: undefined as string | undefined,
};

vi.mock('../../config/env.js', () => ({
  getEnv: () => ({
    GEMINI_API_KEY: envState.GEMINI_API_KEY,
    GEMINI_TTS_MODEL: envState.GEMINI_TTS_MODEL,
  }),
}));

const PCM_BASE64 = Buffer.from([0, 1, 2, 3]).toString('base64');

function audioResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/L16;codec=pcm;rate=24000',
                    data: PCM_BASE64,
                  },
                },
              ],
            },
          },
        ],
      }),
  } as unknown as Response;
}

function errorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message, code: status } }),
  } as unknown as Response;
}

describe('gemini tts transport', () => {
  beforeEach(() => {
    // Each test needs a fresh module so the audio cache and remembered model reset.
    vi.resetModules();
    envState.GEMINI_API_KEY = 'test-key';
    envState.GEMINI_TTS_MODEL = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches rendered audio so a repeat read-aloud costs no quota', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(audioResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('./assistant-tts.js');

    const first = await synthesizeSpeech({ text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ', language: 'pa' });
    const second = await synthesizeSpeech({ text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ', language: 'pa' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.equals(first)).toBe(true);
    expect(first.toString('ascii', 0, 4)).toBe('RIFF');
  });

  it('remembers the working model instead of re-probing a dead one', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(404, 'model not found'))
      .mockResolvedValue(audioResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('./assistant-tts.js');

    await synthesizeSpeech({ text: 'first question', language: 'pa' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await synthesizeSpeech({ text: 'second question', language: 'pa' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops at the attempt cap instead of hanging through every model', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(errorResponse(500, 'boom'));
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('./assistant-tts.js');

    await expect(synthesizeSpeech({ text: 'hello', language: 'pa' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses only the pinned TTS model instead of probing the full list', async () => {
    envState.GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(errorResponse(500, 'boom'));
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('./assistant-tts.js');

    await expect(synthesizeSpeech({ text: 'hello', language: 'pa' })).rejects.toThrow();
    // Preferred model, then one flash fallback — not the full pro list.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = fetchMock.mock.calls[0]?.[0];
    const second = fetchMock.mock.calls[1]?.[0];
    expect(first).toBeInstanceOf(URL);
    expect(second).toBeInstanceOf(URL);
    expect((first as URL).href).toContain('gemini-2.5-flash-preview-tts');
    expect((second as URL).href).toContain('gemini-3.1-flash-tts-preview');
  });

  it('surfaces rate limits immediately rather than burning other models', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(errorResponse(429, 'slow down'));
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('./assistant-tts.js');

    await expect(synthesizeSpeech({ text: 'hello', language: 'pa' })).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

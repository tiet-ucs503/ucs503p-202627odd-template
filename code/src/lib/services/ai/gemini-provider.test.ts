import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "@/lib/services/ai";
import { GeminiAIProvider, toGeminiRequest } from "@/lib/services/ai/gemini-provider";
import { buildThailandTrip } from "@/test-support/trip-fixture";
import type { AgentTrip } from "@/types/trip-agent";

// No call here reaches Google: `fetch` is replaced. These tests pin down the
// request we build and how each failure is classified, not what Gemini says.

let trip: AgentTrip;
beforeAll(async () => {
  trip = await buildThailandTrip();
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const answer = (text: string, finishReason = "STOP") =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), { status: 200 });

const request = () => ({ today: "2026-11-10", trip, messages: [{ role: "user" as const, content: "make it 5 days" }] });
const goodEdit = JSON.stringify({ reply: "I'll shorten it.", operations: [{ type: "set_trip_length", activityId: null, dayId: null, toDayId: null, cityId: null, query: null, category: null, dayCount: 5, cities: null }] });

describe("toGeminiRequest", () => {
  it("puts the brief in systemInstruction, with the schema, and maps roles to user/model", () => {
    const body = toGeminiRequest(
      [
        { role: "system", content: "Be brief." },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "again" },
      ],
      { type: "object" },
    );
    expect(body.systemInstruction.parts[0].text).toContain("Be brief.");
    expect(body.systemInstruction.parts[0].text).toContain('{"type":"object"}');
    expect(body.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(body.contents[1].parts[0].text).toBe("hello");
  });
});

describe("GeminiAIProvider", () => {
  it("sends the key in a header, never in the URL, and asks for JSON", async () => {
    fetchMock.mockResolvedValue(answer(goodEdit));
    await new GeminiAIProvider("secret-key", "gemini-test").proposeTripEdit(request());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect(url).not.toContain("secret-key");
    expect(init.headers["x-goog-api-key"]).toBe("secret-key");
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.temperature).toBe(0.2);
    expect(JSON.stringify(body)).not.toContain("secret-key");
  });

  it("includes the trip's ids and the traveller's request in what it sends", async () => {
    fetchMock.mockResolvedValue(answer(goodEdit));
    await new GeminiAIProvider("k").proposeTripEdit(request());
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const text = sent.contents.at(-1).parts[0].text as string;
    expect(text).toContain(trip.days[0].id);
    expect(text).toContain("make it 5 days");
  });

  it("returns the parsed answer", async () => {
    fetchMock.mockResolvedValue(answer(goodEdit));
    const edit = await new GeminiAIProvider("k").proposeTripEdit(request());
    expect(edit.reply).toBe("I'll shorten it.");
    expect(edit.operations[0]).toMatchObject({ type: "set_trip_length", dayCount: 5 });
  });

  it("joins an answer that arrives in several parts", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: goodEdit.slice(0, 20) }, { text: goodEdit.slice(20) }] } }] }), { status: 200 }),
    );
    expect((await new GeminiAIProvider("k").proposeTripEdit(request())).reply).toBe("I'll shorten it.");
  });

  it("honours a base URL and model override, tolerating a trailing slash", async () => {
    fetchMock.mockResolvedValue(answer(goodEdit));
    await new GeminiAIProvider("k", "m", "https://proxy.example/v1/").proposeTripEdit(request());
    expect(fetchMock.mock.calls[0][0]).toBe("https://proxy.example/v1/models/m:generateContent");
  });

  it("reports itself as a live provider", () => {
    const provider = new GeminiAIProvider("k");
    expect(provider).toMatchObject({ name: "gemini", model: "gemini-2.5-flash" });
  });

  describe("failures", () => {
    const failure = async (response: Response | Error) => {
      if (response instanceof Error) fetchMock.mockRejectedValue(response);
      else fetchMock.mockResolvedValue(response);
      return new GeminiAIProvider("k").proposeTripEdit(request()).then(
        () => null,
        (error: unknown) => (error instanceof AIProviderError ? error.code : error),
      );
    };

    it("treats Gemini's 400 'API key not valid' as bad credentials, not a bad request", async () => {
      expect(await failure(new Response('{"error":{"message":"API key not valid. Please pass a valid API key."}}', { status: 400 }))).toBe("auth");
    });

    it("treats 401 and 403 as bad credentials", async () => {
      expect(await failure(new Response("", { status: 401 }))).toBe("auth");
      expect(await failure(new Response("", { status: 403 }))).toBe("auth");
    });

    it("treats 429 as quota", async () => {
      expect(await failure(new Response("", { status: 429 }))).toBe("quota");
    });

    it("treats any other error status as a provider error", async () => {
      expect(await failure(new Response("boom", { status: 500 }))).toBe("provider-error");
      expect(await failure(new Response("bad", { status: 400 }))).toBe("provider-error");
    });

    it("treats a timeout and a network failure differently", async () => {
      expect(await failure(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe("timeout");
      expect(await failure(new TypeError("fetch failed"))).toBe("provider-error");
    });

    it("treats an answer cut off by the token limit as malformed, since it can never parse", async () => {
      expect(await failure(answer('{"reply":"I will', "MAX_TOKENS"))).toBe("malformed-json");
    });

    it("treats an empty answer (for example a safety block) as malformed", async () => {
      expect(await failure(new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY" }] }), { status: 200 }))).toBe("malformed-json");
      expect(await failure(new Response(JSON.stringify({}), { status: 200 }))).toBe("malformed-json");
    });

    it("treats text that is not JSON as malformed", async () => {
      expect(await failure(answer("Sure, I can do that!"))).toBe("malformed-json");
    });

    it("treats JSON of the wrong shape as a schema failure", async () => {
      expect(await failure(answer(JSON.stringify({ reply: "", operations: "none" })))).toBe("schema");
    });

    it("never puts the API key or response body in the error it throws", async () => {
      fetchMock.mockResolvedValue(new Response("echoed prompt and secret-key", { status: 500 }));
      const error = await new GeminiAIProvider("secret-key").proposeTripEdit(request()).catch((e: Error) => e);
      expect((error as Error).message).not.toContain("secret-key");
      expect((error as Error).message).not.toContain("echoed");
    });
  });
});

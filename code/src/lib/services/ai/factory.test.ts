import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAIProvider, getTripAgentProvider } from "@/lib/services/ai";

const KEYS = ["AI_PROVIDER", "TRIP_AGENT_PROVIDER", "GROQ_API_KEY", "GEMINI_API_KEY", "GEMINI_MODEL"] as const;

beforeEach(() => {
  for (const key of KEYS) vi.stubEnv(key, "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getAIProvider", () => {
  it("is null when nothing is configured", () => {
    expect(getAIProvider()).toBeNull();
  });

  it("has no stand-in: asking for one gives nothing, not a fake model", () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    expect(getAIProvider()).toBeNull();
  });

  it("builds Groq and Gemini when their keys are present", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "g");
    expect(getAIProvider()?.name).toBe("groq");

    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(getAIProvider()).toMatchObject({ name: "gemini" });
  });

  it("is case-insensitive about the provider name", () => {
    vi.stubEnv("AI_PROVIDER", "GEMINI");
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(getAIProvider()?.name).toBe("gemini");
  });

  it("uses GEMINI_MODEL when set", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "gemini-custom");
    expect(getAIProvider()?.model).toBe("gemini-custom");
  });

  it("is null, with a warning, when the named provider has no key", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(getAIProvider()).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("GEMINI_API_KEY is not set"));
  });

  it("is null for a name it does not know", () => {
    vi.stubEnv("AI_PROVIDER", "skynet");
    expect(getAIProvider()).toBeNull();
  });
});

describe("getTripAgentProvider", () => {
  it("inherits AI_PROVIDER by default", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "g");
    expect(getTripAgentProvider()?.name).toBe("groq");
    vi.stubEnv("TRIP_AGENT_PROVIDER", "inherit");
    expect(getTripAgentProvider()?.name).toBe("groq");
  });

  it("can use a different provider from the rest of the app", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("TRIP_AGENT_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(getAIProvider()?.name).toBe("groq");
    expect(getTripAgentProvider()?.name).toBe("gemini");
  });

  it("does not quietly fall back to another model when its own provider is unusable", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("TRIP_AGENT_PROVIDER", "gemini");
    expect(getTripAgentProvider()).toBeNull();
  });
});

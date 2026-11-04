import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The client side of authenticated API calls. `@/lib/firebase` is replaced so
 * no Firebase app is created, and `fetch` is replaced so nothing leaves the
 * test.
 */
const getIdToken = vi.fn();
let currentUser: { getIdToken: typeof getIdToken } | null = null;

vi.mock("@/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return currentUser;
    },
  },
}));

import { ApiError, postAuthenticated } from "@/lib/api-client";

/** Runs a call that is expected to fail and hands back the error it failed with. */
async function failureOf(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  getIdToken.mockReset().mockResolvedValue("test-token");
  currentUser = { getIdToken };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postAuthenticated", () => {
  it("posts JSON with the signed-in user's token and returns the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ reply: "hi" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postAuthenticated<{ reply: string }>("/api/thing", { a: 1 });

    expect(result).toEqual({ reply: "hi" });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/thing");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
  });

  it("refuses, as signed-out, when nobody is signed in", async () => {
    currentUser = null;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(postAuthenticated("/api/thing", {})).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries the server's reason code on a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Travis is busy.", code: "busy" }, 503)),
    );

    const error = await failureOf(postAuthenticated("/api/thing", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(error.code).toBe("busy");
    expect(error.message).toBe("Travis is busy.");
  });

  it("leaves the code undefined when the server sent none, so existing routes behave as before", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Invalid trip details." }, 400)));

    const error = await failureOf(postAuthenticated("/api/thing", {}));

    expect(error.code).toBeUndefined();
    expect(error.message).toBe("Invalid trip details.");
  });

  it("ignores a code that is not a string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "x", code: { nested: true } }, 500)));
    const error = await failureOf(postAuthenticated("/api/thing", {}));
    expect(error.code).toBeUndefined();
  });

  it("explains an expired session in plain words when the server sent no message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 401 })));
    const error = await failureOf(postAuthenticated("/api/thing", {}));
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/session expired/i);
  });

  it("falls back to a generic message for any other body-less failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    const error = await failureOf(postAuthenticated("/api/thing", {}));
    expect(error.message).toMatch(/something went wrong/i);
  });

  it("reports a network failure as status 0, not as a server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await failureOf(postAuthenticated("/api/thing", {}));
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/check your connection/i);
  });

  it("never puts the token in the URL or the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await postAuthenticated("/api/thing", { a: 1 });

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).not.toContain("test-token");
    expect(init.body).not.toContain("test-token");
  });
});

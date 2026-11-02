import { auth } from "@/lib/firebase";

/**
 * The browser side of API-route authentication.
 *
 * Every route that spends external quota now requires a Firebase ID token;
 * this attaches the current user's token so components don't each reinvent
 * that. Tokens come from the Firebase SDK, which refreshes them as needed —
 * they are never stored by this app, and never logged.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /**
     * A short machine-readable reason, when the route supplies one ("busy",
     * "unavailable", "rate-limited"…). The message is for people; this is for
     * code that needs to react differently to different failures.
     */
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError(401, "You need to be signed in to do that.");
  }
  return user.getIdToken();
}

/** POST JSON to an internal API route with the caller's Firebase ID token attached. */
export async function postAuthenticated<T>(path: string, body: unknown): Promise<T> {
  const token = await idToken();

  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Couldn't reach TripEase. Check your connection and try again.");
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Fall through to the status-based message below.
  }

  if (!response.ok) {
    const body = payload as { error?: string; code?: string } | null;
    const message =
      body?.error ??
      (response.status === 401
        ? "Your session expired. Sign in again to continue."
        : "Something went wrong. Please try again.");
    throw new ApiError(response.status, message, typeof body?.code === "string" ? body.code : undefined);
  }

  return payload as T;
}

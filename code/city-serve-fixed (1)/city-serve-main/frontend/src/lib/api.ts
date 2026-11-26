const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface RequestOptions extends RequestInit {
  auth?: boolean; // reserved for future distinct handling; cookies are sent by default
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) window.sessionStorage.setItem("cs_access_token", token);
    else window.sessionStorage.removeItem("cs_access_token");
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = window.sessionStorage.getItem("cs_access_token");
  }
  return accessToken;
}

export class ApiRequestError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiRequestError(res.status, body?.error ?? "Something went wrong. Please try again.", body?.details);
  }
  return body as T;
}

export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T = any>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T = any>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T = any>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

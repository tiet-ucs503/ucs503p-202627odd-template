// ──────────────────────────────────────────────
// CPRecal — API Service Layer
// Connected to real Node.js/Express backend via MongoDB
// ──────────────────────────────────────────────

// REAL BACKEND MODE - Mock data disabled
// All endpoints now call the real Express API backend
const API_BASE = "/api";

// ──── HTTP Client ────

async function request(endpoint, options = {}) {
  // Build URL with query params if provided
  let url = `${API_BASE}${endpoint}`;
  if (options.params) {
    const params = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      params.append(key, value);
    });
    url += `?${params}`;
    delete options.params; // Remove params from options
  }

  const res = await fetch(url, {
    credentials: "include", // Automatically send and receive HTTP-only cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.message || `API error: ${res.status} ${res.statusText}`;
    throw new Error(errorMsg);
  }

  return data;
}

// ──── Public API Methods ────

export const api = {
  // Auth endpoints
  auth: {
    register: (name, email, password) =>
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }),

    login: (email, password) =>
      request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),

    getMe: () => request("/auth/me"),

    logout: () =>
      request("/auth/logout", {
        method: "POST",
      }),
  },

  getDashboard: () => request("/dashboard"),

  getProblems: (filters = {}) => request("/problems", { params: filters }),

  getProblem: (id) => request(`/problems/${id}`),

  getPatterns: () => request("/patterns"),

  getPattern: (id) => request(`/patterns/${id}`),

  submitReview: (problemId, status, satisfiedByProblemId) =>
    request("/reviews", {
      method: "POST",
      body: JSON.stringify({ problemId, status, satisfiedByProblemId }),
    }),

  getRecommendations: () => request("/recommendations"),
};

export default api;

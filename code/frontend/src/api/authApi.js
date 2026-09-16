// Authentication API calls.
import { apiRequest } from "./client.js";

export async function googleAuth(data = {}) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMe() {
  return apiRequest("/auth/me");
}

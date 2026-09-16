// Dashboard statistics and metrics trend API calls.
import { apiRequest } from "./client.js";

export async function getDashboardSummary() {
  return apiRequest("/dashboard/summary");
}

export async function getDashboardTrends(metric = "form_score") {
  return apiRequest(`/dashboard/trends?metric=${encodeURIComponent(metric)}`);
}

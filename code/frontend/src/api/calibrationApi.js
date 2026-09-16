// Calibration baseline persistence API calls.
import { apiRequest } from "./client.js";

export async function saveBaseline(baseline) {
  const payload = {
    limb_ratios: baseline.limbRatios || baseline.limb_ratios || {},
    rom: baseline.rom || {},
    angle_stats: baseline.angleStats || baseline.angle_stats || {},
  };
  return apiRequest("/calibration", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBaseline() {
  return apiRequest("/calibration");
}

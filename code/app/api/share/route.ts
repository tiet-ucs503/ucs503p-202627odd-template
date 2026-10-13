import { NextRequest } from "next/server";
import { newShareId, writeShare, type SharePayload } from "@/lib/shareStore";
import type { FullAnalysis } from "@/lib/schema";

export const runtime = "nodejs";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MAX_BYTES = 25 * 1024 * 1024; // 25MB defensive guard

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const body = raw as { data?: FullAnalysis; sourceThumbnails?: Record<string, string>; label?: string };
  if (!body?.data || !Array.isArray(body.data.panels) || !body.data.report) {
    return jsonError(400, "data missing");
  }
  // Defensive size check
  const size = JSON.stringify(body).length;
  if (size > MAX_BYTES) return jsonError(413, "payload too large");

  const id = newShareId();
  const payload: SharePayload = {
    id,
    createdAt: Date.now(),
    data: body.data,
    sourceThumbnails: body.sourceThumbnails ?? {},
    label: body.label,
  };
  try {
    await writeShare(payload);
  } catch (e) {
    console.error("share.route.write_failed", e);
    return jsonError(500, "internal_error");
  }
  return new Response(JSON.stringify({ id, url: `/r/${id}` }), {
    headers: { "Content-Type": "application/json" },
  });
}

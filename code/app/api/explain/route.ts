import Groq from "groq-sdk";
import { withRateLimit } from "@/lib/rateLimit";
import { audit, hashJson } from "@/lib/auditLog";
import { MODELS, modelVersion } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

const apiKey = process.env.GROQ_API_KEY!;
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const groq = new Groq({ apiKey });

const SYSTEM = `You are SOLPOP-EDUCATOR, a senior PV (photovoltaic) engineer translating defect terminology for non-expert solar asset owners.

Given a defect type, write a tight, plain-English explainer with these sections:

**What it is** — one or two sentences. No jargon, or define it inline.
**Why it happens** — root causes, common conditions that produce it.
**Why it matters** — output impact, safety, longevity. Be honest about whether it's cosmetic or serious.
**Fix options** — concrete steps, ordered cheapest-to-priciest. Note if a licensed inspector is needed.

Rules:
- Markdown allowed. **Bold** the section headers exactly as above.
- Total under 180 words.
- Don't mention SOLPOP. Don't preface ("Sure", "Of course"). Just answer.
- Use bullets only inside "Fix options".`;

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
}

async function handler(req: Request): Promise<Response> {
  let body: { defectType?: string; severity?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const defectType = (body?.defectType ?? "").trim();
  if (!defectType) return jsonError(400, "defectType required");
  const severity = body?.severity;

  const userMsg = `Defect type: "${defectType}"${
    severity ? ` (severity: ${severity})` : ""
  }. Educate a non-expert solar panel owner.`;

  const mv = modelVersion("explain", "groq", MODELS.synthesis(), SYSTEM);
  const startPayloadHash = hashJson({ defectType, severity });

  void audit({
    orgId: null,
    userId: null,
    action: "explain.start",
    targetType: "defect_type",
    targetId: defectType,
    payloadHash: startPayloadHash,
    modelVersionId: mv.id,
    latencyMs: null,
    status: "ok",
    error: null,
    meta: { defectType, severity: severity ?? null },
  });

  const t0 = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      let errMsg: string | null = null;
      try {
        const completion = await groq.chat.completions.create({
          model,
          temperature: 0.4,
          max_tokens: 700,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userMsg },
          ],
        });
        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) send({ type: "delta", text: delta });
          const finish = chunk.choices?.[0]?.finish_reason;
          if (finish) send({ type: "done", reason: finish });
        }
      } catch (e) {
        errMsg = e instanceof Error ? e.message : String(e);
        send({ type: "error", error: errMsg });
      } finally {
        controller.close();
        void audit({
          orgId: null,
          userId: null,
          action: "explain.complete",
          targetType: "defect_type",
          targetId: defectType,
          payloadHash: startPayloadHash,
          modelVersionId: mv.id,
          latencyMs: Date.now() - t0,
          status: errMsg ? "error" : "ok",
          error: errMsg,
          meta: { defectType, severity: severity ?? null },
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export const POST = withRateLimit(handler, {
  bucket: "api.explain",
  opts: { rate: 0.5, burst: 12 },
  maxBytes: 256 * 1024,
});

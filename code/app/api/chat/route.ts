import Groq from "groq-sdk";
import { CHAT_SYSTEM, buildSessionContext } from "@/lib/chatPrompt";
import type { FullAnalysis } from "@/lib/schema";
import { withRateLimit } from "@/lib/rateLimit";
import { audit, hashJson } from "@/lib/auditLog";
import { MODELS, modelVersion, shortHash } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 120;

const apiKey = process.env.GROQ_API_KEY!;
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const groq = new Groq({ apiKey });

type ClientMessage = { role: "user" | "assistant"; content: string };

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ChatRequestBody = { messages?: ClientMessage[]; session?: FullAnalysis };

async function handler(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const body = (raw ?? {}) as ChatRequestBody;
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, "messages required");
  }
  const session = body.session;
  if (!session || !Array.isArray(session.panels) || !session.report) {
    return jsonError(400, "session payload missing");
  }

  const sessionContext = buildSessionContext(session);
  const messageCount = body.messages.length;
  const panelCount = session.panels.length;

  const messages = [
    { role: "system" as const, content: CHAT_SYSTEM(sessionContext) },
    ...body.messages.slice(-30).map((m: ClientMessage) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
    })),
  ];

  const mv = modelVersion("synthesis", "groq", MODELS.synthesis(), CHAT_SYSTEM(""));
  const sessionTargetId = shortHash(JSON.stringify(session));
  const startPayloadHash = hashJson({ messageCount, sessionPanelCount: panelCount });

  void audit({
    orgId: null,
    userId: null,
    action: "chat.start",
    targetType: "session",
    targetId: sessionTargetId,
    payloadHash: startPayloadHash,
    modelVersionId: mv.id,
    latencyMs: null,
    status: "ok",
    error: null,
    meta: { messageCount, panelCount },
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
          messages,
          temperature: 0.4,
          max_tokens: 1100,
          stream: true,
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
          action: "chat.complete",
          targetType: "session",
          targetId: sessionTargetId,
          payloadHash: startPayloadHash,
          modelVersionId: mv.id,
          latencyMs: Date.now() - t0,
          status: errMsg ? "error" : "ok",
          error: errMsg,
          meta: { messageCount, panelCount },
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
  bucket: "api.chat",
  opts: { rate: 1, burst: 20 },
  maxBytes: 4 * 1024 * 1024,
});

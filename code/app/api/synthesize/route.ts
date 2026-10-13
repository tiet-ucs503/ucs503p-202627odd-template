import { synthesizeReport, type Persona, type SynthLocale } from "@/lib/groq";
import type { PanelAnalysis } from "@/lib/schema";
import { withRateLimit } from "@/lib/rateLimit";
import { withAudit, hashJson } from "@/lib/auditLog";
import { MODELS, modelVersion } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_PERSONA = new Set<Persona>(["engineer", "junior", "claims", "investor"]);
const VALID_LOCALE = new Set<SynthLocale>(["en", "es", "pt", "hi", "fr", "de", "zh"]);

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handler(req: Request): Promise<Response> {
  let body: { panels?: PanelAnalysis[]; persona?: string; locale?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const panels = body?.panels;
  if (!Array.isArray(panels) || panels.length === 0) {
    return jsonError(400, "panels[] required");
  }
  const persona = (body?.persona ?? "engineer") as Persona;
  const locale = (body?.locale ?? "en") as SynthLocale;
  if (!VALID_PERSONA.has(persona)) return jsonError(400, `invalid persona: ${persona}`);
  if (!VALID_LOCALE.has(locale)) return jsonError(400, `invalid locale: ${locale}`);

  const mv = modelVersion(
    "synthesis",
    "groq",
    MODELS.synthesis(),
    `persona=${persona}|locale=${locale}`
  );

  try {
    const report = await withAudit(
      {
        orgId: null,
        userId: null,
        action: "synthesis.report",
        targetType: "session",
        targetId: null,
        payloadHash: hashJson({ panelCount: panels.length, persona, locale }),
        modelVersionId: mv.id,
        meta: { panelCount: panels.length, persona, locale },
      },
      () => synthesizeReport(panels, { persona, locale })
    );
    return new Response(JSON.stringify({ report }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("synthesize.route.error", e);
    return jsonError(500, "internal_error");
  }
}

export const POST = withRateLimit(handler, {
  bucket: "api.synthesize",
  opts: { rate: 0.2, burst: 6 },
  maxBytes: 8 * 1024 * 1024,
});

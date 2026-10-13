import { NextRequest } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { ReportDocument } from "@/lib/pdfDocument";
import type { FullAnalysis } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

type PdfRequest = {
  data?: FullAnalysis;
  sessionId?: string;
  sourceThumbnails?: Record<string, string>;
};

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const body = (raw ?? {}) as PdfRequest;
  if (!body.data || !Array.isArray(body.data.panels) || !body.data.report) {
    return jsonError(400, "Missing inspection data");
  }
  const sessionId = body.sessionId || `local-${Date.now().toString(36)}`;
  const sourceThumbnails = body.sourceThumbnails ?? {};

  let buffer: Buffer;
  try {
    const element = React.createElement(ReportDocument, {
      data: body.data,
      sessionId,
      sourceThumbnails,
    }) as unknown as React.ReactElement<DocumentProps>;
    buffer = await renderToBuffer(element);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(500, `PDF render failed: ${msg}`);
  }

  const filename = `solpop-${sessionId.replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

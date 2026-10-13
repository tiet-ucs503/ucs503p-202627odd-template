import { NextRequest } from "next/server";
import { readShare } from "@/lib/shareStore";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const payload = await readShare(id);
  if (!payload) {
    return new Response(JSON.stringify({ error: "not found or expired" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

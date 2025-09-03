import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { runSync } from "@/lib/indexer/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { from } = await req.json().catch(() => ({}));
  const start = BigInt(from ?? 0);
  if (!from) return NextResponse.json({ error: "missing 'from' (block)" }, { status: 400 });

  // reset lastBlock so sync will start from 'from'
  await kv.set("idx:lastBlock", (start - 1n).toString());

  const res = await runSync();
  return NextResponse.json({ ok: true, res }, { status: 200 });
}

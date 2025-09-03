import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const last = await kv.get<string>("idx:lastBlock");
  return NextResponse.json({ lastBlock: last ? Number(last) : 0 }, { status: 200 });
}

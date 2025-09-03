import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const ids = (await kv.smembers("idx:activeIds")) as string[] | null;
  if (Array.isArray(ids) && ids.length) {
    const pipe = kv.pipeline();
    for (const id of ids) pipe.del(`idx:listing:${id}`);
    pipe.del("idx:activeIds");
    await pipe.exec();
  }
  await kv.del("idx:lastBlock");
  return NextResponse.json({ ok: true }, { status: 200 });
}

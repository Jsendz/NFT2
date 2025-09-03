import { NextResponse } from "next/server";
import { runSync } from "@/lib/indexer/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = await runSync();
  return NextResponse.json(res, { status: 200 });
}

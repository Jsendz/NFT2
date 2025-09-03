import { NextResponse } from "next/server";
import { runSync } from "@/lib/indexer/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await runSync();
    // If lock wasn’t acquired, return 409 to indicate “already running”
    if (res.safeTip === 0n && res.scanned === 0 && res.from === 0n && res.to === 0n) {
      return NextResponse.json({ status: "busy" }, { status: 409 });
    }
    return NextResponse.json(res, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "sync failed" }, { status: 500 });
  }
}

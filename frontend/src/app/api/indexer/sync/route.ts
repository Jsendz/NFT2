import { NextResponse } from "next/server";
import { runSync } from "@/lib/indexer/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const spanStr = url.searchParams.get("span");

    const from = fromStr ? BigInt(fromStr) : undefined;
    const span = spanStr ? BigInt(spanStr) : undefined;

    const res = await runSync({ from, span });
    // If lock wasn’t acquired, return 409 to indicate “already running”
    if (res.safeTip === 0n && res.scanned === 0 && res.from === 0n && res.to === 0n) {
      return NextResponse.json({ status: "busy" }, { status: 409 });
    }
    return NextResponse.json(res, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

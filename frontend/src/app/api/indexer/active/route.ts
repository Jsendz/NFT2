import { NextResponse } from "next/server";
import { readAllActive } from "@/lib/indexer/storage";
import { parseEther } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/indexer/active?seller=0x..&nft=0x..&minEth=0.01&maxEth=1&limit=24&cursor=123
 *
 * - Sorted by listingId (desc)
 * - cursor = last listingId from previous page (string or number)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const seller = (url.searchParams.get("seller") || "").toLowerCase();
  const nft = (url.searchParams.get("nft") || "").toLowerCase();
  const minEth = url.searchParams.get("minEth");
  const maxEth = url.searchParams.get("maxEth");
  const limit = Math.max(1, Math.min( Number(url.searchParams.get("limit") || "24"), 60 ));
  const cursor = url.searchParams.get("cursor"); // listingId (string)

  const minWei = minEth ? parseEther(minEth) : 0n;
  const maxWei = maxEth ? parseEther(maxEth) : undefined;

  const rows = await readAllActive();

  // filter
  const filtered = rows.filter((r) => {
    if (seller && r.seller.toLowerCase() !== seller) return false;
    if (nft && r.nft.toLowerCase() !== nft) return false;

    const price = BigInt(r.price);
    if (price < minWei) return false;
    if (maxWei !== undefined && price > maxWei) return false;

    return true;
  });

  // sort by listingId desc
  filtered.sort((a, b) => {
    const ai = BigInt(a.id), bi = BigInt(b.id);
    return bi > ai ? 1 : bi < ai ? -1 : 0;
  });

  // apply cursor (desc list: keep items with id < cursor)
  const sliced = cursor
    ? filtered.filter((x) => BigInt(x.id) < BigInt(cursor))
    : filtered;

  const page = sliced.slice(0, limit);
  const nextCursor = page.length === limit ? page[page.length - 1].id : null;

  const res = NextResponse.json({ items: page, nextCursor }, { status: 200 });
  // small CDN cache
  res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
  return res;
}

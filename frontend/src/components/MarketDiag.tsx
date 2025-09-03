"use client";
import { useReadContract } from "wagmi";
import { marketplaceAbi } from "../lib/abis/Marketplace";

const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

export default function MarketDiag() {
  const next = useReadContract({
    address: MARKET,
    abi: marketplaceAbi,
    functionName: "nextListingId",
    args: [],
  });

  const listings = useReadContract({
    address: MARKET,
    abi: marketplaceAbi,
    functionName: "getActiveListings",
    args: [0n, 20n],
  });

  return (
    <div className="mt-4 p-3 text-xs rounded-lg border">
      <div>Market: {MARKET}</div>
      <div>nextListingId: {String(next.data ?? "…")}</div>
      <div>
        getActiveListings:{" "}
        {Array.isArray(listings.data)
          ? (() => {
              const a = listings.data as readonly [readonly any[], readonly bigint[], bigint];
              return `list=${a[0].length}, ids=${a[1].length}, next=${String(a[2])}`;
            })()
          : "…"}
      </div>
      {next.error && <div className="text-red-600">nextListingId error: {String(next.error).slice(0,180)}…</div>}
      {listings.error && <div className="text-red-600">getActiveListings error: {String(listings.error).slice(0,180)}…</div>}
    </div>
  );
}

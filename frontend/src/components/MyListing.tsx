"use client";
import { useAccount, useReadContract } from "wagmi";
import { marketplaceAbi } from "../lib/abis/Marketplace";
import { useEffect, useState } from "react";
import MarketGrid from "./MarketGrid"; // optional reuse; here we'll render minimal info

const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

export default function MyListings() {
  const { address } = useAccount();
  const [count, setCount] = useState(0);

  const { data } = useReadContract({
    address: MARKET,
    abi: marketplaceAbi,
    functionName: "getActiveListings",
    args: [0n, 200n],
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (!data || !address) return;
    const [list, ids] = data as readonly [readonly any[], readonly bigint[], bigint];
    const mine = (list as any[]).filter(l => l.seller?.toLowerCase() === address.toLowerCase());
    setCount(mine.length);
  }, [data, address]);

  return <div className="text-sm opacity-70">You have {count} active listings.</div>;
}

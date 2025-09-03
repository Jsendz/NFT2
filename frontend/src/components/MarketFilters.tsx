"use client";

import { useState } from "react";

export type FilterState = {
  seller: string;
  nft: string;
  minEth: string;
  maxEth: string;
};

export default function MarketFilters({ onApply }: { onApply: (f: FilterState) => void }) {
  const [f, setF] = useState<FilterState>({ seller: "", nft: "", minEth: "", maxEth: "" });

  return (
    <div className="p-3 border rounded-xl flex flex-wrap gap-2">
      <input className="px-3 py-2 rounded-lg border" placeholder="Seller 0x…" value={f.seller} onChange={e=>setF({...f, seller:e.target.value})} />
      <input className="px-3 py-2 rounded-lg border" placeholder="NFT 0x…" value={f.nft} onChange={e=>setF({...f, nft:e.target.value})} />
      <input className="w-28 px-3 py-2 rounded-lg border" placeholder="Min ETH" value={f.minEth} onChange={e=>setF({...f, minEth:e.target.value})} />
      <input className="w-28 px-3 py-2 rounded-lg border" placeholder="Max ETH" value={f.maxEth} onChange={e=>setF({...f, maxEth:e.target.value})} />
      <button className="px-4 py-2 rounded-lg bg-black text-white" onClick={()=>onApply(f)}>Apply</button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { isAddress, formatEther, parseEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import useSWRMutation from "swr/mutation";

import MarketFilters, { type FilterState } from "@/components/MarketFilters";
import { testNftAbi } from "@/lib/abis/testNft";
import { marketplaceAbi } from "@/lib/abis/Marketplace";
import { toHttp } from "@/lib/ipfs";

const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

type Row = {
  id: string;                 // listingId (string)
  nft: `0x${string}`;
  tokenId: string;            // string -> bigint in component
  seller: `0x${string}`;
  price: string;              // wei as string -> bigint in component
};

type PageResp = { items: Row[]; nextCursor?: string | null };

export default function IndexedMarketGrid() {
  const [filters, setFilters] = useState<FilterState>({
    seller: "",
    nft: "",
    minEth: "",
    maxEth: "",
  });

  const [items, setItems] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Build the API query string for /api/indexer/active
  const buildQuery = useCallback(
    (cursor?: string) => {
      const p = new URLSearchParams();
      if (filters.seller) p.set("seller", filters.seller);
      if (filters.nft) p.set("nft", filters.nft);
      if (filters.minEth) p.set("minEth", filters.minEth);
      if (filters.maxEth) p.set("maxEth", filters.maxEth);
      p.set("limit", "18");
      if (cursor) p.set("cursor", cursor);
      return `/api/indexer/active?${p.toString()}`;
    },
    [filters]
  );

  // Fetch one page (optionally replace the whole list).
  // IMPORTANT: use functional setState so this callback doesn't depend on `items`.
  const fetchPage = useCallback(
    async (cursor?: string, replace = false) => {
      setLoading(true);
      try {
        const r = await fetch(buildQuery(cursor), { cache: "no-store" });
        const j = (await r.json()) as PageResp;
        setNextCursor(j.nextCursor ?? null);
        setItems(prev => (replace ? j.items : [...prev, ...j.items]));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  // Kick an indexer sync after actions, then refresh first page
  const { trigger: kickSync } = useSWRMutation(
    "/api/indexer/sync",
    (url: string) => fetch(url).then(() => {})
  );

  const refreshFirstPage = useCallback(async () => {
    await kickSync().catch(() => {});
    // refetch first page after a small delay so index catches up
    setTimeout(() => {
      setItems([]);
      setNextCursor(null);
      fetchPage(undefined, true);
    }, 1200);
  }, [kickSync, fetchPage]);

  // Initial load (and whenever filters change)
  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    fetchPage(undefined, true);
  }, [filters.seller, filters.nft, filters.minEth, filters.maxEth, fetchPage]);

  return (
    <div>
      <MarketFilters onApply={setFilters} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-4">
        {items.map((r) => (
          <Card key={r.id} row={r} onDone={refreshFirstPage} />
        ))}
      </div>

      <div className="mt-4">
        {loading && <p className="text-sm opacity-70">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm opacity-70">No results.</p>
        )}
        {!loading && nextCursor && items.length > 0 && (
          <button
            onClick={() => fetchPage(nextCursor)}
            className="px-4 py-2 rounded-xl border hover:bg-black/5"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Card ---------- */

function Card({ row, onDone }: { row: Row; onDone: () => void }) {
  const { address } = useAccount();
  const { writeContract, data: hash, error: writeErr } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const listingId = useMemo(() => BigInt(row.id), [row.id]);
  const nft = row.nft;
  const tokenId = useMemo(() => BigInt(row.tokenId), [row.tokenId]);
  const seller = row.seller;
  const price = useMemo(() => BigInt(row.price), [row.price]);

  const iAmSeller = !!address && address.toLowerCase() === seller.toLowerCase();

  // Read tokenURI
  const { data: tokenUri } = useReadContract({
    address: nft,
    abi: testNftAbi,
    functionName: "tokenURI",
    args: [tokenId],
  });

  // Fetch metadata
  const [img, setImg] = useState<string>("");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    let stop = false;
    (async () => {
      if (!tokenUri) return;
      try {
        const metaUrl = toHttp(String(tokenUri));
        const res = await fetch(metaUrl, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!stop) {
          setImg(toHttp(json.image));
          setName(json.name || "");
        }
      } catch {
        // ignore parse errors; keep fallback
      }
    })();
    return () => {
      stop = true;
    };
  }, [tokenUri]);

  // Actions
  const onBuy = () =>
    writeContract({
      address: MARKET,
      abi: marketplaceAbi,
      functionName: "buy",
      args: [listingId],
      value: price,
    });

  const [newPriceStr, setNewPriceStr] = useState<string>(formatEther(price));
  const onCancel = () =>
    writeContract({
      address: MARKET,
      abi: marketplaceAbi,
      functionName: "cancel",
      args: [listingId],
    });
  const onUpdatePrice = () =>
    writeContract({
      address: MARKET,
      abi: marketplaceAbi,
      functionName: "updatePrice",
      args: [listingId, parseEther(newPriceStr || "0")],
    });

  useEffect(() => {
    if (isSuccess) onDone();
  }, [isSuccess, onDone]);

  return (
    <div className="p-4 rounded-2xl border bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition hover:-translate-y-0.5">
      <div className="aspect-square grid place-items-center bg-gray-100 rounded-xl overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={name || `Token #${String(tokenId)}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-xs text-gray-500 p-4 text-center">
            Token #{String(tokenId)}
          </div>
        )}
      </div>

      <div className="mt-2 text-sm text-gray-700">
        {name ? name : <>NFT: {short(nft)} #{String(tokenId)}</>}
      </div>
      <div className="text-sm text-gray-700">Seller: {short(seller)}</div>
      <div className="mt-1 font-semibold">{formatEther(price)} ETH</div>

      {!iAmSeller ? (
        <button
          onClick={onBuy}
          disabled={mining}
          className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow hover:opacity-90"
        >
          {mining ? "Confirming…" : "Buy"}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              className="w-32 px-3 py-2 rounded-xl border"
              value={newPriceStr}
              onChange={(e) => setNewPriceStr(e.target.value)}
              placeholder="New price (ETH)"
            />
            <button
              onClick={onUpdatePrice}
              disabled={mining}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow hover:opacity-90"
            >
              Update price
            </button>
          </div>
          <button
            onClick={onCancel}
            disabled={mining}
            className="px-4 py-2 rounded-xl border border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Cancel listing
          </button>
        </div>
      )}

      {hash && (
        <p className="text-xs mt-2">
          Tx:{" "}
          <a
            className="underline"
            target="_blank"
            href={`https://sepolia.etherscan.io/tx/${hash}`}
          >
            {hash.slice(0, 10)}…
          </a>
        </p>
      )}
      {writeErr && (
        <p className="text-xs text-red-600">
          {String(writeErr).slice(0, 180)}…
        </p>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function short(a?: string) {
  if (!a || !isAddress(a as `0x${string}`)) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

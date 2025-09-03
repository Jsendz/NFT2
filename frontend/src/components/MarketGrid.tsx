"use client";

import { useEffect, useState } from "react";
import { toHttp } from "@/lib/ipfs";
import toast from "react-hot-toast";

import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { marketplaceAbi } from "../lib/abis/Marketplace";
import { testNftAbi } from "../lib/abis/testNft";
import { formatEther, isAddress, parseEther } from "viem";

const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

// ---- Types matching Solidity ----
type Listing = {
  nft: `0x${string}`;
  tokenId: bigint;
  seller: `0x${string}`;
  price: bigint;
  active: boolean;
};
// (Listing[] list, uint256[] ids, uint256 nextCursor)
type GetActiveListingsReturn = readonly [readonly Listing[], readonly bigint[], bigint];

// helper: coerce unknown → bigint safely
const toBig = (v: unknown): bigint => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") return BigInt(v);
  return 0n;
};

export default function MarketGrid() {
  const [items, setItems] = useState<Listing[]>([]);
  const [ids, setIds] = useState<bigint[]>([]);
  const [cursor, setCursor] = useState<bigint>(0n);
  const [nextCursor, setNextCursor] = useState<bigint>(0n);

  const { data, refetch, isLoading, error } = useReadContract({
    address: MARKET,
    abi: marketplaceAbi,
    functionName: "getActiveListings",
    args: [cursor, 12n], // page size
    query: { enabled: true, refetchOnWindowFocus: false },
  });

  useEffect(() => {
    if (error) console.error("getActiveListings error:", error);
    if (!data) return;
    const [list, idList, next] = data as GetActiveListingsReturn;
    setItems((prev) => [...prev, ...list]);
    setIds((prev) => [...prev, ...Array.from(idList)]);
    setNextCursor(next);
  }, [data, error]);

  const loadMore = () => {
    setCursor(nextCursor);
    refetch();
  };

  // simple hard refresh after a tx
  const refreshAll = () => {
    setItems([]);
    setIds([]);
    setCursor(0n);
    setNextCursor(0n);
    refetch();
  };

  return (
    <div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((l, i) => (
          <Card
            key={`${String(l.nft)}-${String(l.tokenId)}-${String(ids[i])}`}
            listing={l}
            listingId={ids[i]}
            onDone={refreshAll}
          />
        ))}
      </div>

      <div className="mt-4">
        {isLoading && <p className="text-sm opacity-70">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-sm opacity-70">No active listings yet.</p>
        )}
        {!isLoading && nextCursor > cursor && items.length > 0 && (
          <button
            onClick={loadMore}
            className="px-4 py-2 rounded-xl border hover:bg-black/5"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

function Card({
  listing,
  listingId,
  onDone,
}: {
  listing: Listing;
  listingId: bigint;
  onDone: () => void;
}) {
  const { address } = useAccount();
  const {
    writeContract,
    writeContractAsync, // for toast.promise
    data: hash,
    error: writeErr,
  } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { nft, tokenId, seller, price } = listing;
  const iAmSeller =
    !!address && !!seller && address.toLowerCase() === seller.toLowerCase();

  // Reads
  const { data: tokenUri } = useReadContract({
    address: nft,
    abi: testNftAbi,
    functionName: "tokenURI",
    args: [tokenId],
  });

  const { data: protocolBps } = useReadContract({
    address: MARKET,
    abi: marketplaceAbi,
    functionName: "protocolFeeBps",
  });

  const { data: royaltyInfo } = useReadContract({
    address: nft,
    abi: testNftAbi,
    functionName: "royaltyInfo",
    args: [tokenId, price],
  });

  // fee math (all bigint)
  const royaltyAmt: bigint = (() => {
    const r = royaltyInfo as unknown as readonly [string, bigint] | undefined;
    return r && typeof r[1] === "bigint" ? r[1] : 0n;
  })();
  const protocolBpsBig = toBig(protocolBps);
  const protocolFee = (price * protocolBpsBig) / 10_000n;
  const sellerProceeds = price - protocolFee - royaltyAmt;

  // metadata fetch
  const [img, setImg] = useState<string>("");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!tokenUri) return;
      try {
        const metaUrl = toHttp(String(tokenUri));
        if (/YOUR_METADATA_CID/i.test(metaUrl)) return; // skip placeholder
        const res = await fetch(metaUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`metadata http ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setImg(toHttp(json.image));
          setName(json.name || "");
        }
      } catch {
        // ignore, fallback UI will show
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tokenUri]);

  // actions with toasts
  const onBuy = async () => {
    try {
      const p = writeContractAsync({
        address: MARKET,
        abi: marketplaceAbi,
        functionName: "buy",
        args: [listingId],
        value: price,
      });
      toast.promise(p, {
        loading: "Confirm buy in wallet…",
        success: "Buy tx submitted",
        error: "Buy failed",
      });
      await p; // wait for hash
    } catch (e) {
      // toast already shown
    }
  };

  const [newPriceStr, setNewPriceStr] = useState<string>(formatEther(price));

  const onCancel = async () => {
    try {
      const p = writeContractAsync({
        address: MARKET,
        abi: marketplaceAbi,
        functionName: "cancel",
        args: [listingId],
      });
      toast.promise(p, {
        loading: "Canceling listing…",
        success: "Cancel tx submitted",
        error: "Cancel failed",
      });
      await p;
    } catch (e) {}
  };

  const onUpdatePrice = async () => {
    try {
      const next = parseEther(newPriceStr || "0");
      const p = writeContractAsync({
        address: MARKET,
        abi: marketplaceAbi,
        functionName: "updatePrice",
        args: [listingId, next],
      });
      toast.promise(p, {
        loading: "Updating price…",
        success: "Update tx submitted",
        error: "Update failed",
      });
      await p;
    } catch (e) {}
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success("Transaction confirmed");
      onDone();
    }
  }, [isSuccess, onDone]);

  return (
    <div className="p-4 border rounded-2xl">
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
            {tokenUri && (
              <>
                <br />
                <span className="block max-w-[95%] truncate">
                  {String(tokenUri)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 text-sm text-gray-700">
        {name ? (
          name
        ) : (
          <>
            NFT: {short(nft)} #{String(tokenId)}
          </>
        )}
      </div>
      <div className="text-sm text-gray-700">Seller: {short(seller)}</div>
      <div className="mt-1 font-semibold">{formatEther(price)} ETH</div>

      {/* Fee breakdown (estimated) */}
      <div className="mt-1 text-xs text-gray-600">
        Fees: protocol {formatEther(protocolFee)} • royalty {formatEther(royaltyAmt)} • seller gets{" "}
        {formatEther(sellerProceeds)}
      </div>

      {!iAmSeller ? (
        <button
          onClick={onBuy}
          className="mt-3 px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
        >
          Buy
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
              className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
            >
              Update price
            </button>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-red-500 text-red-600 hover:bg-red-50"
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
      {mining && <p className="text-xs">Confirming…</p>}
      {writeErr && (
        <p className="text-xs text-red-600">Error: {cleanErr(writeErr)}</p>
      )}
    </div>
  );
}

function short(a?: string) {
  if (!a || !isAddress(a as `0x${string}`)) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function cleanErr(e: unknown) {
  const s = String(e || "");
  return s.length > 180 ? s.slice(0, 180) + "…" : s;
}

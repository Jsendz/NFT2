"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, parseEther, type Hex } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { marketplaceAbi } from "@/lib/abis/Marketplace";
import toast from "react-hot-toast";

const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

export default function ListPage() {
  const { address, isConnected } = useAccount();

  const [nft, setNft] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [priceEth, setPriceEth] = useState("");

  const tokenIdBn = useMemo(() => {
    try { return tokenId ? BigInt(tokenId) : 0n; } catch { return 0n; }
  }, [tokenId]);

  const priceWei = useMemo(() => {
    try { return parseEther(priceEth || "0"); } catch { return 0n; }
  }, [priceEth]);

  // Use the async variant so we can await a Promise<hash>
  const { writeContractAsync } = useWriteContract();

  // Track the pending tx hash so we can wait for confirmation
  const [pendingHash, setPendingHash] = useState<Hex | undefined>(undefined);
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash: pendingHash });

  useEffect(() => {
    if (isSuccess) {
      // kick the indexer so the new listing appears quickly
      fetch("/api/indexer/sync").catch(() => {});
      toast.success("Listed! Indexing…");
      // optional: clear the form
      setTokenId("");
      setPriceEth("");
    }
  }, [isSuccess]);

  const onList = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!isAddress(nft as `0x${string}`)) {
      toast.error("Invalid NFT address");
      return;
    }
    if (tokenIdBn <= 0n) {
      toast.error("Enter a valid token ID");
      return;
    }
    if (priceWei <= 0n) {
      toast.error("Enter a valid price");
      return;
    }

    try {
      const hash = await toast.promise(
        writeContractAsync({
          address: MARKET,
          abi: marketplaceAbi,
          functionName: "list",
          args: [nft as `0x${string}`, tokenIdBn, priceWei],
        }),
        {
          loading: "Sending transaction…",
          success: "Transaction sent. Waiting for confirmations…",
          error: "Failed to send transaction",
        }
      );
      setPendingHash(hash as Hex);
    } catch {
      // error toast already shown by toast.promise
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">List an NFT</h1>
      <p className="text-sm text-gray-600 mt-1">
        You must own the token and approve the marketplace for this token ID.
      </p>

      <div className="mt-6 space-y-3">
        <input
          className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="NFT contract (0x…)"
          value={nft}
          onChange={(e) => setNft(e.target.value)}
        />
        <input
          className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Token ID"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
        />
        <input
          className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Price (ETH)"
          value={priceEth}
          onChange={(e) => setPriceEth(e.target.value)}
        />

        <button
          onClick={onList}
          disabled={mining || !isConnected}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow hover:opacity-90 disabled:opacity-50"
        >
          {mining ? "Confirming…" : isConnected ? "List NFT" : "Connect wallet first"}
        </button>

        {pendingHash && (
          <p className="text-xs mt-2">
            Tx:{" "}
            <a
              className="underline"
              target="_blank"
              href={`https://sepolia.etherscan.io/tx/${pendingHash}`}
            >
              {pendingHash.slice(0, 10)}…
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

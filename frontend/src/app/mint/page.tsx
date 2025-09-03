"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, type Hex } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import toast from "react-hot-toast";
import { testNftAbi } from "@/lib/abis/testNft";
import { marketplaceAbi } from "@/lib/abis/Marketplace";

const NFT = process.env.NEXT_PUBLIC_TESTNFT_ADDRESS as `0x${string}`;
const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

export default function MintPage() {
  const { address, isConnected } = useAccount();

  const [tokenUri, setTokenUri] = useState("");
  const [pendingHash, setPendingHash] = useState<Hex | undefined>(undefined);

  const { writeContractAsync } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash: pendingHash });

  // After confirmation: ping indexer & show the last minted tokenId (nextId - 1)
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    address: NFT,
    abi: testNftAbi,
    functionName: "nextId",
  });

  useEffect(() => {
    if (isSuccess) {
      fetch("/api/indexer/sync").catch(() => {});
      toast.success("Minted! You can list it now.");
      refetchNextId();
    }
  }, [isSuccess, refetchNextId]);

  const lastMinted = useMemo(() => {
    try { return nextId ? (BigInt(nextId as bigint) - 1n) : null; } catch { return null; }
  }, [nextId]);

  const onMint = async () => {
    if (!isConnected) return toast.error("Connect your wallet first");
    if (!tokenUri.startsWith("ipfs://")) return toast.error("tokenURI must start with ipfs://");

    try {
      const hash = await toast.promise(
        writeContractAsync({
          address: NFT,
          abi: testNftAbi,
          functionName: "mint",
          args: [tokenUri],
        }),
        {
          loading: "Sending mint transaction…",
          success: "Transaction sent. Waiting for confirmations…",
          error: "Failed to send transaction",
        }
      );
      setPendingHash(hash);
    } catch {
      // error toast already shown
    }
  };

  const onApproveAll = async () => {
    try {
      const hash = await toast.promise(
        writeContractAsync({
          address: NFT,
          abi: testNftAbi,
          functionName: "setApprovalForAll",
          args: [MARKET, true],
        }),
        {
          loading: "Approving marketplace…",
          success: "Approved! You can list without per-token approvals.",
          error: "Approval failed",
        }
      );
      setPendingHash(hash);
    } catch {}
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">Mint an NFT</h1>
      <p className="text-sm text-gray-600 mt-1">
        Paste an <code>ipfs://</code> tokenURI to mint on your TestNFT.
      </p>

      <div className="mt-6 space-y-3">
        <input
          className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="ipfs://<METADATA_CID>"
          value={tokenUri}
          onChange={(e) => setTokenUri(e.target.value)}
        />

        <button
          onClick={onMint}
          disabled={mining || !isConnected}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow hover:opacity-90 disabled:opacity-50"
        >
          {mining ? "Confirming…" : isConnected ? "Mint" : "Connect wallet first"}
        </button>

        <button
          onClick={onApproveAll}
          disabled={mining || !isConnected}
          className="w-full px-4 py-3 rounded-xl border hover:bg-black/5 disabled:opacity-50"
        >
          Approve Marketplace (setApprovalForAll)
        </button>

        {pendingHash && (
          <p className="text-xs mt-2">
            Tx:{" "}
            <a className="underline" target="_blank" href={`https://sepolia.etherscan.io/tx/${pendingHash}`}>
              {pendingHash.slice(0, 10)}…
            </a>
          </p>
        )}

        {typeof lastMinted === "bigint" && lastMinted >= 1n && (
          <p className="text-sm mt-2">
            Last minted tokenId: <b>{String(lastMinted)}</b>
            {"  "}
            <a
              className="underline ml-2"
              href={`/list`}
            >
              List it →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

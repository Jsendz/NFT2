"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { erc20Abi } from "viem";
import { marketplaceAbi as v2abi } from "@/lib/abis/MarketplaceV2";

const MARKETV2 = process.env.NEXT_PUBLIC_MARKETV2_ADDRESS as `0x${string}`;
const ZERO: `0x${string}` = "0x0000000000000000000000000000000000000000";

type Order = {
  seller: `0x${string}`;
  nft: `0x${string}`;
  tokenId: bigint;
  currency: `0x${string}`;
  price: bigint;
  expiration: bigint;
  nonce: bigint;
};

export default function FillSignedOrder() {
  const { writeContractAsync } = useWriteContract();
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<`0x${string}` | undefined>();

  const onApproveAndBuy = async () => {
    try {
      setLoading(true);
      const payload = JSON.parse(json);

      const raw = payload.order as {
        seller: `0x${string}`;
        nft: `0x${string}`;
        tokenId: string | number | bigint;
        currency: `0x${string}`;
        price: string | number | bigint;
        expiration: string | number | bigint;
        nonce: string | number | bigint;
      };
      const signature = payload.signature as `0x${string}`;

      // Coerce numerics to bigint explicitly
      const order: Order = {
        seller: raw.seller,
        nft: raw.nft,
        tokenId: BigInt(raw.tokenId),
        currency: raw.currency,
        price: BigInt(raw.price),
        expiration: BigInt(raw.expiration || 0),
        nonce: BigInt(raw.nonce),
      };

      // If ERC-20, approve first
      if (order.currency !== ZERO) {
        await writeContractAsync({
          address: order.currency,
          abi: erc20Abi,
          functionName: "approve",
          args: [MARKETV2, order.price],
        });
      }

      const txHash = await writeContractAsync({
        address: MARKETV2,
        abi: v2abi,
        functionName: "buySigned",
        args: [order, signature],
        value: order.currency === ZERO ? order.price : 0n,
      });

      setHash(txHash);
    } catch (e) {
      console.error(e);
      alert("Failed to submit order. Check JSON and approvals.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-2xl space-y-2">
      <h2 className="font-semibold">Fill a signed order</h2>
      <textarea
        className="w-full h-48 p-3 rounded-xl border font-mono text-xs"
        placeholder="Paste the JSON signed payload from the seller"
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <button
        onClick={onApproveAndBuy}
        className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
        disabled={loading || !json}
      >
        {loading ? "Submitting…" : "Approve (if needed) & Buy"}
      </button>
      {hash && (
        <p className="text-xs">
          Tx:{" "}
          <a className="underline" href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank">
            {hash.slice(0, 10)}…
          </a>
        </p>
      )}
    </div>
  );
}

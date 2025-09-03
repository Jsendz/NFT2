"use client";

import { useAccount, useChainId, useSignTypedData } from "wagmi";
import { isAddress, parseEther } from "viem";
import { useState } from "react";

const MARKETV2 = process.env.NEXT_PUBLIC_MARKETV2_ADDRESS as `0x${string}`;
const WETH = (process.env.NEXT_PUBLIC_WETH_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
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

export default function SignListForm() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [nft, setNft] = useState("");               // string input
  const [tokenId, setTokenId] = useState("0");
  const [currency, setCurrency] = useState<"eth" | `0x${string}`>("eth");
  const [price, setPrice] = useState("0.01");
  const [expiration, setExpiration] = useState("");
  const [nonce, setNonce] = useState("1");
  const [signed, setSigned] = useState<any>(null);

  const onSign = async () => {
    if (!address) return alert("Connect wallet");
    if (!MARKETV2) return alert("Missing NEXT_PUBLIC_MARKETV2_ADDRESS");
    if (!isAddress(nft as `0x${string}`)) return alert("NFT address invalid");

    const order: Order = {
      seller: address as `0x${string}`,
      nft: nft as `0x${string}`,
      tokenId: BigInt(tokenId || "0"),
      currency: currency === "eth" ? ZERO : (currency as `0x${string}`),
      price: parseEther(price || "0"),
      expiration: expiration ? BigInt(expiration) : 0n,
      nonce: BigInt(nonce || "0"),
    };

    const domain = {
      name: "MarketplaceV2",
      version: "1",
      chainId,
      verifyingContract: MARKETV2,
    } as const;

    const types = {
      Order: [
        { name: "seller", type: "address" },
        { name: "nft", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "currency", type: "address" },
        { name: "price", type: "uint256" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    } as const;

    const signature = await signTypedDataAsync({
      domain,
      types,
      primaryType: "Order",
      message: order,
    });

    const payload = { domain, types, order, signature };
    setSigned(payload);
    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch {}
  };

  return (
    <div className="p-4 border rounded-2xl space-y-2">
      <h2 className="font-semibold">Create a signed listing</h2>

      <input className="w-full px-3 py-2 rounded-xl border"
        placeholder="NFT address (0x…)" value={nft} onChange={e => setNft(e.target.value)} />

      <div className="flex gap-2">
        <input className="w-32 px-3 py-2 rounded-xl border"
          placeholder="Token ID" value={tokenId} onChange={e => setTokenId(e.target.value)} />
        <select className="px-3 py-2 rounded-xl border"
          value={currency}
          onChange={(e) => setCurrency(e.target.value === "eth" ? "eth" : (e.target.value as `0x${string}`))}
        >
          <option value="eth">ETH (native)</option>
          <option value={WETH}>WETH (ERC-20)</option>
        </select>
        <input className="w-32 px-3 py-2 rounded-xl border"
          placeholder="Price (ETH units)"
          value={price} onChange={e => setPrice(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <input className="w-48 px-3 py-2 rounded-xl border"
          placeholder="Expiration (unix, optional)"
          value={expiration} onChange={e => setExpiration(e.target.value)} />
        <input className="w-32 px-3 py-2 rounded-xl border"
          placeholder="Nonce" value={nonce} onChange={e => setNonce(e.target.value)} />
      </div>

      <button onClick={onSign} className="px-4 py-2 rounded-xl bg-black text-white">Sign order</button>

      {signed && (
        <pre className="text-xs bg-black/5 p-3 rounded-xl overflow-x-auto">{JSON.stringify(signed, null, 2)}</pre>
      )}
      <p className="text-xs opacity-70">Tip: approve MarketplaceV2 in your NFT (<code>setApprovalForAll</code>) before the buyer fills.</p>
    </div>
  );
}

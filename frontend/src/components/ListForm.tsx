"use client";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { testNftAbi } from "../lib/abis/testNft";
import { marketplaceAbi } from "../lib/abis/Marketplace";
import { parseEther } from "viem";
import { useState } from "react";

const NFT = process.env.NEXT_PUBLIC_NFT_ADDRESS as `0x${string}`;
const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;

export default function ListForm() {
  const { address } = useAccount();
  const [tokenId, setTokenId] = useState("0");
  const [priceEth, setPriceEth] = useState("0.01");
  const [tokenUri, setTokenUri] = useState("ipfs://YOUR_METADATA_CID");

  // check if marketplace is approved to transfer your NFTs
  const { data: isApproved } = useReadContract({
    address: NFT,
    abi: testNftAbi,
    functionName: "isApprovedForAll",
    args: [address ?? "0x0000000000000000000000000000000000000000", MARKET],
    query: { enabled: !!address },
  });

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const onMint = () =>
    writeContract({
      address: NFT,
      abi: testNftAbi,
      functionName: "mint",
      args: [tokenUri],
    });

  const onApprove = () =>
    writeContract({
      address: NFT,
      abi: testNftAbi,
      functionName: "setApprovalForAll",
      args: [MARKET, true],
    });

  const onList = () =>
    writeContract({
      address: MARKET,
      abi: marketplaceAbi,
      functionName: "list",
      args: [NFT, BigInt(tokenId), parseEther(priceEth)],
    });

  return (
    <div className="grid gap-6 max-w-xl">
      <div className="p-4 border rounded-2xl">
        <h2 className="font-semibold mb-2">1) Mint a test NFT</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-xl border"
            value={tokenUri}
            onChange={(e) => setTokenUri(e.target.value)}
          />
          <button onClick={onMint} className="px-4 py-2 rounded-xl bg-black text-white">
            Mint
          </button>
        </div>
      </div>

      <div className="p-4 border rounded-2xl">
        <h2 className="font-semibold mb-2">2) Approve marketplace</h2>
        <p className="text-sm opacity-70 mb-2">Approved: {String(isApproved)}</p>
        <button onClick={onApprove} className="px-4 py-2 rounded-xl bg-black text-white">
          SetApprovalForAll
        </button>
      </div>

      <div className="p-4 border rounded-2xl">
        <h2 className="font-semibold mb-2">3) List NFT</h2>
        <div className="flex gap-2">
          <input
            className="w-28 px-3 py-2 rounded-xl border"
            placeholder="Token ID"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
          <input
            className="w-40 px-3 py-2 rounded-xl border"
            placeholder="Price (ETH)"
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
          />
          <button onClick={onList} className="px-4 py-2 rounded-xl bg-black text-white">
            List
          </button>
        </div>
        {hash && (
          <p className="text-xs mt-2">
            Tx:{" "}
            <a className="underline" target="_blank" href={`https://sepolia.etherscan.io/tx/${hash}`}>
              {hash.slice(0, 10)}…
            </a>
          </p>
        )}
        {mining && <p className="text-xs">Confirming…</p>}
        {isSuccess && <p className="text-xs">Done!</p>}
      </div>
    </div>
  );
}

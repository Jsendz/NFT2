// lib/contracts.ts
import { createPublicClient, createWalletClient, custom, getContract, http } from "viem";
import { sepolia } from "viem/chains";
import { marketplaceAbi } from "./abis/Marketplace"; // export ABI from Hardhat artifacts or copy
import { testNftAbi } from "./abis/testNft";

export const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;
export const NFT_ADDRESS = process.env.NEXT_PUBLIC_NFT_ADDRESS as `0x${string}`;

export const publicClient = createPublicClient({ chain: sepolia, transport: http() });
export const walletClient = typeof window !== "undefined" && (window as any).ethereum
  ? createWalletClient({ chain: sepolia, transport: custom((window as any).ethereum) })
  : undefined;

export const marketplace = getContract({
  address: MARKETPLACE_ADDRESS,
  abi: marketplaceAbi,
  client: { public: publicClient, wallet: walletClient! },
});

export const nft = getContract({
  address: NFT_ADDRESS,
  abi: testNftAbi,
  client: { public: publicClient, wallet: walletClient! },
});

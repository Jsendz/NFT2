import { NextResponse } from "next/server";
import { createPublicClient, http, decodeEventLog, Hex, Address, Abi } from "viem";
import { sepolia } from "viem/chains";
import { marketplaceAbi } from "@/lib/abis/Marketplace";

const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as Address;

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

type Active = { nft: Address; tokenId: bigint; seller: Address; price: bigint };

/** viem expects topics as [] or [signature, ...args]; coerce safely */
function toTopics(
  topics?: readonly Hex[]
): [] | [`0x${string}`, ...`0x${string}`[]] {
  if (!topics || topics.length === 0) return [];
  const head = topics[0] as `0x${string}`;
  const tail = (topics.slice(1) as unknown) as `0x${string}`[];
  return [head, ...tail] as [`0x${string}`, ...`0x${string}`[]];
}

/** tolerate tuple-or-object args */
function pick<T extends string>(obj: any, key: T, idx: number) {
  return Array.isArray(obj) ? obj[idx] : obj?.[key];
}

export async function GET() {
  try {
    const latest = await client.getBlockNumber();
    const from = latest > 150_000n ? latest - 150_000n : 0n;

    const logs = await client.getLogs({
      address: MARKET,
      fromBlock: from,
      toBlock: "latest",
    });

    const active = new Map<string, Active>();

    for (const log of logs) {
      try {
        const parsed = decodeEventLog({
          abi: (marketplaceAbi as unknown) as Abi,
          data: log.data as Hex,
          topics: toTopics(log.topics),
          strict: false, // be lenient when decoding mixed logs
        }) as { eventName: string; args: any };

        if (parsed.eventName === "Listed") {
          const listingId = pick(parsed.args, "listingId", 0);
          const nft = pick(parsed.args, "nft", 1);
          const tokenId = pick(parsed.args, "tokenId", 2);
          const seller = pick(parsed.args, "seller", 3);
          const price = pick(parsed.args, "price", 4);
          active.set(String(listingId), { nft, tokenId, seller, price });
        } else if (parsed.eventName === "Canceled") {
          const listingId = pick(parsed.args, "listingId", 0);
          active.delete(String(listingId));
        } else if (parsed.eventName === "Purchased") {
          const listingId = pick(parsed.args, "listingId", 0);
          active.delete(String(listingId));
        }
      } catch {
        // ignore non-Marketplace logs
      }
    }

    return NextResponse.json(
      Array.from(active.entries()).map(([id, v]) => ({ id, ...v })),
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

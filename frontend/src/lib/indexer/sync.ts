import {
  createPublicClient,
  http,
  decodeEventLog,
  type Hex,
  type Abi,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { marketplaceAbi } from "@/lib/abis/Marketplace";
import {
  acquireLock,
  releaseLock,
  getLastBlock,
  setLastBlock,
  upsertActive,
  removeActive,
  type ActiveItemKV,
} from "./storage";

const MARKET = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as Address;
const DEPLOY_BLOCK = process.env.INDEXER_DEPLOY_BLOCK ? BigInt(process.env.INDEXER_DEPLOY_BLOCK) : 0n;
const CONFIRMATIONS = process.env.INDEXER_CONFIRMATIONS ? BigInt(process.env.INDEXER_CONFIRMATIONS) : 12n;
const REORG_BACKTRACK = process.env.INDEXER_REORG_BACKTRACK ? BigInt(process.env.INDEXER_REORG_BACKTRACK) : 200n;
// Max blocks per request; small default works across strict RPCs
const MAX_BLOCK_SPAN = process.env.INDEXER_MAX_BLOCK_SPAN ? BigInt(process.env.INDEXER_MAX_BLOCK_SPAN) : 100n;

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL || undefined),
});

function toTopics(topics?: readonly Hex[]): [] | [`0x${string}`, ...`0x${string}`[]] {
  if (!topics || topics.length === 0) return [];
  const head = topics[0] as `0x${string}`;
  const tail = topics.slice(1) as unknown as `0x${string}`[];
  return [head, ...tail];
}
function pick<T extends string>(obj: any, key: T, idx: number) {
  return Array.isArray(obj) ? obj[idx] : obj?.[key];
}

export async function runSync(): Promise<{ scanned: number; from: bigint; to: bigint; safeTip: bigint }> {
  const gotLock = await acquireLock(60);
  if (!gotLock) return { scanned: 0, from: 0n, to: 0n, safeTip: 0n };

  try {
    const tip = await client.getBlockNumber();
    const safeTip = tip > CONFIRMATIONS ? tip - CONFIRMATIONS : 0n;
    if (safeTip === 0n) return { scanned: 0, from: 0n, to: 0n, safeTip };

    const last = await getLastBlock();
    let from = last > 0n ? last - REORG_BACKTRACK : (DEPLOY_BLOCK || safeTip);
    if (from < DEPLOY_BLOCK) from = DEPLOY_BLOCK;
    if (from > safeTip) return { scanned: 0, from, to: safeTip, safeTip };

    let scanned = 0;
    let span = MAX_BLOCK_SPAN;

    while (from <= safeTip) {
      let to = from + span - 1n;
      if (to > safeTip) to = safeTip;

      let logs: any[] = [];
      try {
        logs = await client.getLogs({ address: MARKET, fromBlock: from, toBlock: to });
      } catch (err: any) {
        const msg = String(err?.message || err || "");
        const code = (err && typeof err === "object" && "code" in err) ? (err as any).code : undefined;
        // dRPC & some RPCs respond with "exceeds max results" or -32602 for too-large ranges
        if (msg.includes("exceeds max results") || msg.includes("Invalid parameters") || code === -32602) {
          // shrink the span and retry this window
          span = span > 1n ? span / 2n : 1n;
          if (span < 10n) span = 10n; // don't go too low
          continue;
        }
        throw err; // different error → bubble up
      }

      for (const log of logs) {
        try {
          const parsed = decodeEventLog({
            abi: marketplaceAbi as unknown as Abi,
            data: log.data as Hex,
            topics: toTopics(log.topics),
            strict: false,
          }) as { eventName: string; args: any };

          if (parsed.eventName === "Listed") {
            const listingId = pick(parsed.args, "listingId", 0) as bigint;
            const nft = pick(parsed.args, "nft", 1) as Address;
            const tokenId = pick(parsed.args, "tokenId", 2) as bigint;
            const seller = pick(parsed.args, "seller", 3) as Address;
            const price = pick(parsed.args, "price", 4) as bigint;

            const item: ActiveItemKV = {
              nft,
              tokenId: tokenId.toString(),
              seller,
              price: price.toString(),
            };
            await upsertActive(String(listingId), item);
          } else if (parsed.eventName === "Canceled" || parsed.eventName === "Purchased") {
            const listingId = pick(parsed.args, "listingId", 0) as bigint;
            await removeActive(String(listingId));
          }
        } catch {
          // ignore non-decodable logs
        }
      }

      await setLastBlock(to);
      scanned += Number(to - from + 1n);
      from = to + 1n;
      // after a successful window, reset span to max
      span = MAX_BLOCK_SPAN;
    }

    return { scanned, from: await getLastBlock(), to: safeTip, safeTip };
  } finally {
    await releaseLock();
  }
}

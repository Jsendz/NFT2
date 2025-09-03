import {
  createPublicClient,
  http,
  decodeEventLog,
  type Hex,
  type Abi,
  type Address,
  type Log,
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

/* ----------------------- Env helpers ----------------------- */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} env is required. Set it in Vercel → Project → Settings → Environment Variables.`
    );
  }
  return v;
}

const RPC_URL = requireEnv("RPC_URL");
const RPC_HOST = (() => {
  try {
    return new URL(RPC_URL).host;
  } catch {
    return RPC_URL;
  }
})();

const MARKET = requireEnv("NEXT_PUBLIC_MARKETPLACE_ADDRESS").toLowerCase() as Address;

const DEPLOY_BLOCK =
  process.env.INDEXER_DEPLOY_BLOCK ? BigInt(process.env.INDEXER_DEPLOY_BLOCK) : 0n;
const CONFIRMATIONS =
  process.env.INDEXER_CONFIRMATIONS ? BigInt(process.env.INDEXER_CONFIRMATIONS) : 12n;
const REORG_BACKTRACK =
  process.env.INDEXER_REORG_BACKTRACK ? BigInt(process.env.INDEXER_REORG_BACKTRACK) : 200n;
const MAX_BLOCK_SPAN =
  process.env.INDEXER_MAX_BLOCK_SPAN ? BigInt(process.env.INDEXER_MAX_BLOCK_SPAN) : 100n;

/* ----------------------- Viem client ----------------------- */

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

/* ----------------------- Small helpers ----------------------- */

function toTopics(
  topics?: readonly Hex[]
): [] | [`0x${string}`, ...`0x${string}`[]] {
  if (!topics || topics.length === 0) return [];
  const head = topics[0] as `0x${string}`;
  const tail = topics.slice(1) as unknown as `0x${string}`[];
  return [head, ...tail];
}

/** Tolerate tuple-or-object args from decodeEventLog */
function pick<T>(args: unknown, key: string, idx: number): T {
  if (Array.isArray(args)) return args[idx] as T;
  const rec = args as Record<string, unknown>;
  return rec[key] as T;
}

/* ----------------------- Main sync ----------------------- */

/**
 * Run an index sync up to (tip - confirmations), handling reorg backtrack and
 * RPC range limits via adaptive block spans.
 *
 * You may pass `opts.from` or `opts.span` (useful for testing small windows via the API route).
 */
export async function runSync(opts?: {
  from?: bigint;
  span?: bigint;
}): Promise<{ scanned: number; from: bigint; to: bigint; safeTip: bigint; rpc: string }> {
  const gotLock = await acquireLock(60);
  if (!gotLock) {
    return { scanned: 0, from: 0n, to: 0n, safeTip: 0n, rpc: RPC_HOST };
  }

  try {
    const tip = await client.getBlockNumber();
    const safeTip = tip > CONFIRMATIONS ? tip - CONFIRMATIONS : 0n;
    if (safeTip === 0n) {
      return { scanned: 0, from: 0n, to: 0n, safeTip, rpc: RPC_HOST };
    }

    // Start point
    const lastProcessed = await getLastBlock();
    let from =
      opts?.from ??
      (lastProcessed > 0n ? lastProcessed - REORG_BACKTRACK : (DEPLOY_BLOCK || safeTip));
    if (from < DEPLOY_BLOCK) from = DEPLOY_BLOCK;
    if (from > safeTip) {
      return { scanned: 0, from, to: safeTip, safeTip, rpc: RPC_HOST };
    }

    // Initial span (blocks per request)
    let span = opts?.span ?? MAX_BLOCK_SPAN;
    if (span < 10n) span = 10n;

    let scanned = 0;

    while (from <= safeTip) {
      let to = from + span - 1n;
      if (to > safeTip) to = safeTip;

      let logs: readonly Log[] = [];
      try {
        logs = await client.getLogs({
          address: MARKET,
          fromBlock: from,
          toBlock: to,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Many providers use message like "exceeds max results" or -32602 for large ranges
        const code =
          typeof err === "object" && err && "code" in err
            ? (err as { code?: unknown }).code
            : undefined;

        if (
          msg.includes("exceeds max results") ||
          msg.includes("Invalid parameters") ||
          code === -32602
        ) {
          // shrink span and retry this same window
          span = span > 10n ? span / 2n : 10n;
          continue;
        }
        // different error → bubble up
        throw err;
      }

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: marketplaceAbi as unknown as Abi,
            data: log.data as Hex,
            topics: toTopics(log.topics),
            strict: false,
          }) as { eventName: string; args: unknown };

          if (decoded.eventName === "Listed") {
            const listingId = pick<bigint>(decoded.args, "listingId", 0);
            const nft = pick<Address>(decoded.args, "nft", 1);
            const tokenId = pick<bigint>(decoded.args, "tokenId", 2);
            const seller = pick<Address>(decoded.args, "seller", 3);
            const price = pick<bigint>(decoded.args, "price", 4);

            const item: ActiveItemKV = {
              nft,
              tokenId: tokenId.toString(),
              seller,
              price: price.toString(),
            };
            await upsertActive(String(listingId), item);
          } else if (
            decoded.eventName === "Canceled" ||
            decoded.eventName === "Purchased"
          ) {
            const listingId = pick<bigint>(decoded.args, "listingId", 0);
            await removeActive(String(listingId));
          }
        } catch {
          // ignore non-decodable or unrelated logs
        }
      }

      await setLastBlock(to);
      scanned += Number(to - from + 1n);
      from = to + 1n;

      // after a successful window, restore preferred span
      span = opts?.span ?? MAX_BLOCK_SPAN;
      if (span < 10n) span = 10n;
    }

    return { scanned, from: await getLastBlock(), to: safeTip, safeTip, rpc: RPC_HOST };
  } finally {
    await releaseLock();
  }
}

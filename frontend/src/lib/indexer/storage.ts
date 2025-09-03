import { Redis } from "@upstash/redis";
import type { Address } from "viem";

/** One global client (REST, serverless-friendly) */
const redis = Redis.fromEnv();

/** We store bigints as strings for portability */
export type ActiveItemKV = {
  nft: Address;
  tokenId: string;   // bigint -> string
  seller: Address;
  price: string;     // bigint -> string (wei)
};

/** ---- Namespace (per chain + contract) ---- */
const NS = [
  process.env.NEXT_PUBLIC_CHAIN_ID || "11155111",
  (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "").toLowerCase(),
].join(":");

const KEY_LAST       = `${NS}:idx:lastBlock`;
const KEY_ACTIVE_IDS = `${NS}:idx:activeIds`;                 // SET of listingIds
const KEY_LISTING    = (id: string) => `${NS}:idx:listing:${id}`;
const KEY_LOCK       = `${NS}:idx:lock`;

/** Simple lock to prevent concurrent cron runs */
export async function acquireLock(ttlSec = 60): Promise<boolean> {
  // NX + EX in Upstash
  const ok = await redis.set(KEY_LOCK, "1", { nx: true, ex: ttlSec });
  return ok === "OK";
}
export async function releaseLock() {
  await redis.del(KEY_LOCK);
}

/** Last finalized block processed */
export async function getLastBlock(): Promise<bigint> {
  const v = (await redis.get<string>(KEY_LAST)) || null;
  return v ? BigInt(v) : 0n;
}
export async function setLastBlock(b: bigint): Promise<void> {
  await redis.set(KEY_LAST, b.toString());
}

/** Upsert/remove a listing */
export async function upsertActive(id: string, item: ActiveItemKV): Promise<void> {
  const p = redis.pipeline();
  p.set(KEY_LISTING(id), JSON.stringify(item));
  p.sadd(KEY_ACTIVE_IDS, id);
  await p.exec();
}

export async function removeActive(id: string): Promise<void> {
  const p = redis.pipeline();
  p.del(KEY_LISTING(id));
  p.srem(KEY_ACTIVE_IDS, id);
  await p.exec();
}

/** Read all active listings quickly */
export async function readAllActive(): Promise<Array<{ id: string } & ActiveItemKV>> {
  const idsAny = (await redis.smembers(KEY_ACTIVE_IDS)) as unknown;
  const ids: string[] = Array.isArray(idsAny) ? (idsAny as string[]) : [];
  if (ids.length === 0) return [];

  const keys = ids.map((id) => KEY_LISTING(id));
  // Avoid generics; cast result
  const vals = (await redis.mget(...keys)) as (string | null)[];

  const out: Array<{ id: string } & ActiveItemKV> = [];
  for (let i = 0; i < ids.length; i++) {
    const v = vals[i];
    if (typeof v === "string") {
      try { out.push({ id: ids[i], ...(JSON.parse(v) as ActiveItemKV) }); } catch {}
    }
  }
  return out;
}

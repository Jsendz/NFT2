"use client";
import useSWR from "swr";
const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function IndexStatus() {
  const { data } = useSWR<{ lastBlock: number }>("/api/indexer/status", fetcher, { refreshInterval: 10000 });
  return <p className="text-xs opacity-60">Index last block: {data?.lastBlock ?? 0}</p>;
}

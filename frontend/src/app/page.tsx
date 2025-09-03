// app/page.tsx
import IndexedMarketGrid from "@/components/IndexedMarketGrid";
export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Marketplace</h1>
      <IndexedMarketGrid />
    </div>
  );
}

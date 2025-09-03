import ListForm from "@/components/ListForm";

export const metadata = {
  title: "List | NFT Market",
  description: "Mint, approve and list your NFT for sale",
};

export default function ListPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">List your NFT</h1>
      <p className="text-sm text-gray-600">
        Mint a test NFT, approve the marketplace to transfer it, then set your price.
      </p>
      <ListForm />
    </div>
  );
}

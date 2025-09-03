import FillSignedOrder from "@/components/FillSignedOrder";

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buy a signed listing</h1>
      <FillSignedOrder />
    </div>
  );
}

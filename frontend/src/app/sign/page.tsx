import SignListForm from "@/components/SignListForm";

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sign an off-chain listing</h1>
      <SignListForm />
    </div>
  );
}

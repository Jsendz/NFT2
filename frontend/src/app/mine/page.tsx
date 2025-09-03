import MyListings from "@/components/MyListing";

export const metadata = { title: "My listings | NFT Market" };
export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My listings</h1>
      <MyListings />
    </div>
  );
}

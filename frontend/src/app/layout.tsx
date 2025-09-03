import Header from "@/components/Header";
import "./globals.css";
import Providers from "./Providers";
import ToastProvider from "./toast-provider";

export const metadata = {
  title: "NFT Market",
  description: "Minimal NFT marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <ToastProvider />
          <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-indigo-50 text-gray-900" >
          {children}
          </main>
          </Providers>
      </body>
    </html>
  );
}

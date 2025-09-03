"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const path = usePathname();
  const Nav = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      className={`px-3 py-2 rounded-xl ${path === href ? "bg-black/10" : "hover:bg-black/10"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <nav className="flex gap-2 text-sm">
          <a href="/" className="font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            NFT Market
          </span>
        </a>
          <Nav href="/list" label="List"  />
          <Nav href="/mine" label="My listings"  />
          <Nav href="/fill" label="Fill listing"  />
          <Nav href="/sign" label="Sign listing"  />

        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}

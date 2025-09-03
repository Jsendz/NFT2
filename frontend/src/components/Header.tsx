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
    <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto flex items-center justify-between p-3">
        <nav className="flex gap-2 text-sm">
          <Nav href="/" label="Marketplace" />
          <Nav href="/list" label="List" />
          <Nav href="/mine" label="My listings" />
          <Nav href="/fill" label="Fill listing" />
          <Nav href="/sign" label="Sign listing" />

        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}

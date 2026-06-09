"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const COLUMNS = [
  {
    title: "Emergency",
    links: [
      { href: "/emergency", label: "Emergency SOS" },
      { href: "/emergency-history", label: "Emergency Timeline" },
      { href: "/community", label: "Find Blood Donors" },
    ],
  },
  {
    title: "Health",
    links: [
      { href: "/profile", label: "My Health Card" },
      { href: "/family", label: "Family Guardian" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Knowledge",
    links: [
      { href: "/herbal", label: "Herbal Network" },
      { href: "/disease-watch", label: "Disease Watch" },
      { href: "/knowledge", label: "Knowledge Hub" },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();
  const { status } = useAuth();
  if (pathname === "/") return null;
  // Guests only see the landing/login — no app footer.
  if (status !== "authed") return null;

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              ✚
            </span>
            Health<span className="-ml-1 text-primary">OS</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">
            The Community Health &amp; Emergency Network. Connecting people,
            knowledge, and care when it matters most.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-display text-sm font-semibold text-text">
              {col.title}
            </h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted transition-colors hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} HealthOS. Built for community impact.</p>
          <p>Informational only — always consult a qualified healthcare provider.</p>
        </div>
      </div>
    </footer>
  );
}

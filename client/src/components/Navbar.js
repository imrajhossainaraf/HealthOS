"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  HeartPulse, Siren, User, Leaf, Activity, Dumbbell, Brain, BookOpen, History,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

// Top-level links always visible on desktop.
const PRIMARY = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/emergency", label: "Emergency" },
  { href: "/alerts", label: "Alerts" },
  { href: "/community", label: "Community" },
  { href: "/profile", label: "Health Card" },
  { href: "/family", label: "Family" },
  { href: "/hospitals", label: "Hospitals" },
  { href: "/ai-assistant", label: "Agent" },
];

// Everything else, tucked into the "More" dropdown.
const MORE = [
  { href: "/herbal", label: "Herbal", Icon: Leaf },
  { href: "/disease-watch", label: "Disease Watch", Icon: Activity },
  { href: "/fitness", label: "Fitness", Icon: Dumbbell },
  { href: "/mental-wellness", label: "Mental Wellness", Icon: Brain },
  { href: "/knowledge", label: "Knowledge", Icon: BookOpen },
  { href: "/emergency-history", label: "Timeline", Icon: History },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, status, logout } = useAuth();

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const moreActive = MORE.some((l) => isActive(l.href));

  // Close the dropdown on navigation.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // The home page is a self-contained app shell with its own sidebar + topbar.
  if (pathname === "/") return null;
  // Guests (and while auth resolves) get no app navigation — only the landing
  // page and login are reachable. The chrome appears once signed in.
  if (status !== "authed") return null;

  return (
    <header className="sticky top-0 z-50 glass border-b border-border">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold"
          onClick={() => setOpen(false)}
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <HeartPulse className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span>
            Health<span className="text-primary">OS</span>
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 lg:flex">
          {PRIMARY.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(l.href)
                    ? "bg-primary/15 text-primary"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}

          {/* More dropdown */}
          <li className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                moreActive || moreOpen
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              More <span className={`text-xs transition-transform ${moreOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {moreOpen && (
              <>
                {/* click-away backdrop */}
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMoreOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div
                  role="menu"
                  className="glass absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border p-1.5 shadow-xl"
                >
                  {MORE.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive(l.href)
                          ? "bg-primary/15 text-primary"
                          : "text-muted hover:bg-surface-2 hover:text-text"
                      }`}
                    >
                      <l.Icon className="h-4 w-4" strokeWidth={2} />
                      {l.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </li>
        </ul>

        {/* Desktop auth + CTA */}
        <div className="hidden items-center gap-2 lg:flex">
          {status === "authed" ? (
            <div className="flex items-center gap-2">
              <Link href="/account" className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-muted hover:text-text" title="Account">
                <User className="h-4 w-4" strokeWidth={2} /> {user?.name?.split(" ")[0] || "Account"}
              </Link>
              <button type="button" onClick={logout} className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text">
                Sign out
              </button>
            </div>
          ) : status === "guest" ? (
            <Link href="/login" className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-primary/50">
              Sign in
            </Link>
          ) : (
            <span className="px-3 py-2 text-sm text-muted">…</span>
          )}
          <Link
            href="/emergency?sos=1"
            className="flex items-center gap-2 rounded-xl bg-emergency px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emergency/25 transition-transform hover:scale-105"
          >
            <Siren className="h-4 w-4" strokeWidth={2.4} /> SOS
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg text-text hover:bg-surface-2 lg:hidden"
        >
          <span className="text-xl">{open ? "✕" : "☰"}</span>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {[...PRIMARY, ...MORE].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(l.href)
                      ? "bg-primary/15 text-primary"
                      : "text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  {l.Icon && <l.Icon className="h-4 w-4" strokeWidth={2} />}
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <Link
                href="/emergency?sos=1"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg bg-emergency px-3 py-2.5 text-center text-sm font-semibold text-white"
              >
                <Siren className="h-4 w-4" strokeWidth={2.4} /> Emergency SOS
              </Link>
            </li>
            <li>
              {status === "authed" ? (
                <button
                  type="button"
                  onClick={() => { logout(); setOpen(false); }}
                  className="block w-full rounded-lg border border-border px-3 py-2.5 text-center text-sm text-muted"
                >
                  Sign out ({user?.name?.split(" ")[0] || "account"})
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg border border-border px-3 py-2.5 text-center text-sm font-medium"
                >
                  Sign in
                </Link>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function SOSButton() {
  const pathname = usePathname();
  const { status } = useAuth();

  // Only signed-in users get the floating SOS; hidden on the emergency page
  // itself and on the home shell (which has its own SOS).
  if (status !== "authed") return null;
  if (pathname?.startsWith("/emergency") || pathname === "/") return null;

  return (
    <Link
      href="/emergency"
      aria-label="Emergency SOS"
      title="Emergency SOS"
      className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-emergency text-center font-display text-sm font-bold text-white animate-pulse-glow sm:bottom-7 sm:right-7"
    >
      SOS
    </Link>
  );
}

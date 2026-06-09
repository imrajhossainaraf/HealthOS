"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// Routes a signed-out visitor is allowed to see. Everything else requires auth.
//  /        → landing page (the localhost:3000 entry)
//  /login   → sign in / register
//  /u/...   → public emergency card (scanned from a QR by responders, no login)
function isPublicPath(pathname) {
  return pathname === "/" || pathname === "/login" || pathname.startsWith("/u/");
}

/**
 * Client-side route guard. Auth lives in localStorage (so middleware can't see
 * it); this gate redirects guests away from protected pages to the landing page
 * and avoids flashing protected content while auth is still resolving.
 */
export default function AuthGate({ children }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = isPublicPath(pathname);

  useEffect(() => {
    if (status === "guest" && !allowed) {
      router.replace("/");
    }
  }, [status, allowed, router]);

  // Public pages always render.
  if (allowed) return children;

  // Protected page: wait for auth, then either render or show a splash while the
  // redirect to the landing page completes.
  if (status === "authed") return children;

  return (
    <div className="grid min-h-[60vh] place-items-center bg-base text-muted">
      <span className="animate-pulse font-display text-lg">✚ HealthOS</span>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Landing from "@/components/Landing";

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  // Signed-in users go straight to their dashboard; guests see the landing page.
  useEffect(() => {
    if (status === "authed") router.replace("/dashboard");
  }, [status, router]);

  if (status === "guest") return <Landing />;

  // loading, or authed and redirecting → brief splash.
  return (
    <div className="grid min-h-screen place-items-center bg-base text-muted">
      <span className="animate-pulse font-display text-lg">✚ HealthOS</span>
    </div>
  );
}

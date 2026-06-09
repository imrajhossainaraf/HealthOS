"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => {
    // In production this is where you'd report to an error-tracking service.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="text-5xl">⚠️</span>
      <h1 className="mt-4 font-display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">
        An unexpected error occurred. Your saved data is safe on this device.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-white">
          Try again
        </button>
        <Link href="/" className="glass glass-hover rounded-xl px-5 py-2.5 font-semibold">
          Go home
        </Link>
      </div>
    </div>
  );
}

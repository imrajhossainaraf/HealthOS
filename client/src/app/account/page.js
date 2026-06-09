"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { KEYS, readStorage, writeStorage } from "@/lib/storage";

export default function AccountPage() {
  const { user, status, logout } = useAuth();
  const [msg, setMsg] = useState(null);

  const exportData = () => {
    const data = {};
    for (const key of Object.values(KEYS)) data[key] = readStorage(key, null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthos-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        Object.entries(data).forEach(([k, v]) => v != null && writeStorage(k, v));
        setMsg("✓ Data imported. It will sync if you’re signed in.");
      } catch {
        setMsg("⚠️ Could not read that file.");
      }
    };
    reader.readAsText(file);
  };

  const resetData = () => {
    if (!confirm("Clear all HealthOS data on this device? This cannot be undone.")) return;
    Object.values(KEYS).forEach((k) => writeStorage(k, Array.isArray(readStorage(k, [])) ? [] : null));
    setMsg("✓ Local data cleared.");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Account</h1>

      <section className="glass mt-6 rounded-2xl p-5">
        {status === "authed" ? (
          <>
            <p className="text-sm text-muted">Signed in as</p>
            <p className="font-display text-lg font-semibold">{user?.name || "—"}</p>
            <p className="text-sm text-muted">{user?.email}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-sm text-success">
              ☁️ Syncing to your account
            </div>
            <div className="mt-4">
              <button type="button" onClick={logout} className="rounded-lg border border-border px-4 py-2 text-sm">Sign out</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">You’re not signed in. Data stays on this device only.</p>
            <Link href="/login" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Sign in / Register</Link>
          </>
        )}
      </section>

      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="font-display font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">Back up, restore, or clear your local data.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={exportData} className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm">⬇ Export backup</button>
          <label className="cursor-pointer rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm">
            ⬆ Import backup
            <input type="file" accept="application/json" onChange={importData} className="hidden" />
          </label>
          <button type="button" onClick={resetData} className="rounded-lg border border-emergency/40 px-4 py-2 text-sm text-emergency">Clear local data</button>
        </div>
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
      </section>
    </div>
  );
}

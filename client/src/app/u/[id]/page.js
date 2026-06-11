"use client";

import { use, useEffect, useState } from "react";
import { userApi } from "@/lib/api";

/**
 * Public emergency info page — the destination of the health-card QR code.
 * Anyone (first responder, hospital) can open /u/<id> to see the person's
 * emergency essentials. No login required; only non-sensitive fields are shown.
 */
export default function PublicUserPage({ params }) {
  const { id } = use(params);
  const [state, setState] = useState({ status: "loading", user: null, error: null });

  useEffect(() => {
    let cancelled = false;
    userApi
      .byId(id)
      .then((r) => !cancelled && setState({ status: "ok", user: r.user, error: null }))
      .catch((e) =>
        !cancelled && setState({ status: "error", user: null, error: e?.message || "Not found" })
      );
    return () => { cancelled = true; };
  }, [id]);

  if (state.status === "loading") {
    return <Shell><p className="text-muted">Loading emergency info…</p></Shell>;
  }
  if (state.status === "error") {
    return (
      <Shell>
        <p className="font-display text-lg font-semibold text-emergency">Not available</p>
        <p className="mt-1 text-sm text-muted">{state.error}</p>
      </Shell>
    );
  }

  const u = state.user;
  const age = u.dob ? calcAge(u.dob) : null;

  return (
    <Shell>
      <div className="rounded-2xl border border-emergency/40 bg-surface p-5">
        <p className="font-display text-xs uppercase tracking-widest text-emergency">
          🚨 HealthOS · Emergency Info
        </p>
        <div className="mt-2 flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{u.name || "Unnamed"}</h1>
            <p className="text-muted">
              {[u.gender, age != null ? `${age} yrs` : null, u.area].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Blood</p>
            <p className="font-display text-3xl font-extrabold text-emergency">{u.bloodGroup || "—"}</p>
          </div>
        </div>

        {/* Identity details */}
        {(u.dob || u.nid || u.address) && (
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border pb-3 text-sm">
            {u.dob && <Cell label="Date of birth" value={fmtDate(u.dob)} />}
            {u.nid && <Cell label="National ID" value={u.nid} />}
            {u.address && <Cell label="Address" value={u.address} full />}
          </div>
        )}

        <Row label="Allergies" items={u.allergies} danger empty="None recorded" />
        <Row label="Conditions" items={u.conditions} empty="None recorded" />
        <Row label="Medications" items={u.medications} empty="None recorded" />

        {u.phone && (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted">Phone</span>
            <a href={`tel:${u.phone.replace(/\s/g, "")}`} className="ml-2 font-semibold text-primary">{u.phone}</a>
          </div>
        )}

        {u.guardian && (u.guardian.name || u.guardian.phone) && (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted">Parent / Guardian</p>
            <p className="mt-1 flex items-center justify-between">
              <span>{u.guardian.name || "Guardian"}</span>
              {u.guardian.phone && (
                <a href={`tel:${u.guardian.phone.replace(/\s/g, "")}`} className="font-semibold text-primary">{u.guardian.phone}</a>
              )}
            </p>
            {u.guardian.nid && <p className="mt-0.5 text-xs text-muted">NID: {u.guardian.nid}</p>}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wide text-muted">Emergency Contacts</p>
          {u.contacts.length === 0 ? (
            <p className="mt-1 text-sm text-muted">None added</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {u.contacts.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span>
                    {c.name}
                    {c.relation && <span className="text-muted"> ({c.relation})</span>}
                  </span>
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="font-semibold text-primary">{c.phone}</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-snug text-muted">
          Self-reported emergency information shared via HealthOS. In an emergency, call local
          services (999).
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-4 text-center font-display text-sm font-semibold text-primary">✚ HealthOS</div>
      {children}
    </div>
  );
}

function Row({ label, items = [], empty, danger }) {
  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      {items.length === 0 ? (
        <p className="mt-0.5 text-sm text-muted">{empty}</p>
      ) : (
        <p className={`mt-0.5 text-sm ${danger ? "font-medium text-emergency" : ""}`}>{items.join(", ")}</p>
      )}
    </div>
  );
}

function Cell({ label, value, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-medium wrap-break-word">{value}</p>
    </div>
  );
}

function fmtDate(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return dob;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function calcAge(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)));
}

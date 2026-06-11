"use client";

import { use, useEffect, useRef, useState } from "react";
import { alertApi } from "@/lib/api";

/**
 * Alert link — opening /alert/<number> immediately raises an emergency alert for
 * the person who owns that phone number: their guardian + emergency contacts are
 * emailed and (if signed in) get a realtime toast. Built for QR stickers / panic
 * links. No login required.
 */
export default function AlertLinkPage({ params }) {
  const { number } = use(params);
  const [state, setState] = useState({ status: "sending", data: null, error: null });
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return; // guard StrictMode double-invoke
    firedRef.current = true;
    alertApi
      .trigger(number)
      .then((data) => setState({ status: "sent", data, error: null }))
      .catch((e) => setState({ status: "error", data: null, error: e?.message || "Could not send alert" }));
  }, [number]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-4 text-center font-display text-sm font-semibold text-primary">✚ HealthOS</div>

      {state.status === "sending" && (
        <Card accent="border-emergency/40">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-emergency/30 border-t-emergency" />
          <h1 className="font-display text-xl font-bold">Raising emergency alert…</h1>
          <p className="mt-1 text-sm text-muted">Notifying the contacts for {number}.</p>
        </Card>
      )}

      {state.status === "sent" && (
        <Card accent="border-success/50">
          <p className="font-display text-xs uppercase tracking-widest text-success">🚨 Alert sent</p>
          <h1 className="mt-1 font-display text-xl font-bold">
            {state.data?.name ? `${state.data.name}'s contacts notified` : "Contacts notified"}
          </h1>
          {state.data?.notified > 0 ? (
            <p className="mt-2 text-sm text-muted">
              Emailed <b>{state.data.notified}</b> emergency contact{state.data.notified === 1 ? "" : "s"}
              {state.data.toasted > 0 ? ` · ${state.data.toasted} alerted live` : ""}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-warning">
              This person has no guardian or emergency contacts on file yet.
            </p>
          )}
          <p className="mt-4 rounded-xl bg-emergency/10 px-4 py-3 text-sm font-medium text-emergency">
            If this is life-threatening, call <a href="tel:999" className="underline">999</a> now.
          </p>
        </Card>
      )}

      {state.status === "error" && (
        <Card accent="border-emergency/50">
          <p className="font-display text-lg font-semibold text-emergency">Couldn’t send the alert</p>
          <p className="mt-1 text-sm text-muted">{state.error}</p>
          <p className="mt-4 rounded-xl bg-emergency/10 px-4 py-3 text-sm font-medium text-emergency">
            In an emergency, call <a href="tel:999" className="underline">999</a> directly.
          </p>
        </Card>
      )}
    </div>
  );
}

function Card({ children, accent }) {
  return (
    <div className={`rounded-2xl border bg-surface p-6 text-center ${accent}`}>{children}</div>
  );
}

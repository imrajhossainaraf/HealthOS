"use client";

import { useState } from "react";
import { SEVERITY } from "@/lib/herbs";

export default function HerbCard({ herb, community = false, pending = false }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">{herb.name}</h3>
          <p className="text-sm italic text-muted">{herb.scientific}</p>
          {community && herb.author && !pending && (
            <p className="text-xs text-muted">shared by {herb.author}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {pending ? (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              ⏳ Pending (this device)
            </span>
          ) : community ? (
            <span className="rounded-full bg-herbal/15 px-2 py-0.5 text-xs font-medium text-herbal">
              🌿 Community
            </span>
          ) : null}
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
            {herb.evidence}
          </span>
        </div>
      </div>

      {herb.localNames?.length > 0 && (
        <p className="mt-2 text-xs text-muted">Also: {herb.localNames.join(", ")}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {herb.uses?.map((u) => (
          <span key={u} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">{u}</span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-sm font-medium text-primary"
      >
        {open ? "Hide details" : "View details"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
          {herb.preparation?.length > 0 && (
            <Detail label="Preparation" value={herb.preparation.join(" · ")} />
          )}
          {herb.warnings && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Safety</p>
              <p className="mt-0.5 text-warning">⚠️ {herb.warnings}</p>
            </div>
          )}
          {herb.interactions?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Interactions</p>
              <ul className="mt-1 space-y-1">
                {herb.interactions.map((it, i) => {
                  const s = SEVERITY[it.severity] || SEVERITY.Low;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span>{s.dot}</span>
                      <span>
                        <b>{it.with}</b> — {it.effect}{" "}
                        <span className={s.color}>({s.label})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {herb.notes && <Detail label="Note" value={herb.notes} />}
          {herb.region && <Detail label="Region" value={herb.region} />}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

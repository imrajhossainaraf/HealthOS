"use client";

import { useMemo, useState } from "react";
import { KEYS, useLocalState } from "@/lib/storage";

const TYPE_META = {
  "SOS Activated": { icon: "🚨", color: "text-emergency" },
  "First Aid Accessed": { icon: "📋", color: "text-info" },
  "Emergency Contact Called": { icon: "📞", color: "text-primary" },
};
const OUTCOMES = ["Resolved", "Hospital Visit", "Ongoing", "False Alarm"];

export default function EmergencyHistoryPage() {
  const [history, setHistory, hydrated] = useLocalState(KEYS.emergencyHistory, []);
  const [typeFilter, setTypeFilter] = useState("All");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [range, setRange] = useState({ from: "", to: "" });
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(
    () =>
      history.filter((e) => {
        const ts = new Date(e.timestamp).getTime();
        const fromOk = !range.from || ts >= new Date(range.from).getTime();
        const toOk = !range.to || ts <= new Date(range.to).getTime() + 86400000;
        return (
          (typeFilter === "All" || e.type === typeFilter) &&
          (outcomeFilter === "All" || e.outcome === outcomeFilter) &&
          fromOk &&
          toOk
        );
      }),
    [history, typeFilter, outcomeFilter, range]
  );

  const stats = useMemo(() => {
    const sos = history.filter((e) => e.type === "SOS Activated");
    const last = sos[0];
    return {
      sosThisYear: sos.filter(
        (e) => new Date(e.timestamp).getFullYear() === new Date().getFullYear()
      ).length,
      lastAgo: last ? relTime(last.timestamp) : "never",
      total: history.length,
    };
  }, [history]);

  const updateOutcome = (id, outcome) =>
    setHistory((h) => h.map((e) => (e.id === id ? { ...e, outcome } : e)));

  const remove = (id) => {
    setHistory((h) => h.filter((e) => e.id !== id));
    setSelected(null);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthos-emergency-timeline-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hydrated)
    return <div className="mx-auto max-w-4xl px-4 py-16 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Emergency Timeline</h1>
      <p className="mt-1 text-muted">Every SOS activation, logged for your safety analytics.</p>

      {/* Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat value={stats.sosThisYear} label="SOS activations this year" />
        <Stat value={stats.lastAgo} label="Last activation" />
        <Stat value={stats.total} label="Total events" />
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onChange={setTypeFilter} options={["All", ...Object.keys(TYPE_META)]} />
        <Select value={outcomeFilter} onChange={setOutcomeFilter} options={["All", ...OUTCOMES]} />
        <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} title="From date" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} title="To date" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        {(range.from || range.to) && (
          <button type="button" onClick={() => setRange({ from: "", to: "" })} className="rounded-lg border border-border px-2 py-2 text-sm text-muted">clear</button>
        )}
        <button
          type="button"
          onClick={exportJSON}
          disabled={history.length === 0}
          className="ml-auto rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium disabled:opacity-40"
        >
          ⬇ Export JSON
        </button>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="glass mt-6 rounded-2xl p-10 text-center text-muted">
          No events yet. Activating the{" "}
          <a href="/emergency" className="text-primary underline">Emergency SOS</a> logs entries here.
        </div>
      ) : (
        <ol className="mt-6 space-y-3 border-l border-border pl-5">
          {filtered.map((e) => {
            const meta = TYPE_META[e.type] || { icon: "•", color: "text-muted" };
            return (
              <li key={e.id} className="relative">
                <span className={`absolute left-[-1.65rem] top-1 text-lg ${meta.color}`}>
                  {meta.icon}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(e)}
                  className="glass glass-hover block w-full rounded-2xl p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.type}</span>
                    <span className="text-xs text-muted">{fmt(e.timestamp)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {e.reason} · {e.outcome}
                    {e.beaconLevels?.length ? ` · beacon L${Math.max(...e.beaconLevels)}` : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-6 text-xs text-muted">🔒 All data stored locally on your device.</p>

      {/* Detail modal */}
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <h3 className="font-display text-lg font-bold">{selected.type}</h3>
          <p className="text-sm text-muted">{fmt(selected.timestamp)}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Reason" v={selected.reason} />
            <Row k="Location" v={selected.location} />
            <Row k="Beacon levels" v={selected.beaconLevels?.join(", ") || "—"} />
          </dl>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Outcome</span>
            <select
              value={selected.outcome}
              onChange={(e) => {
                updateOutcome(selected.id, e.target.value);
                setSelected({ ...selected, outcome: e.target.value });
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
            >
              {OUTCOMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>

          <div className="mt-5 flex justify-between">
            <button type="button" onClick={() => remove(selected.id)} className="text-sm text-emergency hover:underline">
              Delete entry
            </button>
            <button type="button" onClick={() => setSelected(null)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <p className="font-display text-2xl font-extrabold text-primary">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v || "—"}</dd>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="glass relative w-full max-w-md rounded-2xl border border-border p-6">
        {children}
      </div>
    </div>
  );
}

function fmt(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString();
}

function relTime(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

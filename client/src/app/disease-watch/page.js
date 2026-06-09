"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KEYS, useLocalState } from "@/lib/storage";
import { outbreakApi } from "@/lib/api";
import { useLocation } from "@/lib/location";

const OUTBREAKS = [
  { name: "Dengue Fever", severity: "High", region: "Dhaka", trend: "Rising", tip: "Remove standing water; use mosquito nets." },
  { name: "Seasonal Influenza", severity: "Medium", region: "Nationwide", trend: "Stable", tip: "Get vaccinated; wash hands frequently." },
  { name: "Cholera", severity: "Moderate", region: "Coastal areas", trend: "Watch", tip: "Drink safe water; maintain sanitation." },
];

const SEASONAL = [
  { month: "Jun–Sep", disease: "Dengue & Monsoon illnesses" },
  { month: "Dec–Feb", disease: "Influenza & cold" },
  { month: "Mar–May", disease: "Heat illness & waterborne disease" },
];

const SEVERITY_COLOR = {
  High: "border-emergency/50 bg-emergency/10 text-emergency",
  Moderate: "border-warning/50 bg-warning/10 text-warning",
  Medium: "border-warning/40 bg-warning/5 text-warning",
};

const SYMPTOMS = ["Fever", "Cough", "Rash", "Vomiting", "Diarrhea", "Fatigue", "Other"];
const SEVERITIES = ["Mild", "Moderate", "Severe"];

export default function DiseaseWatchPage() {
  // Local fallback copy; the shared, cross-user feed lives on the server.
  const [localReports, setLocalReports, hydrated] = useLocalState(KEYS.outbreakReports, []);
  const { coords } = useLocation();
  const [serverReports, setServerReports] = useState(null);
  const [form, setForm] = useState({
    symptom: "Fever",
    severity: "Mild",
    location: "",
    onset: "",
  });

  const loadReports = useCallback(() => {
    outbreakApi
      .list()
      .then((r) => setServerReports(r.reports || []))
      .catch(() => setServerReports(null));
  }, []);
  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // The active dataset: shared network feed when online, else the local copy.
  const reports = serverReports !== null ? serverReports : localReports;

  const submit = async () => {
    if (!form.location.trim()) return;
    const payload = {
      symptom: form.symptom,
      severity: form.severity,
      location: form.location.trim(),
      onset: form.onset,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    };
    try {
      // Anonymous, shared with the whole network.
      await outbreakApi.create(payload);
      loadReports();
    } catch {
      // Offline — keep a local copy so the user still sees their report.
      setLocalReports((r) => [
        { id: Date.now().toString(36), ...payload, at: new Date().toISOString() },
        ...r,
      ]);
    }
    setForm({ symptom: "Fever", severity: "Mild", location: "", onset: "" });
  };

  // Capture the window's reference time once at mount (keeps render pure).
  const [mountTime] = useState(() => Date.now());

  // Trend detection: cluster reports from the last 7 days by symptom + location.
  const trends = useMemo(() => {
    const weekAgo = mountTime - 7 * 86400000;
    const recent = reports.filter((r) => new Date(r.at).getTime() >= weekAgo);
    const map = new Map();
    recent.forEach((r) => {
      const key = `${r.symptom}|${r.location.toLowerCase()}`;
      const cur = map.get(key) || { symptom: r.symptom, location: r.location, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [reports, mountTime]);

  if (!hydrated)
    return <div className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Disease Watch &amp; Outbreak Intelligence</h1>
      <p className="mt-1 text-muted">Regional alerts plus community-sourced symptom trends.</p>

      {/* Active outbreaks */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">Active Alerts</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {OUTBREAKS.map((o) => (
            <div key={o.name} className={`rounded-2xl border p-4 ${SEVERITY_COLOR[o.severity] || "border-border"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text">{o.name}</span>
                <span className="text-xs">{o.severity}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{o.region} · {o.trend}</p>
              <p className="mt-2 text-sm text-text">💡 {o.tip}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Report form */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-display text-xl font-semibold">Report a Symptom (anonymous)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Symptom</span>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2" value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })}>
                {SYMPTOMS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Severity</span>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Location (city/region)</span>
              <input className="w-full rounded-lg border border-border bg-surface px-3 py-2" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Dhaka" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Date of onset</span>
              <input type="date" className="w-full rounded-lg border border-border bg-surface px-3 py-2" value={form.onset} onChange={(e) => setForm({ ...form, onset: e.target.value })} />
            </label>
          </div>
          <button type="button" onClick={submit} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            Submit report
          </button>
          <p className="mt-3 text-xs text-muted">
            Community-sourced reports. Always consult a qualified doctor.
          </p>
        </section>

        {/* Trends + seasonal */}
        <section className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-display text-xl font-semibold">📊 Community Trends (7 days)</h2>
            <p className="mt-1 text-xs text-muted">
              {serverReports !== null
                ? `🌐 Shared network · ${reports.length} report${reports.length === 1 ? "" : "s"} in the last 30 days`
                : "📴 Offline — showing your local reports"}
            </p>
            {trends.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No recent reports yet. Submit one to start tracking.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {trends.map((t, i) => {
                  const alert = t.count >= 10 ? "Monitor closely" : t.count >= 5 ? "Low alert" : "Isolated";
                  const color = t.count >= 10 ? "text-emergency" : t.count >= 5 ? "text-warning" : "text-muted";
                  return (
                    <li key={i} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                      📊 {t.count} report{t.count > 1 ? "s" : ""} of <b>{t.symptom}</b> in {t.location}{" "}
                      — <span className={color}>{alert}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="font-display text-xl font-semibold">🗓️ Seasonal Calendar</h2>
            <ul className="mt-3 space-y-2">
              {SEASONAL.map((s) => (
                <li key={s.month} className="flex justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                  <span className="text-muted">{s.month}</span>
                  <span>{s.disease}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

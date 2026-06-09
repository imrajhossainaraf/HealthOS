"use client";

import { useMemo, useState } from "react";

const DISEASES = [
  { name: "Hypertension", symptoms: ["Headache", "Dizziness", "Blurred vision"], prevention: "Reduce salt, exercise, manage stress.", risk: "Family history, obesity, high salt diet." },
  { name: "Type 2 Diabetes", symptoms: ["Excessive thirst", "Frequent urination", "Fatigue"], prevention: "Healthy diet, regular activity, weight control.", risk: "Obesity, inactivity, genetics." },
  { name: "Asthma", symptoms: ["Wheezing", "Shortness of breath", "Cough"], prevention: "Avoid triggers, use prescribed inhalers.", risk: "Allergies, pollution, family history." },
  { name: "Dengue", symptoms: ["High fever", "Rash", "Joint pain"], prevention: "Avoid mosquito bites, remove standing water.", risk: "Living in endemic regions." },
  { name: "Anemia", symptoms: ["Fatigue", "Pale skin", "Dizziness"], prevention: "Iron-rich diet, treat underlying causes.", risk: "Poor diet, blood loss, pregnancy." },
  { name: "Migraine", symptoms: ["Throbbing headache", "Nausea", "Light sensitivity"], prevention: "Identify triggers, sleep well, stay hydrated.", risk: "Stress, hormonal changes, genetics." },
];

const SYMPTOM_INDEX = [...new Set(DISEASES.flatMap((d) => d.symptoms))].sort();

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DISEASES;
    return DISEASES.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.symptoms.some((s) => s.toLowerCase().includes(q)) ||
        d.prevention.toLowerCase().includes(q)
    );
  }, [query]);

  // Symptom checker: rank diseases by overlap with selected symptoms.
  const matches = useMemo(() => {
    if (selectedSymptoms.length === 0) return [];
    return DISEASES.map((d) => ({
      ...d,
      score: d.symptoms.filter((s) => selectedSymptoms.includes(s)).length,
    }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [selectedSymptoms]);

  const toggle = (s) =>
    setSelectedSymptoms((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Medical Knowledge Hub</h1>
      <p className="mt-1 text-muted">Disease library, symptom checker, and prevention guidance.</p>

      {/* Symptom checker */}
      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold">🔍 Symptom Checker</h2>
        <p className="mt-1 text-sm text-muted">Select symptoms to see possible related conditions.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SYMPTOM_INDEX.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                selectedSymptoms.includes(s)
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {matches.length > 0 && (
          <div className="mt-4 space-y-2">
            {matches.map((m) => (
              <div key={m.name} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <b>{m.name}</b> — matches {m.score} of your symptom{m.score > 1 ? "s" : ""}
                <p className="mt-1 text-muted">Prevention: {m.prevention}</p>
              </div>
            ))}
            <p className="text-xs text-muted">
              Educational guidance only — not a diagnosis. Consult a doctor.
            </p>
          </div>
        )}
      </section>

      {/* Disease library */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Disease Library</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((d) => (
            <div key={d.name} className="glass rounded-2xl p-5">
              <h3 className="font-display text-lg font-semibold">{d.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.symptoms.map((s) => (
                  <span key={s} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">{s}</span>
                ))}
              </div>
              <p className="mt-3 text-sm"><span className="text-muted">Prevention:</span> {d.prevention}</p>
              <p className="mt-1 text-sm"><span className="text-muted">Risk factors:</span> {d.risk}</p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-muted">No results.</p>}
        </div>
      </section>
    </div>
  );
}

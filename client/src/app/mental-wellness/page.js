"use client";

import { useState } from "react";
import { KEYS, useLocalState } from "@/lib/storage";

const MOODS = [
  { score: 1, emoji: "😣", label: "Awful" },
  { score: 2, emoji: "🙁", label: "Low" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😄", label: "Great" },
];

const TIPS = [
  "Take 5 slow deep breaths — in for 4, out for 6.",
  "Step outside for 10 minutes of daylight.",
  "Write down one thing you're grateful for.",
  "Message someone you trust.",
  "Stretch and unclench your jaw and shoulders.",
];

export default function MentalWellnessPage() {
  const [data, setData, hydrated] = useLocalState(KEYS.profile + ":mental", {
    moods: [], // { date, score }
    stress: 3,
    sleep: "",
    journal: [],
  });
  const [entry, setEntry] = useState("");

  const logMood = (score) =>
    setData((d) => ({
      ...d,
      moods: [{ date: today(), score }, ...d.moods.filter((m) => m.date !== today())].slice(0, 14),
    }));

  const saveJournal = () => {
    if (!entry.trim()) return;
    setData((d) => ({
      ...d,
      journal: [{ date: new Date().toLocaleString(), text: entry.trim() }, ...d.journal].slice(0, 50),
    }));
    setEntry("");
  };

  if (!hydrated)
    return <div className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading…</div>;

  const chart = [...data.moods].reverse();
  const todayMood = data.moods.find((m) => m.date === today());

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Mental Wellness Center</h1>
      <p className="mt-1 text-muted">Check in with yourself — track mood, stress, sleep, and reflect.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Mood check-in */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-display font-semibold">Daily Mood Check-in</h2>
          <div className="flex justify-between gap-2">
            {MOODS.map((m) => (
              <button
                key={m.score}
                type="button"
                onClick={() => logMood(m.score)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 ${
                  todayMood?.score === m.score ? "border-primary bg-primary/15" : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-xs text-muted">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Mood history bar chart */}
          {chart.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">Last {chart.length} days</p>
              <div className="flex h-28 items-end gap-1">
                {chart.map((m, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${m.date}: ${m.score}/5`}>
                    <div
                      className="w-full rounded-t bg-primary"
                      style={{ height: `${(m.score / 5) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Stress + sleep */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-display font-semibold">Stress &amp; Sleep</h2>
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Stress level: {data.stress}/5</span>
            <input type="range" min="1" max="5" value={data.stress} onChange={(e) => setData((d) => ({ ...d, stress: Number(e.target.value) }))} className="w-full accent-warning" />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Sleep last night (hours)</span>
            <input type="number" inputMode="decimal" value={data.sleep} onChange={(e) => setData((d) => ({ ...d, sleep: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2" placeholder="e.g. 7.5" />
          </label>
          <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted">Self-care tip</p>
            <p className="mt-1">{TIPS[(data.moods.length + data.stress) % TIPS.length]}</p>
          </div>
        </section>

        {/* Journal */}
        <section className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="mb-3 font-display font-semibold">Wellness Journal</h2>
          <textarea
            rows={3}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="How are you feeling? What's on your mind?"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button type="button" onClick={saveJournal} className="mt-2 rounded-lg bg-family px-4 py-2 text-sm font-semibold text-white">
            Save entry
          </button>
          {data.journal.length > 0 && (
            <ul className="mt-4 space-y-2">
              {data.journal.slice(0, 5).map((j, i) => (
                <li key={i} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                  <p className="text-xs text-muted">{j.date}</p>
                  <p className="mt-0.5">{j.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

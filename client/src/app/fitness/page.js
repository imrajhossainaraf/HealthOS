"use client";

import { useState } from "react";
import { KEYS, useLocalState, calcBMI } from "@/lib/storage";

const GOALS = ["Lose Weight", "Gain Weight", "Build Muscle", "Endurance", "Fat Reduction"];

const PLANS = {
  "Lose Weight": ["Calorie deficit ~500/day", "30 min cardio, 5x/week", "High protein, low refined carbs"],
  "Gain Weight": ["Calorie surplus ~300/day", "Strength training 4x/week", "Frequent nutrient-dense meals"],
  "Build Muscle": ["Progressive overload lifting", "1.6–2g protein/kg bodyweight", "Rest 48h between muscle groups"],
  Endurance: ["Zone 2 cardio 40–60 min", "Interval training 2x/week", "Carb-focused fuel + hydration"],
  "Fat Reduction": ["Combine strength + HIIT", "Track macros, manage portions", "8k+ steps daily"],
};

const WATER_GOAL = 8;

export default function FitnessPage() {
  const [data, setData, hydrated] = useLocalState(KEYS.profile + ":fitness", {
    goal: "Lose Weight",
    water: 0,
    waterDate: today(),
    bmiLog: [],
    activities: [],
  });
  const [profile] = useLocalState(KEYS.profile, {});
  const [bmiInput, setBmiInput] = useState({ height: "", weight: "" });
  const [activity, setActivity] = useState({ type: "", minutes: "" });

  // Reset water at the start of a new day.
  const water = data.waterDate === today() ? data.water : 0;
  // Defensive: the fitness object may be a partial shape (e.g. written by the
  // dashboard's quick water logger as { water, waterDate }), so these can be
  // missing. Never assume the arrays exist.
  const bmiLog = Array.isArray(data.bmiLog) ? data.bmiLog : [];
  const activities = Array.isArray(data.activities) ? data.activities : [];

  const addWater = (delta) =>
    setData((d) => ({
      ...d,
      water: Math.max(0, (d.waterDate === today() ? d.water : 0) + delta),
      waterDate: today(),
    }));

  const logBMI = () => {
    const h = bmiInput.height || profile.heightCm;
    const w = bmiInput.weight || profile.weightKg;
    const result = calcBMI(h, w);
    if (!result) return;
    setData((d) => ({
      ...d,
      bmiLog: [{ date: today(), value: result.value, category: result.category }, ...(d.bmiLog || [])].slice(0, 20),
    }));
    setBmiInput({ height: "", weight: "" });
  };

  const logActivity = () => {
    if (!activity.type.trim() || !activity.minutes) return;
    setData((d) => ({
      ...d,
      activities: [{ date: today(), ...activity, minutes: Number(activity.minutes) }, ...(d.activities || [])].slice(0, 30),
    }));
    setActivity({ type: "", minutes: "" });
  };

  if (!hydrated)
    return <div className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading…</div>;

  const waterPct = Math.min(100, Math.round((water / WATER_GOAL) * 100));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Fitness &amp; Wellness</h1>
      <p className="mt-1 text-muted">Track vitals, hydration, goals, and activity.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Goal + plan */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-display font-semibold">Goal</h2>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setData((d) => ({ ...d, goal: g }))}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  data.goal === g ? "border-primary bg-primary/15 text-primary" : "border-border text-muted hover:text-text"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {PLANS[data.goal].map((p, i) => (
              <li key={i} className="flex gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-primary">✓</span> {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Water tracker */}
        <section className="glass rounded-2xl p-5 text-center">
          <h2 className="mb-3 font-display font-semibold">💧 Water Intake</h2>
          <div className="relative mx-auto grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-info) ${waterPct}%, var(--color-surface-2) 0)` }}>
            <div className="grid h-24 w-24 place-items-center rounded-full bg-surface">
              <span className="font-display text-2xl font-bold">{water}/{WATER_GOAL}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">glasses today</p>
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" onClick={() => addWater(-1)} className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm">−</button>
            <button type="button" onClick={() => addWater(1)} className="rounded-lg bg-info px-4 py-2 text-sm font-semibold text-white">+ Glass</button>
          </div>
        </section>

        {/* BMI log */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-display font-semibold">BMI Calculator</h2>
          <div className="flex flex-wrap gap-2">
            <input className={inp} placeholder={`Height cm ${profile.heightCm ? `(${profile.heightCm})` : ""}`} value={bmiInput.height} onChange={(e) => setBmiInput({ ...bmiInput, height: e.target.value })} />
            <input className={inp} placeholder={`Weight kg ${profile.weightKg ? `(${profile.weightKg})` : ""}`} value={bmiInput.weight} onChange={(e) => setBmiInput({ ...bmiInput, weight: e.target.value })} />
            <button type="button" onClick={logBMI} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Log</button>
          </div>
          {bmiLog.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {bmiLog.slice(0, 5).map((b, i) => (
                <li key={i} className="flex justify-between rounded-lg border border-border bg-surface px-3 py-1.5">
                  <span className="text-muted">{b.date}</span>
                  <span className="font-medium">{b.value} · {b.category}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity log */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-display font-semibold">Activity Log</h2>
          <div className="flex flex-wrap gap-2">
            <input className={inp} placeholder="Activity (e.g. Running)" value={activity.type} onChange={(e) => setActivity({ ...activity, type: e.target.value })} />
            <input className={inp} placeholder="Minutes" inputMode="numeric" value={activity.minutes} onChange={(e) => setActivity({ ...activity, minutes: e.target.value })} />
            <button type="button" onClick={logActivity} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white">Add</button>
          </div>
          {activities.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {activities.slice(0, 5).map((a, i) => (
                <li key={i} className="flex justify-between rounded-lg border border-border bg-surface px-3 py-1.5">
                  <span>{a.type}</span>
                  <span className="text-muted">{a.minutes} min · {a.date}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const inp = "flex-1 min-w-[6rem] rounded-lg border border-border bg-surface px-3 py-2 text-sm";

function today() {
  return new Date().toISOString().slice(0, 10);
}

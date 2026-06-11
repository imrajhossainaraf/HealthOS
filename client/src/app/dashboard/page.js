"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Siren, Hospital, IdCard, Droplet, UsersRound, Bot, Leaf, Dumbbell, Brain,
  Activity, BookOpen, History, Scale, GlassWater, CircleCheck,
} from "lucide-react";
import { KEYS, useLocalState, calcBMI } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import ReputationBadge from "@/components/ReputationBadge";

/* Curated Unsplash imagery (images.unsplash.com is whitelisted in next.config). */
const img = (id, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/* Fast, always-visible destinations shown at the top of the dashboard. */
const QUICK = [
  { href: "/emergency", label: "Emergency", Icon: Siren, chip: "bg-emergency/10 text-emergency" },
  { href: "/hospitals", label: "Hospitals", Icon: Hospital, chip: "bg-primary/10 text-primary" },
  { href: "/profile", label: "Health Card", Icon: IdCard, chip: "bg-info/10 text-info" },
  { href: "/community", label: "Community", Icon: Droplet, chip: "bg-emergency/10 text-emergency" },
  { href: "/family", label: "Family", Icon: UsersRound, chip: "bg-family/10 text-family" },
  { href: "/ai-assistant", label: "AI Copilot", Icon: Bot, chip: "bg-success/10 text-success" },
];

const FEATURES = [
  {
    href: "/emergency",
    title: "Emergency Response",
    desc: "One-tap SOS that escalates to family, contacts, and nearby responders.",
    Icon: Siren,
    img: img("photo-1519494026892-80bbd2d6fd0d", 800),
    ring: "ring-emergency/30",
    chip: "bg-emergency/10 text-emergency",
  },
  {
    href: "/community",
    title: "Blood & Community",
    desc: "Find donors on the live map and build trusted community reputation.",
    Icon: Droplet,
    img: img("photo-1576091160550-2173dba999ef", 800),
    ring: "ring-info/30",
    chip: "bg-info/10 text-info",
  },
  {
    href: "/herbal",
    title: "Herbal Knowledge",
    desc: "Traditional remedies and preparations, shared across the network.",
    Icon: Leaf,
    img: img("photo-1501004318641-b39e6451bec6", 800),
    ring: "ring-herbal/30",
    chip: "bg-herbal/10 text-herbal",
  },
  {
    href: "/fitness",
    title: "Fitness Tracker",
    desc: "Hydration, steps, and daily goals — small habits, lasting health.",
    Icon: Dumbbell,
    img: img("photo-1571019613454-1cb2f99b2d8b", 800),
    ring: "ring-success/30",
    chip: "bg-success/10 text-success",
  },
  {
    href: "/mental-wellness",
    title: "Mental Wellness",
    desc: "Mood check-ins, breathing exercises, and calm when you need it.",
    Icon: Brain,
    img: img("photo-1506126613408-eca07ce68773", 800),
    ring: "ring-family/30",
    chip: "bg-family/10 text-family",
  },
  {
    href: "/hospitals",
    title: "Hospitals Nearby",
    desc: "Locate the closest hospitals and ambulances from where you are.",
    Icon: Hospital,
    img: img("photo-1538108149393-fbbd81895907", 800),
    ring: "ring-primary/30",
    chip: "bg-primary/10 text-primary",
  },
];

const MODULES = [
  { href: "/disease-watch", label: "Disease Watch", Icon: Activity, tint: "text-warning" },
  { href: "/knowledge", label: "Knowledge", Icon: BookOpen, tint: "text-info" },
  { href: "/emergency-history", label: "Timeline", Icon: History, tint: "text-emergency" },
  { href: "/herbal", label: "Herbal", Icon: Leaf, tint: "text-herbal" },
  { href: "/fitness", label: "Fitness", Icon: Dumbbell, tint: "text-success" },
  { href: "/mental-wellness", label: "Mental", Icon: Brain, tint: "text-family" },
];

export default function DashboardPage() {
  const [profile, , hp] = useLocalState(KEYS.profile, {});
  const [family] = useLocalState(KEYS.family, []);
  const [community] = useLocalState(KEYS.community, { points: 0 });
  const [history] = useLocalState(KEYS.emergencyHistory, []);
  const [fitness, setFitness] = useLocalState(KEYS.profile + ":fitness", { water: 0, waterDate: "" });
  const { user } = useAuth();

  const todayKey = new Date().toISOString().slice(0, 10);
  const addWater = (delta) =>
    setFitness((d) => ({
      ...d,
      water: Math.max(0, (d.waterDate === todayKey ? d.water || 0 : 0) + delta),
      waterDate: todayKey,
    }));

  if (!hp)
    return <div className="mx-auto max-w-6xl px-4 py-16 text-muted">Loading…</div>;

  const firstName =
    (profile.name || user?.name || "").split(" ")[0] || "there";
  const bmi = calcBMI(profile.heightCm, profile.weightKg);
  const todayWater =
    fitness.waterDate === new Date().toISOString().slice(0, 10) ? fitness.water : 0;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const familyAlerts = family.filter((m) => m.alert || m.risk === "High");
  const vaccReminders = (profile.vaccinations || [])
    .filter((v) => v.dueDate)
    .map((v) => ({ ...v, days: daysUntil(v.dueDate) }))
    .filter((v) => v.days !== null && v.days <= 60)
    .sort((a, b) => a.days - b.days);

  const profileComplete = profileScore(profile, family);

  return (
    <div className="pb-16">
      {/* ============== HEADER (welcome + compact stats) ============== */}
      <header>
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
          <div className="flex flex-col gap-5 animate-fade-up lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <p className="text-xs text-muted sm:text-sm">{today}</p>
              <h1 className="mt-1 font-display text-2xl font-bold sm:text-4xl">
                Welcome back, <span className="text-gradient-animated">{firstName}</span> 👋
              </h1>
              <p className="mt-1 text-sm text-muted sm:text-base">Your unified health overview.</p>
            </div>

            {/* Stats — premium glass card, 2×2; full width on mobile, compact on desktop */}
            <div className="glass grid w-full grid-cols-2 gap-x-4 gap-y-4 rounded-2xl p-4 sm:gap-x-8 lg:w-auto lg:shrink-0">
              <StatItem Icon={Scale} tint="text-primary" chip="bg-primary/10" value={bmi ? bmi.value : "—"} label={bmi ? `BMI · ${bmi.category}` : "BMI"} />
              <StatItem Icon={Droplet} tint="text-emergency" chip="bg-emergency/10" value={profile.bloodGroup || "—"} label="Blood group" />
              <StatItem Icon={GlassWater} tint="text-info" chip="bg-info/10" value={`${todayWater}/8`} label="Glasses today" />
              <StatItem Icon={CircleCheck} tint="text-success" chip="bg-success/10" value={`${profileComplete}%`} label="Profile complete" />
            </div>
          </div>
        </div>
      </header>

      {/* ============== CHART + QUICK ACCESS ============== */}
      <div className="mx-auto mt-6 grid max-w-6xl gap-5 px-4 sm:mt-8 sm:gap-6 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
        <AlertsGraph history={history} />

        <section className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Quick access</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="glass-hover flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-3"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${q.chip}`}>
                  <q.Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="truncate text-sm font-medium">{q.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ============== MAIN GRID ============== */}
      <div className="mx-auto mt-8 grid max-w-6xl gap-5 px-4 sm:mt-10 sm:gap-6 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
        {/* LEFT */}
        <div className="space-y-5 sm:space-y-6">
          {/* Guardian overview */}
          <section className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Guardian Overview</h2>
              <Link href="/family" className="text-sm font-medium text-primary hover:underline">
                Manage →
              </Link>
            </div>
            {family.length === 0 ? (
              <EmptyRow text="No family members yet — add the people you care for." />
            ) : (
              <ul className="space-y-2">
                {family.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-family/10 text-family">
                        {(m.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <span className="font-medium">{m.name}</span>
                        <span className="block text-xs text-muted">{m.relation}</span>
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        m.risk === "High"
                          ? "bg-emergency/10 text-emergency"
                          : m.risk === "Medium"
                          ? "bg-warning/10 text-warning"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {m.alert || `${m.risk || "Low"} risk`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Reminders */}
          <section className="glass rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Today’s Reminders</h2>
            <ul className="space-y-2 text-sm">
              {vaccReminders.length === 0 && familyAlerts.length === 0 && (
                <li className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-success">
                  ✅ All clear — no urgent reminders right now.
                </li>
              )}
              {vaccReminders.map((v, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-warning"
                >
                  💉 <span className="font-medium">{v.name}</span> —{" "}
                  {v.days < 0 ? `overdue ${-v.days}d` : v.days === 0 ? "due today" : `due in ${v.days}d`}
                </li>
              ))}
              {familyAlerts.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3"
                >
                  👪 <span className="font-medium">{m.name}</span>: {m.alert || `${m.risk} risk`}
                </li>
              ))}
            </ul>
          </section>

          {/* Recent SOS timeline */}
          <section className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recent Activity</h2>
              <Link href="/emergency-history" className="text-sm font-medium text-primary hover:underline">
                Full timeline →
              </Link>
            </div>
            {history.length === 0 ? (
              <EmptyRow text="No emergency activations logged — stay safe." />
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {history.slice(0, 4).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute left-[-1.62rem] top-1 grid h-5 w-5 place-items-center rounded-full bg-emergency/15 text-[10px]">
                      🚨
                    </span>
                    <p className="text-sm font-medium">{e.reason}</p>
                    <p className="text-xs text-muted">
                      {new Date(e.timestamp).toLocaleString()} · {e.outcome || "Logged"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-5 sm:space-y-6">
          <ReputationBadge points={community?.points || 0} />

          {/* Hydration ring */}
          <section className="glass rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Hydration</h2>
            <div className="flex items-center gap-5">
              <WaterRing value={todayWater} goal={8} />
              <div>
                <p className="text-sm text-muted">Today’s intake</p>
                <p className="font-display text-2xl font-bold">
                  {todayWater}
                  <span className="text-base font-normal"> / 8 glasses</span>
                </p>
                {/* I want to eat */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addWater(-1)}
                    disabled={todayWater <= 0}
                    aria-label="Remove a glass"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-2 text-lg font-semibold disabled:opacity-40"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => addWater(1)}
                    className="rounded-lg bg-info px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    + Glass
                  </button>
                  <Link href="/fitness" className="ml-1 text-sm font-medium text-info hover:underline">
                    Details →
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Quick access */}
          <section className="glass rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">More tools</h2>
            <div className="grid grid-cols-3 gap-3">
              {MODULES.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="glass-hover flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center"
                >
                  <m.Icon className={`h-6 w-6 ${m.tint}`} strokeWidth={2} />
                  <span className="text-[11px] font-medium leading-tight">{m.label}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Wellness tip with image */}
          <section className="glass relative overflow-hidden rounded-2xl">
            <div className="relative h-32">
              <Image
                src={img("photo-1545205597-3d9d02c29597", 800)}
                alt=""
                fill
                sizes="400px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/55 to-transparent" />
              <p className="absolute bottom-3 left-4 font-display text-lg font-bold text-white">
                Daily wellness
              </p>
            </div>
            <div className="p-5 text-sm text-muted">
              A 10-minute walk after meals can meaningfully steady blood sugar and
              lift your mood. Small, consistent steps win.
              <Link
                href="/mental-wellness"
                className="mt-3 block font-medium text-primary hover:underline"
              >
                More wellness ideas →
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* ============== EXPLORE (image features) — bottom ============== */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Explore your network</h2>
            <p className="mt-1 text-sm text-muted">
              Everything HealthOS can do, a tap away.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.href} feature={f} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function AlertsGraph({ history = [] }) {
  const days = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return { label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), time: d.getTime(), count: 0 };
  });
  for (const e of history) {
    const t = new Date(e.timestamp);
    if (isNaN(t)) continue;
    t.setHours(0, 0, 0, 0);
    const b = buckets.find((x) => x.time === t.getTime());
    if (b) b.count += 1;
  }
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  // Map counts to an SVG coordinate space (viewBox 0..100 × 0..40).
  const W = 100, H = 40, padT = 4, padB = 4;
  const pts = buckets.map((b, i) => ({
    x: (i / (buckets.length - 1)) * W,
    y: H - padB - (b.count / max) * (H - padT - padB),
  }));
  const line = smoothPath(pts);
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const gridY = [padT, (padT + (H - padB)) / 2, H - padB];

  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Siren className="h-5 w-5 text-emergency" strokeWidth={2} /> Emergency Alerts
        </h2>
        <span className="text-xs text-muted">last 14 days · {total} total</span>
      </div>

      <div className="flex gap-2">
        {/* y-axis labels */}
        <div className="flex h-36 flex-col justify-between py-1 text-[10px] text-muted">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        {/* chart */}
        <div className="relative flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full overflow-visible">
            <defs>
              <linearGradient id="alertArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e11d48" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridY.map((y, i) => (
              <line key={i} x1="0" y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="url(#alertArea)" />
            <path d={line} fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>

      {/* x-axis labels (endpoints + middle, to avoid crowding) */}
      <div className="ml-7 mt-1 flex justify-between text-[10px] text-muted">
        <span>{buckets[0].label}</span>
        <span>{buckets[Math.floor(buckets.length / 2)].label}</span>
        <span>Today</span>
      </div>

      {total === 0 && (
        <p className="mt-2 text-xs text-muted">No emergency alerts in the last 14 days — stay safe.</p>
      )}
    </section>
  );
}

/** Smooth (Catmull-Rom → cubic Bézier) path through points for a flowing line. */
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  const d = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

function StatItem({ Icon, value, label, tint, chip = "bg-surface-2" }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${chip} ${tint}`}>
        {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />}
      </span>
      <div className="min-w-0">
        <p className={`font-display text-lg font-bold leading-none sm:text-xl ${tint}`}>{value}</p>
        <p className="mt-1 truncate text-[11px] text-muted sm:text-xs">{label}</p>
      </div>
    </div>
  );
}

function FeatureCard({ feature: f }) {
  return (
    <Link
      href={f.href}
      className={`glass glass-hover group block overflow-hidden rounded-2xl ring-1 ${f.ring}`}
    >
      <div className="relative h-36 overflow-hidden">
        <Image
          src={f.img}
          alt={f.title}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
        <span
          className={`absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-xl backdrop-blur ${f.chip}`}
        >
          <f.Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg font-semibold">{f.title}</h3>
        <p className="mt-1 text-sm text-muted">{f.desc}</p>
        <span className="mt-3 inline-block text-sm font-medium text-primary">
          Open →
        </span>
      </div>
    </Link>
  );
}

function WaterRing({ value, goal }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal ? value / goal : 0);
  const offset = c * (1 - pct);
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
      <g transform="rotate(-90 42 42)">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--color-info)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </g>
      <text
        x="42"
        y="42"
        dominantBaseline="central"
        textAnchor="middle"
        style={{ fontSize: 18, fontWeight: 700, fill: "var(--color-text)" }}
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

function EmptyRow({ text }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
      {text}
    </p>
  );
}

function profileScore(profile, family) {
  const checks = [
    profile.name,
    profile.bloodGroup,
    profile.heightCm,
    profile.weightKg,
    profile.area || profile.city,
    (profile.allergies || []).length || profile.allergies,
    profile.guardianPhone || profile.guardianEmail,
    family.length,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function daysUntil(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

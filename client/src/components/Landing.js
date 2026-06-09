"use client";

import Link from "next/link";

const FEATURES = [
  { icon: "🚨", title: "Emergency SOS", desc: "One tap escalates to family, contacts, and nearby volunteers — and alerts the whole network in real time." },
  { icon: "🩸", title: "Blood Donor Network", desc: "Find and become a donor on a live shared map across Bangladesh." },
  { icon: "🏥", title: "Nearby Hospitals", desc: "Real hospitals around you with one-tap call and directions." },
  { icon: "🦠", title: "Disease Watch", desc: "Community-sourced symptom trends and seasonal outbreak alerts." },
  { icon: "🌿", title: "Herbal Knowledge", desc: "A living archive of traditional remedies, shared and preserved by the community." },
  { icon: "🪪", title: "Health Card & Records", desc: "Your vitals, blood group, and emergency info — ready offline with a QR code." },
];

const STATS = [
  { value: "1-tap", label: "Emergency response" },
  { value: "8", label: "Blood groups tracked" },
  { value: "24/7", label: "Network alerts" },
  { value: "100%", label: "Works offline-first" },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">✚</span>
            Health<span className="-ml-1.5 text-primary">OS</span>
          </span>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-text">
              Sign in
            </Link>
            <Link href="/login" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <span className="pointer-events-none absolute -right-10 -top-16 text-[16rem] text-primary/5" aria-hidden>✚</span>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              🇧🇩 Built for Bangladesh
            </span>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              The Community Health &amp; <span className="text-primary">Emergency Network</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted">
              Connecting people, knowledge, and care when it matters most — emergency response,
              blood donation, family health, and traditional remedies in one platform.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90">
                Create your free account
              </Link>
              <Link href="/emergency" className="flex items-center gap-2 rounded-xl bg-emergency px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emergency/25 transition hover:scale-105">
                🚨 Emergency SOS
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">No sign-up needed to use the SOS beacon in a crisis.</p>
          </div>

          <div className="relative">
            <div className="glass rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-50 to-teal-50 p-8 text-center">
              <span className="select-none text-8xl">🧑‍⚕️</span>
              <p className="mt-4 font-display text-xl font-bold text-slate-900">Your Health, Our Priority</p>
              <p className="mt-1 text-sm text-muted">Quality healthcare, anytime, anywhere.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-white p-3">
                    <p className="font-display text-2xl font-bold text-primary">{s.value}</p>
                    <p className="text-xs text-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold text-slate-900">Everything your community needs</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted">
          One connected platform for emergencies, donors, outbreaks, and traditional knowledge.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass glass-hover rounded-2xl p-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl">{f.icon}</span>
              <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-linear-to-r from-primary to-teal-600 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="font-display text-3xl font-bold">Join the network today</h2>
          <p className="mx-auto mt-2 max-w-md text-white/90">
            Register to save your health card, publish to the donor map, and respond to nearby emergencies.
          </p>
          <Link href="/login" className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-primary shadow-lg transition hover:bg-white/90">
            Get started — it&apos;s free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6">
          <span className="flex items-center gap-2 font-display font-semibold text-slate-700">
            <span className="text-primary">✚</span> HealthOS
          </span>
          <span>Built for community health in Bangladesh · For emergencies call 999</span>
        </div>
      </footer>
    </div>
  );
}

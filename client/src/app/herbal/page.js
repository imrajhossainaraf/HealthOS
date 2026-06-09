"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KEYS, useLocalState, addReputation } from "@/lib/storage";
import { herbApi, getToken } from "@/lib/api";
import { useToast } from "@/lib/toast";
import {
  HERBS,
  CATEGORIES,
  EVIDENCE_LEVELS,
  SEVERITY,
  checkInteractions,
} from "@/lib/herbs";
import HerbCard from "@/components/HerbCard";

export default function HerbalPage() {
  // Pending local submissions (offline / not-yet-synced); shared ones live on the server.
  const [submissions, setSubmissions, hydrated] = useLocalState(
    KEYS.herbalSubmissions,
    []
  );
  const { push } = useToast();

  // Shared, cross-user herbal knowledge from the backend.
  const [serverHerbs, setServerHerbs] = useState([]);
  const loadHerbs = useCallback(() => {
    herbApi
      .list()
      .then((r) => setServerHerbs(r.herbs || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadHerbs();
  }, [loadHerbs]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [evidence, setEvidence] = useState("All");

  // Interaction checker state
  const [selectedHerbs, setSelectedHerbs] = useState([]);
  const [medText, setMedText] = useState("");
  const [results, setResults] = useState(null);

  // Submission form
  const [form, setForm] = useState({
    name: "",
    use: "",
    region: "",
    preparation: "",
    role: "Community Member",
    notes: "",
  });

  const allHerbs = useMemo(() => {
    const toHerb = (s, { pending }) => ({
      id: (pending ? "c-" : "s-") + s.id,
      name: s.name,
      scientific: s.scientificName || "Community contribution",
      localNames: [],
      category: "Wellness",
      evidence: "Traditional",
      uses: s.use ? [s.use] : [],
      preparation: s.preparation ? [s.preparation] : [],
      warnings: "",
      notes: s.notes,
      region: s.region,
      author: s.author,
      interactions: [],
      _community: true,
      _pending: pending,
    });
    // Shared (published) entries from the server + this device's pending ones.
    const shared = serverHerbs.map((s) => toHerb(s, { pending: false }));
    const pending = submissions.map((s) => toHerb(s, { pending: true }));
    return [...pending, ...shared, ...HERBS];
  }, [serverHerbs, submissions]);

  const filtered = useMemo(
    () =>
      allHerbs.filter((h) => {
        const q = query.trim().toLowerCase();
        const matchesQ =
          !q ||
          h.name.toLowerCase().includes(q) ||
          h.scientific.toLowerCase().includes(q) ||
          h.localNames?.some((n) => n.toLowerCase().includes(q));
        const matchesCat = category === "All" || h.category === category;
        const matchesEv = evidence === "All" || h.evidence === evidence;
        return matchesQ && matchesCat && matchesEv;
      }),
    [allHerbs, query, category, evidence]
  );

  const toggleHerb = (id) =>
    setSelectedHerbs((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );

  const runCheck = () => setResults(checkInteractions(selectedHerbs, medText));

  const submit = async () => {
    if (!form.name.trim() || !form.use.trim()) return;
    const payload = {
      name: form.name.trim(),
      use: form.use.trim(),
      region: form.region.trim(),
      preparation: form.preparation.trim(),
      role: form.role,
      notes: form.notes.trim(),
    };
    const reset = () =>
      setForm({ name: "", use: "", region: "", preparation: "", role: "Community Member", notes: "" });

    if (getToken()) {
      // Publish to the shared knowledge base so every user can see it.
      try {
        await herbApi.create(payload);
        loadHerbs();
        addReputation(50, "Herbal knowledge submitted");
        push({ variant: "success", title: "Published to the community", body: `${payload.name} is now visible to everyone. +50 reputation.` });
        reset();
        return;
      } catch {
        /* fall through to a local copy if the server rejects/offline */
      }
    }
    // Guest or offline: keep a local pending copy and nudge to sign in.
    setSubmissions((s) => [{ id: Date.now().toString(36), ...payload, submittedAt: new Date().toISOString() }, ...s]);
    addReputation(50, "Herbal knowledge submitted");
    push({
      variant: "info",
      title: "Saved on this device",
      body: getToken() ? "Server unavailable — we'll keep it locally for now." : "Sign in to share it with the whole community.",
      href: getToken() ? undefined : "/login",
      actionLabel: getToken() ? undefined : "Sign in",
    });
    reset();
  };

  const featured = HERBS[new Date().getDate() % HERBS.length];

  if (!hydrated)
    return <div className="mx-auto max-w-6xl px-4 py-16 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Herbal Knowledge Network</h1>
      <p className="mt-1 text-muted">
        A living archive of traditional plant remedies — preserved by the community.
      </p>

      {/* Featured */}
      <section className="glass mt-6 rounded-2xl border border-herbal/30 p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-herbal">🌿 Herb of the Day</p>
        <h2 className="mt-1 font-display text-2xl font-bold">{featured.name}</h2>
        <p className="text-sm italic text-muted">{featured.scientific}</p>
        <p className="mt-2 text-sm">{featured.uses.join(" · ")}</p>
      </section>

      {/* ---------- INTERACTION CHECKER ---------- */}
      <section className="glass mt-6 rounded-2xl border border-warning/30 p-5">
        <h2 className="font-display text-xl font-semibold">⚗️ Medicine &amp; Herb Interaction Checker</h2>
        <p className="mt-1 text-sm text-muted">
          Select herbs you use and list your medications to check for known conflicts.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Herbs</p>
            <div className="flex flex-wrap gap-2">
              {HERBS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleHerb(h.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    selectedHerbs.includes(h.id)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted hover:text-text"
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Medications (comma separated)</p>
            <textarea
              rows={3}
              value={medText}
              onChange={(e) => setMedText(e.target.value)}
              placeholder="e.g. Warfarin, SSRIs, Metformin"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={runCheck}
          disabled={selectedHerbs.length === 0}
          className="mt-4 rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Check interactions
        </button>

        {results && (
          <div className="mt-4 space-y-2">
            {results.length === 0 ? (
              <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
                ✓ No known interactions found for the selected herbs.
              </p>
            ) : (
              results.map((r, i) => {
                const s = SEVERITY[r.severity] || SEVERITY.Low;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 text-sm ${
                      r.matchedMed ? "border-emergency/50 bg-emergency/10" : "border-border bg-surface"
                    }`}
                  >
                    {r.matchedMed && <span className="font-semibold text-emergency">⚠️ Match · </span>}
                    {s.dot} <b>{r.herb} + {r.with}</b>: {r.effect}{" "}
                    <span className={s.color}>({s.label})</span>
                    {r.matchedMed && " — consult your doctor"}
                  </div>
                );
              })
            )}
            <p className="text-xs text-muted">
              For informational purposes only. Always consult a qualified healthcare provider.
            </p>
          </div>
        )}
      </section>

      {/* ---------- BROWSE ---------- */}
      <section className="mt-8">
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, scientific, or local name…"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <option>All</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={evidence} onChange={(e) => setEvidence(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <option>All</option>
            {EVIDENCE_LEVELS.map((ev) => (
              <option key={ev}>{ev}</option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => (
            <HerbCard key={h.id} herb={h} community={h._community} pending={h._pending} />
          ))}
          {filtered.length === 0 && (
            <p className="text-muted">No herbs match your filters.</p>
          )}
        </div>
      </section>

      {/* ---------- COMMUNITY SUBMISSION ---------- */}
      <section className="glass mt-8 rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold">🌿 Share Your Grandmother&apos;s Knowledge</h2>
        <p className="mt-1 text-sm text-muted">
          Contribute traditional remedies. Earns +50 reputation. When signed in, your entry is
          published to the whole community instantly.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Plant name (as known locally)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Region of origin" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          <input className="rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:col-span-2" placeholder="Traditional use" value={form.use} onChange={(e) => setForm({ ...form, use: e.target.value })} />
          <input className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Preparation method" value={form.preparation} onChange={(e) => setForm({ ...form, preparation: e.target.value })} />
          <select className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {["Community Member", "Elder", "Herbalist", "Researcher"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <textarea rows={2} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:col-span-2" placeholder="Notes / story (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button type="button" onClick={submit} className="mt-3 rounded-lg bg-herbal px-4 py-2 text-sm font-semibold text-white">
          Submit knowledge (+50 pts)
        </button>
        <p className="mt-3 text-xs text-muted">
          🌿 {serverHerbs.length} community {serverHerbs.length === 1 ? "remedy" : "remedies"} shared by the network
          {submissions.length > 0 ? ` · ${submissions.length} pending on this device` : ""}.
        </p>
      </section>
    </div>
  );
}

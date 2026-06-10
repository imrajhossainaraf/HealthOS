"use client";

import { useState } from "react";
import { KEYS, useLocalState } from "@/lib/storage";
import FamilyMemberCard from "@/components/FamilyMemberCard";
import HealthCard from "@/components/HealthCard";

const RELATIONS = ["Parent", "Child", "Spouse", "Other"];
const RISKS = ["Low", "Medium", "High"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const EMPTY = {
  name: "",
  relation: "Parent",
  email: "",
  dob: "",
  bloodGroup: "",
  conditions: [],
  medications: [],
  risk: "Low",
  alert: "",
};

export default function FamilyPage() {
  const [family, setFamily, hydrated] = useLocalState(KEYS.family, []);
  const [form, setForm] = useState(EMPTY);
  const [selectedId, setSelectedId] = useState(null);

  const addMember = () => {
    if (!form.name.trim()) return;
    const member = {
      id: Date.now().toString(36),
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      conditions: splitList(form.conditions),
      medications: splitList(form.medications),
    };
    setFamily((f) => [...f, member]);
    setForm(EMPTY);
  };

  const removeMember = (id) => {
    setFamily((f) => f.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selected = family.find((m) => m.id === selectedId);

  if (!hydrated)
    return <div className="mx-auto max-w-6xl px-4 py-16 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Family Guardian Mode</h1>
      <p className="mt-1 text-muted">Manage health for everyone you care for — in one place.</p>

      {/* Guardian dashboard summary */}
      {family.length > 0 && (
        <section className="glass mt-6 rounded-2xl p-5">
          <h2 className="mb-3 font-display font-semibold">Guardian Overview</h2>
          <ul className="space-y-2">
            {family.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-medium">
                  {m.name} — {m.relation}
                  {m.email && <span className="ml-2 text-xs text-success" title={`SOS alerts to ${m.email}`}>✉ alerts on</span>}
                </span>
                <span className="flex items-center gap-2 text-muted">
                  <span className={riskText(m.risk)}>{m.risk} risk</span>
                  {m.alert && <span className="text-warning">⚠️ {m.alert}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Members + add form */}
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-display text-xl font-semibold">Family Members</h2>
            {family.length === 0 ? (
              <p className="glass rounded-2xl p-6 text-sm text-muted">No members yet. Add one below.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {family.map((m) => (
                  <FamilyMemberCard
                    key={m.id}
                    member={m}
                    onSelect={() => setSelectedId(m.id)}
                    onRemove={() => removeMember(m.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-1 font-display font-semibold">Add a member</h2>
            <p className="mb-3 text-xs text-muted">Add an email to alert this person automatically when you trigger an emergency SOS.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className={input} value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <input type="email" className={`${input} sm:col-span-2`} placeholder="Email (for SOS alerts)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
              <input type="date" className={input} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              <select className={input} value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                <option value="">Blood group…</option>
                {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
              </select>
              <input className={input} placeholder="Conditions (comma separated)" value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
              <input className={input} placeholder="Medications (comma separated)" value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} />
              <select className={input} value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })}>
                {RISKS.map((r) => <option key={r}>{r} risk</option>)}
              </select>
              <input className={input} placeholder="Alert (e.g. Medication due 8PM)" value={form.alert} onChange={(e) => setForm({ ...form, alert: e.target.value })} />
            </div>
            <button type="button" onClick={addMember} className="mt-3 rounded-lg bg-family px-4 py-2 text-sm font-semibold text-white">
              Add member
            </button>
          </section>
        </div>

        {/* Selected member detail */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-3 font-display text-lg font-semibold">Member Card</h2>
          {selected ? (
            <div className="space-y-3">
              <HealthCard
                profile={{
                  name: selected.name,
                  bloodGroup: selected.bloodGroup,
                  dob: selected.dob,
                  conditions: selected.conditions,
                  medications: selected.medications,
                  allergies: [],
                }}
                contacts={[]}
              />
              <div className="glass rounded-2xl p-4 text-sm">
                <p><span className="text-muted">Relation:</span> {selected.relation}</p>
                <p><span className="text-muted">Risk:</span> <span className={riskText(selected.risk)}>{selected.risk}</span></p>
                {selected.alert && <p className="text-warning">⚠️ {selected.alert}</p>}
              </div>
            </div>
          ) : (
            <p className="glass rounded-2xl p-6 text-sm text-muted">
              Select a member to view their emergency card.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const input = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm";

function splitList(v) {
  if (Array.isArray(v)) return v;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function riskText(risk) {
  return risk === "High" ? "text-emergency" : risk === "Medium" ? "text-warning" : "text-success";
}

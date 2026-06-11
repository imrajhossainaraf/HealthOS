"use client";

import { useState } from "react";
import { KEYS, useLocalState, calcBMI } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { normalizeBDPhone } from "@/lib/phone";
import HealthCard from "@/components/HealthCard";

const EMPTY_PROFILE = {
  name: "",
  dob: "",
  gender: "",
  bloodGroup: "",
  phone: "",
  address: "",
  area: "",
  nid: "",
  heightCm: "",
  weightKg: "",
  allergies: [],
  conditions: [],
  medications: [],
  vaccinations: [], // { name, date, dueDate }
  // Parent / guardian — emailed automatically when this person triggers an SOS.
  guardianName: "",
  guardianEmail: "",
  guardianPhone: "",
  guardianNid: "",
  familyHistory: "",
  goals: "",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Male", "Female", "Other"];

export default function ProfilePage() {
  const [profile, setProfile, hydrated] = useLocalState(KEYS.profile, EMPTY_PROFILE);
  const [contacts, setContacts] = useLocalState(KEYS.emergencyContacts, []);
  const { user } = useAuth();

  const set = (field) => (e) =>
    setProfile((p) => ({ ...p, [field]: e.target.value }));

  // Auto-prefix +880 once the user leaves a phone field, so numbers are stored
  // in a consistent format for search and emergency-alert lookups.
  const formatPhone = (field) => () =>
    setProfile((p) => (p[field] ? { ...p, [field]: normalizeBDPhone(p[field]) } : p));

  const bmi = calcBMI(profile.heightCm, profile.weightKg);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-muted">Loading profile…</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="no-print mb-8">
        <h1 className="font-display text-3xl font-bold">Personal Health Profile</h1>
        <p className="mt-1 text-muted">
          Auto-saved to this device. Powers your Emergency Card, Family Guardian, and Dashboard.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* ---------------- FORM ---------------- */}
        <div className="no-print space-y-6">
          {/* Identity */}
          <Section title="Identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className={inputCls} value={profile.name} onChange={set("name")} placeholder="Jane Doe" />
              </Field>
              <Field label="Date of birth">
                <input type="date" className={inputCls} value={profile.dob} onChange={set("dob")} />
              </Field>
              <Field label="Gender">
                <select className={inputCls} value={profile.gender} onChange={set("gender")}>
                  <option value="">Select…</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="Blood group">
                <select className={inputCls} value={profile.bloodGroup} onChange={set("bloodGroup")}>
                  <option value="">Select…</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </Field>
              <Field label="Phone number">
                <input className={inputCls} inputMode="tel" value={profile.phone} onChange={set("phone")} onBlur={formatPhone("phone")} placeholder="+880 1XXX-XXXXXX" autoComplete="off" />
              </Field>
              <Field label="National ID (NID)">
                <input className={inputCls} inputMode="numeric" value={profile.nid} onChange={set("nid")} placeholder="e.g. 1990123456789" autoComplete="off" />
              </Field>
              <Field label="Area / City">
                <input className={inputCls} value={profile.area} onChange={set("area")} placeholder="e.g. Dhanmondi, Dhaka" />
              </Field>
              <Field label="Full address">
                <input className={inputCls} value={profile.address} onChange={set("address")} placeholder="House, road, area, city" />
              </Field>
            </div>
          </Section>

          {/* Parent / Guardian */}
          <Section title="Parent / Guardian">
            <p className="-mt-2 mb-3 text-xs text-muted">
              Automatically emailed when you trigger an emergency SOS.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input className={inputCls} value={profile.guardianName} onChange={set("guardianName")} placeholder="e.g. Rahim Uddin" autoComplete="off" />
              </Field>
              <Field label="Email">
                <input type="email" className={inputCls} value={profile.guardianEmail} onChange={set("guardianEmail")} placeholder="guardian@example.com" autoComplete="off" />
              </Field>
              <Field label="Phone">
                <input className={inputCls} inputMode="tel" value={profile.guardianPhone} onChange={set("guardianPhone")} onBlur={formatPhone("guardianPhone")} placeholder="+880 1XXX-XXXXXX" autoComplete="off" />
              </Field>
              <Field label="Parent's National ID (NID)">
                <input className={inputCls} inputMode="numeric" value={profile.guardianNid} onChange={set("guardianNid")} placeholder="e.g. 1985123456789" autoComplete="off" />
              </Field>
            </div>
          </Section>

          {/* Vitals */}
          <Section title="Vitals">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Height (cm)">
                <input type="number" inputMode="decimal" className={inputCls} value={profile.heightCm} onChange={set("heightCm")} placeholder="170" />
              </Field>
              <Field label="Weight (kg)">
                <input type="number" inputMode="decimal" className={inputCls} value={profile.weightKg} onChange={set("weightKg")} placeholder="65" />
              </Field>
              <Field label="BMI">
                <div className={`${inputCls} flex items-center justify-between`}>
                  {bmi ? (
                    <>
                      <span className="font-semibold">{bmi.value}</span>
                      <span className="text-sm text-primary">{bmi.category}</span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </Field>
            </div>
          </Section>

          {/* Medical lists */}
          <Section title="Medical">
            <div className="space-y-4">
              <TagField label="Allergies" placeholder="e.g. Penicillin" value={profile.allergies}
                onChange={(v) => setProfile((p) => ({ ...p, allergies: v }))} />
              <TagField label="Chronic conditions" placeholder="e.g. Asthma" value={profile.conditions}
                onChange={(v) => setProfile((p) => ({ ...p, conditions: v }))} />
              <TagField label="Current medications" placeholder="e.g. Metformin 500mg" value={profile.medications}
                onChange={(v) => setProfile((p) => ({ ...p, medications: v }))} />
            </div>
          </Section>

          {/* Vaccinations */}
          <Section title="Vaccination tracker">
            <VaccinationManager
              items={profile.vaccinations}
              onChange={(v) => setProfile((p) => ({ ...p, vaccinations: v }))}
            />
          </Section>

          {/* Emergency contacts */}
          <Section title="Emergency contacts">
            <ContactManager contacts={contacts} onChange={setContacts} />
          </Section>

          {/* Free text */}
          <Section title="Notes & goals">
            <div className="space-y-4">
              <Field label="Family medical history">
                <textarea rows={3} className={inputCls} value={profile.familyHistory} onChange={set("familyHistory")} placeholder="e.g. Father — hypertension; Mother — diabetes" />
              </Field>
              <Field label="Health goals">
                <textarea rows={2} className={inputCls} value={profile.goals} onChange={set("goals")} placeholder="e.g. Lower blood pressure, walk 8k steps/day" />
              </Field>
            </div>
          </Section>
        </div>

        {/* ---------------- HEALTH CARD ---------------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="no-print mb-3 font-display text-lg font-semibold">🪪 Health Card</h2>
          <HealthCard profile={profile} contacts={contacts} userId={user?.id} />
          <VaccineReminders items={profile.vaccinations} />
        </div>
      </div>
    </div>
  );
}

/* ============== Reusable bits ============== */

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary/60";

function Section({ title, children }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function TagField({ label, placeholder, value, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="text-muted hover:text-emergency" aria-label={`Remove ${tag}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

function VaccinationManager({ items, onChange }) {
  const [form, setForm] = useState({ name: "", date: "", dueDate: "" });
  const add = () => {
    if (!form.name.trim()) return;
    onChange([...items, { ...form, name: form.name.trim() }]);
    setForm({ name: "", date: "", dueDate: "" });
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
        <input className={inputCls} placeholder="Vaccine (e.g. Tetanus)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="date" className={inputCls} title="Date given" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input type="date" className={inputCls} title="Next due" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <button type="button" onClick={add} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Add</button>
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((v, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{v.name}</span>
              <span className="text-muted">
                {v.date ? `Given ${v.date}` : "—"}
                {v.dueDate ? ` · Due ${v.dueDate}` : ""}
              </span>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted hover:text-emergency" aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactManager({ contacts, onChange }) {
  const [form, setForm] = useState({ name: "", relation: "", phone: "", email: "" });
  const add = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    onChange([
      ...contacts,
      { ...form, name: form.name.trim(), phone: normalizeBDPhone(form.phone), email: form.email.trim() },
    ]);
    setForm({ name: "", relation: "", phone: "", email: "" });
  };
  return (
    <div className="space-y-3">
      <p className="-mt-1 text-xs text-muted">
        Add an email to also notify this contact by email during an emergency SOS.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={inputCls} placeholder="Relation (e.g. Mother)" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
        <input className={inputCls} placeholder="Phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <div className="flex gap-2">
          <input type="email" className={inputCls} placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <button type="button" onClick={add} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Add</button>
        </div>
      </div>
      {contacts.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {contacts.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{c.name}</span>{" "}
                {c.relation && <span className="text-muted">({c.relation})</span>}
                {c.email && <span className="block truncate text-xs text-muted">{c.email}</span>}
              </span>
              <span className="shrink-0 text-primary">{c.phone}</span>
              <button type="button" onClick={() => onChange(contacts.filter((_, j) => j !== i))} className="shrink-0 text-muted hover:text-emergency" aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VaccineReminders({ items }) {
  const upcoming = items
    .filter((v) => v.dueDate)
    .map((v) => ({ ...v, days: daysUntil(v.dueDate) }))
    .filter((v) => v.days !== null && v.days <= 60)
    .sort((a, b) => a.days - b.days);

  if (upcoming.length === 0) return null;

  return (
    <div className="no-print mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <p className="font-semibold text-warning">💉 Upcoming vaccinations</p>
      <ul className="mt-2 space-y-1">
        {upcoming.map((v, i) => (
          <li key={i}>
            {v.name} —{" "}
            {v.days < 0 ? `overdue by ${-v.days}d` : v.days === 0 ? "due today" : `due in ${v.days}d`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function daysUntil(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (24 * 3600 * 1000));
}

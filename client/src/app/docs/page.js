"use client";

import { useState } from "react";
import { FileText, Pill, Plus, Trash2, Mail, ClipboardList, X } from "lucide-react";
import { KEYS, useLocalState } from "@/lib/storage";
import { prescriptionApi } from "@/lib/api";
import { useToast } from "@/lib/toast";

const WHEN = ["Morning", "Noon", "Afternoon", "Evening", "Night", "Bedtime"];
const MEAL = ["Before meal", "After meal", "With meal", "Empty stomach"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);

export default function DocsPage() {
  const [tab, setTab] = useState("prescriptions");
  const [prescriptions, setPrescriptions, hydrated] = useLocalState(KEYS.prescriptions, []);
  const [history, setHistory] = useLocalState(KEYS.medHistory, []);
  const { push } = useToast();

  const addToHistory = (presc) => {
    const entry = {
      id: uid(),
      date: today(),
      problems: "",
      solutions: presc.title ? `Prescribed: ${presc.title}` : "Prescription",
      prescriptionId: presc.id,
      createdAt: new Date().toISOString(),
    };
    setHistory((h) => [entry, ...h]);
    setTab("history");
    push({ variant: "success", title: "Added to history", body: "Edit the problem & details in History." });
  };

  if (!hydrated)
    return <div className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FileText className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">Docs</h1>
          <p className="text-muted">Prescriptions & medical history — saved to your account.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 inline-flex rounded-xl border border-border bg-surface p-1">
        <TabBtn active={tab === "prescriptions"} onClick={() => setTab("prescriptions")} icon={Pill}>
          Prescriptions
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={ClipboardList}>
          History
        </TabBtn>
      </div>

      <div className="mt-6">
        {tab === "prescriptions" ? (
          <Prescriptions
            prescriptions={prescriptions}
            setPrescriptions={setPrescriptions}
            onAddToHistory={addToHistory}
            push={push}
          />
        ) : (
          <History
            history={history}
            setHistory={setHistory}
            prescriptions={prescriptions}
          />
        )}
      </div>
    </div>
  );
}

/* ================= PRESCRIPTIONS ================= */

function Prescriptions({ prescriptions, setPrescriptions, onAddToHistory, push }) {
  const [form, setForm] = useState({ title: "", date: today(), notes: "" });
  const [meds, setMeds] = useState([]);
  const [med, setMed] = useState({ name: "", dose: "", when: WHEN[0], meal: MEAL[1], time: "" });
  const [emailing, setEmailing] = useState(null);

  const addMed = () => {
    if (!med.name.trim()) return;
    setMeds((m) => [...m, { ...med, id: uid(), name: med.name.trim() }]);
    setMed({ name: "", dose: "", when: WHEN[0], meal: MEAL[1], time: "" });
  };

  const savePrescription = () => {
    if (!form.title.trim() && meds.length === 0) return;
    const presc = {
      id: uid(),
      title: form.title.trim() || "Prescription",
      date: form.date,
      notes: form.notes.trim(),
      medicines: meds,
      createdAt: new Date().toISOString(),
    };
    setPrescriptions((p) => [presc, ...p]);
    setForm({ title: "", date: today(), notes: "" });
    setMeds([]);
    push({ variant: "success", title: "Prescription saved", body: presc.title });
  };

  const remove = (id) => setPrescriptions((p) => p.filter((x) => x.id !== id));

  const emailPrescription = async (presc) => {
    setEmailing(presc.id);
    try {
      const { to } = await prescriptionApi.email(presc);
      push({ variant: "success", title: "Schedule emailed", body: `Sent to ${to}` });
    } catch (e) {
      push({ variant: "emergency", title: "Couldn’t email", body: e?.message || "Try again later." });
    } finally {
      setEmailing(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* New prescription */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">New prescription</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title / body">
            <input className={inp} placeholder="e.g. Fever — Dr. Karim" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" className={inp} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes (optional)" className="mt-3">
          <textarea rows={2} className={inp} placeholder="Advice, diagnosis, dosage notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>

        {/* Add medicine */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-semibold">Add medicine</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inp} placeholder="Medicine name" value={med.name} onChange={(e) => setMed({ ...med, name: e.target.value })} />
            <input className={inp} placeholder="How much (e.g. 1 tablet, 5ml)" value={med.dose} onChange={(e) => setMed({ ...med, dose: e.target.value })} />
            <select className={inp} value={med.when} onChange={(e) => setMed({ ...med, when: e.target.value })}>
              {WHEN.map((w) => <option key={w}>{w}</option>)}
            </select>
            <select className={inp} value={med.meal} onChange={(e) => setMed({ ...med, meal: e.target.value })}>
              {MEAL.map((m) => <option key={m}>{m}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted">
              Reminder time
              <input type="time" className={`${inp} flex-1`} value={med.time} onChange={(e) => setMed({ ...med, time: e.target.value })} />
            </label>
            <button type="button" onClick={addMed} className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Add medicine
            </button>
          </div>

          {meds.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {meds.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <Pill className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                    <b>{m.name}</b> {m.dose && <span className="text-muted">· {m.dose}</span>}
                    <span className="block text-xs text-muted">{[m.when, m.meal, m.time].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button type="button" onClick={() => setMeds((x) => x.filter((y) => y.id !== m.id))} className="text-muted hover:text-emergency" aria-label="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" onClick={savePrescription} className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
          Save prescription
        </button>
      </section>

      {/* Saved prescriptions */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Saved prescriptions</h2>
        {prescriptions.length === 0 ? (
          <p className="glass rounded-2xl p-5 text-sm text-muted">No prescriptions yet. Create one on the left.</p>
        ) : (
          <ul className="space-y-3">
            {prescriptions.map((p) => (
              <li key={p.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-semibold">{p.title}</p>
                    <p className="text-xs text-muted">{p.date} · {p.medicines.length} medicine{p.medicines.length === 1 ? "" : "s"}</p>
                  </div>
                  <button type="button" onClick={() => remove(p.id)} className="text-muted hover:text-emergency" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {p.medicines.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {p.medicines.map((m) => (
                      <li key={m.id} className="text-muted">
                        <b className="text-text">{m.name}</b> {m.dose && `· ${m.dose}`} {(m.when || m.time) && `— ${[m.when, m.meal, m.time].filter(Boolean).join(", ")}`}
                      </li>
                    ))}
                  </ul>
                )}
                {p.notes && <p className="mt-2 text-xs text-muted">📝 {p.notes}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => emailPrescription(p)} disabled={emailing === p.id} className="flex items-center gap-1.5 rounded-lg bg-info px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                    <Mail className="h-3.5 w-3.5" /> {emailing === p.id ? "Sending…" : "Email schedule"}
                  </button>
                  <button type="button" onClick={() => onAddToHistory(p)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50">
                    <ClipboardList className="h-3.5 w-3.5" /> Add to history
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ================= HISTORY ================= */

function History({ history, setHistory, prescriptions }) {
  const [form, setForm] = useState({ date: today(), problems: "", solutions: "", prescriptionId: "" });

  const add = () => {
    if (!form.problems.trim() && !form.solutions.trim()) return;
    setHistory((h) => [{ id: uid(), ...form, createdAt: new Date().toISOString() }, ...h]);
    setForm({ date: today(), problems: "", solutions: "", prescriptionId: "" });
  };

  const remove = (id) => setHistory((h) => h.filter((x) => x.id !== id));
  const prescById = (id) => prescriptions.find((p) => p.id === id);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* New history entry */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Add to history</h2>
        <Field label="Date">
          <input type="date" className={inp} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Problem" className="mt-3">
          <textarea rows={2} className={inp} placeholder="e.g. High fever, body ache for 3 days" value={form.problems} onChange={(e) => setForm({ ...form, problems: e.target.value })} />
        </Field>
        <Field label="Solution / notes" className="mt-3">
          <textarea rows={2} className={inp} placeholder="e.g. Rest, fluids, paracetamol" value={form.solutions} onChange={(e) => setForm({ ...form, solutions: e.target.value })} />
        </Field>
        <Field label="Link a prescription" className="mt-3">
          <select className={inp} value={form.prescriptionId} onChange={(e) => setForm({ ...form, prescriptionId: e.target.value })}>
            <option value="">None</option>
            {prescriptions.map((p) => (
              <option key={p.id} value={p.id}>{p.title} ({p.date})</option>
            ))}
          </select>
        </Field>
        <button type="button" onClick={add} className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
          Save entry
        </button>
      </section>

      {/* Timeline */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Medical history</h2>
        {history.length === 0 ? (
          <p className="glass rounded-2xl p-5 text-sm text-muted">No history yet. Add an entry on the left, or “Add to history” from a prescription.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => {
              const presc = prescById(h.prescriptionId);
              return (
                <li key={h.id} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-primary">{h.date}</p>
                    <button type="button" onClick={() => remove(h.id)} className="text-muted hover:text-emergency" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {h.problems && <p className="mt-1 text-sm"><span className="text-muted">Problem:</span> {h.problems}</p>}
                  {h.solutions && <p className="mt-0.5 text-sm"><span className="text-muted">Solution:</span> {h.solutions}</p>}
                  {presc && (
                    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                      <p className="flex items-center gap-1.5 font-semibold text-primary"><Pill className="h-3.5 w-3.5" /> {presc.title}</p>
                      <ul className="mt-1 space-y-0.5 text-muted">
                        {presc.medicines.map((m) => (
                          <li key={m.id}><b className="text-text">{m.name}</b> {m.dose && `· ${m.dose}`} {(m.when || m.time) && `— ${[m.when, m.meal, m.time].filter(Boolean).join(", ")}`}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ================= bits ================= */

const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60";

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-primary text-white" : "text-muted hover:text-text"
      }`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

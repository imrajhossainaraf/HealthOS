"use client";

import { useEffect, useRef, useState } from "react";
import { KEYS, useLocalState, calcBMI } from "@/lib/storage";
import { HERBS } from "@/lib/herbs";
import { aiApi } from "@/lib/api";

// One agent for everything — these just seed an empty conversation.
const SUGGESTIONS = [
  { icon: "🚨", text: "What do I do if someone is choking?" },
  { icon: "🩹", text: "First aid for a deep cut that won't stop bleeding" },
  { icon: "🌿", text: "Health benefits and uses of turmeric" },
  { icon: "💪", text: "Build me a beginner plan to lose weight" },
  { icon: "🩺", text: "Summarize my health profile" },
  { icon: "🤒", text: "I have a fever and body aches — what helps?" },
];

export default function AIAssistantPage() {
  const [profile] = useLocalState(KEYS.profile, {});
  const [messages, setMessages] = useLocalState(KEYS.profile + ":agent", []);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const scrollRef = useRef(null);

  // Learn whether a live model is configured (else rule-based fallback).
  useEffect(() => {
    let alive = true;
    aiApi
      .status()
      .then((s) => alive && setAiOn(Boolean(s?.enabled)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Pin the transcript to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || sending) return;
    setInput("");

    const withUser = [...messages, { role: "user", text: q }];
    setMessages(withUser);
    setSending(true);

    let reply;
    try {
      if (aiOn) {
        const res = await aiApi.chat({ copilot: "assistant", messages: withUser.slice(-20), profile });
        reply = res?.reply?.trim();
      }
    } catch {
      reply = null; // any AI failure → built-in engine below
    }
    if (!reply) reply = respond(q, profile);

    setMessages((m) => [...m, { role: "bot", text: reply }]);
    setSending(false);
  };

  const clear = () => setMessages([]);
  const empty = messages.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="glass flex h-[calc(100vh-7rem)] max-h-[820px] min-h-[480px] flex-col overflow-hidden rounded-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-lg text-primary ring-1 ring-primary/30">
            ✚
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-base font-bold sm:text-lg">HealthOS Agent</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  aiOn ? "bg-success/10 text-success" : "bg-surface-2 text-muted"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${aiOn ? "bg-success" : "bg-muted"}`} />
                {aiOn ? "Live AI" : "Offline"}
              </span>
            </div>
            <p className="truncate text-xs text-muted">First aid · herbal · fitness · your health — all in one</p>
          </div>
          {!empty && (
            <button
              type="button"
              onClick={clear}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-emergency/50 hover:text-emergency"
            >
              Clear
            </button>
          )}
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-2xl text-primary">✚</span>
              <h2 className="mt-3 font-display text-xl font-bold">How can I help you today?</h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                Ask me about first aid &amp; emergencies, herbal remedies, fitness plans, or your own health profile.
              </p>
              <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => send(s.text)}
                    className="glass-hover flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm hover:border-primary/40"
                  >
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-text">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)
          )}

          {sending && (
            <div className="flex items-end gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs text-primary">✚</span>
              <span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-surface px-3 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
              </span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border px-3 py-3 sm:px-4">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              disabled={sending}
              placeholder={sending ? "Thinking…" : "Message HealthOS Agent…"}
              className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-white transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-40"
            >
              ➤
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">
            ⚠️ General guidance only — not a substitute for a doctor. In an emergency, call 999.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Message bubble (renders **bold** + line breaks) ---------- */
function Bubble({ role, text }) {
  const isUser = role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${
          isUser ? "bg-surface-2 text-muted" : "bg-primary/15 text-primary"
        }`}
      >
        {isUser ? "🧑" : "✚"}
      </span>
      <span
        className={`inline-block max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm border border-border bg-surface"
        }`}
      >
        {renderRich(text)}
      </span>
    </div>
  );
}

// Lightweight inline formatter: bolds **segments**, keeps everything else as-is.
function renderRich(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
}

/* ---------- Offline rule-based fallback (one cascade over all domains) ---------- */
function respond(q, profile) {
  const t = q.toLowerCase();

  // 1) Emergencies first.
  if (t.includes("chok")) return "Choking:\n1. Encourage coughing.\n2. 5 back blows between the shoulder blades.\n3. 5 abdominal thrusts (Heimlich).\n4. Alternate until cleared.\nIf they go unconscious, start CPR and call 999.";
  if (t.includes("chest") || (t.includes("heart") && t.includes("attack"))) return "Possible heart attack:\n1. Call 999 now.\n2. Have them sit and rest.\n3. Loosen tight clothing.\n4. Chew one 300mg aspirin if not allergic.\n5. Start CPR if unresponsive.";
  if (t.includes("bleed")) return "Severe bleeding:\n1. Firm direct pressure with a clean cloth.\n2. Keep pressure; add layers, don't remove soaked ones.\n3. Elevate the limb if possible.\n4. Call 999.";
  if (t.includes("burn")) return "Burns:\n1. Cool under running water for 20 min.\n2. Remove tight items near the area early.\n3. Cover loosely with a clean non-stick dressing.\n4. No ice, butter, or toothpaste.";
  if (t.includes("stroke")) return "Stroke — think FAST: Face drooping, Arm weakness, Speech slurred → Time to call 999 now. Note when symptoms started; nothing to eat or drink.";

  // 2) Herbal.
  const herb = HERBS.find((h) => t.includes(h.name.toLowerCase()) || h.localNames.some((n) => t.includes(n.toLowerCase())));
  if (herb) return `${herb.name} (${herb.scientific}):\nUses: ${herb.uses.join(", ")}.\nPreparation: ${herb.preparation.join(", ")}.\nSafety: ${herb.warnings || "No major warnings recorded."}`;

  // 3) Fitness.
  if (t.includes("bmi")) {
    const bmi = calcBMI(profile.heightCm, profile.weightKg);
    return bmi ? `Your BMI is ${bmi.value} (${bmi.category}), based on your profile vitals.` : "Add your height and weight in your profile and I can calculate your BMI.";
  }
  if (t.includes("lose") || t.includes("weight loss") || t.includes("fat")) return "Weight-loss starter plan:\n• ~500 kcal/day deficit\n• 30 min brisk walk/cardio, 5x/week\n• Higher protein, fewer refined carbs & sugary drinks\n• 8k+ steps daily\nCheck with a doctor first if you have any heart condition.";
  if (t.includes("muscle") || t.includes("gain")) return "Muscle building:\n• Progressive resistance training, 4x/week\n• 1.6–2g protein/kg bodyweight\n• Slight calorie surplus\n• 48h rest per muscle group";
  if (t.includes("endur")) return "Endurance plan:\n• Zone-2 cardio 40–60 min, 3x/week\n• 1–2 interval sessions\n• Carb-focused fuel + good hydration";

  // 4) General health / profile.
  if (t.includes("profile") || t.includes("summar")) {
    const bmi = calcBMI(profile.heightCm, profile.weightKg);
    return `Profile summary:\nName: ${profile.name || "—"}\nBlood group: ${profile.bloodGroup || "—"}\nBMI: ${bmi ? `${bmi.value} (${bmi.category})` : "—"}\nAllergies: ${(profile.allergies || []).join(", ") || "none"}\nConditions: ${(profile.conditions || []).join(", ") || "none"}`;
  }
  if (t.includes("allerg")) return (profile.allergies || []).length ? `Your recorded allergies: ${profile.allergies.join(", ")}. Always inform medical staff.` : "No allergies recorded in your profile yet.";
  if (t.includes("blood")) return profile.bloodGroup ? `Your blood group is ${profile.bloodGroup}. Keep it on your emergency card.` : "Set your blood group in your profile so it appears on your emergency card.";
  if (t.includes("fever")) return "Mild fever at home:\n• Rest and sip fluids often (ORS / খাবার স্যালাইন helps).\n• Paracetamol per label if needed.\n• Light clothing, cool room.\nSeek care for fever >3 days, very high temp, rash, breathing trouble, or in infants.";

  return "I can help with first aid & emergencies, herbal remedies, fitness plans, or your health profile. What would you like to know? For anything life-threatening, call 999 right away.";
}

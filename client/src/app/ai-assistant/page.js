"use client";

import { useState } from "react";
import { KEYS, useLocalState, calcBMI } from "@/lib/storage";
import { HERBS } from "@/lib/herbs";

const COPILOTS = {
  emergency: {
    icon: "🚨",
    name: "Emergency Copilot",
    accent: "text-emergency",
    intro: "Stay calm. Tell me what's happening and I'll guide you step by step. For life-threatening situations, call emergency services now.",
    chips: ["Someone is choking", "Chest pain", "Severe bleeding", "Burn"],
  },
  herbal: {
    icon: "🌿",
    name: "Herbal Copilot",
    accent: "text-herbal",
    intro: "Ask me about a herb and I'll share traditional uses, preparation, and safety notes from the knowledge base.",
    chips: ["Tell me about ginger", "Herbs for digestion", "Turmeric uses", "Neem"],
  },
  fitness: {
    icon: "💪",
    name: "Fitness Copilot",
    accent: "text-success",
    intro: "Tell me your goal and I'll suggest a plan. I can use your profile vitals too.",
    chips: ["Plan to lose weight", "Build muscle", "Improve endurance", "My BMI"],
  },
  health: {
    icon: "🩺",
    name: "Health Copilot",
    accent: "text-primary",
    intro: "I use your saved profile to give general guidance. I'm not a substitute for a doctor.",
    chips: ["Summarize my profile", "My allergies", "Blood group info", "Vaccination status"],
  },
};

export default function AIAssistantPage() {
  const [active, setActive] = useState("emergency");
  const [profile] = useLocalState(KEYS.profile, {});
  const [convos, setConvos] = useLocalState(KEYS.profile + ":copilot", {});
  const [input, setInput] = useState("");

  const messages = convos[active] || [];

  const send = (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    const reply = respond(active, q, profile);
    setConvos((c) => ({
      ...c,
      [active]: [...(c[active] || []), { role: "user", text: q }, { role: "bot", text: reply }],
    }));
    setInput("");
  };

  const clear = () => setConvos((c) => ({ ...c, [active]: [] }));

  const co = COPILOTS[active];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">AI Health Copilot</h1>
      <p className="mt-1 text-muted">Four specialists — pick the one you need.</p>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {Object.entries(COPILOTS).map(([key, c]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              active === key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted hover:text-text"
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="glass mt-4 rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className={`font-display font-semibold ${co.accent}`}>{co.icon} {co.name}</span>
          {messages.length > 0 && (
            <button type="button" onClick={clear} className="text-xs text-muted hover:text-emergency">Clear</button>
          )}
        </div>

        <div className="max-h-[40vh] min-h-[8rem] space-y-3 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">{co.intro}</p>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span
                  className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-primary text-white" : "border border-border bg-surface"
                  }`}
                >
                  {m.text}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Suggestion chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {co.chips.map((chip) => (
            <button key={chip} type="button" onClick={() => send(chip)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs hover:border-primary/50">
              {chip}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type your question…"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => send()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Send</button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        ⚠️ Informational guidance only. Always consult a qualified healthcare provider. In an emergency, call local services.
      </p>
    </div>
  );
}

/* ---------- Rule-based response engine ---------- */
function respond(copilot, q, profile) {
  const t = q.toLowerCase();

  if (copilot === "emergency") {
    if (t.includes("chok")) return "Choking:\n1. Encourage coughing.\n2. 5 back blows between shoulder blades.\n3. 5 abdominal thrusts (Heimlich).\n4. Alternate until cleared.\nIf they go unconscious, start CPR and call emergency services.";
    if (t.includes("chest") || t.includes("heart")) return "Possible heart attack:\n1. Call emergency services now.\n2. Have them sit and rest.\n3. Loosen tight clothing.\n4. Aspirin if prescribed.\n5. Start CPR if unresponsive.";
    if (t.includes("bleed") || t.includes("bleed")) return "Severe bleeding:\n1. Apply firm direct pressure with a clean cloth.\n2. Keep pressure; add layers, don't remove.\n3. Elevate the limb if possible.\n4. Call emergency services.";
    if (t.includes("burn")) return "Burns:\n1. Cool under running water 20 min.\n2. Remove tight items near the area.\n3. Cover loosely with non-stick dressing.\n4. Don't apply ice or butter.";
    return "Tell me the emergency (choking, chest pain, bleeding, burn…). If life-threatening, call emergency services immediately.";
  }

  if (copilot === "herbal") {
    const found = HERBS.find((h) => t.includes(h.name.toLowerCase()) || h.localNames.some((n) => t.includes(n.toLowerCase())));
    if (found) {
      return `${found.name} (${found.scientific}):\nUses: ${found.uses.join(", ")}.\nPreparation: ${found.preparation.join(", ")}.\nSafety: ${found.warnings || "No major warnings recorded."}`;
    }
    const byUse = HERBS.filter((h) => h.uses.some((u) => t.includes(u.toLowerCase().split(" ")[0])) || h.category.toLowerCase().includes(t.replace("herbs for ", "").trim()));
    if (byUse.length) return `Herbs that may help: ${byUse.map((h) => h.name).join(", ")}. Ask me about any one for details.`;
    return "I can look up herbs in our knowledge base — try a name like ginger, turmeric, neem, or tulsi.";
  }

  if (copilot === "fitness") {
    const bmi = calcBMI(profile.heightCm, profile.weightKg);
    if (t.includes("bmi")) return bmi ? `Your BMI is ${bmi.value} (${bmi.category}), based on your profile vitals.` : "Add your height and weight in your profile and I can calculate your BMI.";
    if (t.includes("lose") || t.includes("fat")) return "Weight loss plan:\n• ~500 kcal/day deficit\n• 30 min cardio, 5x/week\n• High protein, lower refined carbs\n• 8k+ steps daily";
    if (t.includes("muscle") || t.includes("gain")) return "Muscle building:\n• Progressive overload lifting, 4x/week\n• 1.6–2g protein/kg bodyweight\n• Slight calorie surplus\n• 48h rest per muscle group";
    if (t.includes("endur")) return "Endurance plan:\n• Zone 2 cardio 40–60 min\n• Intervals 2x/week\n• Carb-focused fuel + hydration";
    return "Tell me your goal — lose weight, build muscle, or endurance — and I'll build a plan.";
  }

  // health copilot
  if (t.includes("profile") || t.includes("summar")) {
    const bmi = calcBMI(profile.heightCm, profile.weightKg);
    return `Profile summary:\nName: ${profile.name || "—"}\nBlood group: ${profile.bloodGroup || "—"}\nBMI: ${bmi ? `${bmi.value} (${bmi.category})` : "—"}\nAllergies: ${(profile.allergies || []).join(", ") || "none"}\nConditions: ${(profile.conditions || []).join(", ") || "none"}`;
  }
  if (t.includes("allerg")) return (profile.allergies || []).length ? `Your recorded allergies: ${profile.allergies.join(", ")}. Always inform medical staff.` : "No allergies recorded in your profile yet.";
  if (t.includes("blood")) return profile.bloodGroup ? `Your blood group is ${profile.bloodGroup}. Keep it on your emergency card.` : "Set your blood group in your profile so it appears on your emergency card.";
  if (t.includes("vaccin")) return (profile.vaccinations || []).length ? `You have ${profile.vaccinations.length} vaccination record(s). Check the profile page for due dates.` : "No vaccinations recorded yet — add them in your profile.";
  return "I can summarize your profile, allergies, blood group, or vaccination status. What would you like to know?";
}

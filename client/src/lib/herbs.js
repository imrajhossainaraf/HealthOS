// Seed herbal knowledge base (Phase 1 static data).

export const CATEGORIES = [
  "Digestive",
  "Respiratory",
  "Skin",
  "Immune",
  "Nutrition",
  "Wellness",
];

export const EVIDENCE_LEVELS = ["Traditional", "Researched", "Clinically Studied"];

export const SEVERITY = {
  High: { label: "High", dot: "🔴", color: "text-emergency" },
  Moderate: { label: "Moderate", dot: "🟠", color: "text-warning" },
  Medium: { label: "Medium", dot: "🟡", color: "text-warning" },
  Low: { label: "Low", dot: "🟢", color: "text-success" },
};

export const HERBS = [
  {
    id: "ginger",
    name: "Ginger",
    scientific: "Zingiber officinale",
    localNames: ["Ada", "Adrak"],
    category: "Digestive",
    evidence: "Clinically Studied",
    uses: ["Nausea relief", "Digestion", "Anti-inflammatory"],
    preparation: ["Tea", "Raw", "Powder", "Extract"],
    warnings: "May increase bleeding risk with anticoagulants. Avoid high doses in pregnancy.",
    related: ["turmeric", "garlic"],
    interactions: [
      { with: "Blood Thinners (Warfarin)", effect: "Increases bleeding risk", severity: "High" },
    ],
  },
  {
    id: "turmeric",
    name: "Turmeric",
    scientific: "Curcuma longa",
    localNames: ["Holud", "Haldi"],
    category: "Immune",
    evidence: "Clinically Studied",
    uses: ["Anti-inflammatory", "Joint health", "Antioxidant"],
    preparation: ["Powder", "Tea", "Extract", "Oil"],
    warnings: "High doses may upset stomach and enhance anticoagulant effects.",
    related: ["ginger"],
    interactions: [
      { with: "Anticoagulants", effect: "May enhance anticoagulant effect", severity: "Medium" },
    ],
  },
  {
    id: "garlic",
    name: "Garlic",
    scientific: "Allium sativum",
    localNames: ["Roshun", "Lehsun"],
    category: "Immune",
    evidence: "Researched",
    uses: ["Heart health", "Immune support", "Antimicrobial"],
    preparation: ["Raw", "Extract", "Powder"],
    warnings: "Can enhance blood-sugar-lowering and blood-thinning effects.",
    related: ["ginger"],
    interactions: [
      { with: "Diabetes Medication", effect: "Enhances blood sugar lowering", severity: "Medium" },
    ],
  },
  {
    id: "stjohnswort",
    name: "St. John's Wort",
    scientific: "Hypericum perforatum",
    localNames: ["Balsana"],
    category: "Wellness",
    evidence: "Clinically Studied",
    uses: ["Mood support", "Mild depression"],
    preparation: ["Tea", "Extract", "Capsule"],
    warnings: "Interacts with many drugs including antidepressants and contraceptives.",
    related: [],
    interactions: [
      { with: "Antidepressants (SSRIs)", effect: "Serotonin syndrome risk", severity: "High" },
    ],
  },
  {
    id: "ginseng",
    name: "Ginseng",
    scientific: "Panax ginseng",
    localNames: ["Insam"],
    category: "Wellness",
    evidence: "Researched",
    uses: ["Energy", "Focus", "Stress resilience"],
    preparation: ["Tea", "Extract", "Powder"],
    warnings: "May raise heart rate when combined with stimulants.",
    related: [],
    interactions: [
      { with: "Stimulants / Caffeine", effect: "Increased heart rate", severity: "Moderate" },
    ],
  },
  {
    id: "neem",
    name: "Neem",
    scientific: "Azadirachta indica",
    localNames: ["Nim", "Nimtree", "Nimba"],
    category: "Skin",
    evidence: "Traditional",
    uses: ["Skin conditions", "Antibacterial", "Oral care"],
    preparation: ["Poultice", "Oil", "Powder", "Tea"],
    warnings: "Not recommended during pregnancy. Avoid prolonged internal use.",
    related: ["tulsi"],
    interactions: [],
  },
  {
    id: "tulsi",
    name: "Tulsi (Holy Basil)",
    scientific: "Ocimum sanctum",
    localNames: ["Tulshi"],
    category: "Respiratory",
    evidence: "Researched",
    uses: ["Cough & cold", "Stress relief", "Respiratory support"],
    preparation: ["Tea", "Raw", "Extract"],
    warnings: "May lower blood sugar; monitor if diabetic.",
    related: ["neem"],
    interactions: [
      { with: "Diabetes Medication", effect: "Additive blood sugar lowering", severity: "Low" },
    ],
  },
  {
    id: "aloevera",
    name: "Aloe Vera",
    scientific: "Aloe barbadensis",
    localNames: ["Ghritkumari"],
    category: "Skin",
    evidence: "Researched",
    uses: ["Burns & wounds", "Skin hydration", "Digestive (juice)"],
    preparation: ["Raw", "Extract", "Oil"],
    warnings: "Oral latex can cause cramping; avoid in pregnancy.",
    related: [],
    interactions: [],
  },
];

/** Cross-reference selected herbs + typed medications, return matching conflicts. */
export function checkInteractions(herbIds, medicationText) {
  const meds = medicationText
    .split(/[,\n]/)
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  const results = [];
  HERBS.filter((h) => herbIds.includes(h.id)).forEach((h) => {
    h.interactions.forEach((it) => {
      const target = it.with.toLowerCase();
      const matched = meds.some(
        (m) => target.includes(m) || m.includes(target.split(" (")[0])
      );
      // Surface every interaction for a selected herb; flag those matching a typed med.
      results.push({ herb: h.name, ...it, matchedMed: matched });
    });
  });
  // Matched + higher severity first.
  const order = { High: 0, Moderate: 1, Medium: 2, Low: 3 };
  return results.sort(
    (a, b) =>
      Number(b.matchedMed) - Number(a.matchedMed) ||
      order[a.severity] - order[b.severity]
  );
}

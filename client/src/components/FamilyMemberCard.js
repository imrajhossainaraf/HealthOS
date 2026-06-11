"use client";

const RISK_COLOR = {
  Low: "text-success border-success/40 bg-success/10",
  Medium: "text-warning border-warning/40 bg-warning/10",
  High: "text-emergency border-emergency/40 bg-emergency/10",
};

const RELATION_ICON = {
  Parent: "👨‍👩‍👧",
  Child: "👦",
  Spouse: "💑",
  Other: "🧑",
};

export default function FamilyMemberCard({ member, onSelect, onRemove, selected }) {
  const risk = member.risk || "Low";
  return (
    // The whole card is clickable to open the member's health card.
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={`glass glass-hover cursor-pointer rounded-2xl p-4 transition-colors ${
        selected ? "border-primary/60 ring-1 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 text-left">
          <span className="text-2xl">{RELATION_ICON[member.relation] || "🧑"}</span>
          <div>
            <p className="font-display font-semibold">{member.name}</p>
            <p className="text-xs text-muted">
              {member.relation}
              {member.bloodGroup ? ` · ${member.bloodGroup}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="text-muted hover:text-emergency"
          aria-label="Remove member"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${RISK_COLOR[risk]}`}>
          {risk} risk
        </span>
        {member.alert && (
          <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs text-warning">
            {member.alert}
          </span>
        )}
      </div>

      {member.conditions?.length > 0 && (
        <p className="mt-2 text-xs text-muted">Conditions: {member.conditions.join(", ")}</p>
      )}
    </div>
  );
}

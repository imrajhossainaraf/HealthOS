"use client";

import { getTier } from "@/lib/storage";

/**
 * Shows the current reputation tier, points, and progress to the next tier.
 * `compact` renders a single inline chip (for navbar/dashboard).
 */
export default function ReputationBadge({ points = 0, compact = false }) {
  const tier = getTier(points);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm">
        <span>{tier.icon}</span>
        <span className="font-medium">{tier.name}</span>
        <span className="text-muted">· {points} pts</span>
      </span>
    );
  }

  const span = tier.next ? tier.next - tier.min : 1;
  const progress = tier.next
    ? Math.min(100, Math.round(((points - tier.min) / span) * 100))
    : 100;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{tier.icon}</span>
        <div>
          <p className="font-display text-lg font-bold">{tier.name}</p>
          <p className="text-sm text-muted">{points} reputation points</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {tier.next ? `${tier.next - points} pts to next tier` : "Top tier reached 🎉"}
      </p>
    </div>
  );
}

"use client";

import { useBeaconContext } from "@/lib/beacon";
import { useLocation } from "@/lib/location";
import { useAuth } from "@/lib/auth";
import { distanceKm } from "@/lib/geo";

/**
 * Live list of active network SOS alerts with Respond + Map actions. Pulls from
 * the shared beacon context, so every place it's rendered (Alerts page,
 * Emergency page) stays in sync in real time — responding on one updates all.
 */
export default function NetworkAlerts({
  limit = 20,
  emptyText = "No active emergencies right now. When anyone in the network sends an SOS, it appears here for everyone.",
}) {
  const { recentAlerts, respond } = useBeaconContext();
  const { coords } = useLocation();
  const { user } = useAuth();

  if (!recentAlerts.length) {
    return <p className="glass rounded-2xl p-4 text-sm text-muted">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {recentAlerts.slice(0, limit).map((a) => {
        const where =
          coords && typeof a.lat === "number"
            ? `${distanceKm([coords.lat, coords.lng], [a.lat, a.lng]).toFixed(1)} km away`
            : a.area || "location not shared";
        const responders = a.responders || [];
        const responded = responders.length > 0;
        const iResponded = responders.some((r) => r.email === user?.email?.toLowerCase());
        return (
          <li
            key={a.id || a.createdAt}
            className={`glass flex flex-col gap-2 rounded-2xl border p-4 transition-colors ${
              responded ? "border-success/60 bg-success/10" : "border-emergency/30"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  <span className={responded ? "text-success" : "text-emergency"}>
                    {responded ? "✅" : "🚨"} {a.victim}
                  </span>{" "}
                  — {a.reason}
                </p>
                <p className="text-xs text-muted">{where} · {timeAgo(a.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {a.id && !iResponded && (
                  <button
                    type="button"
                    onClick={() => respond(a.id)}
                    className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Respond
                  </button>
                )}
                {typeof a.lat === "number" && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=15/${a.lat}/${a.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-emergency px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    🗺 Map
                  </a>
                )}
              </div>
            </div>
            {responded && (
              <p className="text-xs font-medium text-success">
                🟢 {responders.length} responding — {responders.map((r) => r.email).join(", ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function timeAgo(iso) {
  if (!iso) return "just now";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

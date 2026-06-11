"use client";

import NetworkAlerts from "@/components/NetworkAlerts";
import MapView from "@/components/MapView";
import { useBeaconContext } from "@/lib/beacon";
import { useLocation } from "@/lib/location";

/**
 * Active Alerts — a dedicated, network-wide view of every live SOS. Shares the
 * beacon context with the Emergency page, so Respond actions and responder
 * status sync instantly between the two.
 */
export default function AlertsPage() {
  const { recentAlerts, connected } = useBeaconContext();
  const { coords, center } = useLocation();

  const withCoords = recentAlerts.filter((a) => typeof a.lat === "number");
  const markers = withCoords.map((a) => ({
    lat: a.lat,
    lng: a.lng,
    size: 11,
    color: a.responders?.length ? "#059669" : "emergency",
    popup: `🚨 ${a.victim} — ${a.reason}`,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold">🚨 Active Alerts</h1>
          <p className="mt-1 text-muted">
            Live emergencies across the network. Tap <b>Respond</b> to let them know help is coming.
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-sm ${connected ? "text-success" : "text-muted"}`}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: connected ? "#059669" : "#64748b" }} />
          {connected ? "Live" : "Offline"}
        </span>
      </div>

      {/* Map of all active alerts */}
      <section className="mt-6 overflow-hidden rounded-2xl">
        <MapView you={coords} center={center} markers={markers} height="320px" />
      </section>

      {/* Live list with Respond + Map */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">In the last 6 hours</h2>
          <span className="text-xs text-muted">{recentAlerts.length} active</span>
        </div>
        <NetworkAlerts limit={50} />
      </section>
    </div>
  );
}

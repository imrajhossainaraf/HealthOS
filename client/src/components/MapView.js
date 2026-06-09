"use client";

import dynamic from "next/dynamic";

const loading = () => (
  <div
    className="grid place-items-center rounded-2xl border border-border bg-surface text-sm text-muted"
    style={{ height: 360 }}
  >
    Loading map…
  </div>
);

// Both renderers touch `window` at import, so load them client-side only.
const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading });
const GoogleMapView = dynamic(() => import("./GoogleMapView"), { ssr: false, loading });

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Unified map. Uses Google Maps when an API key is configured
 * (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), otherwise falls back to OpenStreetMap/Leaflet.
 */
export default function MapView(props) {
  if (GOOGLE_KEY) return <GoogleMapView apiKey={GOOGLE_KEY} {...props} />;
  return <LeafletMap {...props} />;
}

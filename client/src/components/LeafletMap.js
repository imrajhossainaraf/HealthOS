"use client";

import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

const COLORS = {
  emergency: "#e11d48",
  primary: "#0d9488",
  info: "#2563eb",
  warning: "#b45309",
  family: "#7c3aed",
  herbal: "#15803d",
  muted: "#64748b",
};

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

/**
 * Reusable Leaflet map. Renders only on the client (loaded via dynamic import).
 * @param markers [{ lat, lng, color, label, popup, radius }]
 * @param you { lat, lng } current user location (rendered as a pulsing teal dot)
 * @param radiusMeters optional circle drawn around `you`
 */
export default function LeafletMap({
  center = [23.8103, 90.4125], // Dhaka default
  zoom = 12,
  markers = [],
  you = null,
  radiusMeters = 0,
  height = 360,
  focus = null,
  onMarkerClick,
}) {
  const activeCenter = you ? [you.lat, you.lng] : center;
  // `focus` (e.g. an incoming SOS victim) takes precedence for recentering.
  const recenterTarget = focus || activeCenter;

  return (
    <MapContainer
      center={activeCenter}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height, width: "100%", borderRadius: 16, zIndex: 0 }}
    >
      <Recenter center={recenterTarget} zoom={zoom} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {you && radiusMeters > 0 && (
        <Circle
          center={[you.lat, you.lng]}
          radius={radiusMeters}
          pathOptions={{ color: COLORS.emergency, fillColor: COLORS.emergency, fillOpacity: 0.08, weight: 1 }}
        />
      )}

      {you && (
        <CircleMarker
          center={[you.lat, you.lng]}
          radius={9}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS.primary, fillOpacity: 1 }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
      )}

      {markers.map((m, i) => (
        <CircleMarker
          key={i}
          center={[m.lat, m.lng]}
          radius={m.size ?? 8}
          pathOptions={{
            color: "#0d1117",
            weight: 1.5,
            fillColor: COLORS[m.color] || m.color || COLORS.info,
            fillOpacity: 0.95,
          }}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m, i) } : undefined}
        >
          {m.popup && (
            <Popup>
              <div style={{ minWidth: 120 }}>{m.popup}</div>
            </Popup>
          )}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

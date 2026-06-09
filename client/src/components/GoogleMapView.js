"use client";

import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

const COLORS = {
  emergency: "#e11d48",
  primary: "#0d9488",
  info: "#2563eb",
  warning: "#b45309",
  family: "#7c3aed",
  herbal: "#15803d",
  muted: "#64748b",
};

// DEMO_MAP_ID lets AdvancedMarkers render without a custom cloud Map ID.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

function Recenter({ target }) {
  const map = useMap();
  useEffect(() => {
    if (map && target) map.panTo({ lat: target[0], lng: target[1] });
  }, [map, target]);
  return null;
}

function RadiusCircle({ center, radius, color }) {
  const map = useMap();
  useEffect(() => {
    if (!map || typeof window === "undefined" || !window.google?.maps) return;
    const circle = new window.google.maps.Circle({
      map,
      center: { lat: center.lat, lng: center.lng },
      radius,
      fillColor: color,
      fillOpacity: 0.08,
      strokeColor: color,
      strokeWeight: 1,
    });
    return () => circle.setMap(null);
  }, [map, center.lat, center.lng, radius, color]);
  return null;
}

function MapMarker({ m, index, onClick }) {
  const [open, setOpen] = useState(false);
  const color = COLORS[m.color] || m.color || COLORS.info;
  return (
    <>
      <AdvancedMarker
        position={{ lat: m.lat, lng: m.lng }}
        onClick={() => {
          setOpen((v) => !v);
          onClick?.(m, index);
        }}
      >
        <Pin background={color} borderColor="#0d1117" glyphColor="#0d1117" scale={m.size ? m.size / 8 : 1} />
      </AdvancedMarker>
      {open && m.popup && (
        <InfoWindow position={{ lat: m.lat, lng: m.lng }} onCloseClick={() => setOpen(false)}>
          <div style={{ minWidth: 120, color: "#0f172a" }}>{m.popup}</div>
        </InfoWindow>
      )}
    </>
  );
}

/**
 * Google Maps renderer — drop-in replacement for the Leaflet map, same props.
 * Used automatically when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
 */
export default function GoogleMapView({
  apiKey,
  center = [23.8103, 90.4125],
  zoom = 12,
  markers = [],
  you = null,
  radiusMeters = 0,
  height = 360,
  focus = null,
  onMarkerClick,
}) {
  const target = focus || (you ? [you.lat, you.lng] : center);

  return (
    <div style={{ height, width: "100%", borderRadius: 16, overflow: "hidden" }}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultZoom={zoom}
          defaultCenter={{ lat: target[0], lng: target[1] }}
          mapId={MAP_ID}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          style={{ width: "100%", height: "100%" }}
        >
          <Recenter target={target} />

          {you && (
            <AdvancedMarker position={{ lat: you.lat, lng: you.lng }}>
              <Pin background={COLORS.primary} borderColor="#fff" glyphColor="#fff" />
            </AdvancedMarker>
          )}
          {you && radiusMeters > 0 && (
            <RadiusCircle center={you} radius={radiusMeters} color={COLORS.emergency} />
          )}

          {markers.map((m, i) => (
            <MapMarker key={i} m={m} index={i} onClick={onMarkerClick} />
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}

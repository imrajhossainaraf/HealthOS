"use client";

import { useCallback, useState } from "react";
import { KEYS, writeStorage } from "@/lib/storage";

/** Approximate coordinates for seed donor areas (Phase 1, no geocoding backend). */
export const CITY_COORDS = {
  dhaka: [23.8103, 90.4125],
  chittagong: [22.3569, 91.7832],
  sylhet: [24.8949, 91.8687],
  khulna: [22.8456, 89.5403],
  rajshahi: [24.3636, 88.6241],
};

export const DEFAULT_CENTER = CITY_COORDS.dhaka;

/** Resolve a free-text area to coordinates, falling back to the default center. */
export function areaToCoords(area = "") {
  const key = area.trim().toLowerCase();
  for (const city in CITY_COORDS) {
    if (key.includes(city)) return CITY_COORDS[city];
  }
  return DEFAULT_CENTER;
}

/** Deterministic-ish scatter so markers don't stack exactly on a city center. */
export function jitter([lat, lng], seed = Math.random(), maxKm = 4) {
  const r = (maxKm / 111) * Math.sqrt(seed);
  const theta = seed * 2 * Math.PI * 1.7 + 0.3;
  return [lat + r * Math.cos(theta), lng + r * Math.sin(theta)];
}

/** Haversine distance in km between two [lat,lng] points. */
export function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** One-shot browser geolocation as a hook. */
export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        // Remember it so the app-wide beacon can announce availability with a
        // real location even after navigating away from this page.
        writeStorage(KEYS.lastCoords, next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Location unavailable");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return { coords, error, loading, request, setCoords };
}

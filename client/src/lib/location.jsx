"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { KEYS, useLocalState, writeStorage } from "@/lib/storage";
import { DEFAULT_CENTER, areaToCoords } from "@/lib/geo";
import { useAuth } from "@/lib/auth";
import { userApi } from "@/lib/api";

const LocationContext = createContext(null);

/**
 * App-wide location. Auto-detects the browser location once on arrival and
 * keeps it in one place so every page shares the same fix (no per-page flicker
 * or re-prompting). The last known location is persisted, so navigation and
 * reloads start from the previous fix instantly while a fresh one resolves.
 */
export function LocationProvider({ children }) {
  // Persisted last fix — survives reloads and seeds the map immediately.
  const [stored] = useLocalState(KEYS.lastCoords, null);
  const [live, setLive] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestedRef = useRef(false);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLive(next);
        writeStorage(KEYS.lastCoords, next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err?.message || "Location unavailable");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Detect location automatically the first time the app mounts.
  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    request();
  }, [request]);

  // Register the signed-in user's location with the server so SOS alerts can
  // reach whoever is genuinely nearby (server 2dsphere $near). Deduped to ~11m
  // so we don't spam on every minor re-render; best-effort (failures ignored).
  const { status } = useAuth();
  const sentRef = useRef(null);
  useEffect(() => {
    const fix = live || stored;
    if (status !== "authed" || !fix) return;
    const key = `${fix.lat.toFixed(4)},${fix.lng.toFixed(4)}`;
    if (sentRef.current === key) return;
    sentRef.current = key;
    userApi.updateLocation(fix).catch(() => {});
  }, [live, stored, status]);

  const coords = live || stored || null;
  const lat = coords?.lat ?? null;
  const lng = coords?.lng ?? null;

  // Stable references so consumers' effects/maps don't churn every render.
  const value = useMemo(() => {
    const c = lat != null ? { lat, lng } : null;
    return {
      coords: c,
      // [lat,lng] tuple for map components; always defined (Dhaka fallback).
      center: c ? [lat, lng] : DEFAULT_CENTER,
      error,
      loading,
      request,
      located: !!c,
    };
  }, [lat, lng, error, loading, request]);

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}

export { DEFAULT_CENTER, areaToCoords };

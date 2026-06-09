"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Central registry of localStorage keys so features share one source of truth.
 */
export const KEYS = {
  profile: "healthos:profile",
  emergencyContacts: "healthos:emergencyContacts",
  emergencyHistory: "healthos:emergencyHistory",
  family: "healthos:family",
  community: "healthos:community",
  herbalSubmissions: "healthos:herbalSubmissions",
  outbreakReports: "healthos:outbreakReports",
  lastCoords: "healthos:lastCoords",
};

// Bump when the persisted data shape changes; run migrations in migrateStorage().
export const STORAGE_VERSION = 1;
const VERSION_KEY = "healthos:_schemaVersion";

/**
 * One-time data migration on app start. Safe to call repeatedly.
 * Returns the version it migrated to.
 */
export function migrateStorage() {
  if (typeof window === "undefined") return STORAGE_VERSION;
  let from = 0;
  try {
    from = Number(window.localStorage.getItem(VERSION_KEY)) || 0;
  } catch {
    return STORAGE_VERSION;
  }
  if (from === STORAGE_VERSION) return STORAGE_VERSION;
  // Future migrations branch on `from` here, e.g. if (from < 2) { ...reshape... }
  try {
    window.localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  } catch {
    /* ignore */
  }
  return STORAGE_VERSION;
}

/** Read + parse a key. Returns `fallback` on miss or parse error (SSR-safe). */
export function readStorage(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Serialize + write a key. No-op on the server. Returns true on success.
 * Distinguishes quota errors so callers can warn the user if needed.
 */
export function writeStorage(key, value) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    // Let other components/tabs react to the change.
    window.dispatchEvent(new CustomEvent("healthos:storage", { detail: { key } }));
    return true;
  } catch (err) {
    const quota =
      err?.name === "QuotaExceededError" ||
      err?.name === "NS_ERROR_DOM_QUOTA_REACHED";
    if (quota) {
      window.dispatchEvent(
        new CustomEvent("healthos:storage-error", { detail: { key, reason: "quota" } })
      );
    }
    return false;
  }
}

// Per-key snapshot cache so getSnapshot returns a stable reference until the
// underlying raw string actually changes (required by useSyncExternalStore).
const snapshotCache = new Map();

function getSnapshot(key, initialValue) {
  const raw =
    typeof window === "undefined" ? null : window.localStorage.getItem(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.parsed;
  let parsed;
  if (raw === null) {
    // Reuse a prior parsed value (keeps a stable ref for empty defaults).
    parsed = cached ? cached.parsed : initialValue;
  } else {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = initialValue;
    }
  }
  snapshotCache.set(key, { raw, parsed });
  return parsed;
}

function subscribe(callback) {
  window.addEventListener("healthos:storage", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("healthos:storage", callback);
    window.removeEventListener("storage", callback);
  };
}

/** True only after client hydration — SSR-safe, no setState-in-effect. */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * State that mirrors a localStorage key via useSyncExternalStore.
 * - Renders `initialValue` on the server / during hydration (no mismatch).
 * - Reads from storage on the client and re-renders when any writer updates the key.
 * - `setValue` accepts a value or an updater fn, persists, and notifies subscribers.
 * - `hydrated` lets callers avoid flashing empty states.
 */
export function useLocalState(key, initialValue) {
  const value = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key, initialValue),
    () => initialValue
  );
  const hydrated = useHydrated();

  const setValue = useCallback(
    (updater) => {
      const current = getSnapshot(key, initialValue);
      const next = typeof updater === "function" ? updater(current) : updater;
      writeStorage(key, next);
    },
    [key, initialValue]
  );

  return [value, setValue, hydrated];
}

/** Append an event to the Emergency Timeline; returns the new entry. */
export function logEmergencyEvent(entry) {
  const history = readStorage(KEYS.emergencyHistory, []);
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    type: "SOS Activated",
    location: "Not shared",
    reason: "Other",
    outcome: "Ongoing",
    notes: "",
    beaconLevels: [],
    ...entry,
  };
  writeStorage(KEYS.emergencyHistory, [record, ...history]);
  return record;
}

/** Add points to the community reputation total; returns new total. */
export function addReputation(points, reason) {
  const community = readStorage(KEYS.community, null) || {
    points: 0,
    role: "Citizen",
    log: [],
  };
  community.points = (community.points || 0) + points;
  community.log = [
    { points, reason, at: new Date().toISOString() },
    ...(community.log || []),
  ].slice(0, 50);
  writeStorage(KEYS.community, community);
  return community.points;
}

/** Reputation tier derived from total points (shared by Community + Dashboard). */
export function getTier(points = 0) {
  if (points >= 1000)
    return { name: "Health Champion", icon: "🏆", min: 1000, next: null };
  if (points >= 500)
    return { name: "Lifesaver", icon: "🥇", min: 500, next: 1000 };
  if (points >= 200)
    return { name: "Health Guardian", icon: "🥈", min: 200, next: 500 };
  return { name: "Community Helper", icon: "🥉", min: 0, next: 200 };
}

/** BMI helper shared by Profile, Dashboard, and Fitness. */
export function calcBMI(heightCm, weightKg) {
  const h = parseFloat(heightCm);
  const w = parseFloat(weightKg);
  if (!h || !w || h <= 0 || w <= 0) return null;
  const bmi = w / (h / 100) ** 2;
  const rounded = Math.round(bmi * 10) / 10;
  let category = "Normal";
  if (bmi < 18.5) category = "Underweight";
  else if (bmi < 25) category = "Normal";
  else if (bmi < 30) category = "Overweight";
  else category = "Obese";
  return { value: rounded, category };
}

"use client";

import { io } from "socket.io-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { API_URL, getToken, alertApi } from "@/lib/api";
import { KEYS, useLocalState } from "@/lib/storage";
import { DEFAULT_CENTER, distanceKm } from "@/lib/geo";
import { useLocation } from "@/lib/location";
import { useToast } from "@/lib/toast";

const BeaconContext = createContext(null);

/**
 * App-wide realtime SOS beacon. One socket for the whole app, mounted in the
 * root layout so EVERY connected user receives emergency alerts as a toast on
 * any page — not just nearby volunteers. Each client computes its own distance
 * from the victim's coordinates. Degrades cleanly to offline.
 */
export function BeaconProvider({ children }) {
  const { push } = useToast();
  const { coords } = useLocation();
  const socketRef = useRef(null);
  const coordsRef = useRef(coords);
  const activeAlertRef = useRef(null); // id of the SOS this client is broadcasting
  const [connected, setConnected] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);

  const [optedIn] = useLocalState(KEYS.community + ":volunteerOptIn", false);

  // Keep latest coords available to the (stable) socket handler.
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  // Format an incoming alert into a human distance/where string.
  const describe = useCallback((alert) => {
    const here = coordsRef.current;
    if (here && typeof alert.lat === "number" && typeof alert.lng === "number") {
      const km = distanceKm([here.lat, here.lng], [alert.lat, alert.lng]);
      return km < 1 ? "less than 1 km away" : `${km.toFixed(1)} km away`;
    }
    return alert.area ? `in ${alert.area}` : "in your network";
  }, []);

  // Establish a single connection for the app's lifetime + seed recent alerts.
  useEffect(() => {
    alertApi
      .list()
      .then((r) => setRecentAlerts(r.alerts || []))
      .catch(() => {});

    const socket = io(API_URL, {
      auth: { token: getToken() },
      autoConnect: true,
      reconnectionAttempts: 5,
      timeout: 5000,
    });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("sos:alert", (alert) => {
      const where = describe(alert);
      setIncomingAlert({ ...alert, where, receivedAt: Date.now() });
      setRecentAlerts((list) => [alert, ...list].slice(0, 50));
      push({
        variant: "emergency",
        title: "🚨 Emergency alert",
        body: `${alert.victim} needs help — ${alert.reason} · ${where}.`,
        href: "/emergency#live-map",
        actionLabel: "Respond",
      });
    });
    // A victim cancelled their SOS — purge it from everyone's UI immediately.
    socket.on("sos:cancel", ({ id } = {}) => {
      if (!id) return;
      setRecentAlerts((list) => list.filter((a) => a.id !== id));
      setIncomingAlert((cur) => (cur && cur.id === id ? null : cur));
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [push, describe]);

  // Announce / withdraw volunteer availability as the toggle or location changes.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (optedIn) {
      const lat = coords?.lat ?? DEFAULT_CENTER[0];
      const lng = coords?.lng ?? DEFAULT_CENTER[1];
      socket.emit("volunteer:online", { lat, lng });
    } else {
      socket.emit("volunteer:offline");
    }
  }, [optedIn, coords, connected]);

  // Fire an SOS; resolves with how many nearby opted-in volunteers were reached.
  const activate = useCallback(({ lat, lng, reason, area, radiusKm = 5 }) => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected)
        return resolve({ reachedCount: 0, offline: true });
      const oLat = typeof lat === "number" ? lat : DEFAULT_CENTER[0];
      const oLng = typeof lng === "number" ? lng : DEFAULT_CENTER[1];
      socket.emit("sos:activate", { lat: oLat, lng: oLng, reason, area, radiusKm });
      let done = false;
      socket.once("sos:ack", (ack) => {
        done = true;
        activeAlertRef.current = ack?.alert?.id || null;
        resolve(ack);
      });
      setTimeout(() => {
        if (!done) resolve({ reachedCount: 0, timeout: true });
      }, 4000);
    });
  }, []);

  // Cancel the SOS this client started: ask the server to erase it (DB + every
  // client's UI), and drop it locally right away in case we're offline.
  const cancel = useCallback(() => {
    const id = activeAlertRef.current;
    activeAlertRef.current = null;
    if (!id) return;
    const socket = socketRef.current;
    if (socket && socket.connected) socket.emit("sos:cancel", { id });
    setRecentAlerts((list) => list.filter((a) => a.id !== id));
    setIncomingAlert((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  const clearAlert = useCallback(() => setIncomingAlert(null), []);

  const value = {
    connected,
    activate,
    cancel,
    incomingAlert,
    clearAlert,
    recentAlerts,
  };
  return (
    <BeaconContext.Provider value={value}>{children}</BeaconContext.Provider>
  );
}

export function useBeaconContext() {
  const ctx = useContext(BeaconContext);
  if (!ctx) throw new Error("useBeaconContext must be used within BeaconProvider");
  return ctx;
}

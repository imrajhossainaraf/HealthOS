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
import { useAuth } from "@/lib/auth";
import { initAlertSound, playSiren, showAlertNotification } from "@/lib/siren";
import { registerPush } from "@/lib/push";

// Merge a responder into an alert's responders list (dedup by email).
function withResponder(alert, responder) {
  if (!alert || !responder?.email) return alert;
  const existing = Array.isArray(alert.responders) ? alert.responders : [];
  if (existing.some((r) => r.email === responder.email)) return alert;
  return { ...alert, responders: [...existing, responder] };
}

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
  const { user } = useAuth();
  const socketRef = useRef(null);
  const coordsRef = useRef(coords);
  const activeAlertRef = useRef(null); // id of the SOS this client is broadcasting
  const [connected, setConnected] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);

  const [optedIn] = useLocalState(KEYS.community + ":volunteerOptIn", false);

  // Keep latest coords + volunteer state available to the (stable) socket handler.
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);
  const optedInRef = useRef(optedIn);
  useEffect(() => {
    optedInRef.current = optedIn;
  }, [optedIn]);

  // Prime the siren/notification permissions on the first user gesture, then
  // subscribe to Web Push so alerts arrive even with the site closed.
  useEffect(() => {
    initAlertSound();
    if (user) registerPush(); // already-granted case
    const onReady = () => registerPush();
    window.addEventListener("healthos:push-ready", onReady);
    return () => window.removeEventListener("healthos:push-ready", onReady);
  }, [user]);

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
      // Sound the siren + OS notification for opted-in responders, so they're
      // alerted even with the tab in the background.
      if (optedInRef.current) {
        playSiren();
        showAlertNotification("🚨 Emergency alert", `${alert.victim} needs help — ${alert.reason} · ${where}.`);
      }
    });
    // Someone tapped "Respond" — reflect it on every client instantly.
    socket.on("sos:responded", ({ id, responder } = {}) => {
      if (!id || !responder) return;
      setRecentAlerts((list) =>
        list.map((a) => (a.id === id ? withResponder(a, responder) : a))
      );
      setIncomingAlert((cur) => (cur && cur.id === id ? withResponder(cur, responder) : cur));
    });
    // Direct notice to the SOS victim that a volunteer is on the way.
    socket.on("sos:responder-incoming", ({ responder } = {}) => {
      push({
        variant: "success",
        title: "🚑 Help is on the way",
        body: `${responder?.name || "A volunteer"} is responding to your SOS and is incoming.`,
      });
    });
    // Someone triggered an alert link for a person whose contact you are.
    socket.on("alert:incoming", ({ title, body } = {}) => {
      push({
        variant: "emergency",
        title: title || "🚨 Emergency alert",
        body: body || "An emergency alert was triggered.",
        href: "/emergency",
        actionLabel: "Open",
      });
      // This alert is targeted at THIS user (a contact) — always sound it.
      playSiren();
      showAlertNotification(title || "🚨 Emergency alert", body || "An emergency alert was triggered.");
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

  // Tap "Respond" on an SOS card. Optimistically mark it locally for instant
  // feedback, then tell the server which broadcasts to everyone else.
  const respond = useCallback(
    (id) => {
      if (!id) return;
      const socket = socketRef.current;
      const me = user?.email
        ? { email: user.email.toLowerCase(), name: user.name || "A responder", at: new Date().toISOString() }
        : null;
      if (me) {
        setRecentAlerts((list) => list.map((a) => (a.id === id ? withResponder(a, me) : a)));
        setIncomingAlert((cur) => (cur && cur.id === id ? withResponder(cur, me) : cur));
      }
      if (socket && socket.connected) socket.emit("sos:respond", { id });
    },
    [user]
  );

  const value = {
    connected,
    activate,
    cancel,
    respond,
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

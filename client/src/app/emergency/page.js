"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KEYS, useLocalState, logEmergencyEvent } from "@/lib/storage";
import { DEFAULT_CENTER, jitter, distanceKm } from "@/lib/geo";
import { useLocation } from "@/lib/location";
import { useAuth } from "@/lib/auth";
import { fetchNearbyHospitals, directionsUrl } from "@/lib/hospitals";
import { useBeaconContext } from "@/lib/beacon";
import { useToast } from "@/lib/toast";
import HealthCard from "@/components/HealthCard";
import MapView from "@/components/MapView";

const VOLUNTEER_RADIUS_M = 2000; // beacon radius for nearby volunteers

const REASONS = ["Accident", "Chest Pain", "Breathing Difficulty", "Unconscious", "Other"];

const BEACON_LEVELS = [
  { level: 1, label: "Family Members", icon: "👨‍👩‍👧", delay: 0, source: "family" },
  { level: 2, label: "Emergency Contacts", icon: "📞", delay: 10, source: "contacts" },
  { level: 3, label: "Nearby Volunteers", icon: "🙋", delay: 30, source: "volunteers" },
];

const FIRST_AID = [
  { name: "CPR", icon: "❤️", steps: ["Check responsiveness and call for help.", "Place hands center of chest, interlocked.", "Push hard and fast — 100–120 compressions/min, 5–6 cm deep.", "Give 2 rescue breaths every 30 compressions.", "Continue until help arrives or person revives."] },
  { name: "Choking", icon: "🫁", steps: ["Ask 'Are you choking?' — encourage coughing.", "Give 5 back blows between shoulder blades.", "Give 5 abdominal thrusts (Heimlich).", "Alternate until object clears or person collapses.", "If unconscious, start CPR."] },
  { name: "Burns", icon: "🔥", steps: ["Cool the burn under running water 20 minutes.", "Remove jewelry/tight items near the area.", "Cover loosely with clean non-stick dressing.", "Do not apply ice, butter, or ointments.", "Seek care for large, deep, or facial burns."] },
  { name: "Fractures", icon: "🦴", steps: ["Keep the person still; don't move the limb.", "Immobilize with a splint if trained.", "Apply cold pack wrapped in cloth.", "Elevate if possible without causing pain.", "Get medical help — do not realign the bone."] },
  { name: "Stroke (FAST)", icon: "🧠", steps: ["Face — ask them to smile; check for droop.", "Arms — ask them to raise both arms.", "Speech — ask them to repeat a sentence.", "Time — if any sign, call emergency services now.", "Note the time symptoms started."] },
  { name: "Heart Attack", icon: "💔", steps: ["Call emergency services immediately.", "Have the person sit, rest, and stay calm.", "Loosen tight clothing.", "If prescribed, help them take aspirin/nitroglycerin.", "Begin CPR if they become unresponsive."] },
  { name: "Poisoning", icon: "☠️", steps: ["Call poison control / emergency services.", "Identify the substance if safe to do so.", "Do not induce vomiting unless instructed.", "If on skin, rinse with water.", "Keep packaging for responders."] },
  { name: "Drowning", icon: "🌊", steps: ["Remove from water safely — protect yourself.", "Check breathing; call for help.", "Start CPR if not breathing.", "Keep them warm to prevent hypothermia.", "Seek care even if they seem recovered."] },
];

// National ambulance hotline is always shown; real hospitals are fetched live
// from the user's location (Google Places → OSM → curated fallback).
const AMBULANCE = { name: "National Ambulance (999)", phone: "999", distance: "Dispatch" };

const VOLUNTEER_NAMES = [
  "Rahim (First Aid)", "Sadia (Nurse)", "Imran (Responder)",
  "Farah (Doctor)", "Hasan (Volunteer)", "Lubna (Care)",
];

export default function EmergencyPage() {
  const [profile] = useLocalState(KEYS.profile, {});
  const [contacts] = useLocalState(KEYS.emergencyContacts, []);
  const [family] = useLocalState(KEYS.family, []);
  const { user } = useAuth();
  const [volunteerOptIn, setVolunteerOptIn] = useLocalState(KEYS.community + ":volunteerOptIn", false);

  const [active, setActive] = useState(false);
  const [reason, setReason] = useState("Other");
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef(null);
  const loggedRef = useRef(false);

  const { coords, error: geoError, loading: geoLoading, request: requestLocation, center } = useLocation();

  // Realtime: incoming alerts (app-wide beacon) + live responder reach.
  const [liveReach, setLiveReach] = useState(null);
  const { connected, activate, cancel, respond, incomingAlert, clearAlert, recentAlerts } = useBeaconContext();
  const { push } = useToast();

  // Simulated nearby volunteers scattered around the user/center, with distances.
  const volunteers = useMemo(() => {
    const origin = coords ? [coords.lat, coords.lng] : DEFAULT_CENTER;
    return VOLUNTEER_NAMES.map((name, i) => {
      const [lat, lng] = jitter(origin, (i + 1) / (VOLUNTEER_NAMES.length + 1), 2.5);
      return { name, lat, lng, distanceKm: distanceKm(origin, [lat, lng]) };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [coords]);

  const inRangeVolunteers = volunteers.filter((v) => v.distanceKm * 1000 <= VOLUNTEER_RADIUS_M);

  // Which beacon levels have been notified — derived purely from elapsed time.
  const notified = {};
  if (active) {
    BEACON_LEVELS.forEach((b) => {
      if (elapsed >= b.delay) notified[b.level] = "Notified";
    });
  }

  // Build recipient lists for each beacon level from real data.
  const recipients = {
    family: family.map((m) => m.name).filter(Boolean),
    contacts: contacts.map((c) => c.name).filter(Boolean),
    volunteers: inRangeVolunteers.map((v) => `${v.name} · ${v.distanceKm.toFixed(1)}km`),
  };

  // Map markers: volunteers colored by in/out of beacon range.
  const volunteerMarkers = volunteers.map((v) => ({
    lat: v.lat,
    lng: v.lng,
    color: active && v.distanceKm * 1000 <= VOLUNTEER_RADIUS_M ? "emergency" : "primary",
    popup: `${v.name} — ${v.distanceKm.toFixed(1)} km away`,
  }));

  // When an SOS reaches us as a responder, drop a marker on the victim's location.
  const hasAlertLocation =
    incomingAlert && typeof incomingAlert.lat === "number" && typeof incomingAlert.lng === "number";
  const alertMarker = hasAlertLocation
    ? [{
        lat: incomingAlert.lat,
        lng: incomingAlert.lng,
        color: "emergency",
        size: 12,
        popup: `🚨 ${incomingAlert.victim || "Someone"} needs help — ${incomingAlert.reason}`,
      }]
    : [];
  const mapMarkers = [...volunteerMarkers, ...alertMarker];

  // Live nearby hospitals from the user's location, with the 999 ambulance
  // hotline always pinned at the end.
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const origin = coords ? [coords.lat, coords.lng] : center;
  const originKey = origin.join(",");
  useEffect(() => {
    let cancelled = false;
    fetchNearbyHospitals(origin, { limit: 5 })
      .then((res) => { if (!cancelled) setNearbyHospitals(res.hospitals || []); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey]);

  const hospitalList = [
    ...nearbyHospitals.map((h) => ({
      name: h.name,
      phone: h.phone || "999",
      distance: `${h.distanceKm.toFixed(1)} km`,
      directions: directionsUrl(h),
    })),
    AMBULANCE,
  ];

  const startSOS = () => {
    setActive(true);
    setElapsed(0);
    setLiveReach(null);
    loggedRef.current = false;
    push({
      variant: "emergency",
      title: "🚨 Emergency beacon broadcast",
      body: `Alerting nearby responders — ${reason}. Escalating through family, contacts, and volunteers.`,
    });
    // Fire the real-time beacon in parallel with the simulation.
    activate({
      lat: coords?.lat,
      lng: coords?.lng,
      reason,
      area: profile?.area || profile?.city || "",
      radiusKm: VOLUNTEER_RADIUS_M / 1000,
    }).then((ack) => {
      setLiveReach(ack);
      if (ack && ack.reachedCount > 0) {
        push({
          variant: "success",
          title: "Responders reached",
          body: `${ack.reachedCount} nearby opted-in responder${ack.reachedCount === 1 ? "" : "s"} notified.`,
        });
      }
    });
  };

  const cancelSOS = () => {
    setActive(false);
    setLiveReach(null);
    if (tickRef.current) clearInterval(tickRef.current);
    // Erase the beacon from the DB and from every other user's alerts (safety).
    cancel();
    push({
      variant: "success",
      title: "Beacon cancelled",
      body: "Your emergency alert was withdrawn and removed for everyone.",
    });
  };

  // Drive the beacon countdown while active.
  useEffect(() => {
    if (!active) return;
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [active]);

  // Arriving from the navbar SOS (/emergency?sos=1) fires the beacon immediately,
  // then strips the param so a refresh doesn't re-trigger it.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("sos") !== "1") return;
    autoStartedRef.current = true;
    window.history.replaceState(null, "", "/emergency");
    // Defer out of the effect body (so state updates don't run synchronously
    // during commit) WITHOUT a cleanup — otherwise React StrictMode's
    // mount→cleanup→mount cycle would cancel the timer and the guard would
    // block the reschedule, so the beacon would never fire.
    queueMicrotask(startSOS);
    // startSOS is stable for our purposes; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the final level is reached, log the activation to the timeline (once).
  useEffect(() => {
    if (active && elapsed >= 30 && !loggedRef.current) {
      loggedRef.current = true;
      logEmergencyEvent({
        type: "SOS Activated",
        reason,
        outcome: "Ongoing",
        beaconLevels: BEACON_LEVELS.map((b) => b.level),
      });
    }
  }, [elapsed, active, reason]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Emergency Response</h1>
      <p className="mt-1 text-muted">
        One tap escalates through family, contacts, and nearby volunteers.
      </p>

      {/* Incoming alert for opted-in volunteers (real-time) */}
      {incomingAlert && (() => {
        const responders = incomingAlert.responders || [];
        const responded = responders.length > 0;
        const iResponded = responders.some((r) => r.email === user?.email?.toLowerCase());
        return (
          <div className={`mt-4 rounded-2xl border p-4 text-sm transition-colors ${responded ? "border-success bg-success/15" : "border-emergency bg-emergency/15 animate-pulse-glow"}`}>
            <div className="flex items-center justify-between gap-3">
              <span>
                {responded ? "✅" : "⚠️"} <b>{incomingAlert.victim} needs immediate assistance</b> — {incomingAlert.reason} · {incomingAlert.where}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {incomingAlert.id && !iResponded && (
                  <button type="button" onClick={() => respond(incomingAlert.id)} className="rounded-lg bg-success px-3 py-1.5 font-semibold text-white">
                    Respond
                  </button>
                )}
                <button type="button" onClick={clearAlert} className="rounded-lg bg-emergency px-3 py-1.5 font-semibold text-white">
                  Dismiss
                </button>
              </div>
            </div>
            {responded && (
              <p className="mt-2 text-xs font-medium text-success">
                🟢 {responders.length} responding — {responders.map((r) => r.email).join(", ")}
              </p>
            )}
          </div>
        );
      })()}

      {/* ---------- SOS BUTTON  +  LIVE MAP (side by side) ---------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-stretch">
        {/* SOS PANEL */}
        <section className="glass flex flex-col items-center justify-center rounded-3xl p-6 text-center">
          {!active ? (
            <>
              <div className="mb-4 w-full max-w-xs">
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">
                  Reason (optional)
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={startSOS}
                className="mx-auto grid h-44 w-44 place-items-center rounded-full bg-emergency font-display text-3xl font-extrabold text-white animate-pulse-glow"
              >
                SOS
              </button>
              <p className="mt-4 text-sm text-muted">Press to activate the emergency beacon</p>
            </>
          ) : (
            <BeaconActive
              elapsed={elapsed}
              notified={notified}
              recipients={recipients}
              reason={reason}
              onCancel={cancelSOS}
            />
          )}
        </section>

        {/* LIVE LOCATION MAP */}
        <section id="live-map" className="flex flex-col scroll-mt-24">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Live Location &amp; Responders</h2>
            <button
              type="button"
              onClick={requestLocation}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
            >
              {geoLoading ? "Locating…" : coords ? "↻ Update my location" : "📍 Use my location"}
            </button>
          </div>

          <div className="min-h-[340px] flex-1 overflow-hidden rounded-2xl">
            <MapView
              you={coords}
              center={center}
              focus={hasAlertLocation ? [incomingAlert.lat, incomingAlert.lng] : null}
              markers={mapMarkers}
              radiusMeters={active ? VOLUNTEER_RADIUS_M : 0}
              height="100%"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5"><Dot c="#0d9488" /> You / available volunteers</span>
            {active && <span className="flex items-center gap-1.5"><Dot c="#e11d48" /> In beacon range ({inRangeVolunteers.length})</span>}
            <span className={`flex items-center gap-1.5 ${connected ? "text-success" : "text-muted"}`}>
              <Dot c={connected ? "#059669" : "#64748b"} /> {connected ? "Live network connected" : "Offline (simulation only)"}
            </span>
            {geoError && <span className="text-warning">⚠️ {geoError} — showing default area</span>}
            {!coords && !geoError && <span className="text-muted">Using default area until you share location.</span>}
          </div>
        </section>
      </div>

      {/* ---------- QUICK ACTIONS ---------- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <a href="tel:999" className="glass glass-hover rounded-2xl p-4 text-center text-sm font-semibold">
          📞 Call 999
        </a>
        <a href="#live-map" onClick={requestLocation} className="glass glass-hover rounded-2xl p-4 text-center text-sm font-semibold">
          📍 Share Location
        </a>
        <a href="#health-card" className="glass glass-hover rounded-2xl p-4 text-center text-sm font-semibold">
          🪪 Show Card
        </a>
        <a href="#first-aid" className="glass glass-hover rounded-2xl p-4 text-center text-sm font-semibold">
          📋 First Aid
        </a>
      </div>

      {active && liveReach && (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
          {liveReach.offline || liveReach.timeout
            ? "📡 Live network unavailable — alerting via the local simulation."
            : `📡 Real-time beacon reached ${liveReach.reachedCount} nearby opted-in responder${liveReach.reachedCount === 1 ? "" : "s"}.`}
        </div>
      )}

      {/* Volunteer opt-in */}
      <label className="glass mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-4">
        <span className="text-sm">
          🙋 <b>Volunteer opt-in</b> — receive nearby emergency alerts
          <span className="block text-xs text-muted">When on, you appear to others as an available responder.</span>
        </span>
        <input
          type="checkbox"
          checked={!!volunteerOptIn}
          onChange={(e) => setVolunteerOptIn(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
      </label>
      {volunteerOptIn && (
        <div className="mt-3 rounded-2xl border border-emergency/40 bg-emergency/10 p-4 text-sm">
          ⚠️ <b>Responder mode active.</b> You’ll see banners like “Someone nearby needs immediate assistance” with distance and emergency type when an SOS fires in your area.
        </div>
      )}

      {/* ---------- NETWORK ALERTS (all users) ---------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">🚨 Active Network Alerts</h2>
          <span className="text-xs text-muted">{recentAlerts.length} in the last 6h</span>
        </div>
        {recentAlerts.length === 0 ? (
          <p className="glass rounded-2xl p-4 text-sm text-muted">
            No active emergencies right now. When anyone in the network sends an SOS, it appears here for everyone.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentAlerts.slice(0, 6).map((a) => {
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
                  className={`glass flex flex-col gap-2 rounded-2xl border p-4 transition-colors ${responded ? "border-success/60 bg-success/10" : "border-emergency/30"}`}
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
                          Locate
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
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* ---------- EMERGENCY PROFILE ---------- */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Emergency Profile</h2>
          <HealthCard profile={profile} contacts={contacts} userId={user?.id} />
          {(!profile?.bloodGroup || contacts.length === 0) && (
            <p className="mt-2 text-sm text-warning">
              ⚠️ Complete your{" "}
              <a href="/profile" className="underline">profile &amp; contacts</a> for a full card.
            </p>
          )}
        </section>

        {/* ---------- HOSPITALS ---------- */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Hospitals &amp; Ambulance</h2>
          <div className="space-y-3">
            {hospitalList.map((h) => (
              <div key={h.name} className="glass flex items-center justify-between gap-3 rounded-2xl p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.name}</p>
                  <p className="text-sm text-muted">{h.distance}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {h.directions && (
                    <a href={h.directions} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-primary/50">
                      Map
                    </a>
                  )}
                  <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
                    Call
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ---------- FIRST AID LIBRARY ---------- */}
      <section id="first-aid" className="mt-10 scroll-mt-24">
        <h2 className="mb-3 font-display text-xl font-semibold">First Aid Library</h2>
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {FIRST_AID.map((item) => (
            <FirstAidCard key={item.name} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BeaconActive({ elapsed, notified, recipients, reason, onCancel }) {
  return (
    <div>
      <p className="font-display text-lg font-bold text-emergency">
        🚨 Beacon Active — {reason}
      </p>
      <p className="mt-1 text-sm text-muted">Elapsed: {elapsed}s</p>

      <div className="mt-5 space-y-3 text-left">
        {BEACON_LEVELS.map((b) => {
          const reached = notified[b.level];
          const people = recipients[b.source] || [];
          const remaining = Math.max(0, b.delay - elapsed);
          return (
            <div
              key={b.level}
              className={`rounded-2xl border p-4 transition-colors ${
                reached ? "border-primary/50 bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {b.icon} Level {b.level} — {b.label}
                </span>
                <span className={`text-sm ${reached ? "text-primary" : "text-muted"}`}>
                  {reached ? "✓ Notified" : `in ${remaining}s`}
                </span>
              </div>
              {reached && (
                <p className="mt-1 text-sm text-muted">
                  {people.length ? people.join(", ") : "No one registered at this level"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-5 rounded-xl border border-border bg-surface-2 px-6 py-2.5 font-semibold hover:border-emergency/50"
      >
        Cancel Beacon
      </button>
    </div>
  );
}

function Dot({ c }) {
  return <span className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />;
}

function timeAgo(iso) {
  if (!iso) return "just now";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function FirstAidCard({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span className="font-medium">
          {item.icon} {item.name}
        </span>
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ol className="space-y-2 px-4 pb-4">
          {item.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

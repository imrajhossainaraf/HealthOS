"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KEYS, useLocalState, addReputation } from "@/lib/storage";
import { areaToCoords, jitter } from "@/lib/geo";
import { useLocation } from "@/lib/location";
import { donorApi, reputationApi, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import ReputationBadge from "@/components/ReputationBadge";
import MapView from "@/components/MapView";

const ROLES = [
  { role: "Citizen", badge: "🏘️ Community Member" },
  { role: "Blood Donor", badge: "🩸 Blood Hero" },
  { role: "First Aid Volunteer", badge: "🚑 First Aid Responder" },
  { role: "Medical Student", badge: "📚 Health Learner" },
  { role: "Nurse", badge: "💉 Care Provider" },
  { role: "Doctor", badge: "🩺 Medical Expert" },
  { role: "Herbal Contributor", badge: "🌿 Herbal Contributor" },
];

const REP_ACTIONS = [
  { label: "Log blood donation", points: 100, reason: "Blood donation logged" },
  { label: "Log volunteering session", points: 75, reason: "Volunteering session logged" },
  { label: "Log emergency help", points: 150, reason: "Emergency response helped" },
  { label: "Complete vaccination record", points: 30, reason: "Vaccination record complete" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Illustrative sample donors shown alongside the real shared network so the
// map is never empty. Tagged `sample` so they read as examples, not real people.
const SEED_DONORS = [
  { name: "Aisha Rahman", group: "O-", area: "Dhaka", phone: "+880 1700-000001" },
  { name: "Karim Hossain", group: "A+", area: "Chittagong", phone: "+880 1700-000002" },
  { name: "Maria Gomez", group: "B+", area: "Dhaka", phone: "+880 1700-000003" },
  { name: "Tariq Islam", group: "O+", area: "Sylhet", phone: "+880 1700-000004" },
  { name: "Nadia Akter", group: "AB+", area: "Dhaka", phone: "+880 1700-000005" },
];

const EVENTS = [
  { title: "Community Blood Drive", date: "Sat · City Hall", icon: "🩸" },
  { title: "First Aid Training", date: "Sun · Community Center", icon: "🚑" },
  { title: "Health Awareness Walk", date: "Next Fri · Riverside", icon: "🚶" },
];

export default function CommunityPage() {
  const [community, setCommunity, hydrated] = useLocalState(KEYS.community, {
    points: 0,
    role: "Citizen",
    log: [],
  });
  // Donors this device registered while offline / as a guest (not yet shared).
  const [donors, setDonors] = useLocalState(KEYS.community + ":donors", []);
  const { push } = useToast();

  const [search, setSearch] = useState({ group: "All", area: "" });
  const [donorForm, setDonorForm] = useState({ name: "", group: "O+", area: "", phone: "" });
  const { coords, request: requestLocation, loading: geoLoading } = useLocation();
  const { user } = useAuth();

  // Real, cross-user leaderboard from the backend.
  const [serverLeaders, setServerLeaders] = useState(null);
  const loadLeaderboard = useCallback(() => {
    reputationApi
      .leaderboard()
      .then((r) => setServerLeaders(r.leaders || []))
      .catch(() => setServerLeaders(null));
  }, []);
  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Hydrate the badge from the server's authoritative point total on sign-in.
  useEffect(() => {
    if (!user?.id) return;
    reputationApi
      .me()
      .then((r) => {
        const pts = r.reputation?.points || 0;
        setCommunity((c) => (pts !== (c?.points || 0) ? { ...(c || {}), points: pts } : c));
      })
      .catch(() => {});
  }, [user, setCommunity]);

  // Shared donor network from the backend (real, cross-user).
  const [serverDonors, setServerDonors] = useState(null);
  const loadServerDonors = useCallback(() => {
    donorApi
      .list({})
      .then((r) => setServerDonors(r.donors || []))
      .catch(() => setServerDonors(null));
  }, []);
  useEffect(() => {
    loadServerDonors();
  }, [loadServerDonors]);

  const award = useCallback(
    (points, reason) => {
      addReputation(points, reason);
      setCommunity((c) => ({ ...(c || {}), points: (c?.points || 0) + points }));
      // Persist to the shared ledger so it counts toward the real ranking, then
      // refresh the board so the new position shows immediately.
      reputationApi
        .award(points, reason)
        .then((r) => {
          const pts = r?.reputation?.points;
          if (typeof pts === "number") {
            setCommunity((c) => ({ ...(c || {}), points: pts }));
          }
          loadLeaderboard();
        })
        .catch(() => {
          // Guest / offline — the local award still applies for this device.
        });
    },
    [setCommunity, loadLeaderboard]
  );

  const setRole = (role) => setCommunity((c) => ({ ...(c || {}), role }));

  const registerDonor = async () => {
    if (!donorForm.name.trim() || !donorForm.area.trim()) return;
    // Use the shared GPS location if granted, else approximate from the area name.
    const loc = coords ? [coords.lat, coords.lng] : areaToCoords(donorForm.area);
    const payload = {
      name: donorForm.name.trim(),
      blood_group: donorForm.group,
      area: donorForm.area.trim(),
      phone: donorForm.phone.trim(),
      lat: loc[0],
      lng: loc[1],
    };

    if (getToken()) {
      // Signed in → publish to the shared network so every user sees the pin.
      try {
        await donorApi.create(payload);
        loadServerDonors();
        push({ variant: "success", title: "You're on the donor map", body: `${payload.name} (${payload.blood_group}) is now visible to the whole network in ${payload.area}.` });
        setDonorForm({ name: "", group: "O+", area: "", phone: "" });
        award(100, "Registered as blood donor");
        return;
      } catch {
        /* fall through to local copy */
      }
    }
    // Guest / offline → keep a local pin and nudge to sign in to share it.
    setDonors((d) => [
      { id: Date.now().toString(36), name: payload.name, group: payload.blood_group, area: payload.area, phone: payload.phone, lat: loc[0], lng: loc[1] },
      ...d,
    ]);
    push({
      variant: "info",
      title: "Saved on this device",
      body: getToken() ? "Server unavailable — your pin is local for now." : "Sign in to publish your pin to the whole network.",
      href: getToken() ? undefined : "/login",
      actionLabel: getToken() ? undefined : "Sign in",
    });
    setDonorForm({ name: "", group: "O+", area: "", phone: "" });
    award(100, "Registered as blood donor");
  };

  const filteredDonors = useMemo(() => {
    // Real shared network + this device's local pins + illustrative samples.
    const network = (serverDonors || []).map((d) => ({ ...d, shared: true }));
    const local = donors.map((d) => ({ ...d, shared: false }));
    const samples = SEED_DONORS.map((d) => ({ ...d, sample: true }));
    const base = [...network, ...local, ...samples];

    // 1) Resolve coordinates (area → city center for entries without GPS).
    const located = base.map((d, i) => {
      if (typeof d.lat === "number" && typeof d.lng === "number") return d;
      const [lat, lng] = jitter(areaToCoords(d.area), (i + 1) / (base.length + 1), 3);
      return { ...d, lat, lng };
    });

    // 2) Fan out donors that share (almost) the same point so pins don't stack
    //    into a single marker. Group by a ~110 m rounded key. Seed the user's own
    //    location so donors registered "at my location" don't hide under the
    //    blue "you" marker.
    const seen = new Map();
    if (coords) seen.set(`${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`, 1);
    const spread = located.map((d) => {
      const key = `${d.lat.toFixed(3)},${d.lng.toFixed(3)}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      if (n === 0) return d; // first pin at this spot keeps its true position
      // Subsequent overlaps spiral outwards (~90 m rings) via the golden angle.
      const angle = n * 2.399963;
      const radius = 0.0009 * Math.ceil(n / 6);
      return { ...d, lat: d.lat + radius * Math.cos(angle), lng: d.lng + radius * Math.sin(angle) };
    });

    // 3) Apply the search filters.
    return spread.filter(
      (d) =>
        (search.group === "All" || d.group === search.group) &&
        (search.area.trim() === "" ||
          d.area.toLowerCase().includes(search.area.trim().toLowerCase()))
    );
  }, [serverDonors, donors, search, coords]);

  const donorMarkers = filteredDonors.map((d) => ({
    lat: d.lat,
    lng: d.lng,
    // red = shared network (everyone sees) · amber = this device only · gray = sample
    color: d.sample ? "muted" : d.shared ? "emergency" : "warning",
    popup: `${d.name} · ${d.group} · ${d.area}${
      d.sample ? " (sample)" : d.shared ? "" : " (on this device — sign in to share)"
    }`,
  }));

  const mapCenter = coords
    ? [coords.lat, coords.lng]
    : filteredDonors[0]
    ? [filteredDonors[0].lat, filteredDonors[0].lng]
    : undefined;

  // Real leaderboard: every contributor ranked by their persisted points, with
  // the signed-in user always shown (even at 0) and highlighted.
  const leaderboard = useMemo(() => {
    const leaders = (serverLeaders || []).map((l) => ({
      name: l.userId === user?.id ? `${l.name || "You"} (You)` : l.name || "Member",
      points: l.points || 0,
      me: l.userId === user?.id,
    }));
    if (user?.id && !leaders.some((l) => l.me)) {
      leaders.push({ name: "You", points: community?.points || 0, me: true });
    }
    return leaders.sort((a, b) => b.points - a.points).slice(0, 8);
  }, [serverLeaders, user, community]);

  if (!hydrated)
    return <div className="mx-auto max-w-6xl px-4 py-16 text-muted">Loading…</div>;

  const currentBadge = ROLES.find((r) => r.role === community?.role)?.badge;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Health Guardian Network</h1>
      <p className="mt-1 text-muted">
        Donate, volunteer, and respond — earn reputation that builds community trust.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        {/* LEFT: reputation + role */}
        <div className="space-y-6">
          <ReputationBadge points={community?.points || 0} />

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 font-display font-semibold">Your role</h2>
            <p className="mb-3 text-sm text-muted">Current: {currentBadge}</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => setRole(r.role)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    community?.role === r.role
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted hover:text-text"
                  }`}
                >
                  {r.badge}
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 font-display font-semibold">Log a contribution</h2>
            <div className="grid gap-2">
              {REP_ACTIONS.map((a) => (
                <button
                  key={a.reason}
                  type="button"
                  onClick={() => award(a.points, a.reason)}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary/50"
                >
                  <span>{a.label}</span>
                  <span className="font-semibold text-primary">+{a.points}</span>
                </button>
              ))}
            </div>
            {community?.log?.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Last: {community.log[0].reason} (+{community.log[0].points})
              </p>
            )}
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 font-display font-semibold">🏆 Top Contributors</h2>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted">
                No contributions logged yet — be the first to climb the ranking.
              </p>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((p, i) => {
                  const medal = ["🥇", "🥈", "🥉"][i];
                  return (
                    <li
                      key={`${p.name}-${i}`}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        p.me ? "bg-primary/15 text-primary" : ""
                      }`}
                    >
                      <span>
                        <span className="inline-block w-6 tabular-nums">{medal || `${i + 1}.`}</span>{" "}
                        {p.name}
                      </span>
                      <span className="font-semibold">{p.points} pts</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* RIGHT: blood donor registry */}
        <div className="space-y-6">
          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 font-display font-semibold">🩸 Blood Donor Registry</h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={search.group}
                onChange={(e) => setSearch((s) => ({ ...s, group: e.target.value }))}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <option>All</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <input
                value={search.area}
                onChange={(e) => setSearch((s) => ({ ...s, area: e.target.value }))}
                placeholder="Search area…"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>

            {/* Donor map */}
            <div className="mt-4">
              <MapView markers={donorMarkers} you={coords} center={mapCenter} height={280} zoom={11} />
              <p className="mt-2 text-xs text-muted">
                🔴 {filteredDonors.filter((d) => d.shared).length} shared network ·{" "}
                🟡 {filteredDonors.filter((d) => !d.shared && !d.sample).length} on this device ·{" "}
                ⚪ {filteredDonors.filter((d) => d.sample).length} sample ·{" "}
                {serverDonors !== null ? "🌐 shared network live" : "📴 offline (server unreachable)"} · tap a marker for details
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {filteredDonors.length === 0 ? (
                <p className="text-sm text-muted">No donors match your search.</p>
              ) : (
                filteredDonors.map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted">{d.area}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-emergency/15 px-2 py-0.5 font-semibold text-emergency">{d.group}</span>
                      {d.phone && (
                        <a href={`tel:${d.phone.replace(/\s/g, "")}`} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white">Call</a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 font-display font-semibold">Register as a donor</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Name" value={donorForm.name} onChange={(e) => setDonorForm({ ...donorForm, name: e.target.value })} />
              <select className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={donorForm.group} onChange={(e) => setDonorForm({ ...donorForm, group: e.target.value })}>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <input className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Area" value={donorForm.area} onChange={(e) => setDonorForm({ ...donorForm, area: e.target.value })} />
              <input className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Phone" value={donorForm.phone} onChange={(e) => setDonorForm({ ...donorForm, phone: e.target.value })} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={registerDonor} className="rounded-lg bg-emergency px-4 py-2 text-sm font-semibold text-white">
                Register (+100 pts)
              </button>
              <button type="button" onClick={requestLocation} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium">
                {geoLoading ? "Locating…" : coords ? "✓ Location set" : "📍 Use my location"}
              </button>
              {coords && <span className="text-xs text-muted">Pin: {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}</span>}
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 font-display font-semibold">📅 Local health events</h2>
            <div className="space-y-2">
              {EVENTS.map((e) => (
                <div key={e.title} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                  <span className="text-xl">{e.icon}</span>
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-muted">{e.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

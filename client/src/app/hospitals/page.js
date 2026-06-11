"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import { useLocation } from "@/lib/location";
import { getSonaimuriHospitals, SONAIMURI_CENTER, directionsUrl } from "@/lib/hospitals";
import MapView from "@/components/MapView";

export default function HospitalsPage() {
  // Global location is auto-detected once on arrival and shared across pages,
  // so distances fill in without anyone clicking "Use my location".
  const { coords, request: requestLocation, loading: geoLoading } = useLocation();
  const [query, setQuery] = useState("");

  const origin = coords ? [coords.lat, coords.lng] : SONAIMURI_CENTER;
  const hospitals = useMemo(
    () => getSonaimuriHospitals(origin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords?.lat, coords?.lng]
  );

  // Deferred query keeps the input responsive while the map re-render and
  // list filter catch up a frame later.
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () =>
      hospitals.filter((h) =>
        h.name.toLowerCase().includes(deferredQuery.trim().toLowerCase())
      ),
    [hospitals, deferredQuery]
  );

  const markers = filtered.map((h) => ({
    lat: h.lat,
    lng: h.lng,
    color: h.emergency ? "emergency" : "primary",
    popup: `${h.name}${h.phone ? ` — ${h.phone}` : ""}`,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Hospitals in Sonaimuri</h1>
          <p className="mt-1 text-muted">
            Verified hospitals &amp; clinics in Sonaimuri, Noakhali with real contact numbers.
          </p>
        </div>
        <button
          type="button"
          onClick={requestLocation}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          {geoLoading ? "Locating…" : coords ? "↻ Update location" : "📍 Use my location"}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* List */}
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hospitals…"
            className="mb-4 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          {filtered.length === 0 ? (
            <p className="text-muted">No hospitals found.</p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((h) => (
                <li key={h.id} className="glass glass-hover flex gap-3 overflow-hidden rounded-2xl p-3">
                  <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    <Image src={h.photo} alt={h.name} fill sizes="120px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-slate-800">{h.name}</p>
                    <p className="mt-0.5 text-sm text-muted">📍 {h.address}</p>
                    {coords && (
                      <p className="mt-0.5 text-sm text-muted">{h.distanceKm.toFixed(1)} km away</p>
                    )}
                    {h.emergency && (
                      <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        24/7 Emergency
                      </span>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      {h.phone && (
                        <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white">
                          📞 {h.phone}
                        </a>
                      )}
                      <a href={directionsUrl(h)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-1.5 font-medium hover:border-primary/50">
                        Directions
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Map */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <MapView you={coords} center={SONAIMURI_CENTER} markers={markers} height={460} zoom={14} />
          <p className="mt-2 text-xs text-muted">🔴 {filtered.length} hospitals shown · tap a marker for details</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { distanceKm, DEFAULT_CENTER } from "@/lib/geo";

// Verified real hospital/medical-building photos (Unsplash CDN, checked 200).
const PHOTOS = [
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=500&q=70",
  "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=500&q=70",
  "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=500&q=70",
  "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=500&q=70",
  "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=500&q=70",
  "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?auto=format&fit=crop&w=500&q=70",
];

/** Deterministic photo pick so a given hospital always shows the same image. */
export function photoFor(key = "") {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PHOTOS[h % PHOTOS.length];
}

// Curated real hospitals in Dhaka, Bangladesh (used when Overpass is unavailable).
const CURATED = [
  { name: "Square Hospitals Ltd", lat: 23.7536, lng: 90.384, phone: "+880 2 8159457" },
  { name: "United Hospital, Gulshan", lat: 23.8032, lng: 90.4188, phone: "+880 2 8836000" },
  { name: "Evercare Hospital Dhaka", lat: 23.8156, lng: 90.4255, phone: "+880 2 55037242" },
  { name: "Labaid Specialized Hospital, Dhanmondi", lat: 23.7459, lng: 90.3795, phone: "+880 2 9676356" },
  { name: "Ibn Sina Hospital, Dhanmondi", lat: 23.7461, lng: 90.3742, phone: "+880 2 9126625" },
  { name: "BIRDEM General Hospital, Shahbagh", lat: 23.7385, lng: 90.3955, phone: "+880 2 9661551" },
  { name: "Dhaka Medical College Hospital", lat: 23.7257, lng: 90.3975, phone: "+880 2 55165088" },
  { name: "National Heart Foundation Hospital", lat: 23.8, lng: 90.363, phone: "+880 2 9122122" },
];

function decorate(list, origin) {
  return list
    .map((h) => ({
      ...h,
      id: h.id || `${h.name}-${h.lat}`,
      distanceKm: distanceKm(origin, [h.lat, h.lng]),
      photo: photoFor(h.name),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

const OVERPASS = "https://overpass-api.de/api/interpreter";
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Live nearby hospitals from the Google Places API (New). Browser-callable with
 * CORS; needs "Places API (New)" enabled on the key. Returns null on failure so
 * callers can fall back to OpenStreetMap.
 */
async function fetchPlacesHospitals(origin, { radius = 7000, limit = 8 } = {}) {
  if (!GOOGLE_KEY) return null;
  const [lat, lng] = origin;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.formattedAddress",
      },
      body: JSON.stringify({
        includedTypes: ["hospital"],
        maxResultCount: Math.min(limit, 20),
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hospitals = (data.places || []).map((p, i) => ({
      id: `g-${i}-${p.location?.latitude}`,
      name: p.displayName?.text || "Hospital",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
      address: p.formattedAddress || "",
    }));
    return hospitals.filter((h) => typeof h.lat === "number");
  } catch {
    return null;
  }
}

/**
 * Real nearby hospitals around [lat,lng]. Prefers Google Places (live, when a
 * key is set), then OpenStreetMap (Overpass), then a curated real-hospital list.
 */
export async function fetchNearbyHospitals(origin = DEFAULT_CENTER, { radius = 7000, limit = 8 } = {}) {
  const [lat, lng] = origin;

  // 1) Google Places (New) — freshest listing when configured.
  const places = await fetchPlacesHospitals(origin, { radius, limit });
  if (places && places.length) {
    return { source: "google", hospitals: decorate(places, origin).slice(0, limit) };
  }

  // 2) OpenStreetMap (Overpass).
  const query = `[out:json][timeout:20];(node["amenity"="hospital"](around:${radius},${lat},${lng});way["amenity"="hospital"](around:${radius},${lat},${lng}););out center ${limit * 4};`;
  try {
    const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("overpass");
    const data = await res.json();
    const hospitals = (data.elements || [])
      .filter((e) => e.tags?.name)
      .map((e) => {
        const c = e.center || e;
        return {
          id: String(e.id),
          name: e.tags.name,
          lat: c.lat,
          lng: c.lon,
          phone: e.tags.phone || e.tags["contact:phone"] || "",
          emergency: e.tags.emergency === "yes",
        };
      });
    if (hospitals.length === 0) throw new Error("empty");
    return { source: "osm", hospitals: decorate(hospitals, origin).slice(0, limit) };
  } catch {
    // 3) Curated real Dhaka hospitals.
    return { source: "curated", hospitals: decorate(CURATED, origin).slice(0, limit) };
  }
}

/** Directions link that works on any device (OSM). */
export function directionsUrl(h) {
  return `https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lng}#map=17/${h.lat}/${h.lng}`;
}

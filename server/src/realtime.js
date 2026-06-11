import { Server } from "socket.io";
import { authenticateSocket } from "./auth.js";
import { collections, toObjectId } from "./db.js";
import { alertToClient } from "./routes/alerts.routes.js";
import { sendSosEmail } from "./email.js";
import { config } from "./config.js";

// In-memory presence of opted-in volunteers: socketId -> { user, email, lat, lng }.
const volunteers = new Map();

function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Don't blast an entire city — cap how many members we email per SOS.
const NEARBY_MEMBER_LIMIT = 80;
// Ignore location fixes older than this when deciding who's "nearby" — a month-old
// position is not where someone is during an emergency.
const LOCATION_FRESHNESS_MS = 30 * 24 * 3600_000;

/**
 * Remember a user's most recent coordinates as a GeoJSON Point so future SOS
 * notices can find who's genuinely nearby (via a 2dsphere $near query). Called
 * whenever a user shares a location — firing an SOS or going volunteer-online.
 * Best-effort; never throws.
 */
async function rememberUserLocation(userId, lat, lng) {
  if (!userId || typeof lat !== "number" || typeof lng !== "number") return;
  const oid = toObjectId(userId);
  if (!oid) return;
  try {
    await collections.users().updateOne(
      { _id: oid },
      { $set: { lastLocation: { type: "Point", coordinates: [lng, lat] }, lastLocationAt: new Date() } }
    );
  } catch (err) {
    console.error("[location] remember failed:", err?.message || err);
  }
}

/** Geo path: verified members whose last known fix is within `radiusKm`. */
async function nearbyByGeo(lat, lng, radiusKm, victimOid, out) {
  const query = {
    verified: true,
    lastLocationAt: { $gte: new Date(Date.now() - LOCATION_FRESHNESS_MS) },
    lastLocation: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: Math.max(1, radiusKm) * 1000, // km -> metres
      },
    },
  };
  if (victimOid) query._id = { $ne: victimOid };

  const users = await collections
    .users()
    .find(query)
    .limit(NEARBY_MEMBER_LIMIT)
    .project({ email: 1 })
    .toArray();
  for (const u of users) {
    if (EMAIL_RE.test(u.email || "")) out.set(u.email.toLowerCase(), "nearby HealthOS member");
  }
}

/** Fallback path: free-text locality match for members without stored coords. */
async function nearbyByArea(area, victimUserId, out) {
  // Significant locality tokens (e.g. "Dhanmondi, Dhaka" -> ["dhanmondi","dhaka"]).
  const tokens = String(area || "")
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (!tokens.length) return;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const areaRe = new RegExp(escaped.join("|"), "i");

  const profiles = await collections
    .documents()
    .find({ key: "healthos:profile", "value.area": { $regex: areaRe } })
    .limit(NEARBY_MEMBER_LIMIT)
    .toArray();

  const userIds = profiles
    .map((p) => p.userId)
    .filter((id) => id && id !== victimUserId)
    .map((id) => toObjectId(id))
    .filter(Boolean);
  if (!userIds.length) return;

  const users = await collections
    .users()
    .find({ _id: { $in: userIds }, verified: true })
    .project({ email: 1 })
    .toArray();
  for (const u of users) {
    if (EMAIL_RE.test(u.email || "") && !out.has(u.email.toLowerCase())) {
      out.set(u.email.toLowerCase(), "nearby HealthOS member");
    }
  }
}

/**
 * Find verified members near the alert to notify even while they're offline.
 * Prefers precise geo-distance (stored last-known coordinates); also folds in a
 * free-text area match so members who haven't shared GPS yet are still reached.
 * Returns a Map of lowercased email -> relationship, excluding the victim.
 */
async function findNearbyMembers({ lat, lng, area }, victimUserId, radiusKm = 5) {
  const out = new Map();
  const victimOid = victimUserId ? toObjectId(victimUserId) : null;
  try {
    if (typeof lat === "number" && typeof lng === "number") {
      await nearbyByGeo(lat, lng, radiusKm, victimOid, out);
    }
    await nearbyByArea(area, victimUserId, out);
  } catch (err) {
    console.error("[sos email] nearby member lookup failed:", err?.message || err);
  }
  return out;
}

/**
 * Email the people who should know about an SOS: the victim's saved emergency
 * contacts and guardian (read from their stored profile), opted-in volunteers
 * currently within the alert radius, plus registered members whose saved area is
 * near the alert (even if offline). De-duplicated; best-effort.
 */
async function notifyByEmail(userId, payload, volunteerEmails = [], radiusKm = 5) {
  const recipients = new Map(); // email -> relationship

  for (const email of volunteerEmails) {
    if (EMAIL_RE.test(email)) recipients.set(email.toLowerCase(), "nearby responder");
  }

  // Registered members near the alert (precise geo + area fallback), offline-capable.
  const nearby = await findNearbyMembers(payload, userId, radiusKm);
  for (const [email, relationship] of nearby) {
    if (!recipients.has(email)) recipients.set(email, relationship);
  }

  if (userId) {
    const [profileDoc, contactsDoc, familyDoc] = await Promise.all([
      collections.documents().findOne({ userId, key: "healthos:profile" }),
      collections.documents().findOne({ userId, key: "healthos:emergencyContacts" }),
      collections.documents().findOne({ userId, key: "healthos:family" }),
    ]);
    const profile = profileDoc?.value || {};
    const contacts = Array.isArray(contactsDoc?.value) ? contactsDoc.value : [];
    const family = Array.isArray(familyDoc?.value) ? familyDoc.value : [];

    if (EMAIL_RE.test(profile.guardianEmail || "")) {
      recipients.set(profile.guardianEmail.toLowerCase(), profile.guardianName ? `guardian (${profile.guardianName})` : "guardian");
    }
    for (const c of contacts) {
      if (EMAIL_RE.test(c.email || "")) {
        recipients.set(c.email.toLowerCase(), c.relation ? `emergency contact (${c.relation})` : "emergency contact");
      }
    }
    // Family Guardian Mode members who have an email on file.
    for (const m of family) {
      if (EMAIL_RE.test(m.email || "")) {
        recipients.set(m.email.toLowerCase(), m.relation ? `family (${m.relation})` : "family member");
      }
    }
  }

  await Promise.all(
    [...recipients].map(([email, relationship]) =>
      sendSosEmail(email, payload, { relationship })
    )
  );
  if (recipients.size) console.log(`[sos email] notified ${recipients.size} recipient(s) for ${payload.victim}`);
}

export function initRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, methods: ["GET", "POST"] },
  });

  io.on("connection", async (socket) => {
    const user = await authenticateSocket(socket.handshake.auth?.token);

    // Volunteer toggles availability and shares coarse location.
    socket.on("volunteer:online", ({ lat, lng } = {}) => {
      if (typeof lat === "number" && typeof lng === "number") {
        volunteers.set(socket.id, { user: user?.name || "Volunteer", email: user?.email || "", lat, lng });
        // Persist as the user's last-known fix for future nearby lookups.
        rememberUserLocation(user?.id, lat, lng);
      }
    });
    socket.on("volunteer:offline", () => volunteers.delete(socket.id));

    // An SOS fires: persist it, then broadcast to EVERY connected client so the
    // whole network sees the alert (not just nearby volunteers). Each client
    // computes its own distance from the victim's coordinates.
    socket.on("sos:activate", async ({ lat, lng, reason, area, radiusKm = 5 } = {}) => {
      const hasLoc = typeof lat === "number" && typeof lng === "number";
      const record = {
        userId: user?.id || null,
        victim: user?.name || "Someone nearby",
        reason: reason || "Emergency",
        area: (area || "").toString().slice(0, 80),
        lat: hasLoc ? lat : null,
        lng: hasLoc ? lng : null,
        createdAt: new Date(),
      };

      let saved = record;
      try {
        const result = await collections.alerts().insertOne(record);
        saved = { ...record, _id: result.insertedId };
      } catch (err) {
        console.error("[alerts] persist failed:", err?.message || err);
      }

      // Remember where the victim is so the next SOS can locate who's near them.
      if (hasLoc) rememberUserLocation(user?.id, lat, lng);

      const payload = alertToClient(saved);
      // Broadcast to everyone except the sender.
      socket.broadcast.emit("sos:alert", payload);

      // Ack the sender with how many opted-in volunteers are within radius,
      // and collect their emails so responders nearby also get notified.
      let reached = 0;
      const volunteerEmails = [];
      for (const [sid, v] of volunteers) {
        if (sid === socket.id) continue;
        if (hasLoc && distanceKm({ lat, lng }, v) <= radiusKm) {
          reached++;
          if (v.email) volunteerEmails.push(v.email);
        }
      }
      socket.emit("sos:ack", { reachedCount: reached, alert: payload });

      // Fire-and-forget email notifications (contacts, guardian, nearby responders).
      notifyByEmail(user?.id, payload, volunteerEmails, radiusKm).catch((err) =>
        console.error("[sos email] failed:", err?.message || err)
      );
    });

    // The victim cancels their beacon: erase it from the DB so it no longer
    // surfaces in alert lists, and tell EVERY client to drop it from their UI.
    // Safety-critical — a stale/false SOS must disappear everywhere immediately.
    socket.on("sos:cancel", async ({ id } = {}) => {
      const oid = toObjectId(id);
      if (!oid) return;

      // Only the originating user may cancel their own alert. Anonymous alerts
      // (no userId) can be cancelled by id, which only the sender holds anyway.
      const filter = { _id: oid };
      if (user?.id) filter.userId = user.id;

      try {
        const result = await collections.alerts().deleteOne(filter);
        if (result.deletedCount === 0) return; // not found or not the owner
      } catch (err) {
        console.error("[alerts] cancel failed:", err?.message || err);
        return;
      }

      // Broadcast to all (including the sender's other tabs); idempotent on clients.
      io.emit("sos:cancel", { id });
    });

    // A network member taps "Respond" on an SOS card. Record them on the alert
    // and broadcast to EVERYONE so every client turns that card green and shows
    // the responder instantly. Requires an authenticated identity (for the email).
    socket.on("sos:respond", async ({ id } = {}) => {
      const oid = toObjectId(id);
      if (!oid) return;
      const email = (user?.email || "").toLowerCase();
      const name = user?.name || "A responder";
      if (!email) return; // need an identity to show on the card
      const responder = { email, name, at: new Date() };
      try {
        // Push only if this responder isn't already recorded (idempotent).
        await collections.alerts().updateOne(
          { _id: oid, "responders.email": { $ne: email } },
          { $push: { responders: responder } }
        );
      } catch (err) {
        console.error("[alerts] respond failed:", err?.message || err);
        return;
      }
      io.emit("sos:responded", { id, responder });
    });

    socket.on("disconnect", () => volunteers.delete(socket.id));
  });

  return io;
}

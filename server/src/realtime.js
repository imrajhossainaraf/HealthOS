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

/**
 * Email the people who should know about an SOS: the victim's saved emergency
 * contacts and guardian (read from their stored profile), plus any opted-in
 * volunteers currently within the alert radius. De-duplicated; best-effort.
 */
async function notifyByEmail(userId, payload, volunteerEmails = []) {
  const recipients = new Map(); // email -> relationship

  for (const email of volunteerEmails) {
    if (EMAIL_RE.test(email)) recipients.set(email.toLowerCase(), "nearby responder");
  }

  if (userId) {
    const [profileDoc, contactsDoc] = await Promise.all([
      collections.documents().findOne({ userId, key: "healthos:profile" }),
      collections.documents().findOne({ userId, key: "healthos:emergencyContacts" }),
    ]);
    const profile = profileDoc?.value || {};
    const contacts = Array.isArray(contactsDoc?.value) ? contactsDoc.value : [];

    if (EMAIL_RE.test(profile.guardianEmail || "")) {
      recipients.set(profile.guardianEmail.toLowerCase(), profile.guardianName ? `guardian (${profile.guardianName})` : "guardian");
    }
    for (const c of contacts) {
      if (EMAIL_RE.test(c.email || "")) {
        recipients.set(c.email.toLowerCase(), c.relation ? `emergency contact (${c.relation})` : "emergency contact");
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
      notifyByEmail(user?.id, payload, volunteerEmails).catch((err) =>
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

    socket.on("disconnect", () => volunteers.delete(socket.id));
  });

  return io;
}

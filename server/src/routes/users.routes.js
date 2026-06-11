// Public user lookup — powers the QR code on the emergency health card. Returns
// only the emergency-relevant subset of a user's profile (never credentials).
// The health profile is stored per-user in the document store under
// `healthos:profile` / `healthos:emergencyContacts`.
import { Router } from "express";
import { collections, toObjectId } from "../db.js";
import { requireAuth } from "../auth.js";

export const usersRouter = Router();

const PROFILE_KEY = "healthos:profile";
const CONTACTS_KEY = "healthos:emergencyContacts";

// POST /api/users/location — the signed-in user shares their current coordinates
// so SOS alerts can find who is genuinely nearby (2dsphere $near). Authenticated;
// stored as a GeoJSON Point with a timestamp for freshness filtering. Registered
// BEFORE the public GET /:id route below (distinct method, but kept explicit).
usersRouter.post("/location", requireAuth, async (req, res, next) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }
    await collections.users().updateOne(
      { _id: toObjectId(req.user.id) },
      { $set: { lastLocation: { type: "Point", coordinates: [lng, lat] }, lastLocationAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function docValue(userId, key) {
  const row = await collections.documents().findOne({ userId, key });
  return row?.value ?? null;
}

/** Assemble the public emergency card for a user document. */
async function publicEmergencyProfile(user) {
  const userId = user._id.toString();
  const profile = (await docValue(userId, PROFILE_KEY)) || {};
  const contacts = (await docValue(userId, CONTACTS_KEY)) || [];

  return {
    id: userId,
    name: profile.name || user.name || "",
    phone: user.phone || "",
    bloodGroup: profile.bloodGroup || "",
    gender: profile.gender || "",
    dob: profile.dob || "",
    allergies: profile.allergies || [],
    conditions: profile.conditions || [],
    medications: profile.medications || [],
    area: profile.area || profile.city || "",
    guardian:
      profile.guardianName || profile.guardianPhone || profile.guardianEmail
        ? {
            name: profile.guardianName || "",
            phone: profile.guardianPhone || "",
            email: profile.guardianEmail || "",
          }
        : null,
    // Strip emails from public contact output; keep name/relation/phone.
    contacts: (Array.isArray(contacts) ? contacts : []).map((c) => ({
      name: c.name || "",
      relation: c.relation || "",
      phone: c.phone || "",
    })),
    updatedAt: profile.updatedAt || null,
  };
}

// GET /api/users/by-phone/:phone — lookup by registered phone number.
usersRouter.get("/by-phone/:phone", async (req, res, next) => {
  try {
    const phone = String(req.params.phone).trim();
    const user = await collections.users().findOne({ phone, verified: true });
    if (!user) return res.status(404).json({ error: "No verified user with that phone number" });
    res.json({ user: await publicEmergencyProfile(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — lookup by account id (used by the QR link).
usersRouter.get("/:id", async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ error: "Invalid user id" });
    const user = await collections.users().findOne({ _id });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: await publicEmergencyProfile(user) });
  } catch (err) {
    next(err);
  }
});

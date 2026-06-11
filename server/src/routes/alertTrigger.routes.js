// Alert-link endpoint: POST /api/alert/:number
// Anyone who opens an alert link for a registered phone number triggers an
// emergency notice to that person's guardian + emergency contacts — a styled
// email to each, plus a realtime toast to any who are signed-in HealthOS users.
// Public by design (panic/QR sticker use), so it never leaks contact details.
import { Router } from "express";
import { collections } from "../db.js";
import { sendSosEmail } from "../email.js";
import { emitToUser } from "../realtime.js";

export const alertTriggerRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip formatting so numbers compare regardless of spaces/dashes/parens. */
const normPhone = (p) => String(p || "").replace(/[\s\-()]/g, "");

alertTriggerRouter.post("/:number", async (req, res, next) => {
  try {
    const target = normPhone(req.params.number);
    if (target.length < 6) return res.status(400).json({ error: "Invalid phone number" });

    // Find the account that owns this number (normalized comparison, since the
    // stored phone may carry different formatting than the URL).
    const candidates = await collections
      .users()
      .find({ verified: true, phone: { $exists: true, $ne: "" } })
      .project({ _id: 1, name: 1, phone: 1, email: 1 })
      .toArray();
    const owner = candidates.find((u) => normPhone(u.phone) === target);
    if (!owner) return res.status(404).json({ error: "No registered user with that number" });

    const userId = owner._id.toString();
    const [profileDoc, contactsDoc] = await Promise.all([
      collections.documents().findOne({ userId, key: "healthos:profile" }),
      collections.documents().findOne({ userId, key: "healthos:emergencyContacts" }),
    ]);
    const profile = profileDoc?.value || {};
    const contacts = Array.isArray(contactsDoc?.value) ? contactsDoc.value : [];
    const ownerName = profile.name || owner.name || "A HealthOS user";

    // Build the alert payload (reuses the styled SOS email template).
    const alert = {
      victim: ownerName,
      reason: "Emergency alert triggered via alert link",
      area: profile.area || profile.city || "",
      lat: null,
      lng: null,
      createdAt: new Date(),
    };

    // Gather recipients: guardian + emergency contacts (emails to notify, phones
    // to match against accounts for realtime toasts).
    const emails = new Map(); // lowercased email -> relationship
    const phones = []; // normalized phone strings
    if (EMAIL_RE.test(profile.guardianEmail || "")) {
      emails.set(profile.guardianEmail.toLowerCase(), profile.guardianName ? `guardian (${profile.guardianName})` : "guardian");
    }
    if (profile.guardianPhone) phones.push(normPhone(profile.guardianPhone));
    for (const c of contacts) {
      if (EMAIL_RE.test(c.email || "")) {
        emails.set(c.email.toLowerCase(), c.relation ? `emergency contact (${c.relation})` : "emergency contact");
      }
      if (c.phone) phones.push(normPhone(c.phone));
    }

    if (emails.size === 0 && phones.length === 0) {
      return res.json({ ok: true, name: ownerName, notified: 0, toasted: 0, message: "No guardian or emergency contacts on file." });
    }

    // Styled emails — best-effort, in parallel.
    await Promise.all([...emails].map(([email, relationship]) => sendSosEmail(email, alert, { relationship })));

    // Realtime toasts to any recipient who is a signed-in HealthOS user, matched
    // by email (indexed) or by normalized phone (compared in JS).
    const matchedIds = new Set();
    if (emails.size) {
      const byEmail = await collections
        .users()
        .find({ email: { $in: [...emails.keys()] } })
        .project({ _id: 1 })
        .toArray();
      for (const u of byEmail) matchedIds.add(u._id.toString());
    }
    for (const u of candidates) {
      if (phones.includes(normPhone(u.phone))) matchedIds.add(u._id.toString());
    }
    matchedIds.delete(userId); // don't toast the owner via their own contact list
    for (const id of matchedIds) {
      emitToUser(id, "alert:incoming", {
        title: "🚨 Emergency alert",
        body: `${ownerName} may need help — an emergency alert was triggered for them.`,
      });
    }

    res.json({ ok: true, name: ownerName, notified: emails.size, toasted: matchedIds.size });
  } catch (err) {
    next(err);
  }
});

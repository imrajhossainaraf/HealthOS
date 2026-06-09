import { Router } from "express";
import { collections } from "../db.js";
import { requireAuth } from "../auth.js";
import { validate, donorSchema } from "../validation.js";

export const donorsRouter = Router();

function toClient(row) {
  return {
    id: row._id?.toString(),
    name: row.name,
    group: row.blood_group,
    area: row.area,
    phone: row.phone,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
  };
}

// Public read: anyone can search the shared donor registry (the real network).
donorsRouter.get("/", async (req, res, next) => {
  try {
    const query = {};
    if (req.query.group && req.query.group !== "All") {
      query.blood_group = req.query.group;
    }
    const area = (req.query.area || "").toString().trim();
    if (area) query.area = { $regex: escapeRegex(area), $options: "i" };

    const rows = await collections
      .donors()
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    res.json({ donors: rows.map(toClient) });
  } catch (err) {
    next(err);
  }
});

// Registering requires an account (prevents spam / ties to a real user).
donorsRouter.post("/", requireAuth, validate(donorSchema), async (req, res, next) => {
  try {
    const d = req.valid;
    const doc = {
      userId: req.user.id,
      name: d.name,
      blood_group: d.blood_group,
      area: d.area,
      phone: d.phone || "",
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      createdAt: new Date().toISOString(),
    };
    const result = await collections.donors().insertOne(doc);
    res.status(201).json({ donor: toClient({ ...doc, _id: result.insertedId }) });
  } catch (err) {
    next(err);
  }
});

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

import { Router } from "express";
import { collections } from "../db.js";
import { validate, outbreakSchema } from "../validation.js";

export const outbreaksRouter = Router();

function toClient(row) {
  return {
    id: row._id?.toString(),
    symptom: row.symptom,
    severity: row.severity,
    location: row.location,
    onset: row.onset || "",
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    at: row.createdAt,
  };
}

// Public: community symptom reports from the last 30 days (shared trends).
outbreaksRouter.get("/", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const rows = await collections
      .outbreaks()
      .find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray();
    res.json({ reports: rows.map(toClient) });
  } catch (err) {
    next(err);
  }
});

// Reports are anonymous by design — no auth required, but globally rate-limited.
outbreaksRouter.post("/", validate(outbreakSchema), async (req, res, next) => {
  try {
    const r = req.valid;
    const doc = {
      symptom: r.symptom,
      severity: r.severity,
      location: r.location,
      onset: r.onset,
      lat: r.lat ?? null,
      lng: r.lng ?? null,
      createdAt: new Date().toISOString(),
    };
    const result = await collections.outbreaks().insertOne(doc);
    res.status(201).json({ report: toClient({ ...doc, _id: result.insertedId }) });
  } catch (err) {
    next(err);
  }
});

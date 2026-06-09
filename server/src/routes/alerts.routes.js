import { Router } from "express";
import { collections } from "../db.js";

export const alertsRouter = Router();

export function alertToClient(row) {
  const created =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  return {
    id: row._id?.toString(),
    victim: row.victim || "Someone",
    reason: row.reason || "Emergency",
    area: row.area || "",
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    createdAt: created,
  };
}

// Public: recent emergency alerts (last 6 hours) so any user can see active SOSs.
alertsRouter.get("/", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 6 * 3600_000);
    const rows = await collections
      .alerts()
      .find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ alerts: rows.map(alertToClient) });
  } catch (err) {
    next(err);
  }
});

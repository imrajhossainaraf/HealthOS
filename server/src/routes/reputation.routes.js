import { Router } from "express";
import { collections } from "../db.js";
import { requireAuth } from "../auth.js";
import { validate, reputationAwardSchema } from "../validation.js";

export const reputationRouter = Router();

function toClient(row) {
  return {
    userId: row.userId,
    name: row.name || "Member",
    points: row.points || 0,
    contributions: row.contributions || 0,
  };
}

// Public: the real ranked leaderboard — every contributor, most points first.
reputationRouter.get("/leaderboard", async (req, res, next) => {
  try {
    const rows = await collections
      .reputation()
      .find({})
      .sort({ points: -1, updatedAt: 1 })
      .limit(20)
      .toArray();
    res.json({ leaders: rows.map(toClient) });
  } catch (err) {
    next(err);
  }
});

// The signed-in user's own standing (used to hydrate their points on login).
reputationRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const row = await collections.reputation().findOne({ userId: req.user.id });
    res.json({
      reputation: row
        ? toClient(row)
        : { userId: req.user.id, name: req.user.name || "Member", points: 0, contributions: 0 },
    });
  } catch (err) {
    next(err);
  }
});

// Record a contribution: atomically add points and bump the user's rank.
reputationRouter.post("/award", requireAuth, validate(reputationAwardSchema), async (req, res, next) => {
  try {
    const { points, reason } = req.valid;
    const now = new Date().toISOString();
    const result = await collections.reputation().findOneAndUpdate(
      { userId: req.user.id },
      {
        $inc: { points, contributions: 1 },
        $set: { name: req.user.name || "Member", updatedAt: now },
        $setOnInsert: { createdAt: now },
        $push: { log: { $each: [{ points, reason, at: now }], $slice: -20 } },
      },
      { upsert: true, returnDocument: "after" }
    );
    const doc = result?.value ?? result;
    res.json({ reputation: toClient(doc) });
  } catch (err) {
    next(err);
  }
});

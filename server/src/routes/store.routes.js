import { Router } from "express";
import { collections } from "../db.js";
import { requireAuth } from "../auth.js";
import { validate, docSchema } from "../validation.js";

export const storeRouter = Router();
storeRouter.use(requireAuth);

// Whitelist of allowed document keys (mirrors the client's KEYS registry).
const ALLOWED_KEY = /^healthos:[A-Za-z0-9:_-]{1,60}$/;

// Pull every document for the signed-in user (used to hydrate on login).
storeRouter.get("/", async (req, res, next) => {
  try {
    const rows = await collections
      .documents()
      .find({ userId: req.user.id })
      .toArray();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    res.json({ documents: out });
  } catch (err) {
    next(err);
  }
});

storeRouter.get("/:key", async (req, res, next) => {
  if (!ALLOWED_KEY.test(req.params.key))
    return res.status(400).json({ error: "Invalid key" });
  try {
    const row = await collections
      .documents()
      .findOne({ userId: req.user.id, key: req.params.key });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ value: row.value, updatedAt: row.updatedAt });
  } catch (err) {
    next(err);
  }
});

storeRouter.put("/:key", validate(docSchema), async (req, res, next) => {
  if (!ALLOWED_KEY.test(req.params.key))
    return res.status(400).json({ error: "Invalid key" });
  try {
    await collections.documents().updateOne(
      { userId: req.user.id, key: req.params.key },
      { $set: { value: req.valid.value, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

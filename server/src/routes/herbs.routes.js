import { Router } from "express";
import { collections } from "../db.js";
import { requireAuth } from "../auth.js";
import { validate, herbSchema } from "../validation.js";

export const herbsRouter = Router();

function toClient(row) {
  return {
    id: row._id?.toString(),
    name: row.name,
    use: row.use,
    region: row.region || "",
    preparation: row.preparation || "",
    role: row.role || "Community Member",
    notes: row.notes || "",
    author: row.author || "",
    createdAt: row.createdAt,
  };
}

// Public: anyone can browse the shared herbal knowledge base.
herbsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await collections
      .herbs()
      .find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    res.json({ herbs: rows.map(toClient) });
  } catch (err) {
    next(err);
  }
});

// Contributing requires an account (ties the entry to a real user, limits spam).
herbsRouter.post("/", requireAuth, validate(herbSchema), async (req, res, next) => {
  try {
    const h = req.valid;
    const doc = {
      userId: req.user.id,
      author: req.user.name || "",
      name: h.name,
      use: h.use,
      region: h.region,
      preparation: h.preparation,
      role: h.role,
      notes: h.notes,
      createdAt: new Date().toISOString(),
    };
    const result = await collections.herbs().insertOne(doc);
    res.status(201).json({ herb: toClient({ ...doc, _id: result.insertedId }) });
  } catch (err) {
    next(err);
  }
});

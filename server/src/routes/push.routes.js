// Web Push subscription management.
import { Router } from "express";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import { saveSubscription, removeSubscription, pushEnabled } from "../push.js";

export const pushRouter = Router();

// Public: the VAPID public key the browser needs to subscribe.
pushRouter.get("/key", (req, res) => {
  res.json({ enabled: pushEnabled(), key: config.push.publicKey || null });
});

// Save this browser's push subscription for the signed-in user.
pushRouter.post("/subscribe", requireAuth, async (req, res, next) => {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint) return res.status(400).json({ error: "Invalid subscription" });
    await saveSubscription(req.user.id, sub);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Remove a subscription (e.g. on logout).
pushRouter.post("/unsubscribe", requireAuth, async (req, res, next) => {
  try {
    await removeSubscription(req.body?.endpoint);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

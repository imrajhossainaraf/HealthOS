// Web Push (free, VAPID-based) — delivers alerts to users even when the site is
// fully closed, via the browser's own push service + a service worker.
import webpush from "web-push";
import { config } from "./config.js";
import { collections } from "./db.js";

let configured = false;
if (config.push.enabled) {
  try {
    webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
    configured = true;
    console.log("[push] Web Push enabled (VAPID configured)");
  } catch (err) {
    console.error("[push] VAPID setup failed:", err?.message || err);
  }
} else {
  console.warn("[push] Web Push disabled — set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable.");
}

export const pushEnabled = () => configured;

/** Store (or refresh) a browser push subscription for a user. */
export async function saveSubscription(userId, subscription) {
  if (!subscription?.endpoint) return;
  await collections.pushSubs().updateOne(
    { endpoint: subscription.endpoint },
    { $set: { userId, subscription, updatedAt: new Date() } },
    { upsert: true }
  );
}

/** Remove a subscription (on logout or when the browser reports it's gone). */
export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await collections.pushSubs().deleteOne({ endpoint });
}

/**
 * Send a push to every browser a user has subscribed. Best-effort; prunes dead
 * subscriptions (404/410). Payload: { title, body, url }.
 */
export async function sendPushToUser(userId, payload) {
  if (!configured || !userId) return 0;
  let subs;
  try {
    subs = await collections.pushSubs().find({ userId: String(userId) }).toArray();
  } catch {
    return 0;
  }
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload));
        sent += 1;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await collections.pushSubs().deleteOne({ endpoint: s.subscription?.endpoint }).catch(() => {});
        } else {
          console.error("[push] send failed:", err?.message || err);
        }
      }
    })
  );
  return sent;
}

/** Send a push to many users at once. */
export async function sendPushToUsers(userIds, payload) {
  const unique = [...new Set((userIds || []).map(String).filter(Boolean))];
  await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
}

"use client";

// Web Push registration — subscribes this browser so the user gets alerts even
// with the site closed. Free: uses the browser's push service + a service worker.
import { pushApi } from "@/lib/api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let registering = false;

/** Register the service worker + push subscription (idempotent, best-effort). */
export async function registerPush() {
  if (typeof window === "undefined" || registering) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  registering = true;
  try {
    const { enabled, key } = await pushApi.key();
    if (!enabled || !key) return;

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    await pushApi.subscribe(sub);
  } catch (err) {
    console.warn("[push] registration failed:", err?.message || err);
  } finally {
    registering = false;
  }
}

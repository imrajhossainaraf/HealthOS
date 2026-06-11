"use client";

// Emergency siren + browser notification helpers. The siren is synthesized with
// the Web Audio API (no audio asset needed) so it plays even when the tab is
// backgrounded — as long as the user has interacted with the page this session
// (browser autoplay policy). For a fully-closed site you'd need Web Push.

let ctx = null;
let unlocked = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/**
 * Unlock audio + request notification permission on the first user gesture
 * (both are gated by browser policy). Safe to call repeatedly.
 */
export function initAlertSound() {
  if (typeof window === "undefined" || unlocked) return;
  const signalGranted = () => window.dispatchEvent(new Event("healthos:push-ready"));
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        signalGranted();
      } else if (Notification.permission === "default") {
        Notification.requestPermission()
          .then((p) => p === "granted" && signalGranted())
          .catch(() => {});
      }
    }
    unlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

/** Play a rising/falling emergency siren for roughly `duration` seconds. */
export function playSiren(duration = 2.6) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});

  const now = c.currentTime;
  const gain = c.createGain();
  gain.connect(c.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.06);
  gain.gain.setValueAtTime(0.22, now + duration - 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.connect(gain);

  // Sweep between two tones to make the classic siren wail.
  const lo = 620, hi = 1040, period = 0.65;
  let t = now;
  osc.frequency.setValueAtTime(lo, t);
  while (t < now + duration) {
    osc.frequency.linearRampToValueAtTime(hi, t + period / 2);
    osc.frequency.linearRampToValueAtTime(lo, t + period);
    t += period;
  }
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

/** Show a browser notification (visible even when the tab isn't focused). */
export function showAlertNotification(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag: "healthos-alert", renotify: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

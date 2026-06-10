// Email delivery for HealthOS. Uses real SMTP when configured (SMTP_HOST etc.),
// otherwise falls back to a JSON transport that logs the message to the server
// console — so OTP and SOS flows are fully testable in local dev without an
// outbound mail server. `sendMail` never throws; it returns { sent, preview }.
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
// Two fields are enough: your email (SMTP_USER) + app password (SMTP_PASS).
// Host/port are only needed for non-Gmail providers.
const SMTP_CONFIGURED = Boolean(SMTP_USER && SMTP_PASS);

// Brevo HTTP email API (https://www.brevo.com) — used in production on hosts that
// block outbound SMTP (e.g. Render free tier). Sends over HTTPS, so it isn't
// blocked. When BREVO_API_KEY is set it takes priority over SMTP.
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_CONFIGURED = Boolean(BREVO_API_KEY);

const FROM = SMTP_FROM || SMTP_USER || "HealthOS <no-reply@healthos.local>";
// Brevo needs a structured sender; the address MUST be a verified sender in your
// Brevo account. Falls back to your SMTP address, then a placeholder.
const SENDER_EMAIL = (SMTP_FROM || SMTP_USER || "no-reply@healthos.local").replace(/.*<|>.*/g, "").trim();
const SENDER_NAME = process.env.EMAIL_FROM_NAME || "HealthOS";

let transport;
if (SMTP_CONFIGURED) {
  transport = nodemailer.createTransport(
    SMTP_HOST
      ? {
          // Explicit SMTP server (any provider).
          host: SMTP_HOST,
          port: Number(SMTP_PORT) || 587,
          secure: Number(SMTP_PORT) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        }
      : {
          // Gmail shortcut — just address + app password, like before.
          service: "gmail",
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        }
  );
} else {
  // Dev fallback — captures the message instead of sending it.
  transport = nodemailer.createTransport({ jsonTransport: true });
}

export const emailEnabled = BREVO_CONFIGURED || SMTP_CONFIGURED;

// Startup self-check — surfaces the active transport (and SMTP problems) in the
// logs immediately instead of failing silently on the first send. Non-blocking.
if (BREVO_CONFIGURED) {
  console.log(`[email] Brevo HTTP API active — sending as ${SENDER_NAME} <${SENDER_EMAIL}>`);
} else if (SMTP_CONFIGURED) {
  transport
    .verify()
    .then(() => console.log(`[email] SMTP ready — sending as ${FROM}`))
    .catch((err) =>
      console.error(
        `[email] SMTP NOT ready: ${err?.message || err}. ` +
          "If hosted on a platform that blocks outbound SMTP (e.g. Render free tier), " +
          "set BREVO_API_KEY to send over HTTP instead. OTP/SOS emails will fail until this is fixed."
      )
    );
} else {
  console.warn("[email] No email transport configured (set BREVO_API_KEY or SMTP_USER/SMTP_PASS) — using dev console fallback; no real emails will be sent.");
}

/** Send via Brevo's transactional HTTP API. Resolves { sent, preview }. */
async function sendViaBrevo({ to, subject, text, html }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Brevo send failed (${res.status}): ${detail.slice(0, 200)}`);
      return { sent: false, preview: null };
    }
    const data = await res.json().catch(() => ({}));
    return { sent: true, preview: data.messageId || null };
  } catch (err) {
    console.error("[email] Brevo send failed:", err?.name === "AbortError" ? "timeout" : err?.message || err);
    return { sent: false, preview: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Send an email. Safe to await; resolves to { sent, preview } and never throws. */
export async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, preview: null };
  // Prefer the HTTP API in production (works where SMTP is blocked).
  if (BREVO_CONFIGURED) return sendViaBrevo({ to, subject, text, html });
  try {
    const info = await transport.sendMail({ from: FROM, to, subject, text, html });
    if (!SMTP_CONFIGURED) {
      console.log(`\n[email:dev] → ${to}\n  subject: ${subject}\n  ${text || ""}\n`);
    }
    return { sent: true, preview: info.messageId || null };
  } catch (err) {
    console.error("[email] send failed:", err?.message || err);
    return { sent: false, preview: null };
  }
}

/** Escape user-supplied text before interpolating into email HTML. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wrap body content in a branded, email-client-safe shell (table layout +
 * inline styles — the only thing Gmail/Outlook reliably render). `accent` tints
 * the header bar and the footer rule.
 */
function renderEmailLayout({ accent = "#0d9488", preheader = "", body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px -16px rgba(15,23,42,0.25);">
        <tr><td style="background:${accent};padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">✚ HealthOS</span>
        </td></tr>
        <tr><td style="padding:28px;">${body}</td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eef2f7;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
            HealthOS — community health &amp; emergency network. This is an automated message; please do not reply.
          </p>
        </td></tr>
      </table>
      <p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#cbd5e1;text-align:center;">
        Bangladesh national emergency: <strong style="color:#94a3b8;">999</strong>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** One-time passcode for email confirmation. */
export async function sendOtpEmail(to, code) {
  const body = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;">Verify your email</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">Enter this code in HealthOS to confirm your address.</p>
    <div style="text-align:center;margin:0 0 20px;">
      <span style="display:inline-block;background:#eef2f7;border:1px solid #e2e8f0;border-radius:12px;padding:14px 28px;font-size:30px;font-weight:700;letter-spacing:8px;color:#0d9488;">${esc(code)}</span>
    </div>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>`;
  return sendMail({
    to,
    subject: "Your HealthOS verification code",
    text: `Your HealthOS verification code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: renderEmailLayout({ accent: "#0d9488", preheader: `Your code is ${code}`, body }),
  });
}

/** Emergency SOS notification to a contact / guardian / nearby responder. */
export async function sendSosEmail(to, alert, { relationship = "contact" } = {}) {
  const where =
    alert.area ||
    (alert.lat != null ? `${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}` : "Location not shared");
  const mapLink =
    alert.lat != null
      ? `https://www.openstreetmap.org/?mlat=${alert.lat}&mlon=${alert.lng}#map=16/${alert.lat}/${alert.lng}`
      : null;
  const when = alert.createdAt
    ? new Date(alert.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })
    : null;

  const row = (label, value) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;width:34%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;">${value}</td>
    </tr>`;

  const body = `
    <div style="display:inline-block;background:#fee2e2;color:#e11d48;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin:0 0 14px;">🚨 Emergency SOS</div>
    <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;line-height:1.3;">${esc(alert.victim)} needs help</h1>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#475569;">
      A HealthOS emergency beacon was triggered near you. You're receiving this as their <strong>${esc(relationship)}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      ${row("Reason", esc(alert.reason))}
      ${row("Location", esc(where))}
      ${when ? row("Triggered", esc(when)) : ""}
    </table>
    ${
      mapLink
        ? `<div style="text-align:center;margin:0 0 22px;">
            <a href="${mapLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;">📍 Open location on map</a>
          </div>`
        : ""
    }
    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:14px 16px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#9f1239;">
        Please reach out to them immediately. If this is life-threatening, call the national emergency line
        <strong style="font-size:15px;">999</strong> right away.
      </p>
    </div>`;

  return sendMail({
    to,
    subject: `🚨 Emergency alert: ${alert.victim} needs help`,
    text: `${alert.victim} triggered a HealthOS emergency SOS.
Reason: ${alert.reason}
Location: ${where}${when ? `\nTriggered: ${when}` : ""}
${mapLink ? `Map: ${mapLink}\n` : ""}You are receiving this as their ${relationship}. Please reach out, or call local emergency services (999).`,
    html: renderEmailLayout({
      accent: "#e11d48",
      preheader: `${alert.victim} triggered an emergency SOS — ${where}`,
      body,
    }),
  });
}

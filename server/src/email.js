// Email delivery for HealthOS. Uses real SMTP when configured (SMTP_HOST etc.),
// otherwise falls back to a JSON transport that logs the message to the server
// console — so OTP and SOS flows are fully testable in local dev without an
// outbound mail server. `sendMail` never throws; it returns { sent, preview }.
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
// Two fields are enough: your email (SMTP_USER) + app password (SMTP_PASS).
// Host/port are only needed for non-Gmail providers.
const SMTP_CONFIGURED = Boolean(SMTP_USER && SMTP_PASS);

const FROM = SMTP_FROM || SMTP_USER || "HealthOS <no-reply@healthos.local>";

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

export const emailEnabled = SMTP_CONFIGURED;

/** Send an email. Safe to await; resolves to { sent, preview } and never throws. */
export async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, preview: null };
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

/** One-time passcode for email confirmation. */
export async function sendOtpEmail(to, code) {
  return sendMail({
    to,
    subject: "Your HealthOS verification code",
    text: `Your HealthOS verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your HealthOS verification code is</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
<p>It expires in 10 minutes. If you didn't request this, ignore this email.</p>`,
  });
}

/** Emergency SOS notification to a contact / guardian / nearby responder. */
export async function sendSosEmail(to, alert, { relationship = "contact" } = {}) {
  const where = alert.area || (alert.lat != null ? `${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}` : "location unknown");
  const mapLink = alert.lat != null ? `https://www.openstreetmap.org/?mlat=${alert.lat}&mlon=${alert.lng}#map=16/${alert.lat}/${alert.lng}` : null;
  return sendMail({
    to,
    subject: `🚨 Emergency alert: ${alert.victim} needs help`,
    text: `${alert.victim} triggered a HealthOS emergency SOS.
Reason: ${alert.reason}
Area: ${where}
${mapLink ? `Map: ${mapLink}` : ""}
You are receiving this as their ${relationship}. Please reach out or call local emergency services (999).`,
    html: `<h2 style="color:#e11d48">🚨 Emergency SOS</h2>
<p><strong>${alert.victim}</strong> triggered a HealthOS emergency alert.</p>
<ul>
  <li><strong>Reason:</strong> ${alert.reason}</li>
  <li><strong>Area:</strong> ${where}</li>
  ${mapLink ? `<li><strong>Location:</strong> <a href="${mapLink}">Open map</a></li>` : ""}
</ul>
<p>You are receiving this as their ${relationship}. Please reach out, or call local emergency services (<strong>999</strong>).</p>`,
  });
}

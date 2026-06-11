"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Printable emergency medical card. Pass `profile`, `contacts`, and (when the
 * user is signed in) their `userId` so the QR links to a public info page.
 * Used on /profile and reused on /emergency.
 */
export default function HealthCard({ profile = {}, contacts = [], userId = null }) {
  const {
    name,
    bloodGroup,
    dob,
    gender,
    phone,
    address,
    nid,
    guardianName,
    guardianPhone,
    guardianNid,
    allergies = [],
    conditions = [],
    medications = [],
  } = profile;

  const age = dob ? calcAge(dob) : null;
  const dobText = dob ? new Date(dob).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
  const hasGuardian = guardianName || guardianPhone || guardianNid;

  // Resolve the site origin on the client (avoids SSR mismatch / impure render).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const syncOrigin = () => setOrigin(window.location.origin);
    if (typeof window !== "undefined") syncOrigin();
  }, []);

  // When signed in, the QR is a short URL to the shareable info page (scannable
  // by any responder). Otherwise fall back to a compact text card. Keeping the
  // payload short also avoids QR "data too long" overflow errors.
  const publicUrl = userId && origin ? `${origin}/u/${userId}` : null;
  const qrText =
    publicUrl ||
    [
      `HealthOS Emergency Card`,
      `Name: ${name || "—"}`,
      `Blood: ${bloodGroup || "—"}`,
      allergies.length ? `Allergies: ${allergies.slice(0, 4).join(", ")}` : null,
      contacts[0] ? `ICE: ${contacts[0].name} ${contacts[0].phone}` : null,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 280);

  const print = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="space-y-3">
      <div
        id="health-card"
        className="printable rounded-2xl border border-primary/40 bg-surface p-5 text-sm"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="font-display text-xs uppercase tracking-widest text-primary">
              HealthOS · Emergency Medical Card
            </p>
            <h3 className="mt-1 font-display text-xl font-bold">
              {name || "Unnamed"}
            </h3>
            <p className="text-muted">
              {[gender, age != null ? `${age} yrs` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted">Blood Group</p>
              <p className="font-display text-2xl font-extrabold text-emergency">
                {bloodGroup || "—"}
              </p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <QrSvg text={qrText} />
              <span className="text-[8px] leading-none text-muted">
                {publicUrl ? "Scan for info" : "Scan card"}
              </span>
            </div>
          </div>
        </div>

        {/* Identity & contact details */}
        {(dobText || phone || address || nid) && (
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3">
            {dobText && <InfoCell label="Date of birth" value={dobText} />}
            {phone && <InfoCell label="Phone" value={phone} />}
            {nid && <InfoCell label="National ID" value={nid} />}
            {address && <InfoCell label="Address" value={address} full />}
          </div>
        )}

        <CardRow label="Allergies" items={allergies} empty="None recorded" danger />
        <CardRow label="Conditions" items={conditions} empty="None recorded" />
        <CardRow label="Medications" items={medications} empty="None recorded" />

        {/* Parent / Guardian */}
        {hasGuardian && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wide text-muted">Parent / Guardian</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="font-medium">{guardianName || "Guardian"}</span>
              {guardianPhone && <span className="text-primary">{guardianPhone}</span>}
            </div>
            {guardianNid && <p className="text-xs text-muted">NID: {guardianNid}</p>}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wide text-muted">
            Emergency Contacts
          </p>
          {contacts.length === 0 ? (
            <p className="mt-1 text-muted">None added</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {contacts.map((c, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {c.name}
                    {c.relation ? (
                      <span className="text-muted"> ({c.relation})</span>
                    ) : null}
                  </span>
                  <span className="font-medium text-primary">{c.phone}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-[10px] leading-snug text-muted">
          In an emergency, call local emergency services. This card is
          informational and self-reported.
        </p>
      </div>

      <button
        type="button"
        onClick={print}
        className="no-print rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:border-primary/50"
      >
        🖨️ Print Health Card
      </button>
    </div>
  );
}

function InfoCell({ label, value, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-medium wrap-break-word">{value}</p>
    </div>
  );
}

function CardRow({ label, items, empty, danger }) {
  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      {items.length === 0 ? (
        <p className="mt-0.5 text-muted">{empty}</p>
      ) : (
        <p className={`mt-0.5 ${danger ? "font-medium text-emergency" : ""}`}>
          {items.join(", ")}
        </p>
      )}
    </div>
  );
}

/** Synchronous QR rendered as SVG rects (pure — safe to compute in render). */
function QrSvg({ text, size = 56 }) {
  // Try decreasing error-correction levels so longer payloads still render
  // instead of throwing a "data too long" length error.
  let qr = null;
  for (const errorCorrectionLevel of ["M", "L"]) {
    try {
      qr = QRCode.create(text || " ", { errorCorrectionLevel });
      break;
    } catch {
      /* try a lower level */
    }
  }
  if (!qr) return null;
  const count = qr.modules.size;
  const data = qr.modules.data;
  const cell = size / count;
  const rects = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (data[r * count + c]) {
        rects.push(
          <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0d1117" />
        );
      }
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded bg-white p-0.5"
      role="img"
      aria-label="Emergency info QR code"
    >
      {rects}
    </svg>
  );
}

function calcAge(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

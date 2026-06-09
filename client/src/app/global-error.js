"use client";

// Catches errors in the root layout itself; must render its own <html>/<body>.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ background: "#f4f6f9", color: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 700 }}>Application error</h1>
          <p style={{ marginTop: 8, color: "#64748b" }}>
            A critical error occurred. Please reload the app.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, background: "#0d9488", color: "#ffffff", border: 0, borderRadius: 12, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

// App-wide animated gradient backdrop. Fixed behind all content (-z-10) so every
// page shares the same living mesh. Kept subtle for readability over glass cards;
// honors prefers-reduced-motion via the global rule in globals.css.
export default function AppBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-base">
      {/* Soft tinted gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(13,148,136,0.10), transparent 55%)," +
            "radial-gradient(circle at 85% 12%, rgba(37,99,235,0.10), transparent 50%)," +
            "radial-gradient(circle at 50% 100%, rgba(124,58,237,0.08), transparent 55%)",
        }}
      />
      {/* Drifting color blobs */}
      <div className="mesh-blob animate-mesh left-[-8%] top-[-6%] h-80 w-80" style={{ background: "var(--color-primary)" }} />
      <div className="mesh-blob animate-float right-[-6%] top-[8%] h-72 w-72" style={{ background: "#2563eb" }} />
      <div className="mesh-blob animate-mesh left-[28%] bottom-[-12%] h-80 w-80" style={{ background: "#7c3aed", animationDelay: "-7s" }} />
    </div>
  );
}

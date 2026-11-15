export default function Logo({ size = 42, showText = false }) {
  return (
    <div className="logo-container" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      <div
        className="logo-glow-wrapper"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          padding: "2px",
          background: "linear-gradient(135deg, #a855f7, #6366f1, #c084fc)",
          boxShadow: "0 0 16px rgba(168, 85, 247, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <img
          src="/logo-scholarIQ.jpeg"
          alt="ScholarIQ Logo"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
          onError={(e) => {
            // fallback if image fails to load
            e.target.style.display = "none";
          }}
        />
      </div>
      {showText && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: "19px",
              letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #f3e8ff, #c084fc, #9333ea)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            scholarIQ
          </span>
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.22em",
              color: "#a855f7",
              fontWeight: 700,
              textTransform: "uppercase",
              marginTop: "2px",
            }}
          >
            Study · Plan · Thrive
          </span>
        </div>
      )}
    </div>
  );
}

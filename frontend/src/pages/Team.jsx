export default function Team() {
  const teamMembers = [
    {
      name: "Jeet Thakar",
      role: "Lead Architect & AI Engineer",
      focus: "Local RAG Engine (Llama 3.2 8B + nomic-embed), Vector Memory, Chrono-Regulator Algorithms",
      avatar: "JT",
      badge: "Team Lead",
    },
    {
      name: "Vydya Varshith",
      role: "Systems & Backend Specialist",
      focus: "FastAPI Engine, SQLite Data Architecture, GitHub Sentinel Radar & Hardware Optimization",
      avatar: "VV",
      badge: "Core Systems",
    },
    {
      name: "Team Member 3",
      role: "Frontend & UX Engineer",
      focus: "Purple Cosmic Design System, Interactive Micro-Interactions, Pomodoro Core & College Toolkit",
      avatar: "TM",
      badge: "UI / UX",
    },
  ];

  return (
    <div>
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>Team & System Architecture</h1>
          <p className="muted">
            Round 2 Implementation Submission • Team ScholarIQ (3 Engineers) • 100% On-Device Privacy
          </p>
        </div>
        <span className="privacy-badge">🔒 0 Bytes Uploaded to Cloud</span>
      </header>

      {/* Team Cards Grid */}
      <div className="cols-3" style={{ marginBottom: "28px" }}>
        {teamMembers.map((m, idx) => (
          <div
            key={idx}
            className="panel"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                fontSize: "11px",
                background: "rgba(168, 85, 247, 0.2)",
                border: "1px solid rgba(192, 132, 252, 0.3)",
                color: "#c084fc",
                padding: "2px 8px",
                borderRadius: "999px",
                fontWeight: 700,
              }}
            >
              {m.badge}
            </span>

            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #a855f7, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 800,
                color: "#ffffff",
                boxShadow: "0 0 20px rgba(168, 85, 247, 0.5)",
                margin: "10px 0 14px",
              }}
            >
              {m.avatar}
            </div>

            <h3 style={{ fontSize: "17px", color: "#ffffff" }}>{m.name}</h3>
            <span style={{ fontSize: "13px", color: "#c084fc", fontWeight: 600, marginBottom: "8px" }}>
              {m.role}
            </span>
            <p className="muted small" style={{ lineHeight: 1.5 }}>
              {m.focus}
            </p>
          </div>
        ))}
      </div>

      <div className="cols">
        {/* Hardware & Local AI Engine Specs */}
        <div className="panel">
          <h2>Local AI & Hardware Configuration</h2>
          <p className="muted small">
            Configured specifically for modern high-performance student laptops running quantized local weights.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
            <div
              style={{
                background: "rgba(10, 5, 21, 0.7)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <strong style={{ color: "#ffffff", display: "block" }}>
                Chat Model: Meta Llama 3.2 8B Instruct
              </strong>
              <span className="muted small">
                Served via LM Studio local server on <code>http://localhost:1234/v1</code>. Provides zero-latency, private contextual reasoning.
              </span>
            </div>

            <div
              style={{
                background: "rgba(10, 5, 21, 0.7)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <strong style={{ color: "#ffffff", display: "block" }}>
                Embedding Model: nomic-embed-text
              </strong>
              <span className="muted small">
                8192-token context window embeddings with <code>search_document:</code> and <code>search_query:</code> prefixes for high-precision syllabus retrieval.
              </span>
            </div>

            <div
              style={{
                background: "rgba(10, 5, 21, 0.7)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <strong style={{ color: "#ffffff", display: "block" }}>
                Zero Cloud Dependency
              </strong>
              <span className="muted small">
                All SQLite database files, vector representations, and model weights remain on the student's physical machine. Zero subscription fees, zero rate limits.
              </span>
            </div>
          </div>
        </div>

        {/* Round 2 Submission Criteria Checklist */}
        <div className="panel">
          <h2>Round 2 Criteria & Feature Verification</h2>
          <p className="muted small">
            Evaluation metrics fulfilled by ScholarIQ:
          </p>

          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
            {[
              { label: "Prof. Pilot RAG", desc: "Local PDF indexing with source page citations, flashcards, quizzes & viva practice." },
              { label: "Chrono-Regulator", desc: "WhatsApp notice extraction, timetable conflict detection, and dynamic priority matrix." },
              { label: "GitHub Repo Sentinel", desc: "Anti-stagnation radar, commit streaks, and project deadline warnings." },
              { label: "Wellness Core", desc: "6-metric check-in, explainable burnout score, and Pomodoro 20-20-20 eye rest." },
              { label: "Academic Toolkit", desc: "75% Attendance Safe-to-Skip rule calculator, daily habit streaks & hostel budget." },
              { label: "Purple Cosmic UI", desc: "Exciting dark luxury aesthetic with fluid animations, glowing badges, and voice input." },
            ].map((c, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  background: "rgba(26, 13, 51, 0.5)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                }}
              >
                <span style={{ color: "var(--good)", fontSize: "16px", lineHeight: 1 }}>✅</span>
                <div>
                  <strong style={{ color: "#ffffff", fontSize: "13.5px" }}>{c.label}: </strong>
                  <span className="muted small">{c.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

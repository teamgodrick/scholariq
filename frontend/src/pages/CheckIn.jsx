import { useEffect, useState } from "react";
import { api } from "../api";

const R = 56;
const C = 2 * Math.PI * R;

function Ring({ score, level }) {
  const getColor = (s) => (s >= 65 ? "#fb7185" : s >= 35 ? "#fbbf24" : "#34d399");

  return (
    <svg className="ring" viewBox="0 0 150 150" role="img" aria-label={`Burnout score ${score} of 100, ${level}`}>
      <defs>
        <linearGradient id="ring-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor={getColor(score)} />
        </linearGradient>
      </defs>
      <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(168, 85, 247, 0.15)" strokeWidth="12" />
      <circle
        cx="75"
        cy="75"
        r={R}
        fill="none"
        stroke="url(#ring-glow)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - score / 100)}
        transform="rotate(-90 75 75)"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
      <text x="75" y="77" textAnchor="middle" className="ring-num">
        {score}
      </text>
      <text x="75" y="98" textAnchor="middle" className="ring-label">
        {level} RISK
      </text>
    </svg>
  );
}

export default function CheckIn() {
  const [f, setF] = useState({
    sleep_h: 7,
    mood: 4,
    water: 6,
    meals: 3,
    exercise_m: 25,
    screentime_h: 6,
  });
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Pomodoro Focus Timer State
  const [pomoSecs, setPomoSecs] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [pomoMode, setPomoMode] = useState("focus"); // focus or break
  const [eyeRestAlert, setEyeRestAlert] = useState(false);

  useEffect(() => {
    let timer = null;
    if (pomoActive && pomoSecs > 0) {
      timer = setInterval(() => {
        setPomoSecs((s) => {
          if (s === 20 * 60 || s === 10 * 60) {
            setEyeRestAlert(true);
          }
          return s - 1;
        });
      }, 1000);
    } else if (pomoSecs === 0 && pomoActive) {
      if (pomoMode === "focus") {
        setPomoMode("break");
        setPomoSecs(5 * 60);
      } else {
        setPomoMode("focus");
        setPomoSecs(25 * 60);
      }
    }
    return () => clearInterval(timer);
  }, [pomoActive, pomoSecs, pomoMode]);

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api.checkin(f);
      setRes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>Wellness Core & Focus</h1>
          <p className="muted">
            Thirty-second holistic health check-in. Calibrates your Burnout Score and auto-shapes your daily task load.
          </p>
        </div>
        <span className="privacy-badge">🔒 Zero Cloud Upload • Device Encrypted</span>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="cols">
        {/* Left: 6-Metric Check-In Form */}
        <form className="panel" onSubmit={save}>
          <h2>Daily Vital Metrics</h2>
          <p className="muted small" style={{ marginBottom: "16px" }}>
            Helps ScholarIQ understand if you are primed for intense coding or need recovery.
          </p>

          <label>
            Hours Slept Last Night: <strong style={{ color: "#ffffff" }}>{f.sleep_h}h</strong>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={f.sleep_h}
              onChange={(e) => setF({ ...f, sleep_h: Number(e.target.value) })}
            />
          </label>

          <fieldset>
            <legend>Mental Mood & Energy</legend>
            <div className="moods">
              {[
                { n: 1, label: "😫 Low" },
                { n: 2, label: "😔 Fatigued" },
                { n: 3, label: "😐 Steady" },
                { n: 4, label: "😊 Good" },
                { n: 5, label: "🚀 High" },
              ].map((m) => (
                <button
                  type="button"
                  key={m.n}
                  className={"mood" + (f.mood === m.n ? " active" : "")}
                  onClick={() => setF({ ...f, mood: m.n })}
                  aria-pressed={f.mood === m.n}
                  title={m.label}
                >
                  {m.n}
                </button>
              ))}
            </div>
            <span className="muted small">1 = Exhausted, 3 = Average, 5 = Peak Vitality</span>
          </fieldset>

          <div className="two">
            <label>
              Glasses of Water: <strong style={{ color: "#38bdf8" }}>{f.water} / 8</strong>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={f.water}
                onChange={(e) => setF({ ...f, water: Number(e.target.value) })}
              />
            </label>
            <label>
              Proper Meals Eaten: <strong style={{ color: "#34d399" }}>{f.meals} / 3</strong>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={f.meals}
                onChange={(e) => setF({ ...f, meals: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="two">
            <label>
              Physical Activity: <strong style={{ color: "#c084fc" }}>{f.exercise_m} mins</strong>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={f.exercise_m}
                onChange={(e) => setF({ ...f, exercise_m: Number(e.target.value) })}
              />
            </label>
            <label>
              Screen Time Today: <strong style={{ color: "#fb7185" }}>{f.screentime_h} hrs</strong>
              <input
                type="range"
                min="0"
                max="16"
                step="0.5"
                value={f.screentime_h}
                onChange={(e) => setF({ ...f, screentime_h: Number(e.target.value) })}
              />
            </label>
          </div>

          <button className="primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: "10px" }}>
            {busy ? "Analyzing..." : "💾 Save Vital Check-In"}
          </button>
        </form>

        {/* Right: Burnout Gauge & Pomodoro Widget */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="panel center">
            <h2>Explainable Burnout Index</h2>
            {res ? (
              <>
                <Ring score={res.score} level={res.level} />
                <p className="advice">{res.advice}</p>
                <ul className="break">
                  <li>
                    <span>Sleep Deficit Factor</span>
                    <b>{res.breakdown.sleep} pts</b>
                  </li>
                  <li>
                    <span>Mood & Stress Factor</span>
                    <b>{res.breakdown.mood} pts</b>
                  </li>
                  <li>
                    <span>Hydration & Meals Factor</span>
                    <b>{round2(res.breakdown.water + res.breakdown.meals)} pts</b>
                  </li>
                  <li>
                    <span>Screen Time Strain</span>
                    <b>{res.breakdown.screen_time} pts</b>
                  </li>
                  <li>
                    <span>Upcoming Exam & Lab Workload</span>
                    <b>{res.breakdown.workload} pts ({res.breakdown.tasks_due_in_3_days} due ≤ 3d)</b>
                  </li>
                </ul>

                {res.score >= 65 && res.helplines && (
                  <div
                    style={{
                      background: "rgba(251, 113, 133, 0.12)",
                      border: "1px solid rgba(251, 113, 133, 0.4)",
                      borderRadius: "10px",
                      padding: "12px",
                      marginTop: "12px",
                      textAlign: "left",
                    }}
                  >
                    <strong style={{ color: "#fca5a5", display: "block", marginBottom: "4px" }}>
                      🤝 Student Health & Counseling Support
                    </strong>
                    <span className="small muted">
                      Tele-MANAS: <b style={{ color: "#ffffff" }}>{res.helplines.telemanas}</b> (24x7 Free)
                      <br />
                      KIRAN: <b style={{ color: "#ffffff" }}>{res.helplines.kiran}</b>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "30px 10px" }}>
                <Ring score={25} level="Optimal" />
                <p className="muted small" style={{ marginTop: "14px" }}>
                  Save your check-in on the left to calibrate your personalized Burnout score.
                </p>
              </div>
            )}
          </section>

          {/* Pomodoro & 20-20-20 Eye Break Timer */}
          <section className="panel pomo-widget">
            <h3>🍅 Pomodoro Focus Timer</h3>
            <p className="muted small">
              {pomoMode === "focus" ? "Active Deep Study Block" : "☕ Rejuvenation Break"}
            </p>
            <div className="pomo-timer">{formatTime(pomoSecs)}</div>

            {eyeRestAlert && (
              <div
                className="alert"
                style={{
                  background: "rgba(56, 189, 248, 0.12)",
                  borderColor: "var(--cyan)",
                  color: "#e0f2fe",
                  fontSize: "13px",
                  marginBottom: "12px",
                }}
              >
                👀 <strong>20-20-20 Eye Break Reminder:</strong> Look at an object 20 feet away for 20 seconds to prevent digital eye strain!
                <button
                  className="ghost"
                  style={{ marginLeft: "10px", padding: "2px 8px", fontSize: "11px" }}
                  onClick={() => setEyeRestAlert(false)}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              <button
                className="primary"
                onClick={() => setPomoActive(!pomoActive)}
              >
                {pomoActive ? "⏸️ Pause" : "▶️ Start Focus"}
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setPomoActive(false);
                  setPomoSecs(25 * 60);
                  setPomoMode("focus");
                  setEyeRestAlert(false);
                }}
              >
                ↺ Reset
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function round2(val) {
  return Math.round((val || 0) * 10) / 10;
}

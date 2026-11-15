import { useEffect, useState } from "react";
import { api } from "../api";

const R = 54;
const C = 2 * Math.PI * R;

const MAX_WATER = 12;
const MAX_MEALS = 4;
const MAX_EXERCISE = 90;
const MAX_SCREEN = 16;

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

  // Editable Focus Timer State
  const [focusMinsInput, setFocusMinsInput] = useState(25);
  const [breakMinsInput, setBreakMinsInput] = useState(5);
  const [pomoSecs, setPomoSecs] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [pomoMode, setPomoMode] = useState("focus"); // 'focus' or 'break'
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
        setPomoSecs(breakMinsInput * 60);
      } else {
        setPomoMode("focus");
        setPomoSecs(focusMinsInput * 60);
      }
    }
    return () => clearInterval(timer);
  }, [pomoActive, pomoSecs, pomoMode, breakMinsInput, focusMinsInput]);

  function handleSetCustomTimer(mins) {
    const validMins = Math.max(1, Math.min(180, Number(mins) || 25));
    setFocusMinsInput(validMins);
    setPomoActive(false);
    setPomoMode("focus");
    setPomoSecs(validMins * 60);
    setEyeRestAlert(false);
  }

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
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1>Wellness Core & Focus</h1>
          <p className="muted small">
            Calibrates your Burnout Score, informs your daily workload, and offers an editable focus timer.
          </p>
        </div>
        <span className="privacy-badge">🔒 100% Private Check-In</span>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="cols">
        {/* Left: Vital Check-In Form with Maximum Denominators */}
        <form className="panel" onSubmit={save} style={{ minWidth: 0 }}>
          <h2>Daily Vital Metrics</h2>
          <p className="muted small" style={{ marginBottom: "14px" }}>
            Slide your daily stats. The max possible values represent the optimal student targets.
          </p>

          <label>
            Hours Slept Last Night: <strong style={{ color: "#ffffff" }}>{f.sleep_h} / 12h</strong>
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
          </fieldset>

          <div className="two">
            <label>
              Glasses of Water: <strong style={{ color: "#38bdf8" }}>{f.water} / {MAX_WATER}</strong>
              <input
                type="range"
                min="0"
                max={MAX_WATER}
                step="1"
                value={f.water}
                onChange={(e) => setF({ ...f, water: Number(e.target.value) })}
              />
            </label>
            <label>
              Proper Meals Eaten: <strong style={{ color: "#34d399" }}>{f.meals} / {MAX_MEALS}</strong>
              <input
                type="range"
                min="0"
                max={MAX_MEALS}
                step="1"
                value={f.meals}
                onChange={(e) => setF({ ...f, meals: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="two">
            <label>
              Physical Activity: <strong style={{ color: "#c084fc" }}>{f.exercise_m} / {MAX_EXERCISE}m</strong>
              <input
                type="range"
                min="0"
                max={MAX_EXERCISE}
                step="5"
                value={f.exercise_m}
                onChange={(e) => setF({ ...f, exercise_m: Number(e.target.value) })}
              />
            </label>
            <label>
              Screen Time Today: <strong style={{ color: "#fb7185" }}>{f.screentime_h} / {MAX_SCREEN}h</strong>
              <input
                type="range"
                min="0"
                max={MAX_SCREEN}
                step="0.5"
                value={f.screentime_h}
                onChange={(e) => setF({ ...f, screentime_h: Number(e.target.value) })}
              />
            </label>
          </div>

          <button className="primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: "8px" }}>
            {busy ? "Calculating..." : "💾 Save Vital Check-In"}
          </button>
        </form>

        {/* Right: Burnout Gauge & Editable Focus Timer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", minWidth: 0 }}>
          <section className="panel center" style={{ minWidth: 0 }}>
            <h2>Burnout Index</h2>
            {res ? (
              <>
                <Ring score={res.score} level={res.level} />
                <p className="advice" style={{ fontSize: "14px" }}>{res.advice}</p>
                <ul className="break">
                  <li>
                    <span>Sleep Deficit Factor</span>
                    <b>{res.breakdown.sleep} pts</b>
                  </li>
                  <li>
                    <span>Mood Factor</span>
                    <b>{res.breakdown.mood} pts</b>
                  </li>
                  <li>
                    <span>Hydration & Meals Factor</span>
                    <b>{round2(res.breakdown.water + res.breakdown.meals)} pts</b>
                  </li>
                  <li>
                    <span>Screen Time Fatigue</span>
                    <b>{res.breakdown.screen_time} pts</b>
                  </li>
                  <li>
                    <span>Academic Deadline Load</span>
                    <b>{res.breakdown.workload} pts ({res.breakdown.tasks_due_in_3_days} due ≤ 3d)</b>
                  </li>
                </ul>

                {res.score >= 65 && res.helplines && (
                  <div
                    style={{
                      background: "rgba(251, 113, 133, 0.12)",
                      border: "1px solid rgba(251, 113, 133, 0.4)",
                      borderRadius: "9px",
                      padding: "10px",
                      marginTop: "10px",
                      textAlign: "left",
                    }}
                  >
                    <strong style={{ color: "#fca5a5", fontSize: "12.5px", display: "block" }}>
                      🤝 Student Health Support
                    </strong>
                    <span className="small muted">
                      Tele-MANAS: <b style={{ color: "#ffffff" }}>{res.helplines.telemanas}</b> (24x7 Free)
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "20px 10px" }}>
                <Ring score={25} level="Optimal" />
                <p className="muted small" style={{ marginTop: "10px" }}>
                  Save your check-in on the left to calibrate your personalized Burnout score.
                </p>
              </div>
            )}
          </section>

          {/* Editable Focus Timer */}
          <section className="panel pomo-widget" style={{ minWidth: 0 }}>
            <h3>⏱️ Customizable Focus Timer</h3>
            <p className="muted small">
              {pomoMode === "focus" ? "🎯 Deep Focus Interval" : "☕ Rejuvenation Break"}
            </p>
            <div className="pomo-timer">{formatTime(pomoSecs)}</div>

            {/* Editable Focus Minutes Setting */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", margin: "10px 0" }}>
              <span className="small muted">Focus Time:</span>
              {[15, 25, 45, 60].map((m) => (
                <button
                  key={m}
                  className={`ghost ${focusMinsInput === m ? "active" : ""}`}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    background: focusMinsInput === m ? "rgba(168, 85, 247, 0.3)" : undefined,
                    borderColor: focusMinsInput === m ? "var(--purple-bright)" : undefined,
                  }}
                  onClick={() => handleSetCustomTimer(m)}
                >
                  {m}m
                </button>
              ))}
              {/* Custom Number Input */}
              <input
                type="number"
                min="1"
                max="180"
                value={focusMinsInput}
                onChange={(e) => handleSetCustomTimer(e.target.value)}
                style={{ width: "55px", padding: "4px 6px", fontSize: "12px", textAlign: "center", margin: 0 }}
                title="Enter custom minutes"
              />
              <span className="small muted">mins</span>
            </div>

            {eyeRestAlert && (
              <div
                className="alert"
                style={{
                  background: "rgba(56, 189, 248, 0.12)",
                  borderColor: "var(--cyan)",
                  color: "#e0f2fe",
                  fontSize: "12px",
                  marginBottom: "10px",
                }}
              >
                👀 <strong>20-20-20 Eye Break:</strong> Look at an object 20 feet away for 20 seconds!
                <button
                  className="ghost"
                  style={{ marginLeft: "8px", padding: "1px 6px", fontSize: "10.5px" }}
                  onClick={() => setEyeRestAlert(false)}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "12px" }}>
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
                  setPomoSecs(focusMinsInput * 60);
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

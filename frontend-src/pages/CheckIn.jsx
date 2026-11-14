import { useState } from "react";
import { api } from "../api";

const R = 54;
const C = 2 * Math.PI * R;

function Ring({ score, level }) {
  return (
    <svg className="ring" viewBox="0 0 140 140" role="img" aria-label={`Burnout score ${score} of 100, ${level}`}>
      <defs>
        <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB347" />
          <stop offset="1" stopColor="#FF4B2B" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r={R} fill="none" stroke="#33242A" strokeWidth="12" />
      <circle cx="70" cy="70" r={R} fill="none" stroke="url(#ring-g)" strokeWidth="12"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)}
        transform="rotate(-90 70 70)" />
      <text x="70" y="72" textAnchor="middle" className="ring-num">{score}</text>
      <text x="70" y="94" textAnchor="middle" className="ring-label">{level}</text>
    </svg>
  );
}

export default function CheckIn() {
  const [f, setF] = useState({ sleep_h: 7, mood: 3, water: 4 });
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      setRes(await api.checkin(f));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1>Daily check-in</h1>
        <p className="muted">Thirty seconds. Your plan adapts to how you actually feel.</p>
      </header>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="cols">
        <form className="panel" onSubmit={save}>
          <label>Hours slept: <strong>{f.sleep_h}</strong>
            <input type="range" min="0" max="12" step="0.5" value={f.sleep_h}
              onChange={(e) => setF({ ...f, sleep_h: Number(e.target.value) })} />
          </label>
          <fieldset>
            <legend>Mood today</legend>
            <div className="moods">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n}
                  className={"mood" + (f.mood === n ? " active" : "")}
                  onClick={() => setF({ ...f, mood: n })} aria-pressed={f.mood === n}>
                  {n}
                </button>
              ))}
            </div>
            <span className="muted small">1 is low, 5 is great</span>
          </fieldset>
          <label>Glasses of water: <strong>{f.water}</strong>
            <input type="range" min="0" max="12" step="1" value={f.water}
              onChange={(e) => setF({ ...f, water: Number(e.target.value) })} />
          </label>
          <button className="primary" type="submit">Save check-in</button>
        </form>

        <section className="panel center">
          {res ? (
            <>
              <Ring score={res.score} level={res.level} />
              <p className="advice">{res.advice}</p>
              <ul className="break">
                <li>Sleep <b>{res.breakdown.sleep}</b></li>
                <li>Mood <b>{res.breakdown.mood}</b></li>
                <li>Water <b>{res.breakdown.water}</b></li>
                <li>Workload <b>{res.breakdown.workload}</b> ({res.breakdown.tasks_due_in_3_days} tasks due in 3 days)</li>
              </ul>
              <p className="muted small">Guidance only, not medical advice.</p>
            </>
          ) : (
            <p className="muted">Save your check-in to see your burnout score and today&apos;s advice.</p>
          )}
        </section>
      </div>
    </div>
  );
}

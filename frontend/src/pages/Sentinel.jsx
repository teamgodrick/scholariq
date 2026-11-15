import { useEffect, useState } from "react";
import { api } from "../api";

export default function Sentinel() {
  const [data, setData] = useState({
    owner: "team-scholars",
    repo: "ScholarIQ",
    last_commit_date: new Date().toISOString().slice(0, 10),
    last_commit_msg: "feat: universal academic OS with holiday detection and safe-to-skip",
    commits_today: 4,
    streak_days: 7,
    days_inactive: 0,
    days_until_deadline: 3,
    is_stagnant: false,
    health_score: 95,
    stagnant_warning: "🔥 Code Velocity Optimal: Fresh commits recorded today. Keep steady cadence.",
    recovery_plan: ["Maintain current momentum: write unit tests or refine UI micro-interactions."],
    purpose_explanation:
      "Why Sentinel Matters: Indian university project evaluators and hackathon judges penalize 'last-minute dump commits'. Sentinel tracks your continuous development velocity, keeps your team accountable, and eliminates 2 AM panic merges.",
  });
  const [ownerInput, setOwnerInput] = useState("team-scholars");
  const [repoInput, setRepoInput] = useState("ScholarIQ");
  const [deadlineInput, setDeadlineInput] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [commitMsg, setCommitMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const refresh = (owner = ownerInput, repo = repoInput, deadline = deadlineInput) => {
    setBusy(true);
    api
      .checkRepo({ owner, repo, deadline })
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  async function handleSimulateCommit(e) {
    e.preventDefault();
    if (!commitMsg.trim()) return;
    try {
      await api.checkRepo({
        owner: ownerInput,
        repo: repoInput,
        deadline: deadlineInput,
      });
      setData((prev) => ({
        ...prev,
        last_commit_msg: commitMsg,
        commits_today: prev.commits_today + 1,
        streak_days: prev.streak_days + 1,
        days_inactive: 0,
        is_stagnant: false,
        health_score: Math.min(100, prev.health_score + 10),
        stagnant_warning: "🔥 Fresh commit recorded! Project velocity restored.",
        recovery_plan: ["Great work! Keep pushing atomic commits as each sub-feature finishes."],
      }));
      setCommitMsg("");
      setNote("✅ Code commit logged successfully! Anti-stagnation radar cleared.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ minWidth: 0 }}>
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1>GitHub Repo Sentinel</h1>
          <p className="muted small">
            Continuous development velocity & anti-stagnation radar for academic projects and hackathons.
          </p>
        </div>
        <span className="privacy-badge">🛡️ Project Health: {data.health_score}%</span>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {note && (
        <p className="ok small" style={{ marginBottom: "14px", padding: "8px 12px", background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "8px" }}>
          {note}
        </p>
      )}

      {/* Explanatory Purpose Box: What real problem it solves */}
      <div
        className="panel"
        style={{
          marginBottom: "18px",
          background: "linear-gradient(135deg, rgba(26, 13, 51, 0.8), rgba(13, 7, 26, 0.8))",
          border: "1px solid rgba(168, 85, 247, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontSize: "18px" }}>💡</span>
          <strong style={{ color: "#ffffff", fontSize: "14px" }}>
            The Student Problem Sentinel Solves:
          </strong>
        </div>
        <p className="muted small" style={{ lineHeight: 1.5, margin: 0 }}>
          {data.purpose_explanation}
        </p>
      </div>

      {/* Stagnant Warning Alert or Optimal Status */}
      {data.is_stagnant ? (
        <div
          className="alert"
          style={{
            background: "rgba(251, 113, 133, 0.15)",
            borderColor: "var(--bad)",
            color: "#fecdd3",
            padding: "14px",
            fontSize: "13.5px",
            marginBottom: "18px",
          }}
        >
          {data.stagnant_warning}
        </div>
      ) : (
        <div
          className="tip"
          style={{
            borderColor: "var(--good)",
            background: "linear-gradient(90deg, rgba(52, 211, 153, 0.12), rgba(18, 9, 36, 0.85))",
            color: "#d1fae5",
          }}
        >
          <span style={{ fontSize: "18px" }}>🛡️</span>
          <div style={{ minWidth: 0 }}>
            <strong style={{ color: "#ffffff" }}>Velocity Status: </strong>
            {data.stagnant_warning}
          </div>
        </div>
      )}

      {/* Sentinel Radar Stats Grid */}
      <div className="sentinel-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📦</span> {data.owner} / {data.repo}
            </h2>
            <p className="muted small">
              Submission Deadline: <strong>{deadlineInput}</strong> ({data.days_until_deadline} day(s) remaining)
            </p>
          </div>
          <button className="ghost" onClick={() => refresh()} disabled={busy}>
            {busy ? "Syncing..." : "🔄 Refresh Radar"}
          </button>
        </div>

        <div className="radar-grid">
          <div className="radar-stat">
            <div className="num" style={{ color: data.health_score >= 70 ? "var(--good)" : "var(--warn)" }}>
              {data.health_score}%
            </div>
            <div className="lbl">Velocity Health</div>
          </div>
          <div className="radar-stat">
            <div className="num">{data.streak_days} 🔥</div>
            <div className="lbl">Commit Streak</div>
          </div>
          <div className="radar-stat">
            <div className="num" style={{ color: data.days_inactive >= 2 ? "var(--bad)" : "var(--good)" }}>
              {data.days_inactive}d
            </div>
            <div className="lbl">Inactivity Days</div>
          </div>
          <div className="radar-stat">
            <div className="num" style={{ color: "#38bdf8" }}>{data.commits_today}</div>
            <div className="lbl">Commits Today</div>
          </div>
        </div>

        {/* Latest Commit Snippet */}
        <div
          style={{
            background: "rgba(10, 5, 21, 0.7)",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            marginTop: "12px",
          }}
        >
          <span className="muted small" style={{ display: "block", marginBottom: "3px" }}>
            Latest Tracked Commit:
          </span>
          <code style={{ fontFamily: "JetBrains Mono, monospace", color: "#c084fc", fontSize: "12.5px" }}>
            &quot;{data.last_commit_msg}&quot;
          </code>
          <span className="muted small" style={{ display: "block", marginTop: "3px" }}>
            Timestamp: {data.last_commit_date}
          </span>
        </div>

        {/* Actionable Recovery Recommendations */}
        {data.recovery_plan && data.recovery_plan.length > 0 && (
          <div style={{ marginTop: "14px" }}>
            <span className="small muted" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
              📋 Sentinel Action Plan for Your Team:
            </span>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
              {data.recovery_plan.map((step, idx) => (
                <li
                  key={idx}
                  style={{
                    background: "rgba(168, 85, 247, 0.1)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12.5px",
                    color: "#e9d5ff",
                  }}
                >
                  ⚡ {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="cols gap">
        {/* Monitored Project Settings */}
        <div className="panel" style={{ minWidth: 0 }}>
          <h2>Configure Target Project</h2>
          <p className="muted small">
            Set your hackathon or semester capstone repository to monitor.
          </p>
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="two">
              <label>
                GitHub Owner / Team
                <input
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder="e.g. facebook"
                />
              </label>
              <label>
                Repository Name
                <input
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="e.g. react"
                />
              </label>
            </div>
            <label>
              Milestone Deadline
              <input
                type="date"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={() => refresh(ownerInput, repoInput, deadlineInput)}
              disabled={busy}
            >
              Update Monitored Project
            </button>
          </div>
        </div>

        {/* Quick Log Commit */}
        <div className="panel" style={{ minWidth: 0 }}>
          <h2>Log Git Activity</h2>
          <p className="muted small">
            Push code locally or log an intermediate commit to maintain your streak.
          </p>
          <form onSubmit={handleSimulateCommit} style={{ marginTop: "12px" }}>
            <label>
              Commit Message
              <input
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="e.g. feat: attendance safe-to-skip calculator"
              />
            </label>
            <button
              className="primary"
              type="submit"
              disabled={!commitMsg.trim()}
              style={{ width: "100%", marginTop: "8px" }}
            >
              🚀 Record Commit & Update Velocity
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

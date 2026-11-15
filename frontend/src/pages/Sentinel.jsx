import { useEffect, useState } from "react";
import { api } from "../api";

export default function Sentinel() {
  const [data, setData] = useState({
    owner: "team-scholars",
    repo: "ScholarIQ",
    last_commit_date: new Date().toISOString().slice(0, 10),
    last_commit_msg: "feat: purple cosmic UI and local RAG engine",
    commits_today: 3,
    streak_days: 7,
    days_inactive: 0,
    days_until_deadline: 2,
    is_stagnant: false,
    stagnant_warning: "🔥 Streak Active! Great job keeping the codebase moving today.",
  });
  const [ownerInput, setOwnerInput] = useState("team-scholars");
  const [repoInput, setRepoInput] = useState("ScholarIQ");
  const [deadlineInput, setDeadlineInput] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
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
        stagnant_warning: "🔥 Code commit recorded! Repo Sentinel cleared.",
      }));
      setCommitMsg("");
      setNote("✅ Commit activity recorded successfully!");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>GitHub Repo Sentinel</h1>
          <p className="muted">
            Monitors academic projects & hackathons. Detects code stagnation and warns when deadlines approach without git commits.
          </p>
        </div>
        <span className="privacy-badge">🛡️ Sentinel Radar Active</span>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {note && (
        <p className="ok small" style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "8px" }}>
          {note}
        </p>
      )}

      {/* Stagnant Warning Alert */}
      {data.is_stagnant ? (
        <div
          className="alert"
          style={{
            background: "rgba(251, 113, 133, 0.15)",
            borderColor: "var(--bad)",
            color: "#fecdd3",
            padding: "16px",
            fontSize: "15px",
            marginBottom: "24px",
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
          <span style={{ fontSize: "20px" }}>🛡️</span>
          <div>
            <strong>Repo Health Status: </strong>
            {data.stagnant_warning || "Active commit pace detected. Codebase is in good shape."}
          </div>
        </div>
      )}

      {/* Sentinel Radar Stats */}
      <div className="sentinel-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📦</span> {data.owner} / {data.repo}
            </h2>
            <p className="muted small">
              Deadline: <strong>{deadlineInput}</strong> ({data.days_until_deadline} day(s) remaining)
            </p>
          </div>
          <button className="ghost" onClick={() => refresh()} disabled={busy}>
            {busy ? "Checking Git..." : "🔄 Sync Sentinel"}
          </button>
        </div>

        <div className="radar-grid">
          <div className="radar-stat">
            <div className="num">{data.streak_days} 🔥</div>
            <div className="lbl">Day Commit Streak</div>
          </div>
          <div className="radar-stat">
            <div className="num" style={{ color: "#38bdf8" }}>{data.commits_today}</div>
            <div className="lbl">Commits Today</div>
          </div>
          <div className="radar-stat">
            <div className="num" style={{ color: data.days_inactive >= 2 ? "#fb7185" : "#34d399" }}>
              {data.days_inactive}d
            </div>
            <div className="lbl">Days Since Last Commit</div>
          </div>
          <div className="radar-stat">
            <div className="num" style={{ color: "#fbbf24" }}>{data.days_until_deadline}d</div>
            <div className="lbl">Deadline Countdown</div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(10, 5, 21, 0.7)",
            padding: "14px 18px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            marginTop: "16px",
          }}
        >
          <span className="muted small" style={{ display: "block", marginBottom: "4px" }}>
            Latest Git Commit:
          </span>
          <code style={{ fontFamily: "JetBrains Mono, monospace", color: "#c084fc", fontSize: "13.5px" }}>
            &quot;{data.last_commit_msg}&quot;
          </code>
          <span className="muted small" style={{ display: "block", marginTop: "4px" }}>
            Date: {data.last_commit_date}
          </span>
        </div>
      </div>

      <div className="cols gap">
        {/* Track Different Repo */}
        <div className="panel">
          <h2>Configure Monitored Project</h2>
          <p className="muted small">
            Set your hackathon or semester course GitHub repository and target deadline.
          </p>
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="two">
              <label>
                GitHub Owner / Org
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
              Project / Submission Deadline
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
              Update Sentinel Target
            </button>
          </div>
        </div>

        {/* Quick Log Commit */}
        <div className="panel">
          <h2>Log Git Activity</h2>
          <p className="muted small">
            Record a commit or test the anti-stagnation radar during the demo.
          </p>
          <form onSubmit={handleSimulateCommit} style={{ marginTop: "14px" }}>
            <label>
              Commit Message
              <input
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="e.g. feat: integrate vector retrieval with citations"
              />
            </label>
            <button
              className="primary"
              type="submit"
              disabled={!commitMsg.trim()}
              style={{ width: "100%", marginTop: "10px" }}
            >
              🚀 Record Commit & Update Streak
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

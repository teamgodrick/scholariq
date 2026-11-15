import { useEffect, useState } from "react";
import { api } from "../api";

const TYPES = ["exam", "lab", "assignment", "project", "placement", "other"];
const bucket = (d) => (d <= 0 ? "now" : d <= 3 ? "soon" : "later");

export default function Dashboard() {
  const [plan, setPlan] = useState({ items: [], tip: "", timetable: [], clashes: [] });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", due_date: "", type: "assignment" });

  const load = () =>
    api
      .plan()
      .then(setPlan)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function extract() {
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const t = await api.extract(message);
      setForm(t);
      setNote(`🎯 Extracted "${t.title}" (Due: ${t.due_date}, Type: ${t.type}). Review and click 'Schedule Task'.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.due_date) {
      setError("Please add both a task title and a valid due date.");
      return;
    }
    setError("");
    setNote("");
    try {
      await api.addTask(form);
      setForm({ title: "", due_date: "", type: "assignment" });
      setMessage("");
      setNote("✅ Task added to Chrono-Regulator priority matrix!");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function done(id) {
    await api.doneTask(id);
    load();
  }

  async function remove(id) {
    await api.deleteTask(id);
    load();
  }

  async function triggerReplan() {
    setBusy(true);
    try {
      const res = await api.replan();
      setNote(`⚡ ${res.status} (${res.replanned_count} overdue task(s) adjusted)`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const urgentCount = plan.items?.filter((i) => i.days_left <= 1 && !i.deferred).length || 0;

  return (
    <div>
      {/* Hero Banner with cosmic ScholarIQ graphic */}
      <div className="hero-banner">
        <img src="/banner-scholarIQ.jpeg" alt="ScholarIQ Banner" />
        <div className="hero-overlay">
          <div>
            <h1>Chrono-Regulator Command Center</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {today} • Today's Academic & Deadline Priority Plan
            </p>
          </div>
        </div>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {note && <p className="ok small" style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "8px" }}>{note}</p>}

      {/* Burnout-Aware Tip Banner */}
      <div className="tip">
        <span style={{ fontSize: "20px" }}>💡</span>
        <div style={{ flex: 1 }}>
          <strong style={{ color: "#ffffff" }}>Chrono-Regulator Intelligence: </strong>
          {plan.tip}
        </div>
        <button className="ghost" onClick={triggerReplan} disabled={busy} title="Auto-reschedule overdue tasks">
          🔄 Re-plan Missed Tasks
        </button>
      </div>

      {/* Clashes Alert */}
      {plan.clashes && plan.clashes.length > 0 && (
        <div className="alert" style={{ background: "rgba(251, 191, 36, 0.12)", borderColor: "var(--warn)", color: "#fef08a" }}>
          ⚠️ <strong>Schedule Clash Detected:</strong> {plan.clashes.join(" | ")}
        </div>
      )}

      <div className="cols">
        {/* Left Column: Priority Matrix */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div>
              <h2>Ranked Priority Plan</h2>
              <p className="muted small">
                {plan.items?.length === 0
                  ? "No pending tasks. You are all caught up!"
                  : `${plan.items?.length} open tasks • ${urgentCount} urgent (due ≤ 24h)`}
              </p>
            </div>
            <span className="privacy-badge">🔒 Local Evaluation Only</span>
          </div>

          <ul className="plan">
            {plan.items?.map((i) => (
              <li key={i.id} className={`row ${bucket(i.days_left)}${i.deferred ? " deferred" : ""}`}>
                <div className="row-main">
                  <strong>{i.title}</strong>
                  <span className="muted small" style={{ marginTop: "3px" }}>
                    <span style={{ textTransform: "capitalize", color: "#c084fc", fontWeight: 600 }}>{i.type}</span> • {i.reason}
                    {i.deferred ? " • ⏸️ Deferred by Burnout Core" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="score" title="Dynamic Priority Score (Urgency + Type)">
                    {i.priority}
                  </span>
                  <button className="ghost" onClick={() => done(i.id)} title="Mark as finished">
                    ✓ Done
                  </button>
                  <button
                    className="ghost"
                    onClick={() => remove(i.id)}
                    style={{ padding: "6px 8px", color: "#fca5a5" }}
                    title="Remove task"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Today's Timetable Section */}
          <div className="gap">
            <h2>Today&apos;s Class Timetable</h2>
            <p className="muted small">Syncs with your weekly academic schedule and detects room clashes.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
              {plan.timetable && plan.timetable.length > 0 ? (
                plan.timetable.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "rgba(26, 13, 51, 0.6)",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#ffffff" }}>{c.subject}</strong>
                      <span className="muted small" style={{ display: "block" }}>
                        {c.room} • {c.professor} ({c.type})
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        color: "#c084fc",
                        background: "rgba(168, 85, 247, 0.15)",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {c.start_time} - {c.end_time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted small">No scheduled classes today. Great time for deep project focus!</p>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: AI Extraction & Add Task */}
        <section className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "20px" }}>💬</span>
            <h2>Paste WhatsApp Notice</h2>
          </div>
          <p className="muted small">
            Paste messy CR announcements, club notices or lab emails. The local LLM parses dates, subjects and urgency.
          </p>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. All 3rd year CSE students: DAA Lab Assignment 3 must be submitted on GitHub by this Friday 11:59 PM. Late submissions will lose 20% marks."
          />
          <button className="primary" onClick={extract} disabled={busy} style={{ width: "100%" }}>
            {busy ? "Parsing with Llama 3.2..." : "🔍 Find Deadline with Local LLM"}
          </button>

          <h2 className="gap">Schedule New Task</h2>
          <form onSubmit={add} style={{ marginTop: "12px" }}>
            <label>
              Task Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. OS Memory Management Lab Report"
              />
            </label>
            <div className="two">
              <label>
                Due Date
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </label>
              <label>
                Academic Type
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="primary" type="submit" style={{ width: "100%", marginTop: "10px" }}>
              ➕ Add to Priority Matrix
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

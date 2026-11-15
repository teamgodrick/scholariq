import { useEffect, useState } from "react";
import { api } from "../api";

const TYPES = ["exam", "lab", "assignment", "project", "placement", "other"];
const bucket = (d) => (d <= 0 ? "now" : d <= 3 ? "soon" : "later");
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Dashboard() {
  const [plan, setPlan] = useState({
    items: [],
    tip: "",
    timetable: [],
    clashes: [],
    is_holiday: false,
    holiday_name: "",
  });
  const [selectedDay, setSelectedDay] = useState(
    new Date().toLocaleDateString("en-US", { weekday: "long" })
  );
  const [dayClasses, setDayClasses] = useState([]);
  const [dayHoliday, setDayHoliday] = useState({ is_holiday: false, holiday_name: "" });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", due_date: "", type: "assignment" });

  const load = () => {
    api
      .plan()
      .then((data) => {
        setPlan(data);
        setDayClasses(data.timetable || []);
        setDayHoliday({ is_holiday: data.is_holiday, holiday_name: data.holiday_name });
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  // When student clicks a specific day of week
  const fetchDaySchedule = (day) => {
    setSelectedDay(day);
    api
      .getTimetable(day)
      .then((res) => {
        setDayClasses(res.classes || []);
        setDayHoliday({ is_holiday: res.is_holiday, holiday_name: res.holiday_name });
      })
      .catch(() => {});
  };

  const todayStr = new Date().toLocaleDateString("en-IN", {
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
      {/* Crisp ScholarIQ Modern Cosmic Banner without emoji hat */}
      <div className="hero-banner">
        <div className="hero-banner-content">
          <div className="hero-brand-block">
            <span className="hero-brand-title">scholarIQ</span>
            <div className="hero-brand-sub">
              STUDY <span>•</span> PLAN <span>•</span> THRIVE
            </div>
          </div>
          <div className="hero-desc-block">
            <span className="hero-desc-title">Chrono-Regulator Command Center</span>
            <span className="hero-desc-date">
              {todayStr} • Academic Intelligence & Priority Daily Plan
            </span>
          </div>
        </div>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {note && (
        <p
          className="ok small"
          style={{
            marginBottom: "14px",
            padding: "8px 12px",
            background: "rgba(52, 211, 153, 0.1)",
            border: "1px solid rgba(52, 211, 153, 0.3)",
            borderRadius: "8px",
          }}
        >
          {note}
        </p>
      )}

      {/* Holiday Notification Popup / Banner if Today is Holiday */}
      {plan.is_holiday && (
        <div className="holiday-card">
          <span style={{ fontSize: "28px" }}>🎉</span>
          <div>
            <strong style={{ fontSize: "16px", color: "#fef08a", display: "block" }}>
              College Holiday Today: {plan.holiday_name}
            </strong>
            <span className="small" style={{ color: "#fde68a" }}>
              All classes suspended. Enjoy your break, catch up on sleep, or make progress on your side projects!
            </span>
          </div>
        </div>
      )}

      {/* Burnout & Workload Tip */}
      <div className="tip">
        <span style={{ fontSize: "18px" }}>💡</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ color: "#ffffff" }}>Daily Intelligence: </strong>
          {plan.tip}
        </div>
        <button className="ghost" onClick={triggerReplan} disabled={busy} title="Auto-reschedule overdue tasks">
          🔄 Re-plan Tasks
        </button>
      </div>

      {plan.clashes && plan.clashes.length > 0 && (
        <div className="alert" style={{ background: "rgba(251, 191, 36, 0.12)", borderColor: "var(--warn)", color: "#fef08a" }}>
          ⚠️ <strong>Schedule Clash:</strong> {plan.clashes.join(" | ")}
        </div>
      )}

      <div className="cols">
        {/* Left Column: Priority Tasks & Daily Schedule */}
        <section style={{ minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <h2>Ranked Priority Plan</h2>
            <span className="privacy-badge">🔒 Local Evaluation</span>
          </div>
          <p className="muted small">
            {plan.items?.length === 0
              ? "No pending tasks. You are all caught up!"
              : `${plan.items?.length} open tasks • ${urgentCount} urgent (due ≤ 24h)`}
          </p>

          <ul className="plan">
            {plan.items?.map((i) => (
              <li key={i.id} className={`row ${bucket(i.days_left)}${i.deferred ? " deferred" : ""}`}>
                <div className="row-main">
                  <strong>{i.title}</strong>
                  <span className="muted small" style={{ marginTop: "2px" }}>
                    <span style={{ textTransform: "capitalize", color: "#c084fc", fontWeight: 600 }}>{i.type}</span> • {i.reason}
                    {i.deferred ? " • ⏸️ Deferred by Burnout Core" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span className="score" title="Dynamic Priority Score">
                    {i.priority}
                  </span>
                  <button className="ghost" onClick={() => done(i.id)} title="Mark as finished">
                    ✓ Done
                  </button>
                  <button
                    className="ghost"
                    onClick={() => remove(i.id)}
                    style={{ padding: "5px 8px", color: "#fca5a5" }}
                    title="Remove task"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Timetable Section with Day Selector */}
          <div className="gap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <h2>Class Schedule ({selectedDay})</h2>
              {/* Day filter pills */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {DAYS.map((d) => (
                  <button
                    key={d}
                    className={`ghost ${selectedDay === d ? "active" : ""}`}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      background: selectedDay === d ? "rgba(168, 85, 247, 0.3)" : undefined,
                      borderColor: selectedDay === d ? "var(--purple-bright)" : undefined,
                    }}
                    onClick={() => fetchDaySchedule(d)}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {dayHoliday.is_holiday ? (
                <div className="holiday-card" style={{ margin: 0 }}>
                  <span style={{ fontSize: "24px" }}>🏖️</span>
                  <div>
                    <strong style={{ color: "#fef08a" }}>Holiday: {dayHoliday.holiday_name}</strong>
                    <p className="small muted" style={{ margin: "2px 0 0" }}>No classes scheduled on this day.</p>
                  </div>
                </div>
              ) : dayClasses.length > 0 ? (
                dayClasses.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "rgba(26, 13, 51, 0.6)",
                      border: "1px solid var(--line)",
                      borderRadius: "9px",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: "#ffffff", fontSize: "13.5px" }}>{c.subject}</strong>
                      <span className="muted small" style={{ display: "block" }}>
                        {c.room} • {c.professor} ({c.type})
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        color: "#c084fc",
                        background: "rgba(168, 85, 247, 0.15)",
                        padding: "3px 8px",
                        borderRadius: "5px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {c.start_time} - {c.end_time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted small" style={{ padding: "8px 0" }}>
                  No classes scheduled for {selectedDay}.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: AI Extraction & Add Task */}
        <section className="panel" style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "18px" }}>💬</span>
            <h2>Paste WhatsApp Notice</h2>
          </div>
          <p className="muted small">
            Paste messy CR announcements, club notices or lab emails. The AI parses dates, subjects and urgency.
          </p>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. All CSE 3rd years: DAA Lab Assignment 3 must be submitted on GitHub by this Friday 11:59 PM."
          />
          <button className="primary" onClick={extract} disabled={busy} style={{ width: "100%" }}>
            {busy ? "Parsing Notice..." : "🔍 Find Deadline with AI"}
          </button>

          <h2 className="gap">Schedule New Task</h2>
          <form onSubmit={add} style={{ marginTop: "10px" }}>
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
            <button className="primary" type="submit" style={{ width: "100%", marginTop: "8px" }}>
              ➕ Add to Priority Matrix
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../api";

export default function Toolkit() {
  const [activeSubTab, setActiveSubTab] = useState("attendance");
  const [attendance, setAttendance] = useState([]);
  const [habits, setHabits] = useState([]);
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Attendance Form
  const [newSubj, setNewSubj] = useState({ subject: "", attended: 20, total: 25, target_pct: 75.0 });

  // Exam Mode Planner Form
  const [examForm, setExamForm] = useState({
    subject: "Distributed Systems & Cloud Computing",
    exam_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
    topics: "Raft Consensus, CAP Theorem, MapReduce, Vector Clocks, Microservices",
  });
  const [examRoadmap, setExamRoadmap] = useState("");
  const [busyExam, setBusyExam] = useState(false);

  // Budget Form
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", category: "Food" });

  // Habit Form
  const [habitTitle, setHabitTitle] = useState("");

  const loadData = () => {
    api.getAttendance().then(setAttendance).catch(() => {});
    api.getHabits().then(setHabits).catch(() => {});
    api.getBudget().then(setBudget).catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  async function handleMarkAttendance(subj, attended) {
    try {
      const res = await api.markAttendance({ subject: subj, attended });
      setAttendance(res);
      setNote(`Marked ${subj} as ${attended ? "attended ✅" : "missed ❌"}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddSubject(e) {
    e.preventDefault();
    if (!newSubj.subject.trim()) return;
    try {
      const res = await api.saveAttendance(newSubj);
      setAttendance(res);
      setNewSubj({ subject: "", attended: 20, total: 25, target_pct: 75.0 });
      setNote("✅ Subject added to 75% Attendance Tracker!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleHabit(id) {
    try {
      const res = await api.toggleHabit(id);
      setHabits(res);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddHabit(e) {
    e.preventDefault();
    if (!habitTitle.trim()) return;
    try {
      const res = await api.addHabit({ title: habitTitle, category: "Study" });
      setHabits(res);
      setHabitTitle("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;
    try {
      const res = await api.addBudget({
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        type: "expense",
      });
      setBudget(res);
      setExpenseForm({ title: "", amount: "", category: "Food" });
      setNote("Expense logged!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateExamPlan(e) {
    e.preventDefault();
    setBusyExam(true);
    setError("");
    try {
      const res = await api.generateExamPlan(examForm);
      setExamRoadmap(res.roadmap);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyExam(false);
    }
  }

  return (
    <div>
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>Academic & Routine Toolkit</h1>
          <p className="muted">
            Essential engineering tools: 75% Attendance Safe-to-Skip, Habit Streaks, Hostel Budget & Exam Mode Planner.
          </p>
        </div>
        <span className="privacy-badge">🎓 College OS</span>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {note && (
        <p className="ok small" style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "8px" }}>
          {note}
        </p>
      )}

      {/* Sub Tabs */}
      <div className="mode-tabs">
        {[
          { id: "attendance", label: "📊 75% Attendance Calculator" },
          { id: "exam", label: "🎯 Exam Mode Planner" },
          { id: "habits", label: "🔥 Habit Streaks" },
          { id: "budget", label: "💰 Hostel Budget" },
        ].map((t) => (
          <button
            key={t.id}
            className={`mode-btn ${activeSubTab === t.id ? "active" : ""}`}
            onClick={() => setActiveSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. ATTENDANCE & SAFE-TO-SKIP */}
      {activeSubTab === "attendance" && (
        <div>
          <div className="cols">
            <div>
              <h2>Course Attendance & Safe-to-Skip Analysis</h2>
              <p className="muted small" style={{ marginBottom: "16px" }}>
                Calculates mathematically whether you can safely bunk upcoming lectures or must attend consecutive classes to stay above the 75% college rule.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {attendance.map((a) => (
                  <div key={a.id} className="att-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ fontSize: "15px", color: "#ffffff" }}>{a.subject}</strong>
                        <span className="muted small" style={{ display: "block", marginTop: "2px" }}>
                          Attended: <b>{a.attended}</b> / Total: <b>{a.total}</b> classes
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "18px",
                            fontWeight: 800,
                            color: a.is_safe ? "var(--good)" : "var(--bad)",
                          }}
                        >
                          {a.percentage}%
                        </span>
                        <span className="muted small" style={{ display: "block" }}>
                          (Target: {a.target_pct}%)
                        </span>
                      </div>
                    </div>

                    <div className="att-bar-track">
                      <div
                        className="att-bar-fill"
                        style={{
                          width: `${Math.min(100, a.percentage)}%`,
                          background: a.is_safe
                            ? "linear-gradient(90deg, #34d399, #10b981)"
                            : "linear-gradient(90deg, #fb7185, #ef4444)",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                      <span
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: a.is_safe ? "#a7f3d0" : "#fecdd3",
                          background: a.is_safe ? "rgba(52, 211, 153, 0.15)" : "rgba(251, 113, 133, 0.15)",
                          padding: "4px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        {a.is_safe ? `✅ ${a.status_text}` : `⚠️ ${a.status_text}`}
                      </span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="ghost"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          onClick={() => handleMarkAttendance(a.subject, true)}
                        >
                          + Attended
                        </button>
                        <button
                          className="ghost"
                          style={{ padding: "4px 10px", fontSize: "12px", color: "#fca5a5" }}
                          onClick={() => handleMarkAttendance(a.subject, false)}
                        >
                          + Missed
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Subject to Attendance */}
            <div className="panel">
              <h2>Add Subject to Tracker</h2>
              <form onSubmit={handleAddSubject} style={{ marginTop: "14px" }}>
                <label>
                  Subject Name
                  <input
                    value={newSubj.subject}
                    onChange={(e) => setNewSubj({ ...newSubj, subject: e.target.value })}
                    placeholder="e.g. Operating Systems"
                  />
                </label>
                <div className="two">
                  <label>
                    Attended Classes
                    <input
                      type="number"
                      value={newSubj.attended}
                      onChange={(e) => setNewSubj({ ...newSubj, attended: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Total Classes Held
                    <input
                      type="number"
                      value={newSubj.total}
                      onChange={(e) => setNewSubj({ ...newSubj, total: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Required Minimum Percentage
                  <input
                    type="number"
                    value={newSubj.target_pct}
                    onChange={(e) => setNewSubj({ ...newSubj, target_pct: Number(e.target.value) })}
                  />
                </label>
                <button className="primary" type="submit" style={{ width: "100%", marginTop: "10px" }}>
                  ➕ Track Subject
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXAM MODE REVISION PLANNER */}
      {activeSubTab === "exam" && (
        <div className="cols">
          <div className="panel">
            <h2>🎯 Exam Mode: AI Revision Strategist</h2>
            <p className="muted small">
              Generates a day-by-day countdown revision plan based on your exam date, syllabus topics, and high-yield question patterns.
            </p>
            <form onSubmit={handleGenerateExamPlan} style={{ marginTop: "16px" }}>
              <label>
                Subject / Paper
                <input
                  value={examForm.subject}
                  onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                />
              </label>
              <label>
                Exam Date
                <input
                  type="date"
                  value={examForm.exam_date}
                  onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                />
              </label>
              <label>
                Key Syllabus Topics / Units (comma separated)
                <textarea
                  rows={3}
                  value={examForm.topics}
                  onChange={(e) => setExamForm({ ...examForm, topics: e.target.value })}
                />
              </label>
              <button className="primary" type="submit" disabled={busyExam} style={{ width: "100%", marginTop: "10px" }}>
                {busyExam ? "Synthesizing Revision Strategy with Llama 3.2..." : "🚀 Generate Day-by-Day Exam Roadmap"}
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Revision Schedule Output</h2>
            {examRoadmap ? (
              <div
                style={{
                  background: "rgba(10, 5, 21, 0.8)",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "16px",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.6",
                  fontSize: "14px",
                  marginTop: "12px",
                  maxHeight: "520px",
                  overflowY: "auto",
                }}
              >
                {examRoadmap}
              </div>
            ) : (
              <p className="muted small" style={{ marginTop: "14px" }}>
                Fill in your subject details and click Generate to receive a structured timeline with high-yield revision milestones.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. HABIT STREAKS */}
      {activeSubTab === "habits" && (
        <div className="cols">
          <div>
            <h2>Daily Discipline & Habit Streaks</h2>
            <p className="muted small" style={{ marginBottom: "16px" }}>
              Keep compounding micro-habits across placements, coding, study, and wellness.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {habits.map((h) => (
                <div
                  key={h.id}
                  style={{
                    background: "rgba(26, 13, 51, 0.6)",
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "14px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ color: "#ffffff", fontSize: "15px" }}>{h.title}</strong>
                    <span className="muted small" style={{ display: "block" }}>
                      Category: {h.category} • Streak: <b style={{ color: "#c084fc" }}>{h.streak} days 🔥</b>
                    </span>
                  </div>
                  <button
                    className={h.completed_today ? "primary" : "ghost"}
                    onClick={() => handleToggleHabit(h.id)}
                    style={{ padding: "8px 16px" }}
                  >
                    {h.completed_today ? "✓ Completed Today" : "Mark Complete"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Add Custom Habit</h2>
            <form onSubmit={handleAddHabit} style={{ marginTop: "14px" }}>
              <label>
                Habit Name
                <input
                  value={habitTitle}
                  onChange={(e) => setHabitTitle(e.target.value)}
                  placeholder="e.g. Read 1 Research Paper or System Design Doc"
                />
              </label>
              <button className="primary" type="submit" style={{ width: "100%", marginTop: "10px" }}>
                ➕ Start Habit Streak
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. HOSTEL BUDGET TRACKER */}
      {activeSubTab === "budget" && budget && (
        <div className="cols">
          <div>
            <h2>Hostel & Monthly Pocket Money Tracker</h2>
            <div className="cols-3" style={{ margin: "16px 0" }}>
              <div className="radar-stat">
                <div className="num" style={{ color: "#34d399" }}>₹{budget.remaining}</div>
                <div className="lbl">Remaining Budget</div>
              </div>
              <div className="radar-stat">
                <div className="num" style={{ color: "#38bdf8" }}>₹{budget.daily_safe_spend}</div>
                <div className="lbl">Safe Daily Spend</div>
              </div>
              <div className="radar-stat">
                <div className="num" style={{ color: "#c084fc" }}>{budget.days_left_in_month}d</div>
                <div className="lbl">Days Left in Month</div>
              </div>
            </div>

            <h3>Recent Expenses</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              {budget.history?.map((e) => (
                <div
                  key={e.id}
                  style={{
                    background: "rgba(26, 13, 51, 0.5)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{e.title} ({e.category})</span>
                  <strong style={{ color: "#fca5a5" }}>-₹{e.amount}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Log Expense</h2>
            <form onSubmit={handleAddExpense} style={{ marginTop: "14px" }}>
              <label>
                Item / Description
                <input
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="e.g. Mess coupon, Stationery, Printing"
                />
              </label>
              <label>
                Amount (₹)
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="250"
                />
              </label>
              <label>
                Category
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                >
                  <option>Food & Mess</option>
                  <option>Stationery & Print</option>
                  <option>Hostel Utilities</option>
                  <option>Travel / Auto</option>
                  <option>Recreation</option>
                </select>
              </label>
              <button className="primary" type="submit" style={{ width: "100%", marginTop: "10px" }}>
                ➕ Log Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

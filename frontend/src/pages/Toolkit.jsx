import { useEffect, useState } from "react";
import { api } from "../api";

export default function Toolkit() {
  const [activeSubTab, setActiveSubTab] = useState("attendance");
  const [attendance, setAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [habits, setHabits] = useState([]);
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Edit Subject State
  const [editingSubj, setEditingSubj] = useState(null);

  // New Subject Form
  const [newSubj, setNewSubj] = useState({
    subject: "",
    short_code: "",
    color: "#8A4FE0",
    attended: 0,
    total: 0,
    total_semester: 60,
    target_pct: 75.0,
  });

  // Calendar & Timetable Import States
  const [calendarText, setCalendarText] = useState("");
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "", type: "Holiday" });

  // Timetable Slot State
  const [timetableDay, setTimetableDay] = useState("Monday");
  const [timetableClasses, setTimetableClasses] = useState([]);
  const [newSlot, setNewSlot] = useState({
    day_of_week: "Monday",
    subject: "",
    start_time: "09:00",
    end_time: "10:30",
    room: "Room 101",
    professor: "Dr. Smith",
    type: "Lecture",
  });

  // Exam Mode Planner Form
  const [examForm, setExamForm] = useState({
    subject: "Operating Systems & Concurrency",
    exam_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
    topics: "Semaphores, Deadlocks, Paging, Virtual Memory, Process Scheduling",
  });
  const [examRoadmap, setExamRoadmap] = useState("");
  const [busyExam, setBusyExam] = useState(false);

  // Budget & Habit Forms
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", category: "Food" });
  const [habitTitle, setHabitTitle] = useState("");

  const loadData = () => {
    api.getAttendance().then(setAttendance).catch(() => {});
    api.getHolidays().then(setHolidays).catch(() => {});
    api.getHabits().then(setHabits).catch(() => {});
    api.getBudget().then(setBudget).catch(() => {});
    loadTimetable(timetableDay);
  };

  const loadTimetable = (day) => {
    setTimetableDay(day);
    api.getTimetable(day).then((res) => setTimetableClasses(res.classes || [])).catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  // Attendance Handlers (P / A / C from the-thing)
  async function handleMark(subjectId, mark) {
    try {
      const res = await api.markAttendance(subjectId, mark);
      setAttendance(res);
      const label = mark === "P" ? "Present (+1) ✅" : mark === "A" ? "Absent (+0) ❌" : "No Class / Cancelled (Neutral) ⏸️";
      setNote(`Marked attendance: ${label}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddSubject(e) {
    e.preventDefault();
    if (!newSubj.subject.trim()) return;
    try {
      const res = await api.addSubject(newSubj);
      setAttendance(res);
      setNewSubj({
        subject: "",
        short_code: "",
        color: "#8A4FE0",
        attended: 0,
        total: 0,
        total_semester: 60,
        target_pct: 75.0,
      });
      setNote("✅ Subject added to attendance manager!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveEditSubject(e) {
    e.preventDefault();
    if (!editingSubj) return;
    try {
      const res = await api.updateSubject(editingSubj);
      setAttendance(res);
      setEditingSubj(null);
      setNote("✅ Subject updated successfully!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSubject(id) {
    if (!window.confirm("Remove this subject from your attendance tracker?")) return;
    try {
      const res = await api.deleteSubject(id);
      setAttendance(res);
      setNote("Subject deleted.");
    } catch (err) {
      setError(err.message);
    }
  }

  // Holiday Handlers
  async function handleAddHoliday(e) {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.name.trim()) return;
    try {
      const res = await api.addHoliday(newHoliday);
      setHolidays(res);
      setNewHoliday({ date: "", name: "", type: "Holiday" });
      setNote("🎉 Holiday added to Academic Calendar!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteHoliday(id) {
    try {
      const res = await api.deleteHoliday(id);
      setHolidays(res);
      setNote("Holiday removed.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleParseCalendar(e) {
    e.preventDefault();
    if (!calendarText.trim()) return;
    try {
      const res = await api.parseCalendar(calendarText);
      setHolidays(res.holidays);
      setCalendarText("");
      setNote(`🎉 Extracted and scheduled ${res.imported} holidays from academic calendar!`);
    } catch (err) {
      setError(err.message);
    }
  }

  // Timetable Slot Handlers
  async function handleAddSlot(e) {
    e.preventDefault();
    if (!newSlot.subject.trim()) return;
    try {
      const res = await api.addClass({ ...newSlot, day_of_week: timetableDay });
      setTimetableClasses(res.classes || []);
      setNewSlot({
        day_of_week: timetableDay,
        subject: "",
        start_time: "09:00",
        end_time: "10:30",
        room: "Room 101",
        professor: "Dr. Smith",
        type: "Lecture",
      });
      setNote(`✅ Class slot added to ${timetableDay}!`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSlot(id) {
    try {
      const res = await api.deleteClass(id, timetableDay);
      setTimetableClasses(res.classes || []);
      setNote("Class removed from schedule.");
    } catch (err) {
      setError(err.message);
    }
  }

  // Habit & Budget Handlers
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
    <div style={{ minWidth: 0 }}>
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1>College Academic OS</h1>
          <p className="muted small">
            Attendance manager (P/A/C), Calendar & Timetable with holiday detection, Habits, Budget, and Exam Mode.
          </p>
        </div>
        <span className="privacy-badge">🎓 College OS</span>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {note && (
        <p className="ok small" style={{ marginBottom: "14px", padding: "8px 12px", background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "8px" }}>
          {note}
        </p>
      )}

      {/* Sub Tabs */}
      <div className="mode-tabs">
        {[
          { id: "attendance", label: "📊 Attendance & 75% Rule" },
          { id: "calendar", label: "📅 Calendar & Timetable Setup" },
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

      {/* 1. ATTENDANCE MANAGER (Modeled on the-thing) */}
      {activeSubTab === "attendance" && (
        <div className="cols">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2>Course Attendance & Safe-to-Skip</h2>
              <span className="small muted">Target: 75% minimum</span>
            </div>
            <p className="muted small" style={{ marginBottom: "14px" }}>
              Mark classes as <strong>P</strong> (Present), <strong>A</strong> (Absent), or <strong>C</strong> (No Class / Cancelled).
              You can edit course details or remove default courses below.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {attendance.map((a) => (
                <div key={a.id} className="att-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "2px",
                          background: a.color || "#8A4FE0",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: "14.5px", color: "#ffffff", display: "block", wordBreak: "break-word" }}>
                          {a.subject}
                        </strong>
                        <span className="muted small">
                          Held: <b>{a.total}</b> • Attended: <b style={{ color: a.is_safe ? "var(--good)" : "var(--bad)" }}>{a.attended}</b> • Sem Goal: {a.total_semester}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: "20px",
                          fontWeight: 800,
                          color: a.is_safe ? "var(--good)" : "var(--bad)",
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {a.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Visual Attendance Bar */}
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

                  {/* Status & One-Click P / A / C Buttons */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: a.is_safe ? "#a7f3d0" : "#fecdd3",
                        background: a.is_safe ? "rgba(52, 211, 153, 0.15)" : "rgba(251, 113, 133, 0.15)",
                        padding: "3px 8px",
                        borderRadius: "5px",
                      }}
                    >
                      {a.status_text}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      {/* Mark P (Present) */}
                      <button
                        className="ghost"
                        style={{ padding: "4px 8px", fontSize: "11px", color: "var(--good)", borderColor: "rgba(52, 211, 153, 0.3)" }}
                        onClick={() => handleMark(a.id, "P")}
                        title="Present (+1 attended, +1 total)"
                      >
                        P (Present)
                      </button>
                      {/* Mark A (Absent) */}
                      <button
                        className="ghost"
                        style={{ padding: "4px 8px", fontSize: "11px", color: "var(--bad)", borderColor: "rgba(251, 113, 133, 0.3)" }}
                        onClick={() => handleMark(a.id, "A")}
                        title="Absent (+0 attended, +1 total)"
                      >
                        A (Absent)
                      </button>
                      {/* Mark C (No Class) */}
                      <button
                        className="ghost"
                        style={{ padding: "4px 8px", fontSize: "11px", color: "var(--cyan)", borderColor: "rgba(56, 189, 248, 0.3)" }}
                        onClick={() => handleMark(a.id, "C")}
                        title="No Class / Cancelled (Neutral)"
                      >
                        C (No Class)
                      </button>
                      {/* Edit */}
                      <button
                        className="ghost"
                        style={{ padding: "4px 7px", fontSize: "11px" }}
                        onClick={() => setEditingSubj(a)}
                        title="Edit course counts"
                      >
                        ✏️
                      </button>
                      {/* Delete */}
                      <button
                        className="ghost"
                        style={{ padding: "4px 7px", fontSize: "11px", color: "#fca5a5" }}
                        onClick={() => handleDeleteSubject(a.id)}
                        title="Delete course"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add / Edit Subject Form */}
          <div className="panel" style={{ minWidth: 0 }}>
            {editingSubj ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2>Edit Course</h2>
                  <button className="ghost" onClick={() => setEditingSubj(null)} style={{ fontSize: "11px" }}>
                    Cancel
                  </button>
                </div>
                <form onSubmit={handleSaveEditSubject} style={{ marginTop: "12px" }}>
                  <label>
                    Course Name
                    <input
                      value={editingSubj.subject}
                      onChange={(e) => setEditingSubj({ ...editingSubj, subject: e.target.value })}
                    />
                  </label>
                  <div className="two">
                    <label>
                      Classes Attended (PR)
                      <input
                        type="number"
                        value={editingSubj.attended}
                        onChange={(e) => setEditingSubj({ ...editingSubj, attended: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Classes Held (Held Cls)
                      <input
                        type="number"
                        value={editingSubj.total}
                        onChange={(e) => setEditingSubj({ ...editingSubj, total: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="two">
                    <label>
                      Semester Total Planned
                      <input
                        type="number"
                        value={editingSubj.total_semester}
                        onChange={(e) => setEditingSubj({ ...editingSubj, total_semester: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Target % (e.g. 75)
                      <input
                        type="number"
                        value={editingSubj.target_pct}
                        onChange={(e) => setEditingSubj({ ...editingSubj, target_pct: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <button className="primary" type="submit" style={{ width: "100%", marginTop: "8px" }}>
                    💾 Save Changes
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <h2>Add Your College Subject</h2>
                <p className="muted small">
                  Add the exact subjects you take this semester.
                </p>
                <form onSubmit={handleAddSubject} style={{ marginTop: "12px" }}>
                  <label>
                    Course Name
                    <input
                      value={newSubj.subject}
                      onChange={(e) => setNewSubj({ ...newSubj, subject: e.target.value })}
                      placeholder="e.g. Computer Architecture & Organization"
                    />
                  </label>
                  <div className="two">
                    <label>
                      Classes Attended
                      <input
                        type="number"
                        value={newSubj.attended}
                        onChange={(e) => setNewSubj({ ...newSubj, attended: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Classes Held
                      <input
                        type="number"
                        value={newSubj.total}
                        onChange={(e) => setNewSubj({ ...newSubj, total: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="two">
                    <label>
                      Semester Total (Expected)
                      <input
                        type="number"
                        value={newSubj.total_semester}
                        onChange={(e) => setNewSubj({ ...newSubj, total_semester: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Required %
                      <input
                        type="number"
                        value={newSubj.target_pct}
                        onChange={(e) => setNewSubj({ ...newSubj, target_pct: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <button className="primary" type="submit" style={{ width: "100%", marginTop: "8px" }}>
                    ➕ Add Subject to Tracker
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. CALENDAR & TIMETABLE SETUP */}
      {activeSubTab === "calendar" && (
        <div className="cols">
          <div style={{ minWidth: 0 }}>
            <h2>Academic Calendar & Holidays</h2>
            <p className="muted small">
              On holidays, the system displays a celebratory pop-up and suspends all class schedules for that day.
            </p>

            {/* Paste / Attach Academic Calendar */}
            <form onSubmit={handleParseCalendar} style={{ margin: "14px 0" }}>
              <label>
                Paste Academic Calendar Text or Holiday List
                <textarea
                  rows={3}
                  value={calendarText}
                  onChange={(e) => setCalendarText(e.target.value)}
                  placeholder="e.g.&#10;2026-11-20: University Sports Fest&#10;2026-12-25: Christmas Day&#10;2026-01-26: Republic Day"
                />
              </label>
              <button className="primary" type="submit" disabled={!calendarText.trim()}>
                📅 Parse & Save Calendar Holidays
              </button>
            </form>

            <h3>Scheduled College Holidays</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
              {holidays.map((h) => (
                <div
                  key={h.id}
                  style={{
                    background: "rgba(26, 13, 51, 0.6)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ color: "#fef08a", fontSize: "13.5px" }}>🎉 {h.name}</strong>
                    <span className="muted small" style={{ display: "block" }}>
                      Date: {h.date} ({h.type})
                    </span>
                  </div>
                  <button
                    className="ghost"
                    style={{ padding: "3px 6px", color: "#fca5a5", fontSize: "11px" }}
                    onClick={() => handleDeleteHoliday(h.id)}
                    title="Delete holiday"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add Custom Holiday */}
            <form onSubmit={handleAddHoliday} style={{ marginTop: "14px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
              <span className="small muted" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Add Custom Single Holiday:
              </span>
              <div className="two">
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                />
                <input
                  placeholder="Holiday Name (e.g. Cultural Fest)"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                />
              </div>
              <button className="ghost" type="submit" style={{ marginTop: "6px" }}>
                + Add Holiday
              </button>
            </form>
          </div>

          {/* Timetable Schedule Editor */}
          <div className="panel" style={{ minWidth: 0 }}>
            <h2>Weekly Timetable Manager</h2>
            <p className="muted small">
              Customize periods and lectures for each day of the week.
            </p>

            {/* Day Selector */}
            <div style={{ display: "flex", gap: "4px", margin: "10px 0", flexWrap: "wrap" }}>
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                <button
                  key={d}
                  className={`ghost ${timetableDay === d ? "active" : ""}`}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    background: timetableDay === d ? "rgba(168, 85, 247, 0.3)" : undefined,
                    borderColor: timetableDay === d ? "var(--purple-bright)" : undefined,
                  }}
                  onClick={() => loadTimetable(d)}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
              {timetableClasses.length > 0 ? (
                timetableClasses.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "rgba(10, 5, 21, 0.7)",
                      border: "1px solid var(--line)",
                      borderRadius: "7px",
                      padding: "8px 10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px", color: "#ffffff" }}>{c.subject}</strong>
                      <span className="muted small" style={{ display: "block" }}>
                        {c.start_time} - {c.end_time} • {c.room} ({c.type})
                      </span>
                    </div>
                    <button
                      className="ghost"
                      style={{ padding: "2px 6px", color: "#fca5a5", fontSize: "10px" }}
                      onClick={() => handleDeleteSlot(c.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted small">No class periods scheduled for {timetableDay}.</p>
              )}
            </div>

            {/* Add Slot to Selected Day */}
            <form onSubmit={handleAddSlot} style={{ borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
              <span className="small muted" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Add Class to {timetableDay}:
              </span>
              <label>
                Subject Name
                <input
                  value={newSlot.subject}
                  onChange={(e) => setNewSlot({ ...newSlot, subject: e.target.value })}
                  placeholder="e.g. Distributed Systems"
                />
              </label>
              <div className="two">
                <label>
                  Start Time
                  <input
                    type="time"
                    value={newSlot.start_time}
                    onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                  />
                </label>
                <label>
                  End Time
                  <input
                    type="time"
                    value={newSlot.end_time}
                    onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                  />
                </label>
              </div>
              <div className="two">
                <label>
                  Room / Lab
                  <input
                    value={newSlot.room}
                    onChange={(e) => setNewSlot({ ...newSlot, room: e.target.value })}
                  />
                </label>
                <label>
                  Professor
                  <input
                    value={newSlot.professor}
                    onChange={(e) => setNewSlot({ ...newSlot, professor: e.target.value })}
                  />
                </label>
              </div>
              <button className="primary" type="submit" style={{ width: "100%", marginTop: "6px" }}>
                ➕ Add Class to {timetableDay}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. EXAM MODE REVISION PLANNER */}
      {activeSubTab === "exam" && (
        <div className="cols">
          <div className="panel" style={{ minWidth: 0 }}>
            <h2>🎯 Exam Mode: Revision Strategist</h2>
            <p className="muted small">
              Generates a day-by-day countdown revision plan based on your exam date and high-yield topics.
            </p>
            <form onSubmit={handleGenerateExamPlan} style={{ marginTop: "12px" }}>
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
                Key Syllabus Topics / Units
                <textarea
                  rows={3}
                  value={examForm.topics}
                  onChange={(e) => setExamForm({ ...examForm, topics: e.target.value })}
                />
              </label>
              <button className="primary" type="submit" disabled={busyExam} style={{ width: "100%", marginTop: "8px" }}>
                {busyExam ? "Synthesizing Roadmap..." : "🚀 Generate Day-by-Day Roadmap"}
              </button>
            </form>
          </div>

          <div className="panel" style={{ minWidth: 0 }}>
            <h2>Revision Schedule Output</h2>
            {examRoadmap ? (
              <div
                style={{
                  background: "rgba(10, 5, 21, 0.8)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "14px",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.55",
                  fontSize: "13px",
                  marginTop: "10px",
                  maxHeight: "480px",
                  overflowY: "auto",
                }}
              >
                {examRoadmap}
              </div>
            ) : (
              <p className="muted small" style={{ marginTop: "12px" }}>
                Fill in your subject details and click Generate to receive a structured timeline with high-yield revision milestones.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. HABIT STREAKS */}
      {activeSubTab === "habits" && (
        <div className="cols">
          <div style={{ minWidth: 0 }}>
            <h2>Daily Discipline & Habit Streaks</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
              {habits.map((h) => (
                <div
                  key={h.id}
                  style={{
                    background: "rgba(26, 13, 51, 0.6)",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    minWidth: 0,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: "#ffffff", fontSize: "14px" }}>{h.title}</strong>
                    <span className="muted small" style={{ display: "block" }}>
                      Category: {h.category} • Streak: <b style={{ color: "#c084fc" }}>{h.streak} days 🔥</b>
                    </span>
                  </div>
                  <button
                    className={h.completed_today ? "primary" : "ghost"}
                    onClick={() => handleToggleHabit(h.id)}
                    style={{ padding: "6px 12px", fontSize: "12px", flexShrink: 0 }}
                  >
                    {h.completed_today ? "✓ Done Today" : "Mark Done"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ minWidth: 0 }}>
            <h2>Add Custom Habit</h2>
            <form onSubmit={handleAddHabit} style={{ marginTop: "12px" }}>
              <label>
                Habit Name
                <input
                  value={habitTitle}
                  onChange={(e) => setHabitTitle(e.target.value)}
                  placeholder="e.g. Read 1 Research Paper"
                />
              </label>
              <button className="primary" type="submit" style={{ width: "100%", marginTop: "8px" }}>
                ➕ Start Habit Streak
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. HOSTEL BUDGET TRACKER */}
      {activeSubTab === "budget" && budget && (
        <div className="cols">
          <div style={{ minWidth: 0 }}>
            <h2>Hostel Pocket Money Tracker</h2>
            <div className="cols-3" style={{ margin: "14px 0" }}>
              <div className="radar-stat">
                <div className="num" style={{ color: "#34d399", fontSize: "22px" }}>₹{budget.remaining}</div>
                <div className="lbl">Remaining Budget</div>
              </div>
              <div className="radar-stat">
                <div className="num" style={{ color: "#38bdf8", fontSize: "22px" }}>₹{budget.daily_safe_spend}</div>
                <div className="lbl">Safe Daily Spend</div>
              </div>
              <div className="radar-stat">
                <div className="num" style={{ color: "#c084fc", fontSize: "22px" }}>{budget.days_left_in_month}d</div>
                <div className="lbl">Days Left</div>
              </div>
            </div>

            <h3>Recent Expenses</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
              {budget.history?.map((e) => (
                <div
                  key={e.id}
                  style={{
                    background: "rgba(26, 13, 51, 0.5)",
                    border: "1px solid var(--line)",
                    borderRadius: "7px",
                    padding: "8px 12px",
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

          <div className="panel" style={{ minWidth: 0 }}>
            <h2>Log Expense</h2>
            <form onSubmit={handleAddExpense} style={{ marginTop: "12px" }}>
              <label>
                Item / Description
                <input
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="e.g. Mess coupon, Stationery"
                />
              </label>
              <label>
                Amount (₹)
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="200"
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
              <button className="primary" type="submit" style={{ width: "100%", marginTop: "8px" }}>
                ➕ Log Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

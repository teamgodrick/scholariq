import { useEffect, useState } from "react";
import { api } from "../api";

const TYPES = ["exam", "lab", "assignment", "project", "other"];
const bucket = (d) => (d <= 0 ? "now" : d <= 3 ? "soon" : "later");

export default function Dashboard() {
  const [plan, setPlan] = useState({ items: [], tip: "" });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", due_date: "", type: "assignment" });

  const load = () => api.plan().then(setPlan).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  async function extract() {
    if (!message.trim()) return;
    setBusy(true); setError(""); setNote("");
    try {
      const t = await api.extract(message);
      setForm(t);
      setNote("Deadline found. Check the details, then add the task.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.due_date) {
      setError("Add a title and a due date.");
      return;
    }
    setError(""); setNote("");
    try {
      await api.addTask(form);
      setForm({ title: "", due_date: "", type: "assignment" });
      setMessage("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function done(id) {
    await api.doneTask(id);
    load();
  }

  const urgent = plan.items.filter((i) => i.days_left <= 1 && !i.deferred).length;

  return (
    <div>
      <header className="page-head">
        <h1>Today</h1>
        <p className="muted">{today}</p>
      </header>
      {error && <p className="alert" role="alert">{error}</p>}

      <div className="cols">
        <section>
          <div className="tip">{plan.tip}</div>
          <h2>Today&apos;s plan</h2>
          <p className="muted small">
            {plan.items.length === 0
              ? "No open tasks yet. Add one or paste a message on the right."
              : `${plan.items.length} open tasks, ${urgent} due within a day.`}
          </p>
          <ul className="plan">
            {plan.items.map((i) => (
              <li key={i.id} className={`row ${bucket(i.days_left)}${i.deferred ? " deferred" : ""}`}>
                <div className="row-main">
                  <strong>{i.title}</strong>
                  <span className="muted small">
                    {i.reason}, {i.type}
                    {i.deferred ? ", deferred while your load is high" : ""}
                  </span>
                </div>
                <span className="score" title="Priority score">{i.priority}</span>
                <button className="ghost" onClick={() => done(i.id)}>Mark done</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Paste a message</h2>
          <p className="muted small">Copy a WhatsApp or email notice. ScholarIQ finds the deadline.</p>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. DBMS lab record submission is this Friday before 4 PM"
          />
          <button className="primary" onClick={extract} disabled={busy}>
            {busy ? "Reading message" : "Find deadline"}
          </button>

          <h2 className="gap">Add a task</h2>
          {note && <p className="ok small">{note}</p>}
          <form onSubmit={add}>
            <label>Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <div className="two">
              <label>Due date
                <input type="date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </label>
              <label>Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <button className="primary" type="submit">Add task</button>
          </form>
        </section>
      </div>
    </div>
  );
}

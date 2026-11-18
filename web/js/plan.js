import { fill, h, api, toast, head, card, field, btn, bar, note, bars, when } from "./ui.js";

const TYPES = ["exam", "lab", "assignment", "project", "other"];
const bucket = (d) => (d <= 0 ? "now" : d <= 3 ? "soon" : "later");

export async function today(root) {
  const [d, profile] = await Promise.all([api("/today"), api("/profile")]);
  const s = d.stats;
  const message = h("textarea", { rows: 3, placeholder: "e.g. DBMS lab record submission is this Friday before 4 PM" });
  const title = h("input"), due = h("input", { type: "date" });
  const type = h("select", {}, TYPES.map((t) => h("option", { value: t }, t)));
  type.value = "assignment";
  const refresh = () => today(root);

  const planList = h("ul", { class: "list" }, d.plan.items.map((i) =>
    h("li", { class: `row ${bucket(i.days_left)}${i.deferred ? " deferred" : ""}` },
      h("div", { class: "grow" }, h("strong", {}, i.title),
        h("span", { class: "muted small" }, `${i.reason}, ${i.type}${i.deferred ? ", deferred while your load is high" : ""}`)),
      h("span", { class: "score", title: "Priority score" }, i.priority),
      btn("Done", async () => { await api(`/tasks/${i.id}/done`, {}); refresh(); }, "ghost"))));
  const sessions = d.sessions.length ? d.sessions.map((session) => {
    const marked = Boolean(session.status);
    return h("div", { class: "row later lecture" },
      h("div", { class: "grow" }, h("strong", {}, session.subject),
        h("span", { class: "muted small" }, `${session.start_time}–${session.end_time}${session.location ? " · " + session.location : ""}`)),
      marked ? h("span", { class: "chip status-" + session.status }, session.status === "no_class" ? "No class" : session.status) :
        h("div", { class: "btns" },
          ...[["Present", "present"], ["Absent", "absent"], ["No class", "no_class"]].map(([label, status]) =>
            btn(label, async () => { await api(`/lectures/${session.id}/mark`, { date: d.today_iso, status }); refresh(); }, "ghost"))));
  }) : card(null, note("No classes on your timetable today."), h("a", { href: "#/attendance" }, "Set up your timetable"));

  fill(root, 
    h("header", { class: "today-hero" },
      profile.photo ? h("img", { class: "profile-avatar", src: profile.photo, alt: "Profile picture" }) :
        h("div", { class: "profile-avatar profile-initial" }, (profile.display_name || "S").slice(0, 1).toUpperCase()),
      h("div", {}, h("h1", {}, d.greeting), h("p", { class: "muted" }, `${d.date}${profile.description ? " · " + profile.description : ""}`))),
    d.winddown.state !== "ok" ? h("div", { class: "banner " + d.winddown.state }, d.winddown.message) : null,
    d.events.length ? card("Academic calendar today", d.events.map((event) =>
      h("p", {}, h("strong", {}, event.title), h("span", { class: "muted small" }, ` · ${event.event_type}`)))) : null,
    card("Today's lectures", note("Mark each scheduled lecture once as present, absent, or no class."),
      sessions),
    h("div", { class: "stats" }, [
      ["Open tasks", s.open_tasks], ["Focus today", s.focus_today + " min"], ["Habits", `${s.habits_done}/${s.habits_total}`],
      ["Cards due", s.cards_due], ["Water", s.water + " glasses"], ["Avg sleep", s.avg_sleep ? s.avg_sleep + " h" : "n/a"],
    ].map(([l, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l)))),
    d.alerts.length ? card("Needs your attention", h("ul", { class: "alerts" }, d.alerts.map((a) =>
      h("li", { class: "alert-" + a.level }, h("span", {}, a.text), h("a", { href: "#/" + a.page }, "Open"))))) : null,
    h("div", { class: "cols" },
      h("div", {}, h("div", { class: "tip" }, d.plan.tip), h("h2", {}, "Today's plan"),
        note(d.plan.items.length ? `${d.plan.items.length} open tasks, ranked by urgency and type.` : "No open tasks. Add one on the right."), planList),
      card("Add a task",
        note("Paste a WhatsApp or email notice and ScholarIQ finds the deadline."), message,
        btn("Find deadline", async () => {
          const t = await api("/tasks/extract", { text: message.value });
          title.value = t.title; due.value = t.due_date; type.value = t.type;
          toast("Deadline found. Check it, then add the task.");
        }),
        h("div", { style: "height:14px" }),
        field("Title", title), h("div", { class: "two" }, field("Due date", due), field("Type", type)),
        btn("Add task", async () => { await api("/tasks", { title: title.value, due_date: due.value, type: type.value }); refresh(); }))));
}

export async function exam(root) {
  const exams = (await api("/tasks")).filter((t) => t.type === "exam");
  const title = h("input", { value: exams[0] ? exams[0].title : "" });
  const due = h("input", { type: "date", value: exams[0] ? exams[0].due_date : "" });
  const topics = h("textarea", { rows: 4, placeholder: "Optional: one topic per line. Leave empty to read topics from your uploaded syllabus." });
  const pick = h("select", {}, [h("option", { value: "" }, "Choose an exam you added"), ...exams.map((e) => h("option", { value: e.id }, `${e.title} (${when(e.due_date)})`))]);
  pick.addEventListener("change", () => { const e = exams.find((x) => String(x.id) === pick.value); if (e) { title.value = e.title; due.value = e.due_date; } });
  const out = h("div");
  fill(root, head("Exam mode", "A day-by-day revision plan built from your own syllabus."),
    h("div", { class: "cols" },
      card("Plan my revision", field("Your exams", pick), field("Exam name", title), field("Exam date", due), field("Topics", topics),
        btn("Build my plan", async () => {
          const r = await api("/exam/plan", { title: title.value, due_date: due.value, topics: topics.value });
          fill(out, card(`${r.title}: ${r.days_left} day(s) left`, note(`Topics came from ${r.source}.`),
            ...r.schedule.map((s) => h("div", { class: "sched" }, h("strong", {}, `${when(s.date)}: ${s.label}`),
              s.topics.length ? h("p", {}, s.topics.join(", ")) : null, h("p", { class: "muted small" }, s.tip)))));
        })), out));
}

export async function focus(root) {
  const stats = await api("/focus");
  const TIPS = ["Stand up and stretch your arms overhead for 20 seconds.", "Roll your shoulders back 10 times.",
    "Look at something 20 feet away for 20 seconds.", "Drink some water.", "Fix your posture: feet flat, back straight, screen at eye level."];
  let mode = "work", workMin = 25, left = 25 * 60, endAt = 0, sessions = 0, running = false, lastEye = -1;
  const disp = h("div", { class: "timer" }), hint = h("p", { class: "muted center" });
  const label = h("input", { value: "Study" }), mins = h("input", { type: "number", min: 5, max: 90, value: 25 });
  const total = h("strong", {}, stats.today + " min today"), chart = h("div");
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const paint = () => {
    disp.textContent = fmt(left);
    hint.textContent = mode === "work" ? "Focus time. Phone away, one task only." : "Break time. " + TIPS[sessions % TIPS.length];
    document.title = (running ? fmt(left) + " " : "") + "ScholarIQ";
  };
  const beep = () => { try { const a = new AudioContext(), o = a.createOscillator(); o.connect(a.destination); o.frequency.value = 660; o.start(); setTimeout(() => { o.stop(); a.close(); }, 350); } catch { /* no sound */ } };
  const stop = () => { clearInterval(window.__sqTimer); running = false; };
  const drawChart = (st) => { fill(chart, bars(st.days.map((x) => ({ value: x.minutes, label: when(x.day), title: x.minutes + " min" })), Math.max(30, ...st.days.map((x) => x.minutes)))); total.textContent = st.today + " min today, " + st.week + " this week"; };
  drawChart(stats);
  async function tick() {
    left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    const elapsed = workMin * 60 - left;
    if (mode === "work" && elapsed > 0 && elapsed % 1200 === 0 && elapsed !== lastEye) { lastEye = elapsed; toast("20-20-20 rule: look 20 feet away for 20 seconds."); }
    paint();
    if (left > 0) return;
    stop(); beep();
    if (mode === "work") {
      sessions++; await api("/focus", { minutes: workMin, label: label.value || "Study" });
      drawChart(await api("/focus")); mode = "break"; left = (sessions % 4 === 0 ? 15 : 5) * 60; toast("Session logged. Take a break.");
    } else { mode = "work"; left = workMin * 60; toast("Break over. Ready for the next session?"); }
    paint();
  }
  const startBtn = btn("Start", async () => {
    if (running) { stop(); startBtn.textContent = "Resume"; return; }
    if (mode === "work" && left === workMin * 60) workMin = Math.max(5, Math.min(90, Number(mins.value) || 25)), left = workMin * 60;
    endAt = Date.now() + left * 1000; running = true; startBtn.textContent = "Pause";
    window.__sqTimer = setInterval(() => tick().catch(() => {}), 500);
  });
  fill(root, head("Focus mode", "Pomodoro sessions with eye-rest, stretch and posture reminders."),
    h("div", { class: "cols" },
      card(null, disp, hint, h("div", { class: "btns", style: "justify-content:center;margin-top:14px" }, startBtn,
        btn("Reset", async () => { stop(); mode = "work"; left = workMin * 60; startBtn.textContent = "Start"; paint(); }, "ghost"))),
      card("Session setup", field("What are you studying?", label), field("Focus minutes", mins), h("p", {}, total), chart)));
  paint();
}

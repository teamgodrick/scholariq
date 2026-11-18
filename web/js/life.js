import { fill, h, api, toast, head, card, field, btn, note, bar, bars, when } from "./ui.js";

const R = 54, C = 2 * Math.PI * R;
function ring(score, level) {
  const NS = "http://www.w3.org/2000/svg", mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = mk("svg", { class: "ring", viewBox: "0 0 140 140", role: "img", "aria-label": `Burnout score ${score}, ${level}` });
  const def = mk("defs", {}), g = mk("linearGradient", { id: "rg", x1: 0, y1: 0, x2: 1, y2: 1 });
  g.append(mk("stop", { offset: 0, "stop-color": "#c4b5fd" }), mk("stop", { offset: 1, "stop-color": "#7c3aed" })); def.append(g);
  const t1 = mk("text", { x: 70, y: 72, "text-anchor": "middle", class: "ring-num" }); t1.textContent = score;
  const t2 = mk("text", { x: 70, y: 94, "text-anchor": "middle", class: "ring-label" }); t2.textContent = level;
  svg.append(def, mk("circle", { cx: 70, cy: 70, r: R, fill: "none", stroke: "#2a1d4a", "stroke-width": 12 }),
    mk("circle", { cx: 70, cy: 70, r: R, fill: "none", stroke: "url(#rg)", "stroke-width": 12, "stroke-linecap": "round", "stroke-dasharray": C, "stroke-dashoffset": C * (1 - score / 100), transform: "rotate(-90 70 70)" }), t1, t2);
  return svg;
}

export async function checkin(root) {
  const hist = await api("/checkin/history");
  const f = { sleep: 7, mood: 3, water: 4 };
  const result = h("div", { class: "center" }, note("Save your check-in to see your burnout score."));
  const sleep = h("input", { type: "range", min: 0, max: 12, step: 0.5, value: 7 }), water = h("input", { type: "range", min: 0, max: 12, step: 1, value: 4 });
  const sv = h("strong", {}, "7"), wv = h("strong", {}, "4");
  sleep.addEventListener("input", () => { f.sleep = Number(sleep.value); sv.textContent = sleep.value; });
  water.addEventListener("input", () => { f.water = Number(water.value); wv.textContent = water.value; });
  const moods = h("div", { class: "moods" }), paint = () => fill(moods, ...[1, 2, 3, 4, 5].map((n) => h("button", { type: "button", class: "mood" + (f.mood === n ? " on" : ""), onclick: () => { f.mood = n; paint(); } }, n)));
  paint();
  fill(root, head("Daily check-in", "Thirty seconds. Your plan adapts to how you actually feel."),
    h("div", { class: "cols" },
      card(null, h("label", {}, "Hours slept: ", sv, sleep), h("label", {}, "Mood today (1 low, 5 great)", moods), h("label", {}, "Glasses of water: ", wv, water),
        btn("Save check-in", async () => {
          const r = await api("/checkin", { sleep_h: f.sleep, mood: f.mood, water: f.water });
          fill(result, ring(r.score, r.level), h("p", {}, r.advice), note(`Sleep ${r.breakdown.sleep}, mood ${r.breakdown.mood}, water ${r.breakdown.water}, workload ${r.breakdown.workload} (${r.breakdown.tasks_due_in_3_days} tasks due in 3 days). Guidance only, not medical advice.`));
        })),
      h("div", {}, card("Your result", result),
        card("Last 14 check-ins", hist.length ? bars(hist.map((x) => ({ value: x.score, label: when(x.day), title: "Score " + x.score })), 100) : note("No history yet.")))));
}

export async function journal(root) {
  const items = await api("/journal");
  const text = h("textarea", { rows: 4, placeholder: "How was today? Private, stays on this laptop." });
  let mood = 3; const moods = h("div", { class: "moods" });
  const paint = () => fill(moods, ...[1, 2, 3, 4, 5].map((n) => h("button", { type: "button", class: "mood" + (mood === n ? " on" : ""), onclick: () => { mood = n; paint(); } }, n)));
  paint();
  const out = h("div");
  fill(root, head("Mood journal", "A private note a day. The local AI can summarise your week."),
    h("div", { class: "cols" },
      card("Write today's entry", h("label", {}, "Mood", moods), text, btn("Save entry", async () => { await api("/journal", { mood, text: text.value }); journal(root); })),
      h("div", {}, card("Weekly reflection", btn("Summarise my week", async () => { const r = await api("/journal/summary", {}); fill(out, h("p", {}, r.summary)); }), out),
        card("Recent entries", items.length ? items.map((j) => h("p", {}, h("strong", {}, `${when(j.day)} (mood ${j.mood}): `), j.text)) : note("No entries yet.")))));
}

export async function habits(root) {
  const list = await api("/habits");
  const name = h("input", { placeholder: "e.g. Morning walk" });
  fill(root, head("Habits and routine", "Small daily wins. Streaks show consistency."),
    h("div", { class: "cols" },
      card("Today", list.length ? h("ul", { class: "list" }, list.map((x) => h("li", { class: "row later" },
        h("div", { class: "grow" }, h("strong", {}, x.name), h("span", { class: "muted small" }, `${x.streak}-day streak`)),
        h("div", { class: "dots" }, x.last7.map((on) => h("i", { class: on ? "on" : "" }))),
        btn(x.done_today ? "Done" : "Mark done", async () => { await api(`/habits/${x.id}/toggle`, {}); habits(root); }, x.done_today ? "ghost on" : "ghost"),
        btn("Remove", async () => { await api(`/habits/${x.id}/delete`, {}); habits(root); }, "ghost danger")))) : note("No habits yet. Add your first one.")),
      card("Add a habit", field("Habit", name), btn("Add habit", async () => { await api("/habits", { name: name.value }); habits(root); }),
        note("Ideas: sleep before 11 PM, 30 minutes revision, 10 minute walk, no phone at meals."))));
}

export async function nutrition(root) {
  const n = await api("/nutrition");
  const slot = h("select", {}, ["Breakfast", "Lunch", "Snack", "Dinner"].map((s) => h("option", { value: s }, s))), what = h("input", { placeholder: "What did you eat?" });
  const out = h("div");
  fill(root, head("Nutrition and water", "Hydration reminders and meal ideas that fit your mess menu."),
    h("div", { class: "cols" },
      card("Water", h("p", { class: "timer", style: "font-size:56px" }, `${n.glasses}/${n.goal}`), bar((n.glasses / n.goal) * 100), h("p", {}, n.tip),
        h("div", { class: "btns" }, btn("Add a glass", async () => { await api("/water", { delta: 1 }); nutrition(root); }), btn("Remove one", async () => { await api("/water", { delta: -1 }); nutrition(root); }, "ghost"))),
      h("div", {}, card("Meals today", n.meals.length ? n.meals.map((m) => h("p", {}, h("strong", {}, m.slot + ": "), m.note)) : note("Nothing logged yet."),
        h("div", { class: "two" }, field("Meal", slot), field("Food", what)), btn("Log meal", async () => { await api("/meals", { slot: slot.value, note: what.value }); nutrition(root); })),
        card("What should I eat now?", note("Uses the mess menu from Settings."), btn("Suggest a meal", async () => { const r = await api("/meals/suggest", {}); fill(out, h("p", {}, h("strong", {}, r.slot + ": "), r.suggestion)); }), out))));
}

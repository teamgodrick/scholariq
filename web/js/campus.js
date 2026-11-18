import { fill, h, api, head, card, field, btn, note, bar, bars } from "./ui.js";

export async function attendance(root) {
  const subs = await api("/attendance");
  const name = h("input", { placeholder: "Subject name" }), att = h("input", { type: "number", min: 0, value: 0 }), tot = h("input", { type: "number", min: 0, value: 0 });
  fill(root, head("Attendance guard", "Stay above the 75% rule. See exactly how many classes you can skip."),
    h("div", { class: "cols" },
      h("div", {}, subs.length ? subs.map((s) => card(null,
        h("div", { class: "btns", style: "justify-content:space-between" }, h("strong", {}, s.name), h("span", { class: s.pct < 75 ? "bad" : "good" }, `${s.pct}%`)),
        bar(s.pct, s.pct < 75 ? "red" : ""), h("p", { class: "small muted" }, `${s.attended} of ${s.total} classes attended`),
        h("p", {}, s.pct < 75 ? `Attend the next ${s.need_to_attend} classes in a row to reach 75%.` : `You can safely skip ${s.can_skip} more class(es).`),
        h("div", { class: "btns" }, btn("Present today", async () => { await api(`/attendance/${s.id}/mark`, { present: true }); attendance(root); }, "ghost"),
          btn("Absent today", async () => { await api(`/attendance/${s.id}/mark`, { present: false }); attendance(root); }, "ghost"),
          btn("Remove", async () => { await api(`/attendance/${s.id}/delete`, {}); attendance(root); }, "ghost danger")))) : card(null, note("Add your subjects to start tracking."))),
      card("Add a subject", field("Subject", name), h("div", { class: "two" }, field("Classes attended", att), field("Total classes so far", tot)),
        btn("Add subject", async () => { await api("/attendance", { name: name.value, attended: Number(att.value), total: Number(tot.value) }); attendance(root); }))));
}

export async function budget(root) {
  const b = await api("/budget");
  const limit = h("input", { type: "number", min: 0, value: b.limit || "" }), cat = h("select", {}, ["Food", "Transport", "Study", "Fun", "Recharge", "Other"].map((c) => h("option", { value: c }, c)));
  const amt = h("input", { type: "number", min: 0, placeholder: "Amount in rupees" }), nt = h("input", { placeholder: "Note (optional)" });
  const max = Math.max(1, ...Object.values(b.by_category));
  fill(root, head("Hostel budget", "Know what you can safely spend each day this month."),
    h("div", { class: "stats" }, [["Monthly limit", "Rs " + b.limit], ["Spent", "Rs " + b.spent], ["Remaining", "Rs " + b.remaining], ["Safe per day", "Rs " + b.safe_daily]].map(([l, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l)))),
    h("div", { class: "cols" },
      h("div", {}, card("Spending by category", Object.keys(b.by_category).length ? Object.entries(b.by_category).map(([c, v]) => h("div", {}, h("p", { class: "small" }, `${c}: Rs ${v}`), bar((v / max) * 100))) : note("No expenses this month.")),
        card("Recent expenses", b.recent.length ? h("ul", { class: "list" }, b.recent.map((e) => h("li", { class: "row later" }, h("div", { class: "grow" }, h("strong", {}, `Rs ${e.amount} ${e.category}`), h("span", { class: "muted small" }, `${e.day} ${e.note || ""}`)),
          btn("Delete", async () => { await api(`/expenses/${e.id}/delete`, {}); budget(root); }, "ghost danger")))) : note("Nothing yet."))),
      h("div", {}, card("Set monthly budget", field("Amount (Rs)", limit), btn("Save budget", async () => { await api("/budget/limit", { amount: Number(limit.value) }); budget(root); })),
        card("Add an expense", field("Category", cat), field("Amount", amt), field("Note", nt), btn("Add expense", async () => { await api("/budget/expense", { category: cat.value, amount: Number(amt.value), note: nt.value }); budget(root); })))));
}

export async function placement(root) {
  const cats = await api("/prep");
  const catIn = h("input", { placeholder: "Category, e.g. DSA" }), title = h("input", { placeholder: "What to prepare" });
  fill(root, head("Placement prep", "A checklist for DSA, aptitude, CS core and career basics."),
    !cats.length ? card(null, note("Start with a ready-made checklist, then edit it."), btn("Add starter checklist", async () => { await api("/prep/starter", {}); placement(root); })) : null,
    h("div", { class: "cols" },
      h("div", {}, cats.map((c) => card(`${c.category}: ${c.pct}% done`, bar(c.pct), h("ul", { class: "list" }, c.items.map((i) => h("li", { class: "row later" },
        h("div", { class: "grow" }, h("span", { style: i.done ? "text-decoration:line-through;opacity:.6" : "" }, i.title)),
        btn(i.done ? "Undo" : "Done", async () => { await api(`/prep/${i.id}/toggle`, {}); placement(root); }, i.done ? "ghost on" : "ghost"),
        btn("x", async () => { await api(`/prep/${i.id}/delete`, {}); placement(root); }, "ghost danger"))))))),
      card("Add an item", field("Category", catIn), field("Topic", title), btn("Add", async () => { await api("/prep", { category: catIn.value, title: title.value }); placement(root); }))));
}

import { fill, h, api, toast, head, card, field, btn, note, bars, when } from "./ui.js";

export async function github(root) {
  const out = h("div"), res = h("div");
  fill(root, head("Code activity", "GitHub Sentinel watches your commits against project deadlines. Set your username in Settings."),
    h("div", { class: "cols" },
      card("Sentinel", btn("Check my activity", async () => {
        const s = await api("/github/sentinel");
        fill(out, s.warning ? h("div", { class: "banner late" }, s.warning) : h("div", { class: "banner" }, "No code warnings. Keep your rhythm."),
          h("div", { class: "stats" }, [["Last push", s.last_push_days == null ? "n/a" : s.last_push_days + " d ago"], ["Commit streak", s.streak + " d"], ["Active days (7)", s.active_days_week]].map(([l, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l)))),
          s.next_deadline ? note(`Next project deadline: ${s.next_deadline.title} on ${when(s.next_deadline.due_date)}`) : note("No project deadline in the next 3 weeks."),
          ...s.repos.map((r) => h("p", { class: "small" }, `${r.name} ${r.language ? "(" + r.language + ")" : ""}: ${r.pushed_days_ago == null ? "n/a" : r.pushed_days_ago + " days ago"}`)));
      }), out),
      card("Resume and portfolio helper", note("The local AI writes resume bullets from your public repositories."), btn("Write my resume bullets", async () => { const r = await api("/github/resume", {}); fill(res, h("p", { style: "white-space:pre-wrap" }, r.text)); }), res)));
}

export async function group(root) {
  const info = await api("/info"), posts = await api("/group"), me = (await api("/settings").catch(() => ({}))).display_name || "";
  const name = h("input", { value: me, placeholder: "Your name" }), text = h("textarea", { rows: 3, placeholder: "Share a note, a plan or a question" });
  fill(root, head("Study group", info.local ? "A shared board for friends on the same Wi-Fi." : "You are a guest. You can only use this board."),
    h("div", { class: "cols" },
      card("Board", posts.length ? h("ul", { class: "list" }, posts.map((p) => h("li", { class: "row later" }, h("div", { class: "grow" }, h("strong", {}, `${p.name} `, h("span", { class: "muted small" }, p.ts)), h("span", {}, p.text))))) : note("No posts yet.")),
      h("div", {}, card("Post", field("Name", name), text, btn("Share", async () => { await api("/group", { name: name.value, text: text.value }); group(root); })),
        info.local ? card("Invite your friends", info.sharing
          ? [h("p", {}, "Friends on your Wi-Fi can open:"), h("p", {}, h("strong", {}, `http://${info.lan_ip}:${info.port}`)), note("They only see this board, never your notes or data.")]
          : [note("Sharing is off, so your data is private. To invite friends, close ScholarIQ and open ScholarIQ-Group.bat instead.")]) : null)));
}

export async function mentor(root) {
  const m = await api("/mentor");
  fill(root, head("Mentor view", "Class-level wellbeing trends. " + m.note),
    h("div", { class: "stats" }, [["Check-ins (14 d)", m.n], ["Avg burnout", m.avg_score ?? "n/a"], ["High burnout", m.high_pct + "%"], ["Avg sleep", m.avg_sleep ? m.avg_sleep + " h" : "n/a"], ["Avg mood", m.avg_mood ?? "n/a"], ["Overdue tasks", m.overdue]].map(([l, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l)))),
    card("Average burnout score, last 7 days", bars(m.by_day.map((d) => ({ value: d.avg || 0, label: when(d.day), title: d.n + " check-ins" })), 100)),
    m.high_pct >= 25 ? card(null, h("p", { class: "bad" }, `${m.high_pct}% of recent check-ins show high burnout. A relaxed week, shorter deadlines or a doubt-clearing session could help.`)) : null,
    note("Tip: Settings, then Load demo data, fills this view with a sample class."));
}

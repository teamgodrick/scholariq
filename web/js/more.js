import { fill, h, api, toast, head, card, field, btn, note } from "./ui.js";

export async function review(root) {
  const out = h("div");
  fill(root, head("Weekly review", "Your week in numbers, with three actions from the local AI."),
    card(null, btn("Generate my weekly review", async () => {
      const r = await api("/review", {}), s = r.stats;
      fill(out, 
        h("div", { class: "stats" }, [["Check-ins", s.checkins], ["Avg sleep", s.avg_sleep_h ?? "n/a"], ["Avg burnout", s.avg_burnout ?? "n/a"], ["Tasks done", s.tasks_done], ["Focus min", s.focus_minutes], ["Habits", s.habit_completion_pct == null ? "n/a" : s.habit_completion_pct + "%"], ["Spent", "Rs " + s.spent_this_week]].map(([l, v]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l)))),
        s.low_attendance.length ? h("p", { class: "bad" }, "Low attendance: " + s.low_attendance.join(", ")) : null,
        r.review ? card("Coach's review", h("p", { style: "white-space:pre-wrap" }, r.review)) : h("div", { class: "banner late" }, r.error));
    }), out));
}

export async function settings(root) {
  const [s, md] = await Promise.all([api("/settings"), api("/models")]);
  const pickModel = (key, label) => { const sel = h("select", {}, [h("option", { value: "" }, "Automatic"), ...(md.models || []).map((id) => h("option", { value: id }, id))]); sel.value = s[key] || ""; return [sel, field(label, sel)]; };
  const [chatSel, chatField] = pickModel("chat_model", "Chat model"), [embSel, embField] = pickModel("embed_model", "Embedding model (for search)"), [visSel, visField] = pickModel("vision_model", "Vision model (for pictures)");
  const bed = h("input", { type: "time", value: s.bedtime || "23:00" }), gh = h("input", { value: s.github_user, placeholder: "e.g. octocat" });
  const memSel = h("select", {}, [["small", "Small: works with any model, best for 8 GB laptops"], ["medium", "Medium: models with 8k+ context"], ["large", "Large: models with 16k+ context"]].map(([v, l]) => h("option", { value: v }, l))); memSel.value = s.ai_memory || "small";
  const nm = h("input", { value: s.display_name, placeholder: "Your name" }), menu = h("textarea", { rows: 4, placeholder: "Paste this week's mess menu" }); menu.value = s.mess_menu || "";
  fill(root, head("Settings", "Everything is stored only on this laptop."),
    h("div", { class: "cols" },
      card("Profile", field("Display name", nm), field("Bedtime (for the wind-down reminder)", bed), field("GitHub username", gh), field("Mess menu", menu), h("h2", { style: "margin-top:18px" }, "AI models"), chatField, embField, visField, field("AI memory (how much of your notes and chat the AI reads at once)", memSel), note("Models you downloaded in LM Studio appear here. Automatic picks for you."),
        btn("Save settings", async () => { await api("/settings", { display_name: nm.value, bedtime: bed.value, github_user: gh.value, mess_menu: menu.value, chat_model: chatSel.value, embed_model: embSel.value, vision_model: visSel.value, ai_memory: memSel.value }); toast("Saved."); })),
      h("div", {}, card("Demo data", note("Fills every page with a realistic sample student so you can try or present ScholarIQ. Your uploaded PDFs are kept."),
        h("div", { class: "btns" }, btn("Load demo data", async () => { if (confirm("Replace current data with demo data?")) { await api("/demo/seed", {}); toast("Demo data loaded."); location.hash = "#/today"; } }),
          btn("Clear all data", async () => { if (confirm("Delete tasks, habits and logs? This cannot be undone.")) { await api("/demo/reset", {}); toast("Cleared."); } }, "ghost danger"))),
        card(null, h("div", { class: "hero" }, h("img", { src: "/img/logo.jpg", alt: "ScholarIQ" }), h("div", {}, h("h2", {}, "ScholarIQ"), h("p", { class: "muted" }, "Study. Plan. Thrive."), note("Runs on your laptop with a local model through LM Studio. No cloud, no data sharing."))))))); 
}

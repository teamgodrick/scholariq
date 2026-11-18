import { fill, h, api, upload, toast, head, card, field, btn, note } from "./ui.js";

const chat = []; // conversation memory while the tab is open: {role, text, sources, fromNotes, q}
const ACCEPT = ".pdf,.pptx,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp";

function quizBox(items) {
  const box = h("div", { class: "msg ai" }, h("strong", {}, "Practice questions"));
  items.forEach((it, i) => {
    const ans = h("p", { class: "muted", style: "display:none" }, it.a);
    box.append(h("p", {}, `${i + 1}. ${it.q}`), h("div", {}, btn("Show answer", async () => { ans.style.display = ans.style.display === "none" ? "block" : "none"; }, "ghost")), ans);
  });
  return box;
}

let picked = null; // null means every document; otherwise the names of the documents to use

function docPicker(docs) {
  if (picked) picked = picked.filter((n) => docs.some((d) => d.doc === n));
  if (picked && !picked.length) picked = null;
  const names = () => docs.map((d) => d.doc);
  const isAll = () => picked === null || picked.length === docs.length;
  const wrap = h("div", { class: "docpick" });
  const list = h("div", { class: "docpick-list", style: "display:none" });
  const toggle = h("button", { type: "button", class: "ghost", "aria-expanded": "false" });
  const paint = () => {
    toggle.textContent = !docs.length ? "No documents yet" : isAll() ? `Using all documents (${docs.length}), change` : `Using ${picked.length} of ${docs.length} documents, change`;
    const allBox = h("input", { type: "checkbox", checked: isAll(), onchange: () => { picked = allBox.checked ? null : []; paint(); } });
    fill(list, h("label", { class: "check" }, allBox, h("strong", {}, "All documents")),
      ...docs.map((d) => {
        const box = h("input", { type: "checkbox", checked: isAll() || picked.includes(d.doc), onchange: () => {
          const cur = picked === null ? names() : picked.slice();
          const next = box.checked ? [...new Set([...cur, d.doc])] : cur.filter((n) => n !== d.doc);
          picked = next.length === docs.length ? null : next;
          paint();
        } });
        return h("label", { class: "check" }, box, `${d.doc} (${d.sections} sections)`);
      }),
      picked && !picked.length ? h("p", { class: "bad small" }, "Tick at least one document, or tick All documents.") : null);
  };
  toggle.addEventListener("click", () => {
    const open = list.style.display === "none";
    list.style.display = open ? "block" : "none";
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  paint();
  fill(wrap, toggle, list);
  return wrap;
}

async function streamAnswer(payload, el) {
  let res;
  try { res = await fetch("/api/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
  catch { throw new Error("ScholarIQ is not running. Double-click ScholarIQ.bat again."); }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Request failed (${res.status})`); }
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", done = null;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === "token") { text += ev.t; el.textContent = text; }
      else if (ev.type === "error") throw new Error(ev.detail);
      else if (ev.type === "done") done = ev;
    }
  }
  if (!done) throw new Error("The answer was cut off. Try again.");
  return done;
}

export async function pilot(root) {
  const docs = await api("/docs");
  let mode = "hybrid", careful = false;
  const carefulBtn = btn("Double-check: off", async () => { careful = !careful; carefulBtn.textContent = "Double-check: " + (careful ? "on" : "off"); }, "ghost");
  const thread = h("div"), input = h("input", { placeholder: "Ask anything: your notes first, then general knowledge" });
  const picker = docPicker(docs);
  const modeBtn = btn("Mode: notes + general knowledge", async () => {
    mode = mode === "hybrid" ? "notes" : "hybrid";
    modeBtn.textContent = mode === "hybrid" ? "Mode: notes + general knowledge" : "Mode: notes only";
  }, "ghost");
  const show = (m) => {
    const el = h("div", { class: "msg " + (m.role === "user" ? "user" : "ai") }, m.text);
    if (m.role === "ai") {
      if (m.note) el.append(h("div", {}, h("span", { class: "chip" }, m.note)));
      if (m.fromNotes === false) el.append(h("div", {}, h("span", { class: "chip" }, "General knowledge, not from your notes")));
      (m.sources || []).forEach((s) => el.append(h("span", { class: "chip", title: s.snippet }, `${s.label}, ${s.doc}`)));
      if (m.sources && m.sources.length) el.append(h("div", {}, btn("Quiz me on this", async () => {
        const wait = h("div", { class: "msg ai" }, h("span", { class: "spinner" }), " Writing practice questions from your notes... this can take a moment.");
        thread.append(wait);
        if (wait.scrollIntoView) wait.scrollIntoView();
        try { const z = await api("/quiz", { topic: m.q, n: 5, docs: picked }); wait.remove(); thread.append(quizBox(z.items)); }
        catch (e) { wait.remove(); throw e; }
      }, "ghost")));
    }
    thread.append(el);
  };
  chat.forEach(show);
  async function ask() {
    const q = input.value.trim();
    if (!q) return;
    if (picked !== null && picked.length === 0) { toast("Tick at least one document, or tick All documents.", "err"); return; }
    input.value = "";
    const mine = { role: "user", text: q };
    chat.push(mine); show(mine);
    const wait = h("div", { class: "msg ai" }, "Thinking locally...");
    thread.append(wait);
    try {
      const payload = { question: q, mode, docs: picked, history: chat.slice(-25, -1).map((m) => ({ role: m.role, text: m.text })) };
      const r = careful ? await api("/chat", { ...payload, careful: true }) : await streamAnswer(payload, wait);
      wait.remove();
      const m = { role: "ai", text: r.answer, sources: r.sources, fromNotes: r.from_notes, q,
        note: r.checked ? (r.fixed ? "Double-checked and corrected" : "Double-checked against your notes") : "" };
      chat.push(m); show(m);
    } catch (e) { wait.remove(); toast(e.message, "err"); }
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
  fill(root, head("Prof. Pilot", "Answers from your own library first, then from general knowledge. Everything runs on this laptop."),
    h("div", { class: "btns" }, modeBtn, carefulBtn, h("a", { href: "#/library" }, docs.length ? "Manage your library" : "Add your notes in Knowledge library")),
    picker,
    h("div", { style: "height:14px" }), thread,
    h("div", { class: "btns" }, h("div", { style: "flex:1" }, input), btn("Ask", ask), btn("New chat", async () => { chat.length = 0; pilot(root); }, "ghost")));
}

export async function library(root) {
  const [docs, st] = await Promise.all([api("/docs"), api("/health")]);
  const file = h("input", { type: "file", multiple: true, accept: ACCEPT, hidden: true });
  const vis = h("input", { type: "checkbox", style: "width:auto;margin-right:8px" });
  const out = h("div");
  const dir = h("input", { type: "file", multiple: true, webkitdirectory: true, hidden: true });
  const okExt = ACCEPT.split(",");
  const ingestAll = async (files) => {
    for (const f of files) {
      toast(`Reading ${f.name} locally...`);
      try {
        const r = await upload(`/ingest?name=${encodeURIComponent(f.name)}&vision=${vis.checked ? 1 : 0}`, f);
        toast(`${r.doc}: ${r.sections} sections${r.embedded ? "" : " (keyword search only, load the embedding model)"}`);
      } catch (e) { toast(`${f.name}: ${e.message}`, "err"); }
    }
    library(root);
  };
  file.addEventListener("change", () => ingestAll(Array.from(file.files)));
  dir.addEventListener("change", () => ingestAll(Array.from(dir.files).filter((f) => okExt.some((x) => f.name.toLowerCase().endsWith(x)))));
  fill(root, head("Knowledge library", "Feed ScholarIQ your slides, notes, books, flowcharts and handouts. It searches by keywords and by meaning."),
    h("div", { class: "cols" },
      h("div", {}, card("Add files", note("PDF, PowerPoint, Word, TXT, Markdown, CSV and pictures (PNG, JPG). PowerPoint flowcharts are read from their arrows."),
        h("label", {}, vis, "Also describe pictures and diagrams inside files (slower, needs a vision model)"),
        h("div", { class: "btns" }, file, dir, btn("Choose files", async () => file.click()), btn("Choose a whole folder", async () => dir.click(), "ghost"),
          btn("Scan library folder", async () => {
            const r = await api("/library/scan", {});
            toast(r.added.length ? `Added ${r.added.length} file(s).` : "Nothing new in the library folder.");
            if (r.errors.length) toast(r.errors[0], "err");
            library(root);
          }, "ghost")),
        note("Tip: copy files into the library folder inside the ScholarIQ folder, then press Scan.")),
        card("Your documents", docs.length ? h("ul", { class: "list" }, docs.map((d) => h("li", { class: "row later" },
          h("div", { class: "grow" }, h("strong", {}, d.doc), h("span", { class: "muted small" }, `${d.sections} sections${d.keyword_only ? `, ${d.keyword_only} keyword-only` : ""}`)),
          btn("Remove", async () => { await api("/docs/delete", { doc: d.doc }); library(root); }, "ghost danger")))) : note("Nothing here yet. Add a file or scan the library folder."))),
      h("div", {}, card("AI status", st.ok ? [h("p", {}, `Chat model: ${st.chat}`), h("p", {}, `Embedding model: ${st.embed || "missing, search uses keywords only"}`),
        h("p", {}, `Vision model: ${st.vision || "none, pictures cannot be read"}`), note("Choose different models in Settings.")] : h("p", { class: "bad" }, st.error)),
        card("AI health check", note("ScholarIQ writes questions from random parts of your library and checks whether search finds the right source."),
          btn("Run health check", async () => {
            const r = await api("/ai/selftest", { n: 6 });
            fill(out, h("p", {}, h("strong", {}, `Search accuracy: ${r.hit_rate}%`), ` (${r.hits} of ${r.tested} found the right source)`),
              r.meaning_search ? null : h("p", { class: "bad small" }, "Meaning search is off because no embedding model is loaded."),
              ...r.items.map((i) => h("p", { class: "small" }, `${i.rank ? "Found at rank " + i.rank : "Missed"}: ${i.question} (${i.source})`)));
          }), out))));
}

export async function cards(root) {
  const decks = await api("/flashcards/decks"), due = await api("/flashcards/due");
  const topic = h("input", { placeholder: "Leave empty to cover your whole library" }), n = h("input", { type: "number", min: 3, max: 15, value: 8 });
  const stage = h("div");
  let i = 0, shown = false;
  function view() {
    if (i >= due.length) { fill(stage, h("p", { class: "center" }, due.length ? "All done for today. Cards return when they are due." : "No cards due. Generate some from your notes.")); return; }
    const c = due[i];
    const grades = [["Again", 0], ["Hard", 1], ["Good", 2], ["Easy", 3]];
    fill(stage, note(`Card ${i + 1} of ${due.length}, deck: ${c.deck}`), h("div", { class: "card flash" }, c.front),
      shown ? h("div", { class: "card flash" }, c.back) : null,
      shown ? h("div", { class: "btns" }, grades.map(([l, g]) => btn(l, async () => { await api(`/flashcards/${c.id}/review`, { grade: g }); i++; shown = false; view(); }, "ghost")))
        : btn("Show answer", async () => { shown = true; view(); }));
  }
  view();
  fill(root, head("Flashcards", "Spaced repetition: hard cards come back sooner, easy ones later. Every new batch covers fresh material."),
    h("div", { class: "cols" }, card("Review", stage),
      h("div", {}, card("Make cards from my notes", field("Topic", topic), field("How many", n),
        btn("Generate new cards", async () => {
          const r = await api("/flashcards/generate", { topic: topic.value, n: Number(n.value) });
          toast(`${r.created} new cards added to "${r.deck}"${r.skipped ? `, ${r.skipped} duplicates skipped` : ""}.`); cards(root);
        })),
        card("Your decks", decks.length ? decks.map((d) => h("p", {}, `${d.deck}: ${d.total} cards, ${d.due || 0} due`)) : note("No decks yet.")))));
}
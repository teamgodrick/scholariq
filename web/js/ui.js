// Small helpers shared by every page. Text is always inserted as text (never as HTML).
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked" || k === "disabled") el[k] = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export async function api(path, body) {
  const init = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let res;
  try { res = await fetch("/api" + path, init); }
  catch { throw new Error("ScholarIQ is not running. Double-click ScholarIQ.bat again."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export async function upload(path, file) {
  let res;
  try { res = await fetch("/api" + path, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file }); }
  catch { throw new Error("ScholarIQ is not running. Double-click ScholarIQ.bat again."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Upload failed (${res.status})`);
  return data;
}

export function toast(msg, kind = "ok") {
  const box = document.getElementById("toasts");
  const t = h("div", { class: "toast " + (kind === "err" ? "err" : "") }, msg);
  box.append(t);
  setTimeout(() => t.remove(), 4500);
}

export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
}

export const head = (title, sub) => h("header", { class: "page-head" }, h("h1", {}, title), sub ? h("p", { class: "muted" }, sub) : null);
export const card = (title, ...kids) => h("section", { class: "card" }, title ? h("h2", {}, title) : null, ...kids);
export const field = (label, input) => h("label", {}, label, input);
export const note = (t) => h("p", { class: "muted small" }, t);
export const bar = (pct, cls = "") => h("div", { class: "bar " + cls }, h("span", { style: `width:${Math.max(0, Math.min(100, pct))}%` }));

const BUSY = {
  "Quiz me on this": "Writing your quiz...", "Find deadline": "Reading message...", "Add task": "Adding...",
  "Build my plan": "Building your plan...", "Generate new cards": "Creating cards...", "Run health check": "Testing (about a minute)...",
  "Scan library folder": "Scanning...", "Generate my weekly review": "Writing your review...", "Summarise my week": "Reading your week...",
  "Suggest a meal": "Thinking...", "Write my resume bullets": "Writing...", "Check my activity": "Checking GitHub...",
  "Save check-in": "Saving...", "Load demo data": "Loading...", "Ask": "Thinking...",
};

// A button that shows a spinner and a clear message while its action is running (after a short pause,
// so quick actions do not flicker).
export function btn(text, onclick, cls = "primary", busyText = BUSY[text] || "Working...") {
  const b = h("button", { class: cls, type: "button" }, text);
  b.addEventListener("click", async () => {
    const before = b.textContent;
    b.disabled = true;
    const timer = setTimeout(() => { b.textContent = busyText; b.className = cls + " busy"; }, 350);
    try { await onclick(b); }
    catch (e) { toast(e.message || "Something went wrong", "err"); }
    finally {
      clearTimeout(timer);
      b.disabled = false;
      b.className = cls;
      if (b.textContent === busyText) b.textContent = before;
    }
  });
  return b;
}

export function bars(items, max) {
  return h("div", { class: "bars" }, items.map((i) =>
    h("div", { class: "bcol", title: i.title || "" },
      h("div", { class: "bfill", style: `height:${max ? Math.round((i.value / max) * 100) : 0}%` }),
      h("span", { class: "small muted" }, i.label))));
}

export const when = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
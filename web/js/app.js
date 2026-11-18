import { fill, h, api } from "./ui.js";
import { icon } from "./icons.js";
import * as plan from "./plan.js";
import * as study from "./study.js";
import * as life from "./life.js";
import * as campus from "./campus.js";
import * as social from "./social.js";
import * as more from "./more.js";

const PAGES = [
  { id: "today", label: "Today", group: "Plan", fn: plan.today },
  { id: "exam", label: "Exam mode", group: "Plan", fn: plan.exam },
  { id: "focus", label: "Focus", group: "Plan", fn: plan.focus },
  { id: "pilot", label: "Prof. Pilot", group: "Study", fn: study.pilot },
  { id: "library", label: "Knowledge library", group: "Study", fn: study.library },
  { id: "cards", label: "Flashcards", group: "Study", fn: study.cards },
  { id: "checkin", label: "Check-in", group: "Wellbeing", fn: life.checkin },
  { id: "journal", label: "Mood journal", group: "Wellbeing", fn: life.journal },
  { id: "habits", label: "Habits", group: "Wellbeing", fn: life.habits },
  { id: "nutrition", label: "Nutrition", group: "Wellbeing", fn: life.nutrition },
  { id: "attendance", label: "Attendance", group: "Campus life", fn: campus.attendance },
  { id: "budget", label: "Budget", group: "Campus life", fn: campus.budget },
  { id: "placement", label: "Placement prep", group: "Campus life", fn: campus.placement },
  { id: "github", label: "Code activity", group: "Code", fn: social.github },
  { id: "group", label: "Study group", group: "Together", fn: social.group },
  { id: "mentor", label: "Mentor view", group: "Together", fn: social.mentor },
  { id: "review", label: "Weekly review", group: "Insights", fn: more.review },
  { id: "settings", label: "Settings", group: "Insights", fn: more.settings },
];

const app = document.getElementById("app");
let guest = false;

function route() { return (location.hash.replace("#/", "") || "today"); }

async function render() {
  clearInterval(window.__sqTimer); document.title = "ScholarIQ";
  const pages = guest ? PAGES.filter((p) => p.id === "group") : PAGES;
  const page = pages.find((p) => p.id === route()) || pages[0];
  nav(pages, page.id);
  const main = document.getElementById("main");
  fill(main, h("p", { class: "muted" }, "Loading..."));
  try { await page.fn(main); }
  catch (e) { fill(main, h("div", { class: "banner late" }, e.message || "Something went wrong.")); }
}

function nav(pages, active) {
  const box = document.getElementById("nav"); const kids = []; let last = "";
  for (const p of pages) {
    if (p.group !== last) { kids.push(h("div", { class: "grp" }, h("span", { class: "lbl" }, p.group))); last = p.group; }
    kids.push(h("button", { class: "nav" + (p.id === active ? " active" : ""), title: p.label, "aria-label": p.label, "aria-current": p.id === active ? "page" : false,
      onclick: () => { location.hash = "#/" + p.id; } }, icon(p.id), h("span", { class: "lbl" }, p.label)));
  }
  fill(box, ...kids);
}

async function pollEngine() {
  const dot = document.getElementById("dot"), txt = document.getElementById("engine-text");
  try {
    const s = await api("/health");
    dot.className = "dot " + (s.ok ? "on" : "off");
    txt.textContent = s.ok ? `Local AI online: ${s.chat}${s.embed_ready ? "" : " (embedding model missing)"}` : s.error;
  } catch { dot.className = "dot off"; txt.textContent = "ScholarIQ is not running."; }
  document.getElementById("engine").setAttribute("title", txt.textContent);
}

function savedCollapsed() { try { return localStorage.getItem("sq_menu") === "collapsed"; } catch { return false; } }

async function start() {
  try { guest = !(await api("/info")).local; } catch { guest = false; }
  let collapsed = savedCollapsed();
  const toggle = h("button", { class: "side-toggle", type: "button" }, icon("chevron", 18));
  const shell = h("div", { class: "shell" });
  const apply = () => {
    shell.className = "shell" + (collapsed ? " collapsed" : "");
    const text = collapsed ? "Show full menu" : "Hide menu to focus";
    toggle.setAttribute("title", text);
    toggle.setAttribute("aria-label", text);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    try { localStorage.setItem("sq_menu", collapsed ? "collapsed" : "open"); } catch { /* storage may be blocked */ }
  };
  toggle.addEventListener("click", () => { collapsed = !collapsed; apply(); });
  apply();
  fill(shell,
    h("aside", { class: "side" },
      h("div", { class: "brand-row" },
        h("div", { class: "brand" }, h("img", { src: "/img/emblem.png", alt: "ScholarIQ" }), h("div", { class: "lbl" }, h("div", { class: "wm" }, "scholar", h("b", {}, "IQ")), h("span", { class: "tag" }, "STUDY · PLAN · THRIVE"))),
        guest ? null : toggle),
      h("nav", { id: "nav", "aria-label": "Main" }),
      h("div", { class: "engine", id: "engine", role: "status" }, h("span", { id: "dot", class: "dot off" }), h("span", { id: "engine-text", class: "lbl" }, "Connecting..."))),
    h("main", { class: "main", id: "main" }));
  fill(app, shell);
  window.addEventListener("hashchange", render);
  render(); if (!guest) { pollEngine(); setInterval(pollEngine, 10000); }
}
start();
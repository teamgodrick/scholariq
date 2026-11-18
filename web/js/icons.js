// One clean outline icon per tab (24x24, drawn to match). Used by the sidebar.
const NS = "http://www.w3.org/2000/svg";
const R = (x, y, w, h, rx) => ["rect", { x, y, width: w, height: h, rx }];
const C = (cx, cy, r) => ["circle", { cx, cy, r }];
const P = (d) => ["path", { d }];

const ICONS = {
  today: [R(3.5, 5, 17, 15.5, 2.5), P("M3.5 10h17M8 3.5v3M16 3.5v3M9 15l2.2 2.2L15.5 13")],
  exam: [R(5, 4.5, 14, 16.5, 2.5), R(9, 3, 6, 3.5, 1), P("M9 13.5l2.3 2.3 4-4.3")],
  focus: [C(12, 13.5, 7.5), P("M12 13.5V9.5M9.5 3h5M12 3v3M18.5 6.5l1.2-1.2")],
  pilot: [P("M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"), P("M8.5 8h7M8.5 11.5h4.5")],
  library: [P("M12 6.5C10.3 5 7.8 4.5 4 4.5v13c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-13c-3.8 0-6.3.5-8 2z"), P("M12 6.5v13")],
  cards: [R(7, 3.5, 13.5, 14, 2.2), P("M4 7.5v10.2A2.8 2.8 0 0 0 6.8 20.5H17")],
  checkin: [P("M3 12h4l2.5-6 4 12 2.5-6H21")],
  journal: [P("M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H6.5A1.5 1.5 0 0 0 5 19.5z"), P("M5 19.5A1.5 1.5 0 0 0 6.5 21H18M9 7.5h5.5M9 11h4")],
  habits: [P("m17 2 4 4-4 4"), P("M3 11v-1a4 4 0 0 1 4-4h14"), P("m7 22-4-4 4-4"), P("M21 13v1a4 4 0 0 1-4 4H3")],
  nutrition: [P("M12 3.5s6 6.2 6 10.8a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5z")],
  attendance: [C(9.5, 8, 3.5), P("M3 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16.5 11l2 2 3.5-4")],
  calendar: [R(3.5, 5, 17, 15.5, 2.5), P("M3.5 10h17M8 3.5v3M16 3.5v3M8 14h2M14 14h2M8 17h2")],
  budget: [P("M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"), P("M4 7.5v10A2.5 2.5 0 0 0 6.5 20H20V8H6.5A2.5 2.5 0 0 1 4 7.5z"), C(16, 14, 1.2)],
  placement: [R(3.5, 7.5, 17, 12, 2.2), P("M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17")],
  github: [C(6.5, 5.5, 2.2), C(6.5, 18.5, 2.2), C(17.5, 8, 2.2), P("M6.5 7.7v8.6M17.5 10.2v1.3a3 3 0 0 1-3 3H6.5")],
  group: [C(9, 8.5, 3.2), P("M2.8 19.5c0-3.3 2.8-5.5 6.2-5.5s6.2 2.2 6.2 5.5"), P("M16 5.6a3.2 3.2 0 0 1 0 5.8M18.5 14.3c1.8.7 2.9 2.3 2.9 5.2")],
  mentor: [P("M4 20V10M10 20V4M16 20v-7M3 20h18")],
  review: [P("M3 17l6-6 4 4 8-8"), P("M15 7h6v6")],
  settings: [P("M4 7h9M17 7h3M4 17h3M11 17h9"), C(15, 7, 2), C(9, 17, 2)],
  chevron: [P("m15 6-6 6 6 6")],
};

export function icon(name, size = 20) {
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "ico" })) svg.setAttribute(k, v);
  for (const [tag, attrs] of ICONS[name] || []) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}
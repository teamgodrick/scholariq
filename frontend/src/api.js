// ScholarIQ API Client - Connects to local FastAPI backend on port 8000
const BASE = "http://localhost:8000";

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch {
    throw new Error("Cannot reach ScholarIQ backend on port 8000. Is 2-run-backend.bat running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Request failed with status ${res.status}`);
  }
  return data;
}

const post = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // System Health & Local AI Models
  health: () => req("/health"),

  // Chrono-Regulator & Tasks
  plan: () => req("/plan/today"),
  addTask: (task) => req("/tasks", post(task)),
  doneTask: (id) => req(`/tasks/${id}/done`, { method: "POST" }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: "DELETE" }),
  replan: () => req("/tasks/replan", { method: "POST" }),
  extract: (text) => req("/tasks/extract", post({ text })),
  getTimetable: (day) => req(`/timetable${day ? `?day=${day}` : ""}`),
  addClass: (cls) => req("/timetable", post(cls)),

  // Prof. Pilot (RAG Study Assistant)
  ingest: (file) => {
    const form = new FormData();
    form.append("file", file);
    return req("/ingest", { method: "POST", body: form });
  },
  getDocuments: () => req("/documents"),
  deleteDocument: (docName) => req(`/documents/${encodeURIComponent(docName)}`, { method: "DELETE" }),
  chat: (question) => req("/chat", post({ question })),
  quiz: (topic) => req("/quiz", post({ topic })),
  summary: (topic) => req("/summary", post({ topic })),
  viva: (topic) => req("/viva", post({ topic })),
  flashcards: (topic) => req("/flashcards", post({ topic })),

  // Wellness Core
  checkin: (data) => req("/checkin", post(data)),

  // GitHub Repo Sentinel
  checkRepo: (params = { owner: "team-scholars", repo: "ScholarIQ" }) => req("/sentinel", post(params)),

  // Academic Toolkit
  getAttendance: () => req("/attendance"),
  saveAttendance: (data) => req("/attendance", post(data)),
  markAttendance: (data) => req("/attendance/mark", post(data)),
  getHabits: () => req("/habits"),
  toggleHabit: (id) => req("/habits/toggle", post({ id })),
  addHabit: (data) => req("/habits", post(data)),
  getBudget: () => req("/budget"),
  addBudget: (data) => req("/budget", post(data)),
  generateExamPlan: (data) => req("/exam/plan", post(data)),
};

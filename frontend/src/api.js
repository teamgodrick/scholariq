// ScholarIQ API Client - Connects to local FastAPI backend on port 8000
const BASE = "http://localhost:8000";

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch {
    throw new Error("Cannot reach ScholarIQ backend on port 8000. Is the backend running?");
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

const put = (body) => ({
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // System Health & Engine
  health: () => req("/health"),
  configAI: (data) => req("/ai/config", post(data)),

  // Chrono-Regulator & Tasks
  plan: () => req("/plan/today"),
  addTask: (task) => req("/tasks", post(task)),
  doneTask: (id) => req(`/tasks/${id}/done`, { method: "POST" }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: "DELETE" }),
  replan: () => req("/tasks/replan", { method: "POST" }),
  extract: (text) => req("/tasks/extract", post({ text })),

  // Timetable & Holidays
  getTimetable: (day, date_str) =>
    req(`/timetable?${day ? `day=${day}&` : ""}${date_str ? `date_str=${date_str}` : ""}`),
  addClass: (cls) => req("/timetable", post(cls)),
  deleteClass: (id, day) => req(`/timetable/${id}?day=${day || "Monday"}`, { method: "DELETE" }),
  getHolidays: () => req("/holidays"),
  addHoliday: (data) => req("/holidays", post(data)),
  deleteHoliday: (id) => req(`/holidays/${id}`, { method: "DELETE" }),
  parseCalendar: (text) => req("/calendar/parse", post({ text })),

  // Prof. Pilot (Multi-File Ingest & RAG)
  ingest: (files) => {
    const form = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) {
      form.append("files", f);
    }
    return req("/ingest", { method: "POST", body: form });
  },
  getDocuments: () => req("/documents"),
  deleteDocument: (docName) => req(`/documents/${encodeURIComponent(docName)}`, { method: "DELETE" }),
  chat: (question) => req("/chat", post({ question })),
  quiz: (topic) => req("/quiz", post({ topic })),
  summary: (topic) => req("/summary", post({ topic })),
  viva: (topic) => req("/viva", post({ topic })),
  flashcards: (topic) => req("/flashcards", post({ topic })),

  // Attendance Management (From the-thing)
  getAttendance: () => req("/attendance"),
  addSubject: (data) => req("/attendance/subject", post(data)),
  updateSubject: (data) => req("/attendance/subject", put(data)),
  deleteSubject: (id) => req(`/attendance/subject/${id}`, { method: "DELETE" }),
  markAttendance: (subject_id, mark, note = "") =>
    req("/attendance/mark", post({ subject_id, mark, note })),

  // Wellness Core
  checkin: (data) => req("/checkin", post(data)),

  // GitHub Repo Sentinel
  checkRepo: (params = { owner: "team-scholars", repo: "ScholarIQ" }) => req("/sentinel", post(params)),

  // Routine Coach & Budget
  getHabits: () => req("/habits"),
  toggleHabit: (id) => req("/habits/toggle", post({ id })),
  addHabit: (data) => req("/habits", post(data)),
  editHabit: (id, data) => req(`/habits/${id}`, put(data)),
  deleteHabit: (id) => req(`/habits/${id}`, { method: "DELETE" }),
  getBudget: () => req("/budget"),
  addBudget: (data) => req("/budget", post(data)),
  setBudgetAllowance: (amount) => req("/budget/allowance", post({ amount })),
  editBudget: (id, data) => req(`/budget/${id}`, put(data)),
  deleteBudget: (id) => req(`/budget/${id}`, { method: "DELETE" }),
  generateExamPlan: (data) => req("/exam/plan", post(data)),
};

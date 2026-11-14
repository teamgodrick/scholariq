// All calls to the ScholarIQ backend live here, so the pages stay simple.
const BASE = "http://localhost:8000";

async function req(path, opts) {
  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch {
    throw new Error("Cannot reach the ScholarIQ backend on port 8000. Is uvicorn running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

const post = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => req("/health"),
  plan: () => req("/plan/today"),
  addTask: (task) => req("/tasks", post(task)),
  doneTask: (id) => req(`/tasks/${id}/done`, { method: "POST" }),
  extract: (text) => req("/tasks/extract", post({ text })),
  chat: (question) => req("/chat", post({ question })),
  quiz: (topic) => req("/quiz", post({ topic })),
  checkin: (c) => req("/checkin", post(c)),
  ingest: (file) => {
    const form = new FormData();
    form.append("file", file);
    return req("/ingest", { method: "POST", body: form });
  },
};

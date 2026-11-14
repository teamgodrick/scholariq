import { useRef, useState } from "react";
import { api } from "../api";

export default function Chat() {
  const [docs, setDocs] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setError("");
    try {
      const r = await api.ingest(file);
      setDocs((d) => [...d, `${r.doc} (${r.chunks} sections indexed)`]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      fileRef.current.value = "";
    }
  }

  async function ask(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput(""); setError(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    try {
      const r = await api.chat(q);
      setMsgs((m) => [...m, { role: "ai", text: r.answer, sources: r.sources, q }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function quiz(topic) {
    setBusy(true); setError("");
    try {
      const r = await api.quiz(topic);
      setMsgs((m) => [...m, { role: "ai", text: r.quiz }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-page">
      <header className="page-head">
        <h1>Prof. Pilot</h1>
        <p className="muted">Answers come only from your own notes, and they never leave this laptop.</p>
      </header>
      {error && <p className="alert" role="alert">{error}</p>}

      <div className="uploader">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={upload} hidden />
        <button className="primary" onClick={() => fileRef.current.click()} disabled={busy}>
          Upload a PDF
        </button>
        <span className="muted small">
          {docs.length ? docs.join(", ") : "Add your syllabus, slides or notes to begin."}
        </span>
      </div>

      <div className="thread" aria-live="polite">
        {msgs.length === 0 && (
          <p className="muted">Ask something like: &quot;What topics are in Unit 3?&quot;</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={"msg " + m.role}>
            <p>{m.text}</p>
            {m.sources && m.sources.length > 0 && (
              <div className="sources">
                {m.sources.map((s, k) => (
                  <span key={k} className="chip" title={s.snippet}>
                    Page {s.page}, {s.doc}
                  </span>
                ))}
                <button className="ghost" onClick={() => quiz(m.q)} disabled={busy}>
                  Quiz me on this
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="muted small">Thinking locally</p>}
      </div>

      <form className="composer" onSubmit={ask}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your notes"
          aria-label="Question"
        />
        <button className="primary" type="submit" disabled={busy}>Ask</button>
      </form>
    </div>
  );
}

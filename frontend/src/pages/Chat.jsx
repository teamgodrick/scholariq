import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const MODES = [
  { id: "chat", label: "💬 Ask Doubts" },
  { id: "flashcards", label: "🗂️ Flashcards" },
  { id: "quiz", label: "📝 Exam Quiz" },
  { id: "viva", label: "🎙️ Viva Voce Drill" },
  { id: "summary", label: "📑 Topic Summary" },
];

const QUICK_PROMPTS = [
  "Summarize key theorems & formulas",
  "Generate 5 exam viva questions",
  "What are the main topics in Unit 1?",
  "Explain memory management vs paging",
  "Generate flashcards for this subject",
];

export default function Chat() {
  const [docs, setDocs] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("chat");
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileRef = useRef(null);

  const loadDocs = () => {
    api
      .getDocuments()
      .then(setDocs)
      .catch(() => {});
  };

  useEffect(() => {
    loadDocs();
  }, []);

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.ingest(file);
      loadDocs();
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: `📄 Ingested "${r.doc}" successfully! Split into ${r.chunks} chunks and indexed in local ChromaDB-compatible vector memory. You can now ask any question with exact page citations.`,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteDoc(docName) {
    try {
      await api.deleteDocument(docName);
      loadDocs();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSend(promptText = input) {
    const q = promptText.trim();
    if (!q || busy) return;
    setInput("");
    setError("");
    setBusy(true);

    if (mode === "chat") {
      setMsgs((m) => [...m, { role: "user", text: q }]);
      try {
        const r = await api.chat(q);
        setMsgs((m) => [...m, { role: "ai", text: r.answer, sources: r.sources, q }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    } else if (mode === "quiz") {
      setMsgs((m) => [...m, { role: "user", text: `Generate Exam Quiz on: ${q}` }]);
      try {
        const r = await api.quiz(q);
        setMsgs((m) => [...m, { role: "ai", text: r.quiz }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    } else if (mode === "summary") {
      setMsgs((m) => [...m, { role: "user", text: `Topic Summary: ${q}` }]);
      try {
        const r = await api.summary(q);
        setMsgs((m) => [...m, { role: "ai", text: r.summary }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    } else if (mode === "viva") {
      setMsgs((m) => [...m, { role: "user", text: `Viva Voce Practice: ${q}` }]);
      try {
        const r = await api.viva(q);
        setMsgs((m) => [...m, { role: "ai", text: r.viva }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    } else if (mode === "flashcards") {
      try {
        const r = await api.flashcards(q);
        if (r.flashcards && r.flashcards.length > 0) {
          setFlashcards(r.flashcards);
          setCurrentCardIdx(0);
          setCardFlipped(false);
        } else {
          setError("No flashcards could be generated from that topic.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }
  }

  // Voice Input Speech Recognition
  function toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome/Edge.");
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  }

  return (
    <div className="chat-page">
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>Prof. Pilot</h1>
          <p className="muted">
            Ground-truth academic copilot. Answers strictly from your uploaded syllabus and notes with page citations.
          </p>
        </div>
        <span className="privacy-badge">🔒 100% Offline • Llama 3.2 8B</span>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}

      {/* PDF Uploader Card */}
      <div className="uploader">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={upload} hidden />
        <button className="primary" onClick={() => fileRef.current.click()} disabled={busy}>
          📤 Drop / Upload Syllabus PDF
        </button>
        <div style={{ flex: 1 }}>
          <span className="small muted">
            {docs.length > 0 ? (
              <span style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap" }}>
                {docs.map((d) => (
                  <span
                    key={d.doc}
                    className="chip"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    📚 {d.doc} ({d.chunks} chunks, {d.pages} pp)
                    <button
                      onClick={() => deleteDoc(d.doc)}
                      style={{ background: "none", border: 0, color: "#fca5a5", cursor: "pointer", fontSize: "12px" }}
                      title="Remove from vector store"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </span>
            ) : (
              "No notes uploaded yet. Add lecture slides, lab manuals or syllabus PDFs to index."
            )}
          </span>
        </div>
      </div>

      {/* Interactive Mode Pills */}
      <div className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-btn ${mode === m.id ? "active" : ""}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Quick Prompts Row */}
      <div className="quick-prompts">
        {QUICK_PROMPTS.map((p, idx) => (
          <button key={idx} className="quick-pill" onClick={() => handleSend(p)}>
            ⚡ {p}
          </button>
        ))}
      </div>

      {/* Active Recall Flashcards Mode */}
      {mode === "flashcards" && flashcards.length > 0 ? (
        <div style={{ margin: "20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3>Flashcard {currentCardIdx + 1} of {flashcards.length}</h3>
            <span className="muted small">Click card to reveal answer</span>
          </div>
          <div
            className="flashcard"
            onClick={() => setCardFlipped(!cardFlipped)}
          >
            <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#a855f7", marginBottom: "8px" }}>
              {cardFlipped ? "Answer" : "Question"}
            </span>
            <p style={{ fontSize: "17px", fontWeight: 600, color: "#ffffff", maxWidth: "600px" }}>
              {cardFlipped ? flashcards[currentCardIdx].answer : flashcards[currentCardIdx].question}
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "14px", marginTop: "16px" }}>
            <button
              className="ghost"
              disabled={currentCardIdx === 0}
              onClick={() => {
                setCurrentCardIdx((i) => i - 1);
                setCardFlipped(false);
              }}
            >
              ← Previous
            </button>
            <button
              className="primary"
              disabled={currentCardIdx === flashcards.length - 1}
              onClick={() => {
                setCurrentCardIdx((i) => i + 1);
                setCardFlipped(false);
              }}
            >
              Next Card →
            </button>
          </div>
        </div>
      ) : null}

      {/* Chat Thread */}
      <div className="thread" aria-live="polite">
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>🎓</div>
            <h3>Prof. Pilot is Ready</h3>
            <p className="muted small" style={{ maxWidth: "450px", margin: "0 auto" }}>
              Upload your syllabus or lecture slides above, then ask conceptual questions, request exam quizzes, or practice viva voce questions.
            </p>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={"msg " + m.role}>
            <p>{m.text}</p>
            {m.sources && m.sources.length > 0 && (
              <div className="sources">
                <span className="muted small" style={{ fontWeight: 600 }}>Citations:</span>
                {m.sources.map((s, k) => (
                  <span key={k} className="chip" title={s.snippet}>
                    📄 {s.doc} (p.{s.page})
                  </span>
                ))}
                <button
                  className="ghost"
                  style={{ marginLeft: "auto", fontSize: "12px", padding: "4px 10px" }}
                  onClick={() => {
                    setMode("quiz");
                    handleSend(m.q || "this topic");
                  }}
                  disabled={busy}
                >
                  ⚡ Quiz me on this
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c084fc", fontSize: "13px" }}>
            <span className="dot on" />
            <span>Reasoning locally with Llama 3.2 8B...</span>
          </div>
        )}
      </div>

      {/* Input Composer with Voice Microphone Button */}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "chat"
              ? "Ask a doubt from your notes (e.g. 'What is ACID in DBMS?')"
              : mode === "quiz"
              ? "Enter subject or topic for exam quiz..."
              : mode === "viva"
              ? "Enter topic for mock viva voce examination..."
              : mode === "flashcards"
              ? "Enter topic to generate flashcards..."
              : "Enter topic for rapid revision summary..."
          }
          aria-label="Input prompt"
        />
        <button
          type="button"
          className={`mic-btn ${isListening ? "listening" : ""}`}
          onClick={toggleVoiceInput}
          title={isListening ? "Listening... click to stop" : "Voice input (Speech to text)"}
        >
          🎙️
        </button>
        <button className="primary" type="submit" disabled={busy || !input.trim()}>
          {busy ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "./api";
import Logo from "./Logo";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import CheckIn from "./pages/CheckIn";
import Sentinel from "./pages/Sentinel";
import Toolkit from "./pages/Toolkit";

const TABS = [
  { id: "today", label: "Today's Plan", icon: "⚡", view: Dashboard },
  { id: "pilot", label: "Prof. Pilot", icon: "🎓", view: Chat },
  { id: "sentinel", label: "Repo Sentinel", icon: "🛡️", view: Sentinel },
  { id: "wellness", label: "Wellness & Focus", icon: "💜", view: CheckIn },
  { id: "toolkit", label: "College OS", icon: "📊", view: Toolkit },
];

export default function App() {
  const [tab, setTab] = useState("today");
  const [engine, setEngine] = useState({
    ok: true,
    text: "ScholarIQ Universal Engine Active",
    mode: "universal",
  });
  const [showConfig, setShowConfig] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");

  const ping = () =>
    api
      .health()
      .then((h) => {
        setEngine({
          ok: true,
          text: h.engine || "Universal Engine",
          mode: h.mode,
        });
      })
      .catch(() => {
        setEngine({
          ok: false,
          text: "Backend starting... run 'run.bat'",
          mode: "offline",
        });
      });

  useEffect(() => {
    ping();
    const t = setInterval(ping, 10000);
    return () => clearInterval(t);
  }, []);

  async function handleSaveKey(e) {
    e.preventDefault();
    try {
      await api.configAI({ provider: "gemini", api_key: geminiKey });
      setShowConfig(false);
      ping();
    } catch (err) {
      alert("Error saving API key: " + err.message);
    }
  }

  const Current = TABS.find((t) => t.id === tab)?.view || Dashboard;

  return (
    <div className="shell">
      {/* Sidebar Navigation */}
      <aside className="side">
        <div className="brand">
          <Logo size={42} showText={true} />
        </div>

        <nav aria-label="Main Navigation">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"nav" + (t.id === tab ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Engine Status / Low-Spec Laptop Ready Badge */}
        <div
          className="engine"
          role="status"
          onClick={() => setShowConfig(!showConfig)}
          style={{ cursor: "pointer" }}
          title="Click to configure AI Engine (Gemini / Offline / LM Studio)"
        >
          <span className={"dot " + (engine.ok ? "on" : "off")} />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "11px" }}>
              {engine.text}
            </span>
            <span style={{ fontSize: "10.5px", color: "var(--purple-bright)" }}>
              ⚙️ Any Laptop Ready • Click to change
            </span>
          </div>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main">
        {showConfig && (
          <div
            className="panel"
            style={{
              marginBottom: "20px",
              background: "rgba(26, 13, 51, 0.95)",
              border: "1px solid var(--purple-bright)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>⚡ AI Engine Selector (For Any Student Laptop)</h3>
              <button className="ghost" onClick={() => setShowConfig(false)}>
                ✕ Close
              </button>
            </div>
            <p className="muted small" style={{ margin: "6px 0 14px" }}>
              ScholarIQ works out-of-the-box on any student laptop with <strong>zero downloads</strong>.
              Optionally, paste a free Google Gemini key or start LM Studio if you have an AI laptop.
            </p>
            <form onSubmit={handleSaveKey} style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <label style={{ flex: 1, margin: 0 }}>
                Google Gemini API Key (Optional Free Cloud Mode)
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </label>
              <button className="primary" type="submit">
                Activate Gemini
              </button>
            </form>
          </div>
        )}

        <Current />
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "./api";
import Logo from "./Logo";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import CheckIn from "./pages/CheckIn";
import Sentinel from "./pages/Sentinel";
import Toolkit from "./pages/Toolkit";
import Team from "./pages/Team";

const TABS = [
  { id: "today", label: "Today's Plan", icon: "⚡", view: Dashboard },
  { id: "pilot", label: "Prof. Pilot", icon: "🎓", view: Chat },
  { id: "sentinel", label: "Repo Sentinel", icon: "🛡️", view: Sentinel },
  { id: "wellness", label: "Wellness & Focus", icon: "💜", view: CheckIn },
  { id: "toolkit", label: "College Toolkit", icon: "📊", view: Toolkit },
  { id: "team", label: "Team & Specs", icon: "👥", view: Team },
];

export default function App() {
  const [tab, setTab] = useState("today");
  const [engine, setEngine] = useState({
    ok: false,
    text: "Connecting to local AI engine...",
    model: "",
  });

  useEffect(() => {
    const ping = () =>
      api
        .health()
        .then((h) => {
          if (h.ok) {
            setEngine({
              ok: true,
              text: `Local AI Online: ${h.models.chat || "Llama 3.2 8B"}`,
              model: h.models.chat,
            });
          } else {
            setEngine({
              ok: false,
              text: "LM Studio offline. Start local server on port 1234.",
              model: "",
            });
          }
        })
        .catch(() => {
          setEngine({
            ok: false,
            text: "Backend offline. Double-click 2-run-backend.bat",
            model: "",
          });
        });

    ping();
    const t = setInterval(ping, 8000);
    return () => clearInterval(t);
  }, []);

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

        {/* Team Tag */}
        <div className="team-pill" style={{ justifyContent: "center" }}>
          <span>👥 Team ScholarIQ (3 Devs)</span>
        </div>

        {/* Engine Status Indicator */}
        <div className="engine" role="status">
          <span className={"dot " + (engine.ok ? "on" : "off")} />
          <span style={{ lineHeight: 1.3 }}>{engine.text}</span>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main">
        <Current />
      </main>
    </div>
  );
}

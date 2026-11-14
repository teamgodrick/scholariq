import { useEffect, useState } from "react";
import { api } from "./api";
import Logo from "./Logo";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import CheckIn from "./pages/CheckIn";

const TABS = [
  { id: "today", label: "Today", view: Dashboard },
  { id: "pilot", label: "Prof. Pilot", view: Chat },
  { id: "checkin", label: "Check-in", view: CheckIn },
];

export default function App() {
  const [tab, setTab] = useState("today");
  const [engine, setEngine] = useState({ ok: false, text: "Connecting to local AI" });

  useEffect(() => {
    const ping = () =>
      api
        .health()
        .then((h) =>
          setEngine(
            h.ok
              ? { ok: true, text: `Local AI online: ${h.models.chat}` }
              : { ok: false, text: "Local AI offline. Start the LM Studio server." }
          )
        )
        .catch(() => setEngine({ ok: false, text: "Backend offline. Start uvicorn." }));
    ping();
    const t = setInterval(ping, 10000);
    return () => clearInterval(t);
  }, []);

  const Current = TABS.find((t) => t.id === tab).view;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <Logo />
          <span>ScholarIQ</span>
        </div>
        <nav aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"nav" + (t.id === tab ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="engine" role="status">
          <span className={"dot " + (engine.ok ? "on" : "off")} />
          <span>{engine.text}</span>
        </div>
      </aside>
      <main className="main">
        <Current />
      </main>
    </div>
  );
}

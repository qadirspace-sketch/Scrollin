/* shell.jsx — frame, rail, top bar, router */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const VIEW_TITLES = {
  dashboard: "Dashboard", analytics: "Posting Analytics", habits: "Posting Habits",
  topics: "Topic Intelligence", hooks: "Hooks & Patterns", creators: "Creator Intelligence",
  watchlist: "Watchlist", remix: "Idea Remix Lab", dna: "Full DNA Report",
};

function SurfaceDeco() {
  return (
    <svg className="surface-deco" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#8AB7EE" strokeOpacity="0.07" strokeWidth="1.5">
        <path d="M-100 120 Q 300 -40 700 120 T 1400 120" />
        <path d="M-100 200 Q 350 40 750 200 T 1400 200" />
        <path d="M900 -60 Q 1100 200 950 460" />
        <path d="M1050 -40 Q 1280 240 1080 540" />
      </g>
      <g fill="none" stroke="#C9CDD6" strokeOpacity="0.18" strokeWidth="1">
        <path d="M-100 680 Q 300 560 700 700 T 1400 660" />
      </g>
    </svg>
  );
}

function CommandPalette({ open, onClose, go }) {
  const [q, setQ] = useStateApp("");
  const D = window.SI_DATA;
  useEffectApp(() => { if (open) setQ(""); }, [open]);
  if (!open) return null;
  const items = D.NAV.filter(n => n.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 80, background: "rgba(20,22,30,0.18)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", paddingTop: 90 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: "90%", background: "#fff", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden", height: "fit-content", animation: "ddIn .16s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderBottom: "1px solid #F0F0F2" }}>
          <Icon name="search" size={18} color="var(--muted)" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search or type a command" style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--ink)" }} />
          <span className="kbd">esc</span>
        </div>
        <div style={{ padding: 8, maxHeight: 340, overflowY: "auto" }}>
          {items.length === 0 && <div style={{ padding: 18, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>No results.</div>}
          {items.map(n => (
            <button key={n.id} className="dd-item" onClick={() => { go(n.id); onClose(); }} style={{ padding: "11px 12px", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--accent-deep)" }}><Icon name={n.icon} size={17} /></span>
                {n.label}
              </span>
              <Icon name="chevR" size={14} color="var(--muted-2)" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const D = window.SI_DATA;
  const [view, setView] = useStateApp(() => (location.hash || "").replace("#", "") || "dashboard");
  const [palette, setPalette] = useStateApp(false);

  const go = (v) => {
    setView(v);
    location.hash = v;
    const sc = document.querySelector(".scroll");
    if (sc) sc.scrollTop = 0;
  };

  useEffectApp(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "k")) { e.preventDefault(); setPalette(p => !p); }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    const onHash = () => { const v = location.hash.replace("#", ""); if (v && VIEW_TITLES[v]) setView(v); };
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("hashchange", onHash); };
  }, []);

  const Views = {
    dashboard: window.Dashboard, analytics: window.Analytics, habits: window.Habits,
    topics: window.Topics, hooks: window.Hooks, creators: window.Creators,
    watchlist: window.Watchlist, remix: window.Remix, dna: window.DNA,
  };
  const Current = Views[view] || window.Dashboard;

  return (
    <div className="stage">
      <div className="stage-deco"><div className="stage-glow" /><div className="stage-glow-2" /></div>
      <div className="frame">
        {/* rail */}
        <div className="rail">
          <div className="rail-logo"><Icon name="bolt" size={22} /></div>
          <div className="rail-nav">
            {D.NAV.map(n => (
              <button key={n.id} className={`rail-btn ${view === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
                <Icon name={n.icon} size={22} />
                {n.dot && <span className="rail-dot" />}
                <span className="tip">{n.label}</span>
              </button>
            ))}
          </div>
          <div className="rail-foot">
            <button className="rail-btn"><Icon name="settings" size={21} /><span className="tip">Settings</span></button>
            <button className="rail-btn"><Icon name="logout" size={21} /><span className="tip">Log out</span></button>
            <img className="rail-avatar" src={D.AV.alex} alt="Alex" />
          </div>
          <div className="rail-chevron"><Icon name="chevR" size={11} /></div>
        </div>

        {/* surface */}
        <div className="surface">
          <SurfaceDeco />
          <div className="topbar">
            <div className="greet">
              <img className="greet-av" src={D.AV.alex} alt="Alex" />
              <div>
                <div className="greet-title">Hello, Alex 👋</div>
                <div className="greet-sub">{view === "dashboard" ? "Here's your content intelligence for today." : VIEW_TITLES[view]}</div>
              </div>
            </div>
            <div className="search" onClick={() => setPalette(true)}>
              <Icon name="search" size={17} />
              <input readOnly placeholder="Search or type a command" style={{ pointerEvents: "none" }} />
              <span className="kbd">⌘F</span>
            </div>
            <div className="topbar-right">
              <button className="icon-btn"><Icon name="bell" size={19} /><span className="bell-dot" /></button>
              <img className="topbar-av" src={D.AV.alex} alt="Alex" />
            </div>
          </div>
          <div className="scroll">
            <Current go={go} key={view} />
          </div>
          <CommandPalette open={palette} onClose={() => setPalette(false)} go={go} />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

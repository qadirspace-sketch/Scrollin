/* hooks.jsx — Hooks & Patterns */
const { useState: useStateHk } = React;

function Hooks({ go }) {
  const D = window.SI_DATA;
  const [selected, setSelected] = useStateHk(0);
  const [tab, setTab] = useStateHk("Structure");
  const [template, setTemplate] = useStateHk(D.HOOK_TEMPLATE);
  const [polishing, setPolishing] = useStateHk(false);
  const pat = D.HOOK_PATTERNS[selected];

  const polish = () => { setPolishing(true); setTimeout(() => { setPolishing(false); setTab("Structure"); }, 1100); };

  const renderTemplate = (txt) => txt.split(/(\{[^}]+\})/g).map((part, i) =>
    part.startsWith("{") ? <span key={i} className="ph">{part}</span> : <React.Fragment key={i}>{part}</React.Fragment>
  );

  const keypoints = {
    Hook: "Open with a behavior most people accept, then immediately reject it. The tension creates a scroll-stop.",
    Structure: "Lead → reframe → numbered proof (3 beats) → forward arrow. Keep lines short; one idea per line.",
    Closing: "End on a line they'll want to quote. Avoid questions — they cap reach. Make a statement instead.",
  };

  return (
    <div className="view">
      <PageHead title="Hooks & Patterns" sub="The structures behind your best-performing posts" />

      {/* category cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 22 }}>
        {D.HOOK_CATS.map((c, i) => (
          <div className="card" key={i} style={{ display: "flex", gap: 14 }}>
            <div className={`insight-ic ${c.ic}`} style={{ width: 44, height: 44 }}><Icon name={c.icon} size={22} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{c.kind}</div>
              <div className="insight-desc" style={{ marginTop: 3 }}>{c.desc}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-deep)", marginTop: 8 }}>{c.action}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ranked patterns */}
      <SecHead title="Top Patterns" action="View library" onAction={() => {}} />
      <div className="hscroll" style={{ marginBottom: 22 }}>
        {D.HOOK_PATTERNS.map((p, i) => (
          <div key={i} className={`pcard ${i === selected ? "sel" : ""}`} onClick={() => { setSelected(i); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="pill pill-blue">#{p.rank}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{p.kind}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: "12px 0 14px", letterSpacing: "-0.02em" }}>{p.name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}><span>Frequency</span><b style={{ color: "var(--ink)" }}>{p.freq}%</b></div>
            <div className="prog" style={{ marginBottom: 16 }}><div className="prog-fill" style={{ width: p.freq + "%" }} /></div>
            <button className="btn btn-dark btn-sm" style={{ width: "100%" }} onClick={(e) => { e.stopPropagation(); setSelected(i); }}>
              <Icon name="bolt" size={14} />{i === selected ? "Selected" : "Use Template"}
            </button>
          </div>
        ))}
      </div>

      {/* workshop + keypoints */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, alignItems: "start" }}>
        <div className="card card-pad-lg">
          <div className="sec-head">
            <div><div className="sec-title">Template Workshop</div><div className="page-sub">{pat.name}</div></div>
            <Tabs value={tab} options={["Structure", "AI Polish", "Examples"]} onChange={setTab} />
          </div>

          {tab === "Structure" && (
            <>
              <div style={{ position: "relative" }}>
                <div className="tmpl" style={{ position: "absolute", inset: 0, pointerEvents: "none", whiteSpace: "pre-wrap", color: "transparent", overflow: "hidden" }}>{renderTemplate(template)}</div>
                <textarea className="tmpl" value={template} onChange={(e) => setTemplate(e.target.value)} spellCheck={false} style={{ position: "relative", background: "transparent", caretColor: "var(--ink)" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 13 }}>
                <button className="btn btn-blue btn-sm"><Icon name="check" size={15} />Save to Library</button>
                <button className="btn btn-ghost btn-sm" onClick={() => go("remix")}><Icon name="remix" size={15} />Open in Remix Lab</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTemplate(D.HOOK_TEMPLATE)}>Reset</button>
              </div>
            </>
          )}

          {tab === "AI Polish" && (
            <div style={{ textAlign: "center", padding: "24px 8px" }}>
              <div className="insight-ic ic-blue" style={{ width: 48, height: 48, margin: "0 auto 14px" }}><Icon name="sparkle" size={24} /></div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Polish this template with AI</div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, margin: "6px auto 18px", maxWidth: 320 }}>Scroll in will tighten the hook, vary sentence length, and sharpen the closing line.</p>
              <button className="btn btn-blue" onClick={polish} disabled={polishing}><Icon name="sparkle" size={16} />{polishing ? "Polishing…" : "Polish Template"}</button>
            </div>
          )}

          {tab === "Examples" && (
            <div className="col" style={{ gap: 12 }}>
              {D.FEED.slice(0, 2).map((p, i) => (
                <div key={i} className="callout callout-blue" style={{ flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <img className="av" src={p.av} width={26} height={26} alt="" /><b style={{ fontSize: 13 }}>{p.author}</b>
                    <span className="pill pill-green" style={{ marginLeft: "auto" }}>{p.likes} likes</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{p.text.slice(0, 130)}…</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* keypoints */}
        <div className="card card-pad-lg">
          <div className="sec-head"><div className="sec-title">Pattern Keypoints</div></div>
          <div className="col" style={{ gap: 14 }}>
            {Object.entries(keypoints).map(([k, v]) => (
              <div key={k}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span className="pill pill-blue">{k}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{v}</div>
              </div>
            ))}
            <div className="callout callout-green">
              <Icon name="check" size={18} color="#3F8C4D" style={{ flexShrink: 0, marginTop: 1 }} />
              <div><div className="callout-title">Performance Insight</div><div className="callout-desc">Posts using this pattern earn 1.8× your median engagement and 2.3× saves.</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Hooks = Hooks;

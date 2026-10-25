/* shells.jsx — Creator Intelligence, Watchlist, Idea Remix Lab, Full DNA Report */
const { useState: useStateSh } = React;

/* ---------- Creator Intelligence ---------- */
function Creators({ go }) {
  const D = window.SI_DATA;
  const [sel, setSel] = useStateSh(0);
  const c = D.CREATORS[sel];
  return (
    <div className="view">
      <PageHead title="Creator Intelligence" sub="Decode what makes tracked creators perform" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 18, alignItems: "start" }}>
        <div className="col">
          {D.CREATORS.map((cr, i) => (
            <div key={i} className="rowcard" style={i === sel ? { boxShadow: "0 0 0 2px var(--accent)" } : null} onClick={() => setSel(i)}>
              <img className="av" src={cr.av} width={42} height={42} alt="" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{cr.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{cr.role}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{cr.eng}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>engagement</div>
              </div>
              <TrendBadge trend={cr.trend} />
            </div>
          ))}
        </div>
        <div className="card card-pad-lg">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <img className="av" src={c.av} width={56} height={56} alt="" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{c.name} <Icon name="verified" size={16} className="verified" /></div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{c.role} · {c.followers} followers</div>
            </div>
            <button className="btn btn-blue btn-sm"><Icon name="plus" size={15} />Watchlist</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
            <div className="stat stat-blue" style={{ minHeight: 92 }}><div className="stat-title">Avg Engagement</div><div className="stat-num" style={{ fontSize: 24 }}>{c.eng}</div></div>
            <div className="stat stat-peach" style={{ minHeight: 92 }}><div className="stat-title">Posts / mo</div><div className="stat-num" style={{ fontSize: 24 }}>{c.posts}</div></div>
            <div className="stat stat-gray" style={{ minHeight: 92 }}><div className="stat-title">Followers</div><div className="stat-num" style={{ fontSize: 24 }}>{c.followers}</div></div>
          </div>
          <div className="sec-title" style={{ marginBottom: 12 }}>Content Signature</div>
          <div className="col" style={{ gap: 11 }}>
            <InsightCard ins={{ title: `Dominant topic: ${c.topic}`, desc: "62% of posts orbit this theme — a tight, recognizable niche.", ic: "ic-blue", icon: "topics" }} onView={() => go("topics")} />
            <InsightCard ins={{ title: "Favors the Contrarian Open", desc: "Uses pattern-interrupt hooks 3× more than peers.", ic: "ic-orange", icon: "hooks" }} onView={() => go("hooks")} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Watchlist ---------- */
function Watchlist({ go }) {
  const D = window.SI_DATA;
  const [list, setList] = useStateSh(D.CREATORS.map(c => ({ ...c, following: true })));
  const toggle = (i) => setList(l => l.map((c, j) => j === i ? { ...c, following: !c.following } : c));
  const remove = (i) => setList(l => l.filter((_, j) => j !== i));
  return (
    <div className="view">
      <PageHead title="Watchlist" sub={`${list.length} creators monitored`}>
        <button className="btn btn-blue btn-sm"><Icon name="plus" size={15} />Add Creator</button>
      </PageHead>
      <div className="col">
        {list.map((c, i) => (
          <div key={i} className="rowcard">
            <img className="av" src={c.av} width={46} height={46} alt="" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>{c.name} <Icon name="verified" size={14} className="verified" /></div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.role} · {c.topic}</div>
            </div>
            <div style={{ display: "flex", gap: 26, marginRight: 8 }}>
              {[["Followers", c.followers], ["Engagement", c.eng], ["Posts/mo", c.posts]].map(([k, v]) => (
                <div key={k} style={{ textAlign: "right" }}><div style={{ fontSize: 15, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{k}</div></div>
              ))}
            </div>
            <button className={c.following ? "btn btn-ghost btn-sm" : "btn btn-blue btn-sm"} onClick={() => toggle(i)} style={{ minWidth: 92 }}>
              {c.following ? <><Icon name="check" size={14} />Following</> : <><Icon name="plus" size={14} />Follow</>}
            </button>
            <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => remove(i)} aria-label="Remove"><Icon name="x" size={16} /></button>
          </div>
        ))}
        {list.length === 0 && <div className="card"><EmptyState icon="watchlist" title="Your watchlist is empty" desc="Add creators to monitor their content and patterns." action="Add Creator" /></div>}
      </div>
    </div>
  );
}

/* ---------- Idea Remix Lab ---------- */
function Remix({ go }) {
  const D = window.SI_DATA;
  const [source, setSource] = useStateSh(D.HOOK_PATTERNS[0].name);
  const [topic, setTopic] = useStateSh("AI Tools");
  const [ideas, setIdeas] = useStateSh([]);
  const [loading, setLoading] = useStateSh(false);
  const seeds = [
    "Most people use {topic} to save time. I used it to find what I was avoiding.",
    "I audited 30 days of {topic} so you don't have to. Three things surprised me →",
    "Unpopular opinion: {topic} won't fix your output. Your inputs will. Here's the reframe.",
  ];
  const generate = () => {
    setLoading(true);
    setTimeout(() => { setIdeas(seeds.map(s => s.replace("{topic}", topic))); setLoading(false); }, 1100);
  };
  return (
    <div className="view">
      <PageHead title="Idea Remix Lab" sub="Turn saved patterns into fresh content" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 18, alignItems: "start" }}>
        <div className="card card-pad-lg">
          <div className="sec-title" style={{ marginBottom: 16 }}>Remix Recipe</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 7 }}>Base pattern</div>
          <Dropdown value={source} options={D.HOOK_PATTERNS.map(p => p.name)} onChange={setSource} />
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)", margin: "16px 0 7px" }}>Apply to topic</div>
          <Dropdown value={topic} options={["AI Tools", "Career Growth", "Leadership", "Productivity"]} onChange={setTopic} />
          <button className="btn btn-blue" style={{ width: "100%", marginTop: 20 }} onClick={generate} disabled={loading}>
            <Icon name="sparkle" size={16} />{loading ? "Remixing…" : "Generate Ideas"}
          </button>
        </div>
        <div className="card card-pad-lg" style={{ minHeight: 280 }}>
          <div className="sec-head"><div className="sec-title">Generated Ideas</div>{ideas.length > 0 && <span className="pill pill-blue">{ideas.length} drafts</span>}</div>
          {ideas.length === 0 ? (
            <EmptyState icon="remix" title="No ideas yet" desc="Pick a pattern and topic, then generate." />
          ) : (
            <div className="col fade-stagger" style={{ gap: 12 }}>
              {ideas.map((idea, i) => (
                <div key={i} className="callout callout-blue" style={{ flexDirection: "column", alignItems: "stretch", animationDelay: `${i * 0.08}s` }}>
                  <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>{idea}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                    <button className="btn btn-ghost btn-sm"><Icon name="bookmark" size={14} />Save</button>
                    <button className="btn btn-ghost btn-sm"><Icon name="repeat" size={14} />Remix again</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Full DNA Report ---------- */
function DNA({ go }) {
  const D = window.SI_DATA;
  const sections = [
    { id: "analytics", icon: "analytics", title: "Performance", line: "182.4k impressions · +28% MoM · 4.8% avg engagement" },
    { id: "habits", icon: "habits", title: "Habits", line: "Best window Tuesday 9 AM · cut Friday cadence" },
    { id: "topics", icon: "topics", title: "Topics", line: "AI Tools rising +41% · Productivity cooling −12%" },
    { id: "hooks", icon: "hooks", title: "Patterns", line: "Signature: the Contrarian Open · 1.8× median engagement" },
  ];
  return (
    <div className="view">
      <PageHead title="Full DNA Report" sub="Everything Scroll in knows about your content — in one place">
        <button className="btn btn-dark btn-sm"><Icon name="download" size={15} />Export PDF</button>
      </PageHead>

      <div className="hl" style={{ marginBottom: 18, padding: 24, flexDirection: "row", alignItems: "center", gap: 20 }}>
        <div className="hl-ic" style={{ width: 56, height: 56 }}><Icon name="dna" size={28} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--on-dark-mute)" }}>Your content archetype</div>
          <div className="hl-num" style={{ fontSize: 30, marginTop: 2 }}>The Contrarian Coach</div>
          <div className="hl-label" style={{ marginTop: 4 }}>Pattern-interrupt hooks · numbered proof · career & AI themes</div>
        </div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>A−</div><div className="hl-label">DNA score</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18 }}>
        {sections.map((s, i) => (
          <div key={i} className="card" style={{ display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }} onClick={() => go(s.id)}>
            <div className="insight-ic ic-blue" style={{ width: 44, height: 44 }}><Icon name={s.icon} size={22} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</div>
              <div className="insight-desc" style={{ marginTop: 3 }}>{s.line}</div>
            </div>
            <Icon name="chevR" size={18} color="var(--muted)" />
          </div>
        ))}
      </div>

      <div className="card card-pad-lg" style={{ marginTop: 18 }}>
        <div className="sec-title" style={{ marginBottom: 13 }}>Top Recommendations</div>
        <div className="col" style={{ gap: 11 }}>
          <InsightCard ins={{ title: "Move your Friday posts to Tuesday AM", desc: "Reallocating cadence could lift weekly engagement ~18%.", ic: "ic-orange", icon: "clock" }} onView={() => go("habits")} />
          <InsightCard ins={{ title: "Lean into AI Tools while it's rising", desc: "Your fastest-growing topic is still under-supplied by you.", ic: "ic-green", icon: "trendUp" }} onView={() => go("topics")} />
          <InsightCard ins={{ title: "Template the Contrarian Open", desc: "Your signature pattern — systematize it in the Remix Lab.", ic: "ic-blue", icon: "remix" }} onView={() => go("remix")} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Creators, Watchlist, Remix, DNA });

/* topics.jsx — Topic Intelligence */
const { useState: useStateTop } = React;

const CLOUD_COLORS = ["#6E9FDE", "#8AB7EE", "#161616", "#A9C7F2", "#3A3A3E", "#6E9FDE"];

function Topics({ go }) {
  const D = window.SI_DATA;
  const [refreshing, setRefreshing] = useStateTop(false);
  const [activeWord, setActiveWord] = useStateTop(null);
  const [activePair, setActivePair] = useStateTop(null);
  const maxS = Math.max(...D.TOPIC_CLOUD.map(c => c.s));

  const refresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 900); };

  // network nodes: central hub + ring
  const hubs = ["Career Growth", "AI Tools", "Leadership", "Productivity", "Personal Branding", "Networking"];
  const cx = 150, cy = 130, R = 96;
  const nodes = hubs.map((h, i) => {
    const a = (i / hubs.length) * Math.PI * 2 - Math.PI / 2;
    return { name: h, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: 9 + (i % 3) * 3 };
  });

  const overview = [
    { kind: "Top Growing", topic: "AI Tools", delta: "+41%", trend: "up", icon: "trendUp", ic: "ic-green", desc: "Your fastest-rising topic by avg likes." },
    { kind: "Declining", topic: "Productivity", delta: "−12%", trend: "down", icon: "trendDown", ic: "ic-red", desc: "Cooling off — saturated in your niche." },
    { kind: "Opportunity", topic: "Negotiation", delta: "Untapped", trend: "flat", icon: "target", ic: "ic-blue", desc: "High demand, low supply from you." },
  ];

  return (
    <div className="view">
      <PageHead title="Topic Intelligence" sub="What you talk about — and what's working">
        <button className="btn btn-ghost btn-sm" onClick={refresh}>
          <Icon name="refresh" size={15} style={{ animation: refreshing ? "spin .9s linear" : "none" }} />{refreshing ? "Refreshing…" : "Refresh AI Insights"}
        </button>
      </PageHead>

      {/* overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 18 }}>
        {overview.map((o, i) => (
          <div className="card" key={i} style={{ display: "flex", gap: 14 }}>
            <div className={`insight-ic ${o.ic}`} style={{ width: 42, height: 42 }}><Icon name={o.icon} size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{o.kind}</div>
              <div style={{ fontSize: 19, fontWeight: 700, margin: "2px 0 4px", letterSpacing: "-0.02em" }}>{o.topic}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendBadge trend={o.trend} delta={o.delta} />
              </div>
              <div className="insight-desc" style={{ marginTop: 8 }}>{o.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* word cloud */}
      <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
        <div className="sec-head">
          <div><div className="sec-title">Topic Universe</div><div className="page-sub">Sized by frequency across your posts</div></div>
          {activeWord && <span className="pill pill-blue">{activeWord.w} · {activeWord.s} posts</span>}
        </div>
        <div className="cloud" style={{ minHeight: 180 }}>
          {D.TOPIC_CLOUD.map((c, i) => (
            <span key={i} className="cloud-word"
                  style={{ fontSize: 14 + (c.s / maxS) * 30, color: CLOUD_COLORS[i % CLOUD_COLORS.length], opacity: activeWord && activeWord.w !== c.w ? .4 : 1 }}
                  onMouseEnter={() => setActiveWord(c)} onMouseLeave={() => setActiveWord(null)}>
              {c.w}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, alignItems: "start" }}>
        {/* metrics table */}
        <div className="card card-pad-lg">
          <div className="sec-head">
            <div className="sec-title">Detailed Performance Metrics</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm">View All</button>
              <button className="btn btn-ghost btn-sm"><Icon name="download" size={14} />Export CSV</button>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>Topic</th><th className="num">Posts</th><th className="num">Avg Likes</th><th className="num">Avg Comments</th><th style={{ textAlign: "right" }}>Trend</th></tr></thead>
            <tbody>
              {D.TOPIC_TABLE.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{t.topic}</td>
                  <td className="num">{t.posts}</td>
                  <td className="num">{t.likes}</td>
                  <td className="num">{t.comments}</td>
                  <td style={{ textAlign: "right" }}><TrendBadge trend={t.trend} delta={t.delta} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* co-occurrence */}
        <div className="card card-pad-lg">
          <div className="sec-head"><div className="sec-title">Topic Co-occurrence</div></div>
          <svg viewBox="0 0 300 260" width="100%" height="200">
            {nodes.map((n, i) => nodes.slice(i + 1).map((m, j) => (
              <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#E0E7F2" strokeWidth={(i + j) % 3 === 0 ? 1.6 : 0.8} />
            )))}
            {nodes.map((n, i) => (
              <g key={i} onMouseEnter={() => setActivePair(n.name)} onMouseLeave={() => setActivePair(null)} style={{ cursor: "pointer" }}>
                <circle className={`netnode ${i % 2 ? "dark" : ""}`} cx={n.x} cy={n.y} r={activePair === n.name ? n.r + 3 : n.r} />
                <text x={n.x} y={n.y - n.r - 5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#3A3A3E">{n.name}</text>
              </g>
            ))}
          </svg>
          <div className="divider" style={{ margin: "8px 0 12px" }} />
          <div className="col" style={{ gap: 8 }}>
            {D.TOPIC_PAIRS.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <span className="chip chip-sq" style={{ background: "var(--accent-wash)", color: "var(--accent-deep)" }}>{p.a}</span>
                <Icon name="link" size={13} color="var(--muted)" />
                <span className="chip chip-sq" style={{ background: "var(--surface-2)" }}>{p.b}</span>
                <span className="spacer" />
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{p.n}×</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Topics = Topics;

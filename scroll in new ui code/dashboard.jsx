/* dashboard.jsx — default view */
const { useState: useStateDash } = React;

function PostCard({ p }) {
  const [expanded, setExpanded] = useStateDash(false);
  const [slide, setSlide] = useStateDash(0);
  const [liked, setLiked] = useStateDash(false);
  const hasMedia = p.media && p.media.length > 0;
  const colors = ["#8AB7EE", "#6E9FDE", "#A9C7F2"];
  return (
    <div className="post">
      <div className="post-top">
        <img className="av" src={p.av} width={42} height={42} alt={p.author} />
        <div style={{ minWidth: 0 }}>
          <div className="post-name">{p.author} <Icon name="verified" size={15} className="verified" /></div>
          <div className="post-meta">Posted {p.time} ago · LinkedIn</div>
        </div>
        <div className="post-badges">
          <span className="pill pill-blue">#{p.rank} rank</span>
          {p.badge && <span className="pill pill-green"><span className="pill-dot" style={{ background: "#6FB97A" }} />{p.badge}</span>}
        </div>
      </div>
      <div className="post-text">
        {expanded ? p.text : p.text.slice(0, 150)}
        {p.text.length > 150 && !expanded && <>… <span className="read-more" onClick={() => setExpanded(true)}>Read more</span></>}
      </div>
      <div style={{ marginTop: 11 }}><span className="tag-sq"><Icon name="topics" size={13} />{p.topic}</span></div>
      {hasMedia && (
        <div className="carousel">
          {p.media.map((m, i) => (
            <div key={i} className="carousel-slide" style={{ background: colors[i % 3], opacity: i === slide ? 1 : 0 }}>{m}</div>
          ))}
          {p.media.length > 1 && (
            <>
              <button className="carousel-arrow" style={{ left: 9 }} onClick={() => setSlide(s => (s - 1 + p.media.length) % p.media.length)}><Icon name="chevL" size={16} /></button>
              <button className="carousel-arrow" style={{ right: 9 }} onClick={() => setSlide(s => (s + 1) % p.media.length)}><Icon name="chevR" size={16} /></button>
              <div className="carousel-count">{slide + 1} / {p.media.length}</div>
            </>
          )}
        </div>
      )}
      <div className="post-foot">
        <button className="post-stat" onClick={() => setLiked(l => !l)} style={liked ? { color: "var(--accent-deep)" } : null}>
          <Icon name="like" size={16} /> {typeof p.likes === "number" ? (liked ? p.likes + 1 : p.likes) : p.likes}
        </button>
        <div className="post-stat"><Icon name="comment" size={16} /> {p.comments}</div>
        <div className="post-stat"><Icon name="share" size={16} /> {p.shares}</div>
        <div className="spacer" />
        <button className="post-stat"><Icon name="bookmark" size={16} /></button>
      </div>
    </div>
  );
}

function Dashboard({ go }) {
  const D = window.SI_DATA;
  return (
    <div className="view">
      {/* top region */}
      <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 18, marginBottom: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
          {D.DASH_STATS.map((s, i) => <StatCard key={i} s={s} onOpen={() => go(i === 1 ? "topics" : "analytics")} />)}
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: "10px -6px -10px 14px", background: "var(--accent-fill)", borderRadius: "var(--r-card)", opacity: .6 }} />
          <div style={{ position: "relative", height: "100%" }}>
            <HighlightCard
              icon="bolt" num="182.4k" label="Total impressions · last 30 days"
              foot={<><span className="pill" style={{ background: "rgba(138,183,238,.22)", color: "#CFDEFB" }}><Icon name="trendUp" size={12} />+28% MoM</span>
                     <button className="btn btn-sm" style={{ background: "rgba(255,255,255,.12)", color: "#fff", marginLeft: "auto" }} onClick={() => go("analytics")}>Open analytics</button></>}
            />
          </div>
        </div>
      </div>

      {/* lower region */}
      <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 18, alignItems: "start" }}>
        <div>
          <SecHead title="Post Capture Feed" action="See all" onAction={() => go("analytics")} />
          <div className="col">
            {D.FEED.map(p => <PostCard key={p.id} p={p} />)}
          </div>
        </div>
        <div className="col">
          <div className="card">
            <SecHead title="Trending Patterns (30D)" action="Explore" onAction={() => go("hooks")} />
            <div className="col" style={{ gap: 12 }}>
              {D.TRENDING.map((t, i) => <InsightCard key={i} ins={{ ...t }} onView={() => go("hooks")} />)}
            </div>
          </div>
          <div className="card" style={{ background: "linear-gradient(150deg, var(--accent-wash), #fff)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div className="insight-ic ic-blue"><Icon name="sparkle" size={18} /></div>
              <div>
                <div className="insight-title">You're in the beta</div>
                <div className="insight-desc" style={{ marginTop: 1 }}>Help shape Scroll in.</div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, margin: "0 0 13px" }}>Found something off, or have a feature you'd love? We read every note.</p>
            <button className="btn btn-blue btn-sm" style={{ width: "100%" }}><Icon name="send" size={15} />Submit Feedback</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;

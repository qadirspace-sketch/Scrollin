/* habits.jsx — Posting Habits */
const { useState: useStateHab } = React;

const HEAT_COLORS = ["#EEF2F8", "#D8E6F8", "#B6D0F2", "#8AB7EE", "#6E9FDE"];

function Habits({ go }) {
  const D = window.SI_DATA;
  const [genState, setGenState] = useStateHab("idle");
  const [cell, setCell] = useStateHab(null);
  const runGen = () => { setGenState("loading"); setTimeout(() => setGenState("done"), 1100); };
  const maxFreq = Math.max(...D.HABIT_FREQ.map(f => f.n));

  return (
    <div className="view">
      <PageHead title="Posting Habits" sub="When you post — and when you should" />

      {/* summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="hl" style={{ minHeight: 116, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <div className="hl-ic" style={{ width: 46, height: 46 }}><Icon name="calendar" size={24} /></div>
          <div><div className="hl-num">Tuesday</div><div className="hl-label">Best day to post · 4.7% avg engagement</div></div>
        </div>
        <div className="stat stat-peach" style={{ minHeight: 116, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <div className="hl-ic" style={{ width: 46, height: 46, background: "var(--accent)" }}><Icon name="clock" size={24} /></div>
          <div><div className="stat-num" style={{ marginTop: 0 }}>9:00 AM</div><div className="stat-sub" style={{ marginTop: 4 }}>Best time · within 30 min of peak</div></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "start", marginBottom: 18 }}>
        {/* heatmap */}
        <div className="card card-pad-lg">
          <div className="sec-head">
            <div className="sec-title">Engagement Heatmap</div>
            <div className="heat-legend">Low
              <span className="heat-legend-bar">{HEAT_COLORS.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
            High</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "42px 1fr", gap: 8 }}>
            <div />
            <div className="heat" style={{ gridTemplateColumns: `repeat(${D.HOURS.length}, 1fr)` }}>
              {D.HOURS.map(h => <div key={h} style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", fontWeight: 500 }}>{h}</div>)}
            </div>
            {D.DAYS.map((day, di) => (
              <React.Fragment key={day}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, display: "flex", alignItems: "center" }}>{day}</div>
                <div className="heat" style={{ gridTemplateColumns: `repeat(${D.HOURS.length}, 1fr)` }}>
                  {D.HEAT[di].map((v, hi) => (
                    <div key={hi} className="heat-cell" style={{ background: HEAT_COLORS[v] }}
                         onMouseEnter={() => setCell({ day, hour: D.HOURS[hi], v })} onMouseLeave={() => setCell(null)}>
                      {v >= 3 ? "●" : ""}
                    </div>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--muted)", minHeight: 18 }}>
            {cell ? <><b style={{ color: "var(--ink)" }}>{cell.day} {cell.hour}</b> — {["very low","low","moderate","high","peak"][cell.v]} engagement window</> : "Hover a cell to inspect a posting window."}
          </div>
        </div>

        {/* AI recommendations */}
        <div className="card card-pad-lg">
          <div className="sec-head">
            <div className="sec-title">AI Recommendations</div>
            <div className="insight-ic ic-blue" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name="sparkle" size={16} /></div>
          </div>
          {genState === "done" ? (
            <div className="col" style={{ gap: 12 }}>
              {D.HABIT_RECS.map((r, i) => (
                <div className={`stat ${r.fill}`} key={i} style={{ minHeight: 0, padding: 14 }}>
                  <div className="stat-title">{r.title}</div>
                  <div className="stat-sub" style={{ marginTop: 4, lineHeight: 1.45 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "6px 4px" }}>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, margin: "4px 0 16px" }}>Generate a personalized posting schedule from your engagement windows.</p>
              <button className="btn btn-blue" style={{ width: "100%" }} onClick={runGen} disabled={genState === "loading"}>
                <Icon name="sparkle" size={16} />{genState === "loading" ? "Analyzing…" : "Generate Recommendations"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* posting frequency bubbles */}
      <div className="card card-pad-lg">
        <div className="sec-head">
          <div><div className="sec-title">Posting Frequency</div><div className="page-sub">Posts per weekday · last 30 days</div></div>
        </div>
        <div className="bubbles">
          {D.HABIT_FREQ.map((f, i) => {
            const size = 44 + (f.n / maxFreq) * 64;
            const intensity = HEAT_COLORS[Math.round((f.n / maxFreq) * 4)];
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div className="bubble" style={{ width: size, height: size, background: intensity, color: f.n / maxFreq > 0.5 ? "#fff" : "var(--ink)" }}>
                  <b>{f.n}</b>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{f.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.Habits = Habits;

/* analytics.jsx — Posting Analytics */
const { useState: useStateAna } = React;

function Analytics({ go }) {
  const D = window.SI_DATA;
  const [metric, setMetric] = useStateAna("Likes");
  const [range, setRange] = useStateAna("All Time");
  const [chartType, setChartType] = useStateAna("Line");
  const [ownContent, setOwnContent] = useStateAna(true);
  const [compare, setCompare] = useStateAna(false);
  const [view, setView] = useStateAna("list");
  const [genState, setGenState] = useStateAna("idle");

  const series = D.ANALYTICS_TREND[metric];
  const total = series.reduce((a, b) => a + b, 0);
  const avg = (total / series.length);
  const peak = Math.max(...series);
  const growth = (((series[series.length - 1] - series[0]) / series[0]) * 100);
  const isPct = metric === "Engagement";
  const fmt = (n) => isPct ? n.toFixed(1) + "%" : (n >= 1000 ? (n / 1000).toFixed(1) + "k" : Math.round(n));

  const stats = [
    { title: "Total " + metric, num: fmt(total), fill: "hl", icon: "bolt" },
    { title: "Avg / post", num: fmt(avg), fill: "stat-blue" },
    { title: "Peak " + metric, num: fmt(peak), fill: "stat-peach" },
    { title: "Growth", num: (growth >= 0 ? "+" : "") + growth.toFixed(0) + "%", fill: "stat-gray", up: growth >= 0, delta: "vs first period" },
  ];

  const runGen = () => { setGenState("loading"); setTimeout(() => setGenState("done"), 1100); };

  return (
    <div className="view">
      <PageHead title="Posting Analytics" sub="How your content performs over time">
        <Switch on={ownContent} onToggle={() => setOwnContent(o => !o)} label="Own Content" />
        <Dropdown value={range} options={["7 Days", "30 Days", "90 Days", "All Time"]} onChange={setRange} />
      </PageHead>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <Tabs value={metric} options={["Likes", "Comments", "Reposts", "Engagement"]} onChange={setMetric} />
        <div className="spacer" />
        <Switch on={compare} onToggle={() => setCompare(c => !c)} label="Compare prev. period" />
        <Segmented value={chartType} options={["Line", "Bar"]} onChange={setChartType} />
      </div>

      {/* four stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 18 }}>
        {stats.map((s, i) => s.fill === "hl" ? (
          <div className="hl" key={i} style={{ minHeight: 118 }}>
            <div className="hl-ic"><Icon name={s.icon} size={18} /></div>
            <div style={{ marginTop: "auto" }}>
              <div className="hl-num" style={{ fontSize: 28 }}>{s.num}</div>
              <div className="hl-label">{s.title}</div>
            </div>
          </div>
        ) : (
          <div className={`stat ${s.fill}`} key={i} style={{ minHeight: 118 }}>
            <div className="stat-title">{s.title}</div>
            <div className="stat-num" style={{ fontSize: 27 }}>{s.num}</div>
            {s.delta && <div className={`stat-delta ${s.up ? "delta-up" : "delta-down"}`}><Icon name={s.up ? "trendUp" : "trendDown"} size={12} />{s.delta}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18, alignItems: "start", marginBottom: 18 }}>
        {/* trend chart */}
        <div className="card card-pad-lg">
          <div className="sec-head">
            <div>
              <div className="sec-title">Performance Trend</div>
              <div className="page-sub">{metric} · {range}{compare ? " · vs previous" : ""}</div>
            </div>
            <span className="pill pill-blue"><Icon name="trendUp" size={12} />{(growth >= 0 ? "+" : "") + growth.toFixed(0)}%</span>
          </div>
          {chartType === "Line"
            ? <LineChart values={series} labels={D.TREND_LABELS} suffix={isPct ? "%" : ""} />
            : <BarChart values={series} labels={D.TREND_LABELS} focusIndex={series.length - 1} suffix={isPct ? "%" : ""} />}
        </div>

        {/* AI insights */}
        <div className="card card-pad-lg">
          <div className="sec-head">
            <div className="sec-title">AI Insights</div>
            <div className="insight-ic ic-blue" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name="sparkle" size={16} /></div>
          </div>
          {genState === "done" ? (
            <div className="col" style={{ gap: 11 }}>
              <div className="callout callout-blue">
                <Icon name="bolt" size={18} color="#6E9FDE" style={{ flexShrink: 0, marginTop: 1 }} />
                <div><div className="callout-title">Your {metric.toLowerCase()} accelerate late-week</div><div className="callout-desc">The last 3 months grew {Math.abs(growth).toFixed(0)}%. Double down on the contrarian-open format.</div></div>
              </div>
              <div className="callout callout-green">
                <Icon name="check" size={18} color="#3F8C4D" style={{ flexShrink: 0, marginTop: 1 }} />
                <div><div className="callout-title">Carousels are your multiplier</div><div className="callout-desc">Posts with 3+ slides earn 2.1× the {metric.toLowerCase()} of plain text.</div></div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "10px 4px" }}>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, margin: "4px 0 16px" }}>Let Scroll in read your {range.toLowerCase()} of {metric.toLowerCase()} and surface what's working.</p>
              <button className="btn btn-blue" style={{ width: "100%" }} onClick={runGen} disabled={genState === "loading"}>
                <Icon name="sparkle" size={16} />{genState === "loading" ? "Analyzing…" : "Generate Insights"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* post performance */}
      <div className="card card-pad-lg">
        <div className="sec-head">
          <div className="sec-title">Post Performance</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <IconToggle value={view} onChange={setView} />
            <button className="btn btn-dark btn-sm"><Icon name="download" size={15} />Download Report</button>
          </div>
        </div>
        <div className={view === "grid" ? "grid" : "col"} style={view === "grid" ? { gridTemplateColumns: "repeat(2,1fr)", gap: 12 } : { gap: 10 }}>
          {D.ANALYTICS_POSTS.map((p, i) => (
            <div className="rowcard" key={i}>
              <img className="av" src={D.AV.alex} width={38} height={38} alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.text}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{p.date}</span>
                  <div className="prog" style={{ flex: 1, maxWidth: 120 }}><div className="prog-fill" style={{ width: p.pct + "%" }} /></div>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{p.eng.toLocaleString()}</div>
                <a className="insight-link" style={{ marginTop: 2, fontSize: 12 }}>View post</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.Analytics = Analytics;

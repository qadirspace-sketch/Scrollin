/* components.jsx — shared building blocks */
const { useState, useRef, useEffect } = React;

/* ---------- headings ---------- */
function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <div className="page-title">{title}</div>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children && <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

function SecHead({ title, action, onAction }) {
  return (
    <div className="sec-head">
      <div className="sec-title">{title}</div>
      {action && <button className="see-all" onClick={onAction}>{action} <Icon name="chevR" size={13} /></button>}
    </div>
  );
}

/* ---------- stat + highlight cards ---------- */
function StatCard({ s, onOpen }) {
  return (
    <div className={`stat ${s.fill}`}>
      <div>
        <div className="stat-title">{s.title}</div>
        <div className="stat-sub">{s.sub}</div>
      </div>
      <div className="stat-num" style={s.small ? { fontSize: 24 } : null}>
        {s.num}{s.unit && <small>{s.unit}</small>}
      </div>
      {s.delta && (
        <div className={`stat-delta ${s.up ? "delta-up" : "delta-down"}`}>
          <Icon name={s.up ? "trendUp" : "trendDown"} size={12} /> {s.delta}
        </div>
      )}
      <button className="stat-go" onClick={onOpen} aria-label="Open details"><Icon name="arrowUR" size={16} /></button>
    </div>
  );
}

function HighlightCard({ icon = "flame", num, label, foot, children }) {
  return (
    <div className="hl">
      <div className="hl-ic"><Icon name={icon} size={20} /></div>
      <div style={{ marginTop: "auto" }}>
        <div className="hl-num">{num}</div>
        <div className="hl-label">{label}</div>
      </div>
      {foot && <div className="hl-foot">{foot}</div>}
      {children}
    </div>
  );
}

function InsightCard({ ins, onView }) {
  return (
    <div className="insight">
      <div className={`insight-ic ${ins.ic}`}><Icon name={ins.icon} size={18} /></div>
      <div>
        <div className="insight-title">{ins.title}</div>
        <div className="insight-desc">{ins.desc}</div>
        <a className="insight-link" onClick={onView}>View Details</a>
      </div>
    </div>
  );
}

/* ---------- controls ---------- */
function Dropdown({ value, options, onChange, icon = "chevD" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="dd" ref={ref}>
      <button className="dd-btn" onClick={() => setOpen(o => !o)}>
        {value} <Icon name={icon} size={14} style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="dd-menu">
          {options.map(o => (
            <button key={o} className={`dd-item ${o === value ? "sel" : ""}`} onClick={() => { onChange(o); setOpen(false); }}>
              {o} {o === value && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o} className={`seg-btn ${o === value ? "on" : ""}`} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

function Tabs({ value, options, onChange }) {
  return (
    <div className="tabs">
      {options.map(o => (
        <button key={o} className={`tab ${o === value ? "on" : ""}`} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

function Switch({ on, onToggle, label }) {
  return (
    <button className="switch" onClick={onToggle}>
      <span className={`switch-track ${on ? "on" : ""}`}><span className="switch-knob" /></span>
      {label}
    </button>
  );
}

function IconToggle({ value, onChange }) {
  return (
    <div className="seg">
      <button className={`seg-btn ${value === "list" ? "on" : ""}`} onClick={() => onChange("list")} style={{ padding: "7px 10px" }}><Icon name="list" size={16} /></button>
      <button className={`seg-btn ${value === "grid" ? "on" : ""}`} onClick={() => onChange("grid")} style={{ padding: "7px 10px" }}><Icon name="grid" size={16} /></button>
    </div>
  );
}

/* ---------- charts ---------- */
function BarChart({ values, labels, focusIndex, suffix = "", projectedLast = false }) {
  const [hover, setHover] = useState(focusIndex ?? null);
  const max = Math.max(...values) * 1.12;
  return (
    <div className="bars">
      {values.map((v, i) => {
        const h = (v / max) * 100;
        const isFocus = hover === i;
        const cls = projectedLast && i === values.length - 1 ? "bar bar-hatch" : `bar ${isFocus ? "focus" : ""}`;
        return (
          <div className="bar-col" key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(focusIndex ?? null)}>
            {isFocus && (
              <div className="chart-tip" style={{ bottom: `calc(${h}% + 16px)`, left: "50%" }}>
                {v}{suffix}<span className="tip-sub">{labels[i]}</span>
              </div>
            )}
            <div className={cls} style={{ height: `${h}%` }} />
            <div className="bar-label">{labels[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

// area/line chart, responsive width via viewBox
function LineChart({ values, labels, suffix = "", height = 220 }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = height, padX = 24, padY = 28;
  const max = Math.max(...values), min = Math.min(...values);
  const range = (max - min) || 1;
  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (W - padX * 2);
    const y = padY + (1 - (v - min) / range) * (H - padY * 2);
    return { x, y, v };
  });
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length-1].x} ${H - padY} L${pts[0].x} ${H - padY} Z`;
  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" style={{ overflow: "visible" }}
           onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8AB7EE" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8AB7EE" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0,1,2,3].map(g => (
          <line key={g} x1={padX} x2={W-padX} y1={padY + g*((H-padY*2)/3)} y2={padY + g*((H-padY*2)/3)} stroke="#F0F0F2" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={path} fill="none" stroke="#8AB7EE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <rect x={p.x - (W/values.length)/2} y={0} width={W/values.length} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }} />
            <circle className="line-dot" cx={p.x} cy={p.y} r={hover === i ? 6 : 4} />
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={pts[hover].x} x2={pts[hover].x} y1={padY} y2={H-padY} stroke="#8AB7EE" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{
          left: `${(pts[hover].x / W) * 100}%`,
          top: `${(pts[hover].y / H) * 100}%`,
        }}>
          {values[hover]}{suffix}<span className="tip-sub">{labels[hover]}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 22px 0", fontSize: 11.5, color: "var(--muted)", fontWeight: 500 }}>
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

function EmptyState({ icon = "topics", title, desc, action, onAction }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon name={icon} size={26} /></div>
      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, marginTop: 4 }}>{desc}</div>}
      {action && <button className="btn btn-blue btn-sm" style={{ marginTop: 14 }} onClick={onAction}>{action}</button>}
    </div>
  );
}

function TrendBadge({ trend, delta }) {
  if (trend === "up") return <span className="pill pill-green"><Icon name="trendUp" size={12} />{delta || "Up"}</span>;
  if (trend === "down") return <span className="pill pill-red"><Icon name="trendDown" size={12} />{delta || "Down"}</span>;
  return <span className="pill" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{delta || "Flat"}</span>;
}

Object.assign(window, {
  PageHead, SecHead, StatCard, HighlightCard, InsightCard,
  Dropdown, Segmented, Tabs, Switch, IconToggle,
  BarChart, LineChart, EmptyState, TrendBadge,
});

import React, { useEffect, useRef, useState } from 'react';
import LineIcon from './LineIcon';

// Shared building blocks: numbers shown visually, definitions kept in tooltips.

export const LIFT_HELP = 'Score ÷ this creator’s median post. 1.0× is a typical post.';

/** Compact lift value: dark when strong, muted when below the median. */
export const LiftChip = ({ lift, dim = false, title }) => {
    if (lift == null) return <span className="sx-chip muted" title={title || 'Not enough posts to compare'}>—</span>;
    const tone = dim ? 'muted' : lift >= 2 ? 'strong' : lift >= 1.1 ? 'up' : lift < 0.9 ? 'down' : '';
    return <span className={`sx-chip ${tone}`} title={title || LIFT_HELP}>{lift >= 10 ? Math.round(lift) : lift.toFixed(1)}×</span>;
};

/** Horizontal bar for a lift value, with a tick at 1.0× (the median). Scale 0–max. */
export const LiftBar = ({ lift, max = 3, strong = false, dim = false }) => {
    const pct = lift == null ? 0 : Math.min(100, (lift / max) * 100);
    const median = (1 / max) * 100;
    return (
        <span className="sx-liftbar" aria-hidden="true">
            <span className="fill" style={{ width: `${pct}%`, background: dim ? '#E2E2E2' : strong ? '#111111' : lift != null && lift >= 1 ? '#7A7A7A' : '#C9C9C9' }} />
            <span className="tick" style={{ left: `${median}%` }} />
        </span>
    );
};

export const InfoTip = ({ text }) => (
    <span className="sx-info" title={text} aria-label={text} role="img">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
    </span>
);

export const PageHeader = ({ title, meta, children }) => (
    <div className="sx-ph">
        <div style={{ minWidth: 0 }}>
            <h1 className="sx-h1">{title}</h1>
            {meta && <p className="sx-lede sx-num">{meta}</p>}
        </div>
        {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>}
    </div>
);

export const RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'All time']];

export const RangeMenu = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);
    const label = RANGES.find(r => r[0] === value)[1];
    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" className="sx-btn line" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
                <LineIcon name="calendar" size={16} /> {label} <LineIcon name="chevD" size={14} />
            </button>
            {open && (
                <div className="sx-menu" role="menu" style={{ top: 46, right: 0, minWidth: 190 }}>
                    {RANGES.map(([id, l]) => (
                        <button key={id} type="button" className="sx-mi" role="menuitemradio" aria-checked={value === id} onClick={() => { onChange(id); setOpen(false); }}>
                            <span style={{ flex: 1 }}>{l}</span>
                            {value === id && <LineIcon name="check" size={16} strokeWidth={2.2} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const Tabs = ({ tabs, value, onChange, label }) => (
    <div className="sx-tabs" role="tablist" aria-label={label}>
        {tabs.map(([id, text]) => (
            <button key={id} type="button" role="tab" aria-selected={value === id} className={`sx-tab ${value === id ? 'on' : ''}`} onClick={() => onChange(id)}>{text}</button>
        ))}
    </div>
);

export const Empty = ({ children, style }) => <div className="sx-empty" style={style}>{children}</div>;

/** Small labelled number used in stat strips. */
export const Stat = ({ label, value, sub, help }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B6B6B' }}>{label}{help && <InfoTip text={help} />}</span>
        <span className="sx-num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</span>
        {sub && <span className="sx-num" style={{ fontSize: 12.5, color: '#6B6B6B' }}>{sub}</span>}
    </div>
);

export const rangeDays = (range) => (range === 'all' ? null : Number(range));

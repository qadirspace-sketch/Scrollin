import React, { useEffect, useMemo, useState } from 'react';
import { LiftChip, LiftBar, PageHeader, Tabs, Empty, Stat, InfoTip, LIFT_HELP } from './ui';
import { engagementScore, postTime, formatAgo, median, MIN_GROUP_POSTS } from '../utils/metrics';
import {
    contentDrivers, timingGrid, bestTiming, cadence, engagementMix, viralRate, hookLine,
    DAY_NAMES, WEEK_ORDER, TIME_BLOCKS, blockLabel,
} from '../utils/insights';

const DAY = 24 * 60 * 60 * 1000;
const pct = (x) => `${Math.round(x * 100)}%`;

// ---------- Trends ----------
const Trends = ({ scored, onNavigate }) => {
    const [weeks, setWeeks] = useState(12);
    const data = useMemo(() => {
        const now = Date.now();
        const buckets = Array.from({ length: weeks }, (_, i) => {
            const end = now - (weeks - 1 - i) * 7 * DAY, start = end - 7 * DAY;
            const list = scored.filter(p => { const t = postTime(p); return t !== null && t > start && t <= end; });
            return { median: list.length ? median(list.map(engagementScore)) : null, posts: list.length };
        });
        const inRange = scored.filter(p => { const t = postTime(p); return t !== null && now - t <= weeks * 7 * DAY; });
        const breakouts = inRange.filter(p => p.lift != null && p.lift >= 2).sort((a, b) => b.lift - a.lift).slice(0, 5);
        return {
            buckets, breakouts, cad: cadence(scored, now, weeks), mix: engagementMix(inRange),
            medianScore: inRange.length ? median(inRange.map(engagementScore)) : null, viral: viralRate(inRange), n: inRange.length,
        };
    }, [scored, weeks]);

    const vals = data.buckets.map(b => b.median);
    const known = vals.filter(v => v != null);
    const top = known.length ? Math.max(...known) * 1.15 : 1;
    const maxPosts = Math.max(1, ...data.buckets.map(b => b.posts));
    const x = i => (i * 600 / (vals.length - 1)).toFixed(1);
    let line = '', seg = [];
    const flush = () => { if (seg.length) line += seg.map(([a, b], j) => `${j ? 'L' : 'M'}${a} ${b}`).join(' ') + ' '; seg = []; };
    vals.forEach((v, i) => { if (v == null) flush(); else seg.push([x(i), (160 - v / top * 150).toFixed(1)]); });
    flush();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section className="sx-card" style={{ padding: '18px 20px 20px' }} aria-labelledby="tr-h">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h2 id="tr-h" className="sx-h2">Median score and posts per week</h2>
                    <div className="sx-seg" role="group" aria-label="Period">
                        {[12, 26, 52].map(w => <button key={w} type="button" className={`sx-segb ${weeks === w ? 'on' : ''}`} aria-pressed={weeks === w} onClick={() => setWeeks(w)}>{w} weeks</button>)}
                    </div>
                </div>
                <svg viewBox="0 0 600 160" preserveAspectRatio="none" style={{ width: '100%', height: 180, display: 'block', marginTop: 18 }} role="img" aria-label="Weekly median score">
                    <path d="M0 10.5H600 M0 85H600 M0 159.5H600" stroke="#EFEFEF" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
                    <path d={line} fill="none" stroke="#111111" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, marginTop: 10 }} aria-label="Posts per week">
                    {data.buckets.map((b, i) => (
                        <div key={i} title={`${b.posts} posts`} style={{ flex: 1, height: `${Math.max(b.posts ? 8 : 2, b.posts / maxPosts * 100)}%`, background: b.posts ? '#CFCFCF' : '#F0F0F0', borderRadius: 3 }} />
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A8A8A', marginTop: 8 }}><span>{weeks} weeks ago</span><span>Posts per week</span><span>This week</span></div>
            </section>

            <section className="sx-card" style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20 }} aria-label="Summary">
                <Stat label="Posts per week" value={data.cad.avgPerWeek.toFixed(1)} sub={`${data.cad.activeWeeks} of ${weeks} weeks active`} />
                <Stat label="Median score" value={data.medianScore == null ? '—' : Math.round(data.medianScore).toLocaleString()} help="likes + 3×comments + 4×reposts" />
                <Stat label="Viral rate" value={data.viral == null ? '—' : pct(data.viral)} help="Share of posts at 2× the median or more" />
                <Stat label="Longest gap" value={data.cad.longestGapDays == null ? '—' : `${data.cad.longestGapDays} days`} />
            </section>

            <div className="sx-split">
                <section className="sx-card" style={{ flex: '1 1 340px', padding: '18px 20px' }} aria-labelledby="mix-h">
                    <h2 id="mix-h" className="sx-h2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Engagement mix <InfoTip text="Share of all likes, comments and reposts in this period" /></h2>
                    {data.mix ? (
                        <>
                            <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', gap: 2, margin: '18px 0 14px' }}>
                                <span style={{ width: pct(data.mix.likesShare), background: '#111111' }} />
                                <span style={{ width: pct(data.mix.commentsShare), background: '#7A7A7A' }} />
                                <span style={{ width: pct(data.mix.repostsShare), background: '#CFCFCF' }} />
                            </div>
                            {[['Likes', data.mix.likes, data.mix.likesShare, '#111111'], ['Comments', data.mix.comments, data.mix.commentsShare, '#7A7A7A'], ['Reposts', data.mix.reposts, data.mix.repostsShare, '#CFCFCF']].map(([k, v, s, c]) => (
                                <div key={k} className="sx-kv sx-num" style={{ gridTemplateColumns: '16px minmax(0,1fr) auto auto' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                                    <span style={{ color: '#111111', fontSize: 14 }}>{k}</span>
                                    <span style={{ color: '#6B6B6B' }}>{v.toLocaleString()}</span>
                                    <span style={{ fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{pct(s)}</span>
                                </div>
                            ))}
                        </>
                    ) : <Empty>No engagement in this period.</Empty>}
                </section>

                <section className="sx-card" style={{ flex: '1 1 340px', padding: '18px 20px' }} aria-labelledby="br-h">
                    <h2 id="br-h" className="sx-h2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Breakouts <InfoTip text="Posts at 2× the median or more" /></h2>
                    <div style={{ marginTop: 10 }}>
                        {data.breakouts.length === 0 ? <div className="sx-note" style={{ padding: '8px 0' }}>None in this period.</div> : data.breakouts.map(p => (
                            <button key={p.urn} type="button" className="sx-kv" style={{ width: '100%', textAlign: 'left', gridTemplateColumns: 'minmax(0,1fr) 70px auto' }} onClick={() => onNavigate('Posts', { urn: p.urn })}>
                                <span className="sx-trunc" style={{ color: '#111111', fontSize: 14, fontWeight: 500 }}>{hookLine(p)}</span>
                                <span style={{ fontSize: 12.5 }}>{formatAgo(new Date(p.publishedAt))} ago</span>
                                <LiftChip lift={p.lift} />
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

// ---------- Content ----------
const DriverCard = ({ title, rows, help, onPick }) => {
    const shown = rows.slice(0, 6);
    return (
        <section className="sx-card" style={{ padding: '18px 20px' }} aria-label={title}>
            <h2 className="sx-h2" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>{title} {help && <InfoTip text={help} />}</h2>
            {shown.length === 0 ? <div className="sx-note" style={{ padding: '6px 0' }}>No data yet.</div> : shown.map((r, i) => (
                <button key={r.key} type="button" onClick={() => onPick && onPick(r.key)} disabled={!onPick}
                    title={r.enough ? `${r.n} posts · ${r.medianLift.toFixed(1)}× the median` : `${r.n} post${r.n === 1 ? '' : 's'} · needs ${MIN_GROUP_POSTS} to compare`}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr) 28px 52px', gap: 12, alignItems: 'center', width: '100%', minHeight: 40, textAlign: 'left', cursor: onPick ? 'pointer' : 'default', borderTop: i ? '1px solid #F2F2F2' : 0 }}>
                    <span className="sx-trunc" style={{ fontSize: 14, fontWeight: r.enough ? 500 : 400, color: r.enough ? '#111111' : '#8A8A8A' }}>{r.key}</span>
                    <LiftBar lift={r.enough ? r.medianLift : null} strong={i === 0 && r.enough && r.medianLift >= 1.1} dim={!r.enough} />
                    <span className="sx-num" style={{ textAlign: 'right', fontSize: 12, color: '#8A8A8A' }}>{r.n}</span>
                    <span style={{ textAlign: 'right' }}><LiftChip lift={r.enough ? r.medianLift : null} dim={!r.enough} /></span>
                </button>
            ))}
            {rows.length > 6 && <div className="sx-note" style={{ marginTop: 8 }}>+{rows.length - 6} more</div>}
        </section>
    );
};

const Content = ({ scored, postTypes, onNavigate }) => {
    const d = useMemo(() => contentDrivers(scored, postTypes), [scored, postTypes]);
    return (
        <div>
            <p className="sx-note" style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>Each bar is a group’s median lift; the tick marks a typical post. <InfoTip text={`${LIFT_HELP} Groups need ${MIN_GROUP_POSTS}+ posts.`} /></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 24 }}>
                <DriverCard title="Opening" rows={d.opening} help="How the first line is written" />
                <DriverCard title="Topic" rows={d.topic} onPick={(t) => onNavigate('Posts', { topic: t })} />
                <DriverCard title="Format" rows={d.format} onPick={(f) => onNavigate('Posts', { format: f })} />
                <DriverCard title="Length" rows={d.length} />
            </div>
        </div>
    );
};

// ---------- Timing ----------
const shade = (lift, n) => {
    if (!n) return { bg: '#FAFAFA', fg: 'transparent' };
    if (lift == null) return { bg: '#EFEFEF', fg: '#8A8A8A' };
    if (lift >= 1.6) return { bg: '#111111', fg: '#FFFFFF' };
    if (lift >= 1.2) return { bg: '#555555', fg: '#FFFFFF' };
    if (lift >= 0.9) return { bg: '#A8A8A8', fg: '#111111' };
    return { bg: '#DADADA', fg: '#555555' };
};

const Timing = ({ scored }) => {
    const grid = useMemo(() => timingGrid(scored), [scored]);
    const best = useMemo(() => bestTiming(scored), [scored]);
    const perDay = WEEK_ORDER.map((d, i) => ({ day: DAY_NAMES[d], n: grid[i].reduce((s, c) => s + c.n, 0) }));
    const maxDay = Math.max(1, ...perDay.map(d => d.n));
    let tz = 'Local time';
    try { tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || tz; } catch (e) { /* default */ }

    return (
        <div className="sx-split">
            <section className="sx-card" style={{ flex: '2 1 560px', minWidth: 0, padding: '18px 20px' }} aria-labelledby="hm-h">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                    <h2 id="hm-h" className="sx-h2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>When posts perform <InfoTip text="Median lift of posts published in each slot. Darker is better. Grey cells have posts but no comparison yet." /></h2>
                    <span className="sx-note">{tz}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 520, display: 'grid', gridTemplateColumns: '44px repeat(8, minmax(0, 1fr))', gap: 4 }}>
                        <span />
                        {TIME_BLOCKS.map(b => <span key={b} style={{ fontSize: 11.5, color: '#8A8A8A', textAlign: 'center' }}>{blockLabel(b).split('–')[0]}</span>)}
                        {grid.map((row, i) => (
                            <React.Fragment key={i}>
                                <span style={{ fontSize: 12.5, color: '#555555', display: 'flex', alignItems: 'center' }}>{DAY_NAMES[WEEK_ORDER[i]].slice(0, 3)}</span>
                                {row.map(c => {
                                    const s = shade(c.lift, c.n);
                                    const thin = c.n > 0 && c.n < MIN_GROUP_POSTS;
                                    return (
                                        <div key={c.block} title={c.n ? `${DAY_NAMES[c.day]} ${blockLabel(c.block)} · ${c.n} post${c.n === 1 ? '' : 's'}${c.lift != null ? ` · ${c.lift.toFixed(1)}×` : ''}${thin ? ' · too few posts to trust' : ''}` : 'No posts'}
                                            className="sx-num" style={{ height: 34, borderRadius: 6, background: s.bg, color: s.fg, fontSize: 11.5, fontWeight: 600, display: 'grid', placeItems: 'center', opacity: thin ? 0.35 : 1 }}>
                                            {c.n && c.lift != null ? `${c.lift.toFixed(1)}` : c.n ? c.n : ''}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: '#6B6B6B' }}>
                    Below median {['#DADADA', '#A8A8A8', '#555555', '#111111'].map(c => <span key={c} style={{ width: 22, height: 10, borderRadius: 3, background: c }} />)} Above median
                    <span style={{ marginLeft: 'auto' }}>Faded: under {MIN_GROUP_POSTS} posts</span>
                </div>
            </section>

            <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <section className="sx-card-dark" style={{ padding: 22, display: 'grid', gap: 18 }} aria-label="Best timing">
                    {[['Best day', best.day], ['Best time', best.block]].map(([k, v]) => (
                        <div key={k}>
                            <div style={{ fontSize: 13, color: '#9A9A9A' }}>{k}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                                <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{v ? v.label : 'Not enough data'}</span>
                                {v && <span className="sx-num" style={{ fontSize: 14, fontWeight: 600 }}>{v.lift.toFixed(1)}×</span>}
                            </div>
                        </div>
                    ))}
                </section>
                <section className="sx-card" style={{ padding: '18px 20px' }} aria-labelledby="pd-h">
                    <h2 id="pd-h" className="sx-h2" style={{ marginBottom: 12 }}>Posts per weekday</h2>
                    {perDay.map(d => (
                        <div key={d.day} className="sx-num" style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr) 32px', gap: 10, alignItems: 'center', height: 30, fontSize: 13 }}>
                            <span style={{ color: '#555555' }}>{d.day}</span>
                            <span style={{ height: 8, background: '#F2F2F2', borderRadius: 99, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${d.n / maxDay * 100}%`, background: '#BDBDBD', borderRadius: 99 }} /></span>
                            <span style={{ textAlign: 'right' }}>{d.n}</span>
                        </div>
                    ))}
                </section>
            </div>
        </div>
    );
};

const InsightsPage = ({ scored = [], postTypes = {}, params = {}, onNavigate }) => {
    const [tab, setTab] = useState(params.tab || 'trends');
    useEffect(() => { if (params.tab) setTab(params.tab); }, [params]);
    return (
        <div className="sx-page">
            <PageHeader title="Insights" meta={`${scored.length} posts analysed`} />
            <Tabs label="Insight views" value={tab} onChange={setTab} tabs={[['trends', 'Trends'], ['content', 'Content'], ['timing', 'Timing']]} />
            {scored.length === 0 ? <div className="sx-card"><Empty style={{ padding: 48 }}>No posts captured yet.</Empty></div>
                : tab === 'trends' ? <Trends scored={scored} onNavigate={onNavigate} />
                : tab === 'content' ? <Content scored={scored} postTypes={postTypes} onNavigate={onNavigate} />
                : <Timing scored={scored} />}
        </div>
    );
};

export default InsightsPage;

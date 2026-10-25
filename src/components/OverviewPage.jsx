import React, { useMemo, useState } from 'react';
import LineIcon from './LineIcon';
import { LiftChip, PageHeader, RangeMenu, Empty, rangeDays, InfoTip } from './ui';
import { engagementScore, interactions, postTime, formatAgo, formatPct, periodWindows, inWindow, median, pctChange, MIN_GROUP_POSTS } from '../utils/metrics';
import { contentDrivers, bestTiming, cadence, hookLine, formatOf, topicOf } from '../utils/insights';

const DAY = 24 * 60 * 60 * 1000;
const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toLocaleString());

const spark = (vals) => {
    const known = vals.filter(v => v != null);
    if (known.length < 2) return '';
    const mn = Math.min(...known), mx = Math.max(...known);
    return vals.map((v, i) => (v == null ? null : `${(2 + i * 84 / (vals.length - 1)).toFixed(1)},${(25 - (v - mn) / ((mx - mn) || 1) * 22).toFixed(1)}`)).filter(Boolean).join(' ');
};

const DeltaChip = ({ change, count, dark }) => {
    const v = count != null ? count : change;
    if (v == null) return <span style={{ fontSize: 12.5, color: dark ? '#9A9A9A' : '#8A8A8A' }} title="Not enough posts in both periods to compare">—</span>;
    const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '';
    const text = count != null ? `${arrow} ${Math.abs(count)}` : `${arrow} ${formatPct(Math.abs(change)).replace('+', '')}`;
    return <span className="sx-num" title="vs the previous period of the same length" style={{ whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: dark ? '#FFFFFF' : '#111111' }}>{text.trim()}</span>;
};

const OverviewPage = ({ scored = [], patterns = [], postTypes = {}, onNavigate, onExport }) => {
    const [range, setRange] = useState('30');
    const [metric, setMetric] = useState('median');

    const data = useMemo(() => {
        const now = Date.now();
        const days = rangeDays(range);
        const win = days ? periodWindows(days, now) : null;
        const current = win ? inWindow(scored, win.current) : scored;
        const previous = win ? inWindow(scored, win.previous) : [];
        const enough = win && current.length >= MIN_GROUP_POSTS && previous.length >= MIN_GROUP_POSTS;
        const isViral = p => p.lift != null && p.lift >= 2;
        const sum = list => list.reduce((s, p) => s + interactions(p), 0);

        const weeks = Array.from({ length: 12 }, (_, i) => {
            const end = now - (11 - i) * 7 * DAY, start = end - 7 * DAY;
            const list = scored.filter(p => { const t = postTime(p); return t !== null && t > start && t <= end; });
            return { median: list.length ? median(list.map(engagementScore)) : null, interactions: sum(list), posts: list.length, viral: list.filter(isViral).length };
        });

        const medianNow = current.length ? median(current.map(engagementScore)) : null;
        const kpis = [
            { label: 'Median engagement', value: medianNow == null ? '—' : Math.round(medianNow).toLocaleString(), change: enough ? pctChange(medianNow, median(previous.map(engagementScore))) : null, spark: spark(weeks.map(w => w.median)), help: 'Median score per post: likes + 3×comments + 4×reposts', dark: true },
            { label: 'Viral posts', value: String(current.filter(isViral).length), count: win && previous.length ? current.filter(isViral).length - previous.filter(isViral).length : null, spark: spark(weeks.map(w => w.viral)), help: 'Posts at 2× this creator’s median or more' },
            { label: 'Interactions', value: compact(sum(current)), change: enough ? pctChange(sum(current), sum(previous)) : null, spark: spark(weeks.map(w => w.interactions)), help: 'Likes + comments + reposts' },
            { label: 'Posts', value: String(current.length), count: win && previous.length ? current.length - previous.length : null, spark: spark(weeks.map(w => w.posts)), help: 'Posts published in the period' },
        ];

        const topPosts = [...current].sort((a, b) => (b.lift ?? -1) - (a.lift ?? -1)).slice(0, 5);

        const drivers = contentDrivers(scored, postTypes);
        const best = (rows) => rows.find(r => r.enough && r.medianLift >= 1.1) || null;
        const working = [
            ['Opening', best(drivers.opening)], ['Topic', best(drivers.topic)], ['Format', best(drivers.format)], ['Length', best(drivers.length)],
        ].filter(([, r]) => r).map(([label, r]) => ({ label, value: r.key, lift: r.medianLift, n: r.n }));

        const timing = bestTiming(scored);
        const rhythm = cadence(scored, now, 12);

        const opening = best(drivers.opening), topic = best(drivers.topic);
        const day = timing.day && timing.day.lift >= 1.1 ? timing.day : null;
        const parts = [opening && { label: 'Opening', value: opening.key, lift: opening.medianLift }, topic && { label: 'Topic', value: topic.key, lift: topic.medianLift }, day && { label: 'Day', value: day.label, lift: day.lift }].filter(Boolean);
        const suggestion = parts.length >= 2 ? {
            title: `${opening ? opening.key : 'A post'}${topic ? ` about ${topic.key.toLowerCase()}` : ''}${day ? `, on a ${day.label}` : ''}`,
            parts, opening: opening ? opening.key : null, topic: topic ? topic.key : null,
        } : null;

        return { kpis, weeks, topPosts, working, timing, rhythm, suggestion, latest: scored.reduce((m, p) => Math.max(m, postTime(p) || 0), 0) };
    }, [scored, range, postTypes]);

    const chart = useMemo(() => {
        const vals = data.weeks.map(w => w[metric]);
        const known = vals.filter(v => v != null);
        const max = known.length ? Math.max(...known) : 0;
        const unit = max > 0 ? Math.pow(10, Math.floor(Math.log10(Math.max(max / 3, 1)))) : 1;
        const top = max > 0 ? Math.ceil(max * 1.1 / (3 * unit)) * 3 * unit : 3;
        const px = i => (i * 600 / (vals.length - 1)).toFixed(1);
        const py = v => (200 - v / top * 200).toFixed(1);
        let line = '', area = '', seg = [];
        const flush = () => {
            if (seg.length) {
                line += seg.map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${y}`).join(' ') + ' ';
                if (seg.length > 1) area += `M${seg[0][0]} 200 ` + seg.map(([x, y]) => `L${x} ${y}`).join(' ') + ` L${seg[seg.length - 1][0]} 200 Z `;
            }
            seg = [];
        };
        vals.forEach((v, i) => { if (v == null) flush(); else seg.push([px(i), py(v)]); });
        flush();
        const fmt = v => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)));
        return { line, area, yLabels: [3, 2, 1, 0].map(i => fmt(top * i / 3)) };
    }, [data.weeks, metric]);

    if (!scored.length) {
        return (
            <div className="sx-page">
                <PageHeader title="Overview" meta="No posts captured yet" />
                <div className="sx-card"><Empty style={{ padding: 48 }}>Open a LinkedIn profile’s activity page to capture its posts.</Empty></div>
            </div>
        );
    }

    return (
        <div className="sx-page">
            <PageHeader title="Overview" meta={`${scored.length} posts${data.latest ? ` · last post ${formatAgo(new Date(data.latest))} ago` : ''}`}>
                <RangeMenu value={range} onChange={setRange} />
                <button type="button" className="sx-btn line" onClick={onExport}><LineIcon name="download" size={16} /> Export</button>
            </PageHeader>

            <section aria-label="Key numbers" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                {data.kpis.map(k => (
                    <div key={k.label} className={k.dark ? 'sx-card-dark' : 'sx-card'} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: k.dark ? '#B5B5B5' : '#555555' }}>{k.label} <InfoTip text={k.help} /></span>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                <span className="sx-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</span>
                                <DeltaChip change={k.change} count={k.count} dark={k.dark} />
                            </div>
                            {k.spark && <svg viewBox="0 0 88 28" width="80" height="26" aria-hidden="true"><polyline fill="none" stroke={k.dark ? '#FFFFFF' : '#111111'} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" points={k.spark} /></svg>}
                        </div>
                    </div>
                ))}
            </section>

            <div className="sx-split">
                <div style={{ flex: '2 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <section className="sx-card" aria-labelledby="ov-chart">
                        <div className="sx-ch">
                            <h2 id="ov-chart" className="sx-h2">Engagement · 12 weeks</h2>
                            <div className="sx-seg" role="group" aria-label="Chart metric">
                                {[['median', 'Median score'], ['interactions', 'Interactions'], ['posts', 'Posts']].map(([id, label]) => (
                                    <button key={id} type="button" className={`sx-segb ${metric === id ? 'on' : ''}`} aria-pressed={metric === id} onClick={() => setMetric(id)}>{label}</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '40px minmax(0,1fr)', columnGap: 8, rowGap: 8 }}>
                            <div className="sx-num" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 200, fontSize: 12, color: '#8A8A8A', textAlign: 'right' }}>
                                {chart.yLabels.map((y, i) => <span key={i} style={{ lineHeight: 1 }}>{y}</span>)}
                            </div>
                            <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: '100%', height: 200, display: 'block' }} role="img" aria-label="Weekly engagement for the last 12 weeks">
                                <path d="M0 0.5H600 M0 66.7H600 M0 133.3H600 M0 199.5H600" stroke="#EFEFEF" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
                                <path d={chart.area} fill="#F3F3F3" />
                                <path d={chart.line} fill="none" stroke="#111111" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            </svg>
                            <span />
                            <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A8A8A' }}><span>12 weeks ago</span><span>This week</span></div>
                        </div>
                    </section>

                    <section className="sx-card" aria-labelledby="ov-top" style={{ overflow: 'hidden' }}>
                        <div className="sx-ch" style={{ paddingBottom: 12 }}>
                            <h2 id="ov-top" className="sx-h2">Top posts</h2>
                            <button type="button" className="sx-tbtn" onClick={() => onNavigate('Posts', { sort: 'lift' })}>View all</button>
                        </div>
                        {data.topPosts.length === 0 ? <Empty>No posts in this period.</Empty> : (
                            <table className="sx-table">
                                <thead><tr><th>Post</th><th style={{ width: 110 }}>Published</th><th className="r" style={{ width: 80 }}>Lift</th></tr></thead>
                                <tbody>
                                    {data.topPosts.map(p => (
                                        <tr key={p.urn} onClick={() => onNavigate('Posts', { urn: p.urn })}>
                                            <td style={{ maxWidth: 0 }}>
                                                <div className="sx-trunc" style={{ fontWeight: 500 }}>{hookLine(p)}</div>
                                                <div style={{ fontSize: 12.5, color: '#6B6B6B', marginTop: 2 }}>{formatOf(p)}{topicOf(p) ? ` · ${topicOf(p)}` : ''}</div>
                                            </td>
                                            <td style={{ color: '#555555' }}>{p.publishedAt ? `${formatAgo(new Date(p.publishedAt))} ago` : '—'}</td>
                                            <td className="r"><LiftChip lift={p.lift} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </section>
                </div>

                <aside aria-label="Guidance" style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <section className="sx-card-dark" aria-labelledby="ov-next" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#B5B5B5' }}><LineIcon name="sparkle" size={15} /> Next post</span>
                        {data.suggestion ? (
                            <>
                                <h2 id="ov-next" style={{ margin: 0, fontSize: 19, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em' }}>{data.suggestion.title}</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 14, borderTop: '1px solid #2A2A2A' }}>
                                    {data.suggestion.parts.map(p => (
                                        <div key={p.label} className="sx-num" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                                            <span style={{ color: '#9A9A9A' }}>{p.label}</span>
                                            <span><span style={{ color: '#D5D5D5' }}>{p.value}</span> <b style={{ marginLeft: 8, color: '#FFFFFF', fontWeight: 600 }}>{p.lift.toFixed(1)}×</b></span>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" className="sx-btn accent" style={{ width: '100%', height: 44 }} onClick={() => onNavigate('Studio', { opening: data.suggestion.opening, topic: data.suggestion.topic })}>Open template in Studio</button>
                            </>
                        ) : (
                            <h2 id="ov-next" style={{ margin: 0, fontSize: 16, fontWeight: 500, lineHeight: 1.45, color: '#D5D5D5' }}>Capture more posts to unlock a suggestion.</h2>
                        )}
                    </section>

                    <section className="sx-card" aria-labelledby="ov-work" style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <h2 id="ov-work" className="sx-h2">What’s working</h2>
                            <button type="button" className="sx-note" style={{ textDecoration: 'underline' }} onClick={() => onNavigate('Insights', { tab: 'content' })}>Details</button>
                        </div>
                        {data.working.length === 0 ? <div className="sx-note" style={{ padding: '8px 0' }}>Nothing stands out yet.</div> : data.working.map(w => (
                            <div key={w.label} className="sx-kv" title={`${w.n} posts`}>
                                <span>{w.label}</span><span className="sx-trunc" style={{ fontWeight: 500 }}>{w.value}</span><LiftChip lift={w.lift} />
                            </div>
                        ))}
                    </section>

                    <section className="sx-card" aria-labelledby="ov-rhythm" style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <h2 id="ov-rhythm" className="sx-h2">Rhythm</h2>
                            <button type="button" className="sx-note" style={{ textDecoration: 'underline' }} onClick={() => onNavigate('Insights', { tab: 'timing' })}>Timing</button>
                        </div>
                        <div className="sx-kv"><span>Per week</span><span className="sx-num" style={{ fontWeight: 500 }}>{data.rhythm.avgPerWeek.toFixed(1)} posts</span><span /></div>
                        <div className="sx-kv"><span>Last post</span><span className="sx-num" style={{ fontWeight: 500 }}>{data.rhythm.daysSinceLast == null ? '—' : data.rhythm.daysSinceLast === 0 ? 'Today' : `${data.rhythm.daysSinceLast} day${data.rhythm.daysSinceLast === 1 ? '' : 's'} ago`}</span><span /></div>
                        <div className="sx-kv"><span>Best day</span><span style={{ fontWeight: 500 }}>{data.timing.day ? data.timing.day.label : '—'}</span>{data.timing.day ? <LiftChip lift={data.timing.day.lift} /> : <span />}</div>
                        <div className="sx-kv"><span>Best time</span><span style={{ fontWeight: 500 }}>{data.timing.block ? data.timing.block.label : '—'}</span>{data.timing.block ? <LiftChip lift={data.timing.block.lift} /> : <span />}</div>
                    </section>
                </aside>
            </div>
        </div>
    );
};

export default OverviewPage;

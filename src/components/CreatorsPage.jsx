import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LineIcon from './LineIcon';
import { Avatar } from './AppSidebar';
import { LiftChip, PageHeader, Empty, InfoTip } from './ui';
import { withLift, engagementScore, postTime, median, formatPct, formatAgo, creatorSummary } from '../utils/metrics';
import { breakdown, formatOf, topicOf, bestTiming, creatorArchetype, viralRate, hookLine } from '../utils/insights';

const DAY = 24 * 60 * 60 * 1000;

const weeklyMedians = (scored, now, weeks = 12) => Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY, start = end - 7 * DAY;
    const list = scored.filter(p => { const t = postTime(p); return t !== null && t > start && t <= end; });
    return list.length ? median(list.map(engagementScore)) : null;
});

const Spark = ({ vals }) => {
    const known = vals.filter(v => v != null);
    if (known.length < 2) return <span style={{ color: '#BDBDBD' }}>—</span>;
    const mn = Math.min(...known), mx = Math.max(...known);
    const pts = vals.map((v, i) => (v == null ? null : `${(i * 80 / (vals.length - 1)).toFixed(1)},${(22 - (v - mn) / ((mx - mn) || 1) * 18).toFixed(1)}`)).filter(Boolean).join(' ');
    return <svg viewBox="0 0 80 24" width="80" height="24" aria-hidden="true"><polyline points={pts} fill="none" stroke="#111111" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
};

const analyse = (profile, posts) => {
    const now = Date.now();
    const scored = withLift(posts, now);
    const s = creatorSummary(scored, now);
    const named = scored.find(p => p.creatorName && !(p.isRepost && p.repostType !== 'self'));
    const best = (rows) => rows.find(r => r.enough && r.medianLift >= 1.1) || null;
    const topicByCount = [...breakdown(scored, topicOf)].sort((a, b) => b.n - a.n)[0];
    return {
        profile,
        name: named?.creatorName || profile.creatorId,
        image: named?.creatorImage || null,
        posts: scored.length,
        posts30: s.postsLast30,
        median: s.medianScore,
        trend: s.trendChange,
        weeks: weeklyMedians(scored, now),
        viral: viralRate(scored),
        topTopic: topicByCount ? topicByCount.key : null,
        archetype: creatorArchetype(scored, now),
        bestFormat: best(breakdown(scored, formatOf)),
        bestTopic: best(breakdown(scored, topicOf)),
        timing: bestTiming(scored),
        topPost: [...scored].sort((a, b) => (b.lift ?? -1) - (a.lift ?? -1))[0] || null,
        lastPost: scored.reduce((m, p) => Math.max(m, postTime(p) || 0), 0),
    };
};

const CreatorsPage = ({ onTrackedChange }) => {
    const [profiles, setProfiles] = useState([]);
    const [stats, setStats] = useState({});
    const [selected, setSelected] = useState(null);
    const [adding, setAdding] = useState(false);
    const [url, setUrl] = useState('');
    const [addMsg, setAddMsg] = useState('');
    const [update, setUpdate] = useState(null); // { processed, total, message } while running
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [sort, setSort] = useState('posts30');

    const load = useCallback(() => {
        if (!chrome?.runtime?.sendMessage) return;
        chrome.runtime.sendMessage({ action: 'get_all_watchlist_profiles' }, (res) => {
            const list = (res && res.profiles) || [];
            setProfiles(list);
            onTrackedChange && onTrackedChange(list);
            list.forEach(p => chrome.runtime.sendMessage({ action: 'get_profile_posts', profileUrn: p.profileUrn, creatorId: p.creatorId }, (r) => {
                if (r && r.success && Array.isArray(r.posts)) setStats(prev => ({ ...prev, [p.creatorId]: analyse(p, r.posts) }));
            }));
        });
    }, [onTrackedChange]);

    useEffect(() => {
        load();
        const onMsg = (m) => {
            if (m.action === 'profile_update_progress') setUpdate({ processed: m.processed || 0, total: m.total || 0, message: m.message });
            if (m.action === 'profile_update_complete') { setUpdate(null); load(); }
        };
        chrome?.runtime?.onMessage?.addListener(onMsg);
        return () => chrome?.runtime?.onMessage?.removeListener(onMsg);
    }, [load]);

    const rows = useMemo(() => {
        const list = profiles.map(p => stats[p.creatorId] || { profile: p, name: p.creatorId, loading: true });
        const key = { posts30: r => r.posts30 ?? -1, median: r => r.median ?? -1, trend: r => r.trend ?? -999, viral: r => r.viral ?? -1 }[sort];
        return list.sort((a, b) => key(b) - key(a));
    }, [profiles, stats, sort]);

    useEffect(() => { if (!selected && rows.length) setSelected(rows[0].profile.creatorId); }, [rows, selected]);
    const current = rows.find(r => r.profile.creatorId === selected);

    const addCreator = (e) => {
        e.preventDefault();
        let u = url.trim();
        if (!u) return;
        if (!u.startsWith('http')) u = `https://www.linkedin.com/in/${u.replace(/^@/, '')}`;
        setAddMsg('Adding…');
        chrome.runtime.sendMessage({ action: 'toggle_watchlist', url: u }, (res) => {
            if (res && res.success) { setUrl(''); setAddMsg(''); setAdding(false); load(); }
            else setAddMsg('Couldn’t add that profile. Check the URL.');
        });
    };
    const updateAll = () => {
        if (!profiles.length) return;
        setUpdate({ processed: 0, total: profiles.length, message: 'Starting…' });
        chrome.runtime.sendMessage({ action: 'start_profile_update', profiles: profiles.map(p => p.profileUrl || `https://www.linkedin.com/in/${p.creatorId}`) });
    };
    const stopUpdate = () => { chrome.runtime.sendMessage({ action: 'stop_profile_update' }); setUpdate(null); };
    const remove = (p) => {
        chrome.runtime.sendMessage({ action: 'delete_profile', creatorId: p.creatorId, profileUrn: p.profileUrn }, (res) => {
            setConfirmRemove(null);
            if (res && res.success) { setSelected(null); load(); }
        });
    };
    const openActivity = (p) => { window.location.href = `${(p.profileUrl || `https://www.linkedin.com/in/${p.creatorId}`).replace(/\/?$/, '/')}recent-activity/all/`; };
    const head = (key, label, help, cls = '') => (
        <th className={`r ${cls}`}><button type="button" onClick={() => setSort(key)} title={help}>{label}{sort === key ? ' ↓' : ''}</button></th>
    );

    return (
        <div className="sx-page" style={{ maxWidth: 1320 }}>
            <PageHeader title="Creators" meta={`${profiles.length} tracked`}>
                {update ? (
                    <button type="button" className="sx-btn line" onClick={stopUpdate}>Stop · {update.processed}/{update.total}</button>
                ) : (
                    <button type="button" className="sx-btn line" onClick={updateAll} disabled={!profiles.length} title="Fetch new posts for every tracked creator"><LineIcon name="sync" size={16} /> Update all</button>
                )}
                <button type="button" className="sx-btn dark" onClick={() => setAdding(a => !a)}><LineIcon name="plus" size={16} /> Track creator</button>
            </PageHeader>

            {adding && (
                <form onSubmit={addCreator} className="sx-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 12, marginBottom: 16 }}>
                    <label htmlFor="add-creator" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>LinkedIn profile URL</label>
                    <input id="add-creator" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="linkedin.com/in/username"
                        style={{ flex: '1 1 280px', height: 40, padding: '0 12px', border: '1px solid #E2E2E2', borderRadius: 10, font: '400 14px var(--font-family)', outline: 'none' }} />
                    <button type="submit" className="sx-btn dark">Add</button>
                    {addMsg && <span className="sx-note" role="status">{addMsg}</span>}
                </form>
            )}
            {update && <div className="sx-note" role="status" style={{ marginBottom: 12 }}>{update.message}</div>}

            {profiles.length === 0 ? (
                <div className="sx-card"><Empty style={{ padding: 48 }}>Track creators to compare them here. Paste a LinkedIn profile URL above.</Empty></div>
            ) : (
                <div className="sx-split">
                    <div className="sx-card sx-cq" style={{ flex: '1 1 480px', minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="sx-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 180 }}>Creator</th>
                                        {head('posts30', 'Posts · 30d')}
                                        {head('median', 'Median', 'Median score per post', 'sx-wide')}
                                        <th className="sx-wide" style={{ width: 100 }}>12 weeks</th>
                                        {head('trend', 'Trend', 'Median score, last 30 days vs the 30 before')}
                                        {head('viral', 'Viral rate', 'Share of posts at 2× their median')}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => (
                                        <tr key={r.profile.creatorId} className={r.profile.creatorId === selected ? 'sel' : ''} onClick={() => setSelected(r.profile.creatorId)}>
                                            <td style={{ maxWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                    <Avatar name={r.name} image={r.image} size={30} />
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className="sx-trunc" style={{ fontWeight: 500 }}>{r.name}</div>
                                                        <div className="sx-trunc" style={{ fontSize: 12.5, color: '#6B6B6B' }}>{r.loading ? 'Loading…' : r.topTopic || `${r.posts} posts`}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="r">{r.posts30 ?? '—'}</td>
                                            <td className="r sx-wide">{r.median == null ? '—' : Math.round(r.median).toLocaleString()}</td>
                                            <td className="sx-wide">{r.weeks ? <Spark vals={r.weeks} /> : null}</td>
                                            <td className="r" style={{ fontWeight: 600 }}>{r.trend == null ? <span style={{ color: '#BDBDBD', fontWeight: 400 }}>—</span> : `${r.trend > 0 ? '▲' : r.trend < 0 ? '▼' : ''} ${formatPct(Math.abs(r.trend)).replace('+', '')}`}</td>
                                            <td className="r">{r.viral == null ? '—' : `${Math.round(r.viral * 100)}%`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {current && !current.loading && (
                        <aside className="sx-card" aria-label="Creator profile" style={{ flex: '0 1 360px', minWidth: 300, padding: 22, display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Avatar name={current.name} image={current.image} size={44} />
                                <div style={{ minWidth: 0 }}>
                                    <div className="sx-trunc" style={{ fontSize: 17, fontWeight: 600 }}>{current.name}</div>
                                    <div className="sx-note">{current.posts} posts{current.lastPost ? ` · last ${formatAgo(new Date(current.lastPost))} ago` : ''}</div>
                                </div>
                            </div>

                            {current.archetype && (
                                <div className="sx-card-dark" style={{ padding: '16px 18px' }}>
                                    <div style={{ fontSize: 12.5, color: '#9A9A9A' }}>Style</div>
                                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{current.archetype.name}</div>
                                    <div style={{ fontSize: 13, color: '#B5B5B5', marginTop: 4 }}>{current.archetype.detail}</div>
                                </div>
                            )}

                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>What works for them <InfoTip text="Groups with 3+ posts that beat this creator’s median" /></div>
                                {[['Format', current.bestFormat?.key, current.bestFormat?.medianLift], ['Topic', current.bestTopic?.key, current.bestTopic?.medianLift], ['Day', current.timing.day?.label, current.timing.day?.lift]]
                                    .filter(([, v]) => v).map(([k, v, l]) => (
                                        <div key={k} className="sx-kv"><span>{k}</span><span className="sx-trunc" style={{ fontWeight: 500 }}>{v}</span><LiftChip lift={l} /></div>
                                    ))}
                                {!current.bestFormat && !current.bestTopic && !current.timing.day && <div className="sx-note" style={{ padding: '6px 0' }}>Needs more posts.</div>}
                            </div>

                            {current.topPost && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Top post</div>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: '#F7F7F7', borderRadius: 10 }}>
                                        <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>{hookLine(current.topPost)}</span>
                                        <LiftChip lift={current.topPost.lift} />
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className="sx-btn dark" style={{ flex: 1 }} onClick={() => openActivity(current.profile)}>Open their posts</button>
                                <button type="button" className="sx-btn danger" onClick={() => setConfirmRemove(current)} aria-label={`Stop tracking ${current.name}`}><LineIcon name="trash" size={16} /></button>
                            </div>
                        </aside>
                    )}
                </div>
            )}

            {confirmRemove && (
                <div className="sx-dialog-bg" onClick={() => setConfirmRemove(null)}>
                    <div className="sx-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rm-title" onClick={(e) => e.stopPropagation()}>
                        <h2 id="rm-title" className="sx-h2" style={{ fontSize: 18 }}>Stop tracking {confirmRemove.name}?</h2>
                        <p style={{ margin: '8px 0 20px', fontSize: 14, lineHeight: 1.5, color: '#555555' }}>Their {confirmRemove.posts || ''} captured posts will be deleted from this browser.</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button type="button" className="sx-btn line" autoFocus onClick={() => setConfirmRemove(null)}>Cancel</button>
                            <button type="button" className="sx-btn danger" onClick={() => remove(confirmRemove.profile)}>Stop tracking</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatorsPage;

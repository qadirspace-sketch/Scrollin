import React, { useEffect, useMemo, useState } from 'react';
import LineIcon from './LineIcon';
import { LiftChip, PageHeader, Empty, InfoTip, LIFT_HELP } from './ui';
import { counts, engagementScore, formatAgo, periodWindows, inWindow } from '../utils/metrics';
import { contentDrivers, explainPost, formatOf, topicOf, hookLine } from '../utils/insights';

const PAGE = 50;
const SORTS = { date: p => p.publishedAt || 0, likes: p => counts(p).likes, comments: p => counts(p).comments, reposts: p => counts(p).reposts, lift: p => (p.lift ?? -1) };

const fullDate = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

const PostDetail = ({ post, drivers, postTypes, onNavigate }) => {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);
    useEffect(() => { setCopied(false); setExpanded(false); }, [post && post.urn]);
    if (!post) return null;
    const c = counts(post);
    const rows = explainPost(post, drivers, postTypes);
    const url = post.postUrl || `https://www.linkedin.com/feed/update/${post.urn}/`;
    const image = (post.media || []).find(m => m && m.type === 'image' && m.url);
    const copy = async () => { try { await navigator.clipboard.writeText(post.text || ''); setCopied(true); } catch (e) { setCopied(false); } };
    const text = post.text || '';
    const long = text.length > 600;

    return (
        <aside className="sx-card" aria-label="Post details" style={{ position: 'sticky', top: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span className="sx-note">{fullDate(post.publishedAt)}{post.isRepost ? ' · Repost' : ''}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="sx-ibtn" aria-label="Open on LinkedIn" title="Open on LinkedIn"><LineIcon name="external" size={16} /></a>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                <span className="sx-num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>{post.lift == null ? '—' : `${post.lift.toFixed(1)}×`}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B6B6B', paddingBottom: 4 }}>vs median <InfoTip text={LIFT_HELP} /></span>
            </div>

            <div className="sx-num" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
                {[['Likes', c.likes], ['Comments', c.comments], ['Reposts', c.reposts], ['Score', engagementScore(post)]].map(([k, v]) => (
                    <div key={k} style={{ padding: '10px 12px', background: '#F7F7F7', borderRadius: 10 }}>
                        <div style={{ fontSize: 12, color: '#6B6B6B' }}>{k}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{v.toLocaleString()}</div>
                    </div>
                ))}
            </div>

            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    What it used <InfoTip text="How each choice usually performs for this creator" />
                </div>
                {rows.map(r => (
                    <div key={r.label} className="sx-kv">
                        <span>{r.label}</span><span className="sx-trunc" style={{ fontWeight: 500 }}>{r.value}</span>
                        {r.label === 'Posted' ? <span /> : <LiftChip lift={r.groupLift} dim={r.groupLift == null} title={r.groupLift == null ? 'Fewer than 3 posts like this' : `Posts like this usually score ${r.groupLift.toFixed(1)}× the median`} />}
                    </div>
                ))}
            </div>

            {image && <img src={image.url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, background: '#F2F2F2' }} />}

            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#222222', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {long && !expanded ? `${text.slice(0, 600)}…` : text}
                {long && <button type="button" onClick={() => setExpanded(e => !e)} style={{ display: 'block', marginTop: 6, fontSize: 13, fontWeight: 500, textDecoration: 'underline' }}>{expanded ? 'Show less' : 'Show full post'}</button>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="sx-btn accent" style={{ flex: 1 }} onClick={() => onNavigate('Studio', { fromPost: post.urn, opening: rows[0].value !== '—' ? rows[0].value : null, topic: rows[1].value !== '—' ? rows[1].value : null })}>Use this opening</button>
                <button type="button" className="sx-btn line" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
            </div>
        </aside>
    );
};

const PostsPage = ({ scored = [], postTypes = {}, params = {}, searchTerm, onSearchChange, ownOnly, onOwnOnlyChange, isFetching, onExport, onNavigate }) => {
    const [range, setRange] = useState('all');
    const [format, setFormat] = useState(params.format || 'all');
    const [topic, setTopic] = useState(params.topic || 'all');
    const [viralOnly, setViralOnly] = useState(false);
    const [sort, setSort] = useState({ key: params.sort || 'date', dir: 'desc' });
    const [selected, setSelected] = useState(params.urn || null);
    const [limit, setLimit] = useState(PAGE);

    useEffect(() => {
        if (params.urn) setSelected(params.urn);
        if (params.sort) setSort({ key: params.sort, dir: 'desc' });
        if (params.format) setFormat(params.format);
        if (params.topic) setTopic(params.topic);
    }, [params]);

    const drivers = useMemo(() => contentDrivers(scored, postTypes), [scored, postTypes]);
    const topics = useMemo(() => [...new Set(scored.map(topicOf).filter(Boolean))].sort(), [scored]);

    const rows = useMemo(() => {
        let list = scored;
        if (range !== 'all') list = inWindow(list, periodWindows(Number(range)).current);
        if (format !== 'all') list = list.filter(p => formatOf(p) === format);
        if (topic !== 'all') list = list.filter(p => topicOf(p) === topic);
        if (viralOnly) list = list.filter(p => p.lift != null && p.lift >= 2);
        if (searchTerm) { const q = searchTerm.toLowerCase(); list = list.filter(p => (p.text || '').toLowerCase().includes(q)); }
        const fn = SORTS[sort.key];
        return [...list].sort((a, b) => (sort.dir === 'desc' ? fn(b) - fn(a) : fn(a) - fn(b)));
    }, [scored, range, format, topic, viralOnly, searchTerm, sort]);

    useEffect(() => { setLimit(PAGE); }, [range, format, topic, viralOnly, searchTerm, sort]);
    useEffect(() => { if (!rows.find(p => p.urn === selected) && rows.length) setSelected(rows[0].urn); }, [rows]);

    const selectedPost = rows.find(p => p.urn === selected) || null;
    const sortBy = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
    const arrow = (key) => (sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '');
    const filtered = rows.length !== scored.length;

    return (
        <div className="sx-page" style={{ maxWidth: 1320 }}>
            <PageHeader title="Posts" meta={filtered ? `${rows.length} of ${scored.length}` : `${scored.length} posts`}>
                <button type="button" className="sx-btn line" onClick={onExport}><LineIcon name="download" size={16} /> Export</button>
            </PageHeader>

            <div role="search" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <label style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', border: '1px solid #E2E2E2', borderRadius: 9 }}>
                    <LineIcon name="search" size={15} color="#6B6B6B" />
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search posts</span>
                    <input type="search" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search"
                        style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: '400 14px var(--font-family)', color: 'var(--ink)' }} />
                </label>
                <select className="sx-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
                    <option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
                </select>
                <select className="sx-select" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
                    <option value="all">All formats</option>{['Text', 'Image', 'Carousel', 'Video'].map(f => <option key={f}>{f}</option>)}
                </select>
                <select className="sx-select" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
                    <option value="all">All topics</option>{topics.map(t => <option key={t}>{t}</option>)}
                </select>
                <button type="button" className={`sx-filter ${viralOnly ? 'on' : ''}`} aria-pressed={viralOnly} onClick={() => setViralOnly(v => !v)} title="Posts at 2× the median or more">Viral</button>
                <button type="button" className={`sx-filter ${ownOnly ? 'on' : ''}`} aria-pressed={ownOnly} onClick={() => onOwnOnlyChange(!ownOnly)} title="Hide reposts of other people’s posts">Own posts</button>
            </div>

            {rows.length === 0 ? (
                <div className="sx-card"><Empty style={{ padding: 48 }}>{isFetching ? 'Capturing posts…' : scored.length ? 'No posts match these filters.' : 'No posts captured yet.'}</Empty></div>
            ) : (
                <div className="sx-split">
                    <div className="sx-card sx-cq" style={{ flex: '1 1 480px', minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="sx-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 220 }}>Post</th>
                                        <th style={{ width: 110 }}><button type="button" onClick={() => sortBy('date')}>Published{arrow('date')}</button></th>
                                        <th className="r" style={{ width: 80 }}><button type="button" onClick={() => sortBy('likes')}>Likes{arrow('likes')}</button></th>
                                        <th className="r sx-wide" style={{ width: 100 }}><button type="button" onClick={() => sortBy('comments')}>Comments{arrow('comments')}</button></th>
                                        <th className="r sx-wide" style={{ width: 90 }}><button type="button" onClick={() => sortBy('reposts')}>Reposts{arrow('reposts')}</button></th>
                                        <th className="r" style={{ width: 80 }}><button type="button" onClick={() => sortBy('lift')} title={LIFT_HELP}>Lift{arrow('lift')}</button></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.slice(0, limit).map(p => {
                                        const c = counts(p);
                                        return (
                                            <tr key={p.urn} className={p.urn === selected ? 'sel' : ''} onClick={() => setSelected(p.urn)} aria-selected={p.urn === selected}>
                                                <td style={{ maxWidth: 0 }}>
                                                    <div className="sx-trunc" style={{ fontWeight: 500 }}>{hookLine(p)}</div>
                                                    <div className="sx-trunc" style={{ fontSize: 12.5, color: '#6B6B6B', marginTop: 2 }}>{formatOf(p)}{topicOf(p) ? ` · ${topicOf(p)}` : ''}{p.isRepost ? ' · Repost' : ''}</div>
                                                </td>
                                                <td style={{ color: '#555555' }}>{p.publishedAt ? `${formatAgo(new Date(p.publishedAt))} ago` : '—'}</td>
                                                <td className="r">{c.likes.toLocaleString()}</td>
                                                <td className="r sx-wide">{c.comments.toLocaleString()}</td>
                                                <td className="r sx-wide">{c.reposts.toLocaleString()}</td>
                                                <td className="r"><LiftChip lift={p.lift} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {limit < rows.length && (
                            <div style={{ padding: 12 }}><button type="button" className="sx-btn line" style={{ width: '100%' }} onClick={() => setLimit(l => l + PAGE)}>Show more ({rows.length - limit})</button></div>
                        )}
                    </div>
                    <div style={{ flex: '0 1 380px', minWidth: 300, alignSelf: 'stretch' }}>
                        <PostDetail post={selectedPost} drivers={drivers} postTypes={postTypes} onNavigate={onNavigate} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostsPage;

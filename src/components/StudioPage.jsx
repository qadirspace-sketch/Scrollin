import React, { useEffect, useMemo, useState } from 'react';
import { LiftChip, PageHeader, Empty, InfoTip } from './ui';
import { hookLabel, patternLabel } from '../utils/patternNames';
import { hookLine } from '../utils/insights';
import { engagementScore } from '../utils/metrics';

const CopyButton = ({ text, label = 'Copy' }) => {
    const [done, setDone] = useState(false);
    useEffect(() => { setDone(false); }, [text]);
    return (
        <button type="button" className="sx-btn line" style={{ height: 34 }} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); } catch (e) { setDone(false); } }}>
            {done ? 'Copied' : label}
        </button>
    );
};

const StudioPage = ({ scored = [], patterns = [], params = {}, onNavigate }) => {
    // Openings ranked: enough data first, then by lift
    const openings = useMemo(() => [...patterns].sort((a, b) =>
        (b.stats?.hasEnoughData - a.stats?.hasEnoughData) || ((Number(b.stats?.medianLift) || 0) - (Number(a.stats?.medianLift) || 0))), [patterns]);

    const pickInitial = () => {
        if (params.opening) {
            const hit = openings.find(p => hookLabel(p.name) === params.opening);
            if (hit) return hit.name;
        }
        return openings[0]?.name || null;
    };
    const [selected, setSelected] = useState(pickInitial);
    useEffect(() => { setSelected(pickInitial()); }, [patterns, params]); // eslint-disable-line react-hooks/exhaustive-deps

    const pattern = openings.find(p => p.name === selected) || null;
    const [template, setTemplate] = useState('');
    useEffect(() => { setTemplate(typeof pattern?.template === 'string' ? pattern.template : ''); }, [pattern]);

    const examples = useMemo(() => (pattern?.stats?.posts || [])
        .map(p => scored.find(s => s.urn === p.urn) || p)
        .sort((a, b) => engagementScore(b) - engagementScore(a))
        .slice(0, 3), [pattern, scored]);

    const fromPost = params.fromPost ? scored.find(p => p.urn === params.fromPost) : null;

    if (!patterns.length) {
        return (
            <div className="sx-page">
                <PageHeader title="Studio" />
                <div className="sx-card"><Empty style={{ padding: 48 }}>{scored.length ? 'Analysing openings…' : 'Capture posts from a profile to see which openings work.'}</Empty></div>
            </div>
        );
    }

    return (
        <div className="sx-page" style={{ maxWidth: 1320 }}>
            <PageHeader title="Studio" meta="Turn what works into your next post" />

            {fromPost && (
                <div className="sx-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 20, background: '#FAFAFA' }}>
                    <span className="sx-note">Based on</span>
                    <span className="sx-trunc" style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{hookLine(fromPost)}</span>
                    <LiftChip lift={fromPost.lift} />
                </div>
            )}

            <div className="sx-split">
                <nav aria-label="Proven openings" className="sx-card" style={{ flex: '1 1 260px', maxWidth: 320, padding: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 8px', fontSize: 13, fontWeight: 600 }}>Openings <InfoTip text="How this creator’s posts start, ranked by lift. Patterns need 3+ posts to be ranked." /></div>
                    {openings.map(p => (
                        <button key={p.name} type="button" onClick={() => setSelected(p.name)} aria-current={p.name === selected}
                            className={`sx-item ${p.name === selected ? 'on' : ''}`} style={{ minHeight: 52, alignItems: 'center' }}>
                            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <span className="sx-trunc" style={{ fontSize: 14 }}>{hookLabel(p.name)}</span>
                                <span style={{ fontSize: 12, color: '#6B6B6B', fontWeight: 400 }}>{p.stats.count} posts</span>
                            </span>
                            <LiftChip lift={p.stats.hasEnoughData ? Number(p.stats.medianLift) : null} />
                        </button>
                    ))}
                </nav>

                <div style={{ flex: '3 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {pattern && (
                        <section className="sx-card" style={{ padding: '18px 20px' }} aria-labelledby="tpl-h">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                                <div>
                                    <h2 id="tpl-h" className="sx-h2">{hookLabel(pattern.name)}</h2>
                                    <div className="sx-note" style={{ marginTop: 2 }}>{patternLabel(pattern.name).split(' · ')[1] || ''}{pattern.description?.cta && pattern.description.cta !== 'No CTA' ? ` · ends with ${pattern.description.cta.toLowerCase()}` : ''}</div>
                                </div>
                                <CopyButton text={template} />
                            </div>
                            <label htmlFor="tpl" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Template</label>
                            <textarea id="tpl" value={template} onChange={(e) => setTemplate(e.target.value)} rows={8}
                                style={{ width: '100%', padding: 14, border: '1px solid #E8E8E8', borderRadius: 10, background: '#FAFAFA', font: '400 14px/1.6 var(--font-family)', color: '#111111', resize: 'vertical', outline: 'none' }} />

                            {examples.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Best examples</div>
                                    {examples.map(p => (
                                        <button key={p.urn} type="button" className="sx-kv" style={{ width: '100%', textAlign: 'left', gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => onNavigate('Posts', { urn: p.urn })}>
                                            <span className="sx-trunc" style={{ color: '#111111', fontSize: 14 }}>{hookLine(p)}</span>
                                            <LiftChip lift={p.lift} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudioPage;

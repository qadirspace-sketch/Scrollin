import React, { useState, useEffect, useMemo } from 'react';
import Icon from './Icon';
import { getTagsForPost } from '../utils/taggingService';
import { extractTimeFromUrn, getPostDateObj } from '../utils/timeUtils';
import { generateExecutiveSummary } from '../services/geminiService';
import { prepareTopicDataForAI } from '../utils/aiDataAggregator';

const CLOUD_COLORS = ["#6E9FDE", "#8AB7EE", "#161616", "#A9C7F2", "#3A3A3E", "#6E9FDE"];

const TrendBadge = ({ trend, delta }) => {
    if (trend === "up" || (typeof trend === 'number' && trend > 0)) {
        return <span className="pill pill-green"><Icon name="trendUp" size={12} />{delta || `${trend}%`}</span>;
    }
    if (trend === "down" || (typeof trend === 'number' && trend < 0)) {
        return <span className="pill pill-red"><Icon name="trendDown" size={12} />{delta || `${Math.abs(trend)}%`}</span>;
    }
    return <span className="pill" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{delta || "Flat"}</span>;
};

const DropframeSelect = ({ value, options, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = React.useRef(null);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const labelMap = {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '90d': 'Last 90 Days',
        'all': 'All Time'
    };

    return (
        <div className="dd" ref={ref}>
            <button 
                type="button"
                className="dd-btn" 
                onClick={() => setOpen(!open)}
                style={{ fontSize: '12.5px', fontWeight: 600 }}
            >
                {labelMap[value] || value} <Icon name="chevD" size={13} style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
            </button>
            {open && (
                <div className="dd-menu" style={{ minWidth: '130px', zIndex: 1000 }}>
                    {options.map(o => (
                        <button 
                            key={o} 
                            type="button"
                            className={`dd-item ${o === value ? "sel" : ""}`} 
                            onClick={() => { onChange(o); setOpen(false); }}
                            style={{ fontSize: '12px' }}
                        >
                            {labelMap[o] || o}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const TopicIntelligence = ({ posts, profileId }) => {
    const [analyzedData, setAnalyzedData] = useState({ tags: [], coOccurrences: [], totalPosts: 0, insights: {} });
    const [isCalculating, setIsCalculating] = useState(false);
    const [timeRange, setTimeRange] = useState('30d');
    const [contentFilter, setContentFilter] = useState('my_content'); // my_content, all_content
    const [activeWord, setActiveWord] = useState(null);
    const [activePair, setActivePair] = useState(null);

    // AI Summaries State
    const [aiSummaries, setAiSummaries] = useState({});
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);

    // Auto-adjust default time range if no posts exist in 30d
    useEffect(() => {
        if (posts && posts.length > 0 && timeRange === '30d') {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const hasRecentPosts = posts.some(post => {
                const date = getPostDateObj(post);
                return date && date >= thirtyDaysAgo;
            });
            if (!hasRecentPosts) {
                setTimeRange('all');
            }
        }
    }, [posts, timeRange]);

    // Load cached AI summaries
    useEffect(() => {
        if (!profileId) return;
        try {
            const cached = localStorage.getItem(`kleo_topic_ai_summaries_${profileId}`);
            setAiSummaries(cached ? JSON.parse(cached) : {});
        } catch (e) {
            setAiSummaries({});
        }
    }, [profileId]);

    const calculateAnalytics = async (currentPosts, range, filter) => {
        const tagCounts = {};
        const coOccurrences = {};

        const now = new Date();
        let days = 30;
        if (range === '7d') days = 7;
        if (range === '90d') days = 90;
        if (range === 'all') days = 36500;

        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        const previousCutoffDate = new Date(now.getTime() - (days * 2 * 24 * 60 * 60 * 1000));

        const validPosts = currentPosts.filter(post => {
            if (!post.urn) return false;
            if (filter === 'my_content') {
                if (post.isRepost && post.repostType !== 'self') return false;
            }
            return true;
        });

        const periodPosts = [];
        const previousPosts = [];

        validPosts.forEach(post => {
            const date = getPostDateObj(post);
            if (!date) return;

            if (date >= cutoffDate) {
                periodPosts.push(post);
            } else if (date >= previousCutoffDate) {
                previousPosts.push(post);
            }
        });

        const processBatch = async (batch) => {
            const results = await Promise.all(batch.map(async (post) => {
                const tagResult = await getTagsForPost(post.text, post.urn);
                return { post, ...tagResult };
            }));
            return results;
        };

        const currentResults = await processBatch(periodPosts);

        currentResults.forEach(({ post, primaryTag, secondaryTags }) => {
            const primaryTagsOnly = [primaryTag].filter(t => t && t !== 'General');
            const allTags = [primaryTag, ...(secondaryTags || [])].filter(t => t && t !== 'General');
            const uniqueAllTags = [...new Set(allTags)];

            primaryTagsOnly.forEach(tag => {
                if (!tagCounts[tag]) {
                    tagCounts[tag] = { name: tag, volume: 0, likes: 0, comments: 0, reposts: 0, previousVolume: 0, posts: [] };
                }
                tagCounts[tag].volume += 1;
                tagCounts[tag].posts.push(post);
                tagCounts[tag].likes += (post.stats?.likes || 0);
                tagCounts[tag].comments += (post.stats?.comments || 0);
                tagCounts[tag].reposts += (post.stats?.reposts || 0);
            });

            for (let i = 0; i < uniqueAllTags.length; i++) {
                for (let j = i + 1; j < uniqueAllTags.length; j++) {
                    const key = [uniqueAllTags[i], uniqueAllTags[j]].sort().join(' + ');
                    coOccurrences[key] = (coOccurrences[key] || 0) + 1;
                }
            }
        });

        const previousResults = await processBatch(previousPosts);
        previousResults.forEach(({ primaryTag }) => {
            const tagsToCount = [primaryTag].filter(t => t && t !== 'General');
            tagsToCount.forEach(tag => {
                if (tagCounts[tag]) {
                    tagCounts[tag].previousVolume += 1;
                }
            });
        });

        const formattedTags = Object.values(tagCounts).map(t => {
            let trend = 0;
            if (t.previousVolume > 0) {
                trend = Math.round(((t.volume - t.previousVolume) / t.previousVolume) * 100);
            } else if (t.volume > 0) {
                trend = 100;
            }

            return {
                ...t,
                avgLikes: Math.round(t.likes / t.volume) || 0,
                avgComments: Math.round(t.comments / t.volume) || 0,
                avgEngagement: Math.round((t.likes + t.comments + t.reposts) / t.volume) || 0,
                trend: trend
            };
        });

        const sortedCoOccurrences = Object.entries(coOccurrences)
            .map(([pair, count]) => {
                const parts = pair.split(' + ');
                return { a: parts[0], b: parts[1], n: count };
            })
            .sort((a, b) => b.n - a.n)
            .slice(0, 5);

        const globalAvgEng = formattedTags.reduce((sum, t) => sum + t.avgEngagement, 0) / (formattedTags.length || 1);

        const growing = formattedTags
            .filter(t => t.volume >= 1 && t.avgEngagement >= globalAvgEng)
            .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

        const declining = formattedTags
            .filter(t => t.volume >= 1 && t.avgEngagement < globalAvgEng)
            .sort((a, b) => a.avgEngagement - b.avgEngagement)[0];

        const opportunity = formattedTags
            .filter(t => t.volume > 0 && t.volume <= 5 && t.avgEngagement > globalAvgEng * 1.0)
            .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

        return {
            tags: formattedTags,
            coOccurrences: sortedCoOccurrences,
            totalPosts: periodPosts.length,
            insights: { growing, declining, opportunity }
        };
    };

    useEffect(() => {
        if (!posts || posts.length === 0) return;

        const processData = async () => {
            setIsCalculating(true);
            const data = await calculateAnalytics(posts, timeRange, contentFilter);
            setAnalyzedData(data);
            setIsCalculating(false);
        };

        processData();
    }, [posts, timeRange, contentFilter]);

    const handleGenerateAI = async () => {
        if (!analyzedData || !analyzedData.tags) return;

        setIsAiLoading(true);
        setAiError(null);

        try {
            const ranges = ['7d', '30d', '90d', 'all'];
            const payloads = {};

            for (const range of ranges) {
                const data = await calculateAnalytics(posts, range, contentFilter);
                payloads[range] = prepareTopicDataForAI(
                    data.tags,
                    data.coOccurrences.map(c => ({ pair: `${c.a} + ${c.b}`, count: c.n })),
                    data.totalPosts,
                    range,
                    data.insights
                );
            }

            const multiSummary = await generateExecutiveSummary(payloads);

            if (multiSummary) {
                setAiSummaries(multiSummary);
                try {
                    localStorage.setItem(`kleo_topic_ai_summaries_${profileId}`, JSON.stringify(multiSummary));
                } catch (e) {
                    console.error("Failed to save AI summaries", e);
                }
            } else {
                throw new Error("No summary returned");
            }
        } catch (err) {
            console.error(err);
            setAiError("Failed to generate insights.");
        } finally {
            setIsAiLoading(false);
        }
    };

    // Word Cloud Variables
    const maxS = useMemo(() => {
        return Math.max(1, ...analyzedData.tags.map(t => t.volume));
    }, [analyzedData.tags]);

    // Node Co-occurrence SVG network mapping coordinates
    const hubs = useMemo(() => {
        const topTags = analyzedData.tags.slice(0, 6).map(t => t.name);
        while (topTags.length < 6) {
            topTags.push(["Career Growth", "AI Tools", "Leadership", "Productivity", "Personal Branding", "Networking"][topTags.length]);
        }
        return topTags;
    }, [analyzedData.tags]);

    const cx = 150, cy = 120, R = 75;
    const nodes = useMemo(() => {
        return hubs.map((h, i) => {
            const a = (i / hubs.length) * Math.PI * 2 - Math.PI / 2;
            return { name: h, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: 8 + (i % 3) * 2 };
        });
    }, [hubs]);

    const activeSummary = aiSummaries[timeRange] || {};

    const growingDesc = activeSummary.growing || "Your fastest-rising topic by average engagement.";
    const decliningDesc = activeSummary.declining || "Cooling off or saturated in your recent cadence.";
    const opportunityDesc = activeSummary.opportunity || "High engagement potential, but under-supplied by you.";

    const overview = [
        { kind: "Top Growing", topic: analyzedData.insights.growing?.name || "None", delta: analyzedData.insights.growing ? `+${analyzedData.insights.growing.trend}%` : "Stable", trend: analyzedData.insights.growing?.trend > 0 ? "up" : "flat", icon: "trendUp", ic: "ic-green", desc: growingDesc },
        { kind: "Declining", topic: analyzedData.insights.declining?.name || "None", delta: analyzedData.insights.declining ? `${analyzedData.insights.declining.trend}%` : "Stable", trend: analyzedData.insights.declining?.trend < 0 ? "down" : "flat", icon: "trendDown", ic: "ic-red", desc: decliningDesc },
        { kind: "Opportunity", topic: analyzedData.insights.opportunity?.name || "None", delta: "Untapped", trend: "flat", icon: "target", ic: "ic-blue", desc: opportunityDesc },
    ];

    if (isCalculating) {
        return (
            <div className="view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    return (
        <div className="view">
            {/* Page Header */}
            <div className="page-head">
                <div>
                    <div className="page-title">Topic Intelligence</div>
                    <div className="page-sub">What you talk about — and what's working</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Timeframe Select */}
                    <DropframeSelect value={timeRange} options={['7d', '30d', '90d', 'all']} onChange={setTimeRange} />

                    {/* Content Filter Toggle */}
                    <button 
                        className="switch" 
                        onClick={() => setContentFilter(prev => prev === 'my_content' ? 'all' : 'my_content')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', outline: 'none' }}
                    >
                        <span className={`switch-track ${contentFilter === 'my_content' ? 'on' : ''}`}>
                            <span className="switch-knob" />
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink-2)' }}>My content only</span>
                    </button>

                    {/* Generate AI button */}
                    <button 
                        className="btn btn-blue btn-sm" 
                        onClick={handleGenerateAI} 
                        disabled={isAiLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                        <Icon name="sparkle" size={14} style={isAiLoading ? { animation: 'spin 1.2s linear infinite' } : null} />
                        {isAiLoading ? "Analyzing…" : (aiSummaries[timeRange] ? "Refresh AI" : "Generate AI")}
                    </button>
                </div>
            </div>

            {/* AI Error Alert */}
            {aiError && (
                <div className="callout callout-blue" style={{ marginBottom: '18px' }}>
                    <Icon name="watchlist" size={14} />
                    <span>{aiError}</span>
                </div>
            )}

            {/* Overview cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 18 }}>
                {overview.map((o, i) => (
                    <div className="card" key={i} style={{ display: "flex", gap: 14, padding: '16px' }}>
                        <div className={`insight-ic ${o.ic}`} style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name={o.icon} size={20} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: 'uppercase' }}>{o.kind}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 6px", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                                {o.topic}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <TrendBadge trend={o.trend} delta={o.delta} />
                            </div>
                            <div className="insight-desc" style={{ marginTop: 8, fontSize: '12.5px', color: 'var(--muted)', lineHeight: '1.4' }}>{o.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Topic Universe Word Cloud */}
            <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
                <div className="sec-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                        <div className="sec-title">Topic Universe</div>
                        <div className="page-sub">Sized by frequency across your posts</div>
                    </div>
                    {activeWord && (
                        <span className="pill pill-blue">{activeWord.name} · {activeWord.volume} posts</span>
                    )}
                </div>
                <div className="cloud" style={{ minHeight: 180, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    {analyzedData.tags.length === 0 ? (
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Not enough data for word cloud</span>
                    ) : (
                        analyzedData.tags.map((c, i) => {
                            const fontSize = 14 + (c.volume / maxS) * 24;
                            const isActive = activeWord && activeWord.name === c.name;
                            return (
                                <span 
                                    key={i} 
                                    className="cloud-word"
                                    style={{ 
                                        fontSize: fontSize, 
                                        color: CLOUD_COLORS[i % CLOUD_COLORS.length], 
                                        opacity: activeWord && !isActive ? .3 : 1,
                                        transform: isActive ? 'scale(1.08)' : 'none',
                                        transition: 'transform 0.2s, opacity 0.2s',
                                        cursor: 'pointer',
                                        margin: '6px 12px',
                                        fontWeight: 600,
                                        display: 'inline-block'
                                    }}
                                    onMouseEnter={() => setActiveWord(c)} 
                                    onMouseLeave={() => setActiveWord(null)}
                                >
                                    {c.name}
                                </span>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bottom table & Co-occurrence */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, alignItems: "start" }}>
                {/* Metrics Table */}
                <div className="card card-pad-lg">
                    <div className="sec-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div className="sec-title">Detailed Performance Metrics</div>
                    </div>
                    <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--surface-2)' }}>
                                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--muted)' }}>Topic</th>
                                <th className="num" style={{ textAlign: 'right', padding: '8px 12px', fontSize: '12px', color: 'var(--muted)' }}>Posts</th>
                                <th className="num" style={{ textAlign: 'right', padding: '8px 12px', fontSize: '12px', color: 'var(--muted)' }}>Avg Likes</th>
                                <th className="num" style={{ textAlign: 'right', padding: '8px 12px', fontSize: '12px', color: 'var(--muted)' }}>Avg Comments</th>
                                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '12px', color: 'var(--muted)' }}>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyzedData.tags.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '13px' }}>
                                        No metrics found. Capturing posts will show metrics here.
                                    </td>
                                </tr>
                            ) : (
                                analyzedData.tags.map((t, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-2)', height: '40px' }}>
                                        <td style={{ fontWeight: 600, padding: '8px 12px', fontSize: '13px', color: 'var(--ink)' }}>{t.name}</td>
                                        <td className="num" style={{ textAlign: 'right', padding: '8px 12px', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{t.volume}</td>
                                        <td className="num" style={{ textAlign: 'right', padding: '8px 12px', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{t.avgLikes}</td>
                                        <td className="num" style={{ textAlign: 'right', padding: '8px 12px', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{t.avgComments}</td>
                                        <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                                            <TrendBadge trend={t.trend >= 0 ? "up" : "down"} delta={`${t.trend >= 0 ? '+' : ''}${t.trend}%`} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Co-occurrence Network Map */}
                <div className="card card-pad-lg">
                    <div className="sec-head" style={{ marginBottom: 12 }}>
                        <div className="sec-title">Topic Co-occurrence</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                        <svg viewBox="0 0 300 240" width="100%" height="200" style={{ overflow: 'visible' }}>
                            {nodes.map((n, i) => nodes.slice(i + 1).map((m, j) => {
                                const isConnected = activePair === n.name || activePair === m.name;
                                return (
                                    <line 
                                        key={`${i}-${j}`} 
                                        x1={n.x} 
                                        y1={n.y} 
                                        x2={m.x} 
                                        y2={m.y} 
                                        stroke={isConnected ? "var(--accent)" : "#E2E8F0"} 
                                        strokeWidth={isConnected ? 1.6 : 0.6}
                                        opacity={activePair && !isConnected ? 0.25 : 1}
                                        style={{ transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s' }}
                                    />
                                );
                            }))}
                            {nodes.map((n, i) => {
                                const isActive = activePair === n.name;
                                return (
                                    <g 
                                        key={i} 
                                        onMouseEnter={() => setActivePair(n.name)} 
                                        onMouseLeave={() => setActivePair(null)} 
                                        style={{ cursor: "pointer" }}
                                    >
                                        <circle 
                                            cx={n.x} 
                                            cy={n.y} 
                                            r={isActive ? n.r + 3 : n.r} 
                                            fill={isActive ? "var(--accent)" : (i % 2 ? "#1E293B" : "#8AB7EE")}
                                            style={{ transition: 'r 0.2s, fill 0.2s' }}
                                        />
                                        <text 
                                            x={n.x} 
                                            y={n.y - n.r - 6} 
                                            textAnchor="middle" 
                                            fontSize="9px" 
                                            fontWeight="600" 
                                            fill="var(--ink)"
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            {n.name}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'var(--surface-2)', margin: "8px 0 12px" }} />
                    <div className="col" style={{ gap: 8 }}>
                        {analyzedData.coOccurrences.length === 0 ? (
                            <div style={{ fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center', padding: '10px' }}>
                                No topic combinations detected.
                            </div>
                        ) : (
                            analyzedData.coOccurrences.map((p, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                                    <span className="chip chip-sq" style={{ background: "var(--accent-wash)", color: "var(--accent-deep)", padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{p.a}</span>
                                    <Icon name="link" size={13} color="var(--muted)" />
                                    <span className="chip chip-sq" style={{ background: "var(--surface-2)", color: 'var(--ink)', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{p.b}</span>
                                    <span style={{ marginLeft: 'auto' }} />
                                    <b style={{ fontVariantNumeric: "tabular-nums", color: 'var(--ink)' }}>{p.n}×</b>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopicIntelligence;

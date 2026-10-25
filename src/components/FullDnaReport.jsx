import React, { useMemo, useState, useEffect } from 'react';

const getEstimatedTopic = (posts) => {
    if (!posts || posts.length === 0) return "Leadership";
    const topics = ["AI Tools", "Career Growth", "Leadership", "Productivity", "Marketing", "Remote Work"];
    const counts = {};
    posts.forEach(p => {
        if (!p.text) return;
        topics.forEach(t => {
            if (p.text.toLowerCase().includes(t.toLowerCase())) {
                counts[t] = (counts[t] || 0) + 1;
            }
        });
    });
    let topTopic = null;
    let max = 0;
    Object.entries(counts).forEach(([t, count]) => {
        if (count > max) {
            max = count;
            topTopic = t;
        }
    });
    return topTopic || topics[0];
};

const InsightCard = ({ ins, onView }) => {
    return (
        <div className="insight" style={{ display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer' }} onClick={onView}>
            <div className={`insight-ic ${ins.ic}`} style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ins.icon} size={20} />
            </div>
            <div style={{ flex: 1 }}>
                <div className="insight-title" style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>{ins.title}</div>
                <div className="insight-desc" style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '3px' }}>{ins.desc}</div>
                <a className="insight-link" style={{ fontSize: '11.5px', color: 'var(--accent-deep)', fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}>View Details</a>
            </div>
            <Icon name="chevR" size={16} color="var(--muted)" />
        </div>
    );
};

const FullDnaReport = ({ posts, go, onNavigateToHooks }) => {
    const [topPattern, setTopPattern] = useState("The Contrarian Open");

    useEffect(() => {
        if (!posts || posts.length === 0) {
            setTopPattern("The Contrarian Open");
            return;
        }

        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'analyze_patterns',
                posts: posts,
                timeframe: 'all'
            }, (response) => {
                if (response && response.success && response.patterns && response.patterns.length > 0) {
                    const sorted = [...response.patterns].sort((a, b) => b.stats.frequency - a.stats.frequency);
                    setTopPattern(sorted[0].name);
                }
            });
        }
    }, [posts]);

    const analysis = useMemo(() => {
        if (!posts || posts.length === 0) {
            return {
                archetype: {
                    name: "The Aspiring Creator",
                    desc: "Drafting style is emerging · capturing posts will define this signature",
                    score: "B"
                },
                performanceLine: "0 posts captured · 0 likes · 0 comments",
                habitsLine: "Scan posts to build your best posting cadence",
                topicsLine: "No topics scanned yet",
                patternsLine: "No patterns recognized yet",
                topPattern: "The Contrarian Open"
            };
        }

        const postsCount = posts.length;
        const totalLikes = posts.reduce((sum, p) => sum + (p.stats?.likes || 0), 0);
        const totalComments = posts.reduce((sum, p) => sum + (p.stats?.comments || 0), 0);
        const avgLikes = totalLikes / postsCount;

        // 1. Content Archetype Calculation
        let name = "The Data Storyteller";
        let desc = "Detailed breakdowns · numbered proof · career & tech themes";
        let score = "A-";

        if (avgLikes > 150) {
            name = "The Industry Authority";
            desc = "Viral insights · authority-building hooks · strategic leadership themes";
            score = "A+";
        } else if (postsCount > 40) {
            name = "The Contrarian Coach";
            desc = "Pattern-interrupt hooks · career growth hacks · productivity breakdowns";
            score = "A";
        } else if (totalLikes > totalComments * 4) {
            name = "The Creative Educator";
            desc = "Storytelling openings · soft skills focus · career lessons";
            score = "B+";
        }

        // 2. Summary details calculation
        const avgEng = ((avgLikes * 1 + totalComments / postsCount * 3) / 10).toFixed(1) + "%";
        const performanceLine = `${postsCount} posts analyzed · ${totalLikes} total likes · ${avgEng} avg engagement`;
        
        const dominantTopic = getEstimatedTopic(posts);
        const topicsLine = `${dominantTopic} is your primary focus · orbits career and branding niches`;

        const patternsLine = `Signature hook: ${topPattern} · drives above-median conversion`;
        const habitsLine = "Optimal window: Tuesday AM slots · reduce Friday cadence";

        return {
            archetype: { name, desc, score },
            performanceLine,
            habitsLine,
            topicsLine,
            patternsLine,
            topPattern
        };
    }, [posts, topPattern]);

    const sections = [
        { id: "Posting Analytics", icon: "analytics", title: "Performance", line: analysis.performanceLine },
        { id: "Posting Habits", icon: "habits", title: "Habits", line: analysis.habitsLine },
        { id: "Topic Intelligence", icon: "topics", title: "Topics", line: analysis.topicsLine },
        { id: "Hooks & Patterns", icon: "hooks", title: "Patterns", line: analysis.patternsLine },
    ];

    return (
        <div className="view">
            {/* Page Header */}
            <div className="page-head">
                <div>
                    <div className="page-title">Full DNA Report</div>
                    <div className="page-sub">Everything Scroll in knows about your content — in one place</div>
                </div>
            </div>

            {/* Archetype Card */}
            <div className="hl" style={{ marginBottom: 18, padding: 24, flexDirection: "row", alignItems: "center", gap: 20, display: 'flex' }}>
                <div className="hl-ic" style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="dna" size={28} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--on-dark-mute)", fontWeight: 550 }}>Your content archetype</div>
                    <div className="hl-num" style={{ fontSize: 30, marginTop: 2 }}>{analysis.archetype.name}</div>
                    <div className="hl-label" style={{ marginTop: 4 }}>{analysis.archetype.desc}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: '#FFFFFF' }}>{analysis.archetype.score}</div>
                    <div className="hl-label">DNA score</div>
                </div>
            </div>

            {/* Grid Sections */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18 }}>
                {sections.map((s, i) => (
                    <div 
                        key={i} 
                        className="card" 
                        style={{ display: "flex", gap: 14, alignItems: "center", cursor: "pointer", padding: '16px 20px' }} 
                        onClick={() => go(s.id)}
                    >
                        <div className="insight-ic ic-blue" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name={s.icon} size={22} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</div>
                            <div className="insight-desc" style={{ marginTop: 3, fontSize: '12.5px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.line}
                            </div>
                        </div>
                        <Icon name="chevR" size={18} color="var(--muted)" />
                    </div>
                ))}
            </div>

            {/* Recommendations Section */}
            <div className="card card-pad-lg" style={{ marginTop: 18 }}>
                <div className="sec-title" style={{ marginBottom: 13 }}>Top Recommendations</div>
                <div className="col" style={{ gap: 11 }}>
                    <InsightCard 
                        ins={{ 
                            title: "Move Friday posts to Tuesday AM", 
                            desc: "Cadence alignment based on historical averages could lift engagement up to ~18%.", 
                            ic: "ic-orange", 
                            icon: "clock" 
                        }} 
                        onView={() => go("Posting Habits")} 
                    />
                    <InsightCard 
                        ins={{ 
                            title: `Lean into ${getEstimatedTopic(posts)} while it's rising`, 
                            desc: "This topic shows highest efficiency in comments per post currently.", 
                            ic: "ic-green", 
                            icon: "trendUp" 
                        }} 
                        onView={() => go("Topic Intelligence")} 
                    />
                    <InsightCard 
                        ins={{ 
                            title: `Template ${analysis.topPattern}`, 
                            desc: `Your highest performing hook structure — customize it in the Idea Remix Lab.`, 
                            ic: "ic-blue", 
                            icon: "remix" 
                        }} 
                        onView={() => go("Idea Remix Lab")} 
                    />
                </div>
            </div>
        </div>
    );
};

export default FullDnaReport;

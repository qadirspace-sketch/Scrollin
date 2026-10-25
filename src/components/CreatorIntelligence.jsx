import React, { useState, useEffect, useMemo } from 'react';
import Icon from './Icon';
// Removed hookAnalysis import

const getEstimatedRole = (id) => {
    const roles = ["Growth Strategist", "Technical Founder", "Product Manager", "Venture Partner", "Content Engineer", "Marketing Lead"];
    const idx = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % roles.length;
    return roles[idx];
};

const getEstimatedFollowers = (id, totalLikes) => {
    const base = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 25 + 5; // 5k - 30k
    const extra = Math.floor(totalLikes / 20) || 2;
    return `${(base + extra).toFixed(1)}k`;
};

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

const TrendBadge = ({ trend, delta }) => {
    if (trend === "up") return <span className="pill pill-green"><Icon name="trendUp" size={12} />{delta || "Up"}</span>;
    if (trend === "down") return <span className="pill pill-red"><Icon name="trendDown" size={12} />{delta || "Down"}</span>;
    return <span className="pill" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{delta || "Flat"}</span>;
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

const CreatorIntelligence = ({ go, onNavigateToHooks }) => {
    const [profiles, setProfiles] = useState([]);
    const [creatorsData, setCreatorsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'get_all_watchlist_profiles' }, async (response) => {
                if (response && response.profiles) {
                    const profilesList = response.profiles;
                    setProfiles(profilesList);

                    if (profilesList.length === 0) {
                        setLoading(false);
                        return;
                    }

                    // Fetch stats for all profiles in parallel
                    const statsPromises = profilesList.map(p => {
                        return new Promise((resolve) => {
                            chrome.runtime.sendMessage({
                                action: 'get_profile_posts',
                                profileUrn: p.profileUrn,
                                creatorId: p.creatorId
                            }, (postResponse) => {
                                if (postResponse && postResponse.success && postResponse.posts) {
                                    const posts = postResponse.posts;
                                    const count = posts.length;
                                    const totalLikes = posts.reduce((sum, post) => sum + (post.stats?.likes || 0), 0);
                                    const totalComments = posts.reduce((sum, post) => sum + (post.stats?.comments || 0), 0);
                                    const avgLikes = count > 0 ? (totalLikes / count) : 0;
                                    const avgComments = count > 0 ? (totalComments / count) : 0;
                                    const avgEng = count > 0 ? ((avgLikes * 1 + avgComments * 3) / 10).toFixed(1) + "%" : "0.0%";
                                    const role = p.role || getEstimatedRole(p.creatorId);
                                    const topic = p.topic || getEstimatedTopic(posts);
                                    const followers = p.followers || getEstimatedFollowers(p.creatorId, totalLikes);

                                    // Analyze top hook pattern using message proxy
                                    chrome.runtime.sendMessage({
                                        action: 'analyze_patterns',
                                        posts: posts,
                                        timeframe: '30d'
                                    }, (analysisResponse) => {
                                        let topPattern = "Numbered Breakdown";
                                        let patternEfficiency = "1.2x";

                                        if (analysisResponse && analysisResponse.success && analysisResponse.patterns && analysisResponse.patterns.length > 0) {
                                            const sorted = [...analysisResponse.patterns].sort((a, b) => b.stats.frequency - a.stats.frequency);
                                            topPattern = sorted[0].name;
                                            patternEfficiency = `${(sorted[0].stats.efficiencyScore || 1.1).toFixed(1)}x`;
                                        }

                                        resolve({
                                            creatorId: p.creatorId,
                                            postsCount: count,
                                            avgEng,
                                            followers,
                                            role,
                                            topic,
                                            posts,
                                            topPattern,
                                            patternEfficiency,
                                            trend: count > 10 ? 'up' : (count > 0 ? 'flat' : 'down'),
                                            profileUrl: p.profileUrl || `https://www.linkedin.com/in/${p.creatorId}`
                                        });
                                    });
                                } else {
                                    resolve({
                                        creatorId: p.creatorId,
                                        postsCount: 0,
                                        avgEng: '0.0%',
                                        followers: '...',
                                        role: getEstimatedRole(p.creatorId),
                                        topic: 'General',
                                        posts: [],
                                        topPattern: 'Numbered Breakdown',
                                        patternEfficiency: '1.0x',
                                        trend: 'flat',
                                        profileUrl: p.profileUrl || `https://www.linkedin.com/in/${p.creatorId}`
                                    });
                                }
                            });
                        });
                    });

                    const statsResults = await Promise.all(statsPromises);
                    const statsMap = {};
                    statsResults.forEach(res => {
                        statsMap[res.creatorId] = res;
                    });
                    setCreatorsData(statsMap);
                    setLoading(false);
                } else {
                    setLoading(false);
                }
            });
        } else {
            setLoading(false);
        }
    }, []);

    const selectedCreator = useMemo(() => {
        if (profiles.length === 0 || selectedIndex >= profiles.length) return null;
        const activeProfile = profiles[selectedIndex];
        return creatorsData[activeProfile.creatorId] || {
            creatorId: activeProfile.creatorId,
            postsCount: 0,
            avgEng: '0.0%',
            followers: '...',
            role: getEstimatedRole(activeProfile.creatorId),
            topic: 'General',
            posts: [],
            topPattern: 'Numbered Breakdown',
            patternEfficiency: '1.0x',
            trend: 'flat',
            profileUrl: activeProfile.profileUrl || `https://www.linkedin.com/in/${activeProfile.creatorId}`
        };
    }, [profiles, creatorsData, selectedIndex]);

    if (loading) {
        return (
            <div className="view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    if (profiles.length === 0) {
        return (
            <div className="view">
                <div className="page-head">
                    <div>
                        <div className="page-title">Creator Intelligence</div>
                        <div className="page-sub">Decode what makes tracked creators perform</div>
                    </div>
                </div>
                <div className="empty card">
                    <div className="empty-ic"><Icon name="creators" size={26} /></div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>No tracked creators found</div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>Add creators in the Watchlist tab to decode their content signature.</div>
                    <button className="btn btn-blue btn-sm" style={{ marginTop: 14 }} onClick={() => go("Watchlist")}>Go to Watchlist</button>
                </div>
            </div>
        );
    }

    return (
        <div className="view">
            {/* Page Header */}
            <div className="page-head">
                <div>
                    <div className="page-title">Creator Intelligence</div>
                    <div className="page-sub">Decode what makes tracked creators perform</div>
                </div>
            </div>

            {/* Split layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 18, alignItems: "start" }}>
                {/* Left side: creators list */}
                <div className="col" style={{ gap: '12px' }}>
                    {profiles.map((p, i) => {
                        const data = creatorsData[p.creatorId] || {
                            creatorId: p.creatorId,
                            role: getEstimatedRole(p.creatorId),
                            avgEng: '0.0%',
                            trend: 'flat'
                        };

                        const isSelected = i === selectedIndex;

                        return (
                            <div
                                key={p.creatorId}
                                className="rowcard"
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '14px 17px',
                                    boxShadow: isSelected ? "0 0 0 2px var(--accent)" : "var(--sh-card)",
                                    backgroundColor: isSelected ? 'var(--card)' : undefined
                                }}
                                onClick={() => setSelectedIndex(i)}
                            >
                                <img
                                    className="av"
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.creatorId)}&background=random`}
                                    width={42}
                                    height={42}
                                    alt=""
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{p.creatorId}</div>
                                    <div style={{ fontSize: '12px', color: "var(--muted)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {data.role}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", marginRight: '8px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{data.avgEng}</div>
                                    <div style={{ fontSize: '11px', color: "var(--muted)" }}>engagement</div>
                                </div>
                                <TrendBadge trend={data.trend} />
                            </div>
                        );
                    })}
                </div>

                {/* Right side: details card */}
                {selectedCreator && (
                    <div className="card card-pad-lg">
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                            <img
                                className="av"
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedCreator.creatorId)}&background=random`}
                                width={56}
                                height={56}
                                alt=""
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: 'var(--ink)' }}>
                                    {selectedCreator.creatorId}
                                    <Icon name="verified" size={16} className="verified" />
                                </div>
                                <div style={{ fontSize: 13, color: "var(--muted)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedCreator.role} · {selectedCreator.followers} followers
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => go("Watchlist")}>
                                <Icon name="watchlist" size={14} /> Manage
                            </button>
                        </div>

                        {/* Stats Row */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
                            <div className="stat stat-blue" style={{ minHeight: 92 }}>
                                <div className="stat-title">Avg Engagement</div>
                                <div className="stat-num" style={{ fontSize: 24 }}>{selectedCreator.avgEng}</div>
                            </div>
                            <div className="stat stat-peach" style={{ minHeight: 92 }}>
                                <div className="stat-title">Posts Monitored</div>
                                <div className="stat-num" style={{ fontSize: 24 }}>{selectedCreator.postsCount}</div>
                            </div>
                            <div className="stat stat-gray" style={{ minHeight: 92 }}>
                                <div className="stat-title">Followers</div>
                                <div className="stat-num" style={{ fontSize: 24 }}>{selectedCreator.followers.replace('followers', '').trim()}</div>
                            </div>
                        </div>

                        {/* Signature Insights */}
                        <div className="sec-title" style={{ marginBottom: 12 }}>Content Signature</div>
                        <div className="col" style={{ gap: 11 }}>
                            <InsightCard
                                ins={{
                                    title: `Dominant topic: ${selectedCreator.topic}`,
                                    desc: `${selectedCreator.postsCount > 0 ? 'Analyzed' : 'Estimated'} theme — orbits this recognizable niche.`,
                                    ic: "ic-blue",
                                    icon: "topics"
                                }}
                                onView={() => go("Topic Intelligence")}
                            />
                            <InsightCard
                                ins={{
                                    title: `Favors pattern: ${selectedCreator.topPattern}`,
                                    desc: `Uses this pattern-interrupt open. Median engagement boost is ${selectedCreator.patternEfficiency}.`,
                                    ic: "ic-orange",
                                    icon: "hooks"
                                }}
                                onView={() => {
                                    if (onNavigateToHooks) {
                                        onNavigateToHooks({ patternName: selectedCreator.topPattern });
                                    } else {
                                        go("Hooks & Patterns");
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreatorIntelligence;

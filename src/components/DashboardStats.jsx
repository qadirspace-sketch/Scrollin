import React, { useMemo, useState, useEffect } from 'react';
import { extractTimeFromUrn } from '../utils/timeUtils';
import { applyRuleBasedTags } from '../utils/taggingService';
import Icon from './Icon';

const InfoTooltip = ({ text, onClose }) => (
    <div className="chart-tip" style={{
        position: 'absolute',
        top: '-10px',
        right: '10px',
        transform: 'translate(0, -100%)',
        backgroundColor: 'var(--dark)',
        color: '#FFFFFF',
        padding: '12px',
        borderRadius: '9px',
        fontSize: '12px',
        zIndex: 50,
        boxShadow: 'var(--sh-lg)',
        lineHeight: '1.4',
        pointerEvents: 'auto'
    }}>
        {text}
        <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <span
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{ cursor: 'pointer', fontWeight: '700', color: 'var(--accent)' }}
            >
                Got it
            </span>
        </div>
    </div>
);

const DashboardStats = ({ posts = [], onViewViral, activeFilter = 'ALL', onClearFilter, onNavigateToTab }) => {
    const [activeInfo, setActiveInfo] = useState(null);
    const [viralTimeframe, setViralTimeframe] = useState('7d'); // '30d' | '7d'
    const isViralActive = activeFilter.startsWith('VIRAL');

    const toggleInfo = (e, card) => {
        e.stopPropagation();
        setActiveInfo(activeInfo === card ? null : card);
    };

    const [viralCount, setViralCount] = useState(0);
    const [loadingViral, setLoadingViral] = useState(false);

    useEffect(() => {
        if (!posts || posts.length === 0) {
            setViralCount(0);
            return;
        }

        setLoadingViral(true);
        const days = viralTimeframe === '7d' ? 7 : 30;

        const preparedPosts = posts.map(post => {
            const likes = parseInt(post.stats?.likes || 0);
            const comments = parseInt(post.stats?.comments || 0);
            const reposts = parseInt(post.stats?.reposts || 0);
            const views = parseInt(post.stats?.views || (likes * 20));

            let createdAt = 0;
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) createdAt = date.getTime();
            }

            return {
                id: post.urn || Math.random().toString(),
                likes,
                comments,
                reposts,
                createdAt,
                views
            };
        });

        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'calculate_viral_posts',
                posts: preparedPosts,
                days
            }, (response) => {
                setLoadingViral(false);
                if (response && response.success && response.posts) {
                    const viralPostsFull = response.posts.filter(p => p.viralLabel === 'Highly Viral' || p.viralLabel === 'Viral');
                    setViralCount(viralPostsFull.length);
                } else {
                    setViralCount(0);
                }
            });
        } else {
            setLoadingViral(false);
            setViralCount(0);
        }
    }, [posts, viralTimeframe]);

    // Derived Analytics Logic
    const stats = useMemo(() => {
        let totalReach = 0;
        let totalEngagement = 0;
        let engagementRateSum = 0;
        const tagCounts = {};

        // 1. Prepare posts for general stats
        const preparedPosts = posts.map(post => {
            const likes = parseInt(post.stats?.likes || 0);
            const comments = parseInt(post.stats?.comments || 0);
            const reposts = parseInt(post.stats?.reposts || 0);
            const views = parseInt(post.stats?.views || (likes * 20));

            let createdAt = 0;
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) createdAt = date.getTime();
            }

            return {
                ...post,
                id: post.urn || Math.random().toString(),
                likes,
                comments,
                reposts,
                createdAt,
                views
            };
        });

        preparedPosts.forEach(post => {
            const engagement = post.likes + post.comments + post.reposts;
            totalReach += post.views;
            totalEngagement += engagement;

            const er = post.views > 0 ? (engagement / post.views) * 100 : 0;
            engagementRateSum += er;

            // Tag Logic using true categories
            if (post.text) {
                const postAgeDays = (Date.now() - post.createdAt) / (1000 * 60 * 60 * 24);
                if (postAgeDays <= 7) {
                    const matchedTag = applyRuleBasedTags(post.text).primaryTag || 'General';
                    tagCounts[matchedTag] = (tagCounts[matchedTag] || 0) + 1;
                }
            }
        });

        const avgEngagementRate = posts.length > 0 ? (engagementRateSum / posts.length).toFixed(1) : '0';

        // Find top topic dynamically
        let topTopics = [];
        if (Object.keys(tagCounts).length === 0) {
            topTopics = posts.length > 0 ? ['General Profile'] : ['No Data'];
        } else {
            let maxCount = 0;
            Object.entries(tagCounts).forEach(([tag, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    topTopics = [tag];
                } else if (count === maxCount) {
                    topTopics.push(tag);
                }
            });
        }

        return {
            reach: totalReach > 1000000 ? (totalReach / 1000000).toFixed(1) + 'M' : (totalReach / 1000).toFixed(1) + 'K',
            avgEr: avgEngagementRate + '%',
            topTopic: topTopics[0] || 'General',
            topTopics: topTopics,
        };
    }, [posts]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: '18px', marginBottom: '22px' }}>
            {/* Left Hand Grid: 3 Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
                
                {/* Card 1: Avg Engagement */}
                <div className="stat stat-peach" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="stat-title">Avg Engagement</div>
                            <div className="stat-sub">per post · 7D</div>
                        </div>
                        <button onClick={(e) => toggleInfo(e, 'er')} style={{ cursor: 'pointer' }} title="Info">
                            <Icon name="eye" size={14} color="var(--ink-2)" />
                        </button>
                    </div>
                    {activeInfo === 'er' && <InfoTooltip text="Average interaction rate (Likes + Comments + Reposts) relative to views." onClose={() => setActiveInfo(null)} />}

                    <div className="stat-num">{stats.avgEr}</div>

                    <div className="stat-delta delta-up">
                        <Icon name="trendUp" size={12} /> +0.6%
                    </div>

                    <button 
                        className="stat-go" 
                        onClick={() => onNavigateToTab && onNavigateToTab('Posting Analytics')}
                        aria-label="Open details"
                    >
                        <Icon name="arrowUR" size={16} color="#FFFFFF" />
                    </button>
                </div>

                {/* Card 2: Top Topic */}
                <div className="stat stat-blue" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="stat-title">Top Topic 7D</div>
                            <div className="stat-sub">by reach</div>
                        </div>
                        <button onClick={(e) => toggleInfo(e, 'topic')} style={{ cursor: 'pointer' }} title="Info">
                            <Icon name="eye" size={14} color="var(--ink-2)" />
                        </button>
                    </div>
                    {activeInfo === 'topic' && <InfoTooltip text="The most frequent subject or theme identified across your recent posts." onClose={() => setActiveInfo(null)} />}

                    <div className="stat-num" style={{ fontSize: stats.topTopic.length > 10 ? '22px' : '28px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={stats.topTopic}>
                        {stats.topTopic}
                    </div>

                    <div className="stat-delta delta-up" style={{ background: 'rgba(110, 159, 222, 0.15)', color: 'var(--accent-deep)' }}>
                        <Icon name="trendUp" size={12} /> Stable
                    </div>

                    <button 
                        className="stat-go" 
                        onClick={() => onNavigateToTab && onNavigateToTab('Topic Intelligence')}
                        aria-label="Open details"
                    >
                        <Icon name="arrowUR" size={16} color="#FFFFFF" />
                    </button>
                </div>

                {/* Card 3: Viral Posts (With Active Controls) */}
                <div className="stat stat-mint" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => {
                    if (isViralActive) {
                        if (onClearFilter) onClearFilter();
                    } else {
                        onViewViral(viralTimeframe);
                    }
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Viral Posts
                                <span className={`switch-track ${isViralActive ? 'on' : ''}`} style={{ width: '24px', height: '14px', transform: 'scale(0.85)', cursor: 'pointer' }}>
                                    <span className="switch-knob" style={{ width: '10px', height: '10px' }} />
                                </span>
                            </div>
                            
                            {isViralActive ? (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }} onClick={(e) => e.stopPropagation()}>
                                    <span 
                                        onClick={() => { setViralTimeframe('7d'); onViewViral('7d'); }}
                                        style={{ fontSize: '10px', color: viralTimeframe === '7d' ? 'var(--accent-deep)' : 'var(--muted)', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        7D
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>|</span>
                                    <span 
                                        onClick={() => { setViralTimeframe('30d'); onViewViral('30d'); }}
                                        style={{ fontSize: '10px', color: viralTimeframe === '30d' ? 'var(--accent-deep)' : 'var(--muted)', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        30D
                                    </span>
                                </div>
                            ) : (
                                <div className="stat-sub">10k+ impressions</div>
                            )}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleInfo(e, 'viral'); }} style={{ cursor: 'pointer' }} title="Info">
                            <Icon name="eye" size={14} color="var(--ink-2)" />
                        </button>
                    </div>
                    {activeInfo === 'viral' && <InfoTooltip text={`Posts performing significantly above average in the last ${viralTimeframe === '30d' ? '30' : '7'} days.`} onClose={() => setActiveInfo(null)} />}

                    <div className="stat-num">{loadingViral ? '...' : viralCount}</div>

                    <div className="stat-delta delta-up">
                        <Icon name="trendUp" size={12} /> {viralTimeframe === '7d' ? '+1' : '+3'}
                    </div>

                    <button 
                        className="stat-go" 
                        onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToTab && onNavigateToTab('Hooks & Patterns');
                        }}
                        aria-label="Open details"
                    >
                        <Icon name="arrowUR" size={16} color="#FFFFFF" />
                    </button>
                </div>

            </div>

            {/* Right Hand Side: Highlight Card */}
            <div style={{ position: 'relative' }}>
                {/* Background wash shadow shape */}
                <div style={{ position: 'absolute', inset: '10px -6px -10px 14px', background: 'var(--accent-fill)', borderRadius: 'var(--r-card)', opacity: 0.6 }} />
                
                <div style={{ position: 'relative', height: '100%' }}>
                    <div className="hl">
                        <div className="hl-ic">
                            <Icon name="bolt" size={20} color="#FFFFFF" />
                        </div>
                        <div style={{ marginTop: 'auto' }}>
                            <div className="hl-num">{stats.reach}</div>
                            <div className="hl-label">Total impressions · last 30 days</div>
                        </div>
                        <div className="hl-foot">
                            <span className="pill" style={{ background: 'rgba(138,183,238,0.22)', color: '#CFDEFB' }}>
                                <Icon name="trendUp" size={12} color="#CFDEFB" /> +28% MoM
                            </span>
                            <button 
                                className="btn btn-sm" 
                                style={{ background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', marginLeft: 'auto', outline: 'none' }} 
                                onClick={() => onNavigateToTab && onNavigateToTab('Posting Analytics')}
                            >
                                Open analytics
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardStats;

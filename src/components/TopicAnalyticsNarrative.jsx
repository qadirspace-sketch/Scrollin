import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Share2, Download, Info, Zap, TrendingUp, TrendingDown, Youtube, Globe, PenTool, Layout, Box, ChevronDown, Calendar } from 'lucide-react';
import { getTagsForPost } from '../utils/taggingService';
import { extractTimeFromUrn } from '../utils/timeUtils';
import PostList from './PostList'; // Re-using the main feed list for consistent style
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { generateExecutiveSummary } from '../services/geminiService';
import { prepareTopicDataForAI } from '../utils/aiDataAggregator';
import { WordCloud as ReactWordcloud } from '@isoterik/react-word-cloud';

const WordCloud = React.memo(({ tags, onTagClick }) => {
    if (!tags || tags.length === 0) return <div style={{ padding: '40px', textAlign: 'center', color: '#DDD4C8' }}>Not enough data for word cloud</div>;

    // Memoize words deeply by converting tags array to a string dependency
    // This prevents re-renders even if the parent passes a new tags array reference with identical content
    const wordsDependency = tags.map(t => `${t.name}-${t.volume}`).join('|');

    // Memoize words mapping for react-wordcloud
    const words = useMemo(() => {
        return tags.map(tag => ({
            text: tag.name,
            value: tag.volume,
            ...tag // Pass original tag data for click handler
        }));
    }, [wordsDependency]);

    const maxVal = Math.max(1, ...tags.map(t => t.volume));
    const minVal = Math.min(1, ...tags.map(t => t.volume));

    const getFontSize = useMemo(() => {
        const minSqrt = Math.sqrt(minVal);
        const maxSqrt = Math.sqrt(maxVal);
        return (word) => {
            const valSqrt = Math.sqrt(word.value);
            if (maxSqrt === minSqrt) return 45; // reduced from 55
            return 16 + ((valSqrt - minSqrt) / (maxSqrt - minSqrt)) * 50; // reduced min from 20 to 16, range from 70 to 50
        };
    }, [minVal, maxVal]);

    const colors = ['var(--accent-deep)', 'var(--orange)', 'var(--green)', 'var(--red)', 'var(--ink-2)'];
    const getFill = (word, index) => colors[index % colors.length];

    return (
        <div style={{
            height: '400px',
            width: '100%',
            position: 'relative',
            backgroundColor: 'var(--card)',
            borderRadius: 'var(--r-card)',
            overflow: 'hidden',
            border: '1px solid var(--surface-2)',
            boxShadow: 'var(--sh-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <style>
                {`
                    .word-cloud-container text {
                        cursor: pointer !important;
                        transition: transform 0.2s ease, opacity 0.2s ease !important;
                        transform-origin: center;
                    }
                    .word-cloud-container text:hover {
                        opacity: 0.8;
                    }
                    /* Optional overrides for d3-cloud if it adds bounds */
                    .word-cloud-container svg {
                        margin: 0 auto;
                        overflow: visible !important;
                    }
                `}
            </style>
            <div className="word-cloud-container" style={{
                width: '100%',
                height: '380px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '24px',
                padding: '10px 40px',
            }}>
                <ReactWordcloud
                    words={words}
                    width={800}
                    height={360}
                    padding={4}
                    spiral="rectangular"
                    font="'Inter', sans-serif"
                    fontWeight="bold"
                    fontSize={getFontSize}
                    rotate={() => 0}
                    fill={getFill}
                    transition="none"
                    enableTooltip={true}
                    onWordClick={(word) => onTagClick(word)}
                    svgProps={{ style: { overflow: 'visible' } }}
                />
            </div>
        </div>
    );
});

const TopicAnalyticsNarrative = ({ posts, isOpen, onClose, profileId }) => {
    const [analyzedData, setAnalyzedData] = useState({ tags: [], metadata: {} });
    const [isCalculating, setIsCalculating] = useState(false);
    const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, all
    const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);
    const [contentFilter, setContentFilter] = useState('my_content'); // my_content, all_content
    const [activeTab, setActiveTab] = useState('Word Cloud');
    const [selectedTopic, setSelectedTopic] = useState(null); // New state for drill-down
    const [sortBy, setSortBy] = useState('engagement'); // engagement, volume
    const [showAllMetrics, setShowAllMetrics] = useState(false);

    // AI State
    const [aiSummaries, setAiSummaries] = useState({});

    // Load profile-specific AI summaries
    useEffect(() => {
        if (!profileId) return;
        try {
            const cached = localStorage.getItem(`kleo_topic_ai_summaries_${profileId}`);
            setAiSummaries(cached ? JSON.parse(cached) : {});
        } catch (e) {
            setAiSummaries({});
        }
    }, [profileId]); // { '7d': ..., '30d': ... }
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);

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
                    data.coOccurrences,
                    data.totalPosts,
                    range,
                    data.insights
                );
            }

            console.log("Generating AI for ranges:", Object.keys(payloads));

            const multiSummary = await generateExecutiveSummary(payloads);

            if (multiSummary) {
                setAiSummaries(multiSummary);
                try {
                    localStorage.setItem(`kleo_topic_ai_summaries_${profileId}`, JSON.stringify(multiSummary));
                } catch (e) {
                    console.error("Failed to save AI summaries to local storage", e);
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
            const date = extractTimeFromUrn(post.urn);
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
        }

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
            .map(([pair, count]) => ({ pair, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const globalAvgEng = formattedTags.reduce((sum, t) => sum + t.avgEngagement, 0) / (formattedTags.length || 1);

        const growing = formattedTags
            .filter(t => t.volume >= 2 && t.avgEngagement >= globalAvgEng)
            .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

        const declining = formattedTags
            .filter(t => t.volume >= 2 && t.avgEngagement < globalAvgEng)
            .sort((a, b) => a.avgEngagement - b.avgEngagement)[0];

        const opportunity = formattedTags
            .filter(t => t.volume > 0 && t.volume <= 5 && t.avgEngagement > globalAvgEng * 1.1)
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

            const sortedTags = [...data.tags].sort((a, b) => {
                if (sortBy === 'volume') return b.volume - a.volume;
                return b.avgEngagement - a.avgEngagement;
            });

            setAnalyzedData({ ...data, tags: sortedTags });
            setIsCalculating(false);
        };

        processData();
    }, [posts, timeRange, contentFilter, sortBy]);

    const MetricCard = ({ title, topic, subtext, type }) => {
        let cardClass = 'stat-gray';
        
        if (type === 'positive') {
            cardClass = 'stat-mint';
        } else if (type === 'negative') {
            cardClass = ''; 
        } else if (type === 'neutral') {
            cardClass = 'stat-peach';
        }

        const containerStyle = cardClass 
            ? {} 
            : { backgroundColor: 'var(--red-soft)' };

        return (
            <div 
                className={`stat ${cardClass}`} 
                style={{ 
                    flex: 1, 
                    padding: '20px', 
                    minHeight: 'auto', 
                    borderRadius: 'var(--r-card)', 
                    boxShadow: 'var(--sh-card)',
                    ...containerStyle
                }}
            >
                <div style={{ fontSize: '11px', fontWeight: '700', color: type === 'negative' ? 'var(--red)' : 'var(--ink-2)', opacity: 0.8, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>
                    {title}
                </div>
                <div className="richmond-heading" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--ink)', marginBottom: '6px' }}>
                    {topic}
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--ink-2)' }}>
                    {subtext}
                </div>
            </div>
        );
    };

    const HoverInfo = ({ text, placement = 'top' }) => {
        const [show, setShow] = useState(false);
        return (
            <div
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px', cursor: 'help', verticalAlign: 'middle' }}
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            >
                <Info size={14} color="var(--muted)" />
                {show && (
                    <div style={{
                        position: 'absolute',
                        width: '220px',
                        backgroundColor: 'var(--dark)',
                        color: 'var(--on-dark)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '400',
                        lineHeight: '1.4',
                        zIndex: 1000,
                        textAlign: 'center',
                        boxShadow: 'var(--sh-lg)',
                        textTransform: 'none',
                        pointerEvents: 'none',
                        ...(placement === 'top' ? {
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px'
                        } : {
                            top: '100%',
                            right: '-10px',
                            marginTop: '8px'
                        })
                    }}>
                        {text}
                        <div style={{
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            ...(placement === 'top' ? {
                                top: '100%',
                                left: '50%',
                                marginLeft: '-6px',
                                borderTop: '6px solid var(--dark)'
                            } : {
                                bottom: '100%',
                                right: '15px',
                                borderBottom: '6px solid var(--dark)'
                            })
                        }}></div>
                    </div>
                )}
            </div>
        );
    };

    const NetworkViz = ({ coOccurrences }) => {
        return (
            <div style={{
                height: '300px',
                backgroundColor: 'var(--surface)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid var(--surface-2)'
            }}>
                <div style={{ position: 'relative', zIndex: 10 }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#FFFFFF',
                        border: '2.5px solid var(--accent-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'var(--sh-md)',
                        fontSize: '11px', fontWeight: '700', color: 'var(--accent-deep)', textAlign: 'center'
                    }}>
                        Network<br />Visualization
                    </div>
                </div>
                {[0, 72, 144, 216, 288].map((deg, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--card)',
                        transform: `rotate(${deg}deg) translate(80px) rotate(-${deg}deg)`,
                        border: '1px solid var(--surface-2)'
                    }} />
                ))}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <line x1="50%" y1="50%" x2="calc(50% + 80px)" y2="50%" stroke="var(--muted-2)" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="50%" y1="50%" x2="calc(50% - 64px)" y2="calc(50% - 48px)" stroke="var(--muted-2)" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="50%" y1="50%" x2="calc(50% - 64px)" y2="calc(50% + 48px)" stroke="var(--muted-2)" strokeWidth="1.5" strokeDasharray="4 4" />
                </svg>
                <div style={{ position: 'absolute', bottom: '20px', left: 0, width: '100%', textAlign: 'center', color: 'var(--muted)', fontSize: '11.5px', fontWeight: '500' }}>
                    (Interactive Network Graph)
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px' }}>
            {/* Top Navigation / Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px' }}>
                <div>
                    <h1 className="richmond-heading" style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--ink)' }}>Topic Intelligence</h1>
                    <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--muted)' }}>Analyze the topics and themes powering your LinkedIn content performance.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* SORT Toggle */}
                    <button
                        onClick={() => setSortBy(prev => prev === 'engagement' ? 'volume' : 'engagement')}
                        className="dd-btn"
                        style={{ userSelect: 'none', cursor: 'pointer' }}
                    >
                        Sort by: <span style={{ fontWeight: '700' }}>{sortBy === 'engagement' ? 'Engagement' : 'Volume'}</span>
                        <ChevronDown size={14} color="var(--muted)" />
                    </button>

                    <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--surface-2)' }} />

                    {/* Time Toggle */}
                    <div className="dd">
                        <button
                            className="dd-btn"
                            onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Calendar size={15} color="var(--muted)" />
                            {timeRange === 'all' ? 'All time' : timeRange}
                            <ChevronDown size={14} color="var(--muted)" />
                        </button>
                        {isTimeRangeOpen && (
                            <div className="dd-menu" style={{ right: 0, maxHeight: '300px', overflowY: 'auto' }}>
                                {['7d', '30d', '90d', 'All time'].map(range => {
                                    const valueFormat = range === 'All time' ? 'all' : range;
                                    return (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setTimeRange(valueFormat);
                                                setIsTimeRangeOpen(false);
                                            }}
                                            className={`dd-item ${timeRange === valueFormat ? 'sel' : ''}`}
                                        >
                                            {range}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--surface-2)' }} />

                    {/* My Content Toggle */}
                    <div className="switch" style={{ cursor: 'pointer' }} onClick={() => setContentFilter(prev => prev === 'my_content' ? 'all' : 'my_content')}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>My content only</span>
                        <div className={`switch-track ${contentFilter === 'my_content' ? 'on' : ''}`}>
                            <div className="switch-knob" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Refined Header with AI Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--ink)', margin: 0 }}>Performance Overview</h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '14px' }}>Key trends and opportunities from your recent content.</p>
                </div>

                {!isAiLoading && (
                    <button
                        onClick={handleGenerateAI}
                        disabled={isAiLoading}
                        className="btn btn-blue"
                        style={{ fontSize: '13px', padding: '9px 16px' }}
                    >
                        <Zap size={14} fill={isAiLoading ? "var(--muted-2)" : "currentColor"} />
                        {aiSummaries[timeRange === 'all' ? 'all' : timeRange] ? "Refresh AI Insights" : "Generate AI Insights"}
                    </button>
                )}
            </div>

            {/* AI Error */}
            {aiError && (
                <div className="callout callout-blue" style={{ marginBottom: '24px', border: '1px solid var(--accent)' }}>
                    <Info size={14} color="var(--accent-deep)" />
                    <span style={{ color: 'var(--ink)' }}>{aiError}</span>
                </div>
            )}

            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '24px' }}>
                {/* Dynamic Insight Cards */}
                {(() => {
                    const currentSummary = aiSummaries[timeRange === 'all' ? 'all' : timeRange];

                    return (
                        <>
                            <MetricCard
                                type="positive"
                                title="TOP GROWING TOPIC"
                                topic={analyzedData.insights?.growing?.name || "No Trending Data"}
                                subtext={
                                    isAiLoading ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)' }}> <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderColor: 'var(--green)', borderRightColor: 'transparent' }}></div> Analyzing...</span> :
                                        (currentSummary && currentSummary.growing) ? currentSummary.growing :
                                            "Generate AI insights to see why this topic is growing."
                                }
                            />
                            <MetricCard
                                type="negative"
                                title="DECLINING REACH"
                                topic={analyzedData.insights?.declining?.name || "Stable Performance"}
                                subtext={
                                    isAiLoading ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)' }}> <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderColor: 'var(--red)', borderRightColor: 'transparent' }}></div> Analyzing...</span> :
                                        (currentSummary && currentSummary.declining) ? currentSummary.declining :
                                            "Generate AI insights to see how to fix this decline."
                                }
                            />
                            <MetricCard
                                type="neutral"
                                title="OPPORTUNITY"
                                topic={analyzedData.insights?.opportunity?.name || "Keep Exploring"}
                                subtext={
                                    isAiLoading ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)' }}> <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderColor: 'var(--accent-deep)', borderRightColor: 'transparent' }}></div> Analyzing...</span> :
                                        (currentSummary && currentSummary.opportunity) ? currentSummary.opportunity :
                                            "Generate AI insights to identify new opportunities."
                                }
                            />
                        </>
                    );
                })()}
            </div>

            {/* Topic Universe */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', margin: 0 }}>Topic Universe</h3>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Showing top 15 relevant topics</span>
                </div>

                {isCalculating ? (
                    <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                        Calculating Universe...
                    </div>
                ) : (
                    <WordCloud tags={analyzedData.tags} onTagClick={setSelectedTopic} />
                )}

                {/* Selected Topic Drill-down */}
                {selectedTopic && (
                    <div id="topic-drilldown" className="card" style={{ padding: '24px', marginTop: '32px', border: '1px solid var(--surface-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h3 className="richmond-heading" style={{ fontSize: '18px', fontWeight: '800', color: 'var(--ink)', margin: 0 }}>
                                    Posts about "{selectedTopic.name}"
                                </h3>
                                <span className="pill pill-blue">
                                    {selectedTopic.volume} Posts
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedTopic(null)}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '6px 12px' }}
                            >
                                Close View
                            </button>
                        </div>

                        <div style={{ maxHeight: '600px', overflowY: 'auto', borderRadius: '12px', border: '1px solid var(--surface-2)' }}>
                            <PostList
                                posts={[{ extractedPosts: selectedTopic.posts }]}
                                sortCriteria="newest"
                                contentFilter="all"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Detailed Performance Metrics */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center' }}>
                        Detailed Performance Metrics
                        <HoverInfo text="See which topics you write about most (Volume) versus which ones your audience engages with best (Engagement)." />
                    </h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setShowAllMetrics(!showAllMetrics)}
                            style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            {showAllMetrics ? "Show Less" : "View All"}
                        </button>
                        <button style={{ color: 'var(--accent-deep)', fontSize: '13px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Download size={14} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th style={{ padding: '16px 24px' }}>Topic Name</th>
                                <th>Total Posts</th>
                                <th>Average Likes</th>
                                <th>Average Comments</th>
                                <th style={{ textAlign: 'right', paddingRight: '24px' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        {timeRange === 'all' ? 'All time' : timeRange} Trend
                                        <HoverInfo placement="bottom-left" text="Volume Trend: compares how often you posted about this topic now vs. the previous period. Higher % means you are writing about it more often." />
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {(showAllMetrics ? analyzedData.tags : analyzedData.tags.slice(0, 5)).map((tag, i) => (
                                <tr key={tag.name}>
                                    <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: i === 0 ? 'var(--accent)' : (i === 1 ? 'var(--green)' : 'var(--muted-2)') }} />
                                        <span style={{ fontWeight: '600', color: 'var(--ink)', fontSize: '13.5px' }}>{tag.name}</span>
                                    </td>
                                    <td style={{ color: 'var(--ink)', fontSize: '13.5px', fontWeight: '500' }}>{tag.volume}</td>
                                    <td style={{ color: 'var(--ink)', fontSize: '13.5px', fontWeight: '500' }}>{tag.avgLikes}</td>
                                    <td style={{ color: 'var(--ink)', fontSize: '13.5px', fontWeight: '500' }}>{tag.avgComments}</td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <span 
                                            className={tag.trend >= 0 ? 'pill pill-green' : 'pill pill-red'}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            {tag.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {Math.abs(tag.trend)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {analyzedData.tags.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>No metrics available</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Topic Co-occurrence */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', marginBottom: '16px', marginTop: 0 }}>Topic Co-occurrence & Relationships</h3>

                <div className="card" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1fr', gap: '24px', padding: '24px' }}>
                    {/* Viz Side */}
                    <NetworkViz coOccurrences={analyzedData.coOccurrences} />

                    {/* Stats Side */}
                    <div>
                        <p style={{ marginTop: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--muted)', marginBottom: '24px' }}>
                            Topics that appear together most frequently in your top-performing content. High matches indicate a strong thematic synergy.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {analyzedData.coOccurrences && analyzedData.coOccurrences.length > 0 ? (
                                analyzedData.coOccurrences.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-2)', padding: '12px 16px', borderRadius: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{item.pair}</span>
                                        <span className="pill pill-green">{item.count} Matches</span>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                                    Not enough cross-topic data found yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Deepen Understanding Banner */}
            <div className="callout callout-blue" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ink)', marginBottom: '8px' }}>Deepen your understanding</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--ink-2)', marginBottom: '16px', maxWidth: '400px' }}>
                    Learn how to leverage these topic insights to craft a more effective content strategy on LinkedIn.
                </p>
                <button className="btn btn-ghost btn-sm">
                    Read Analytics Guide
                </button>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--surface-2)', paddingTop: '24px' }}>
                <button className="btn btn-ghost">
                    Print Report
                </button>
                <button className="btn btn-blue">
                    <Download size={16} /> Download PDF Analysis
                </button>
            </div>
        </div>
    );
};

export default TopicAnalyticsNarrative;

import React, { useMemo, useState, useEffect } from 'react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';
import { X, Clock, ArrowLeft, BarChart2, Activity, Calendar, Filter, FileText, Image as ImageIcon, Layers, Video, ThumbsUp, MessageCircle, Share2, Target, ChevronRight, Hash, Info, Repeat, ArrowDownUp, TrendingUp } from 'lucide-react';
import { extractTimeFromUrn } from '../utils/timeUtils';
import { getTagsForPost } from '../utils/taggingService';
import PostItem from './PostItem';
import AnalyticsInfo from './AnalyticsInfo'; // Reusing info or creating new one? We'll skip for now or strip.
import TopicAnalyticsInfo from './TopicAnalyticsInfo';

// Helper for sorting posts in drill-down
function sortPosts(posts, criteria) {
    const getCount = (post, type) => (post?.stats && post.stats[type]) ? post.stats[type] : 0;
    const getCombinedScore = (post) => getCount(post, 'likes') + getCount(post, 'comments') + getCount(post, 'reposts');
    const parseRelativeDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return Infinity;
        const cleanStr = dateStr.replace('•', '').trim().toLowerCase();
        if (cleanStr.includes('now')) return 0;
        const parts = cleanStr.match(/(\d+)\s*([a-z]+)/);
        if (!parts) return Infinity;
        const value = parseInt(parts[1], 10);
        const unit = parts[2];
        let multiplier = 1;
        if (unit.startsWith('m') && !unit.startsWith('mo')) multiplier = 1;
        else if (unit.startsWith('h')) multiplier = 60;
        else if (unit.startsWith('d')) multiplier = 60 * 24;
        else if (unit.startsWith('w')) multiplier = 60 * 24 * 7;
        else if (unit.startsWith('mo')) multiplier = 60 * 24 * 30;
        else if (unit.startsWith('y')) multiplier = 60 * 24 * 365;
        return value * multiplier;
    };

    return [...posts].sort((a, b) => {
        if (!a || !b) return 0;
        switch (criteria) {
            case 'newest':
                const dateA = parseRelativeDate(a.date);
                const dateB = parseRelativeDate(b.date);
                if (dateA !== dateB) return dateA - dateB;
                return (a.urn > b.urn) ? -1 : 1;
            case 'oldest':
                const dateA_old = parseRelativeDate(b.date);
                const dateB_old = parseRelativeDate(a.date);
                if (dateA_old !== dateB_old) return dateB_old - dateA_old;
                return (a.urn > b.urn) ? 1 : -1;
            case 'most_liked': return getCount(b, 'likes') - getCount(a, 'likes');
            case 'least_liked': return getCount(a, 'likes') - getCount(b, 'likes');
            case 'most_commented': return getCount(b, 'comments') - getCount(a, 'comments');
            case 'least_commented': return getCount(a, 'comments') - getCount(b, 'comments');
            case 'most_shared': return getCount(b, 'reposts') - getCount(a, 'reposts');
            case 'least_shared': return getCount(a, 'reposts') - getCount(b, 'reposts');
            case 'combined_score': return getCombinedScore(b) - getCombinedScore(a);
            case 'inverse_combined_score': return getCombinedScore(a) - getCombinedScore(b);
            default: return 0;
        }
    });
}

const TopicAnalytics = ({ posts, isOpen, onClose }) => {
    // Selection state
    const [selectedTag, setSelectedTag] = useState(null);

    // Filter controls
    const [timeRange, setTimeRange] = useState('all'); // 'all', 'month', 'week'
    const [chartType, setChartType] = useState('bar'); // 'bar', 'area', 'line'
    const [metricMode, setMetricMode] = useState('volume'); // 'volume', 'engagement', 'average'
    const [drillDownSort, setDrillDownSort] = useState('newest');
    const [drillDownFilter, setDrillDownFilter] = useState('all');
    const [onlyOwnContent, setOnlyOwnContent] = useState(false); // New Toggle
    const [showInfo, setShowInfo] = useState(false);

    // Stats State
    const [tagData, setTagData] = useState([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [taggedPostsMap, setTaggedPostsMap] = useState({}); // { TagName: [Post1, Post2] }

    // --- 1. Filter Posts by Time Range ---
    const filteredPosts = useMemo(() => {
        if (!posts) return [];
        const now = new Date();

        let filtered = posts;

        // NEW: Filter for own content
        if (onlyOwnContent) {
            filtered = filtered.filter(post => {
                if (!post.isRepost) return true;
                return post.isRepost && post.repostType === 'self';
            });
        }

        return filtered.filter(post => {
            if (!post.urn) return false;
            const date = extractTimeFromUrn(post.urn);
            if (!date) return false;

            if (timeRange === 'week') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return date >= oneWeekAgo;
            }
            if (timeRange === 'month') {
                const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return date >= oneMonthAgo;
            }
            return true; // 'all'
        });
    }, [posts, timeRange, onlyOwnContent]);

    // --- 2. Calculate Tags (Async) ---
    useEffect(() => {
        let isMounted = true;

        const processTags = async () => {
            setIsCalculating(true);
            const counts = {}; // { Tag: { volume: 0, engagement: 0 } }
            const mapping = {}; // { Tag: [posts] }

            // Parallel/Batch processing could be better, but sequential is safer for CPU
            // We use the taggingService which hits cache or rules.
            const promises = filteredPosts.map(async (post) => {
                const tagResult = await getTagsForPost(post.text, post.urn);
                const tag = tagResult.primaryTag || 'Uncategorized';

                return { post, tag };
            });

            const results = await Promise.all(promises);

            results.forEach(({ post, tag }) => {
                if (!counts[tag]) counts[tag] = { volume: 0, engagement: 0 };
                if (!mapping[tag]) mapping[tag] = [];

                const eng = (post.stats?.likes || 0) + (post.stats?.comments || 0) + (post.stats?.reposts || 0);

                counts[tag].volume += 1;
                counts[tag].engagement += eng;
                mapping[tag].push(post);
            });

            if (!isMounted) return;

            // Transform for Recharts
            const chartData = Object.entries(counts).map(([tag, metrics]) => {
                let count = 0;
                if (metricMode === 'volume') count = metrics.volume;
                else if (metricMode === 'engagement') count = metrics.engagement;
                else if (metricMode === 'average') count = metrics.volume > 0 ? Math.round(metrics.engagement / metrics.volume) : 0;

                return {
                    name: tag,
                    count: count,
                    volume: metrics.volume,
                    engagement: metrics.engagement
                };
            });

            // Sort by current metric descending
            chartData.sort((a, b) => b.count - a.count);

            setTagData(chartData);
            setTaggedPostsMap(mapping);
            setIsCalculating(false);
        };

        if (isOpen) {
            processTags();
        }
    }, [filteredPosts, isOpen, metricMode]);

    // --- 3. Drill Down Logic ---
    const handleChartClick = (entry) => {
        if (entry && entry.name) {
            setSelectedTag(entry.name);
            setDrillDownFilter('all'); // Reset filter on new tag selection
            setDrillDownSort('newest');
        }
    };

    const finalDisplayPosts = useMemo(() => {
        if (!selectedTag || !taggedPostsMap[selectedTag]) return [];

        let postsToDisplay = taggedPostsMap[selectedTag];

        // Apply Content Filter
        if (drillDownFilter !== 'all') {
            postsToDisplay = postsToDisplay.filter(post => {
                const mediaItems = Array.isArray(post.media) ? post.media : (post.media ? [post.media] : []);
                const hasMedia = mediaItems.length > 0;

                switch (drillDownFilter) {
                    case 'text_only': return !hasMedia;
                    case 'with_images': return hasMedia && mediaItems.some(m => m.type === 'image' && !m.isCarousel);
                    case 'with_carousel': return hasMedia && mediaItems.some(m => m.type === 'carousel' || m.isCarousel);
                    case 'with_videos': return hasMedia && mediaItems.some(m => m.type === 'video');
                    case 'reposts_only': return post.isRepost;
                    case 'own_content':
                        // Show original posts AND self-reposts. Hide reposts of others.
                        if (!post.isRepost) return true;
                        return post.isRepost && post.repostType === 'self';
                    default: return true;
                }
            });
        }

        return sortPosts(postsToDisplay, drillDownSort);
    }, [selectedTag, taggedPostsMap, drillDownSort, drillDownFilter]);


    const getSortIcon = () => {
        switch (drillDownSort) {
            case 'newest':
            case 'oldest': return <Clock size={16} />;
            case 'most_liked':
            case 'least_liked': return <ThumbsUp size={16} />;
            case 'most_commented':
            case 'least_commented': return <MessageCircle size={16} />;
            case 'most_shared':
            case 'least_shared': return <Share2 size={16} />;
            case 'combined_score':
            case 'inverse_combined_score': return <Target size={16} />;
            default: return <Clock size={16} />;
        }
    };

    const getFilterIcon = () => {
        switch (drillDownFilter) {
            case 'text_only': return <FileText size={16} />;
            case 'with_images': return <ImageIcon size={16} />;
            case 'with_carousel': return <Layers size={16} />;
            case 'with_videos': return <Video size={16} />;
            case 'reposts_only': return <Repeat size={16} />;
            case 'own_content': return <Filter size={16} />; // Or generic Filter icon if no specific icon for own content
            default: return <Filter size={16} />;
        }
    };


    // --- Render ---
    if (!isOpen) return null;

    const renderChart = () => {
        if (isCalculating) {
            return (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    <div className="spinner" style={{ marginRight: '10px' }}></div> Analyzing Topics...
                </div>
            );
        }

        if (tagData.length === 0) {
            return (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    No data found for this period.
                </div>
            );
        }

        const commonProps = { margin: { top: 20, right: 30, left: 20, bottom: 60 } }; // Increased bottom for labels
        const tickInterval = 0;

        const ChartComponent = chartType === 'line' ? LineChart : (chartType === 'area' ? AreaChart : BarChart);
        const DataComponent = chartType === 'line' ? Line : (chartType === 'area' ? Area : Bar);

        // Custom Tooltip
        const CustomTooltip = ({ active, payload, label }) => {
            if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                    <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 5px' }}>{label}</p>
                        <p style={{ margin: 0, fontSize: '12px' }}>Posts: {data.volume}</p>
                        <p style={{ margin: 0, fontSize: '12px' }}>Total Eng: {data.engagement.toLocaleString()}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#CC4E2E' }}>
                            {metricMode === 'average' ? `Avg Eng: ${data.count}` : ''}
                        </p>
                    </div>
                );
            }
            return null;
        };

        return (
            <ResponsiveContainer width="100%" height={300}>
                <ChartComponent
                    data={tagData}
                    {...commonProps}
                    onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            handleChartClick(e.activePayload[0].payload);
                        }
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                    <XAxis
                        dataKey="name"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={(val) => val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />

                    <DataComponent
                        type="monotone"
                        dataKey="count"
                        stroke='#CC4E2E'
                        strokeWidth={chartType === 'bar' ? 0 : 3}
                        fill={chartType === 'line' ? undefined : '#CC4E2E'}
                        fillOpacity={chartType === 'area' ? 0.6 : (chartType === 'bar' ? 0.8 : 1)}
                        radius={[4, 4, 0, 0]}
                        dot={chartType !== 'bar' ? { fill: '#CC4E2E', r: 4 } : undefined}
                        onClick={chartType === 'bar' ? (entry) => {
                            handleChartClick(entry);
                        } : undefined}
                        style={{ cursor: 'pointer' }}
                    >
                        {chartType === 'bar' && tagData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.name === selectedTag ? '#004d2a' : '#CC4E2E'}
                                cursor="pointer"
                            />
                        ))}
                    </DataComponent>
                </ChartComponent>
            </ResponsiveContainer>
        );
    };

    return (
        <div className="analytics-overlay" onClick={onClose}>
            <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>

                {/* Header */}


                {/* Info Modal */}
                <TopicAnalyticsInfo isOpen={showInfo} onClose={() => setShowInfo(false)} />

                <div className="analytics-header">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {selectedTag ? (
                                <button className="back-btn" onClick={() => setSelectedTag(null)} title="Back to All Topics">
                                    <ArrowLeft size={18} color="#666" />
                                </button>
                            ) : null}
                            <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Hash size={20} color='#CC4E2E' />
                                {selectedTag ? `Topic: ${selectedTag}` : 'Topic Analysis'}
                                <button
                                    onClick={() => setShowInfo(true)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        padding: '4px', color: '#1a73e8', display: 'flex', alignItems: 'center'
                                    }}
                                    title="How to read this?"
                                >
                                    <Info size={16} />
                                </button>
                            </h2>
                        </div>
                        {!selectedTag && (
                            <span style={{ fontSize: '12px', color: '#666', marginLeft: selectedTag ? '0' : '28px' }}>
                                Analyzed {filteredPosts.length} posts
                            </span>
                        )}
                    </div>
                    <button className="close-analytics" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* Controls (Only show if not drilled down) */}
                {
                    !selectedTag && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {/* Time Range */}
                            <div className="chart-toggles" style={{ display: 'flex', background: '#f3f2ef', borderRadius: '20px', padding: '2px' }}>
                                {['all', 'month', 'week'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setTimeRange(r)}
                                        style={{
                                            background: timeRange === r ? '#fff' : 'none',
                                            border: 'none', borderRadius: '18px', padding: '6px 12px', fontSize: '12px',
                                            cursor: 'pointer', boxShadow: timeRange === r ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                            fontWeight: timeRange === r ? '600' : '400', color: timeRange === r ? '#CC4E2E' : '#666',
                                            textTransform: 'capitalize'
                                        }}
                                    >
                                        {r === 'all' ? 'All Time' : (r === 'month' ? 'Last 30 Days' : 'Last 7 Days')}
                                    </button>
                                ))}
                            </div>

                            {/* Metric Mode */}
                            <div className="chart-toggles" style={{ display: 'flex', background: '#f3f2ef', borderRadius: '20px', padding: '2px', marginLeft: '8px' }}>
                                {['volume', 'engagement', 'average'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setMetricMode(m)}
                                        style={{
                                            background: metricMode === m ? '#fff' : 'none',
                                            border: 'none', borderRadius: '18px', padding: '6px 12px', fontSize: '12px',
                                            cursor: 'pointer', boxShadow: metricMode === m ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                            fontWeight: metricMode === m ? '600' : '400', color: metricMode === m ? '#CC4E2E' : '#666',
                                            textTransform: 'capitalize'
                                        }}
                                    >
                                        {m === 'average' ? 'Avg. Eng.' : m}
                                    </button>
                                ))}
                            </div>

                            {/* Chart Type (Right Aligned) */}
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => setOnlyOwnContent(!onlyOwnContent)}
                                    style={{
                                        background: onlyOwnContent ? '#e8f0fe' : '#f3f2ef',
                                        border: onlyOwnContent ? '1px solid #1a73e8' : 'none',
                                        borderRadius: '18px', padding: '6px 12px', fontSize: '12px',
                                        cursor: 'pointer',
                                        fontWeight: onlyOwnContent ? '600' : '400',
                                        color: onlyOwnContent ? '#1a73e8' : '#666',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Show only original posts and self-reposts"
                                >
                                    <Filter size={14} />
                                    Own Content
                                </button>

                                <div className="chart-toggles" style={{ display: 'flex', background: '#f3f2ef', borderRadius: '20px', padding: '2px' }}>
                                    {['bar', 'area', 'line'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setChartType(c)}
                                            style={{
                                                background: chartType === c ? '#fff' : 'none',
                                                border: 'none', borderRadius: '18px', padding: '6px 10px', fontSize: '12px',
                                                cursor: 'pointer', boxShadow: chartType === c ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                color: chartType === c ? '#CC4E2E' : '#666',
                                                display: 'flex', alignItems: 'center'
                                            }}
                                            title={`${c} chart`}
                                        >
                                            {c === 'bar' && <BarChart2 size={14} />}
                                            {c === 'area' && <TrendingUp size={14} />}
                                            {c === 'line' && <Activity size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )
                }

                {/* Summary Section */}
                {
                    !selectedTag && tagData.length > 0 && !isCalculating && (
                        <div className="analytics-summary">
                            <div className="summary-card">
                                <span className="label">Top Topic</span>
                                <span className="value">
                                    {tagData[0].name}
                                    <span className="count" style={{ fontSize: '13px', fontWeight: '400', color: '#666', marginLeft: '4px' }}>
                                        ({tagData[0].count.toLocaleString()} {metricMode === 'volume' ? 'Posts' : (metricMode === 'engagement' ? 'Eng' : 'Avg')})
                                    </span>
                                </span>
                            </div>
                            <div className="summary-card">
                                <span className="label">Total {metricMode === 'volume' ? 'Posts' : (metricMode === 'engagement' ? 'Engagement' : 'Avg Eng')}</span>
                                <span className="value">
                                    {metricMode === 'average'
                                        ? Math.round(tagData.reduce((acc, item) => acc + (item.engagement || 0), 0) / Math.max(tagData.reduce((acc, item) => acc + item.volume, 0), 1)).toLocaleString()
                                        : tagData.reduce((acc, item) => acc + item.count, 0).toLocaleString()
                                    }
                                </span>
                            </div>
                        </div>
                    )
                }

                {/* Content */}
                <div className="analytics-content">
                    {selectedTag ? (
                        /* Drill Down List */
                        <div className="posts-list">
                            <div className="list-header" style={{ marginBottom: '16px' }}>
                                <div style={{ marginBottom: '12px', fontSize: '14px', color: '#4b5563' }}>
                                    Showing {finalDisplayPosts.length} posts for <strong>{selectedTag}</strong>
                                </div>

                                <div className="header-controls" style={{ display: 'flex', gap: '12px' }}>
                                    {/* Sort Dropdown */}
                                    <div className="sort-container">
                                        <label className="sort-label">
                                            <ArrowDownUp size={14} />
                                            <span>Sort by</span>
                                        </label>
                                        <div className="select-wrapper">
                                            {getSortIcon()}
                                            <select
                                                value={drillDownSort}
                                                onChange={(e) => setDrillDownSort(e.target.value)}
                                            >
                                                <option value="newest">Newest First</option>
                                                <option value="oldest">Oldest First</option>
                                                <option value="most_liked">Most Liked</option>
                                                <option value="least_liked">Least Liked</option>
                                                <option value="most_commented">Most Commented</option>
                                                <option value="least_commented">Least Commented</option>
                                                <option value="most_shared">Most Shared</option>
                                                <option value="least_shared">Least Shared</option>
                                                <option value="combined_score">Top Engagement</option>
                                                <option value="inverse_combined_score">Low Engagement</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Filter Dropdown */}
                                    <div className="sort-container">
                                        <label className="sort-label">
                                            <Filter size={14} />
                                            <span>Filter</span>
                                        </label>
                                        <div className="select-wrapper">
                                            {getFilterIcon()}
                                            <select
                                                value={drillDownFilter}
                                                onChange={(e) => setDrillDownFilter(e.target.value)}
                                            >
                                                <option value="all">All Posts</option>
                                                <option value="text_only">Only Text</option>
                                                <option value="with_images">With Images</option>
                                                <option value="with_carousel">With Carousel</option>
                                                <option value="with_videos">With Videos</option>
                                                <option value="reposts_only">Reposts</option>
                                                <option value="own_content">Own Content</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {finalDisplayPosts.map((post, i) => (
                                    <PostItem key={i} post={post} index={i + 1} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Chart View */
                        renderChart()
                    )}
                </div>
            </div >
        </div >
    );
};

export default TopicAnalytics;

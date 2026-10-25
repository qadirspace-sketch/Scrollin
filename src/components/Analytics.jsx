import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';
import { X, Clock, ArrowLeft, BarChart2, Activity, TrendingUp, Calendar, ArrowDownUp, Filter, FileText, Image as ImageIcon, Layers, Video, ThumbsUp, MessageCircle, Share2, Target, Repeat, ChevronRight, BarChart as BarChartIcon, Percent, Info } from 'lucide-react';
import { extractTimeFromUrn } from '../utils/timeUtils';
import PostItem from './PostItem';
import AnalyticsInfo from './AnalyticsInfo';

// Helper functions for sorting
function sortPosts(posts, criteria) {
    const getCount = (post, type) => {
        return (post?.stats && post.stats[type]) ? post.stats[type] : 0;
    };

    const getCombinedScore = (post) => {
        return getCount(post, 'likes') + getCount(post, 'comments') + getCount(post, 'reposts');
    };

    const parseRelativeDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return Infinity;

        const cleanStr = dateStr.replace('•', '').trim().toLowerCase();

        if (cleanStr.includes('now') || cleanStr.includes('second') || cleanStr.includes('min')) {
            if (cleanStr.includes('now')) return 0;
        }

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

    const getPostTimestamp = (post) => {
        if (!post) return 0;
        if (post.createdAt) {
            const t = new Date(post.createdAt).getTime();
            if (!isNaN(t)) return t;
        }
        if (post.urn) {
            const date = extractTimeFromUrn(post.urn);
            if (date) return date.getTime();
        }
        if (post.date) {
            const offsetMin = parseRelativeDate(post.date);
            if (offsetMin !== Infinity) {
                return Date.now() - (offsetMin * 60 * 1000);
            }
        }
        return 0;
    };

    return [...posts].sort((a, b) => {
        if (!a || !b) return 0;
        switch (criteria) {
            case 'newest':
                const timeA_new = getPostTimestamp(a);
                const timeB_new = getPostTimestamp(b);
                if (timeA_new !== timeB_new) return timeB_new - timeA_new;
                return (a.urn > b.urn) ? -1 : 1;
            case 'oldest':
                const timeA_old = getPostTimestamp(a);
                const timeB_old = getPostTimestamp(b);
                if (timeA_old !== timeB_old) return timeA_old - timeB_old;
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

const Analytics = ({ posts, isOpen, onClose }) => {
    // Selection state for listing posts
    const [selectedBucket, setSelectedBucket] = useState(null);

    // Filter state for drill-down
    const [activeFilters, setActiveFilters] = useState({ year: null, month: null });

    // View state
    const [chartType, setChartType] = useState('bar');
    const [viewMode, setViewMode] = useState('time'); // 'time', 'day', 'month', 'year'
    const [granularity, setGranularity] = useState(60);
    const [metricMode, setMetricMode] = useState('volume'); // 'volume', 'engagement', 'average'
    const [showInfo, setShowInfo] = useState(false);
    const [onlyOwnContent, setOnlyOwnContent] = useState(false); // New Toggle

    // List controls
    const [drillDownSort, setDrillDownSort] = useState('newest');
    const [drillDownFilter, setDrillDownFilter] = useState('all');

    // Filter posts based on active context (Year > Month)
    const filteredContextPosts = useMemo(() => {
        if (!posts) return [];
        let filtered = posts;

        // NEW: Filter for own content
        if (onlyOwnContent) {
            filtered = filtered.filter(post => {
                // Keep if NOT a repost OR if it IS a repost but type is 'self'
                if (!post.isRepost) return true;
                return post.isRepost && post.repostType === 'self';
            });
        }

        if (activeFilters.year !== null) {
            filtered = filtered.filter(post => {
                if (!post.urn) return false;
                const date = extractTimeFromUrn(post.urn);
                if (!date) return false;
                return date.getFullYear() === activeFilters.year;
            });
        }

        if (activeFilters.month !== null) {
            filtered = filtered.filter(post => {
                if (!post.urn) return false;
                const date = extractTimeFromUrn(post.urn);
                if (!date) return false;
                return date.getMonth() === activeFilters.month;
            });
        }

        return filtered;
    }, [posts, activeFilters, onlyOwnContent]);

    const getPostEngagement = (post) => {
        const likes = (post?.stats?.likes) || 0;
        const comments = (post?.stats?.comments) || 0;
        const reposts = (post?.stats?.reposts) || 0;
        return likes + comments + reposts;
    };

    const calculateMetric = (volume, engagement) => {
        if (metricMode === 'volume') return volume;
        if (metricMode === 'engagement') return engagement;
        // Average
        return volume > 0 ? Math.round(engagement / volume) : 0;
    };

    const getMetricLabel = () => {
        if (metricMode === 'volume') return 'Posts';
        if (metricMode === 'engagement') return 'Eng.';
        return 'Avg. Eng.';
    };

    // --- TIME DATA (Hourly/Minute) ---
    const timeData = useMemo(() => {
        if (filteredContextPosts.length === 0) return [];

        const bucketsPerDay = (24 * 60) / granularity;
        const buckets = new Array(bucketsPerDay).fill(0).map((_, index) => {
            const totalMinutes = index * granularity;
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            return {
                hour,
                minute,
                volume: 0,
                engagement: 0,
                label: `${hour}:${minute.toString().padStart(2, '0')}`
            };
        });

        filteredContextPosts.forEach(post => {
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) {
                    const hour = date.getHours();
                    const minute = date.getMinutes();
                    const totalMinutes = hour * 60 + minute;
                    const bucketIndex = Math.floor(totalMinutes / granularity);
                    if (buckets[bucketIndex]) {
                        buckets[bucketIndex].volume += 1;
                        buckets[bucketIndex].engagement += getPostEngagement(post);
                    }
                }
            }
        });

        return buckets.map(bucket => {
            const { hour, minute, volume, engagement } = bucket;
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            const displayMinute = minute.toString().padStart(2, '0');
            const timeLabel = granularity === 60 ? `${displayHour} ${period}` : `${displayHour}:${displayMinute} ${period}`;

            return {
                displayLabel: timeLabel,
                bucketId: bucket.label,
                count: calculateMetric(volume, engagement),
                volume, // Helper for tooltip
                engagement, // Helper for tooltip
                rawHour: hour,
                rawMinute: minute,
                granularity,
                period: hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
            };
        });
    }, [filteredContextPosts, granularity, metricMode]);

    // --- DAY DATA (Weekly) ---
    const dayData = useMemo(() => {
        if (filteredContextPosts.length === 0) return [];

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const buckets = days.map(day => ({
            displayLabel: day.substring(0, 3),
            fullName: day,
            bucketId: day,
            volume: 0,
            engagement: 0
        }));

        filteredContextPosts.forEach(post => {
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) {
                    const idx = date.getDay();
                    buckets[idx].volume += 1;
                    buckets[idx].engagement += getPostEngagement(post);
                }
            }
        });

        const finalBuckets = buckets.map(b => ({
            ...b,
            count: calculateMetric(b.volume, b.engagement)
        }));

        return [
            finalBuckets[1], finalBuckets[2], finalBuckets[3], finalBuckets[4], finalBuckets[5], finalBuckets[6], finalBuckets[0]
        ];
    }, [filteredContextPosts, metricMode]);

    // --- MONTH DATA ---
    const monthData = useMemo(() => {
        if (filteredContextPosts.length === 0) return [];
        const months = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        const buckets = months.map((month, index) => ({
            displayLabel: month.substring(0, 3),
            fullName: month,
            bucketId: index.toString(),
            volume: 0,
            engagement: 0
        }));

        filteredContextPosts.forEach(post => {
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) {
                    const idx = date.getMonth();
                    buckets[idx].volume += 1;
                    buckets[idx].engagement += getPostEngagement(post);
                }
            }
        });
        return buckets.map(b => ({
            ...b,
            count: calculateMetric(b.volume, b.engagement)
        }));
    }, [filteredContextPosts, metricMode]);

    // --- YEAR DATA ---
    const yearData = useMemo(() => {
        if (filteredContextPosts.length === 0) return [];

        const bucketMap = {};
        filteredContextPosts.forEach(post => {
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) {
                    const year = date.getFullYear();
                    if (!bucketMap[year]) {
                        bucketMap[year] = {
                            displayLabel: year.toString(),
                            bucketId: year.toString(),
                            volume: 0,
                            engagement: 0
                        };
                    }
                    bucketMap[year].volume += 1;
                    bucketMap[year].engagement += getPostEngagement(post);
                }
            }
        });
        return Object.values(bucketMap)
            .sort((a, b) => parseInt(a.bucketId) - parseInt(b.bucketId))
            .map(b => ({
                ...b,
                count: calculateMetric(b.volume, b.engagement)
            }));
    }, [filteredContextPosts, metricMode]);


    const currentData = useMemo(() => {
        switch (viewMode) {
            case 'time': return timeData;
            case 'day': return dayData;
            case 'month': return monthData;
            case 'year': return yearData;
            default: return timeData;
        }
    }, [viewMode, timeData, dayData, monthData, yearData]);


    const getPeaks = (data) => {
        if (!data || data.length === 0) return { peaks: [], max: 0 };
        const max = Math.max(...data.map(d => d.count));
        if (max === 0) return { peaks: [], max: 0 };
        return { peaks: data.filter(d => d.count === max), max };
    };

    const { peaks: peakDays, max: maxDayCount } = getPeaks(dayData);
    const { peaks: peakTimes, max: maxTimeCount } = getPeaks(timeData);
    const { peaks: peakMonths, max: maxMonthCount } = getPeaks(monthData);
    const { peaks: peakYears, max: maxYearCount } = getPeaks(yearData);

    const totalAnalyzed = filteredContextPosts.length;

    // Filter final list of posts for display
    const selectedPosts = useMemo(() => {
        if (!selectedBucket) return [];

        let bucketPosts = [];

        if (viewMode === 'day') {
            bucketPosts = filteredContextPosts.filter(post => {
                const date = extractTimeFromUrn(post.urn);
                if (!date) return false;
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return days[date.getDay()] === selectedBucket;
            });
        } else if (viewMode === 'month') {
            bucketPosts = filteredContextPosts.filter(post => {
                const date = extractTimeFromUrn(post.urn);
                if (!date) return false;
                return date.getMonth().toString() === selectedBucket;
            });
        } else if (viewMode === 'year') {
            bucketPosts = filteredContextPosts.filter(post => {
                const date = extractTimeFromUrn(post.urn);
                if (!date) return false;
                return date.getFullYear().toString() === selectedBucket;
            });
        } else {
            // Time mode
            const parts = selectedBucket.split(':');
            if (parts.length !== 2) return [];
            const [bucketHour, bucketMinute] = parts.map(Number);

            bucketPosts = filteredContextPosts.filter(post => {
                const date = extractTimeFromUrn(post.urn);
                if (!date) return false;

                const h = date.getHours();
                const m = date.getMinutes();

                if (h !== bucketHour) {
                    const postTotal = h * 60 + m;
                    const bucketTimeTotal = bucketHour * 60 + bucketMinute;
                    return postTotal >= bucketTimeTotal && postTotal < (bucketTimeTotal + granularity);
                } else {
                    return m >= bucketMinute && m < (bucketMinute + granularity);
                }
            });
        }

        // Apply Content Filter
        const filtered = bucketPosts.filter(post => {
            if (drillDownFilter === 'all') return true;
            const mediaItems = Array.isArray(post.media) ? post.media : (post.media ? [post.media] : []);
            const hasMedia = mediaItems.length > 0;

            switch (drillDownFilter) {
                case 'text_only': return !hasMedia;
                case 'with_images': return hasMedia && mediaItems.some(m => m.type === 'image' && !m.isCarousel);
                case 'with_carousel': return hasMedia && mediaItems.some(m => m.type === 'carousel' || m.isCarousel);
                case 'with_videos': return hasMedia && mediaItems.some(m => m.type === 'video');
                case 'reposts_only': return post.isRepost;
                default: return true;
            }
        });

        return sortPosts(filtered, drillDownSort);

    }, [filteredContextPosts, selectedBucket, granularity, viewMode, drillDownSort, drillDownFilter]);


    const handleChartClick = (payload) => {
        if (!payload) return;
        const bucketId = payload.bucketId;
        setSelectedBucket(bucketId);
    };

    const handleDrillDown = () => {
        if (!selectedBucket) return;

        if (viewMode === 'year') {
            const year = parseInt(selectedBucket);
            setActiveFilters(prev => ({ ...prev, year }));
            setViewMode('month');
            setSelectedBucket(null);
        } else if (viewMode === 'month') {
            const month = parseInt(selectedBucket);
            setActiveFilters(prev => ({ ...prev, month }));
            setViewMode('day'); // Default drill down from month is to day view
            setSelectedBucket(null);
        }
    };

    const handleBack = () => {
        if (selectedBucket) {
            setSelectedBucket(null);
            return;
        }
        if (activeFilters.month !== null) {
            setActiveFilters(prev => ({ ...prev, month: null }));
            setViewMode('month'); // Return to viewing all months of the selected year
            return;
        }
        if (activeFilters.year !== null) {
            setActiveFilters(prev => ({ ...prev, year: null }));
            setViewMode('year'); // Return to viewing all years
            return;
        }
    };

    const renderBreadcrumbs = () => {
        const crumbs = [];
        let rootLabel = 'Posting Habits';
        if (metricMode === 'engagement') rootLabel = 'Engagement Habits';
        if (metricMode === 'average') rootLabel = 'Avg. Engagement Habits';

        // Root
        crumbs.push({
            label: rootLabel,
            onClick: () => {
                if (activeFilters.year !== null || selectedBucket) {
                    setActiveFilters({ year: null, month: null });
                    setSelectedBucket(null);
                    setViewMode('year');
                }
            },
            active: activeFilters.year === null && !selectedBucket
        });

        // Year
        if (activeFilters.year !== null) {
            crumbs.push({
                label: activeFilters.year.toString(),
                onClick: () => {
                    if (activeFilters.month !== null || selectedBucket) {
                        setActiveFilters(prev => ({ ...prev, month: null }));
                        setSelectedBucket(null);
                        setViewMode('month');
                    }
                },
                active: activeFilters.month === null && !selectedBucket
            });
        }

        // Month
        if (activeFilters.month !== null) {
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            crumbs.push({
                label: months[activeFilters.month],
                onClick: () => {
                    if (selectedBucket) {
                        setSelectedBucket(null);
                        setViewMode('day');
                    }
                },
                active: !selectedBucket
            });
        }

        // Selected Bucket (Day/Time/etc)
        if (selectedBucket) {
            let label = formatBucketDisplay(selectedBucket);
            crumbs.push({
                label: label,
                onClick: null,
                active: true
            });
        }

        return (
            <div className="breadcrumbs" style={{ display: 'flex', alignItems: 'center', fontSize: '18px', fontWeight: '600', color: '#FFFFFF', flexWrap: 'wrap' }}>
                {crumbs.map((crumb, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && <ChevronRight size={16} style={{ margin: '0 6px', color: '#999' }} />}
                        <span
                            onClick={crumb.onClick}
                            style={{
                                cursor: crumb.onClick ? 'pointer' : 'default',
                                color: crumb.active ? '#191919' : '#666',
                                textDecoration: crumb.onClick ? 'underline' : 'none',
                                textUnderlineOffset: '4px'
                            }}
                            className={crumb.onClick ? "breadcrumb-link" : ""}
                        >
                            {crumb.label}
                        </span>
                    </React.Fragment>
                ))}

                <button
                    onClick={() => setShowInfo(true)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px', marginLeft: '8px', color: '#1a73e8',
                        display: 'flex', alignItems: 'center'
                    }}
                    title="What do these metrics mean?"
                >
                    <Info size={16} />
                </button>
            </div>
        );
    };

    const canGoBack = selectedBucket !== null || activeFilters.year !== null || activeFilters.month !== null;

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

    const formatBucketDisplay = (bucketStr) => {
        if (viewMode === 'day') return bucketStr;
        if (viewMode === 'month') {
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            return months[parseInt(bucketStr)];
        }
        if (viewMode === 'year') return bucketStr;
        const [hour, minute] = bucketStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hour, minute, 0);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    if (!isOpen) return null;

    const renderChart = () => {
        const commonProps = { margin: { top: 20, right: 10, left: 0, bottom: 5 } };
        const dataToRender = currentData;
        const currentMax = Math.max(...dataToRender.map(d => d.count), 0);
        const tickInterval = viewMode === 'day' || viewMode === 'month' || viewMode === 'year' ? 0 : Math.floor(dataToRender.length / 8);

        const ChartComponent = chartType === 'line' ? LineChart : (chartType === 'area' ? AreaChart : BarChart);
        const DataComponent = chartType === 'line' ? Line : (chartType === 'area' ? Area : Bar);
        const dataKey = "count";

        // Formatter for Y-axis and Tooltip
        const numberFormatter = (value) => {
            if (value >= 1000) {
                return (value / 1000).toFixed(1) + 'k';
            }
            return value;
        };

        const metricLabel = getMetricLabel();

        return (
            <ResponsiveContainer width="100%" height={300}>
                <ChartComponent
                    data={dataToRender}
                    {...commonProps}
                    onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            handleChartClick(e.activePayload[0].payload);
                        }
                    }}
                >
                    {chartType === 'area' && (
                        <defs>
                            <linearGradient id="colorCountArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor='#CC4E2E' stopOpacity={0.8} />
                                <stop offset="95%" stopColor='#CC4E2E' stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                    )}
                    {chartType === 'bar' && (
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor='#CC4E2E' stopOpacity={0.8} />
                                <stop offset="95%" stopColor='#CC4E2E' stopOpacity={0.3} />
                            </linearGradient>
                        </defs>
                    )}

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                    <XAxis dataKey="displayLabel" fontSize={10} tickLine={false} axisLine={false} interval={tickInterval} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={numberFormatter} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee' }}
                        cursor={{ stroke: '#CC4E2E', strokeWidth: 1, fill: 'rgba(0,0,0,0.05)' }}
                        formatter={(value) => [value, metricLabel]}
                    />

                    <DataComponent
                        type="monotone"
                        dataKey={dataKey}
                        stroke='#CC4E2E'
                        strokeWidth={chartType === 'bar' ? 0 : 3}
                        fill={chartType === 'line' ? undefined : (chartType === 'area' ? "url(#colorCountArea)" : "url(#colorCount)")}
                        fillOpacity={chartType === 'area' ? 1 : undefined}
                        radius={chartType === 'bar' ? [4, 4, 0, 0] : undefined}
                        dot={chartType !== 'bar' ? { fill: '#CC4E2E', r: 4, cursor: 'pointer' } : undefined}
                        activeDot={{
                            r: 6,
                            cursor: 'pointer',
                            onClick: (e, payload) => {
                                if (payload && payload.payload) {
                                    handleChartClick(payload.payload);
                                }
                            }
                        }}
                        onClick={chartType === 'bar' ? (entry) => {
                            if (entry && entry.count > 0) handleChartClick(entry);
                        } : undefined}
                        style={{ cursor: 'pointer' }}
                    >
                        {chartType === 'bar' && dataToRender.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.count === currentMax && entry.count > 0 ? '#004d2a' : 'url(#colorCount)'}
                                style={{ cursor: entry.count > 0 ? 'pointer' : 'default' }}
                            />
                        ))}
                    </DataComponent>
                </ChartComponent>
            </ResponsiveContainer>
        );
    };

    const metricUnitLabel = getMetricLabel();

    return (
        <div className="analytics-overlay" onClick={onClose}>
            <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
                <div className="analytics-header">
                    <div className="analytics-title" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {canGoBack ? (
                                <button
                                    className="back-btn"
                                    onClick={handleBack}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        padding: '4px', display: 'flex', alignItems: 'center',
                                        color: '#666', borderRadius: '50%',
                                        backgroundColor: '#f3f2ef'
                                    }}
                                    title="Go Back"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            ) : (
                                <div style={{ padding: '4px', color: '#666' }}>
                                    <Clock size={20} />
                                </div>
                            )}

                            {renderBreadcrumbs()}

                            {selectedBucket && (viewMode === 'year' || viewMode === 'month') && (
                                <button
                                    className="drill-down-btn"
                                    onClick={handleDrillDown}
                                    style={{
                                        marginLeft: '12px',
                                        padding: '6px 10px',
                                        fontSize: '12px',
                                        backgroundColor: '#e8f0fe',
                                        color: '#1a73e8',
                                        border: 'none',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontWeight: '600'
                                    }}
                                >
                                    View {viewMode === 'year' ? 'Monthly' : 'Daily'} Breakdown <ChevronRight size={14} />
                                </button>
                            )}
                        </div>

                        {!selectedBucket && (
                            <span className="analytics-subtitle" style={{ marginLeft: '40px' }}>
                                Analyzed {totalAnalyzed} posts
                            </span>
                        )}
                    </div>

                    <button className="close-analytics" onClick={onClose} style={{ alignSelf: 'flex-start' }}>
                        <X size={24} />
                    </button>
                </div>

                {!selectedBucket && (
                    <div className="controls-row" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {/* Metric Toggle */}
                        <div className="chart-toggles" style={{
                            display: 'flex', background: '#f3f2ef', borderRadius: '20px', padding: '2px', marginRight: '8px'
                        }}>
                            <button
                                onClick={() => setMetricMode('volume')}
                                style={{
                                    background: metricMode === 'volume' ? '#fff' : 'none',
                                    border: 'none', borderRadius: '18px', padding: '6px 10px', fontSize: '12px',
                                    cursor: 'pointer', boxShadow: metricMode === 'volume' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                    fontWeight: metricMode === 'volume' ? '600' : '400', color: metricMode === 'volume' ? '#CC4E2E' : '#666',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <BarChartIcon size={12} />
                                Volume
                            </button>
                            <button
                                onClick={() => setMetricMode('engagement')}
                                style={{
                                    background: metricMode === 'engagement' ? '#fff' : 'none',
                                    border: 'none', borderRadius: '18px', padding: '6px 10px', fontSize: '12px',
                                    cursor: 'pointer', boxShadow: metricMode === 'engagement' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                    fontWeight: metricMode === 'engagement' ? '600' : '400', color: metricMode === 'engagement' ? '#CC4E2E' : '#666',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <Activity size={12} />
                                Engagement
                            </button>
                            <button
                                onClick={() => setMetricMode('average')}
                                style={{
                                    background: metricMode === 'average' ? '#fff' : 'none',
                                    border: 'none', borderRadius: '18px', padding: '6px 10px', fontSize: '12px',
                                    cursor: 'pointer', boxShadow: metricMode === 'average' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                    fontWeight: metricMode === 'average' ? '600' : '400', color: metricMode === 'average' ? '#CC4E2E' : '#666',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <Percent size={12} />
                                Avg. Eng.
                            </button>
                        </div>

                        <div className="chart-toggles" style={{
                            display: 'flex', background: '#f3f2ef', borderRadius: '20px', padding: '2px', flexWrap: 'wrap'
                        }}>
                            {['time', 'day', 'month', 'year'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    style={{
                                        background: viewMode === mode ? '#fff' : 'none',
                                        border: 'none', borderRadius: '18px', padding: '6px 10px', fontSize: '12px',
                                        cursor: 'pointer', boxShadow: viewMode === mode ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                        fontWeight: viewMode === mode ? '600' : '400', color: viewMode === mode ? '#CC4E2E' : '#666',
                                        display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize'
                                    }}
                                >
                                    {mode === 'time' && <Clock size={12} />}
                                    {mode === 'day' && <Calendar size={12} />}
                                    {mode === 'month' && <Calendar size={12} />}
                                    {mode === 'year' && <Calendar size={12} />}
                                    {mode}
                                </button>
                            ))}
                        </div>

                        {viewMode === 'time' && (
                            <div className="chart-toggles" style={{
                                display: 'flex', background: '#f3f2ef', borderRadius: '20px', padding: '2px'
                            }}>
                                {[60, 30, 10].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setGranularity(m)}
                                        style={{
                                            background: granularity === m ? '#fff' : 'none',
                                            border: 'none', borderRadius: '18px', padding: '6px 10px', fontSize: '12px',
                                            cursor: 'pointer', boxShadow: granularity === m ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                            fontWeight: granularity === m ? '600' : '400', color: granularity === m ? '#CC4E2E' : '#666'
                                        }}
                                    >
                                        {m >= 60 ? '1H' : `${m}M`}
                                    </button>
                                ))}
                            </div>
                        )}

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
                                marginRight: '8px',
                                transition: 'all 0.2s'
                            }}
                            title="Show only original posts and self-reposts"
                        >
                            <Filter size={14} />
                            Own Content
                        </button>

                        <div className="chart-toggles" style={{
                            display: 'flex', background: '#f3f2ef', borderRadius: '20px', padding: '2px', marginLeft: 'auto'
                        }}>
                            <button onClick={() => setChartType('bar')} className="icon-btn" style={{ background: chartType === 'bar' ? '#fff' : 'none', border: 'none', borderRadius: '18px', padding: '6px 10px', cursor: 'pointer', boxShadow: chartType === 'bar' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}> <BarChart2 size={16} color={chartType === 'bar' ? '#CC4E2E' : '#666'} /> </button>
                            <button onClick={() => setChartType('line')} className="icon-btn" style={{ background: chartType === 'line' ? '#fff' : 'none', border: 'none', borderRadius: '18px', padding: '6px 10px', cursor: 'pointer', boxShadow: chartType === 'line' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}> <Activity size={16} color={chartType === 'line' ? '#CC4E2E' : '#666'} /> </button>
                            <button onClick={() => setChartType('area')} className="icon-btn" style={{ background: chartType === 'area' ? '#fff' : 'none', border: 'none', borderRadius: '18px', padding: '6px 10px', cursor: 'pointer', boxShadow: chartType === 'area' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}> <TrendingUp size={16} color={chartType === 'area' ? '#CC4E2E' : '#666'} /> </button>
                        </div>
                    </div>
                )}

                {selectedBucket === null ? (
                    <>
                        <div className="analytics-summary">
                            {viewMode === 'year' && (
                                <div className="summary-card">
                                    <span className="label">Peak Year{peakYears.length > 1 ? 's' : ''}</span>
                                    <span className="value">
                                        {peakYears.length > 0 ? `${peakYears.map(y => y.displayLabel).join(', ')}` : '-'}
                                        {maxYearCount > 0 && <span className="count" style={{ fontSize: '13px', fontWeight: '400', color: '#666', marginLeft: '4px' }}>({maxYearCount} {metricMode === 'volume' ? 'Posts' : 'Points'})</span>}
                                    </span>
                                </div>
                            )}
                            {(viewMode === 'year' || viewMode === 'month') && (
                                <div className="summary-card">
                                    <span className="label">Peak Month{peakMonths.length > 1 ? 's' : ''}</span>
                                    <span className="value">
                                        {peakMonths.length > 0 ? `${peakMonths.map(m => m.displayLabel).join(', ')}` : '-'}
                                        {maxMonthCount > 0 && <span className="count" style={{ fontSize: '13px', fontWeight: '400', color: '#666', marginLeft: '4px' }}>({maxMonthCount} {metricMode === 'volume' ? 'Posts' : 'Points'})</span>}
                                    </span>
                                </div>
                            )}
                            <div className="summary-card">
                                <span className="label">Peak Day{peakDays.length > 1 ? 's' : ''}</span>
                                <span className="value">
                                    {peakDays.length > 0 ? `${peakDays.map(d => d.fullName).join(', ')}` : '-'}
                                    {maxDayCount > 0 && <span className="count" style={{ fontSize: '13px', fontWeight: '400', color: '#666', marginLeft: '4px' }}>({maxDayCount} {metricMode === 'volume' ? 'Posts' : 'Points'})</span>}
                                </span>
                            </div>
                            <div className="summary-card">
                                <span className="label">Peak Time{peakTimes.length > 1 ? 's' : ''}</span>
                                <span className="value">
                                    {peakTimes.length > 0 ? `${peakTimes.map(t => t.displayLabel).join(', ')}` : '-'}
                                    {maxTimeCount > 0 && <span className="count" style={{ fontSize: '13px', fontWeight: '400', color: '#666', marginLeft: '4px' }}>({maxTimeCount} {metricMode === 'volume' ? 'Posts' : 'Points'})</span>}
                                </span>
                            </div>
                        </div>

                        <div className="chart-container">
                            {renderChart()}
                        </div>
                        <p className="chart-caption">
                            Click on a {chartType === 'line' || chartType === 'area' ? 'point' : 'bar'} to see posts for that {viewMode === 'day' ? 'day' : viewMode === 'month' ? 'month' : viewMode === 'year' ? 'year' : 'time'}. <br />
                            Distribution by local time.
                        </p>
                    </>
                ) : (
                    <div className="hour-details-list" style={{ marginTop: '16px' }}>
                        <div className="header-controls" style={{ justifyContent: 'space-between', width: '100%', marginBottom: '16px', display: 'flex', gap: '8px' }}>
                            <div className="sort-container" style={{ flex: 1 }}>
                                <label className="sort-label">
                                    <ArrowDownUp size={14} />
                                    <span>Sort by</span>
                                </label>
                                <div className="select-wrapper">
                                    {getSortIcon()}
                                    <select value={drillDownSort} onChange={(e) => setDrillDownSort(e.target.value)} className="custom-select" style={{ width: '100%' }}>
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
                            <div className="sort-container" style={{ flex: 1 }}>
                                <label className="sort-label">
                                    <Filter size={14} />
                                    <span>Filter</span>
                                </label>
                                <div className="select-wrapper">
                                    {drillDownFilter === 'text_only' ? <FileText size={16} /> :
                                        drillDownFilter === 'with_images' ? <ImageIcon size={16} /> :
                                            drillDownFilter === 'with_carousel' ? <Layers size={16} /> :
                                                drillDownFilter === 'with_videos' ? <Video size={16} /> :
                                                    drillDownFilter === 'reposts_only' ? <Repeat size={16} /> :
                                                        <Filter size={16} />}
                                    <select value={drillDownFilter} onChange={(e) => setDrillDownFilter(e.target.value)} className="custom-select" style={{ width: '100%' }}>
                                        <option value="all">All Posts</option>
                                        <option value="text_only">Only Text</option>
                                        <option value="with_images">With Images</option>
                                        <option value="with_carousel">With Carousel</option>
                                        <option value="with_videos">With Videos</option>
                                        <option value="reposts_only">Reposts</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {selectedPosts.length === 0 ? (
                            <div className="no-posts-msg">No posts found for this selection.</div>
                        ) : (
                            selectedPosts.map((post, index) => (
                                <PostItem key={index} post={post} index={index + 1} />
                            ))
                        )}
                    </div>
                )}
            </div>

            <AnalyticsInfo isOpen={showInfo} onClose={() => setShowInfo(false)} />
        </div >
    );
};

export default Analytics;

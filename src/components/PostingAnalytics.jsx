import React, { useState, useMemo, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
    BarChart, Bar, Brush
} from 'recharts';
import {
    TrendingUp, TrendingDown, Info, Download, Share2,
    Calendar, ChevronDown, LayoutGrid, List, BarChart3,
    ThumbsUp, MessageCircle, Share2 as ShareIcon, Eye, Zap, Target,
    Clock, ArrowRight, MoreHorizontal, X, Sparkles, LineChart as LineChartIcon
} from 'lucide-react';
import { generateCSV, downloadCSV } from '../utils/csvExport';
import { extractTimeFromUrn, getPostDateObj } from '../utils/timeUtils';

// New Dashboard Components
import PostList from './PostList';
import { generatePostingAnalyticsSummary } from '../services/geminiService';

const PostingAnalytics = ({ posts, profileId }) => {
    const [activeMetric, setActiveMetric] = useState('Likes');
    const [timeRange, setTimeRange] = useState('Last 30 Days');
    const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [chartType, setChartType] = useState('area'); // 'area' or 'bar'
    const [granularity, setGranularity] = useState('Daily');
    const [comparePrevious, setComparePrevious] = useState(true);
    const [selectedChartNode, setSelectedChartNode] = useState(null);
    const [analyzeOwnContentOnly, setAnalyzeOwnContentOnly] = useState(false);
    const [viewMode, setViewMode] = useState('list');

    const [aiSummaries, setAiSummaries] = useState({});

    // Load profile-specific AI summaries
    useEffect(() => {
        if (!profileId) return;
        try {
            const cached = localStorage.getItem(`kleo_posting_ai_summaries_${profileId}`);
            setAiSummaries(cached ? JSON.parse(cached) : {});
        } catch (e) {
            setAiSummaries({});
        }
    }, [profileId]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);

    const [selectedStatGroup, setSelectedStatGroup] = useState(null); // Which stat box is clicked

    const metrics = ['Likes', 'Comments', 'Reposts', 'Engagement'];
    const granularities = ['Daily', '3 Days', 'Weekly', '15 Days', 'Monthly', 'Yearly'];
    const timeRanges = ['Last 7 Days', 'Last 15 Days', 'Last 30 Days', 'Last 90 Days', 'All Time'];

    const availableYears = useMemo(() => {
        if (!posts || !Array.isArray(posts) || posts.length === 0) return [];
        let minYear = new Date().getFullYear();
        let hasPosts = false;
        
        posts.forEach(post => {
            let year = null;
            if (post.createdAt) {
                year = new Date(post.createdAt).getFullYear();
            } else if (post.dateObj) {
                year = new Date(post.dateObj).getFullYear();
            } else if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) year = date.getFullYear();
            }
            
            if (year && !isNaN(year)) {
                hasPosts = true;
                if (year < minYear) minYear = year;
            }
        });

        if (!hasPosts) return [];

        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear; y >= minYear; y--) {
            years.push(y.toString());
        }
        return years;
    }, [posts]);

    // Auto-adjust granularity based on selected time range
    useEffect(() => {
        if (timeRange === 'All Time' || /^\d{4}$/.test(timeRange)) {
            setGranularity('Monthly');
        } else {
            setGranularity('Daily');
        }
    }, [timeRange]);

    // Auto-adjust default time range if no posts exist in Last 30 Days
    useEffect(() => {
        if (posts && posts.length > 0 && timeRange === 'Last 30 Days') {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const hasRecentPosts = posts.some(post => {
                const date = getPostDateObj(post);
                return date && date >= thirtyDaysAgo;
            });
            if (!hasRecentPosts) {
                setTimeRange('All Time');
            }
        }
    }, [posts, timeRange]);

    const allTimeRanges = [...timeRanges, ...availableYears];

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // --- Data Processing ---
    const actualComparePrevious = comparePrevious && timeRange !== 'All Time';

    const processedData = useMemo(() => {
        if (!posts || !Array.isArray(posts)) return { stats: [], chartData: [], recentPosts: [], aiInsights: [], metricScore: 0, rawCurrentPosts: [] };

        // 1. Clean and enhance posts
        const allPosts = [];
        const seenUrns = new Set();

        const dataToProcess = analyzeOwnContentOnly ? posts.filter(p => !p?.isRepost) : posts;

        dataToProcess.forEach(post => {
            if (!post) return;
            const urn = post.urn || (post.text ? post.text.substring(0, 50) : Math.random().toString());
            if (seenUrns.has(urn)) return;
            seenUrns.add(urn);

            const date = getPostDateObj(post);
            const likes = parseInt(post.stats?.likes || 0);
            const comments = parseInt(post.stats?.comments || 0);
            const reposts = parseInt(post.stats?.reposts || 0);
            const views = parseInt(post.stats?.views || 0);
            const engagement = likes + comments + reposts;
            const engRate = views > 0 ? (engagement / views) * 100 : 0;

            allPosts.push({
                ...post,
                dateObj: date,
                likes,
                comments,
                shares: reposts,
                views,
                engagement,
                engRate,
                urn
            });
        });

        // 2. Sort by date (newest first)
        const sortedPosts = allPosts.sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0));

        // 3. Filter by time range
        const now = new Date();
        const getFilterDate = (range) => {
            const d = new Date();
            if (range === 'Last 7 Days') d.setDate(now.getDate() - 7);
            else if (range === 'Last 15 Days') d.setDate(now.getDate() - 15);
            else if (range === 'Last 30 Days') d.setDate(now.getDate() - 30);
            else if (range === 'Last 90 Days') d.setDate(now.getDate() - 90);
            else d.setFullYear(now.getFullYear() - 1); // 1 year fallback
            return d;
        };

        let currentPeriodPosts = [];
        let prevPeriodPosts = [];
        let diff = 0;

        if (timeRange === 'All Time') {
            currentPeriodPosts = sortedPosts;
            prevPeriodPosts = [];
            diff = 0;
        } else if (/^\d{4}$/.test(timeRange)) {
            const year = parseInt(timeRange);
            const startOfYear = new Date(year, 0, 1);
            const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
            currentPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= startOfYear && p.dateObj <= endOfYear);

            const startOfPrevYear = new Date(year - 1, 0, 1);
            const endOfPrevYear = new Date(year - 1, 11, 31, 23, 59, 59, 999);
            prevPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= startOfPrevYear && p.dateObj <= endOfPrevYear);
            diff = startOfYear.getTime() - startOfPrevYear.getTime();
        } else {
            const filterDate = getFilterDate(timeRange);
            currentPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= filterDate);

            // Previous period for trend calculation (approximate)
            const prevPeriodFilterDate = new Date(filterDate);
            diff = now.getTime() - filterDate.getTime();
            prevPeriodFilterDate.setTime(filterDate.getTime() - diff);
            prevPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= prevPeriodFilterDate && p.dateObj < filterDate);
        }

        const dateRanges = {
            currentStart: currentPeriodPosts.length > 0 ? new Date(Math.min(...currentPeriodPosts.map(p => p.dateObj))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
            currentEnd: currentPeriodPosts.length > 0 ? new Date(Math.max(...currentPeriodPosts.map(p => p.dateObj))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
            prevStart: prevPeriodPosts.length > 0 ? new Date(Math.min(...prevPeriodPosts.map(p => p.dateObj))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
            prevEnd: prevPeriodPosts.length > 0 ? new Date(Math.max(...prevPeriodPosts.map(p => p.dateObj))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
        };

        // 4. Calculate Stats
        const calculateTotal = (postsArr, key) => postsArr.reduce((acc, p) => acc + (p[key] || 0), 0);

        const currentTotalPosts = currentPeriodPosts.length;
        const prevTotalPosts = prevPeriodPosts.length;
        const postGrowth = prevTotalPosts > 0 ? ((currentTotalPosts - prevTotalPosts) / prevTotalPosts) * 100 : 0;

        const currentAvgEngRate = currentTotalPosts > 0 ? (currentPeriodPosts.reduce((acc, p) => acc + p.engRate, 0) / currentTotalPosts) : 0;
        const prevAvgEngRate = prevTotalPosts > 0 ? (prevPeriodPosts.reduce((acc, p) => acc + p.engRate, 0) / prevTotalPosts) : 0;
        const engGrowth = prevAvgEngRate > 0 ? ((currentAvgEngRate - prevAvgEngRate) / prevAvgEngRate) * 100 : 0;

        // Metric Score (simplified 0-100 based on eng rate vs target of 5%)
        const metricScore = Math.min(Math.round((currentAvgEngRate / 5) * 100), 100);

        // 5. Build Chart Data
        const chartMap = {};

        const getGroupBoundaries = (date, gran) => {
            const d = new Date(date);
            let start, end;
            if (gran === 'Daily') {
                start = new Date(d); start.setHours(0,0,0,0);
                end = new Date(d); end.setHours(23,59,59,999);
            } else if (gran === '3 Days') {
                const epochDays = Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
                const blockStartDays = Math.floor(epochDays / 3) * 3;
                start = new Date(blockStartDays * (1000 * 60 * 60 * 24));
                start.setHours(0,0,0,0);
                end = new Date((blockStartDays + 2) * (1000 * 60 * 60 * 24));
                end.setHours(23,59,59,999);
            } else if (gran === 'Weekly') {
                start = new Date(d);
                start.setDate(start.getDate() - start.getDay());
                start.setHours(0,0,0,0);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23,59,59,999);
            } else if (gran === '15 Days') {
                const epochDays = Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
                const blockStartDays = Math.floor(epochDays / 15) * 15;
                start = new Date(blockStartDays * (1000 * 60 * 60 * 24));
                start.setHours(0,0,0,0);
                end = new Date((blockStartDays + 14) * (1000 * 60 * 60 * 24));
                end.setHours(23,59,59,999);
            } else if (gran === 'Monthly') {
                start = new Date(d.getFullYear(), d.getMonth(), 1);
                end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            } else { // Yearly
                start = new Date(d.getFullYear(), 0, 1);
                end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
            }
            return { start, end };
        };

        const getGroupKeyFromBoundaries = (start, end, gran, isPrev = false) => {
            if (gran === 'Daily') return start.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            
            const now = new Date();
            const showNow = !isPrev && (end > now || end.toDateString() === now.toDateString());
            
            const startStrShort = start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
            const startStrFull = start.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            
            if (showNow) {
                return `${startStrFull.includes(now.getFullYear()) ? startStrShort : startStrFull} - Now`;
            }
            
            const endStrFull = end.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            
            if (start.getFullYear() === end.getFullYear()) {
                return `${startStrShort} - ${endStrFull}`;
            }
            return `${startStrFull} - ${endStrFull}`;
        };

        const getGroupKey = (date, gran) => {
            const bounds = getGroupBoundaries(date, gran);
            return getGroupKeyFromBoundaries(bounds.start, bounds.end, gran, false);
        };

        currentPeriodPosts.forEach(p => {
            const bounds = getGroupBoundaries(p.dateObj, granularity);
            const key = getGroupKeyFromBoundaries(bounds.start, bounds.end, granularity, false);
            if (!chartMap[key]) chartMap[key] = { 
                name: key, 
                current: 0, 
                previous: 0, 
                count: 0, 
                sortValue: bounds.start.getTime(), 
                currentPostsList: [], 
                previousPostsList: [] 
            };

            chartMap[key].count++;
            chartMap[key].currentPostsList.push(p);

            if (activeMetric === 'Likes') chartMap[key].current += p.likes;
            else if (activeMetric === 'Comments') chartMap[key].current += p.comments;
            else if (activeMetric === 'Reposts') chartMap[key].current += p.shares;
            else if (activeMetric === 'Engagement') chartMap[key].current += p.engagement;
            else if (activeMetric === 'Views' || activeMetric === 'Reach') chartMap[key].current += p.views;
            else if (activeMetric === 'Engagement Rate') chartMap[key].current += p.engRate;
        });

        // Average out the eng rate for chart
        if (activeMetric === 'Engagement Rate') {
            Object.keys(chartMap).forEach(k => {
                chartMap[k].current = chartMap[k].current / chartMap[k].count;
            });
        }

        // Add previous period data to chart
        if (actualComparePrevious) {
            const prevChartMap = {};
            const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));

            prevPeriodPosts.forEach(p => {
                // To align on the chart, we shift the date of previous posts by the diff
                const shiftedDate = new Date(p.dateObj.getTime() + diff);
                const bounds = getGroupBoundaries(shiftedDate, granularity);
                const key = getGroupKeyFromBoundaries(bounds.start, bounds.end, granularity, false);
                
                // Calculate exact previous label by unshifting the shifted bounds
                const prevStart = new Date(bounds.start);
                prevStart.setDate(prevStart.getDate() - diffDays);
                const prevEnd = new Date(bounds.end);
                prevEnd.setDate(prevEnd.getDate() - diffDays);
                const actualPrevName = getGroupKeyFromBoundaries(prevStart, prevEnd, granularity, true); // true = isPrev

                if (!prevChartMap[key]) prevChartMap[key] = { previous: 0, count: 0, prevName: actualPrevName, sortValue: bounds.start.getTime(), previousPostsList: [] };
                prevChartMap[key].count++;
                prevChartMap[key].previousPostsList.push(p);

                if (activeMetric === 'Likes') prevChartMap[key].previous += p.likes;
                else if (activeMetric === 'Comments') prevChartMap[key].previous += p.comments;
                else if (activeMetric === 'Reposts') prevChartMap[key].previous += p.shares;
                else if (activeMetric === 'Engagement') prevChartMap[key].previous += p.engagement;
                else if (activeMetric === 'Views' || activeMetric === 'Reach') prevChartMap[key].previous += p.views;
                else if (activeMetric === 'Engagement Rate') prevChartMap[key].previous += p.engRate;
            });

            Object.keys(prevChartMap).forEach(k => {
                if (chartMap[k]) {
                    chartMap[k].previous = activeMetric === 'Engagement Rate' ? (prevChartMap[k].previous / prevChartMap[k].count) : prevChartMap[k].previous;
                    chartMap[k].prevName = prevChartMap[k].prevName;
                    chartMap[k].previousPostsList = prevChartMap[k].previousPostsList;
                } else {
                    // Inject a blank bucket so Recharts grid perfectly aligns Current and Previous dots at the exact same intervals
                    chartMap[k] = {
                        name: k,
                        current: 0,
                        previous: activeMetric === 'Engagement Rate' ? (prevChartMap[k].previous / prevChartMap[k].count) : prevChartMap[k].previous,
                        count: 0,
                        sortValue: prevChartMap[k].sortValue,
                        currentPostsList: [],
                        previousPostsList: prevChartMap[k].previousPostsList,
                        prevName: prevChartMap[k].prevName
                    };
                }
            });
        }

        const chartDataArr = Object.values(chartMap).sort((a, b) => {
            return a.sortValue - b.sortValue;
        });

        // 6. Recent Posts for Table -> sorting logic applied here
        const maxEngagement = Math.max(1, ...currentPeriodPosts.map(p => p.engagement));

        let tablePosts = currentPeriodPosts.map(p => ({
            content: p.text ? (p.text.length > 50 ? p.text.substring(0, 50) + "..." : p.text) : "No text content",
            date: p.dateObj ? p.dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : "N/A",
            dateValue: p.dateObj ? p.dateObj.getTime() : 0,
            engagement: p.engagement,
            engagementDisplay: p.engagement.toLocaleString(),
            progress: (p.engagement / maxEngagement) * 100,
            url: p.postUrl || (p.urn ? `https://www.linkedin.com/feed/update/${p.urn}/` : null)
        }));

        tablePosts.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'date') {
                aValue = a.dateValue;
                bValue = b.dateValue;
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        tablePosts = tablePosts.slice(0, 10);

        // Calculate Stats
        const currentTotalMetric = currentPeriodPosts.reduce((acc, p) => {
            if (activeMetric === 'Likes') return acc + (p.likes || 0);
            if (activeMetric === 'Comments') return acc + (p.comments || 0);
            if (activeMetric === 'Reposts') return acc + (p.shares || 0);
            if (activeMetric === 'Engagement') return acc + (p.engagement || 0);
            if (activeMetric === 'Views' || activeMetric === 'Reach') return acc + (p.views || 0);
            if (activeMetric === 'Engagement Rate') return acc + (p.engRate || 0);
            return acc;
        }, 0);

        const prevTotalMetricFromList = prevPeriodPosts.reduce((acc, p) => {
            if (activeMetric === 'Likes') return acc + (p.likes || 0);
            if (activeMetric === 'Comments') return acc + (p.comments || 0);
            if (activeMetric === 'Reposts') return acc + (p.shares || 0);
            if (activeMetric === 'Engagement') return acc + (p.engagement || 0);
            if (activeMetric === 'Views' || activeMetric === 'Reach') return acc + (p.views || 0);
            if (activeMetric === 'Engagement Rate') return acc + (p.engRate || 0);
            return acc;
        }, 0);

        let totalGrowth = 0;
        if (prevTotalMetricFromList > 0) {
            totalGrowth = ((currentTotalMetric - prevTotalMetricFromList) / prevTotalMetricFromList) * 100;
        }

        let displayAvg = 0;
        let prevDisplayAvg = 0;

        if (activeMetric === 'Engagement Rate') {
            displayAvg = currentPeriodPosts.length > 0 ? (currentTotalMetric / currentPeriodPosts.length) : 0;
            prevDisplayAvg = prevPeriodPosts.length > 0 ? (prevTotalMetricFromList / prevPeriodPosts.length) : 0;
        } else {
            // Average per post
            displayAvg = currentPeriodPosts.length > 0 ? (currentTotalMetric / currentPeriodPosts.length) : 0;
            prevDisplayAvg = prevPeriodPosts.length > 0 ? (prevTotalMetricFromList / prevPeriodPosts.length) : 0;
        }

        let avgGrowth = 0;
        if (prevDisplayAvg > 0) {
            avgGrowth = ((displayAvg - prevDisplayAvg) / prevDisplayAvg) * 100;
        }

        const chartPeakValue = chartDataArr.length > 0 ? Math.max(...chartDataArr.map(p => p.current)) : 0;
        const prevChartPeakValue = chartDataArr.length > 0 ? Math.max(...chartDataArr.map(p => p.previous || 0)) : 0;
        
        let peakGrowth = 0;
        if (prevChartPeakValue > 0) {
            peakGrowth = ((chartPeakValue - prevChartPeakValue) / prevChartPeakValue) * 100;
        }

        const showTrend = timeRange !== 'All Time';
        const formatTrend = (growth) => showTrend ? ((growth >= 0 ? '+' : '') + growth.toFixed(1) + '%') : null;

        return {
            dateRanges,
            stats: [
                { id: 'total', label: `Total ${activeMetric}`, value: activeMetric === 'Engagement Rate' ? displayAvg.toFixed(2) + '%' : currentTotalMetric.toLocaleString(), rawValue: currentTotalMetric, rawPrevValue: prevTotalMetricFromList, trend: formatTrend(totalGrowth), isPositive: totalGrowth >= 0 },
                { id: 'avg', label: `Avg ${activeMetric}`, value: activeMetric === 'Engagement Rate' ? displayAvg.toFixed(2) + '%' : displayAvg.toFixed(0), rawValue: displayAvg, rawPrevValue: prevDisplayAvg, trend: formatTrend(avgGrowth), isPositive: avgGrowth >= 0 },
                { id: 'peak', label: 'Peak Value', value: chartPeakValue.toLocaleString(), rawValue: chartPeakValue, rawPrevValue: prevChartPeakValue, unit: activeMetric === 'Engagement Rate' ? '%' : (activeMetric === 'Views' || activeMetric === 'Reach' ? 'Views' : activeMetric), trend: formatTrend(peakGrowth), isPositive: peakGrowth >= 0 },
                { id: 'growth', label: 'Growth %', value: showTrend ? (totalGrowth.toFixed(1) + '%') : 'N/A', rawValue: totalGrowth, rawPrevValue: 0, trend: null, isPositive: totalGrowth >= 0 },
            ],
            chartData: chartDataArr.length > 0 ? chartDataArr : [{ name: 'No Data', current: 0, previous: 0 }],
            recentPosts: tablePosts,
            aiInsights: [
                { text: `Your ${activeMetric} are ${engGrowth >= 0 ? 'up' : 'down'} by ${Math.abs(engGrowth).toFixed(1)}% compared to the previous period.`, type: engGrowth >= 0 ? 'success' : 'warning' },
                { text: `You've posted ${currentTotalPosts} times in this period. ${currentTotalPosts > prevTotalPosts ? 'Great consistency!' : (currentTotalPosts === 0 ? 'Start posting to see data!' : 'Try to post more frequently to increase reach.')}`, type: 'info' }
            ],
            metricScore,
            rawCurrentPosts: currentPeriodPosts,
            aiPayload: {
                activeMetric,
                timeRange,
                currentTotalMetric,
                prevTotalMetric: prevTotalMetricFromList,
                currentTotalPosts,
                prevTotalPosts,
                currentAvgEngRate,
                prevAvgEngRate
            }
        };
    }, [posts, activeMetric, timeRange, granularity, comparePrevious, sortConfig, analyzeOwnContentOnly]);

    const { stats, chartData, recentPosts, aiInsights, metricScore } = processedData;

    const handleDownload = async () => {
        const csv = await generateCSV(processedData.rawCurrentPosts);
        downloadCSV(csv, `posting_analytics_${timeRange.replace(/\s+/g, '_').toLowerCase()}.csv`);
    };

    const handleGenerateAI = async () => {
        if (!posts) return;

        setIsAiLoading(true);
        setAiError(null);

        try {
            const dataToProcess = analyzeOwnContentOnly ? posts.filter(p => !p?.isRepost) : posts;
            const allPosts = [];
            const seenUrns = new Set();
            dataToProcess.forEach(post => {
                if (!post) return;
                const urn = post.urn || (post.text ? post.text.substring(0, 50) : Math.random().toString());
                if (seenUrns.has(urn)) return;
                seenUrns.add(urn);
                const date = post.urn ? extractTimeFromUrn(post.urn) : null;
                const likes = parseInt(post.stats?.likes || 0);
                const comments = parseInt(post.stats?.comments || 0);
                const reposts = parseInt(post.stats?.reposts || 0);
                const views = parseInt(post.stats?.views || 0);
                const engagement = likes + comments + reposts;
                const engRate = views > 0 ? (engagement / views) * 100 : 0;
                allPosts.push({ ...post, dateObj: date, likes, comments, shares: reposts, views, engRate });
            });
            const sortedPosts = allPosts.sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0));

            const payloads = {};
            const now = new Date();

            for (const range of timeRanges) {
                const getFilterDate = (r) => {
                    const d = new Date();
                    if (r === 'Last 7 Days') d.setDate(now.getDate() - 7);
                    else if (r === 'Last 30 Days') d.setDate(now.getDate() - 30);
                    else if (r === 'Last 90 Days') d.setDate(now.getDate() - 90);
                    else d.setFullYear(now.getFullYear() - 1); // 1 year fallback
                    return d;
                };

                let currentPeriodPosts = [];
                let prevPeriodPosts = [];

                if (/^\d{4}$/.test(range)) {
                    const year = parseInt(range);
                    const startOfYear = new Date(year, 0, 1);
                    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
                    currentPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= startOfYear && p.dateObj <= endOfYear);
                    const startOfPrevYear = new Date(year - 1, 0, 1);
                    const endOfPrevYear = new Date(year - 1, 11, 31, 23, 59, 59, 999);
                    prevPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= startOfPrevYear && p.dateObj <= endOfPrevYear);
                } else {
                    const filterDate = getFilterDate(range);
                    currentPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= filterDate);
                    const diff = now.getTime() - filterDate.getTime();
                    const prevPeriodFilterDate = new Date(filterDate.getTime() - diff);
                    prevPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= prevPeriodFilterDate && p.dateObj < filterDate);
                }

                let currentTotalMetric = 0;
                let prevTotalMetric = 0;
                let currentEngSum = 0;
                let prevEngSum = 0;

                currentPeriodPosts.forEach(p => {
                    if (activeMetric === 'Likes') currentTotalMetric += p.likes;
                    else if (activeMetric === 'Comments') currentTotalMetric += p.comments;
                    else if (activeMetric === 'Shares') currentTotalMetric += p.shares;
                    else if (activeMetric === 'Engagement') currentTotalMetric += p.engagement;
                    else if (activeMetric === 'Views' || activeMetric === 'Reach') currentTotalMetric += p.views;
                    else if (activeMetric === 'Engagement Rate') currentTotalMetric += p.engRate;
                    currentEngSum += p.engRate;
                });

                prevPeriodPosts.forEach(p => {
                    if (activeMetric === 'Likes') prevTotalMetric += p.likes;
                    else if (activeMetric === 'Comments') prevTotalMetric += p.comments;
                    else if (activeMetric === 'Shares') prevTotalMetric += p.shares;
                    else if (activeMetric === 'Engagement') prevTotalMetric += p.engagement;
                    else if (activeMetric === 'Views' || activeMetric === 'Reach') prevTotalMetric += p.views;
                    else if (activeMetric === 'Engagement Rate') prevTotalMetric += p.engRate;
                    prevEngSum += p.engRate;
                });

                const currentTotalPosts = currentPeriodPosts.length;
                const prevTotalPosts = prevPeriodPosts.length;

                if (activeMetric === 'Engagement Rate') {
                    currentTotalMetric = currentTotalPosts > 0 ? (currentTotalMetric / currentTotalPosts) : 0;
                    prevTotalMetric = prevTotalPosts > 0 ? (prevTotalMetric / prevTotalPosts) : 0;
                }

                payloads[range] = {
                    activeMetric,
                    timeRange: range,
                    currentTotalMetric,
                    prevTotalMetric,
                    currentTotalPosts,
                    prevTotalPosts,
                    currentAvgEngRate: currentTotalPosts > 0 ? (currentEngSum / currentTotalPosts) : 0,
                    prevAvgEngRate: prevTotalPosts > 0 ? (prevEngSum / prevTotalPosts) : 0
                };
            }

            const multiSummary = await generatePostingAnalyticsSummary(payloads);
            if (multiSummary) {
                setAiSummaries(prev => {
                    const next = { ...prev, [activeMetric]: multiSummary };
                    try {
                        localStorage.setItem(`kleo_posting_ai_summaries_${profileId}`, JSON.stringify(next));
                    } catch (e) {
                        console.error("Failed to save AI summaries to local storage", e);
                    }
                    return next;
                });
            }
        } catch (err) {
            console.error(err);
            setAiError("Failed to generate insights.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const displayInsights = aiSummaries[activeMetric]?.[timeRange] || aiInsights;
    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 className="richmond-heading" style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--ink)' }}>Posting Analytics</h1>
                    <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--muted)' }}>Track your LinkedIn performance metrics and content engagement over time.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                    {/* Own Content Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--surface-2)', paddingRight: '12px' }}>
                        <div
                            className="switch"
                            onClick={() => setAnalyzeOwnContentOnly(!analyzeOwnContentOnly)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={`switch-track ${analyzeOwnContentOnly ? 'on' : ''}`}>
                                <div className="switch-knob" />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>Own Content</span>
                        </div>
                    </div>
                    {/* Time Range Dropdown */}
                    <div className="dd">
                        <button
                            className="dd-btn"
                            onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Calendar size={15} color="var(--muted)" />
                            {timeRange}
                            <ChevronDown size={14} color="var(--muted)" />
                        </button>
                        {isTimeRangeOpen && (
                            <div className="dd-menu" style={{ right: 0, maxHeight: '300px', overflowY: 'auto' }}>
                                {allTimeRanges.map(range => (
                                    <button
                                        key={range}
                                        onClick={() => {
                                            setTimeRange(range);
                                            setIsTimeRangeOpen(false);
                                        }}
                                        className={`dd-item ${timeRange === range ? 'sel' : ''}`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ color: 'var(--muted)', cursor: 'pointer' }}><Info size={20} /></div>
                </div>
            </div>

            {/* Metric Selection Tabs */}
            <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div className="tabs">
                        {metrics.map(m => (
                            <button
                                key={m}
                                onClick={() => setActiveMetric(m)}
                                className={`tab ${activeMetric === m ? 'on' : ''}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        {/* Compare Toggle */}
                        <div className="switch" style={{ cursor: 'pointer' }} onClick={() => setComparePrevious(!comparePrevious)}>
                            <span style={{ fontSize: '13px', color: 'var(--ink-2)', fontWeight: '500' }}>Compare with previous</span>
                            <div className={`switch-track ${comparePrevious ? 'on' : ''}`}>
                                <div className="switch-knob" />
                            </div>
                        </div>

                        {/* Chart Toggle */}
                        <div className="seg">
                            <button
                                onClick={() => setChartType('area')}
                                className={`seg-btn ${chartType === 'area' ? 'on' : ''}`}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            ><LineChartIcon size={15} /></button>
                            <button
                                onClick={() => setChartType('bar')}
                                className={`seg-btn ${chartType === 'bar' ? 'on' : ''}`}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            ><BarChart3 size={15} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '24px' }}>
                {stats.map((stat, idx) => {
                    const colors = ['stat-peach', 'stat-blue', 'stat-mint', 'stat-gray'];
                    const statClass = colors[idx % 4];
                    const isSelected = selectedStatGroup === stat.id;

                    return (
                        <div 
                            key={idx} 
                            onClick={() => setSelectedStatGroup(isSelected ? null : stat.id)}
                            className={`stat ${statClass}`}
                            style={{ 
                                cursor: 'pointer',
                                border: isSelected ? '2px solid var(--accent-deep)' : '2px solid transparent',
                                padding: '18px',
                                minHeight: 'auto',
                                gap: '8px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--ink-2)', opacity: 0.8 }}>{stat.label}</span>
                                <Info size={13} color="var(--ink-2)" style={{ opacity: 0.6 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                                <span className="richmond-heading" style={{ fontSize: '26px', fontWeight: '800', color: 'var(--ink)' }}>
                                    {stat.value}
                                    {stat.unit && <span style={{ fontSize: '12px', color: 'var(--ink-2)', marginLeft: '4px', fontWeight: '600', opacity: 0.7 }}>{stat.unit}</span>}
                                </span>
                                {stat.trend && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: '700', color: stat.isPositive ? '#2E7D32' : '#C62828' }}>
                                        {stat.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {stat.trend}
                                    </div>
                                )}
                            </div>

                            {/* Detailed Data Popover */}
                            {isSelected && (
                                <div 
                                    style={{ 
                                        position: 'absolute', top: '105%', left: '0', width: '100%', minWidth: '220px', 
                                        backgroundColor: 'var(--card)', borderRadius: 'var(--r-card)', padding: '16px', 
                                        boxShadow: 'var(--sh-lg)', 
                                        border: '1px solid var(--surface-2)', zIndex: 10 
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Detailed Comparison
                                    </div>
                                    
                                    {stat.id === 'growth' ? (
                                        <>
                                            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '3px' }}>
                                                Growth compared to Previous {timeRange.replace('Last ', '')}
                                            </div>
                                            <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--ink)', marginBottom: '12px' }}>
                                                {processedData.dateRanges.currentStart} - {processedData.dateRanges.currentEnd}
                                            </div>
                                            
                                            <div style={{ height: '1px', backgroundColor: 'var(--surface-2)', margin: '12px 0' }} />
                                            
                                            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '3px' }}>
                                                Previous {timeRange.replace('Last ', '')} Period
                                            </div>
                                            <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>
                                                {processedData.dateRanges.prevStart} - {processedData.dateRanges.prevEnd}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '3px' }}>Current Period</div>
                                                <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>
                                                    {processedData.dateRanges.currentStart} - {processedData.dateRanges.currentEnd}
                                                </div>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-deep)' }}>
                                                    {typeof stat.rawValue === 'number' ? (stat.id === 'avg' && activeMetric !== 'Engagement Rate' ? Math.round(stat.rawValue).toLocaleString() : (stat.rawValue % 1 !== 0 ? stat.rawValue.toFixed(2) : stat.rawValue.toLocaleString())) : stat.rawValue}
                                                </div>
                                            </div>

                                            <div style={{ height: '1px', backgroundColor: 'var(--surface-2)', margin: '12px 0' }} />

                                            {timeRange !== 'All Time' ? (
                                                <div>
                                                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '3px' }}>Previous Period</div>
                                                    <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>
                                                        {processedData.dateRanges.prevStart} - {processedData.dateRanges.prevEnd}
                                                    </div>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--muted)' }}>
                                                        {typeof stat.rawPrevValue === 'number' ? (stat.id === 'avg' && activeMetric !== 'Engagement Rate' ? Math.round(stat.rawPrevValue).toLocaleString() : (stat.rawPrevValue % 1 !== 0 ? stat.rawPrevValue.toFixed(2) : stat.rawPrevValue.toLocaleString())) : stat.rawPrevValue}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--muted)' }}>No previous period for 'All Time'</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Main Content: Chart then AI Insights below */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
                {/* Performance Trend Chart Card */}
                <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>Performance Trend</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}>{activeMetric} over the {timeRange.toLowerCase()} compared to previous period</p>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-deep)' }} />
                                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--muted)' }}>Current</span>
                            </div>
                            {actualComparePrevious && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px dashed var(--muted-2)' }} />
                                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--muted)' }}>Previous</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ height: '340px', width: '100%', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={chartData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                onClick={(data) => {
                                    if (data && data.activePayload && data.activePayload.length > 0) {
                                        setSelectedChartNode(data.activePayload[0].payload);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <defs>
                                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor='var(--accent)' stopOpacity={0.15} />
                                        <stop offset="95%" stopColor='var(--accent)' stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-2)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--muted)' }}
                                    dy={10}
                                    tickFormatter={(val) => {
                                        if (!val) return '';
                                        if (granularity === 'Monthly') return val.replace(' (To Date)', '');
                                        if (granularity === 'Yearly') return val;
                                        if (val.includes(' - ')) {
                                            let parts = val.split(' - ');
                                            if (parts[1].includes(',')) parts[1] = parts[1].split(',')[0];
                                            return `${parts[0]} - ${parts[1]}`;
                                        }
                                        return val;
                                    }}
                                />
                                <YAxis hide />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div style={{ backgroundColor: 'var(--dark)', padding: '12px', borderRadius: '8px', color: 'var(--on-dark)', border: 'none', boxShadow: 'var(--sh-lg)' }}>
                                                    <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>{payload[0].payload.name}</div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', fontSize: '12px', marginBottom: '4px' }}>
                                                        <span style={{ color: 'var(--on-dark-mute)' }}>Current:</span>
                                                        <span style={{ fontWeight: '700' }}>{parseFloat(payload[0].value).toFixed(activeMetric === 'Engagement Rate' ? 1 : 0)} {activeMetric === 'Engagement Rate' ? '%' : ''}</span>
                                                    </div>
                                                    {payload.length > 1 && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', fontSize: '12px' }}>
                                                            <span style={{ color: 'var(--on-dark-mute)' }}>{payload[0].payload.prevName ? `Prev (${payload[0].payload.prevName}):` : 'Previous:'}</span>
                                                            <span style={{ fontWeight: '700', color: 'var(--on-dark-mute)' }}>{parseFloat(payload[1].value).toFixed(activeMetric === 'Engagement Rate' ? 1 : 0)} {activeMetric === 'Engagement Rate' ? '%' : ''}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                {chartType === 'area' ? (
                                    <>
                                        <Area
                                            type="monotone"
                                            dataKey="current"
                                            stroke='var(--accent-deep)'
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorCurrent)"
                                            dot={{ r: 4, fill: 'var(--accent-deep)', strokeWidth: 0 }}
                                            activeDot={{
                                                onClick: (e, payload) => {
                                                    if (payload && payload.payload) {
                                                        setSelectedChartNode(payload.payload);
                                                    }
                                                },
                                                cursor: 'pointer'
                                            }}
                                        />
                                        {actualComparePrevious && <Area type="monotone" dataKey="previous" stroke="var(--muted-2)" strokeWidth={2} fill="transparent" strokeDasharray="5 5" dot={{ r: 4, fill: 'var(--muted-2)', strokeWidth: 0 }} />}
                                    </>
                                ) : (
                                    <>
                                        <Bar
                                            dataKey="current"
                                            fill='var(--accent-deep)'
                                            radius={[4, 4, 0, 0]}
                                            onClick={(data) => {
                                                if (data && data.payload) {
                                                    setSelectedChartNode(data.payload);
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        {actualComparePrevious && <Bar dataKey="previous" fill="var(--muted-2)" radius={[4, 4, 0, 0]} />}
                                    </>
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AI Insights Card */}
                <div className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={20} fill="var(--accent-deep)" color="var(--accent-deep)" />
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink)' }}>AI Insights</h3>
                        </div>

                        {!isAiLoading && (
                            <button
                                onClick={handleGenerateAI}
                                className="btn btn-blue btn-sm"
                            >
                                <Zap size={12} fill="currentColor" />
                                {aiSummaries[activeMetric]?.[timeRange] ? "Refresh" : "Generate"}
                            </button>
                        )}
                    </div>

                    {aiError && (
                        <div className="callout callout-blue" style={{ marginBottom: '16px', border: '1px solid var(--accent)' }}>
                            <Info size={14} color="var(--accent-deep)" />
                            <span style={{ color: 'var(--ink)' }}>{aiError}</span>
                        </div>
                    )}

                    {isAiLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--muted)' }}>
                            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'var(--accent-deep)', borderRightColor: 'transparent' }}></div>
                            Analyzing your data...
                        </div>
                    ) : !aiSummaries[activeMetric]?.[timeRange] ? (
                        <div className="callout callout-blue">
                            <Info size={16} color="var(--accent-deep)" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <div className="callout-title" style={{ color: 'var(--ink)' }}>AI Insights Available</div>
                                <div className="callout-desc">Generate AI insights to find new engagement opportunities and analytics summaries based on your posting behavior.</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {displayInsights.map((insight, idx) => {
                                let calloutClass = 'callout-blue';
                                let iconColor = 'var(--accent-deep)';
                                if (insight.type === 'success') {
                                    calloutClass = 'callout-green';
                                    iconColor = 'var(--green)';
                                } else if (insight.type === 'warning') {
                                    calloutClass = 'callout-blue';
                                    iconColor = 'var(--orange)';
                                }

                                return (
                                    <div key={idx} className={`callout ${calloutClass}`}>
                                        <Sparkles size={16} color={iconColor} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <div>
                                            <div className="callout-desc" style={{ color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: insight.text }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section: Report Status and Table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)' }}>
                        <Info size={16} />
                        Auto-generated report available
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-deep)', cursor: 'pointer', fontWeight: '600' }}>
                        <Clock size={16} />
                        Schedule weekly report
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="seg">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`seg-btn ${viewMode === 'list' ? 'on' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        ><List size={14} /> List</button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`seg-btn ${viewMode === 'grid' ? 'on' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        ><LayoutGrid size={14} /> Grid</button>
                    </div>
                    <button
                        onClick={handleDownload}
                        className="btn btn-blue"
                        style={{ fontSize: '13px', padding: '9px 16px' }}
                    >
                        <Download size={15} />
                        Download Report
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            {/* Post Breakdown Table */}
            {viewMode === 'list' ? (
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th style={{ padding: '16px 20px' }}>Post Content</th>
                                <th
                                    onClick={() => handleSort('date')}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                    Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                </th>
                                <th
                                    onClick={() => handleSort('engagement')}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                    Engagement {sortConfig.key === 'engagement' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                </th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPosts.map((post, idx) => (
                                <tr key={idx}>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--peach)', overflow: 'hidden', flexShrink: 0 }}>
                                                <img src={`https://ui-avatars.com/api/?name=Design&background=FAE9CF&color=1C1C1E`} alt="" style={{ width: '100%', height: '100%' }} />
                                            </div>
                                            <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--ink)' }}>{post.content}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--muted)', fontWeight: '500' }}>{post.date}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--ink)', width: '40px' }}>{post.engagementDisplay}</span>
                                            <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${post.progress}%`, height: '100%', backgroundColor: 'var(--accent)', borderRadius: '3px' }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => post.url && window.open(post.url, '_blank')}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent',
                                                border: 'none', color: 'var(--accent-deep)', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer'
                                            }}
                                        >
                                            View post <ShareIcon size={13} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ minHeight: '600px', width: '100%' }}>
                    <PostList 
                        posts={[{ extractedPosts: processedData.rawCurrentPosts.slice(0, 10) }]} 
                        sortCriteria="newest" 
                        isGridView={true} 
                        isAnalyticsGrid={true} 
                    />
                </div>
            )}

            {/* Modal for viewing posts of a specific chart node */}
            {selectedChartNode && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 33, 48, 0.3)', backdropFilter: 'blur(4px)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px'
                }}>
                    <div className="card" style={{
                        width: '100%', maxWidth: '800px', height: '80vh', padding: '0',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--card)' }}>
                            <div>
                                <h2 className="richmond-heading" style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--ink)' }}>
                                    Posts on {selectedChartNode.name}
                                </h2>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                                    Found {selectedChartNode.currentPostsList?.length || 0} post{(selectedChartNode.currentPostsList?.length || 0) !== 1 ? 's' : ''} in the selected time range.
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedChartNode(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: 'var(--surface)' }}>
                            {selectedChartNode.currentPostsList && selectedChartNode.currentPostsList.length > 0 ? (
                                <PostList posts={[{ extractedPosts: selectedChartNode.currentPostsList }]} sortCriteria="newest" />
                            ) : (
                                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '15px' }}>
                                    No posts were made during this specific timeframe.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostingAnalytics;

import React, { useState, useMemo, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { ArrowLeft, Calendar, Info, TrendingUp, TrendingDown, Clock, Sparkles, X, Zap } from 'lucide-react';
import { extractTimeFromUrn, getPostDateObj } from '../utils/timeUtils';
import PostList from './PostList';
import { generatePostingHabitsSummary } from '../services/geminiService';

const PostingHabits = ({ posts, profileId }) => {
    const [timeRange, setTimeRange] = useState('30d');
    const [selectedCell, setSelectedCell] = useState(null); // { dayIdx: number, hourIdx: number }
    const [analyzeOwnContentOnly, setAnalyzeOwnContentOnly] = useState(false);

    const timeRanges = ['7d', '30d', '90d', '1y', 'All Time'];

    // AI State
    const [aiSummaries, setAiSummaries] = useState({});

    // Load profile-specific AI summaries
    useEffect(() => {
        if (!profileId) return;
        try {
            const cached = localStorage.getItem(`kleo_habits_ai_summaries_${profileId}`);
            setAiSummaries(cached ? JSON.parse(cached) : {});
        } catch (e) {
            setAiSummaries({});
        }
    }, [profileId]); // { '7d': ..., '30d': ... }
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
                setTimeRange('All Time');
            }
        }
    }, [posts, timeRange]);

    // --- Dynamic Data Processing Helper ---
    const calculateHabitsData = (range, postsToProcess) => {
        if (!postsToProcess || postsToProcess.length === 0) {
            return {
                bestDay: 'N/A', bestDayEng: 0, bestHour: 'N/A', bestHourEng: 0,
                avgFrequency: 0, freqGrowth: 0, bestHourIsEST: true,
                heatmapPosts: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => []))
            };
        }

        const now = new Date();
        const getFilterDate = (r) => {
            const d = new Date();
            if (r === '7d') d.setDate(now.getDate() - 7);
            else if (r === '30d') d.setDate(now.getDate() - 30);
            else if (r === '90d') d.setDate(now.getDate() - 90);
            else if (r === '1y') d.setFullYear(now.getFullYear() - 1);
            else return new Date(0); // 'All Time'
            return d;
        };
        const filterDate = getFilterDate(range);

        // Previous period for growth
        const diff = now - filterDate;
        const prevFilterDate = new Date(filterDate.getTime() - diff);

        let currentPosts = [];
        let prevPosts = [];

        // Deduplicate and enrich
        const seen = new Set();

        postsToProcess.forEach(post => {
            if (!post) return;
            const urn = post.urn || post.text?.substring(0, 20);
            if (!urn || seen.has(urn)) return;
            seen.add(urn);

            const date = getPostDateObj(post);
            if (!date) return;

            const likes = parseInt(post.stats?.likes || 0);
            const comments = parseInt(post.stats?.comments || 0);
            const reposts = parseInt(post.stats?.reposts || 0);
            
            // NEW: Weighted Engagement Score (Algorithm Aware)
            const engagement = (likes * 1) + (comments * 3) + (reposts * 5);

            const enriched = { ...post, dateObj: date, engagement };

            if (date >= filterDate) currentPosts.push(enriched);
            else if (date >= prevFilterDate) prevPosts.push(enriched);
        });

        // Calculate Average Frequency (posts per week)
        const daysInPeriod = (now - filterDate) / (1000 * 60 * 60 * 24);
        const weeksInPeriod = Math.max(daysInPeriod / 7, 1); // Avoid div by 0
        const currFreq = currentPosts.length / weeksInPeriod;

        const prevDaysInPeriod = (filterDate - prevFilterDate) / (1000 * 60 * 60 * 24);
        const prevWeeksInPeriod = Math.max(prevDaysInPeriod / 7, 1);
        const prevFreq = prevPosts.length / prevWeeksInPeriod;

        const freqGrowth = prevFreq > 0 ? ((currFreq - prevFreq) / prevFreq) * 100 : 0;

        const dayStats = { 
            0: { count: 0, eng: 0, scores: [] }, 1: { count: 0, eng: 0, scores: [] }, 2: { count: 0, eng: 0, scores: [] }, 
            3: { count: 0, eng: 0, scores: [] }, 4: { count: 0, eng: 0, scores: [] }, 5: { count: 0, eng: 0, scores: [] }, 6: { count: 0, eng: 0, scores: [] } 
        };
        const hourStats = {}; // 0-23
        const heatmapPosts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => []));

        currentPosts.forEach(p => {
            const day = p.dateObj.getDay(); // 0 (Sun) to 6 (Sat)
            const hour = p.dateObj.getHours();

            dayStats[day].count++;
            dayStats[day].eng += p.engagement;
            dayStats[day].scores.push(p.engagement);

            if (!hourStats[hour]) hourStats[hour] = { count: 0, eng: 0, scores: [] };
            hourStats[hour].count++;
            hourStats[hour].eng += p.engagement;
            hourStats[hour].scores.push(p.engagement);

            heatmapPosts[day][hour].push(p);
        });

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Helper to calculate stability (Consistency Score)
        // Rewards low variance, penalizes high volatility
        const calculateStability = (scores, avg) => {
            if (scores.length < 2) return 1.0;
            const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
            const sd = Math.sqrt(variance);
            const cv = sd / (avg || 1); // Coefficient of Variation
            return 1 / (1 + cv); // Stability Factor (closer to 1 = more stable)
        };

        // NEW: Volume-based selection instead of Advanced Scoring
        let bestDayIdx = -1;
        let highestDayCount = 0;
        
        Object.keys(dayStats).forEach(d => {
            const stat = dayStats[d];
            if (stat.count > highestDayCount) {
                highestDayCount = stat.count;
                bestDayIdx = parseInt(d);
            }
        });

        let bestHourIdx = -1;
        let highestHourCount = 0;

        Object.keys(hourStats).forEach(h => {
            const stat = hourStats[h];
            if (stat.count > highestHourCount) {
                highestHourCount = stat.count;
                bestHourIdx = parseInt(h);
            }
        });

        const formatHour = (hour) => {
            if (hour === -1) return 'N/A';
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const h = hour % 12 || 12;
            return `${h}:00 ${ampm}`;
        };

        return {
            bestDay: bestDayIdx !== -1 ? dayNames[bestDayIdx] : 'N/A',
            bestDayEng: highestDayCount, // Mocking growth% -> Now used for Post Count
            bestHour: formatHour(bestHourIdx),
            bestHourEng: highestHourCount, // Mocking growth% -> Now used for Post Count
            avgFrequency: currFreq.toFixed(1),
            freqGrowth: freqGrowth,
            bestHourIsEST: Intl.DateTimeFormat().resolvedOptions().timeZone.includes('New_York'),
            heatmapPosts
        };
    };

    const processedData = useMemo(() => {
        const dataToProcess = analyzeOwnContentOnly ? posts?.filter(p => !p?.isRepost) : posts;
        return calculateHabitsData(timeRange, dataToProcess);
    }, [posts, timeRange, analyzeOwnContentOnly]);

    const handleGenerateAI = async () => {
        if (!posts) return;

        setIsAiLoading(true);
        setAiError(null);

        try {
            const payloads = {};
            const dataToProcess = analyzeOwnContentOnly ? posts.filter(p => !p?.isRepost) : posts;

            for (const range of timeRanges) {
                const rangeData = calculateHabitsData(range, dataToProcess);
                payloads[range] = {
                    bestDay: rangeData.bestDay,
                    bestDayEng: rangeData.bestDayEng,
                    bestHour: rangeData.bestHour,
                    bestHourEng: rangeData.bestHourEng,
                    avgFrequency: rangeData.avgFrequency,
                    freqGrowth: rangeData.freqGrowth.toFixed(1)
                };
            }

            console.log("Generating Habits AI for ranges:", Object.keys(payloads));
            const multiSummary = await generatePostingHabitsSummary(payloads);

            if (multiSummary) {
                setAiSummaries(multiSummary);
                try {
                    localStorage.setItem(`kleo_habits_ai_summaries_${profileId}`, JSON.stringify(multiSummary));
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

    const { bestDay, bestDayEng, bestHour, bestHourEng, avgFrequency, freqGrowth, bestHourIsEST, heatmapPosts } = processedData;

    // Shift map so Monday is index 0
    const dayDisplayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun mapped to getDay() index
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const timeSlots = Array.from({ length: 24 }, (_, i) => i);

    // Calculate intensity for each cell based on Post Volume
    const getIntensity = (postsInSlot) => {
        if (!postsInSlot || postsInSlot.length === 0) return 0;
        const count = postsInSlot.length;
        if (count >= 5) return 4;
        if (count >= 3) return 3;
        if (count >= 2) return 2;
        return 1;
    };

    // Derived selected posts for model
    const selectedPosts = useMemo(() => {
        if (!selectedCell || !heatmapPosts) return [];
        // Map UI day index (Mon=0) back to getDay() index for array access
        const actualDayIdx = dayDisplayOrder[selectedCell.dayIdx];
        return heatmapPosts[actualDayIdx][selectedCell.hourIdx] || [];
    }, [selectedCell, heatmapPosts]);

    const getIntensityColor = (value) => {
        const colors = ['transparent', 'var(--green-soft)', '#a4c2b0', 'var(--green)', '#4e6554'];
        return colors[value] || colors[0];
    };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header / Breadcrumbs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 className="richmond-heading" style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--ink)' }}>Posting Habits & Timing</h1>
                    <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--muted)' }}>Optimize your LinkedIn presence based on historical engagement data.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Own Content Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--surface-2)', paddingRight: '16px' }}>
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

                    <div className="tabs">
                        {timeRanges.map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`tab ${timeRange === range ? 'on' : ''}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '18px', marginBottom: '24px' }}>
                <div className="stat stat-peach" style={{ minHeight: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', padding: '20px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0, boxShadow: 'var(--sh-sm)' }}>
                        <Calendar size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-2)', opacity: 0.8, marginBottom: '3px' }}>Most Active Day</div>
                        <div className="richmond-heading" style={{ fontSize: '22px', fontWeight: '800', color: 'var(--ink)', marginBottom: '2px' }}>{bestDay}</div>
                        {bestDay !== 'N/A' && (
                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#2E7D32' }}>
                                {bestDayEng} posts
                            </div>
                        )}
                    </div>
                </div>

                <div className="stat stat-blue" style={{ minHeight: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', padding: '20px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0, boxShadow: 'var(--sh-sm)' }}>
                        <Clock size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-2)', opacity: 0.8, marginBottom: '3px' }}>Most Active Time</div>
                        <div className="richmond-heading" style={{ fontSize: '22px', fontWeight: '800', color: 'var(--ink)', marginBottom: '2px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                            {bestHour} {bestHour !== 'N/A' && <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ink-2)', opacity: 0.7 }}>{bestHourIsEST ? 'EST' : 'Local'}</span>}
                        </div>
                        {bestHour !== 'N/A' && (
                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1A237E' }}>
                                {bestHourEng} posts
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: '24px' }}>
                {/* Left Column (Charts) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Engagement Heatmap */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--ink)' }}>Engagement Heatmap</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                                Low
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {[0, 1, 2, 3, 4].map(val => (
                                        <div key={val} style={{
                                            width: '16px', height: '16px', backgroundColor: getIntensityColor(val), borderRadius: '2px',
                                            border: val === 0 ? '1px solid var(--surface-2)' : 'none'
                                        }} />
                                    ))}
                                </div>
                                High
                             </div>
                        </div>

                        {/* Heatmap Grid implementation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Time labels above */}
                            <div style={{ display: 'flex', paddingLeft: '40px', marginBottom: '4px', color: 'var(--muted)', fontSize: '10px', fontWeight: '600' }}>
                                <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}><span style={{ position: 'absolute', left: '-14px', top: '-6px' }}>12 AM</span></div>
                                <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}><span style={{ position: 'absolute', left: '-12px', top: '-6px' }}>6 AM</span></div>
                                <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}><span style={{ position: 'absolute', left: '-14px', top: '-6px' }}>12 PM</span></div>
                                <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}><span style={{ position: 'absolute', left: '-12px', top: '-6px' }}>6 PM</span></div>
                            </div>

                            {days.map((day, uiDayIdx) => {
                                const actualDayIdx = dayDisplayOrder[uiDayIdx];
                                return (
                                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '32px', fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>{day}</div>
                                        <div style={{ display: 'flex', flex: 1, gap: '6px' }}>
                                            {timeSlots.map(timeIdx => {
                                                const slotPosts = heatmapPosts ? heatmapPosts[actualDayIdx][timeIdx] : [];
                                                const intensity = getIntensity(slotPosts);
                                                const isSelected = selectedCell?.dayIdx === uiDayIdx && selectedCell?.hourIdx === timeIdx;

                                                let tooltipTitle = `${day} at ${timeIdx % 12 === 0 ? 12 : timeIdx % 12} ${timeIdx >= 12 ? 'PM' : 'AM'}`;
                                                const totalEng = slotPosts.reduce((sum, p) => sum + (p.engagement || 0), 0);
                                                let tooltipDesc = `Posts: ${slotPosts.length} | Score: ${totalEng}`;

                                                return (
                                                    <div
                                                        key={timeIdx}
                                                        onClick={() => setSelectedCell({ dayIdx: uiDayIdx, hourIdx: timeIdx })}
                                                        title={`${tooltipTitle}\n${tooltipDesc}`}
                                                        style={{
                                                            flex: 1,
                                                            aspectRatio: '1/1',
                                                            height: 'auto',
                                                            backgroundColor: getIntensityColor(intensity),
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            boxShadow: isSelected ? '0 0 0 2px var(--dark)' : 'none',
                                                            transform: isSelected ? 'scale(1.15)' : 'none',
                                                            transition: 'all 0.1s ease',
                                                            border: intensity === 0 ? '1px solid var(--surface-2)' : '1px solid transparent',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Posting Frequency — Day Bubbles */}
                    {(() => {
                        const dayFullNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        const dayOrder = [1, 2, 3, 4, 5, 6, 0];
                        const dayCounts = dayOrder.map(dayIdx => {
                            const count = heatmapPosts
                                ? heatmapPosts[dayIdx].reduce((sum, slot) => sum + slot.length, 0)
                                : 0;
                            return { day: dayShortNames[dayIdx], fullDay: dayFullNames[dayIdx], count, dayIdx };
                        });

                        const maxCount = Math.max(1, ...dayCounts.map(d => d.count));
                        const minSize = 60;
                        const maxSize = 140;
                        const getSize = (count) => count === 0
                            ? minSize
                            : Math.round(minSize + (count / maxCount) * (maxSize - minSize));

                        const getColor = (count) => {
                            if (count === 0) return { bg: 'var(--surface-2)', text: 'var(--muted)', border: 'var(--surface-2)' };
                            const ratio = count / maxCount;
                            if (ratio >= 0.75) return { bg: '#4e6554', text: '#ffffff', border: '#3d5143' };
                            if (ratio >= 0.5)  return { bg: 'var(--green)', text: '#ffffff', border: 'var(--green)' };
                            if (ratio >= 0.25) return { bg: '#a4c2b0', text: 'var(--ink)', border: '#8aaa98' };
                            return { bg: 'var(--green-soft)', text: 'var(--ink)', border: 'var(--green-soft)' };
                        };

                        return (
                            <div className="card" style={{ flex: 1 }}>
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--ink)' }}>Posting Frequency</h3>
                                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>Posts by day of week — bubble size reflects volume</div>
                                </div>

                                <div style={{ position: 'relative', width: '100%', height: '280px', overflow: 'visible' }}>
                                    {dayCounts.map((item, i) => {
                                        const size = getSize(item.count);
                                        const colors = getColor(item.count);
                                        const cloudPositions = [
                                            [15, 35],
                                            [25, 55],
                                            [12, 75],
                                            [50, 45],
                                            [85, 35],
                                            [75, 55],
                                            [88, 75],
                                        ];
                                        const [leftPct, topPct] = cloudPositions[i];

                                        return (
                                            <div
                                                key={item.day}
                                                title={`${item.fullDay}: ${item.count} post${item.count !== 1 ? 's' : ''}`}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${leftPct}%`,
                                                    top: `${topPct}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    width: `${size}px`,
                                                    height: `${size}px`,
                                                    borderRadius: '50%',
                                                    backgroundColor: colors.bg,
                                                    border: `2px solid ${colors.border}`,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '2px',
                                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                                    cursor: 'default',
                                                    boxShadow: 'var(--sh-sm)',
                                                    zIndex: 1,
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)';
                                                    e.currentTarget.style.boxShadow = 'var(--sh-lg)';
                                                    e.currentTarget.style.zIndex = '10';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.transform = 'translate(-50%, -50%)';
                                                    e.currentTarget.style.boxShadow = 'var(--sh-sm)';
                                                    e.currentTarget.style.zIndex = '1';
                                                }}
                                            >
                                                <span style={{
                                                    fontSize: size >= 100 ? '13px' : '11px',
                                                    fontWeight: '700',
                                                    color: colors.text,
                                                    lineHeight: 1,
                                                    userSelect: 'none',
                                                }}>
                                                    {item.day}
                                                </span>
                                                <span style={{
                                                    fontSize: size >= 100 ? '22px' : size >= 80 ? '17px' : '14px',
                                                    fontWeight: '800',
                                                    color: colors.text,
                                                    lineHeight: 1,
                                                    userSelect: 'none',
                                                }}>
                                                    {item.count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Legend */}
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                    {[
                                        { bg: 'var(--green-soft)', label: 'Low' },
                                        { bg: '#a4c2b0', label: '' },
                                        { bg: 'var(--green)', label: '' },
                                        { bg: '#4e6554', label: 'High' },
                                    ].map(({ bg, label }) => (
                                        <React.Fragment key={bg}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: bg }} />
                                            {label && <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '600', marginRight: '4px' }}>{label}</span>}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Right Column (Widgets) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* AI Recommendations */}
                    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles size={20} fill="var(--accent-deep)" color="var(--accent-deep)" style={{ flexShrink: 0 }} />
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink)', whiteSpace: 'nowrap' }}>AI Recommendations</h3>
                            </div>

                            {!isAiLoading && (
                                <button
                                    onClick={handleGenerateAI}
                                    className="btn btn-blue btn-sm"
                                >
                                    <Zap size={12} fill="currentColor" />
                                    {aiSummaries[timeRange] ? "Refresh" : "Generate"}
                                </button>
                            )}
                        </div>

                        {aiError && (
                            <div className="callout callout-blue" style={{ marginBottom: '16px', border: '1px solid var(--accent)' }}>
                                <Info size={14} color="var(--accent-deep)" />
                                <span style={{ color: 'var(--ink)' }}>{aiError}</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1 }}>
                            {(() => {
                                const currentSummary = aiSummaries[timeRange];

                                return (
                                    <>
                                        <div className="callout callout-green">
                                            <Sparkles size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                            <div>
                                                <div className="callout-title" style={{ color: 'var(--ink)' }}>OPPORTUNITY</div>
                                                <div className="callout-desc" style={{ color: 'var(--ink)' }}>
                                                    {isAiLoading ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}> <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderColor: 'var(--green)', borderRightColor: 'transparent' }}></div> Analyzing...</span>
                                                    ) : currentSummary && currentSummary.opportunity ? (
                                                        currentSummary.opportunity
                                                    ) : (
                                                        <span>Generate AI insights to find new engagement opportunities based on your posting habits.</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="callout callout-blue">
                                            <Clock size={16} color="var(--accent-deep)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                            <div>
                                                <div className="callout-title" style={{ color: 'var(--ink)' }}>OPTIMAL SLOT</div>
                                                <div className="callout-desc" style={{ color: 'var(--ink)' }}>
                                                    {isAiLoading ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}> <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderColor: 'var(--accent-deep)', borderRightColor: 'transparent' }}></div> Analyzing...</span>
                                                    ) : currentSummary && currentSummary.optimal_slot ? (
                                                        currentSummary.optimal_slot
                                                    ) : (
                                                        <span>Generate AI insights to determine your next best posting slot.</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal for viewing posts of a specific timeslot */}
            {selectedCell && (
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
                                    Posts on {days[selectedCell.dayIdx]} at {selectedCell.hourIdx % 12 === 0 ? 12 : selectedCell.hourIdx % 12} {selectedCell.hourIdx >= 12 ? 'PM' : 'AM'}
                                </h2>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                                    Found {selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''} in the selected time range.
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedCell(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: 'var(--surface)' }}>
                            {selectedPosts.length > 0 ? (
                                <PostList posts={[{ extractedPosts: selectedPosts }]} sortCriteria="newest" />
                            ) : (
                                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '15px' }}>
                                    No posts were made during this specific hour in the selected timeframe.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostingHabits;

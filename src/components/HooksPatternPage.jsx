import React, { useState, useMemo, useEffect } from 'react';
import {
    Zap, Copy, Sparkles, TrendingUp, TrendingDown,
    ArrowRight, ArrowLeft, ChevronDown, Lightbulb, BarChart2, Check, Layout, Calendar,
    ShieldCheck, Gem, Info, Users
} from 'lucide-react';
// Removed hookAnalysis import
import { polishTemplateWithLLM } from '../utils/geminiService';
import DashboardFeedItem from './DashboardFeedItem';



import Icon from './Icon';

const getBadgeConfig = (badgeText) => {
    if (badgeText === 'Hidden Gem') return { className: 'pill pill-blue', color: 'var(--accent-deep)', icon: Gem };
    if (badgeText === 'Viral Potential') return { className: 'pill pill-orange', color: '#C97A33', icon: Zap };
    return { className: 'pill pill-green', color: '#3F8C4D', icon: ShieldCheck };
};

const BadgeLegend = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '14px 16px', border: '1px solid var(--accent-fill)', backgroundColor: 'var(--accent-wash)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Gem size={14} color="var(--accent-deep)" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-deep)' }}>Hidden Gem</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: '1.45' }}>
                High engagement but low posts. <br />
                <strong style={{ color: 'var(--ink)' }}>Action:</strong> Post more of this to grow faster.
            </div>
        </div>

        <div style={{ padding: '14px 16px', border: '1px solid var(--orange)', backgroundColor: 'var(--orange-soft)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Zap size={14} color="#C97A33" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#C97A33' }}>Viral Potential</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: '1.45' }}>
                Explosive reach and engagement. <br />
                <strong style={{ color: 'var(--ink)' }}>Action:</strong> Use this for your best ideas.
            </div>
        </div>

        <div style={{ padding: '14px 16px', border: '1px solid var(--green)', backgroundColor: 'var(--green-soft)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <ShieldCheck size={14} color="#3F8C4D" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#3F8C4D' }}>Reliable Staple</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: '1.45' }}>
                Consistent performance. <br />
                <strong style={{ color: 'var(--ink)' }}>Action:</strong> Use this for daily content.
            </div>
        </div>
    </div>
);

const HooksPatternPage = ({ posts = [], initialParams = null }) => {
    const [timeframe, setTimeframe] = useState('all');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [sortBy, setSortBy] = useState('frequency'); // 'frequency' or 'engagement'
    const [analyzeOwnContentOnly, setAnalyzeOwnContentOnly] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState(null);
    const [targetPatternName, setTargetPatternName] = useState(null);
    const [activeTab, setActiveTab] = useState('structure'); // structure, polish, examples
    const [polishedTemplate, setPolishedTemplate] = useState(null);
    const [isPolishing, setIsPolishing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

    // --- 1. Data Analysis ---

    const filteredPosts = useMemo(() => {
        if (!posts) return [];
        if (analyzeOwnContentOnly) {
            return posts.filter(p => !p.isRepost);
        }
        return posts;
    }, [posts, analyzeOwnContentOnly]);

    const [analysis, setAnalysis] = useState({ patterns: [], meta: null });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!filteredPosts || filteredPosts.length === 0) {
            setAnalysis({ patterns: [], meta: null });
            return;
        }

        setLoading(true);
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'analyze_patterns',
                posts: filteredPosts,
                timeframe: timeframe
            }, (response) => {
                setLoading(false);
                if (response && response.success) {
                    setAnalysis({ patterns: response.patterns || [], meta: response.meta });
                } else {
                    setAnalysis({ patterns: [], meta: null });
                }
            });
        } else {
            setLoading(false);
        }
    }, [filteredPosts, timeframe]);

    const patterns = useMemo(() => {
        let pats = [...analysis.patterns];
        if (sortBy === 'frequency') {
            pats.sort((a, b) => parseFloat(b.stats.frequency) - parseFloat(a.stats.frequency));
        } else if (sortBy === 'engagement') {
            pats.sort((a, b) => parseFloat(b.stats.avgEngagement) - parseFloat(a.stats.avgEngagement));
        } else if (sortBy === 'potential') {
            pats.sort((a, b) => parseFloat(b.stats.efficiencyScore) - parseFloat(a.stats.efficiencyScore));
        }
        return pats;
    }, [analysis.patterns, sortBy]);

    const meta = analysis.meta;

    // Handle Initial Params Navigation
    useEffect(() => {
        if (initialParams) {
            if (initialParams.timeframe) {
                setTimeframe(initialParams.timeframe);
            }
            if (initialParams.patternName) {
                setTargetPatternName(initialParams.patternName);
            }
        }
    }, [initialParams]);

    // Set initial selected pattern or target pattern
    useEffect(() => {
        if (patterns.length > 0) {
            // Priority 1: Specific Target from Navigation
            if (targetPatternName) {
                const match = patterns.find(p => p.name === targetPatternName);
                if (match) {
                    setSelectedPattern(match);
                    setTargetPatternName(null); // Clear target once found
                    return;
                }
            }

            // Priority 2: Maintain Current Selection (if valid in new list)
            if (selectedPattern) {
                const match = patterns.find(p => p.fingerprint === selectedPattern.fingerprint);
                if (match) {
                    setSelectedPattern(match);
                    return;
                }
            }

            // Priority 3: Default to First
            setSelectedPattern(patterns[0]);
        } else {
            setSelectedPattern(null);
        }
    }, [patterns, targetPatternName]);

    // Reset polished template when pattern changes
    useEffect(() => {
        setPolishedTemplate(null);
        setCopied(false);
    }, [selectedPattern]);

    // --- 2. Handlers ---
    const handlePolish = async () => {
        if (!selectedPattern || isPolishing) return;

        setIsPolishing(true);
        setActiveTab('polish');

        try {
            const inputTemplate = selectedPattern.template;
            const result = await polishTemplateWithLLM(inputTemplate);
            if (result) {
                setPolishedTemplate(result);
            }
        } catch (e) {
            console.error("Polish failed", e);
        } finally {
            setIsPolishing(false);
        }
    };

    const handleCopy = () => {
        const text = activeTab === 'polish' && polishedTemplate
            ? polishedTemplate.template
            : selectedPattern?.template;

        if (text) {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // --- 3. Render Helpers ---
    const renderVelocityBar = (velocity) => {
        const percentage = Math.min(100, Math.max(10, velocity * 20));
        return (
            <div className="prog" style={{ marginTop: '8px', height: '4px' }}>
                <div className="prog-fill" style={{ width: `${percentage}%`, backgroundColor: 'var(--accent-deep)' }} />
            </div>
        );
    };

    if (!posts || posts.length === 0) {
        return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading posts or no data available...</div>;
    }

    return (
        <div className="view" style={{ padding: '24px' }}>

            {/* Top Navigation & Controls Bar */}
            <div className="page-head" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="richmond-heading" style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--ink)' }}>Hooks &amp; Patterns</h1>
                    <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--muted)' }}>Discover the content structures and writing patterns that drive your highest engagement.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                    {/* Own Content Toggle */}
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

                    <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--surface-2)' }} />

                    {/* SORT Toggle */}
                    <div className="dd">
                        <button
                            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                            className="dd-btn"
                            style={{ cursor: 'pointer' }}
                        >
                            Sort by: <span style={{ fontWeight: '600' }}>{sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}</span>
                            <ChevronDown size={14} color="var(--muted)" />
                        </button>
                        {isSortMenuOpen && (
                            <div className="dd-menu" style={{ right: 0 }}>
                                {['frequency', 'engagement', 'potential'].map(option => (
                                    <button
                                        key={option}
                                        onClick={() => {
                                            setSortBy(option);
                                            setIsSortMenuOpen(false);
                                        }}
                                        className={`dd-item ${sortBy === option ? 'sel' : ''}`}
                                    >
                                        <span style={{ textTransform: 'capitalize' }}>{option}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--surface-2)' }} />

                    {/* Time Toggle */}
                    <div className="dd">
                        <button
                            onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
                            className="dd-btn"
                            style={{ cursor: 'pointer' }}
                        >
                            <Calendar size={14} color="var(--muted)" />
                            {timeframe === 'all' ? 'All time' : timeframe}
                            <ChevronDown size={14} color="var(--muted)" />
                        </button>
                        {isTimeRangeOpen && (
                            <div className="dd-menu" style={{ right: 0, maxHeight: '300px', overflowY: 'auto' }}>
                                {['30d', '60d', '90d', 'All time'].map(range => {
                                    const valueFormat = range === 'All time' ? 'all' : range;
                                    return (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setTimeframe(valueFormat);
                                                setIsTimeRangeOpen(false);
                                            }}
                                            className={`dd-item ${timeframe === valueFormat ? 'sel' : ''}`}
                                        >
                                            {range}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Badge Legend */}
            <BadgeLegend />

            {/* Pattern Cards (Horizontal Scroll) */}
            <div className="hscroll">
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '180px' }}>
                        <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    </div>
                ) : patterns.slice(0, 5).map((pattern, idx) => {
                    const isSelected = selectedPattern && selectedPattern.fingerprint === pattern.fingerprint;
                    return (
                        <div
                            key={idx}
                            onClick={() => setSelectedPattern(pattern)}
                            className={`pcard ${isSelected ? 'sel' : ''}`}
                        >
                            <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '12px', fontWeight: '700', color: 'var(--muted)' }}>
                                #{idx + 1}
                            </div>

                            {/* Smart Badges */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                {pattern.badges && pattern.badges.map((badge, bIdx) => {
                                    const badgeConfig = getBadgeConfig(badge.text);
                                    const IconComponent = badgeConfig.icon;
                                    return (
                                        <div key={bIdx} title={badge.tooltip} className={badgeConfig.className}>
                                            <IconComponent size={10} fill="currentColor" />
                                            {badge.text}
                                        </div>
                                    );
                                })}
                            </div>

                            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ink)', margin: '0 0 16px 0', paddingRight: '20px', height: '40px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {pattern.name}
                            </h3>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                                <span>Frequency</span>
                                <span style={{ fontWeight: '700', color: 'var(--accent-deep)' }}>
                                    {pattern.stats.frequency}%
                                </span>
                            </div>
                            {renderVelocityBar(pattern.stats.frequency / 100 * 5)}

                            <button className={`btn btn-sm ${isSelected ? 'btn-blue' : 'btn-ghost'}`} style={{ width: '100%', marginTop: '16px' }}>
                                Use Template
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Area: Split View */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px', marginTop: '24px' }}>

                {/* Left: Template Workshop */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '520px', padding: 0 }}>
                    {/* Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F0F0F2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Template Workshop
                            </span>
                            <div style={{ height: '16px', width: '1px', backgroundColor: 'var(--surface-2)' }}></div>
                            <div className="tabs">
                                {['structure', 'polish', 'examples'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`tab ${activeTab === tab ? 'on' : ''}`}
                                    >
                                        {tab === 'polish' ? 'AI Polish' : tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Layout size={18} color="var(--muted)" />
                    </div>

                    {/* Editor Area */}
                    <div style={{ flex: 1, padding: '24px', position: 'relative', overflowY: activeTab === 'examples' ? 'auto' : 'hidden' }}>
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
                                <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            </div>
                        ) : selectedPattern ? (
                            <>
                                {activeTab === 'examples' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {selectedPattern.stats && selectedPattern.stats.posts && selectedPattern.stats.posts.length > 0 ? (
                                            selectedPattern.stats.posts.map((post, idx) => (
                                                <div key={idx} style={{ borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
                                                    <DashboardFeedItem post={post} index={idx} />
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                                                No examples found for this pattern.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {activeTab === 'polish' && !polishedTemplate ? (
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                height: '100%', gap: '16px', color: 'var(--muted)', minHeight: '300px'
                                            }}>
                                                <Sparkles size={48} color="var(--muted-2)" />
                                                <div style={{ textAlign: 'center' }}>
                                                    <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: 'var(--ink)' }}>AI Polish Not Generated</p>
                                                    <p style={{ margin: 0, fontSize: '13px', maxWidth: '300px' }}>
                                                        Generate a high-converting variation of this pattern using our AI model.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handlePolish}
                                                    className="btn btn-blue"
                                                    style={{ gap: '6px' }}
                                                >
                                                    <Sparkles size={16} />
                                                    Generate AI Version
                                                </button>
                                            </div>
                                        ) : (
                                            <textarea
                                                className="tmpl"
                                                style={{ height: '100%', minHeight: '300px' }}
                                                value={
                                                    activeTab === 'polish' && polishedTemplate
                                                        ? polishedTemplate.template
                                                        : (selectedPattern.template || "No template available")
                                                }
                                                readOnly={true}
                                                onChange={() => { }}
                                            />
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justify: 'center', height: '100%', color: 'var(--muted)' }}>
                                Select a pattern to view template
                            </div>
                        )}

                        {isPolishing && (
                            <div style={{
                                position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.85)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', zIndex: 10
                            }}>
                                <Sparkles size={32} className="animate-spin" color="var(--accent-deep)" style={{ animation: 'spin 1.5s linear infinite' }} />
                                <span style={{ marginTop: '12px', fontWeight: '600', color: 'var(--accent-deep)' }}>Polishing with AI...</span>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ 
                        padding: '16px 20px', 
                        borderTop: '1px solid #F0F0F2', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        backgroundColor: 'var(--surface-2)', 
                        borderBottomLeftRadius: 'var(--r-card)', 
                        borderBottomRightRadius: 'var(--r-card)' 
                    }}>
                        <button
                            onClick={handleCopy}
                            className="btn btn-ghost btn-sm"
                            style={{ gap: '6px' }}
                        >
                            {copied ? <Check size={16} color="var(--green)" /> : <Copy size={16} color="var(--ink-2)" />}
                            {copied ? 'Copied' : 'Copy Template'}
                        </button>

                        <button
                            onClick={handlePolish}
                            className="btn btn-blue btn-sm"
                            style={{ gap: '6px' }}
                        >
                            <Sparkles size={16} />
                            Polish with AI
                        </button>
                    </div>
                </div>

                {/* Right: Insights Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {selectedPattern && (
                        <>
                            {/* Key Actionable Insights */}
                            <div className="card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                    <Lightbulb size={20} color="var(--orange)" fill="var(--orange-soft)" />
                                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: '850', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Pattern Keypoints
                                    </h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Hook Strategy */}
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <div style={{ marginTop: '3px', minWidth: '4px', height: '14px', backgroundColor: 'var(--accent-deep)', borderRadius: '2px' }}></div>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Hook Strategy</div>
                                            <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--ink)', fontWeight: '500' }}>
                                                {selectedPattern.description.hookType.includes('Question') && "Start with a provocative question to qualify your audience immediately."}
                                                {selectedPattern.description.hookType.includes('List') && "Use a specific number to promise tangible value and structured advice."}
                                                {selectedPattern.description.hookType.includes('Negative') && "Highlight a common mistake to trigger loss aversion and stop the scroll."}
                                                {selectedPattern.description.hookType.includes('Story') && "Open with a personal 'I' statement to build instant authenticity."}
                                                {selectedPattern.description.hookType.includes('Result') && "Lead with the transformation or specific result to capture ambition."}
                                                {!['Question', 'List', 'Negative', 'Story', 'Result'].some(t => selectedPattern.description.hookType.includes(t)) && "Use a clear, direct statement to set expectations instantly."}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Structure Advice */}
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <div style={{ marginTop: '3px', minWidth: '4px', height: '14px', backgroundColor: 'var(--orange)', borderRadius: '2px' }}></div>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Structure</div>
                                            <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--ink)', fontWeight: '500' }}>
                                                {selectedPattern.description.format === 'List-based' ?
                                                    "Organize content into bullet points. This improves readability significantly on mobile." :
                                                    "Use short, punchy paragraphs. Avoid walls of text to keep retention high."
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    {/* CTA Advice */}
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <div style={{ marginTop: '3px', minWidth: '4px', height: '14px', backgroundColor: 'var(--green)', borderRadius: '2px' }}></div>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', marginBottom: '2px', textTransform: 'uppercase' }}>Closing</div>
                                            <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--ink)', fontWeight: '500' }}>
                                                {selectedPattern.description.cta === 'Hard CTA' && "End with a clear directive (e.g., 'Link in bio') to drive conversion."}
                                                {selectedPattern.description.cta === 'Soft CTA' && "Ask an open-ended question to fuel the comments section."}
                                                {selectedPattern.description.cta === 'No CTA' && "End on a high note or summary. Don't force engagement if it feels unnatural."}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Velocity/Frequency Insight */}
                                    <div className="callout callout-green" style={{ marginTop: '8px', display: 'block' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#3F8C4D', marginBottom: '4px' }}>
                                            <TrendingUp size={14} /> Performance Insight
                                        </div>
                                        <div className="callout-desc" style={{ color: '#2B6135', margin: 0 }}>
                                            This pattern appears in <strong>{selectedPattern.stats.frequency}%</strong> of your top posts.
                                            {parseFloat(selectedPattern.stats.frequency) > 20 ? " It's a core driver of your growth." : " Use it to diversify your content mix."}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Summary */}
                            <div className="card">
                                <h3 style={{ margin: '0 0 14px 0', fontSize: '12.5px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase' }}>Pattern Data</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--surface-2)', borderRadius: '12px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Avg Engagement</div>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--ink)' }}>{selectedPattern.stats.avgEngagement}</div>
                                    </div>
                                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--surface-2)', borderRadius: '12px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Posts Count</div>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--ink)' }}>{selectedPattern.stats.count}</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};

export default HooksPatternPage;

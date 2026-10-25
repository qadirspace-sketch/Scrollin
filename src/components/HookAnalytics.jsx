import React, { useMemo } from 'react';
import { X, Award, Zap, Layout, ArrowRight, HelpCircle, Copy, Check } from 'lucide-react';
// Removed hookAnalysis import
import { generateDeterministicTemplate } from '../utils/templateEngine';
import { polishTemplateWithLLM } from '../utils/geminiService';
import PostItem from './PostItem';

const formatContent = (text) => {
    if (!text) return "";
    // Remove code block markers
    const cleanText = text.replace(/```/g, '');

    // Split by bold markers (**text**)
    const parts = cleanText.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} style={{ color: '#000000' }}>{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
};


const ExpandedTemplateView = ({
    pattern,
    activeTab,
    onTabChange,
    polishedTemplate,
    onClose,
    isPolishing,
    onPolish,
    defaultTemplate
}) => {
    const [copied, setCopied] = React.useState(false);
    const hasPolished = !!polishedTemplate;
    const currentTab = activeTab || (hasPolished ? 'polished' : 'raw');
    const isShowingPolished = currentTab === 'polished' && polishedTemplate;

    const contentToShow = isShowingPolished
        ? polishedTemplate.template
        : (pattern.template || (defaultTemplate ? defaultTemplate.template : ""));

    const handleCopy = () => {
        navigator.clipboard.writeText(contentToShow);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#fff',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            padding: '40px',
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={(e) => e.stopPropagation()}>
            {/* Header with Close, Tabs, Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', color: '#000000', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {pattern.name}
                        {hasPolished && <span style={{ fontSize: '12px', background: '#f8fafc', color: '#166534', padding: '4px 8px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>AI Optimized</span>}
                    </h2>
                    <p style={{ margin: '8px 0 0', color: '#64748b' }}>Full Screen Template View</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                        <button
                            onClick={() => onTabChange(pattern.fingerprint, 'raw')}
                            style={{
                                background: currentTab === 'raw' ? 'white' : 'transparent',
                                color: currentTab === 'raw' ? '#1e293b' : '#64748b',
                                border: 'none', borderRadius: '6px',
                                padding: '8px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                boxShadow: currentTab === 'raw' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Raw
                        </button>
                        <button
                            onClick={() => {
                                if (hasPolished) {
                                    onTabChange(pattern.fingerprint, 'polished');
                                } else {
                                    onPolish(pattern.fingerprint, defaultTemplate);
                                }
                            }}
                            disabled={!hasPolished && isPolishing}
                            style={{
                                background: currentTab === 'polished' ? 'white' : 'transparent',
                                color: currentTab === 'polished' ? '#CC4E2E' : '#64748b',
                                border: 'none', borderRadius: '6px',
                                padding: '8px 16px', fontSize: '14px', fontWeight: '600', cursor: (isPolishing && !hasPolished) ? 'not-allowed' : 'pointer',
                                boxShadow: currentTab === 'polished' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <Zap size={16} fill={currentTab === 'polished' ? "currentColor" : "none"} />
                            {hasPolished ? 'AI Version' : (isPolishing ? 'Optimizing...' : 'Generate AI')}
                        </button>
                    </div>

                    <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>

                    <button
                        onClick={handleCopy}
                        style={{
                            padding: '10px 20px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: 'white',
                            color: copied ? '#CC4E2E' : '#1e293b',
                            borderColor: copied ? '#CC4E2E' : '#e2e8f0',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>

                    <button
                        onClick={onClose}
                        title="Close (Esc)"
                        style={{
                            border: 'none', background: '#f1f5f9', cursor: 'pointer',
                            padding: '10px', borderRadius: '8px', display: 'flex',
                            color: '#64748b'
                        }}>
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '60px',
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                fontSize: '28px', // Big font size as requested
                lineHeight: '1.6',
                color: '#000000',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-family)',
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    {formatContent(contentToShow)}
                </div>
            </div>
        </div>
    );
};

import HookAnalyticsInfo from './HookAnalyticsInfo';

const HookAnalytics = ({ posts = [], isOpen, onClose }) => {

    const [selectedPattern, setSelectedPattern] = React.useState(null);
    const [expandedPattern, setExpandedPattern] = React.useState(null); // { pattern, defaultTemplate }
    const [stats, setStats] = React.useState({ patterns: [], totalAnalyzed: 0 });
    const [copiedIndex, setCopiedIndex] = React.useState(null);
    const [polishedTemplates, setPolishedTemplates] = React.useState({});
    const [polishingFingerprint, setPolishingFingerprint] = React.useState(null);
    const [activeTabs, setActiveTabs] = React.useState({}); // { fingerprint: 'raw' | 'polished' }
    const [timeframe, setTimeframe] = React.useState('short_term'); // 'short_term' | 'long_term'
    const [showInfo, setShowInfo] = React.useState(false);
    const [loadingPatterns, setLoadingPatterns] = React.useState(false);

    const handleTabChange = (fingerprint, tab) => {
        setActiveTabs(prev => ({
            ...prev,
            [fingerprint]: tab
        }));
    };

    // ... (handlePolish remains same) ...

    const handlePolish = async (fingerprint, templateToPolish) => {
        if (!templateToPolish || polishingFingerprint) return;
        setPolishingFingerprint(fingerprint);
        try {
            const polished = await polishTemplateWithLLM(templateToPolish);
            if (polished) {
                setPolishedTemplates(prev => ({
                    ...prev,
                    [fingerprint]: { ...polished, isPolished: true }
                }));
                // Switch to polished tab automatically on success
                setActiveTabs(prev => ({
                    ...prev,
                    [fingerprint]: 'polished'
                }));
            }
        } catch (error) {
            console.error("Polishing failed:", error);
        } finally {
            setPolishingFingerprint(null);
        }
    };

    React.useEffect(() => {
        if (isOpen && posts && posts.length > 0) {
            // User requested to analyze ONLY "user own post NOT repost".
            // So we filter out any post where isRepost is true.
            const originalPosts = posts.filter(post => !post.isRepost);

            setLoadingPatterns(true);
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'analyze_patterns',
                    posts: originalPosts,
                    timeframe: timeframe
                }, (response) => {
                    setLoadingPatterns(false);
                    if (response && response.success) {
                        setStats({
                            patterns: response.patterns || [],
                            meta: response.meta,
                            totalAnalyzed: originalPosts.length
                        });
                    } else {
                        setStats({
                            patterns: [],
                            meta: null,
                            totalAnalyzed: originalPosts.length
                        });
                    }
                    setSelectedPattern(null); // Reset on open
                });
            } else {
                setLoadingPatterns(false);
                setSelectedPattern(null);
            }
        }
    }, [isOpen, posts, timeframe]);

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handlePatternClick = (pattern) => {
        setSelectedPattern(pattern);
    };

    if (!isOpen) return null;

    if (expandedPattern) {
        return (
            <ExpandedTemplateView
                pattern={expandedPattern.pattern}
                defaultTemplate={expandedPattern.defaultTemplate}
                activeTab={activeTabs[expandedPattern.pattern.fingerprint]}
                onTabChange={handleTabChange}
                polishedTemplate={polishedTemplates[expandedPattern.pattern.fingerprint]}
                onClose={() => setExpandedPattern(null)}
                isPolishing={polishingFingerprint === expandedPattern.pattern.fingerprint}
                onPolish={handlePolish}
            />
        );
    }

    // Drill-down View
    if (selectedPattern) {
        return (
            <div className="analytics-overlay" onClick={onClose}>
                <div className="analytics-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                    <div className="analytics-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                onClick={() => setSelectedPattern(null)}
                                style={{
                                    border: 'none', background: 'none', cursor: 'pointer',
                                    color: '#64748b', display: 'flex', alignItems: 'center'
                                }}
                            >
                                <ArrowRight size={20} style={{ transform: 'rotate(180deg)', marginRight: '4px' }} />
                                Back
                            </button>
                            <h3 style={{ margin: 0, fontSize: '18px', color: '#000000' }}>
                                Posts using: {selectedPattern.name}
                            </h3>
                        </div>
                        <button className="close-analytics" onClick={onClose}>
                            <X size={24} />
                        </button>
                    </div>

                    <div className="analytics-content" style={{ padding: '20px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {selectedPattern.stats.posts.map((post, i) => (
                                <div key={i}>
                                    <div style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        borderRadius: '8px 8px 0 0',
                                        border: '1px solid #dbeafe',
                                        borderBottom: 'none',
                                        display: 'inline-block',
                                        marginBottom: '-4px',
                                        position: 'relative',
                                        zIndex: 1
                                    }}>
                                        Engagement: {post.metrics.totalEngagement}
                                    </div>
                                    <div style={{ borderTop: '2px solid #eff6ff' }}>
                                        <PostItem post={post} index={i + 1} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="analytics-overlay" onClick={onClose}>
            <div className="analytics-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', backgroundColor: '#FFFFFF', border: '1px solid #e2e8f0' }}>
                <div className="analytics-header" style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>

                    {/* Use a Column Layout for the Header so things don't get squashed */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* ROW 1: Title & Close Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Award size={24} color="#d97706" />
                                <h2 style={{ margin: 0, fontSize: '20px', color: '#000000' }}>Top Performing Hooks & Patterns</h2>
                                <button
                                    onClick={() => setShowInfo(true)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        padding: '4px', color: '#1a73e8',
                                        display: 'flex', alignItems: 'center'
                                    }}
                                    title="How to use this page?"
                                >
                                    <HelpCircle size={18} />
                                </button>
                            </div>
                            <button className="close-analytics" onClick={onClose}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Info Modal */}
                        <HookAnalyticsInfo isOpen={showInfo} onClose={() => setShowInfo(false)} />

                        {/* ROW 2: Toggle & Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>

                            {/* Timeframe Toggle */}
                            <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex' }}>
                                <button
                                    onClick={() => setTimeframe('short_term')}
                                    style={{
                                        border: 'none', background: timeframe === 'short_term' ? 'white' : 'transparent',
                                        color: timeframe === 'short_term' ? '#0f172a' : '#64748b',
                                        padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                        boxShadow: timeframe === 'short_term' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                        transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Zap size={14} className={timeframe === 'short_term' ? 'text-amber-500' : ''} />
                                    Trending
                                </button>
                                <button
                                    onClick={() => setTimeframe('long_term')}
                                    style={{
                                        border: 'none', background: timeframe === 'long_term' ? 'white' : 'transparent',
                                        color: timeframe === 'long_term' ? '#0f172a' : '#64748b',
                                        padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                        boxShadow: timeframe === 'long_term' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                        transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Award size={14} />
                                    Evergreen
                                </button>
                            </div>

                            {/* Creator Type Badge */}
                            {stats.meta && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    backgroundColor: stats.meta.creatorType === 'Patterned' ? '#DDD4C8' : '#e0f2fe',
                                    color: stats.meta.creatorType === 'Patterned' ? '#15803d' : '#0369a1',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    border: `1px solid ${stats.meta.creatorType === 'Patterned' ? '#bbf7d0' : '#bae6fd'}`
                                }}>
                                    {stats.meta.creatorType === 'Patterned' ? <Check size={14} /> : <HelpCircle size={14} />}
                                    {stats.meta.creatorType} Creator
                                    <span style={{ opacity: 0.7, marginLeft: '4px' }}>
                                        ({Math.round(stats.meta.consistencyScore * 100)}% Consistency)
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* ROW 3: Subtitle/Description */}
                        <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                            {timeframe === 'short_term'
                                ? `Analyzing trending patterns from your top ${Math.min(200, stats.totalAnalyzed)} posts (Last 30-90 days focus)`
                                : `Analyzing proven evergreen patterns from your top ${Math.min(200, stats.totalAnalyzed)} posts (All time best)`
                            }
                        </div>
                    </div>
                </div>

                <div className="analytics-content" style={{ padding: '20px', overflowY: 'auto' }}>
                    {loadingPatterns ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                            <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                    ) : stats.patterns.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                            <Zap size={48} style={{ marginBottom: '16px', color: '#cbd5e1' }} />
                            <p>Not enough data to find patterns yet.</p>
                            <p style={{ fontSize: '12px' }}>Try fetching more posts (at least 10-20 high performing ones).</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {stats.patterns.map((pattern, index) => {
                                // Generate a default template for this pattern to prevent null errors
                                const defaultTemplate = pattern.stats.posts && pattern.stats.posts.length > 0
                                    ? generateDeterministicTemplate(pattern.stats.posts[0], pattern.name)
                                    : null;

                                const polishedTemplate = polishedTemplates[pattern.fingerprint];
                                const hasPolished = !!polishedTemplate;
                                const activeTab = activeTabs[pattern.fingerprint] || (hasPolished ? 'polished' : 'raw');

                                // Determine which template to display. 
                                // Determine which template to display. 
                                const isShowingPolished = activeTab === 'polished' && polishedTemplate;
                                const displayTemplate = isShowingPolished ? polishedTemplate : defaultTemplate;

                                // Ensure we show the correct text content
                                const contentToShow = isShowingPolished
                                    ? polishedTemplate.template
                                    : (pattern.template || (defaultTemplate ? defaultTemplate.template : ""));

                                if (!displayTemplate) return null;

                                const isItemPolishing = polishingFingerprint === pattern.fingerprint;

                                return (
                                    <div key={pattern.fingerprint} style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        backgroundColor: '#fff',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                    }}>
                                        {/* Header: Rank & Name */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        background: index === 0 ? '#fef3c7' : '#f1f5f9',
                                                        color: index === 0 ? '#d97706' : '#64748b',
                                                        width: '28px', height: '28px',
                                                        borderRadius: '50%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 'bold', fontSize: '14px',
                                                        flexShrink: 0
                                                    }}>
                                                        #{index + 1}
                                                    </div>
                                                    <div>
                                                        <h3 style={{ margin: 0, fontSize: '16px', color: '#000000', lineHeight: '1.3' }}>
                                                            {pattern.name}
                                                        </h3>
                                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: '500' }}>
                                                            {pattern.displayFingerprint}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#7B9F85', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span>❤️ {pattern.stats.avgEngagement}</span> <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>avg</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handlePatternClick(pattern)}
                                                style={{
                                                    fontSize: '12px', color: '#7B9F85', background: 'none', border: 'none', cursor: 'pointer',
                                                    textDecoration: 'underline', padding: '0', alignSelf: 'flex-start', marginLeft: '38px'
                                                }}
                                            >
                                                View {pattern.stats.count} Posts & Details
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {/* Stacked: Why It Works */}
                                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                                <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#000000', marginTop: 0, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Zap size={14} /> Why It Works
                                                </h4>
                                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#000000', lineHeight: '1.5' }}>
                                                    <li style={{ marginBottom: '4px' }}>
                                                        <strong>Hook:</strong> {pattern.description.hookType}
                                                    </li>
                                                    <li style={{ marginBottom: '4px' }}>
                                                        <strong>Structure:</strong> {pattern.description.format}
                                                    </li>
                                                    <li>
                                                        <strong>Action:</strong> {pattern.description.cta}
                                                    </li>
                                                </ul>
                                            </div>

                                            {/* Stacked: Template */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    {/* Left: Title */}
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                                        <h4 style={{ margin: 0, color: '#000000', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Layout size={16} style={{ flexShrink: 0 }} />
                                                            <span>
                                                                {displayTemplate.schemaName}
                                                            </span>
                                                        </h4>
                                                    </div>

                                                    {/* Center: Tabs */}
                                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                                        {hasPolished && (
                                                            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
                                                                <button
                                                                    onClick={() => handleTabChange(pattern.fingerprint, 'raw')}
                                                                    style={{
                                                                        background: activeTab === 'raw' ? 'white' : 'transparent',
                                                                        color: activeTab === 'raw' ? '#1e293b' : '#64748b',
                                                                        border: 'none', borderRadius: '4px',
                                                                        padding: '2px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
                                                                        boxShadow: activeTab === 'raw' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                                                    }}
                                                                >
                                                                    Raw
                                                                </button>
                                                                <button
                                                                    onClick={() => handleTabChange(pattern.fingerprint, 'polished')}
                                                                    style={{
                                                                        background: activeTab === 'polished' ? 'white' : 'transparent',
                                                                        color: activeTab === 'polished' ? '#CC4E2E' : '#64748b',
                                                                        border: 'none', borderRadius: '4px',
                                                                        padding: '2px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
                                                                        boxShadow: activeTab === 'polished' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                                        display: 'flex', alignItems: 'center', gap: '2px'
                                                                    }}
                                                                >
                                                                    <Zap size={10} fill={activeTab === 'polished' ? "currentColor" : "none"} /> AI
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right: Actions */}
                                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        {!hasPolished && (
                                                            <button
                                                                onClick={() => handlePolish(pattern.fingerprint, displayTemplate)}
                                                                disabled={isItemPolishing || polishingFingerprint}
                                                                style={{
                                                                    backgroundColor: isItemPolishing ? '#f1f5f9' : '#7B9F85',
                                                                    color: isItemPolishing ? '#94a3b8' : 'white',
                                                                    border: 'none',
                                                                    padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
                                                                    cursor: (isItemPolishing || polishingFingerprint) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                                }}
                                                            >
                                                                <Zap size={12} fill="currentColor" />
                                                                {isItemPolishing ? 'Optimizing...' : 'Polish'}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleCopy(contentToShow, index)}
                                                            style={{
                                                                border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer',
                                                                color: copiedIndex === index ? '#CC4E2E' : '#64748b',
                                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                                fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            {copiedIndex === index ? <Check size={12} /> : <Copy size={12} />}
                                                            {copiedIndex === index ? 'Copied' : 'Copy'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div
                                                    onClick={() => setExpandedPattern({ pattern, defaultTemplate })}
                                                    title="Click to expand full screen"
                                                    style={{
                                                        fontSize: '13px',
                                                        fontFamily: "var(--font-family)",
                                                        color: '#000000',
                                                        background: '#f8fafc',
                                                        padding: '16px',
                                                        borderRadius: '8px',
                                                        whiteSpace: 'pre-wrap',
                                                        maxHeight: '400px',
                                                        overflowY: 'auto',
                                                        border: '1px solid #e2e8f0',
                                                        lineHeight: '1.6',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        position: 'relative'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = '#94a3b8';
                                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }}
                                                >
                                                    <div style={{ position: 'absolute', top: '8px', right: '8px', opacity: 0.5 }}>
                                                        <Layout size={14} />
                                                    </div>
                                                    {formatContent(contentToShow)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HookAnalytics;

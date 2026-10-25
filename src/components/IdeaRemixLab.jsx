import React, { useState, useMemo, useEffect } from 'react';
import Icon from './Icon';
// Removed hookAnalysis import
import { generateRemixIdeas } from '../services/geminiService';

const Dropdown = ({ value, options, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = React.useRef(null);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    return (
        <div className="dd" ref={ref} style={{ width: '100%' }}>
            <button 
                type="button"
                className="dd-btn" 
                onClick={() => setOpen(!open)}
                style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
            >
                {value} 
                <Icon 
                    name="chevD" 
                    size={14} 
                    style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} 
                />
            </button>
            {open && (
                <div className="dd-menu" style={{ width: '100%', maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                    {options.map(o => (
                        <button 
                            key={o} 
                            type="button"
                            className={`dd-item ${o === value ? "sel" : ""}`} 
                            onClick={() => { onChange(o); setOpen(false); }}
                            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            {o} 
                            {o === value && <Icon name="check" size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const IdeaRemixLab = ({ posts }) => {
    const defaultPatterns = [
        "The Contrarian Open",
        "Vulnerable Confession",
        "Numbered Breakdown",
        "The Pattern Interrupt",
        "Before / After Story",
        "The Permission Slip"
    ];

    const [patterns, setPatterns] = useState(defaultPatterns);
    const [loadingPatterns, setLoadingPatterns] = useState(false);
    const [sourcePattern, setSourcePattern] = useState(defaultPatterns[0]);

    useEffect(() => {
        if (!posts || posts.length === 0) {
            setPatterns(defaultPatterns);
            return;
        }

        setLoadingPatterns(true);
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'analyze_patterns',
                posts: posts,
                timeframe: 'all'
            }, (response) => {
                setLoadingPatterns(false);
                if (response && response.success && response.patterns && response.patterns.length > 0) {
                    const uniquePatterns = [...new Set(response.patterns.map(p => p.name))];
                    setPatterns(uniquePatterns);
                    setSourcePattern(uniquePatterns[0]);
                } else {
                    setPatterns(defaultPatterns);
                }
            });
        } else {
            setLoadingPatterns(false);
        }
    }, [posts]);
    const [topic, setTopic] = useState("AI Tools");
    const [customTopic, setCustomTopic] = useState("");
    const [ideas, setIdeas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);

    const topicsList = ["AI Tools", "Career Growth", "Leadership", "Productivity", "Personal Branding", "Startups", "Custom..."];

    const activeTopic = topic === "Custom..." ? (customTopic || "My Niche") : topic;

    const generate = async () => {
        setLoading(true);
        try {
            const results = await generateRemixIdeas(sourcePattern, activeTopic);
            setIdeas(results);
        } catch (e) {
            console.error("AI remixing failed:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="view">
            {/* Page Header */}
            <div className="page-head">
                <div>
                    <div className="page-title">Idea Remix Lab</div>
                    <div className="page-sub">Turn saved patterns into fresh content</div>
                </div>
            </div>

            {/* Form and Results Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 18, alignItems: "start" }}>
                {/* Recipe Settings Card */}
                <div className="card card-pad-lg">
                    <div className="sec-title" style={{ marginBottom: 16 }}>Remix Recipe</div>
                    
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: "var(--muted)", marginBottom: 7 }}>Base pattern</div>
                    <Dropdown value={sourcePattern} options={patterns} onChange={setSourcePattern} />
                    
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: "var(--muted)", margin: "16px 0 7px" }}>Apply to topic</div>
                    <Dropdown value={topic} options={topicsList} onChange={setTopic} />

                    {topic === "Custom..." && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>Custom topic name</div>
                            <input
                                type="text"
                                placeholder="e.g. Web Development"
                                value={customTopic}
                                onChange={(e) => setCustomTopic(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: 'var(--r-chip)',
                                    border: '1px solid var(--surface-2)',
                                    backgroundColor: 'var(--surface-2)',
                                    color: 'var(--ink)',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    )}

                    <button 
                        className="btn btn-blue" 
                        style={{ width: "100%", marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} 
                        onClick={generate} 
                        disabled={loading}
                    >
                        <Icon name="sparkle" size={16} />
                        {loading ? "Remixing…" : "Generate Ideas"}
                    </button>
                </div>

                {/* Generated Ideas Result Card */}
                <div className="card card-pad-lg" style={{ minHeight: 280 }}>
                    <div className="sec-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <div className="sec-title">Generated Ideas</div>
                        {ideas.length > 0 && <span className="pill pill-blue">{ideas.length} drafts</span>}
                    </div>

                    {ideas.length === 0 ? (
                        <div className="empty">
                            <div className="empty-ic"><Icon name="remix" size={26} /></div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>No ideas yet</div>
                            <div style={{ fontSize: 12.5, marginTop: 4 }}>Pick a pattern and topic, then generate.</div>
                        </div>
                    ) : (
                        <div className="col fade-stagger" style={{ gap: 12 }}>
                            {ideas.map((idea, i) => (
                                <div 
                                    key={i} 
                                    className="callout callout-blue" 
                                    style={{ 
                                        flexDirection: "column", 
                                        alignItems: "stretch", 
                                        padding: '16px',
                                        backgroundColor: 'var(--accent-wash)',
                                        border: '1px solid var(--accent-wash)',
                                        borderRadius: 'var(--r-card)',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ fontSize: '13.5px', color: "var(--ink)", lineHeight: 1.5, whiteSpace: 'pre-line' }}>{idea}</div>
                                    <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                                        <button 
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleCopy(idea, i)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <Icon name={copiedIndex === i ? "check" : "download"} size={14} />
                                            {copiedIndex === i ? "Copied!" : "Copy Hook"}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={generate} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Icon name="refresh" size={14} />
                                            Re-Remix
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IdeaRemixLab;

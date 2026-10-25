import React from 'react';
// Removed hookAnalysis import
import Icon from './Icon';

const RightSidebarWidgets = ({ posts = [], onNavigateToHooks }) => {

    // Calculate Trending Patterns (Last 30 Days)
    const [topPatterns, setTopPatterns] = React.useState([]);
    const [loadingPatterns, setLoadingPatterns] = React.useState(false);

    React.useEffect(() => {
        if (!posts || posts.length === 0) {
            setTopPatterns([]);
            return;
        }

        setLoadingPatterns(true);
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'analyze_patterns',
                posts: posts,
                timeframe: '30d'
            }, (response) => {
                setLoadingPatterns(false);
                if (response && response.success && response.patterns) {
                    const sorted = [...response.patterns].sort((a, b) => parseFloat(b.stats.avgEngagement) - parseFloat(a.stats.avgEngagement));
                    setTopPatterns(sorted.slice(0, 3));
                } else {
                    setTopPatterns([]);
                }
            });
        } else {
            setLoadingPatterns(false);
        }
    }, [posts]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Trending Patterns */}
            <div className="card">
                <div className="sec-head">
                    <div className="sec-title">Trending Patterns (30D)</div>
                    <button 
                        className="see-all" 
                        onClick={() => onNavigateToHooks && onNavigateToHooks({ timeframe: '30d' })}
                        style={{ cursor: 'pointer' }}
                    >
                        Explore <Icon name="chevR" size={13} color="var(--accent-deep)" style={{ display: 'inline', marginLeft: '2px' }} />
                    </button>
                </div>

                <div className="col" style={{ gap: '12px' }}>
                    {loadingPatterns ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                            <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid #f3f3f3', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                    ) : topPatterns.length > 0 ? (
                        topPatterns.map((pattern, index) => {
                            // Cycle through duotone icons and background colors
                            const icons = ['hooks', 'remix', 'clock'];
                            const colors = ['ic-blue', 'ic-green', 'ic-orange'];
                            return (
                                <div className="insight" key={index}>
                                    <div className={`insight-ic ${colors[index % 3]}`}>
                                        <Icon name={icons[index % 3]} size={18} color="#FFFFFF" />
                                    </div>
                                    <div>
                                        <div className="insight-title">{pattern.name}</div>
                                        <div className="insight-desc">
                                            Identified from your feed. Avg. engagement of {pattern.stats.avgEngagement}.
                                        </div>
                                        <a 
                                            className="insight-link" 
                                            onClick={() => onNavigateToHooks && onNavigateToHooks({ timeframe: '30d', patternName: pattern.name })}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            View Details
                                        </a>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: '12.5px' }}>
                            Need more data to identify trends.
                            <br />(Stats appear when posts are loaded)
                        </div>
                    )}
                </div>
            </div>

            {/* Beta Feedback */}
            <div className="card" style={{ background: 'linear-gradient(150deg, var(--accent-wash), #FFFFFF)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div className="insight-ic ic-blue">
                        <Icon name="sparkle" size={18} color="#FFFFFF" />
                    </div>
                    <div>
                        <div className="insight-title">You're in the beta</div>
                        <div className="insight-desc" style={{ marginTop: '1px' }}>Help shape Scroll in.</div>
                    </div>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 13px' }}>
                    Found something off, or have a feature you'd love? We read every note.
                </p>
                <button 
                    className="btn btn-blue btn-sm" 
                    style={{ width: '100%', outline: 'none' }}
                    onClick={() => alert("Thank you for your feedback!")}
                >
                    <Icon name="send" size={15} color="#FFFFFF" />
                    Submit Feedback
                </button>
            </div>
        </div>
    );
};

export default RightSidebarWidgets;

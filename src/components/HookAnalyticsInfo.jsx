import React from 'react';
import { X, Award, Zap, Layout, HelpCircle, ArrowRight, Check } from 'lucide-react';

const HookAnalyticsInfo = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="analytics-overlay" onClick={onClose} style={{ zIndex: 1001 }}>
            <div className="analytics-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="analytics-header">
                    <div className="analytics-title" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Award size={24} color="#d97706" />
                        Understanding Hooks & Patterns
                    </div>
                    <button className="close-analytics" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="info-content" style={{ padding: '0 12px 32px 12px', color: '#FFFFFF', fontFamily: 'var(--font-family)' }}>

                    <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#444', marginBottom: '32px' }}>
                        This is your "Secret Sauce" engine. We analyze the structure of your best posts to find the repeated patterns that make your audience click. Here is a guide to every feature on this page.
                    </p>

                    {/* --- 1. METRICS & SCORING --- */}
                    <div className="metric-section" style={{ marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={20} color='#CC4E2E' />
                            How We Score Patterns
                        </h3>
                        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', border: '1px solid #eee' }}>
                            <p style={{ marginTop: 0, fontSize: '14px', lineHeight: '1.6', color: '#444' }}>
                                We don't just look at total likes. We look for <b>consistency</b>.
                            </p>
                            <ul style={{ paddingLeft: '20px', marginBottom: 0, color: '#555', fontSize: '14px', lineHeight: '1.6' }}>
                                <li style={{ marginBottom: '8px' }}>
                                    <b>Pattern Detection:</b> If you use a similar sentence structure (e.g., "How I X in Y days") multiple times, we tag it as a "Pattern".
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <b>Avg. Engagement Score:</b> We calculate the average engagement of all posts using that specific pattern.
                                </li>
                                <li>
                                    <b>The Goal:</b> To find templates that work <i>every time</i> you use them, not just one-off viral hits.
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* --- 2. TRENDING VS EVERGREEN --- */}
                    <div className="metric-section" style={{ marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={20} className="text-amber-500" />
                            Trending vs. Evergreen
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ background: '#fffcf0', padding: '16px', borderRadius: '12px', border: '1px solid #fce8b2' }}>
                                <strong style={{ color: '#b45309', display: 'block', marginBottom: '8px' }}>🔥 Trending (Short Term)</strong>
                                <p style={{ fontSize: '13px', lineHeight: '1.5', margin: 0, color: '#5f4b18' }}>
                                    <b>Focus:</b> Last 30-90 Days.<br />
                                    <b>What it means:</b> These are the formats working for your audience <i>right now</i>. Social media changes fast; use these for your next few posts to ride the wave of your current momentum.
                                </p>
                            </div>
                            <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                                <strong style={{ color: '#0369a1', display: 'block', marginBottom: '8px' }}>🏆 Evergreen (Long Term)</strong>
                                <p style={{ fontSize: '13px', lineHeight: '1.5', margin: 0, color: '#0c4a6e' }}>
                                    <b>Focus:</b> All Time.<br />
                                    <b>What it means:</b> These are your Hall of Fame formats. These templates have worked consistently over months or years. When in doubt, use an Evergreen template—it's your safest bet for high performance.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* --- 3. CREATOR TYPES --- */}
                    <div className="metric-section" style={{ marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HelpCircle size={20} color="#6366f1" />
                            What is your "Creator Type"?
                        </h3>
                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                            We analyze how often you reuse successful structures to give you a "Consistency Score".
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <div style={{ background: '#DDD4C8', padding: '8px', borderRadius: '50%', color: '#166534' }}><Check size={16} /></div>
                                <div>
                                    <strong style={{ fontSize: '14px', color: '#166534' }}>Patterned Creator</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#444', lineHeight: '1.4' }}>
                                        You have found a winning formula and you stick to it. You frequently reuse high-performing structures. This is great for building a recognized brand voice.
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <div style={{ background: '#e0f2fe', padding: '8px', borderRadius: '50%', color: '#0369a1' }}><Layout size={16} /></div>
                                <div>
                                    <strong style={{ fontSize: '14px', color: '#0369a1' }}>Exploratory Creator</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#444', lineHeight: '1.4' }}>
                                        You are always experimenting! You rarely use the same structure twice. While this shows creativity, it makes it harder to predict which posts will succeed. Try reusing your best formats more often.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- 4. RAW VS POLISHED --- */}
                    <div className="metric-section" style={{ marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layout size={20} color='#7B9F85' />
                            Raw Patterns vs. AI Polish
                        </h3>

                        <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>
                                    When you find a winning pattern, you have two ways to use it:
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {/* RAW */}
                                <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>1. Raw Format (The Skeleton)</strong>
                                        <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', color: '#DDD4C8' }}>Default View</span>
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#DDD4C8', marginBottom: '12px' }}>
                                        This strips away your specific topic and leaves standard placeholders. It's a "Fill-in-the-blanks" exercise.
                                    </p>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#FFFFFF', fontFamily: 'monospace' }}>
                                        "How to [ACHIEVE OUTCOME] in [TIME PERIOD]:<br /><br />
                                        1. Do [ACTION 1]<br />
                                        2. Avoid [MISTAKE]<br />
                                        3. Profit."
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', margin: 0 }}>
                                        ⚠️ If you don't use the Polish feature, this is what you get. You have to fill in all the blanks yourself manually.
                                    </p>
                                </div>

                                {/* POLISHED */}
                                <div style={{ padding: '20px', background: '#DDD4C8' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <strong style={{ fontSize: '15px', color: '#166534' }}>2. AI Polish (The Ready-to-Post)</strong>
                                        <span style={{ fontSize: '11px', background: '#DDD4C8', padding: '2px 8px', borderRadius: '12px', color: '#166534', border: '1px solid #bbf7d0' }}>Recommended</span>
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#166534', marginBottom: '12px' }}>
                                        Click the <Zap size={10} style={{ display: 'inline' }} /> <b>Polish</b> button to have AI analyze the structure and write a <i>new, unique</i> example for you. It fills in the blanks intelligently so you have a finished post to edit.
                                    </p>
                                    <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#FFFFFF', fontFamily: 'monospace', border: '1px solid #bbf7d0' }}>
                                        "How to land your first client in 30 days:<br /><br />
                                        1. Update your portfolio (Do this first)<br />
                                        2. Avoid cold messaging templates<br />
                                        3. Profit from personalized outreach."
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default HookAnalyticsInfo;

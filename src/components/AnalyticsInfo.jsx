import React from 'react';
import { X, Activity, Zap, MousePointer2, Target } from 'lucide-react';

const AnalyticsInfo = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="analytics-overlay" onClick={onClose} style={{ zIndex: 1001 }}>
            <div className="analytics-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="analytics-header">
                    <div className="analytics-title" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Target size={24} color='#CC4E2E' />
                        Mastering Your Metrics
                    </div>
                    <button className="close-analytics" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="info-content" style={{ padding: '0 12px 32px 12px', color: '#FFFFFF', fontFamily: 'var(--font-family)' }}>

                    <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#444', marginBottom: '32px' }}>
                        Social media numbers can be misleading. To really understand your performance, you need to look at your data from different angles. Here is the ultimate guide to the three metrics we track.
                    </p>

                    <div style={{ marginBottom: '16px', background: '#fff', border: '1px solid #eee', padding: '10px 14px', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Point System:</span>
                        <span style={{ fontSize: '13px', color: '#666' }}>👍 Like = <b>1</b></span>
                        <span style={{ fontSize: '13px', color: '#e0e0e0' }}>|</span>
                        <span style={{ fontSize: '13px', color: '#666' }}>💬 Comment = <b>1</b></span>
                        <span style={{ fontSize: '13px', color: '#e0e0e0' }}>|</span>
                        <span style={{ fontSize: '13px', color: '#666' }}>🔁 Repost = <b>1</b></span>
                    </div>

                    {/* --- 1. TOTAL ENGAGEMENT --- */}
                    <div className="metric-section" style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '10px', background: '#e8f0fe', borderRadius: '12px', color: '#1a73e8' }}>
                                <Activity size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Engagement (Total Volume)</h3>
                                <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>THE "NOISE" METRIC</span>
                            </div>
                        </div>

                        <div style={{ paddingLeft: '8px', borderLeft: '3px solid #e8f0fe' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '15px', lineHeight: '1.6' }}>
                                <b>What is it?</b> The sum of all likes, comments, and reposts you received.
                            </p>
                            <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.6', color: '#555' }}>
                                <b>The Analogy (Frequent Poster):</b> Imagine a LinkedIn creator who publishes 10 short posts a day—updates, shares, or quick thoughts. Even if each post only gets a few likes or comments, the total engagement quickly adds up, just like many small catches add up to a big haul.
                            </p>
                            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#444' }}>
                                    ✅ <b>Good for:</b> Tracking your total reach, ego-boosts, and overall account growth.<br />
                                    ❌ <b>Bad for:</b> Efficiency. It rewards "spamming" (posting too much).
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* --- 2. AVERAGE ENGAGEMENT --- */}
                    <div className="metric-section" style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '10px', background: '#e6f4ea', borderRadius: '12px', color: '#137333' }}>
                                <Zap size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Average Engagement</h3>
                                <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>THE "EFFICIENCY" METRIC</span>
                            </div>
                        </div>

                        <div style={{ paddingLeft: '8px', borderLeft: '3px solid #e6f4ea' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '15px', lineHeight: '1.6' }}>
                                <b>What is it?</b> The total engagement divided by the number of posts. (Score per Post).
                            </p>
                            <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.6', color: '#555' }}>
                                <b>The Analogy (Focused Expert):</b> Imagine a creator who writes one in‑depth article per week, carefully researched and highly relevant. That single post attracts a lot of likes, comments, and shares—much higher per post than the frequent poster. The total number of posts is lower, but the average engagement per post is far greater, showing efficiency.
                            </p>
                            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#444' }}>
                                    ✅ <b>Good for:</b> Finding your "Golden Hours" (Best time to post).<br />
                                    ❌ <b>Bad for:</b> Volume. You could have a high average but very low total visibility if you rarely post.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* --- REAL WORLD EXAMPLE --- */}
                    <div className="example-section" style={{ background: '#fffcf0', padding: '24px', borderRadius: '16px', border: '1px solid #fce8b2' }}>
                        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#b06000', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MousePointer2 size={20} />
                            Real World Example: The Tale of Two Creators
                        </h3>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #fce8b2' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', color: '#b06000' }}>Scenario</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: '#666' }}>Post Count</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: '#1a73e8' }}>Total Eng. Activity</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: '#137333' }}>Avg. Eng. (Quality)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #faeec5' }}>
                                    <td style={{ padding: '12px 8px' }}>
                                        <b>5:00 PM</b><br />
                                        <span style={{ fontSize: '12px', color: '#666' }}>(The "Spray and Pray")</span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>10 posts</td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 'bold', color: '#1a73e8', background: 'rgba(26,115,232,0.05)' }}>150 <br /><span style={{ fontSize: '10px', fontWeight: 'normal' }}>WINNER</span></td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>15</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '12px 8px' }}>
                                        <b>6:00 PM</b><br />
                                        <span style={{ fontSize: '12px', color: '#666' }}>(The "Strategic Shot")</span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>5 posts</td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>140</td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 'bold', color: '#137333', background: 'rgba(19,115,51,0.1)' }}>28 <br /><span style={{ fontSize: '10px', fontWeight: 'normal' }}>WINNER</span></td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#5f4b18' }}>
                            <p style={{ margin: '0 0 8px 0' }}>
                                <b>Which time slot is better?</b>
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                <li style={{ marginBottom: '4px' }}>If you want maximum noise and don't care about effort: <b>Pick 5 PM</b>.</li>
                                <li>If you want the best results for your effort: <b>Pick 6 PM</b>. It suggests your audience is actually <i>more responsive</i> at 6 PM, you just didn't post enough to beat the 5 PM total.</li>
                            </ul>
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', textAlign: 'center', color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
                        "When in doubt: Use <b>Avg. Eng</b> to decide <i>when</i> to post, and <b>Total Engagement</b> to celebrate at the end of the year."
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AnalyticsInfo;

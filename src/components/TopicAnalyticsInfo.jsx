import React from 'react';
import { X, Activity, Zap, Hash, Target, MousePointer2 } from 'lucide-react';

const TopicAnalyticsInfo = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="analytics-overlay" onClick={onClose} style={{ zIndex: 1001 }}>
            <div className="analytics-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="analytics-header">
                    <div className="analytics-title" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Target size={24} color='#CC4E2E' />
                        Understanding Topic Performance
                    </div>
                    <button className="close-analytics" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="info-content" style={{ padding: '0 12px 32px 12px', color: '#FFFFFF', fontFamily: 'var(--font-family)' }}>

                    <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#444', marginBottom: '32px' }}>
                        Not all topics are created equal. Some bring you noise (likes), while others bring you signal (loyal fans). Here is how to read your topic data.
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
                                <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>THE "POPULARITY" METRIC</span>
                            </div>
                        </div>

                        <div style={{ paddingLeft: '8px', borderLeft: '3px solid #e8f0fe' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '15px', lineHeight: '1.6' }}>
                                <b>What is it?</b> The sum of all likes, comments, and reposts for a specific topic.
                            </p>
                            <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.6', color: '#555' }}>
                                <b>The Analogy (The Broadcaster):</b> Imagine a topic like "Motivation". You post about it 20 times. Even if each post is just okay, the sheer volume creates a lot of total likes. It looks like your "best" topic just because you talk about it the most.
                            </p>
                            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#444' }}>
                                    ✅ <b>Good for:</b> Identifying what you are known for and where your main audience volume comes from.<br />
                                    ❌ <b>Bad for:</b> Identifying quality. A high total often just means high post count.
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
                                <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>THE "RESONANCE" METRIC</span>
                            </div>
                        </div>

                        <div style={{ paddingLeft: '8px', borderLeft: '3px solid #e6f4ea' }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: '15px', lineHeight: '1.6' }}>
                                <b>What is it?</b> The total engagement divided by the number of posts for that topic. (Score per Post).
                            </p>
                            <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.6', color: '#555' }}>
                                <b>The Analogy (The Specialist):</b> You post about "Advanced AI Coding" only 3 times. But each time, the community goes wild. The total likes might be lower than "Motivation", but the <i>average</i> is huge. This means when you speak on this topic, people listen.
                            </p>
                            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#444' }}>
                                    ✅ <b>Good for:</b> Finding your "Niche Authority". Topics with high averages are where you have true influence.<br />
                                    ❌ <b>Bad for:</b> Volume. You can't built a massive account on one post a year, even if it's a hit.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* --- REAL WORLD EXAMPLE --- */}
                    <div className="example-section" style={{ background: '#fffcf0', padding: '24px', borderRadius: '16px', border: '1px solid #fce8b2' }}>
                        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#b06000', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MousePointer2 size={20} />
                            Real World Example: Quantity vs Quality
                        </h3>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #fce8b2' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', color: '#b06000' }}>Topic</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: '#666' }}>Post Count</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: '#1a73e8' }}>Total Eng. Activity</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: '#137333' }}>Avg. Eng. (Quality)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #faeec5' }}>
                                    <td style={{ padding: '12px 8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Hash size={14} /> <b>General Advice</b>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>15 posts</td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 'bold', color: '#1a73e8', background: 'rgba(26,115,232,0.05)' }}>300 <br /><span style={{ fontSize: '10px', fontWeight: 'normal' }}>WINNER</span></td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>20</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '12px 8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Hash size={14} /> <b>Specific Niche</b>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>5 posts</td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>250</td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 'bold', color: '#137333', background: 'rgba(19,115,51,0.1)' }}>50 <br /><span style={{ fontSize: '10px', fontWeight: 'normal' }}>WINNER</span></td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#5f4b18' }}>
                            <p style={{ margin: '0 0 8px 0' }}>
                                <b>Which topic should you double down on?</b>
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                <li style={{ marginBottom: '4px' }}><b>General Advice</b> is keeping your lights on. It provides steady, reliable volume.</li>
                                <li><b>Specific Niche</b> is your growth engine. Your audience <i>loves</i> this. Even though you post less, it performs 2.5x better per post. <b>Increase post volume here to skyrocket growth.</b></li>
                            </ul>
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', textAlign: 'center', color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
                        "Use <b>Total Engagement</b> to see what you do most, but use <b>Avg. Engagement</b> to see what you do BEST."
                    </div>

                </div>
            </div>
        </div>
    );
};

export default TopicAnalyticsInfo;

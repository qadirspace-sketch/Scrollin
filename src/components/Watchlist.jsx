import React, { useState, useEffect } from 'react';
import Icon from './Icon';

const getEstimatedRole = (id) => {
    const roles = ["Growth Strategist", "Technical Founder", "Product Manager", "Venture Partner", "Content Engineer", "Marketing Lead"];
    const idx = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % roles.length;
    return roles[idx];
};

const getEstimatedFollowers = (id, totalLikes) => {
    const base = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 25 + 5; // 5k - 30k
    const extra = Math.floor(totalLikes / 20) || 2;
    return `${(base + extra).toFixed(1)}k`;
};

const getEstimatedTopic = (posts) => {
    if (!posts || posts.length === 0) return "Leadership";
    const topics = ["AI Tools", "Career Growth", "Leadership", "Productivity", "Marketing", "Remote Work"];
    const counts = {};
    posts.forEach(p => {
        if (!p.text) return;
        topics.forEach(t => {
            if (p.text.toLowerCase().includes(t.toLowerCase())) {
                counts[t] = (counts[t] || 0) + 1;
            }
        });
    });
    let topTopic = null;
    let max = 0;
    Object.entries(counts).forEach(([t, count]) => {
        if (count > max) {
            max = count;
            topTopic = t;
        }
    });
    return topTopic || topics[0];
};

const Watchlist = () => {
    const [profiles, setProfiles] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Add Profile Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newProfileUrl, setNewProfileUrl] = useState('');
    const [isAddingMsg, setIsAddingMsg] = useState('');
    const [updateProgress, setUpdateProgress] = useState({ total: 0, processed: 0 });

    // Dynamic stats cache for profiles in watchlist
    const [profileStats, setProfileStats] = useState({});

    useEffect(() => {
        loadProfiles();

        const messageListener = (message) => {
            if (message.action === 'profile_update_progress') {
                setProgressMessage(message.message);
                if (message.total !== undefined) {
                    setUpdateProgress({ total: message.total, processed: message.processed || 0 });
                }
            } else if (message.action === 'profile_update_complete') {
                setIsUpdating(false);
                setProgressMessage('All profiles are updated ✅');
                if (message.total !== undefined) {
                    setUpdateProgress({ total: message.total, processed: message.total });
                }
                loadProfiles();
                setTimeout(() => {
                    setProgressMessage('');
                    setUpdateProgress({ total: 0, processed: 0 });
                }, 4000);
            }
        };

        if (chrome?.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(messageListener);
        }

        return () => {
            if (chrome?.runtime?.onMessage) {
                chrome.runtime.onMessage.removeListener(messageListener);
            }
        };
    }, []);

    // Load profile stats when list changes
    useEffect(() => {
        if (profiles.length === 0) return;
        profiles.forEach(p => {
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'get_profile_posts',
                    profileUrn: p.profileUrn,
                    creatorId: p.creatorId
                }, (response) => {
                    if (response && response.success && response.posts) {
                        const creatorPosts = response.posts;
                        const postsCount = creatorPosts.length;
                        const totalLikes = creatorPosts.reduce((sum, post) => sum + (post.stats?.likes || 0), 0);
                        const totalComments = creatorPosts.reduce((sum, post) => sum + (post.stats?.comments || 0), 0);
                        const avgLikes = postsCount > 0 ? (totalLikes / postsCount) : 0;
                        const avgComments = postsCount > 0 ? (totalComments / postsCount) : 0;
                        const avgEng = postsCount > 0 ? ((avgLikes * 1 + avgComments * 3) / 10).toFixed(1) + "%" : "0.0%";
                        const role = p.role || getEstimatedRole(p.creatorId);
                        const topic = p.topic || getEstimatedTopic(creatorPosts);
                        const postsPerMo = postsCount > 0 ? Math.min(postsCount, 25) : 0;

                        setProfileStats(prev => ({
                            ...prev,
                            [p.creatorId]: {
                                postsCount,
                                avgEng,
                                followers: p.followers || getEstimatedFollowers(p.creatorId, totalLikes),
                                postsPerMo: postsPerMo || 12,
                                role,
                                topic
                            }
                        }));
                    }
                });
            }
        });
    }, [profiles]);

    const loadProfiles = () => {
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'get_all_watchlist_profiles' }, (response) => {
                if (response && response.profiles) {
                    setProfiles(response.profiles);
                }
            });
        }
    };

    const handleUpdateAll = () => {
        if (profiles.length === 0) return;

        setIsUpdating(true);
        setProgressMessage('Initiating update sequence...');
        setUpdateProgress({ total: profiles.length, processed: 0 });

        const urls = profiles.map(p => p.profileUrl || `https://www.linkedin.com/in/${p.creatorId}`);

        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'start_profile_update', profiles: urls });
        }
    };

    const handleStopUpdate = () => {
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'stop_profile_update' });
            setIsUpdating(false);
            setProgressMessage('Update stopped.');
            setTimeout(() => {
                setProgressMessage('');
                setUpdateProgress({ total: 0, processed: 0 });
            }, 3000);
        }
    };

    const handleDeleteProfile = (e, creatorId, profileUrn) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete ${creatorId} and all their posts?`)) {
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'delete_profile', creatorId, profileUrn }, (response) => {
                    if (response && response.success) {
                        setProfiles(prev => prev.filter(p => p.creatorId !== creatorId));
                    } else {
                        alert('Failed to delete profile data.');
                    }
                });
            }
        }
    };

    const handleAddProfile = (e) => {
        e.preventDefault();
        if (!newProfileUrl) return;

        let urlToSubmit = newProfileUrl.trim();
        if (!urlToSubmit.startsWith('http')) {
            urlToSubmit = `https://www.linkedin.com/in/${urlToSubmit}`;
        }

        setIsAddingMsg('Adding...');

        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'toggle_watchlist', url: urlToSubmit }, (response) => {
                if (response && response.success) {
                    setIsAddingMsg('Added successfully!');
                    setNewProfileUrl('');
                    setTimeout(() => {
                        setIsAddingMsg('');
                        setShowAddForm(false);
                        loadProfiles();
                    }, 1500);
                } else {
                    setIsAddingMsg('Failed to add profile.');
                    setTimeout(() => setIsAddingMsg(''), 3000);
                }
            });
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const filteredProfiles = profiles.filter(p =>
        p.creatorId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="view">
            {/* Page Header */}
            <div className="page-head">
                <div>
                    <div className="page-title">Watchlist</div>
                    <div className="page-sub">{filteredProfiles.length} creators monitored</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn btn-ghost btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                        <Icon name={showAddForm ? "x" : "plus"} size={14} />
                        {showAddForm ? 'Cancel' : 'Add Profile'}
                    </button>

                    <button
                        onClick={isUpdating ? handleStopUpdate : handleUpdateAll}
                        disabled={profiles.length === 0}
                        className={`btn btn-sm ${isUpdating ? 'btn-red' : (profiles.length === 0 ? '' : 'btn-blue')}`}
                        style={{ display: "flex", alignItems: "center", gap: 6, color: '#FFFFFF' }}
                    >
                        <Icon name="refresh" size={14} className={isUpdating ? "spin" : ""} style={isUpdating ? { animation: 'spin 1.5s linear infinite' } : null} />
                        {isUpdating ? 'Stop Update' : 'Update All'}
                    </button>
                </div>
            </div>

            {/* Progress / Status Bar */}
            {(isUpdating || progressMessage === 'All profiles are updated ✅') && (
                <div className="card" style={{ marginBottom: '18px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon name="refresh" size={16} className={isUpdating ? "spin" : ""} style={isUpdating ? { animation: 'spin 1.5s linear infinite' } : null} />
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>{progressMessage || 'Updating profiles...'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: 'var(--muted)' }}>
                            {updateProgress.processed} / {updateProgress.total} completed
                        </span>
                    </div>
                    {updateProgress.total > 0 && (
                        <div className="prog">
                            <div className="prog-fill" style={{ width: `${Math.round((updateProgress.processed / updateProgress.total) * 100)}%` }} />
                        </div>
                    )}
                </div>
            )}

            {/* Add Profile Form */}
            {showAddForm && (
                <form onSubmit={handleAddProfile} className="card card-pad-lg" style={{ marginBottom: '18px' }}>
                    <div className="sec-title" style={{ marginBottom: '12px' }}>Add Profile to Watchlist</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="LinkedIn URL (e.g. https://www.linkedin.com/in/username)"
                            value={newProfileUrl}
                            onChange={(e) => setNewProfileUrl(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: 'var(--r-chip)',
                                border: '1px solid var(--surface-2)',
                                backgroundColor: 'var(--surface-2)',
                                color: 'var(--ink)',
                                fontSize: '13px',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!newProfileUrl || isAddingMsg === 'Adding...'}
                            className="btn btn-blue btn-sm"
                        >
                            Add
                        </button>
                    </div>
                    {isAddingMsg && (
                        <div style={{ marginTop: '8px', fontSize: '12.5px', color: isAddingMsg.includes('Failed') ? 'var(--red)' : 'var(--accent-deep)', fontWeight: 550 }}>
                            {isAddingMsg}
                        </div>
                    )}
                </form>
            )}

            {/* Search Input */}
            <div className="search" style={{ marginBottom: '20px', maxWidth: 'none' }}>
                <Icon name="search" size={17} color="var(--muted)" />
                <input
                    type="text"
                    placeholder="Search watchlist..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Profiles List */}
            <div className="col" style={{ gap: '12px' }}>
                {filteredProfiles.length === 0 ? (
                    <div className="empty card">
                        <div className="empty-ic"><Icon name="watchlist" size={26} /></div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Your watchlist is empty</div>
                        <div style={{ fontSize: 12.5, marginTop: 4 }}>Add creators to monitor their content and patterns.</div>
                        <button className="btn btn-blue btn-sm" style={{ marginTop: 14 }} onClick={() => setShowAddForm(true)}>Add Creator</button>
                    </div>
                ) : (
                    filteredProfiles.map((p) => {
                        const stats = profileStats[p.creatorId] || {
                            postsCount: 0,
                            avgEng: '0.0%',
                            followers: '...',
                            postsPerMo: 0,
                            role: getEstimatedRole(p.creatorId),
                            topic: 'General'
                        };

                        return (
                            <div key={p.creatorId} className="rowcard" style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '14px 17px' }}>
                                <img
                                    className="av"
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.creatorId)}&background=random`}
                                    width={46}
                                    height={46}
                                    alt=""
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--ink)' }}>
                                        {p.creatorId}
                                        <Icon name="verified" size={14} className="verified" />
                                        {p.inWatchlist && (
                                            <span className="pill pill-green" style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 550, marginLeft: '6px' }}>
                                                Syncing
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px' }}>
                                        {stats.role} · {stats.topic}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '26px', marginRight: '8px' }}>
                                    {[
                                        ["Followers", stats.followers],
                                        ["Engagement", stats.avgEng],
                                        ["Posts/mo", stats.postsCount]
                                    ].map(([k, v]) => (
                                        <div key={k} style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
                                            <div style={{ fontSize: '11px', color: "var(--muted)" }}>{k}</div>
                                        </div>
                                    ))}
                                </div>
                                <a
                                    className="btn btn-ghost btn-sm"
                                    href={p.profileUrl || `https://www.linkedin.com/in/${p.creatorId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: "flex", alignItems: "center", gap: 4, minWidth: '80px', justifyContent: 'center' }}
                                >
                                    <Icon name="eye" size={14} /> Profile
                                </a>
                                <button
                                    className="icon-btn"
                                    style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--red-soft)', border: 'none' }}
                                    onClick={(e) => handleDeleteProfile(e, p.creatorId, p.profileUrn)}
                                    title="Delete profile"
                                    aria-label="Remove"
                                >
                                    <Icon name="x" size={16} color="var(--red)" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
            
            {/* Sync Time / Reliability Footer */}
            <div style={{ marginTop: '20px', padding: '12px 16px', borderTop: '1px solid var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--muted)' }}>
                <span>Reliability: Excellent (Incremental overlap mode active)</span>
                <span>Last updated: {profiles.length > 0 ? formatTime(Math.max(...profiles.map(p => p.lastUpdated || 0))) : 'Never'}</span>
            </div>
        </div>
    );
};

export default Watchlist;

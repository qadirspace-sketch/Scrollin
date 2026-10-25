import React, { useState, useEffect, useMemo, useRef } from 'react';
import Icon from './Icon';
import Analytics from './Analytics';
import HookAnalytics from './HookAnalytics';
import TopicAnalytics from './TopicAnalytics';
import TopicAnalyticsNarrative from './TopicAnalyticsNarrative';
import TagFolders from './TagFolders';
import ErrorHandler from './ErrorHandler';
import { generateCSV, downloadCSV } from '../utils/csvExport';
import { downloadTXT } from '../utils/txtExport';
import { applyRuleBasedTags, getTagsForPost } from '../utils/taggingService';
import { extractTimeFromUrn } from '../utils/timeUtils';

// New Dashboard Components
import DashboardSidebar from './DashboardSidebar';
import DashboardStats from './DashboardStats';
import DashboardFeedItem from './DashboardFeedItem';
import RightSidebarWidgets from './RightSidebarWidgets';
import HooksPatternPage from './HooksPatternPage';
import PostingAnalytics from './PostingAnalytics';
import PostingHabits from './PostingHabits';
import Watchlist from './Watchlist';
import CreatorIntelligence from './CreatorIntelligence';
import IdeaRemixLab from './IdeaRemixLab';
import FullDnaReport from './FullDnaReport';
import TopicIntelligence from './TopicIntelligence';
// Removed viralScoreEngine import

const SurfaceDeco = () => {
    return (
        <svg className="surface-deco" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
            <g fill="none" stroke="var(--accent)" strokeOpacity="0.07" strokeWidth="1.5">
                <path d="M-100 120 Q 300 -40 700 120 T 1400 120" />
                <path d="M-100 200 Q 350 40 750 200 T 1400 200" />
                <path d="M900 -60 Q 1100 200 950 460" />
                <path d="M1050 -40 Q 1280 240 1080 540" />
            </g>
            <g fill="none" stroke="#C9CDD6" strokeOpacity="0.18" strokeWidth="1">
                <path d="M-100 680 Q 300 560 700 700 T 1400 660" />
            </g>
        </svg>
    );
};

const Sidebar = ({ isOpen, onClose }) => {
    // Core State
    const [posts, setPosts] = useState([]);
    const [isFetching, setIsFetching] = useState(false);
    const [prevIsFetching, setPrevIsFetching] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [fetchCount, setFetchCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [postFilter, setPostFilter] = useState('ALL'); // 'ALL' | 'VIRAL'

    // View State
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [showAnalytics, setShowAnalytics] = useState(false); // Backward/Modal compatibility
    const [showTopicAnalytics, setShowTopicAnalytics] = useState(false);
    const [showHookAnalytics, setShowHookAnalytics] = useState(false);
    const [showTagFolders, setShowTagFolders] = useState(false);

    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [authUser, setAuthUser] = useState(null);

    // Watchlist State
    const [isInWatchlist, setIsInWatchlist] = useState(false);
    const [currentVanity, setCurrentVanity] = useState(null);

    // Tab Interface State
    const [myTabId, setMyTabId] = useState(null);
    const [hooksNavParams, setHooksNavParams] = useState(null);
    const [analyzeOwnContentOnly, setAnalyzeOwnContentOnly] = useState(false);
    const [viralData30d, setViralData30d] = useState(new Map());
    const [viralData7d, setViralData7d] = useState(new Map());

    // Flatten logic
    const flattenedPosts = useMemo(() => {
        const allPosts = [];
        const seen = new Set();
        [...posts].reverse().forEach(log => {
            if (log.extractedPosts) {
                log.extractedPosts.forEach(post => {
                    // Filter posts to only include those belonging to the current creator if on a profile page
                    if (currentVanity && currentVanity !== 'global') {
                        const postCreator = post.creatorId ? post.creatorId.toLowerCase() : null;
                        const pageCreator = currentVanity.toLowerCase();
                        if (postCreator && postCreator !== pageCreator) {
                            return; // Skip posts of other creators
                        }
                    }

                    const signature = post.urn || (post.text ? post.text.substring(0, 20) : 'unknown');
                    if (!seen.has(signature)) {
                        seen.add(signature);
                        // Filter by own content if enabled
                        if (!analyzeOwnContentOnly || !post.isRepost) {
                           allPosts.push(post);
                        }
                    }
                });
            }
        });
        return allPosts;
    }, [posts, analyzeOwnContentOnly, currentVanity]);

    useEffect(() => {
        if (!flattenedPosts || flattenedPosts.length === 0) {
            setViralData30d(new Map());
            setViralData7d(new Map());
            return;
        }

        const preparedData = flattenedPosts.map(post => {
            const likes = parseInt(post.stats?.likes || 0);
            const comments = parseInt(post.stats?.comments || 0);
            const reposts = parseInt(post.stats?.reposts || 0);
            let createdAt = 0;
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) createdAt = date.getTime();
            }
            return { id: post.urn || Math.random().toString(), likes, comments, reposts, createdAt };
        });

        if (chrome?.runtime?.sendMessage) {
            // Fetch 30-day viral posts
            chrome.runtime.sendMessage({
                action: 'calculate_viral_posts',
                posts: preparedData,
                days: 30
            }, (response) => {
                if (response && response.success && response.posts) {
                    setViralData30d(new Map(response.posts.map(p => [p.id, p])));
                }
            });

            // Fetch 7-day viral posts
            chrome.runtime.sendMessage({
                action: 'calculate_viral_posts',
                posts: preparedData,
                days: 7
            }, (response) => {
                if (response && response.success && response.posts) {
                    setViralData7d(new Map(response.posts.map(p => [p.id, p])));
                }
            });
        }
    }, [flattenedPosts]);

    const handleNavigateToHooks = (params) => {
        setHooksNavParams(params);
        setActiveTab('Hooks & Patterns');
    };

    // --- Initialization & Data Fetching ---

    // Sync completion animation timer
    useEffect(() => {
        if (prevIsFetching && !isFetching) {
            setShowCompleted(true);
            const timer = setTimeout(() => {
                setShowCompleted(false);
            }, 6000);
            return () => clearTimeout(timer);
        }
        if (isFetching) {
            setShowCompleted(false);
        }
        setPrevIsFetching(isFetching);
    }, [isFetching, prevIsFetching]);

    // 0. Auth Gate Check
    useEffect(() => {
        console.log("[Scrollin] Auth Gate Check initialized. Current isAuthenticated:", isAuthenticated);
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'check_auth' }, (response) => {
                const authState = response && response.isAuthenticated;
                console.log("[Scrollin] check_auth background response:", response, "Setting state to:", authState);
                setIsAuthenticated(authState);
                if (response && response.user) {
                    setAuthUser(response.user);
                }
            });
        }

        const handleAuthChange = (message) => {
            console.log("[Scrollin] Message received in Auth Gate Check:", message);
            if (message.action === 'auth_state_changed') {
                console.log("[Scrollin] auth_state_changed message received. New state:", message.isAuthenticated);
                setIsAuthenticated(message.isAuthenticated);
                if (!message.isAuthenticated) {
                    setAuthUser(null);
                }
            }
        };
        chrome.runtime.onMessage.addListener(handleAuthChange);
        return () => chrome.runtime.onMessage.removeListener(handleAuthChange);
    }, []);

    // 0.5 Fetch Authenticated User Profile
    useEffect(() => {
        if (isAuthenticated === true && chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'fetch_auth_user' }, (response) => {
                console.log("[Scrollin] fetch_auth_user response:", response);
                if (response && response.success && response.user) {
                    setAuthUser(response.user);
                }
            });
        }
    }, [isAuthenticated]);

    // 1. Get Tab ID
    useEffect(() => {
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: "get_tab_id" }, (response) => {
                if (response && response.tabId) {
                    setMyTabId(response.tabId);
                }
            });
        }
    }, []);

    // 2. Profile Identification & Watchlist Check
    useEffect(() => {
        if (myTabId === null) return;

        let lastHref = window.location.href;

        const updateProfileInfo = () => {
            const vanityMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
            const currentVanityName = vanityMatch ? vanityMatch[1].toLowerCase() : 'global';
            setCurrentVanity(currentVanityName);

            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage(
                    { action: 'get_watchlist_status', url: window.location.href },
                    (response) => setIsInWatchlist(response && response.inWatchlist ? true : false)
                );
            }
        };

        const notifyUrlChanged = (url, vanity) => {
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'url_changed',
                    url: url,
                    vanityName: vanity
                }, (response) => {
                    // If we got posts from the database for the new profile, load them
                    if (response && response.success && response.posts && response.posts.length > 0) {
                        const fullHistoryLog = [{ extractedPosts: response.posts }];
                        setPosts(fullHistoryLog);
                        updateFetchCount(fullHistoryLog);
                    }
                });
            }
        };

        updateProfileInfo();
        
        // Trigger initial URL sync
        const vanityMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
        const initialVanity = vanityMatch ? vanityMatch[1].toLowerCase() : 'global';
        notifyUrlChanged(window.location.href, initialVanity);

        const interval = setInterval(() => {
            if (window.location.href !== lastHref) {
                lastHref = window.location.href;
                console.log("[Scrollin] URL change detected (SPA navigation):", lastHref);
                updateProfileInfo();
                
                const vanityMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
                const newVanity = vanityMatch ? vanityMatch[1].toLowerCase() : 'global';
                
                // Clear the posts state synchronously so we don't display the old profile's posts!
                setPosts([]);
                setFetchCount(0);
                
                notifyUrlChanged(window.location.href, newVanity);
            }
        }, 1000);

        window.addEventListener('popstate', updateProfileInfo);
        return () => {
            clearInterval(interval);
            window.removeEventListener('popstate', updateProfileInfo);
        };
    }, [myTabId]);

    // 2. Load Posts & Listen for Updates
    useEffect(() => {
        if (myTabId === null) return;
        const storageKey = `logs_${myTabId}`;

        const loadPosts = () => {
            chrome.storage.local.get({ [storageKey]: [] }, (result) => {
                const logs = result[storageKey] || [];
                setPosts(logs);
                updateFetchCount(logs);
                const isFromDB = logs.some(log => log.url === 'db-render' || log.url === 'db-preload');
                if (isFromDB) setIsFetching(false);
            });
        };

        if (isOpen) {
            loadPosts();
            // Watchlist Check
            const vanityMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
            const currentVanity = vanityMatch ? vanityMatch[1].toLowerCase() : null;
            if (currentVanity && chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage(
                    { action: 'get_watchlist_status', url: window.location.href },
                    (response) => setIsInWatchlist(response && response.inWatchlist ? true : false)
                );
                // Auto-load from DB
                chrome.runtime.sendMessage({
                    action: 'get_profile_posts',
                    currentUrl: window.location.href,
                    vanityName: currentVanity
                }, (response) => {
                    if (response && response.success && response.posts && response.posts.length > 0) {
                        const fullHistoryLog = [{ extractedPosts: response.posts }];
                        setPosts(fullHistoryLog);
                        updateFetchCount(fullHistoryLog);
                    }
                });
            }
        }

        const handleStorageChange = (changes, namespace) => {
            if (namespace === 'local' && changes[storageKey]) {
                const newLogs = changes[storageKey].newValue || [];
                if (isOpen) setPosts(newLogs);
                updateFetchCount(newLogs);
                const isFromDB = newLogs.some(log => log.url === 'db-render' || log.url === 'db-preload');
                if (isFromDB) setIsFetching(false);
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);

        const handleMessage = (message) => {
            if (message.action === "session_captured") {
                setIsFetching(true);
                // Try preload
                const vanityMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
                const currentVanityName = vanityMatch ? vanityMatch[1].toLowerCase() : null;
                if (currentVanityName && chrome?.runtime?.sendMessage) {
                    chrome.runtime.sendMessage(
                        { action: 'get_profile_posts', currentUrl: window.location.href, vanityName: currentVanityName },
                        (response) => {
                            if (response && response.success && response.posts && response.posts.length > 0) {
                                const cachedLog = [{ url: 'db-preload', extractedPosts: response.posts }];
                                setPosts(cachedLog);
                                updateFetchCount(cachedLog);
                            }
                        }
                    );
                }
            } else if (message.action === "fetching_complete") {
                setIsFetching(false);
            } else if (message.action === "reset_ui") {
                setPosts([]);
                setFetchCount(0);
                setIsFetching(false);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);

        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, [isOpen, myTabId]);

    function updateFetchCount(logs) {
        let count = 0;
        const seen = new Set();
        logs.forEach(log => {
            if (log.extractedPosts) {
                log.extractedPosts.forEach(post => {
                    const signature = post.urn || (post.text ? post.text.substring(0, 20) : 'unknown');
                    if (!seen.has(signature)) {
                        seen.add(signature);
                        count++;
                    }
                });
            }
        });
        setFetchCount(count);
    }

    // Search & Viral Filter
    const displayPosts = useMemo(() => {
        let data = flattenedPosts;

        // 1. Filter by Viral Status
        if (postFilter.startsWith('VIRAL')) {
            const days = postFilter === 'VIRAL-7' ? 7 : 30;
            const activeViralMap = days === 7 ? viralData7d : viralData30d;

            // Merge scores and filter
            data = data.map(p => {
                const scoreData = activeViralMap.get(p.urn);
                if (scoreData) {
                    return {
                        ...p,
                        viralLabel: scoreData.viralLabel,
                        performanceRatio: scoreData.performanceRatio,
                        weightedEngagement: scoreData.weightedEngagement
                    };
                }
                return p;
            }).filter(p => p.viralLabel === 'Highly Viral' || p.viralLabel === 'Viral');
        } else {
            // Default: Merge 30-day scores for badges in normal feed interaction
            data = data.map(p => {
                const scoreData = viralData30d.get(p.urn);
                if (scoreData) {
                    return { ...p, ...scoreData };
                }
                return p;
            });
        }

        // 2. Filter by Search Term
        if (searchTerm) {
            data = data.filter(p => p.text && p.text.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // Helper functions for robust date sorting
        const parseRelativeDate = (dateStr) => {
            if (!dateStr || typeof dateStr !== 'string') return Infinity;
            const cleanStr = dateStr.replace('•', '').trim().toLowerCase();
            if (cleanStr.includes('now') || cleanStr.includes('second') || cleanStr.includes('min')) {
                if (cleanStr.includes('now')) return 0;
            }
            const parts = cleanStr.match(/(\d+)\s*([a-z]+)/);
            if (!parts) return Infinity;
            const value = parseInt(parts[1], 10);
            const unit = parts[2];
            let multiplier = 1;
            if (unit.startsWith('m') && !unit.startsWith('mo')) multiplier = 1;
            else if (unit.startsWith('h')) multiplier = 60;
            else if (unit.startsWith('d')) multiplier = 60 * 24;
            else if (unit.startsWith('w')) multiplier = 60 * 24 * 7;
            else if (unit.startsWith('mo')) multiplier = 60 * 24 * 30;
            else if (unit.startsWith('y')) multiplier = 60 * 24 * 365;
            return value * multiplier;
        };

        const getPostTimestamp = (post) => {
            if (!post) return 0;
            if (post.createdAt) {
                const t = new Date(post.createdAt).getTime();
                if (!isNaN(t)) return t;
            }
            if (post.urn) {
                const date = extractTimeFromUrn(post.urn);
                if (date) return date.getTime();
            }
            if (post.date) {
                const offsetMin = parseRelativeDate(post.date);
                if (offsetMin !== Infinity) {
                    return Date.now() - (offsetMin * 60 * 1000);
                }
            }
            return 0;
        };

        // 3. Sort Posts
        data.sort((a, b) => {
            const getStat = (p, field) => {
                return p.stats ? (parseInt(p.stats[field]) || 0) : 0;
            };
            const timeA = getPostTimestamp(a);
            const timeB = getPostTimestamp(b);

            switch (sortBy) {
                case 'oldest':
                    return timeA - timeB;
                case 'least_commented':
                    return getStat(a, 'comments') - getStat(b, 'comments');
                case 'most_commented':
                    return getStat(b, 'comments') - getStat(a, 'comments');
                case 'least_liked':
                    return getStat(a, 'likes') - getStat(b, 'likes');
                case 'most_liked':
                    return getStat(b, 'likes') - getStat(a, 'likes');
                case 'least_shared':
                    return getStat(a, 'reposts') - getStat(b, 'reposts');
                case 'most_shared':
                    return getStat(b, 'reposts') - getStat(a, 'reposts');
                case 'newest':
                default:
                    return timeB - timeA;
            }
        });

        return data;
    }, [flattenedPosts, searchTerm, postFilter, sortBy, viralData30d, viralData7d]);

    // Diagnostic console logs
    useEffect(() => {
        console.log("[Scrollin] RENDER DIAGNOSTIC:", {
            isAuthenticated,
            postsRawLength: posts.length,
            flattenedPostsLength: flattenedPosts.length,
            displayPostsLength: displayPosts.length,
            activeTab,
            postFilter,
            sortBy,
            isFetching
        });
    }, [isAuthenticated, posts, flattenedPosts, displayPosts, activeTab, postFilter, sortBy, isFetching]);


    // --- Render ---

    // Style for the main container
    // Style for the main container (acts as the stage backdrop)
    const sidebarStyle = {
        position: 'fixed',
        top: 0,
        left: isOpen ? 0 : '-100vw',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--frame)',
        zIndex: 2147483647,
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font-family)',
        overflow: 'hidden'
    };

    // Prevent scrolling on body when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Pagination State
    const [visibleCount, setVisibleCount] = useState(20);
    const handleLoadMore = () => setVisibleCount(prev => prev + 20);

    // Handlers
    const handleClearDB = () => {
        if (window.confirm("Are you sure you want to delete ALL stored posts?")) {
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'clear_database' }, (response) => {
                    if (response && response.success) {
                        setPosts([]);
                        setFetchCount(0);
                        alert("Database cleared.");
                    }
                });
            }
        }
    };

    const handleResync = () => {
        setIsFetching(true);
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'force_sync'
            }, (response) => {
                if (response && response.success) {
                    if (response.reloaded) {
                        console.log("[Sidebar] Session details missing, page reloaded to capture credentials.");
                    } else {
                        console.log("[Sidebar] Force Sync initiated successfully.");
                    }
                } else {
                    console.error("[Sidebar] Force Sync failed");
                    setIsFetching(false);
                }
            });
        } else {
            setIsFetching(false);
        }
    };

    const handleDownloadTXT = () => {
        downloadTXT(flattenedPosts, 'linkedin_posts_export.txt');
    };

    // Find the actual profile owner by looking for the most frequently occurring author.
    // This avoids showing a reposted person's name/pic when the first post is a repost.
    const currentProfile = useMemo(() => {
        if (flattenedPosts.length === 0) return null;

        // Count occurrences of each creator name
        const creatorFrequency = {};
        flattenedPosts.forEach(post => {
            const name = post.creatorName;
            if (!name) return;
            // Exclude reposted-from authors — only count original/self-repost creators
            if (post.isRepost && post.repostType !== 'self') return;
            if (!creatorFrequency[name]) {
                creatorFrequency[name] = { count: 0, image: post.creatorImage || null, headline: post.authorHeadline || '' };
            }
            creatorFrequency[name].count++;
        });

        // Pick the most frequent creator
        let topCreator = null;
        let maxCount = 0;
        Object.entries(creatorFrequency).forEach(([name, data]) => {
            if (data.count > maxCount) {
                maxCount = data.count;
                topCreator = { name, image: data.image, headline: data.headline };
            }
        });

        // Fallback: if all posts were reposts, just use the first post's creator
        if (!topCreator && flattenedPosts[0]) {
            topCreator = {
                name: flattenedPosts[0].creatorName || 'Unknown User',
                image: flattenedPosts[0].creatorImage || null,
                headline: flattenedPosts[0].authorHeadline || ''
            };
        }

        return topCreator;
    }, [flattenedPosts]);

    const handleSignIn = () => {
        const extId = chrome.runtime.id;
        window.open(`http://localhost:5001?extId=${extId}`, '_blank', 'width=500,height=650,noopener');
    };

    const handleLogout = () => {
        if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'logout' });
        }
        const extId = chrome.runtime.id;
        window.open(`http://localhost:5001/logout?extId=${extId}`, '_blank', 'width=500,height=650,noopener');
    };

    return (
        <div id="scrollin-app-panel" className={isOpen ? 'open' : ''} style={sidebarStyle}>
            {/* Decorative stage blobs */}
            <div className="stage-deco">
                <div className="stage-glow" />
                <div className="stage-glow-2" />
            </div>

            {/* Main Premium Frame */}
            <div className="frame">
                {/* Auth Screen Handling */}
                {isAuthenticated === null ? (
                    <div className="auth-loading-overlay">
                        <div className="auth-loading-spinner"></div>
                        <div className="auth-loading-text">Verifying session...</div>
                    </div>
                ) : isAuthenticated === false ? (
                    <div className="auth-lock-overlay">
                        <div className="auth-lock-card">
                            <div className="auth-lock-icon">
                                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </div>
                            <h2 className="auth-lock-title">Welcome to Scrollin</h2>
                            <p className="auth-lock-subtitle">Sign in to unlock content intelligence for LinkedIn profiles.</p>
                            <button className="auth-lock-btn" onClick={handleSignIn}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                    <polyline points="10 17 15 12 10 7"/>
                                    <line x1="15" y1="12" x2="3" y2="12"/>
                                </svg>
                                Sign In to Continue
                            </button>
                            <p className="auth-lock-footer">Secure authentication powered by Clerk</p>
                        </div>
                    </div>
                ) : (
                <>
                {/* Left Navigation Rail */}
                <DashboardSidebar 
                    activeTab={activeTab} 
                    onTabChange={setActiveTab} 
                    profile={authUser}
                    isFetching={isFetching}
                    fetchCount={fetchCount}
                    onLogout={handleLogout}
                />

                {/* Inner White Surface */}
                <div className="surface">
                    {/* Background lines */}
                    <SurfaceDeco />

                    {/* Top Bar Banner */}
                    <div className="topbar">
                        {/* Greeting */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div className="greet">
                                {authUser ? (
                                    <img className="greet-av" src={authUser.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser.fullName)}&background=random`} alt={authUser.fullName} />
                                ) : (
                                    <img className="greet-av" src="https://ui-avatars.com/api/?name=User&background=random" alt="User" />
                                )}
                                <div>
                                    <div className="greet-title">Hello, {authUser?.firstName || authUser?.fullName?.split(' ')[0] || 'User'} 👋</div>
                                    <div className="greet-sub">
                                        {activeTab === 'Dashboard' 
                                            ? "Here's your content intelligence for today." 
                                            : activeTab}
                                    </div>
                                </div>
                            </div>

                            {/* Fetching Progress Bar */}
                            {(isFetching || showCompleted) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: '240px', marginTop: '2px', animation: 'viewIn 0.3s ease' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '600' }}>
                                        {isFetching ? (
                                            <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span className="sync-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'inline-block' }} />
                                                Syncing posts...
                                            </span>
                                        ) : (
                                            <span style={{ color: '#3F8C4D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                ✓ Fetching completed!
                                            </span>
                                        )}
                                        <span style={{ color: isFetching ? 'var(--muted)' : '#3F8C4D' }}>
                                            {fetchCount} captured
                                        </span>
                                    </div>
                                    <div className="prog" style={{ height: '6px', width: '100%' }}>
                                        <div 
                                            className="prog-fill" 
                                            style={{ 
                                                width: isFetching ? `${Math.min(100, Math.max(15, (fetchCount / 20) * 100))}%` : '100%',
                                                backgroundColor: isFetching ? 'var(--accent)' : 'var(--green)',
                                                backgroundImage: isFetching ? 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)' : 'none',
                                                backgroundSize: '1rem 1rem',
                                                animation: isFetching ? 'progress-bar-stripes 1s linear infinite' : 'none'
                                            }} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Search Input */}
                        <div className="search">
                            <Icon name="search" size={17} color="var(--muted)" />
                            <input 
                                type="text"
                                placeholder="Search posts..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <span className="kbd">⌘F</span>
                        </div>

                        {/* Topbar Right Side Controls */}
                        <div className="topbar-right">
                            {/* Sort Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>Sort:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{
                                        backgroundColor: 'var(--surface-2)',
                                        border: 'none',
                                        borderRadius: 'var(--r-pill)',
                                        padding: '6px 24px 6px 12px',
                                        fontSize: '12.5px',
                                        fontWeight: '550',
                                        color: 'var(--ink-2)',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        WebkitAppearance: 'none',
                                        appearance: 'none',
                                        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236c757d\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 8px center',
                                        backgroundSize: '12px',
                                        minWidth: '120px'
                                    }}
                                >
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="most_commented">Most Commented</option>
                                    <option value="least_commented">Least Commented</option>
                                    <option value="most_liked">Most Liked</option>
                                    <option value="least_liked">Least Liked</option>
                                    <option value="most_shared">Most Shared</option>
                                    <option value="least_shared">Least Shared</option>
                                </select>
                            </div>

                            {/* Own Content Switch */}
                            <button 
                                className="switch" 
                                onClick={() => setAnalyzeOwnContentOnly(!analyzeOwnContentOnly)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', outline: 'none' }}
                                title="Analyze own content only (excludes reposts)"
                            >
                                <span className={`switch-track ${analyzeOwnContentOnly ? 'on' : ''}`}>
                                    <span className="switch-knob" />
                                </span>
                                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink-2)' }}>Own content</span>
                            </button>

                            {/* Divider */}
                            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />

                            {/* Export TXT */}
                            <button className="icon-btn" onClick={handleDownloadTXT} title="Download Posts as TXT">
                                <Icon name="download" size={19} color="var(--ink-2)" />
                            </button>

                            {/* Force Resync */}
                            <button className="icon-btn" onClick={handleResync} title="Force Resync">
                                <Icon name="refresh" size={19} color="var(--ink-2)" style={isFetching ? { animation: 'spin 1.2s linear infinite' } : null} />
                            </button>

                            {/* Clear DB */}
                            <button className="icon-btn" onClick={handleClearDB} title="Clear Database">
                                <Icon name="x" size={19} color="var(--red)" />
                            </button>

                            {/* Add Creators Button */}
                            <button 
                                className="btn btn-blue btn-sm" 
                                onClick={() => setActiveTab('Watchlist')}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Icon name="plus" size={15} color="#FFFFFF" />
                                Add Creators
                            </button>

                            {/* Close Button */}
                            <button 
                                className="icon-btn" 
                                onClick={onClose} 
                                title="Close Sidebar" 
                                style={{ backgroundColor: 'var(--red-soft)', color: 'var(--red)' }}
                            >
                                <Icon name="x" size={16} color="var(--red)" />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable View Area */}
                    <div className="scroll">
                        <div className="view">
                            {activeTab === 'Hooks & Patterns' ? (
                                <HooksPatternPage posts={flattenedPosts} initialParams={hooksNavParams} profileId={currentVanity} />
                            ) : activeTab === 'Topic Intelligence' ? (
                                <TopicIntelligence posts={flattenedPosts} profileId={currentVanity} />
                            ) : activeTab === 'Posting Analytics' ? (
                                <PostingAnalytics posts={flattenedPosts} profileId={currentVanity} />
                            ) : activeTab === 'Posting Habits' ? (
                                <PostingHabits posts={flattenedPosts} profileId={currentVanity} />
                            ) : activeTab === 'Watchlist' ? (
                                <Watchlist />
                            ) : activeTab === 'Creator Intelligence' ? (
                                <CreatorIntelligence go={setActiveTab} onNavigateToHooks={handleNavigateToHooks} />
                            ) : activeTab === 'Idea Remix Lab' ? (
                                <IdeaRemixLab posts={flattenedPosts} />
                            ) : activeTab === 'Full DNA Report' ? (
                                <FullDnaReport posts={flattenedPosts} go={setActiveTab} onNavigateToHooks={handleNavigateToHooks} />
                            ) : (
                                <>
                                    {/* Stats Row */}
                                    <DashboardStats
                                        posts={flattenedPosts}
                                        activeFilter={postFilter}
                                        onClearFilter={() => setPostFilter('ALL')}
                                        onViewViral={(timeframe) => setPostFilter(timeframe === '7d' ? 'VIRAL-7' : 'VIRAL-30')}
                                        onNavigateToTab={setActiveTab}
                                    />

                                    {/* Content Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) 1fr', gap: '18px', alignItems: 'start' }}>

                                        {/* Feed Column */}
                                        <div>
                                            <div className="sec-head">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="sec-title">
                                                        {postFilter.startsWith('VIRAL')
                                                            ? `Viral Posts (Last ${postFilter === 'VIRAL-7' ? '7' : '30'} Days)`
                                                            : 'Post Capture Feed'}
                                                    </span>
                                                    {postFilter.startsWith('VIRAL') && (
                                                        <button
                                                            onClick={() => setPostFilter('ALL')}
                                                            className="pill pill-red"
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <Icon name="x" size={12} /> Clear Filter
                                                        </button>
                                                    )}
                                                </div>
                                                <button className="see-all" onClick={() => setActiveTab('Posting Analytics')}>
                                                    See all <Icon name="chevR" size={13} />
                                                </button>
                                            </div>

                                            {/* Feed Items */}
                                            {displayPosts.length > 0 ? (
                                                <div className="col">
                                                    {displayPosts.slice(0, visibleCount).map((post, index) => (
                                                        <DashboardFeedItem key={index} post={post} index={index} searchTerm={searchTerm} />
                                                    ))}

                                                    {/* Load More Trigger */}
                                                    {visibleCount < displayPosts.length && (
                                                        <button
                                                            onClick={handleLoadMore}
                                                            className="btn btn-blue btn-sm"
                                                            style={{ width: '100%', marginTop: '16px' }}
                                                        >
                                                            Load More Posts ({displayPosts.length - visibleCount} remaining)
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="empty card">
                                                    <div className="empty-ic"><Icon name="doc" size={26} /></div>
                                                    {isFetching ? (
                                                        <>
                                                            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--ink)' }}>Syncing with LinkedIn...</div>
                                                            <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Please scroll your feed to capture posts.</div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--ink)' }}>No posts captured yet</div>
                                                            <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Visit a profile and scroll or click Sync.</div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Widgets Column */}
                                        <div className="col">
                                            <RightSidebarWidgets posts={flattenedPosts} onNavigateToHooks={handleNavigateToHooks} />
                                        </div>

                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer / Copyright */}
                    <div style={{ margin: '20px 0 16px', textAlign: 'center', fontSize: '11.5px', color: 'var(--muted)' }}>
                        Scrollin Beta v2.0 • LinkedIn Intelligence Suite
                    </div>
                </div>
                </>
                )}
            </div>

            {/* Legacy Modals (Hidden by default) */}
            {showAnalytics && (
                <div className="analytics-overlay">
                    <div className="analytics-modal">
                        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100 }}>
                            <button onClick={() => setShowAnalytics(false)} className="close-analytics"><Icon name="x" size={24} /></button>
                        </div>
                        <Analytics posts={flattenedPosts} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;

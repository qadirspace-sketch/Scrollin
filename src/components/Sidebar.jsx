import React, { useState, useEffect, useMemo, useRef } from 'react';
import Icon from './Icon';
import ErrorHandler from './ErrorHandler';
import { generateCSV, downloadCSV } from '../utils/csvExport';
import { downloadTXT } from '../utils/txtExport';
import { applyRuleBasedTags, getTagsForPost } from '../utils/taggingService';
import { extractTimeFromUrn } from '../utils/timeUtils';
import { withLift, postTime, creatorKey } from '../utils/metrics';

// New Dashboard Components
import AppSidebar, { labelForTab, initialsOf } from './AppSidebar';
import LineIcon from './LineIcon';
import OverviewPage from './OverviewPage';
import PostsPage from './PostsPage';
import SettingsPage from './SettingsPage';
import InsightsPage from './InsightsPage';
import CreatorsPage from './CreatorsPage';
import StudioPage from './StudioPage';
// Removed viralScoreEngine import

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
    const [activeTab, setActiveTab] = useState('Overview');
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
            // Baselines are per creator, so the server needs to know whose post this is
            return { id: post.urn || Math.random().toString(), likes, comments, reposts, createdAt: postTime(post) || 0, creatorKey: creatorKey(post) };
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
            // Default: lift for every post (same rules as the server), so badges cover older posts too
            data = withLift(data);
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
                case 'best': {
                    // Highest lift first; posts without a baseline go last
                    const la = a.lift ?? a.performanceRatio ?? -1, lb = b.lift ?? b.performanceRatio ?? -1;
                    return lb - la || timeB - timeA;
                }
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

    // ---- App shell state (sidebar, recents, search shortcut, scroll reset) ----
    const [sideCollapsed, setSideCollapsed] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [trackedCreators, setTrackedCreators] = useState([]);
    const [recents, setRecents] = useState(() => {
        try { return JSON.parse(localStorage.getItem('scrollin_recents') || '[]').filter(r => ['Overview', 'Posts', 'Insights', 'Creators', 'Studio'].includes(r.tab)); } catch (e) { return []; }
    });
    const scrollRef = useRef(null);
    const searchRef = useRef(null);
    const accountRef = useRef(null);

    // Shared analysis for every page: lift per post, and hook patterns from the backend (fetched once per post set)
    const [navParams, setNavParams] = useState({});
    const [patterns, setPatterns] = useState([]);
    const [postTypes, setPostTypes] = useState({});
    const scoredPosts = useMemo(() => withLift(flattenedPosts), [flattenedPosts]);
    useEffect(() => {
        if (!flattenedPosts.length || !chrome?.runtime?.sendMessage) { setPatterns([]); setPostTypes({}); return; }
        const timer = setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'analyze_patterns', posts: flattenedPosts, timeframe: 'all' }, (res) => {
                if (res && res.success) { setPatterns(res.patterns || []); setPostTypes(res.postTypes || {}); }
            });
        }, 400); // wait for capture bursts to settle
        return () => clearTimeout(timer);
    }, [flattenedPosts]);

    const navigate = (tab, params = {}) => {
        setNavParams(params);
        setActiveTab(tab);
        if (tab === 'Settings') return;
        setRecents(prev => {
            const next = [{ tab, creator: currentProfile?.name || null }, ...prev.filter(r => !(r.tab === tab && r.creator === (currentProfile?.name || null)))].slice(0, 5);
            try { localStorage.setItem('scrollin_recents', JSON.stringify(next)); } catch (e) { /* storage unavailable */ }
            return next;
        });
    };

    // Every page starts at the top
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [activeTab]);

    // ⌘K / Ctrl+K focuses search while the panel is open
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSideCollapsed(false);
                setTimeout(() => searchRef.current && searchRef.current.focus(), 0);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

    useEffect(() => {
        if (!isAuthenticated || !chrome?.runtime?.sendMessage) return;
        chrome.runtime.sendMessage({ action: 'get_all_watchlist_profiles' }, (res) => {
            if (res && Array.isArray(res.profiles)) setTrackedCreators(res.profiles);
        });
    }, [isAuthenticated, activeTab]);

    useEffect(() => {
        if (!accountOpen) return;
        const close = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [accountOpen]);

    const clearAllData = () => new Promise((resolve) => {
        if (!chrome?.runtime?.sendMessage) return resolve(false);
        chrome.runtime.sendMessage({ action: 'clear_database' }, (response) => {
            const ok = !!(response && response.success);
            if (ok) { setPosts([]); setFetchCount(0); }
            resolve(ok);
        });
    });

    const syncLabel = isFetching ? `Capturing… ${fetchCount} posts` : flattenedPosts.length ? `${flattenedPosts.length} posts captured` : 'No posts captured yet';
    const accountName = authUser?.fullName || authUser?.firstName || authUser?.name || 'Account';

    const renderPage = () => {
        switch (activeTab) {
            case 'Posts':
                return <PostsPage scored={scoredPosts} postTypes={postTypes} params={navParams} searchTerm={searchTerm} onSearchChange={setSearchTerm}
                    ownOnly={analyzeOwnContentOnly} onOwnOnlyChange={setAnalyzeOwnContentOnly} isFetching={isFetching} onExport={handleDownloadTXT} onNavigate={navigate} />;
            case 'Insights':
                return <InsightsPage scored={scoredPosts} postTypes={postTypes} params={navParams} onNavigate={navigate} />;
            case 'Creators':
                return <CreatorsPage onTrackedChange={setTrackedCreators} />;
            case 'Studio':
                return <StudioPage scored={scoredPosts} patterns={patterns} params={navParams} onNavigate={navigate} />;
            case 'Settings':
                return <SettingsPage authUser={authUser} postCount={flattenedPosts.length} onLogout={handleLogout} onExport={handleDownloadTXT} onClearData={clearAllData} />;
            default:
                return <OverviewPage scored={scoredPosts} patterns={patterns} postTypes={postTypes} onNavigate={navigate} onExport={handleDownloadTXT} />;
        }
    };

    return (
        <div id="scrollin-app-panel" className={isOpen ? 'open' : ''} style={{ ...sidebarStyle, backgroundColor: '#FFFFFF' }}>
            {isAuthenticated === null ? (
                <div className="auth-loading-overlay">
                    <div className="auth-loading-spinner"></div>
                    <div className="auth-loading-text">Loading…</div>
                </div>
            ) : isAuthenticated === false ? (
                <div className="auth-lock-overlay">
                    <div className="auth-lock-card">
                        <div className="auth-lock-icon">
                            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </div>
                        <h2 className="auth-lock-title">Welcome to Scrollin</h2>
                        <p className="auth-lock-subtitle">Sign in to unlock content intelligence for LinkedIn profiles.</p>
                        <button className="auth-lock-btn" onClick={handleSignIn}>Sign in to continue</button>
                        <p className="auth-lock-footer">Secure authentication powered by Clerk</p>
                    </div>
                    <button type="button" className="sx-ibtn" onClick={onClose} aria-label="Close Scrollin" style={{ position: 'absolute', top: 16, right: 16 }}>
                        <LineIcon name="close" />
                    </button>
                </div>
            ) : (
                <div className="sx-app">
                    {!sideCollapsed && (
                        <AppSidebar
                            activeTab={activeTab} onNavigate={navigate}
                            creator={currentProfile ? { name: currentProfile.name, image: currentProfile.image } : null}
                            trackedCreators={trackedCreators}
                            counts={{ posts: flattenedPosts.length, watchlist: trackedCreators.length }}
                            recents={recents}
                            searchTerm={searchTerm} onSearchChange={setSearchTerm}
                            onSearchSubmit={() => navigate('Posts')} searchRef={searchRef}
                            isFetching={isFetching} syncLabel={syncLabel}
                            onCollapse={() => setSideCollapsed(true)}
                        />
                    )}
                    <div className="sx-main">
                        <header className="sx-top">
                            <div className="sx-crumb">
                                {sideCollapsed && (
                                    <button type="button" className="sx-ibtn" onClick={() => setSideCollapsed(false)} aria-label="Open sidebar" title="Open sidebar">
                                        <LineIcon name="panel" />
                                    </button>
                                )}
                                {currentProfile?.name && <><span className="dim">{currentProfile.name}</span><span style={{ color: '#BDBDBD' }}>/</span></>}
                                <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{labelForTab(activeTab)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button type="button" className="sx-tbtn" onClick={handleResync} disabled={isFetching} title="Capture the latest posts from this profile">
                                    <LineIcon name="sync" size={16} style={isFetching ? { animation: 'spin 1.2s linear infinite' } : null} />
                                    {isFetching ? 'Syncing…' : 'Sync now'}
                                </button>
                                <div ref={accountRef} style={{ position: 'relative' }}>
                                    <button type="button" className="sx-ibtn" onClick={() => setAccountOpen(o => !o)} aria-haspopup="menu" aria-expanded={accountOpen} aria-label="Account menu">
                                        {authUser?.imageUrl
                                            ? <img className="sx-av" src={authUser.imageUrl} alt="" style={{ width: 30, height: 30 }} />
                                            : <span className="sx-av" style={{ width: 30, height: 30, fontSize: 12, background: '#111111', color: '#FFFFFF' }}>{initialsOf(accountName)}</span>}
                                    </button>
                                    {accountOpen && (
                                        <div className="sx-menu" role="menu" style={{ top: 44, right: 0, minWidth: 220 }}>
                                            <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid #EEE', marginBottom: 6 }}>
                                                <div style={{ fontSize: 14, fontWeight: 600 }}>{accountName}</div>
                                            </div>
                                            <button type="button" className="sx-mi" role="menuitem" onClick={() => { setAccountOpen(false); navigate('Settings'); }}><LineIcon name="settings" size={16} /> Settings</button>
                                            <button type="button" className="sx-mi" role="menuitem" onClick={() => { setAccountOpen(false); handleLogout(); }}><LineIcon name="logout" size={16} /> Sign out</button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ width: 1, height: 22, background: '#E5E5E5', margin: '0 6px' }} />
                                <button type="button" className="sx-ibtn" onClick={onClose} aria-label="Close Scrollin" title="Close Scrollin">
                                    <LineIcon name="close" />
                                </button>
                            </div>
                        </header>
                        <div className="sx-scroll" ref={scrollRef}>
                            {renderPage()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;

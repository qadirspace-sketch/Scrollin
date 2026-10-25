// background.js
try {
    importScripts('db.js');
} catch (e) {
    console.error("Failed to import db.js:", e);
}


// Keep track of attached tabs to avoid duplicate attachments
const attachedTabs = new Set();

// Target URL patterns to intercept
// We use a more flexible check now instead of strict patterns
function isTargetUrl(url) {
    return url.includes("/voyager/api/graphql") &&
        (url.includes("profileUrn") || url.includes("voyagerFeedDashProfileUpdates") || url.includes("voyagerSocialDashComments"));
}

// ============================================
// PER-TAB SESSION MANAGEMENT
// ============================================
// Each tab gets its own session object to prevent cross-tab data leaks.
let tabSessions = {}; // { tabId: sessionObject }

function getSession(tabId) {
    if (!tabSessions[tabId]) {
        tabSessions[tabId] = {
            tabId: tabId,
            profileUrn: null,
            queryId: null,
            commentQueryId: null,
            headers: {},
            start: 0,
            isWatchlistScan: false,
            // Fetch state (per-tab)
            isFetching: false,
            currentStart: 0,
            currentPaginationToken: null,
            consecutiveEmptyResponses: 0,
        };
    }
    return tabSessions[tabId];
}

function resetSession(tabId) {
    const session = getSession(tabId);
    session.profileUrn = null;
    session.queryId = null;
    session.commentQueryId = null;
    session.headers = {};
    session.start = 0;
    session.isWatchlistScan = false;
    session.isFetching = false;
    session.currentStart = 0;
    session.currentPaginationToken = null;
    session.consecutiveEmptyResponses = 0;
    // Clear per-tab logs
    chrome.storage.local.remove(`logs_${tabId}`);
    return session;
}

function deleteSession(tabId) {
    delete tabSessions[tabId];
    chrome.storage.local.remove(`logs_${tabId}`);
}

// Legacy compat: get session for a specific tab (replaces latestSession)
function getSessionForTab(tabId) {
    return getSession(tabId);
}

let isUpdatingProfiles = false; // Flag for background update process
let stopUpdateSignal = false; // Flag to abort
let apiKey = null;
let vanityToUrn = {}; // Cache for Vanity Name -> URN mapping
let lastKnownSession = null; // Persisted session fallback for Update All

(async () => {
    try {
        await openDB();
        const stored = await chrome.storage.local.get(['vanityToUrn', 'lastKnownSession']);
        if (stored.vanityToUrn) vanityToUrn = stored.vanityToUrn;
        if (stored.lastKnownSession) {
            lastKnownSession = stored.lastKnownSession;
            console.log("[Session] Restored lastKnownSession from storage. queryId:", lastKnownSession.queryId);
        }
        console.log("Restored state from storage:", { vanityCount: Object.keys(vanityToUrn).length });
    } catch (e) {
        console.error("Startup error:", e);
    }
})();

// Monitor tab updates to attach debugger to LinkedIn
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url && tab.url.includes("www.linkedin.com")) {

        // Check if we navigated to a new profile/page
        if (changeInfo.url) {
            console.log(`[Tab ${tabId}] Navigation detected. Resetting session and clearing logs.`);
            resetSession(tabId);

            // Notify content script to reset UI
            chrome.tabs.sendMessage(tabId, { action: "reset_ui" }).catch(() => { });
        }

        if (changeInfo.status === 'complete') {
            if (!attachedTabs.has(tabId)) {
                attachDebugger(tabId);
            }
        }
    }
});

// Monitor tab removal to cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
    attachedTabs.delete(tabId);
    deleteSession(tabId);
});

function attachDebugger(tabId) {
    chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
            console.log(`Failed to attach to tab ${tabId}: ${chrome.runtime.lastError.message}`);
            return;
        }
        attachedTabs.add(tabId);
        console.log(`Debugger attached to tab ${tabId}`);

        chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
            if (chrome.runtime.lastError) {
                console.error("Network.enable failed:", chrome.runtime.lastError.message);
            }

            // RELOAD page to ensure we capture the initial traffic
            // Only do this if it's the update tab to avoid annoying user in normal usage
            if (isUpdatingProfiles && updateTabId === tabId) {
                console.log("Reloading tab to force traffic capture...");
                chrome.tabs.reload(tabId);
            }
        });
    });
}

// Improved state management
const pendingRequests = new Map(); // requestId -> { url, timestamp }

chrome.debugger.onEvent.addListener((source, method, params) => {
    const tabId = source.tabId;

    if (method === "Network.requestWillBeSent") {
        const url = params.request.url;
        const requestHeaders = params.request.headers || {};

        // Ignore our own requests to prevent infinite loops and double processing (Debugger vs Fetch Response)
        // Check for X-Source: Interceptor (case-insensitive)
        const isInternal = Object.keys(requestHeaders).some(k =>
            k.toLowerCase() === 'x-source' && requestHeaders[k] === 'Interceptor'
        );

        if (isTargetUrl(url) && !isInternal) {
            pendingRequests.set(params.requestId, {
                url: url,
                timestamp: Date.now()
            });

            // Capture session params and headers
            try {
                const urlObj = new URL(url);
                const variables = urlObj.searchParams.get("variables");
                const queryId = urlObj.searchParams.get("queryId");

                if (variables && queryId) {
                    // Capture comment queryId specifically
                    if (url.includes("voyagerSocialDashComments")) {
                        const session = getSession(tabId);
                        session.commentQueryId = queryId;
                        console.log("Captured comment queryId:", queryId);
                    }

                    // Extract profileUrn using regex
                    // Handle both encoded and decoded variations
                    const decodedVariables = decodeURIComponent(variables);
                    const profileUrnMatch = decodedVariables.match(/profileUrn:([^,)]+)/);
                    const startMatch = decodedVariables.match(/start:(\d+)/);

                    if (profileUrnMatch) {
                        const newProfileUrn = profileUrnMatch[1];
                        const session = getSession(tabId);

                        // IGNORE URNs from "People Also Viewed" list (voyagerIdentityDashProfiles)
                        // This prevents the session from flipping to a random profile URN and resetting
                        if (queryId && queryId.includes("voyagerIdentityDashProfiles") && !queryId.includes("voyagerIdentityDashProfileComponents")) {
                            console.log(`[Session] Ignoring secondary profile URN from ${queryId}: ${newProfileUrn}`);
                            return;
                        }

                        // Detect profile switch based on URN change within same tab
                        if (session.profileUrn && session.profileUrn !== newProfileUrn) {
                            console.log(`[Tab ${tabId}] Profile switch detected (URN mismatch: ${session.profileUrn} -> ${newProfileUrn}). Resetting.`);
                            resetSession(tabId);
                            // Reset UI
                            chrome.tabs.sendMessage(tabId, { action: "reset_ui" }).catch(() => { });
                        }

                        session.profileUrn = newProfileUrn;
                        session.queryId = queryId;
                        session.headers = params.request.headers;

                        if (startMatch) {
                            session.start = parseInt(startMatch[1], 10);
                        }

                        // Persist this session so Update All works even after service worker restarts
                        lastKnownSession = { queryId, headers: params.request.headers };
                        chrome.storage.local.set({ lastKnownSession });


                        // Try to map Vanity Name -> URN
                        chrome.tabs.get(tabId, (tab) => {
                            if (chrome.runtime.lastError) return;
                            if (tab && tab.url && tab.url.includes('/in/')) {
                                const match = tab.url.match(/\/in\/([^\/]+)/);
                                if (match && match[1]) {
                                    const vanity = match[1];
                                    vanityToUrn[vanity] = newProfileUrn;
                                    console.log(`[Session] Mapped Vanity '${vanity}' -> ${newProfileUrn}`);
                                    chrome.storage.local.set({ vanityToUrn }); // Persist mapping

                                    // CHECK WATCHLIST STATUS — then trigger the correct fetch path
                                    getProfile(vanity).then(async profile => {
                                        const isUpdateTab = isUpdatingProfiles && updateTabId === tabId;

                                        // ── Always load existing posts so we can:
                                        //    a) detect watchlist profiles with a missing flag, and
                                        //    b) immediately show cached posts in the sidebar.
                                        const existingPosts = await getPostsByProfile(newProfileUrn);
                                        const hasPostsInDB = existingPosts.length > 0;

                                        // A profile is a "watchlist profile" if:
                                        //   1. explicitly marked inWatchlist in DB, OR
                                        //   2. already has posts saved in IndexedDB (self-healing), OR
                                        //   3. it's the actively-updating tab in an "Update All" run
                                        const isWatchlistProfile =
                                            isUpdateTab ||
                                            (profile && profile.inWatchlist) ||
                                            hasPostsInDB;

                                        if (isWatchlistProfile) {
                                            const reason = isUpdateTab ? 'update tab'
                                                : (profile && profile.inWatchlist) ? 'flagged inWatchlist'
                                                    : 'has posts in IndexedDB';
                                            console.log(`[Watchlist] Profile ${vanity} → watchlist mode (${reason}).`);
                                            session.isWatchlistScan = true;

                                            // ── Self-heal: fix missing inWatchlist flag ──────────────
                                            if (hasPostsInDB) {
                                                if (profile && !profile.inWatchlist) {
                                                    profile.inWatchlist = true;
                                                    profile.profileUrn = newProfileUrn;
                                                    saveProfileToDB(profile);
                                                    console.log(`[Watchlist] Healed inWatchlist flag for ${vanity}.`);
                                                } else if (!profile) {
                                                    // No profile record at all — create a minimal one
                                                    saveProfileToDB({
                                                        creatorId: vanity,
                                                        profileUrn: newProfileUrn,
                                                        inWatchlist: true,
                                                        lastUpdated: Date.now()
                                                    });
                                                    console.log(`[Watchlist] Created missing profile record for ${vanity}.`);
                                                }
                                            }

                                            // ── Update stored profileUrn if it changed ───────────────
                                            if (profile && profile.profileUrn !== newProfileUrn) {
                                                profile.profileUrn = newProfileUrn;
                                                saveProfileToDB(profile);
                                            }

                                            // ── Immediately preload cached posts into the sidebar ────
                                            // This makes the old posts visible RIGHT NOW, before the
                                            // background sync even starts.
                                            if (!isUpdateTab && hasPostsInDB) {
                                                console.log(`[Watchlist] Pre-loading ${existingPosts.length} cached posts immediately.`);
                                                chrome.storage.local.set({
                                                    [`logs_${tabId}`]: [{
                                                        url: "db-preload",
                                                        timestamp: Date.now(),
                                                        extractedPosts: existingPosts
                                                    }]
                                                });
                                            }

                                            // ── Start background sync (runs AFTER preload renders) ───
                                            if (queryId.includes("voyagerFeedDashProfileUpdates") && !session.isFetching) {
                                                setTimeout(() => {
                                                    if (!session.isFetching && session.profileUrn && session.queryId) {
                                                        console.log(`[Tab ${tabId}] Starting runWatchlistSync...`);
                                                        runWatchlistSync(tabId);
                                                    }
                                                }, 1500); // 1.5 s — enough for preload to render in sidebar
                                            }

                                        } else {
                                            session.isWatchlistScan = false;

                                            // Normal profile: use existing fetchNextBatch relay
                                            if (queryId.includes("voyagerFeedDashProfileUpdates") && !session.isFetching) {
                                                setTimeout(() => {
                                                    if (!session.isFetching && session.profileUrn && session.queryId) {
                                                        session.isFetching = true;
                                                        session.currentStart = (session.start || 0) + 100;
                                                        session.consecutiveEmptyResponses = 0;
                                                        console.log(`[Tab ${tabId}] Normal profile — auto-starting fetch from start=${session.currentStart}`);
                                                        fetchNextBatch(tabId);
                                                    }
                                                }, 800);
                                            }
                                        }
                                    });
                                }
                            }
                        });


                        console.log(`[Tab ${tabId}] Captured session params:`, session);

                        // Listen for AI Tagging requests from the content script
                        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

                            if (request.action === "fetch_ai_tags") {
                                const CF_WORKER_URL = "https://linkedin-post-tagger-worker.iamabdulsamad2-0.workers.dev";
                                console.log(`[Background] Fetching AI tags for post...`);

                                fetch(CF_WORKER_URL, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ text: request.text })
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                        console.log(`[Background] AI fetch success:`, data);
                                        sendResponse({ success: true, data: data });
                                    })
                                    .catch(error => {
                                        console.error(`[Background] AI fetch failed:`, error);
                                        sendResponse({ success: false, error: error.message });
                                    });

                                return true; // Keep the message channel open for async response
                            }

                            if (request.action === "fetch_ai_tags_batch") {
                                const CF_WORKER_URL = "https://linkedin-post-tagger-worker.iamabdulsamad2-0.workers.dev";
                                const items = request.items || [];
                                console.log(`[Background] Sending SINGLE batch request for ${items.length} items...`);

                                // Format payload for the new Worker API
                                const payload = {
                                    batch: items.map(item => ({ id: item.id, text: item.text }))
                                };

                                fetch(CF_WORKER_URL, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                        // data should be { "id1": { primaryTag... }, "id2": ... }
                                        console.log(`[Background] Batch success. Received keys: ${Object.keys(data).length}`);
                                        sendResponse({ success: true, results: data });
                                    })
                                    .catch(err => {
                                        console.error(`[Background] Batch request failed:`, err);
                                        sendResponse({ success: false, error: err.message });
                                    });

                                return true; // Keep channel open
                            }

                            // IMPORTANT: return false for unrecognized actions so
                            // other onMessage listeners can handle them
                            return false;
                        });

                        // Notify content script that we are ready (shows spinner in sidebar)
                        chrome.tabs.sendMessage(tabId, { action: "session_captured" }).catch(() => { });
                        // Note: auto-fetch is triggered inside getProfile().then() above,
                        // where session.isWatchlistScan is definitively known.
                    }
                }
            } catch (e) {
                console.error("Error parsing URL params:", e);
            }
        }
    } else if (method === "Network.loadingFinished") {
        const requestId = params.requestId;
        if (pendingRequests.has(requestId)) {
            const requestData = pendingRequests.get(requestId);

            chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("Failed to get body:", chrome.runtime.lastError.message);
                    pendingRequests.delete(requestId);
                    return;
                }

                const body = response.body;
                let finalBody = body;
                if (response.base64Encoded) {
                    try {
                        finalBody = atob(body);
                    } catch (e) {
                        console.error("Failed to decode base64 body:", e);
                    }
                }

                if (requestData.url.includes("voyagerSocialDashComments")) {
                    const commentsData = extractComments(finalBody, requestData.url);
                    if (commentsData) {
                        // Send comments to UI
                        chrome.tabs.sendMessage(tabId, {
                            action: "comments_fetched",
                            ...commentsData
                        }).catch(() => { });
                    }
                } else {
                    const session = getSession(tabId);
                    const extractedPosts = extractPosts(finalBody, session.profileUrn);

                    saveLog({
                        url: requestData.url,
                        timestamp: requestData.timestamp,
                        extractedPosts: extractedPosts
                    }, !session.isWatchlistScan, tabId); // Normal profiles: skip DB
                }

                pendingRequests.delete(requestId);
            });
        }
    }
});

// ... (existing code) ...

// Message handling for manual fetching
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Determine which tab this message is from
    const senderTabId = sender?.tab?.id;

    if (message.action === "get_tab_id") {
        sendResponse({ tabId: senderTabId });
        return;
    }

    if (message.action === "start_fetching") {
        const session = senderTabId ? getSession(senderTabId) : null;
        if (!session || !session.profileUrn || !session.queryId) {
            console.error("No session captured yet for this tab. Please scroll the feed first.");
            return;
        }

        session.isFetching = true;
        session.consecutiveEmptyResponses = 0;

        // Continue from where the user left off
        session.currentStart = (session.start || 0) + 100;

        console.log(`[Tab ${senderTabId}] Starting fetch from start=${session.currentStart}`);
        fetchNextBatch(senderTabId);
    } else if (message.action === "fetch_response") {
        const msgTabId = senderTabId || message.tabId;
        const session = msgTabId ? getSession(msgTabId) : null;
        if (!session || !session.isFetching) return;

        if (session.isFetching && !message.error) {
            const { data, error } = message;
            const token = extractPaginationToken(data);
            const extractedPostsCount = (data?.included?.length) || 0;

            const shouldStop = !token || token === session.currentPaginationToken || extractedPostsCount === 0;

            if (shouldStop) {
                const reason = !token ? "No pagination token" :
                    token === session.currentPaginationToken ? "Token loop detected" :
                        "No data in response";
                console.log(`[Tab ${msgTabId}] Fetching complete (Stopping). Reason:`, reason);
                session.isFetching = false;
                session.consecutiveEmptyResponses = 0;

                // For Watchlist profiles, we finalize from DB (handled in the setTimeout below)
                // For Normal profiles, just notify UI
                if (!session.isWatchlistScan) {
                    chrome.tabs.sendMessage(msgTabId, { action: "fetching_complete" }).catch(() => { });
                }
            } else {
                // FIRE NEXT REQUEST IMMEDIATELY
                session.currentPaginationToken = token;
                session.currentStart += 100;
                console.log(`[Tab ${msgTabId}] Token found! Firing next request immediately.`);
                fetchNextBatch(msgTabId);
            }
        }

        if (message.error) {
            console.error("Fetch error:", message.error);
            if (session) session.isFetching = false;
            return;
        }

        // Watchlist profiles are handled entirely by runWatchlistSync() in the background.
        // Only process fetch_response for NORMAL profiles here.
        if (session.isWatchlistScan) return;

        // Process Data Asynchronously (Fire & Forget processing)
        const capturedTabId = msgTabId; // Capture for closure
        setTimeout(async () => {
            const session = getSession(capturedTabId);
            const { data } = message;
            const extractedPosts = extractPosts(JSON.stringify(data), session.profileUrn);
            console.log(`[Tab ${capturedTabId}] Fetch response processed. Extracted ${extractedPosts.length} posts.`);

            // NORMAL PROFILE MODE
            saveLog({
                url: "auto-fetch",
                timestamp: Date.now(),
                extractedPosts: extractedPosts
            }, true, capturedTabId); // skipDB = true

            console.log("[Normal Mode] Displayed posts live. Continuing fetch...");
        }, 0);
    } else if (message.action === "stop_fetching") {
        if (senderTabId) {
            const session = getSession(senderTabId);
            session.isFetching = false;
            session.consecutiveEmptyResponses = 0;
        }
    } else if (message.action === "fetch_comments") {
        fetchComments(message.socialDetailUrn, message.start, message.paginationToken, senderTabId);
    } else if (message.action === "polishTemplate") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${message.apiKey}`;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message.payload)
        })
            .then(async (response) => {
                const data = await response.json();
                sendResponse({ ok: response.ok, status: response.status, statusText: response.statusText, data });
            })
            .catch(error => {
                console.error("Gemini API Proxy Error:", error);
                sendResponse({ ok: false, error: error.toString() });
            });
        return true; // Keep channel open
    } else if (message.action === 'start_profile_update') {
        const profileUrls = message.profiles || [];
        if (profileUrls.length > 0) {
            startProfileUpdates(profileUrls);
        }
    } else if (message.action === 'stop_profile_update') {
        stopProfileUpdates();
    } else if (message.action === 'get_profile_posts') {
        console.log(`[Background] Received get_profile_posts request. URN: ${message.profileUrn}, Vanity: ${message.vanityName}`);

        let targetUrn = message.profileUrn;
        let creatorId = message.creatorId;

        // If no creatorId provided, try to extract from current tab or session
        if (!creatorId && message.url) {
            creatorId = extractCreatorId(message.url);
        }

        // resolve URN from vanity name if provided and URN is missing
        if (!targetUrn && message.vanityName) {
            targetUrn = vanityToUrn[message.vanityName];
            console.log(`[Background] Resolved vanity '${message.vanityName}' to URN: ${targetUrn}`);
        } else if (!targetUrn && creatorId) {
            targetUrn = vanityToUrn[creatorId];
        }

        // Validate if we are falling back to session
        if (!targetUrn) {
            // Check if we are on the correct page first
            if (message.vanityName || creatorId) {
                const idToCheck = message.vanityName || creatorId;
                // It's possible we haven't mapped this vanity yet.
                // We can try to look it up in the 'profiles' store if we saved it before
                getProfile(idToCheck).then(profile => {
                    if (profile && profile.profileUrn) {
                        // Found in DB!
                        getPostsByProfile(profile.profileUrn).then(posts => {
                            sendResponse({ success: true, posts: posts });
                        });
                    } else {
                        // Not in DB, and not in session map.
                        // Fallback to session ONLY if the session URL matches the ID
                        // This is tricky. Let's just return empty or error.
                        // BUT, if the user is ON the page, the session should be captured.
                        // Fallback to this tab's session
                        const tabSession = senderTabId ? getSession(senderTabId) : null;
                        if (tabSession && tabSession.profileUrn) {
                            console.warn("[Background] No URN resolved. Returning tab session URN as fallback.");
                            getPostsByProfile(tabSession.profileUrn).then(posts => {
                                sendResponse({ success: true, posts: posts });
                            });
                        } else {
                            sendResponse({ success: false, error: 'Profile not identified yet.' });
                        }
                    }
                });
                return true; // Async
            }

            // Legacy fallback (only if no vanity name provided)
            const tabSession = senderTabId ? getSession(senderTabId) : null;
            console.warn("[Background] No URN or Vanity provided. Falling back to tab session.");
            targetUrn = tabSession ? tabSession.profileUrn : null;
        }

        if (targetUrn) {
            getPostsByProfile(targetUrn).then(posts => {
                console.log(`[Background] Returned ${posts.length} posts for URN ${targetUrn}`);
                sendResponse({ success: true, posts: posts });
            });
            return true;
        } else {
            // Last ditch: check if we have a creatorId and query by that index
            if (creatorId) {
                getPostsByProfile(creatorId, false).then(posts => { // isUrn = false
                    console.log(`[Background] Returned ${posts.length} posts for CreatorID ${creatorId}`);
                    sendResponse({ success: true, posts: posts });
                });
                return true;
            }
            sendResponse({ success: false, error: 'No profileUrn found.' });
        }
    } else if (message.action === 'clear_database') {
        console.log("[Background] Clearing database...");
        clearAllPosts().then(success => {
            // Clear all per-tab logs and sessions
            const keysToRemove = Object.keys(tabSessions).map(id => `logs_${id}`);
            chrome.storage.local.remove(keysToRemove);
            tabSessions = {};
            vanityToUrn = {};
            chrome.storage.local.set({ vanityToUrn: {} });
            sendResponse({ success: success });
        });
        return true;
    } else if (message.action === 'get_watchlist_status') {
        const creatorId = message.creatorId || extractCreatorId(message.url);
        if (creatorId) {
            getProfile(creatorId).then(profile => {
                sendResponse({ inWatchlist: profile ? !!profile.inWatchlist : false, profile: profile });
            });
            return true;
        }
        sendResponse({ inWatchlist: false });
    } else if (message.action === 'toggle_watchlist') {
        const creatorId = message.creatorId || extractCreatorId(message.url);
        console.log(`[toggle_watchlist] URL: ${message.url}, creatorId: ${creatorId}`);
        if (creatorId) {
            getProfile(creatorId).then(profile => {
                const newStatus = profile ? !profile.inWatchlist : true;
                const tabSession = senderTabId ? getSession(senderTabId) : null;
                const newProfile = profile || {
                    creatorId: creatorId,
                    profileUrn: message.profileUrn || (tabSession ? tabSession.profileUrn : null),
                    profileUrl: message.url
                };
                newProfile.inWatchlist = newStatus;
                newProfile.lastUpdated = Date.now();

                // Ensure we have a URN
                if (!newProfile.profileUrn && tabSession && tabSession.profileUrn) {
                    newProfile.profileUrn = tabSession.profileUrn;
                }

                saveProfileToDB(newProfile).then(() => {
                    console.log(`[toggle_watchlist] Saved profile ${creatorId}. inWatchlist: ${newStatus}`);
                    sendResponse({ success: true, inWatchlist: newStatus });
                });
            });
            return true;
        }
        console.warn("[toggle_watchlist] Could not extract creatorId from URL:", message.url);
        sendResponse({ success: false, error: 'Could not identify profile from URL.' });
    } else if (message.action === 'get_all_watchlist_profiles') {
        getWatchlistProfiles().then(profiles => {
            sendResponse({ success: true, profiles: profiles });
        });
        return true;
    } else if (message.action === 'update_all_profiles') {
        updateAllProfiles().then(results => {
            sendResponse({ success: true, results: results });
        });
        return true;
    } else if (message.action === 'delete_profile') {
        const { creatorId, profileUrn } = message;
        console.log(`[Background] Deleting profile ${creatorId}...`);
        deleteProfileData(creatorId, profileUrn).then(result => {
            // Also delete from active sessions to be safe
            Object.values(tabSessions).forEach(session => {
                if (session.profileUrn === profileUrn) {
                    session.profileUrn = null; // Detach session from deleted profile
                }
            });
            sendResponse(result);
        });
        return true;
    }
});



// ============================
// Watchlist finalize — clear live logs, load from DB, render
// ============================
async function watchlistFinalizeAndRender(tabId) {
    const session = getSession(tabId);
    console.log(`[Tab ${tabId}][Watchlist Finalize] Loading all posts from IndexedDB for rendering...`);

    const allDbPosts = await getPostsByProfile(session.profileUrn);
    console.log(`[Tab ${tabId}][Watchlist Finalize] Retrieved ${allDbPosts.length} total posts from DB.`);

    // Write to per-tab storage key
    chrome.storage.local.set({
        [`logs_${tabId}`]: [{
            url: "db-render",
            timestamp: Date.now(),
            extractedPosts: allDbPosts
        }]
    });

    console.log(`[Tab ${tabId}][Watchlist Finalize] UI updated with ${allDbPosts.length} posts from DB.`);

    // Notify content script
    chrome.tabs.sendMessage(tabId, {
        action: "fetching_complete",
        profileUrn: session.profileUrn
    }).catch((err) => { console.error("[Watchlist Finalize] Send failed:", err); });

    // Handle background update queue
    if (isUpdatingProfiles) {
        stopCurrentProfileFetch();
    }

    // Adopt orphans
    if (session.profileUrn) {
        const orphanCount = await migrateProfileUrn(null, session.profileUrn);
        if (orphanCount > 0) console.log(`[Migration] Adopted ${orphanCount} orphan posts.`);
    }
}

// ============================
// Watchlist Sync — 3-Case Algorithm
// Runs entirely in the background (no content-script relay needed).
// ============================

/**
 * Make a single direct background fetch to the LinkedIn Voyager feed API.
 * Returns the parsed JSON data, or throws on error.
 */
async function watchlistFetch(session, start, paginationToken, batchSize = 100) {
    let variables = `(count:${batchSize},start:${start},profileUrn:${encodeURIComponent(session.profileUrn)}`;
    if (paginationToken) variables += `,paginationToken:${paginationToken}`;
    variables += ')';

    const url = `https://www.linkedin.com/voyager/api/graphql?variables=${variables}&queryId=${session.queryId}`;

    // Build safe headers (strip headers that break service-worker fetch)
    const safeHeaders = {};
    for (const [k, v] of Object.entries(session.headers || {})) {
        if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())) {
            safeHeaders[k] = v;
        }
    }
    safeHeaders['X-Source'] = 'WatchlistSync';

    const res = await fetch(url, { method: 'GET', headers: safeHeaders, credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
}

/**
 * Main watchlist sync algorithm.
 *
 * Case A — Latest DB post found at position N in this batch:
 *   Posts 0…N-1  → NEW (before the known post) → save to DB
 *   Post  N      → already saved (the overlap / anchor)
 *   Posts N+1…   → older, already in DB
 *   → Save new posts, stop, render from DB.
 *
 * Case B — Latest DB post NOT found in this batch:
 *   ALL posts in this batch are newer than anything in DB.
 *   Buffer them and fetch the next batch.
 *   Repeat until overlap found or feed exhausted.
 *   → Save all buffered new posts, render from DB.
 *
 * Case C — No DB data at all:
 *   Fetch everything, save everything, render from DB.
 */
async function runWatchlistSync(tabId) {
    const session = getSession(tabId);
    if (!session || !session.profileUrn || !session.queryId) {
        console.warn(`[WatchlistSync Tab ${tabId}] No valid session. Aborting.`);
        return;
    }

    session.isFetching = true;
    console.log(`[WatchlistSync Tab ${tabId}] Starting sync for URN: ${session.profileUrn}`);

    // Notify sidebar: we're checking for new posts
    chrome.tabs.sendMessage(tabId, { action: 'watchlist_sync_start' }).catch(() => { });

    try {
        // Get the latest post already stored so we know where to stop
        const latestDbPost = await getLatestPostForProfile(session.profileUrn);
        const latestDbUrn = latestDbPost ? latestDbPost.urn : null;

        console.log(`[WatchlistSync Tab ${tabId}] Latest DB URN: ${latestDbUrn || '(none — Case C)'}`);

        // Case C (no prior DB data) uses full batches (100) to do a complete history pull.
        // Cases A & B (incremental sync) use smaller batches (20) since we expect to find
        // the overlap quickly — no need to fetch 100 posts when the overlap is in the first 5.
        const isColdStart = !latestDbUrn;
        const BATCH_SIZE = isColdStart ? 100 : 20;

        let start = 0;
        let paginationToken = null;
        const newPostsBuffer = [];   // Accumulated new posts (Case A/B only — Case C saves directly)
        const MAX_BATCHES = 200;     // Safety cap: 200×100 = 20 000 posts maximum
        let batchCount = 0;
        let syncDone = false;

        while (batchCount < MAX_BATCHES) {
            batchCount++;
            console.log(`[WatchlistSync Tab ${tabId}] Batch ${batchCount} — start=${start}, batchSize=${BATCH_SIZE}`);

            let data;
            try {
                data = await watchlistFetch(session, start, paginationToken, BATCH_SIZE);
            } catch (fetchErr) {
                console.error(`[WatchlistSync Tab ${tabId}] Fetch error on batch ${batchCount}:`, fetchErr);
                break; // Network error — stop and render whatever we have
            }

            const batch = extractPosts(JSON.stringify(data), session.profileUrn);
            console.log(`[WatchlistSync Tab ${tabId}] Batch ${batchCount}: ${batch.length} posts extracted.`);

            // ── Case C path: no DB data yet ──────────────────────────────
            if (isColdStart) {
                if (batch.length === 0) {
                    console.log(`[WatchlistSync Tab ${tabId}] Case C: feed exhausted after ${batchCount} batches.`);
                    syncDone = true;
                    break;
                }

                // Save each batch immediately — progress is preserved even if the tab closes
                try {
                    await savePostsToDB(batch);
                    console.log(`[WatchlistSync Tab ${tabId}] Case C: saved batch ${batchCount} (${batch.length} posts) to DB.`);
                } catch (saveErr) {
                    console.error(`[WatchlistSync Tab ${tabId}] Case C: save error on batch ${batchCount}:`, saveErr);
                }

                const nextToken = extractPaginationToken(data);
                if (!nextToken || nextToken === paginationToken) {
                    console.log(`[WatchlistSync Tab ${tabId}] Case C: no more pages after batch ${batchCount}.`);
                    syncDone = true;
                    break;
                }
                paginationToken = nextToken;
                // Advance start by actual posts returned (NOT a hardcoded number)
                start += batch.length;
                continue; // fetch next page
            }

            // ── Case A / B path: we have a known latest DB URN ───────────
            if (batch.length === 0) {
                // Feed exhausted — treat remainder as done
                console.log(`[WatchlistSync Tab ${tabId}] Case B→done: empty batch, feed exhausted.`);
                syncDone = true;
                break;
            }

            const overlapIdx = batch.findIndex(p => p.urn === latestDbUrn);

            if (overlapIdx !== -1) {
                // ── CASE A: overlap found in this batch ───────────────────
                console.log(`[WatchlistSync Tab ${tabId}] Case A: overlap at index ${overlapIdx}/${batch.length - 1}.`);
                // Everything BEFORE the overlap post is new
                const newInBatch = batch.slice(0, overlapIdx);
                newPostsBuffer.push(...newInBatch);
                console.log(`[WatchlistSync Tab ${tabId}] Case A: ${newInBatch.length} new posts in this batch.`);
                syncDone = true;
                break; // Stop fetching
            } else {
                // ── CASE B: entire batch is new, keep going ───────────────
                console.log(`[WatchlistSync Tab ${tabId}] Case B: all ${batch.length} posts are new. Fetching next batch...`);
                newPostsBuffer.push(...batch);

                const nextToken = extractPaginationToken(data);
                if (!nextToken || nextToken === paginationToken) {
                    console.log(`[WatchlistSync Tab ${tabId}] Case B: no more pages.`);
                    syncDone = true;
                    break;
                }
                paginationToken = nextToken;
                // Advance start by actual posts returned
                start += batch.length;
                // continue looping
            }
        }

        // ── Save new posts to IndexedDB (Case A & B only) ───────────────
        // Case C saves directly in the loop above, so newPostsBuffer is empty for it.
        if (newPostsBuffer.length > 0) {
            // Deduplicate (Case B may have buffered posts from multiple batches)
            const seenUrns = new Set();
            const uniqueNew = newPostsBuffer.filter(p => {
                if (seenUrns.has(p.urn)) return false;
                seenUrns.add(p.urn);
                return true;
            });
            console.log(`[WatchlistSync Tab ${tabId}] Saving ${uniqueNew.length} new posts to IndexedDB (Cases A/B).`);
            await savePostsToDB(uniqueNew);
        } else if (!isColdStart) {
            console.log(`[WatchlistSync Tab ${tabId}] No new posts found. DB is already up to date.`);
        }

    } catch (e) {
        console.error(`[WatchlistSync Tab ${tabId}] Unexpected error:`, e);
    }

    // ── Always finalize by reading from DB and rendering ─────────────────
    session.isFetching = false;
    console.log(`[WatchlistSync Tab ${tabId}] Sync complete. Rendering from IndexedDB...`);
    await watchlistFinalizeAndRender(tabId);
}

function fetchNextBatch(tabId) {
    const session = getSession(tabId);
    if (!session.isFetching) {
        console.log(`[Tab ${tabId}] fetchNextBatch called but isFetching is false. Aborting.`);
        return;
    }

    let count = 100;
    let variables = `(count:${count},start:${session.currentStart},profileUrn:${encodeURIComponent(session.profileUrn)}`;

    if (session.currentPaginationToken) {
        variables += `,paginationToken:${session.currentPaginationToken}`;
    }
    variables += `)`;

    const url = `https://www.linkedin.com/voyager/api/graphql?variables=${variables}&queryId=${session.queryId}`;

    console.log(`[Tab ${tabId}] Generated Fetch URL:`, url);

    const requestHeaders = { ...session.headers, "X-Source": "Interceptor" };

    chrome.tabs.sendMessage(tabId, {
        action: "fetch_url",
        url: url,
        headers: requestHeaders
    });
}

// ... fetchComments ...

function extractCreatorId(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        // Matches /in/{id}/ or /in/{id}
        const match = urlObj.pathname.match(/\/in\/([^\/]+)/);
        return match ? match[1] : null;
    } catch (e) {
        // Handle partial URLs or errors
        const match = url.match(/\/in\/([^\/]+)/);
        return match ? match[1] : null;
    }
}

async function updateAllProfiles() {
    console.log("[Update All] Starting update of all watchlist profiles...");
    const profiles = await getWatchlistProfiles();
    const results = [];

    for (const profile of profiles) {
        console.log(`[Update All] Updating ${profile.creatorId}...`);
        // We can't easily "fetch" in the background without a tab context for that specific profile 
        // unless we reuse the current tab's session cookies and just change the URN/Variables.
        // HOWEVER, LinkedIn queryIds might change, or cookies might be specific (unlikely for cookies, but queryIds yes).
        // `voyagerFeedDashProfileUpdates` queryId is usually stable.

        // CRITICAL: We need a valid `queryId` and `headers` (CSRF token).
        // Find any available active session to borrow headers/queryId from
        const anySession = Object.values(tabSessions).find(s => s.headers && s.queryId);
        if (!anySession) {
            results.push({ id: profile.creatorId, status: 'skipped', reason: 'No active session' });
            continue;
        }

        // We need the Profile URN. If we only have ID, we might be stuck if not mapped.
        if (!profile.profileUrn) {
            results.push({ id: profile.creatorId, status: 'failed', reason: 'No URN' });
            continue;
        }

        try {
            // Manually trigger a fetch for this profile
            // We use a separate function to avoid messing with `isFetching` state of the UI? 
            // Or we just queue them.
            // Let's try to do a single batch fetch for the latest 20 posts.

            const fetchedCount = await fetchProfileUpdates(profile.profileUrn, anySession);
            results.push({ id: profile.creatorId, status: 'success', count: fetchedCount });

            // Update lastFetched
            profile.lastFetched = Date.now();
            await saveProfileToDB(profile);

            // Wait a bit to be nice to the API
            await new Promise(r => setTimeout(r, 2000));

        } catch (e) {
            console.error(`[Update All] Failed to update ${profile.creatorId}:`, e);
            results.push({ id: profile.creatorId, status: 'error', error: e.message });
        }
    }
    return results;
}

// Helper to fetch updates for a specific profile using current session
function fetchProfileUpdates(profileUrn, session) {
    return new Promise((resolve, reject) => {
        // Construct URL for latest 20 posts
        const count = 20;
        const start = 0;
        // Verify queryId
        if (!session.queryId) return reject(new Error("No queryId"));

        const variables = `(count:${count},start:${start},profileUrn:${encodeURIComponent(profileUrn)})`;
        const url = `https://www.linkedin.com/voyager/api/graphql?variables=${variables}&queryId=${session.queryId}`;

        const requestHeaders = { ...session.headers, "X-Source": "Interceptor" };

        // We use fetch directly here since we are in background, BUT we might run into CORS if we don't go through a tab.
        // `fetch` in background/service worker has different CORS rules. 
        // Usually, extensions with host permissions can fetch.
        // Let's try direct fetch.

        // Note: We need to handle the response manually here, distinct from the global `fetch_response` listener loop.

        fetch(url, {
            method: 'GET',
            headers: requestHeaders,
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                const extractedPosts = extractPosts(JSON.stringify(data), profileUrn);
                console.log(`[Update All] Fetched ${extractedPosts.length} posts for ${profileUrn}`);
                if (extractedPosts.length > 0) {
                    savePostsToDB(extractedPosts).then(newCount => {
                        resolve(newCount);
                    });
                } else {
                    resolve(0);
                }
            })
            .catch(err => reject(err));
    });
}


function fetchComments(socialDetailUrn, start = 0, paginationToken = null, tabId = null) {
    // Find a session to use for headers
    let session = tabId ? getSession(tabId) : null;
    if (!session) {
        // Fallback: try any active session
        session = Object.values(tabSessions).find(s => s.headers);
    }
    if (!session || !tabId) {
        console.error("fetchComments: no valid session or tabId");
        return;
    }

    if (!socialDetailUrn) {
        console.error("fetchComments: socialDetailUrn is missing!");
        return;
    }

    console.log("fetchComments: socialDetailUrn =", socialDetailUrn);

    const queryId = "voyagerSocialDashComments.afec6d88d7810d45548797a8dac4fb87";

    let variables = `(count:10,numReplies:1,socialDetailUrn:${encodeURIComponent(socialDetailUrn)},sortOrder:RELEVANCE,start:${start}`;

    if (paginationToken) {
        variables += `,paginationToken:${paginationToken}`;
    }
    variables += `)`;

    const encodedVariables = encodeURIComponent(variables);
    const url = `https://www.linkedin.com/voyager/api/graphql?variables=${encodedVariables}&queryId=${queryId}`;

    console.log("Generated Comment Fetch URL:", url);

    const requestHeaders = { ...session.headers, "X-Source": "Interceptor" };

    chrome.tabs.sendMessage(tabId, {
        action: "fetch_url",
        url: url,
        headers: requestHeaders,
        isCommentFetch: true
    });
}

function extractPaginationToken(data) {
    try {
        // Recursive helper to find paginationToken
        const findToken = (obj) => {
            if (!obj || typeof obj !== 'object') return null;

            // STRICT CHECK: Only return strings
            if (obj.paginationToken && typeof obj.paginationToken === 'string') {
                return obj.paginationToken;
            }

            if (obj.metadata && obj.metadata.paginationToken && typeof obj.metadata.paginationToken === 'string') {
                return obj.metadata.paginationToken;
            }

            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    // OPTIMIZATION: Skip large arrays or irrelevant objects to speed up token search
                    // NOTE: Do NOT skip 'meta' — LinkedIn stores paginationToken inside meta objects!
                    if (key === 'included' || key === 'extensions') continue;

                    const result = findToken(obj[key]);
                    if (result) return result;
                }
            }
            return null;
        };

        const token = findToken(data);
        if (token) {
            console.log("[PaginationToken] Found token:", token.substring(0, 40) + '...');
            return token;
        } else {
            console.log("[PaginationToken] No token found in response — feed likely exhausted.");
        }
    } catch (e) {
        console.error("Error extracting token:", e);
    }
    return null;
}

// Cleanup old pending requests periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of pendingRequests) {
        if (now - data.timestamp > 60000) {
            pendingRequests.delete(id);
        }
    }
}, 30000);

/**
 * Extracts posts (text + media) from the JSON object.
 */
function extractPosts(jsonString, profileUrn) {
    const posts = [];
    try {
        const data = JSON.parse(jsonString);

        if (data.included && Array.isArray(data.included)) {
            const urnMap = new Map();
            data.included.forEach(item => {
                if (item.entityUrn) urnMap.set(item.entityUrn, item);
                if (item.urn) urnMap.set(item.urn, item);
            });

            let orderedUrns = findElementsArray(data.data);

            if (!orderedUrns || !Array.isArray(orderedUrns)) {
                console.log("No ordered URNs found in data.data");
            }

            if (orderedUrns && Array.isArray(orderedUrns)) {
                orderedUrns.forEach(urn => {
                    const item = urnMap.get(urn);
                    if (item) {
                        const post = parsePost(item, urnMap, profileUrn);
                        if (post) {
                            posts.push(post);
                        }
                    }
                });
            }
        } else {
            console.log("No 'included' array found in response data");
        }
    } catch (e) {
        console.error("Error parsing JSON for extraction:", e);
    }
    return posts;
}

function extractComments(jsonString, requestUrl) {
    try {
        const data = JSON.parse(jsonString);
        const comments = [];
        let paginationToken = null;
        let socialDetailUrn = null;
        let root = data.data?.socialDashCommentsBySocialDetail;
        const urnMap = new Map(); // Declare urnMap here

        if (data.included && Array.isArray(data.included)) {
            data.included.forEach(item => {
                if (item.entityUrn) urnMap.set(item.entityUrn, item);
                if (item.urn) urnMap.set(item.urn, item);
            });

            // Attempt to find SocialDetail in included
            const socialDetail = data.included.find(item => item.$type === 'com.linkedin.voyager.dash.social.SocialDetail');
            if (socialDetail) {
                socialDetailUrn = socialDetail.entityUrn;
            }
        }

        if (root) { // Check if root exists before accessing its properties
            if (root.metadata && root.metadata.paginationToken) {
                paginationToken = root.metadata.paginationToken;
            }
        }

        // Fallback: Extract 'socialDetailUrn' from URL if not found in response
        if (!socialDetailUrn && requestUrl) {
            try {
                const urlObj = new URL(requestUrl);
                const variables = urlObj.searchParams.get("variables");
                if (variables) {
                    const decodedVars = decodeURIComponent(variables);
                    const match = decodedVars.match(/socialDetailUrn:(urn:li:[^,)]+)/) ||
                        decodedVars.match(/socialDetailUrn:([^,)]+)/);
                    if (match) {
                        let potentialUrn = match[1];
                        potentialUrn = potentialUrn.replace(/^"|"$/g, '');
                        if (potentialUrn.includes('%')) {
                            potentialUrn = decodeURIComponent(potentialUrn);
                        }
                        socialDetailUrn = potentialUrn;
                        console.log("Extracted socialDetailUrn from URL fallback:", socialDetailUrn);
                    }
                }
            } catch (err) {
                console.warn("Failed to extract socialDetailUrn from URL:", err);
            }
        }

        // Process elements
        if (root) { // Ensure root exists before trying to access its elements
            if (root.elements && Array.isArray(root.elements)) {
                root.elements.forEach(commentUrn => {
                    const commentItem = urnMap.get(commentUrn);
                    if (commentItem) {
                        const parsedComment = parseComment(commentItem, urnMap);
                        if (parsedComment) {
                            comments.push(parsedComment);
                        }
                    }
                });
            } else if (root['*elements'] && Array.isArray(root['*elements'])) {
                root['*elements'].forEach(commentUrn => {
                    const commentItem = urnMap.get(commentUrn);
                    if (commentItem) {
                        const parsedComment = parseComment(commentItem, urnMap);
                        if (parsedComment) {
                            comments.push(parsedComment);
                        }
                    }
                });
            }
        }

        return { comments, paginationToken, socialDetailUrn };

    } catch (e) {
        console.error("Error parsing comments:", e);
        return null;
    }
}

function parseComment(item, urnMap) {
    try {
        let text = "";
        let authorName = "";
        let authorImage = "";
        let authorHeadline = "";
        let time = "";
        let profileUrl = "";

        // Text
        if (item.commentary && item.commentary.text) {
            if (typeof item.commentary.text === 'string') {
                text = item.commentary.text;
            } else if (item.commentary.text.text) {
                text = item.commentary.text.text;
            }
        }

        // Author
        if (item.commenter) {
            const commenter = item.commenter;

            // Name
            if (commenter.title && commenter.title.text) {
                authorName = commenter.title.text;
            }

            // Headline - Handle both string and object cases
            if (commenter.subtitle) {
                if (typeof commenter.subtitle === 'string') {
                    authorHeadline = commenter.subtitle;
                } else if (commenter.subtitle.text) {
                    authorHeadline = commenter.subtitle.text;
                }
            }

            // Image
            if (commenter.image && commenter.image.attributes && commenter.image.attributes.length > 0) {
                const imgAttr = commenter.image.attributes[0];
                // Check detailed data
                if (imgAttr.detailData && imgAttr.detailData.nonEntityProfilePicture && imgAttr.detailData.nonEntityProfilePicture.vectorImage) {
                    const vector = imgAttr.detailData.nonEntityProfilePicture.vectorImage;
                    if (vector.rootUrl && vector.artifacts && vector.artifacts.length > 0) {
                        const artifact = vector.artifacts[vector.artifacts.length - 1];
                        authorImage = vector.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                    }
                }
            }

            // Profile URL
            if (commenter.navigationUrl) {
                profileUrl = commenter.navigationUrl;
            }
        }

        // Time
        if (item.createdTime && item.createdTime.text) {
            time = item.createdTime.text;
        } else if (item.createdAt) {
            // Convert timestamp to relative time or date
            // Use a simple formatter or just date
            const date = new Date(item.createdAt);
            // Format: "Oct 12, 2025"
            time = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        }

        return {
            urn: item.entityUrn || item.urn,
            text,
            authorName,
            authorImage,
            authorHeadline,
            time,
            profileUrl
        };
    } catch (e) {
        console.error("Error parsing single comment:", e);
        return null;
    }
}

function parsePost(item, urnMap, profileUrn) {
    let text = "";
    let media = [];
    let urn = item.entityUrn || item.urn || "";
    let socialDetailUrn = null; // Added
    let stats = {
        likes: 0,
        comments: 0,
        reposts: 0
    };

    // ... (rest of function body remains same until return)

    // 1. Extract Text
    if (item.commentary && item.commentary.text && item.commentary.text.text) {
        text = item.commentary.text.text;
    } else if (item.resharedUpdate && item.resharedUpdate.commentary && item.resharedUpdate.commentary.text && item.resharedUpdate.commentary.text.text) {
        text = item.resharedUpdate.commentary.text.text;
    }

    // 1b. Extract Date
    let date = "";
    if (item.actor && item.actor.subDescription && item.actor.subDescription.text) {
        date = item.actor.subDescription.text;
    } else if (item.resharedUpdate && item.resharedUpdate.actor && item.resharedUpdate.actor.subDescription && item.resharedUpdate.actor.subDescription.text) {
        date = item.resharedUpdate.actor.subDescription.text;
    }

    // 1c. Extract Creator Profile Info
    let creatorName = "";
    let creatorImage = "";

    const actor = item.actor || (item.resharedUpdate && item.resharedUpdate.actor);
    if (actor) {
        // Extract creator name
        if (actor.name && actor.name.text) {
            creatorName = actor.name.text;
        }

        // Extract creator profile image
        if (actor.image && actor.image.attributes && actor.image.attributes.length > 0) {
            const imageAttr = actor.image.attributes[0];
            if (imageAttr.detailData && imageAttr.detailData.nonEntityProfilePicture) {
                const vectorImage = imageAttr.detailData.nonEntityProfilePicture.vectorImage;
                if (vectorImage && vectorImage.rootUrl && vectorImage.artifacts && vectorImage.artifacts.length > 0) {
                    // Use the highest quality artifact (last one in the array)
                    const artifact = vectorImage.artifacts[vectorImage.artifacts.length - 1];
                    creatorImage = vectorImage.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                }
            }
        }
    }

    // 2. Extract Media
    if (item.content) {
        const extracted = extractMediaFromContent(item.content, urnMap);
        if (extracted) media.push(...extracted);
    }
    if (item.resharedUpdate && item.resharedUpdate.content) {
        const extracted = extractMediaFromContent(item.resharedUpdate.content, urnMap);
        if (extracted) media.push(...extracted);
    }

    // 3. Extract Interaction Stats
    // The Update object usually has a *socialDetail reference
    if (item['*socialDetail']) {
        socialDetailUrn = item['*socialDetail']; // Capture URN
        const socialDetail = urnMap.get(socialDetailUrn);

        if (socialDetail) {
            // console.log("Found socialDetail:", socialDetail);
            let counts = null;

            if (socialDetail.socialActivityCounts) {
                // If it's a reference string (URN)
                if (typeof socialDetail.socialActivityCounts === 'string') {
                    counts = urnMap.get(socialDetail.socialActivityCounts);
                } else {
                    counts = socialDetail.socialActivityCounts;
                }
            } else if (socialDetail['*socialActivityCounts']) {
                counts = urnMap.get(socialDetail['*socialActivityCounts']);
            }

            if (counts) {
                if (counts.numLikes) stats.likes = counts.numLikes;
                if (counts.numComments) stats.comments = counts.numComments;
                if (counts.numShares) stats.reposts = counts.numShares;
                // Impressions are often not available publicly, but we check just in case
                if (counts.numViews) stats.views = counts.numViews;
            } else {
                console.log("No counts found in socialDetail", socialDetail);
            }

            // Also check for totalSocialActivityCounts (or *totalSocialActivityCounts)
            let totalCounts = null;
            if (socialDetail.totalSocialActivityCounts) {
                totalCounts = socialDetail.totalSocialActivityCounts;
            } else if (socialDetail['*totalSocialActivityCounts']) {
                totalCounts = urnMap.get(socialDetail['*totalSocialActivityCounts']);
            }

            if (totalCounts) {
                if (totalCounts.numLikes > stats.likes) stats.likes = totalCounts.numLikes;
                if (totalCounts.numComments > stats.comments) stats.comments = totalCounts.numComments;
                if (totalCounts.numShares > stats.reposts) stats.reposts = totalCounts.numShares;
                if (totalCounts.numViews > stats.views) stats.views = totalCounts.numViews;
            } else if (socialDetail['*totalSocialActivityCounts']) {
                console.log("Total counts URN found but not in map:", socialDetail['*totalSocialActivityCounts']);
            }
        } else {
            console.log("SocialDetail URN not found in urnMap:", socialDetailUrn);
        }
    }

    let isRepost = false;
    let repostType = null; // 'self' or 'other'

    // Check if it is a repost
    if (item.resharedUpdate) {
        isRepost = true;

        // Determine if it's a self-repost
        const sharerUrn = item.actor?.urn;
        const originalAuthorUrn = item.resharedUpdate?.actor?.urn;

        // Fallback: Compare Names
        const sharerName = item.actor?.name?.text;
        const originalAuthorName = item.resharedUpdate?.actor?.name?.text;

        if (sharerUrn && originalAuthorUrn && sharerUrn === originalAuthorUrn) {
            repostType = 'self';
        } else if (sharerName && originalAuthorName && sharerName === originalAuthorName) {
            repostType = 'self';
        } else {
            repostType = 'other';
        }
    }
    // Also check header text for "reposted"
    if (item.header && item.header.text && item.header.text.text) {
        if (item.header.text.text.toLowerCase().includes('reposted')) {
            isRepost = true;
        }
    }

    // 4. Extract Share URL
    let postUrl = "";
    if (item.socialContent && item.socialContent.shareUrl) {
        postUrl = item.socialContent.shareUrl;
    } else if (item.updateMetadata && item.updateMetadata.shareUrl) {
        postUrl = item.updateMetadata.shareUrl;
    }

    // Fallback: Construct URL from URN if shareUrl is missing
    if (!postUrl && urn) {
        // Handle different URN formats
        // urn:li:fsd_update:(urn:li:activity:123,...) -> 123
        // urn:li:activity:123 -> 123
        // urn:li:ugcPost:123 -> 123

        let activityUrn = urn;
        // Check if it's a composite URN (fsd_update)
        if (urn.includes('(')) {
            const match = urn.match(/\(([^,]+)/);
            if (match && match[1]) {
                activityUrn = match[1];
            }
        }

        const parts = activityUrn.split(':');
        if (parts.length >= 4) {
            // e.g. urn:li:activity:123
            const type = parts[2];
            const id = parts[3];
            if (type === 'activity') {
                postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`;
            } else if (type === 'ugcPost') {
                postUrl = `https://www.linkedin.com/feed/update/urn:li:ugcPost:${id}/`;
            } else if (type === 'share') {
                postUrl = `https://www.linkedin.com/feed/update/urn:li:share:${id}/`;
            } else {
                postUrl = `https://www.linkedin.com/feed/update/${activityUrn}/`;
            }
        } else {
            postUrl = `https://www.linkedin.com/feed/update/${activityUrn}/`;
        }
    }

    if (!text && media.length === 0) return null;

    return { urn, text, media, stats, date, creatorName, creatorImage, socialDetailUrn, isRepost, repostType, postUrl, profileUrn };
}

function extractMediaFromContent(content, urnMap) {
    const mediaItems = [];

    const processComponent = (comp) => {
        if (!comp) return;

        // Image
        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.component.image.ImageComponent' && comp.images) {
            comp.images.forEach(img => {
                if (img.attributes) {
                    img.attributes.forEach(attr => {
                        if (attr.detailData && attr.detailData.vectorImage) {
                            const vector = attr.detailData.vectorImage;
                            if (vector.rootUrl && vector.artifacts && vector.artifacts.length > 0) {
                                // Sort by width to get the highest quality
                                const sortedArtifacts = [...vector.artifacts].sort((a, b) => b.width - a.width);
                                const artifact = sortedArtifacts[0];
                                const url = vector.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                                mediaItems.push({ type: 'image', url: url });
                            }
                        }
                    });
                }
            });
        }

        // Video (Direct)
        if (comp['$type'] === 'com.linkedin.videocontent.VideoPlayMetadata') {
            if (comp.progressiveStreams && comp.progressiveStreams.length > 0) {
                // Sort by resolution (height) or bitrate to get best quality
                const sortedStreams = [...comp.progressiveStreams].sort((a, b) => {
                    return (b.height || 0) - (a.height || 0) || (b.bitRate || 0) - (a.bitRate || 0);
                });
                const stream = sortedStreams[0];
                if (stream.streamingLocations && stream.streamingLocations.length > 0) {
                    mediaItems.push({ type: 'video', url: stream.streamingLocations[0].url });
                }
            }
        }

        // Video (Referenced)
        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.component.linkedinvideo.LinkedInVideoComponent' && comp['*videoPlayMetadata']) {
            const videoUrn = comp['*videoPlayMetadata'];
            const videoData = urnMap.get(videoUrn);
            if (videoData) {
                if (videoData.progressiveStreams && videoData.progressiveStreams.length > 0) {
                    // Sort by resolution (height) or bitrate
                    const sortedStreams = [...videoData.progressiveStreams].sort((a, b) => {
                        return (b.height || 0) - (a.height || 0) || (b.bitRate || 0) - (a.bitRate || 0);
                    });
                    const stream = sortedStreams[0];
                    if (stream.streamingLocations && stream.streamingLocations.length > 0) {
                        mediaItems.push({ type: 'video', url: stream.streamingLocations[0].url });
                    }
                }
            }
        }

        // Document (Carousel)
        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.component.document.DocumentComponent' && comp.document) {
            const carouselImages = [];
            if (comp.document.coverPages && comp.document.coverPages.pagesPerResolution) {
                const resolutions = comp.document.coverPages.pagesPerResolution;
                if (resolutions.length > 0) {
                    const bestRes = resolutions[resolutions.length - 1];
                    if (bestRes.imageUrls && bestRes.imageUrls.length > 0) {
                        carouselImages.push(...bestRes.imageUrls);
                    }
                }
            }

            if (carouselImages.length > 0) {
                console.log("Extracted DocumentComponent:", comp.document); // DEBUG LOG
                mediaItems.push({
                    type: 'carousel',
                    images: carouselImages,
                    // Prioritize the PDF download link
                    url: comp.document.transcribedDocumentUrl || comp.document.manifestUrl || null,
                    manifestUrl: comp.document.manifestUrl || null,
                    transcribedDocumentUrl: comp.document.transcribedDocumentUrl || null,
                    title: comp.document.title || 'Carousel'
                });
            }
        }

        // Carousel (Legacy)
        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.carousel.CarouselContent' && comp.items) {
            const legacyCarouselImages = [];
            comp.items.forEach(carouselItem => {
                if (carouselItem.content) {
                    if (carouselItem.content.imageComponent) {
                        const imgComp = carouselItem.content.imageComponent;
                        if (imgComp.images && imgComp.images.length > 0 && imgComp.images[0].attributes) {
                            const attr = imgComp.images[0].attributes[0];
                            if (attr && attr.detailData && attr.detailData.vectorImage) {
                                const v = attr.detailData.vectorImage;
                                if (v.rootUrl && v.artifacts) {
                                    // Sort by width to get highest quality
                                    const sortedArtifacts = [...v.artifacts].sort((a, b) => b.width - a.width);
                                    const art = sortedArtifacts[0];
                                    legacyCarouselImages.push(v.rootUrl + art.fileIdentifyingUrlPathSegment);
                                }
                            }
                        }
                    }
                }
            });
            if (legacyCarouselImages.length > 0) {
                mediaItems.push({ type: 'carousel', images: legacyCarouselImages });
            }
        }
    };

    if (content.imageComponent) processComponent(content.imageComponent);
    if (content.videoComponent) processComponent(content.videoComponent);
    if (content.linkedInVideoComponent) processComponent(content.linkedInVideoComponent);
    if (content.carouselContent) processComponent(content.carouselContent);
    if (content.documentComponent) processComponent(content.documentComponent);
    processComponent(content);

    return mediaItems;
}

function findElementsArray(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj['*elements'])) return obj['*elements'];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'object') {
            const result = findElementsArray(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

function saveLog(logEntry, skipDB = false, tabId = null) {
    // Save to IndexedDB (Async, fire and forget)
    // For Normal Profiles, we SKIP this step.
    if (!skipDB && logEntry.extractedPosts && logEntry.extractedPosts.length > 0) {
        savePostsToDB(logEntry.extractedPosts).then(count => {
            console.log(`Saved/Updated ${count} new posts to IndexedDB.`);
            if (isUpdatingProfiles && count > 0) {
                chrome.runtime.sendMessage({
                    action: 'profile_update_progress',
                    message: `  - Found ${count} NEW post(s).`
                }).catch(() => { });
            }
        });
    } else if (skipDB) {
        console.log(`[saveLog] Skipping IndexedDB save. Posts: ${logEntry.extractedPosts?.length}`);
    }

    // Use per-tab storage key
    const storageKey = tabId ? `logs_${tabId}` : 'logs';

    chrome.storage.local.get({ [storageKey]: [] }, (result) => {
        let logs = result[storageKey] || [];

        // Clean up old logs that might have the huge 'body' field
        logs = logs.map(log => {
            // eslint-disable-next-line no-unused-vars
            const { body, ...rest } = log;
            return rest;
        });

        logs.unshift(logEntry);

        const MAX_LOGS = 1000;
        if (logs.length > MAX_LOGS) {
            logs.length = MAX_LOGS;
        }

        // Recursive save with quota handling
        const trySave = (logsToSave) => {
            chrome.storage.local.set({ [storageKey]: logsToSave }, () => {
                if (chrome.runtime.lastError) {
                    const err = chrome.runtime.lastError.message;
                    console.error("Storage error:", err);

                    if (err.includes("quota") || err.includes("exceeded")) {
                        console.warn(`Quota exceeded with ${logsToSave.length} logs. Trimming old logs...`);

                        if (logsToSave.length > 1) {
                            const newLength = Math.max(1, Math.floor(logsToSave.length * 0.9));
                            const trimmedLogs = logsToSave.slice(0, newLength);
                            trySave(trimmedLogs);
                        } else {
                            if (JSON.stringify(logsToSave) !== JSON.stringify([logEntry])) {
                                chrome.storage.local.set({ [storageKey]: [logEntry] });
                            }
                        }
                    }
                }
            });
        };

        trySave(logs);
    });
}

// Handle detach
chrome.debugger.onDetach.addListener((source, reason) => {
    attachedTabs.delete(source.tabId);
    console.log(`Debugger detached from tab ${source.tabId}: ${reason}`);
});

// DB Check on Startup
setTimeout(() => {
    openDB().then(db => {
        try {
            const tx = db.transaction(POSTS_STORE, 'readonly');
            const store = tx.objectStore(POSTS_STORE);
            const countReq = store.count();

            countReq.onsuccess = () => {
                console.log(`[STARTUP CHECK] Database '${DB_NAME}' opened. Contains ${countReq.result} total posts.`);

                // Deep dive into URN distribution (Async, so we don't block)
                const metaTx = db.transaction(POSTS_STORE, 'readonly');
                const metaStore = metaTx.objectStore(POSTS_STORE);
                const cursorReq = metaStore.openCursor();
                const urnCounts = {};
                let missingProfileUrn = 0;

                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const pUrn = cursor.value.profileUrn;
                        if (pUrn) {
                            urnCounts[pUrn] = (urnCounts[pUrn] || 0) + 1;
                        } else {
                            missingProfileUrn++;
                        }
                        cursor.continue();
                    } else {
                        console.log(`[STARTUP CHECK] URN Distribution:`, urnCounts);
                        console.log(`[STARTUP CHECK] Posts with NO Profile URN: ${missingProfileUrn}`);
                    }
                };
            };
        } catch (e) { console.error("DB Check Failed:", e); }
    }).catch(e => console.error("DB Check Failed:", e));
}, 2000);



// --- Profile Update Logic ---

let updateQueue = [];
let updateTabId = null;
let updateTabTimeout = null;
let totalProfilesInRun = 0;

function broadcastWatchlistProgress(data) {
    chrome.runtime.sendMessage(data).catch(() => { });
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, data).catch(() => { });
        });
    });
}

function startProfileUpdates(urls) {
    if (isUpdatingProfiles) {
        console.log("[UpdateAll] Already updating profiles.");
        return;
    }
    if (!urls || urls.length === 0) return;

    console.log("[UpdateAll] Starting profile update for:", urls);
    isUpdatingProfiles = true;
    updateQueue = [...urls];
    totalProfilesInRun = urls.length;

    broadcastWatchlistProgress({
        action: 'profile_update_progress',
        message: `Starting update for ${urls.length} profile(s)...`,
        total: totalProfilesInRun,
        processed: 0
    });

    processNextProfile();
}

function stopProfileUpdates() {
    isUpdatingProfiles = false;
    updateQueue = [];
    totalProfilesInRun = 0;
    if (updateTabTimeout) {
        clearTimeout(updateTabTimeout);
        updateTabTimeout = null;
    }
    if (updateTabId) {
        chrome.tabs.remove(updateTabId).catch(() => { });
        updateTabId = null;
    }
}

function processNextProfile() {
    if (!isUpdatingProfiles) return;

    if (updateQueue.length === 0) {
        console.log("[UpdateAll] All profiles updated.");
        isUpdatingProfiles = false;
        totalProfilesInRun = 0;
        broadcastWatchlistProgress({
            action: 'profile_update_complete',
            total: totalProfilesInRun,
            processed: totalProfilesInRun
        });
        return;
    }

    const profileUrl = updateQueue.shift();
    const processed = totalProfilesInRun - updateQueue.length;
    const total = totalProfilesInRun;

    // Extract vanity name for display
    const vanityMatch = profileUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    const vanityName = vanityMatch ? vanityMatch[1] : profileUrl;

    console.log(`[UpdateAll] Processing profile ${processed}/${total}: ${profileUrl}`);

    // Notify watchlist page — X/Y format drives the progress bar
    broadcastWatchlistProgress({
        action: 'profile_update_progress',
        message: `Processing ${processed}/${total}: ${vanityName}`,
        total: total,
        processed: processed - 1
    });

    // Open the profile in a background tab (not focused)
    chrome.tabs.create({ url: profileUrl, active: false }, (tab) => {
        updateTabId = tab.id;
        console.log(`[UpdateAll] Opened background tab ${tab.id} for ${vanityName}`);

        broadcastWatchlistProgress({
            action: 'profile_update_progress',
            message: `  ⏳ Loading ${vanityName}...`,
            total: total,
            processed: processed - 1
        });

        // Safety timeout — if fetching hasn't completed in 90 s, skip and move on
        updateTabTimeout = setTimeout(() => {
            console.warn(`[UpdateAll] 90s timeout reached for ${vanityName}. Moving to next.`);
            broadcastWatchlistProgress({
                action: 'profile_update_progress',
                message: `  ⚠️ Timeout for ${vanityName}. Skipping.`,
                total: total,
                processed: processed - 1
            });
            stopCurrentProfileFetch();
        }, 90000);
    });
}

function stopCurrentProfileFetch() {
    console.log("[UpdateAll] Fetch complete for current profile. Closing tab...");

    // Cancel safety timeout
    if (updateTabTimeout) {
        clearTimeout(updateTabTimeout);
        updateTabTimeout = null;
    }

    // Stop the in-memory fetch loop for this tab
    if (updateTabId) {
        const session = getSession(updateTabId);
        if (session) session.isFetching = false;
    }

    const processed = totalProfilesInRun - updateQueue.length;
    broadcastWatchlistProgress({
        action: 'profile_update_progress',
        message: `  ✅ Done. Moving to next profile...`,
        total: totalProfilesInRun,
        processed: processed
    });

    // Close the tab
    const tabToClose = updateTabId;
    updateTabId = null;
    if (tabToClose) {
        chrome.tabs.remove(tabToClose).catch(() => { });
    }

    // Short pause before opening the next tab
    setTimeout(() => {
        processNextProfile();
    }, 2000);
}




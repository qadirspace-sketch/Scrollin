// src/background.js
import {
    openDB,
    savePostsToDB,
    saveProfileToDB,
    getProfile,
    getAllProfiles,
    getWatchlistProfiles,
    checkPostExists,
    migrateProfileUrn,
    getPostsByProfile,
    getLatestPostTimestamp,
    getLatestPostForProfile,
    checkMultiplePostsExist,
    clearAllPosts,
    deleteProfileData
} from './db.js';

// Base API URL for local server
const BACKEND_API = "http://localhost:5001";

function fetchWithAuth(url, options = {}, retries = 3, backoff = 1000) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['auth_token'], (result) => {
            const headers = options.headers || {};
            const newHeaders = { ...headers };
            
            if (result.auth_token) {
                newHeaders['Authorization'] = `Bearer ${result.auth_token}`;
            }
            if (!newHeaders['Content-Type'] && options.body && !(options.body instanceof FormData)) {
                newHeaders['Content-Type'] = 'application/json';
            }
            
            const executeFetch = (attempt) => {
                fetch(url, {
                    ...options,
                    headers: newHeaders
                })
                .then(async response => {
                    if (response.status === 401) {
                        console.warn("[Background] Request returned 401. Clearing token and locking extension.");
                        chrome.storage.local.remove('auth_token');
                        chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
                            tabs.forEach(tab => {
                                chrome.tabs.sendMessage(tab.id, { action: "auth_state_changed", isAuthenticated: false }).catch(() => {});
                            });
                        });
                        resolve(response);
                        return;
                    }
                    
                    // Retry on 5xx Server Errors
                    if (response.status >= 500 && attempt < retries) {
                        const delay = backoff * Math.pow(2, attempt);
                        console.warn(`[Background] Server error ${response.status} fetching ${url}. Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
                        setTimeout(() => executeFetch(attempt + 1), delay);
                    } else {
                        resolve(response);
                    }
                })
                .catch(err => {
                    // Retry on network errors
                    if (attempt < retries) {
                        const delay = backoff * Math.pow(2, attempt);
                        console.warn(`[Background] Network error fetching ${url}: ${err.message}. Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
                        setTimeout(() => executeFetch(attempt + 1), delay);
                    } else {
                        reject(err);
                    }
                });
            };
            
            executeFetch(0);
        });
    });
}

// Dynamically loaded scraping configuration (fetched on startup / rule refresh)
let scrapingRules = {
    targetUrlPattern: "/voyager/api/graphql",
    feedKey: "voyagerFeedDashProfile",
    commentsKey: "voyagerSocialDashComments",
    profileKey: "voyagerIdentityDashProfiles",
    profileComponentKey: "voyagerIdentityDashProfileComponents"
};

// Fetch rules from server
async function refreshScrapingRules() {
    try {
        const response = await fetchWithAuth(`${BACKEND_API}/v1/config`);
        const data = await response.json();
        if (data && data.success && data.rules) {
            scrapingRules = data.rules;
            console.log("[Config] Loaded dynamic rules from server:", scrapingRules);
        }
    } catch (e) {
        console.warn("[Config] Failed to fetch rules, using defaults:", e.message);
    }
}

// Keep track of attached tabs
const attachedTabs = new Set();

// Check if intercepting a target URL using server rules
function isTargetUrl(url) {
    if (!scrapingRules) return false;
    return url.includes(scrapingRules.targetUrlPattern) &&
        (url.includes("profileUrn") || url.includes(scrapingRules.feedKey) || url.includes("voyagerFeedDashProfile") || url.includes(scrapingRules.commentsKey));
}

// Tab Sessions
let tabSessions = {};

function getSession(tabId) {
    if (!tabSessions[tabId]) {
        tabSessions[tabId] = {
            tabId: tabId,
            profileUrn: null,
            vanityName: null,
            captureVanity: null,
            queryId: null,
            commentQueryId: null,
            headers: {},
            start: 0,
            isWatchlistScan: false,
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
    const oldHeaders = session.headers;
    const oldQueryId = session.queryId;
    const oldCommentQueryId = session.commentQueryId;

    session.profileUrn = null;
    session.vanityName = null;
    session.captureVanity = null;
    session.queryId = oldQueryId || (lastKnownSession ? lastKnownSession.queryId : null);
    session.commentQueryId = oldCommentQueryId;
    session.headers = (oldHeaders && Object.keys(oldHeaders).length > 0) ? oldHeaders : (lastKnownSession ? lastKnownSession.headers : {});
    session.start = 0;
    session.isWatchlistScan = false;
    session.isFetching = false;
    session.currentStart = 0;
    session.currentPaginationToken = null;
    session.consecutiveEmptyResponses = 0;
    chrome.storage.local.remove(`logs_${tabId}`);
    return session;
}

function deleteSession(tabId) {
    delete tabSessions[tabId];
    chrome.storage.local.remove(`logs_${tabId}`);
}

let isUpdatingProfiles = false;
let stopUpdateSignal = false;
let vanityToUrn = {};
let lastKnownSession = null;

// Initialization
(async () => {
    try {
        await openDB();
        await refreshScrapingRules(); // Pull target rules dynamically
        const stored = await chrome.storage.local.get(['vanityToUrn', 'lastKnownSession']);
        if (stored.vanityToUrn) vanityToUrn = stored.vanityToUrn;
        if (stored.lastKnownSession) {
            lastKnownSession = stored.lastKnownSession;
        } else {
            lastKnownSession = {
                queryId: "voyagerFeedDashProfileUpdates.4af00b28d60ed0f1488018948daad822",
                headers: {}
            };
        }
        console.log("Startup complete. State restored. lastKnownSession:", lastKnownSession);
    } catch (e) {
        console.error("Startup error:", e);
    }
})();

// Listeners
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url && tab.url.includes("www.linkedin.com")) {
        if (changeInfo.status === 'loading') {
            const session = tabSessions[tabId];
            if (session) {
                session.isFetching = false;
                session.currentStart = 0;
                session.currentPaginationToken = null;
                session.consecutiveEmptyResponses = 0;
                session.nextUrl = null;
                session.captureVanity = null; // Full reload: allow capture to start again
            }
            if (!attachedTabs.has(tabId)) {
                attachDebugger(tabId);
            }
        } else if (changeInfo.status === 'complete') {
            if (!attachedTabs.has(tabId)) {
                attachDebugger(tabId);
            }
            scheduleProfileBootstrap(tabId, tab.url);
        }

        // SPA navigation between pages (history.pushState) only reports a URL change
        if (changeInfo.url && changeInfo.status !== 'loading') {
            scheduleProfileBootstrap(tabId, changeInfo.url);
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    attachedTabs.delete(tabId);
    deleteSession(tabId);
});

function attachDebugger(tabId) {
    chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
            console.log(`Failed to attach: ${chrome.runtime.lastError.message}`);
            return;
        }
        attachedTabs.add(tabId);
        chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
            if (chrome.runtime.lastError) {
                console.error("Network.enable failed:", chrome.runtime.lastError.message);
            }
            if (isUpdatingProfiles && updateTabId === tabId) {
                chrome.tabs.reload(tabId);
            }
        });
    });
}

const DEFAULT_FEED_QUERY_ID = "voyagerFeedDashProfileUpdates.4af00b28d60ed0f1488018948daad822";

// Start collecting posts for a profile. Shared by the network-interception trigger
// and the profile-visit bootstrap; whichever calls first wins for this visit.
function startProfileCapture(tabId, vanity, profileUrn) {
    const session = getSession(tabId);
    if (session.captureVanity === vanity && session.profileUrn === profileUrn) return;
    session.captureVanity = vanity;
    session.vanityName = vanity; // Avoid url_changed race condition
    vanityToUrn[vanity] = profileUrn;
    chrome.storage.local.set({ vanityToUrn });

    getProfile(vanity).then(async profile => {
        const isUpdateTab = isUpdatingProfiles && updateTabId === tabId;
        const existingPosts = await getPostsByProfile(profileUrn);
        const hasPostsInDB = existingPosts.length > 0;

        const isWatchlistProfile = isUpdateTab || (profile && profile.inWatchlist) || hasPostsInDB;

        if (isWatchlistProfile) {
            session.isWatchlistScan = true;
            if (hasPostsInDB) {
                if (profile && !profile.inWatchlist) {
                    profile.inWatchlist = true;
                    profile.profileUrn = profileUrn;
                    saveProfileToDB(profile);
                } else if (!profile) {
                    saveProfileToDB({
                        creatorId: vanity,
                        profileUrn: profileUrn,
                        inWatchlist: true,
                        lastUpdated: Date.now()
                    });
                }
            }

            if (profile && profile.profileUrn !== profileUrn) {
                profile.profileUrn = profileUrn;
                saveProfileToDB(profile);
            }

            if (!isUpdateTab && hasPostsInDB) {
                chrome.storage.local.set({
                    [`logs_${tabId}`]: [{
                        url: "db-preload",
                        timestamp: Date.now(),
                        extractedPosts: existingPosts
                    }]
                });
            }

            if (!session.isFetching) {
                setTimeout(() => {
                    if (!session.isFetching && session.profileUrn && session.queryId) {
                        runWatchlistSync(tabId);
                    }
                }, 1500);
            }
        } else {
            session.isWatchlistScan = false;
            if (!session.isFetching) {
                setTimeout(() => {
                    if (!session.isFetching && session.profileUrn && session.queryId) {
                        session.isFetching = true;
                        // Fallback to start=0 if native request was cached and no pagination token is present
                        session.currentStart = session.currentPaginationToken ? ((session.start || 0) + 100) : 0;
                        session.consecutiveEmptyResponses = 0;
                        fetchNextBatch(tabId);
                    }
                }, 800);
            }
        }
    });
}

// LinkedIn's new UI renders profile activity server-side and never sends the feed
// GraphQL request the debugger listener waits for, so start capture ourselves.
async function bootstrapProfileSession(tabId, vanity) {
    const session = getSession(tabId);
    if (session.captureVanity === vanity) return; // Interception already started capture

    let profileUrn = vanityToUrn[vanity];
    let csrfToken = null;
    try {
        if (!profileUrn) {
            const profile = await getProfile(vanity);
            if (profile && profile.profileUrn) profileUrn = profile.profileUrn;
        }
        const resolved = await chrome.tabs.sendMessage(tabId, { action: "resolve_profile", vanity });
        if (resolved && resolved.csrfToken) csrfToken = resolved.csrfToken;
        if (resolved && resolved.profileUrn) {
            profileUrn = resolved.profileUrn;
        } else if (!profileUrn) {
            console.error(`[Capture] Could not resolve profile URN for '${vanity}': ${resolved?.error || 'no response'}`);
            return;
        }
    } catch (e) {
        if (!profileUrn) {
            console.error(`[Capture] Could not resolve profile URN for '${vanity}': ${e.message}`);
            return;
        }
    }

    // Tab may have navigated away, or interception may have won, while we were resolving
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || extractCreatorId(tab.url) !== vanity || session.captureVanity === vanity) return;

    if (session.profileUrn && session.profileUrn !== profileUrn) {
        resetSession(tabId);
        chrome.tabs.sendMessage(tabId, { action: "reset_ui" }).catch(() => { });
    }

    session.profileUrn = profileUrn;
    if (!session.queryId) {
        session.queryId = (lastKnownSession && lastKnownSession.queryId) || DEFAULT_FEED_QUERY_ID;
    }
    if (csrfToken) {
        session.headers = {
            ...(session.headers || {}),
            'csrf-token': csrfToken,
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'x-restli-protocol-version': '2.0.0'
        };
    }

    console.log(`[Capture] Bootstrapped session for '${vanity}' (${profileUrn}) without intercepted request.`);
    startProfileCapture(tabId, vanity, profileUrn);
    chrome.tabs.sendMessage(tabId, { action: "session_captured" }).catch(() => { });
}

const bootstrapTimers = new Map(); // tabId -> timeout id

function scheduleProfileBootstrap(tabId, url) {
    const vanity = extractCreatorId(url);
    if (!vanity) return;
    clearTimeout(bootstrapTimers.get(tabId));
    // Short delay so the interception path wins when LinkedIn does send the feed request
    bootstrapTimers.set(tabId, setTimeout(() => {
        bootstrapTimers.delete(tabId);
        bootstrapProfileSession(tabId, vanity);
    }, 2500));
}

const pendingRequests = new Map();

chrome.debugger.onEvent.addListener(async (source, method, params) => {
    const tabId = source.tabId;

    if (method === "Network.requestWillBeSent") {
        const url = params.request.url;
        const requestHeaders = params.request.headers || {};
        const isInternal = Object.keys(requestHeaders).some(k =>
            k.toLowerCase() === 'x-source' && (requestHeaders[k] === 'Interceptor' || requestHeaders[k] === 'WatchlistSync')
        );

        if (url.includes("/voyager/api/graphql")) {
            console.log(`[Debugger] Intercepted GraphQL request: ${url.substring(0, 120)}... | isTargetUrl: ${isTargetUrl(url)} | isInternal: ${isInternal}`);
        }

        if (isTargetUrl(url) && !isInternal) {
            console.log(`[Debugger] Target request matched: ${url.substring(0, 120)}...`);
            pendingRequests.set(params.requestId, {
                url: url,
                timestamp: Date.now()
            });

            try {
                const urlObj = new URL(url);
                const variables = urlObj.searchParams.get("variables");
                const queryId = urlObj.searchParams.get("queryId");

                if (variables && queryId) {
                    if (url.includes(scrapingRules.commentsKey)) {
                        const session = getSession(tabId);
                        session.commentQueryId = queryId;
                    }

                    const decodedVariables = decodeURIComponent(variables);
                    const profileUrnMatch = decodedVariables.match(/profileUrn:([^,)]+)/);
                    const startMatch = decodedVariables.match(/start:(\d+)/);

                    if (profileUrnMatch) {
                        const newProfileUrn = profileUrnMatch[1];
                        const session = getSession(tabId);

                        // Only the profile feed query identifies the profile being viewed. LinkedIn's new UI
                        // also sends queries carrying the logged-in user's own profileUrn (nav, messaging),
                        // which used to hijack the session; bootstrapProfileSession covers everything else.
                        const isFeedQuery = queryId.includes("voyagerFeedDashProfile") || queryId.includes(scrapingRules.feedKey);
                        if (!isFeedQuery) {
                            return;
                        }

                        if (session.profileUrn && session.profileUrn !== newProfileUrn) {
                            resetSession(tabId);
                            chrome.tabs.sendMessage(tabId, { action: "reset_ui" }).catch(() => { });
                        }

                        session.profileUrn = newProfileUrn;
                        
                        // Protect session.queryId: only update it if it's a profile feed query
                        if (queryId && (queryId.includes("voyagerFeedDashProfile") || queryId.includes(scrapingRules.feedKey))) {
                            session.queryId = queryId;
                            lastKnownSession = { queryId, headers: params.request.headers };
                            chrome.storage.local.set({ lastKnownSession });
                        } else {
                            if (!session.queryId) {
                                session.queryId = lastKnownSession ? lastKnownSession.queryId : "voyagerFeedDashProfileUpdates.4af00b28d60ed0f1488018948daad822";
                            }
                            lastKnownSession = { queryId: session.queryId, headers: params.request.headers };
                            chrome.storage.local.set({ lastKnownSession });
                        }
                        session.headers = params.request.headers;

                        if (startMatch) {
                            session.start = parseInt(startMatch[1], 10);
                        }

                        chrome.tabs.get(tabId, (tab) => {
                            if (chrome.runtime.lastError) return;
                            const vanity = extractCreatorId(tab && tab.url);
                            if (vanity) {
                                startProfileCapture(tabId, vanity, newProfileUrn);
                            }
                        });

                        chrome.tabs.sendMessage(tabId, { action: "session_captured" }).catch(() => { });
                    }
                }
            } catch (e) {
                console.error("Error parsing variables:", e);
            }
        }
    } else if (method === "Network.loadingFinished") {
        const requestId = params.requestId;
        if (pendingRequests.has(requestId)) {
            const requestData = pendingRequests.get(requestId);
            console.log(`[Debugger] Network.loadingFinished for: ${requestData.url.substring(0, 120)}...`);

            chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId }, async (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[Debugger] Failed to get response body:", chrome.runtime.lastError.message);
                    pendingRequests.delete(requestId);
                    return;
                }

                let finalBody = response.body;
                if (response.base64Encoded) {
                    try {
                        finalBody = atob(response.body);
                    } catch (e) {
                        console.error("[Debugger] Failed to decode base64 body:", e);
                    }
                }

                try {
                    if (requestData.url.includes(scrapingRules.commentsKey)) {
                        console.log("[Debugger] Sending comments raw payload to backend...");
                        // Send to backend for parsing comments
                         const parseCommentsResponse = await fetchWithAuth(`${BACKEND_API}/v1/parse-comments`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ rawData: finalBody, requestUrl: requestData.url })
                        });
                        const parsedComments = await parseCommentsResponse.json();

                        if (parsedComments && parsedComments.success) {
                            console.log(`[Debugger] Parsed ${parsedComments.comments?.length} comments.`);
                            chrome.tabs.sendMessage(tabId, {
                                action: "comments_fetched",
                                comments: parsedComments.comments,
                                paginationToken: parsedComments.paginationToken,
                                socialDetailUrn: parsedComments.socialDetailUrn
                            }).catch(() => { });
                        }
                    } else if (requestData.url.includes(scrapingRules.feedKey) || requestData.url.includes("voyagerFeedDashProfile")) {
                        const session = getSession(tabId);
                        console.log(`[Debugger] Sending raw feed body to backend for parsing. Profile URN: ${session.profileUrn}`);
                        // Send raw body to backend for parsing posts
                         const parsePostsResponse = await fetchWithAuth(`${BACKEND_API}/v1/parse-posts`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                                rawData: finalBody, 
                                profileUrn: session.profileUrn,
                                queryId: session.queryId,
                                start: session.start || 0
                            })
                        });
                        const parsedPosts = await parsePostsResponse.json();

                        if (parsedPosts && parsedPosts.success) {
                            console.log(`[Debugger] Parsed ${parsedPosts.posts?.length} posts successfully.`);
                            if (parsedPosts.nextToken) {
                                session.currentPaginationToken = parsedPosts.nextToken;
                                session.nextUrl = parsedPosts.nextUrl; // Save next URL from server
                            }
                            saveLog({
                                url: requestData.url,
                                timestamp: requestData.timestamp,
                                extractedPosts: parsedPosts.posts
                            }, !session.isWatchlistScan, tabId);
                        } else {
                            console.warn("[Debugger] Server failed to parse posts:", parsedPosts.error);
                        }
                    }
                } catch (fetchErr) {
                    console.error("[Debugger] Fetch parsing call failed:", fetchErr);
                }
                pendingRequests.delete(requestId);
            });
        }
    }
});

// Messages Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const senderTabId = sender?.tab?.id;

    if (request.action === "get_tab_id") {
        sendResponse({ tabId: senderTabId });
        return;
    }

    if (request.action === "force_sync") {
        const session = senderTabId ? getSession(senderTabId) : null;
        if (session && session.profileUrn && session.queryId && Object.keys(session.headers || {}).length > 0) {
            console.log(`[Background] Force Sync: Session details present. Starting sync for tab ${senderTabId}...`);
            session.isFetching = true;
            session.consecutiveEmptyResponses = 0;
            session.currentStart = 0;
            session.currentPaginationToken = null;
            chrome.tabs.sendMessage(senderTabId, { action: "reset_ui" }).catch(() => { });
            
            chrome.storage.local.remove(`logs_${senderTabId}`, () => {
                if (session.isWatchlistScan) {
                    runWatchlistSync(senderTabId);
                } else {
                    fetchNextBatch(senderTabId);
                }
            });
            sendResponse({ success: true, reloaded: false });
        } else {
            console.log(`[Background] Force Sync: Session details missing. Reloading tab ${senderTabId} to capture headers...`);
            chrome.tabs.reload(senderTabId);
            sendResponse({ success: true, reloaded: true });
        }
        return true;
    }
    
    if (request.action === "set_clerk_token") {
        chrome.storage.local.set({ clerkToken: request.token });
        return;
    }

    if (request.action === "check_auth") {
        chrome.storage.local.get(['auth_token', 'auth_user'], (result) => {
            sendResponse({ 
                isAuthenticated: !!result.auth_token, 
                user: result.auth_user || null 
            });
        });
        return true;
    }

    if (request.action === "fetch_auth_user") {
        fetchWithAuth(`${BACKEND_API}/v1/auth-check`, {
            method: 'GET'
        })
        .then(async res => {
            const data = await res.json().catch(err => {
                console.warn("[Background] auth-check returned non-JSON response:", err);
                return null;
            });
            if (data && data.success && data.user) {
                chrome.storage.local.set({ auth_user: data.user });
                sendResponse({ success: true, user: data.user });
            } else {
                sendResponse({ success: false });
            }
        })
        .catch(err => {
            console.error("[Background] fetch_auth_user failed:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    if (request.action === "logout") {
        chrome.storage.local.remove(['auth_token', 'auth_user'], () => {
            console.log("[Background] Auth token and user removed. User logged out.");
            // Notify all LinkedIn tabs to show the lock screen
            chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: "auth_state_changed", isAuthenticated: false }).catch(() => {});
                });
            });
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === "url_changed") {
        const vanity = request.vanityName;
        const url = request.url;
        console.log(`[Background] URL changed in tab ${senderTabId} to ${url}. Vanity: ${vanity}`);

        const session = getSession(senderTabId);
        // Only reset session and clear logs if the vanity has actually changed.
        // This prevents deleting the logs during minor URL redirections or sub-page visits (like recent-activity) on the same profile.
        if (session.vanityName !== vanity) {
            console.log(`[Background] Vanity changed from ${session.vanityName} to ${vanity}. Resetting session logs.`);
            
            const matchedUrn = session.profileUrn;
            const isAlreadyMatched = matchedUrn && (matchedUrn === vanityToUrn[vanity]);
            
            resetSession(senderTabId);
            session.vanityName = vanity;
            
            if (isAlreadyMatched) {
                session.profileUrn = matchedUrn;
            } else if (vanityToUrn[vanity]) {
                session.profileUrn = vanityToUrn[vanity];
            }
        }

        if (vanity && vanity !== 'global') {
            getProfile(vanity).then(async profile => {
                let targetUrn = profile ? profile.profileUrn : vanityToUrn[vanity];
                if (targetUrn) {
                    session.profileUrn = targetUrn;
                    const posts = await getPostsByProfile(targetUrn);
                    
                    chrome.storage.local.set({
                        [`logs_${senderTabId}`]: [{
                            url: "db-preload",
                            timestamp: Date.now(),
                            extractedPosts: posts
                        }]
                    });
                    sendResponse({ success: true, posts: posts });
                } else {
                    sendResponse({ success: false, error: 'No profile URN found for this vanity yet' });
                }
            });
            return true; // Keep message channel open
        } else {
            sendResponse({ success: false, error: 'Not a profile page' });
            return;
        }
    }

    if (request.action === "fetch_ai_tags") {
        // Proxy to backend instead of direct call
         fetchWithAuth(`${BACKEND_API}/v1/tag-posts-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: "single", text: request.text }] })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.results && data.results.single) {
                    sendResponse({ success: true, data: data.results.single });
                } else {
                    sendResponse({ success: false, error: "AI Tagging failed" });
                }
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "fetch_ai_tags_batch") {
        // Proxy batch requests to backend
         fetchWithAuth(`${BACKEND_API}/v1/tag-posts-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: request.items })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    sendResponse({ success: true, results: data.results });
                } else {
                    sendResponse({ success: false, error: "AI Batch Tagging failed" });
                }
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "start_fetching") {
        const session = senderTabId ? getSession(senderTabId) : null;
        if (!session || !session.profileUrn || !session.queryId) return;

        session.isFetching = true;
        session.consecutiveEmptyResponses = 0;
        session.currentStart = (session.start || 0) + 100;
        fetchNextBatch(senderTabId);
    } else if (request.action === "fetch_response") {
        const msgTabId = senderTabId || request.tabId;
        const session = msgTabId ? getSession(msgTabId) : null;
        if (!session || !session.isFetching) return;

        if (!request.error) {
            const { data } = request;
            
            // Ask server to parse posts and extract pagination token
             fetchWithAuth(`${BACKEND_API}/v1/parse-posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    rawData: data, 
                    profileUrn: session.profileUrn,
                    queryId: session.queryId,
                    start: session.currentStart
                })
             })
                 .then(res => res.json())
                 .then(parsedRes => {
                     if (parsedRes.success) {
                         const token = parsedRes.nextToken;
                         const nextUrl = parsedRes.nextUrl;
                         const rawIncludedCount = (data?.included?.length) || 0;
                         const shouldStop = !token || token === session.currentPaginationToken || rawIncludedCount === 0;

                         if (shouldStop) {
                             session.isFetching = false;
                             session.consecutiveEmptyResponses = 0;
                             if (!session.isWatchlistScan) {
                                 chrome.tabs.sendMessage(msgTabId, { action: "fetching_complete" }).catch(() => { });
                             }
                         } else {
                             session.currentPaginationToken = token;
                             session.nextUrl = nextUrl; // Save next URL from server
                             session.currentStart += 100;
                             fetchNextBatch(msgTabId, nextUrl);
                         }

                        if (!session.isWatchlistScan) {
                            saveLog({
                                url: "auto-fetch",
                                timestamp: Date.now(),
                                extractedPosts: parsedRes.posts
                            }, true, msgTabId);
                        }
                    }
                })
                .catch(err => {
                    console.error("Fetch response parsing error:", err);
                    session.isFetching = false;
                });
        } else {
            session.isFetching = false;
        }
    } else if (request.action === "stop_fetching") {
        if (senderTabId) {
            const session = getSession(senderTabId);
            session.isFetching = false;
            session.consecutiveEmptyResponses = 0;
        }
    } else if (request.action === "fetch_comments") {
        fetchComments(request.socialDetailUrn, request.start, request.paginationToken, senderTabId);
    } else if (request.action === "calculate_viral_posts") {
         fetchWithAuth(`${BACKEND_API}/v1/calculate-viral-posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts: request.posts, days: request.days })
        })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.action === "analyze_patterns") {
         fetchWithAuth(`${BACKEND_API}/v1/analyze-patterns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts: request.posts, timeframe: request.timeframe })
        })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.action === "generate_executive_summary") {
         fetchWithAuth(`${BACKEND_API}/v1/ai/executive-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payloads: request.payloads })
        })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.action === "generate_posting_habits_summary") {
         fetchWithAuth(`${BACKEND_API}/v1/ai/posting-habits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payloads: request.payloads })
        })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.action === "generate_posting_analytics_summary") {
         fetchWithAuth(`${BACKEND_API}/v1/ai/posting-analytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payloads: request.payloads })
        })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.action === 'start_profile_update') {
        const profileUrls = request.profiles || [];
        if (profileUrls.length > 0) startProfileUpdates(profileUrls);
    } else if (request.action === 'stop_profile_update') {
        stopProfileUpdates();
    } else if (request.action === 'get_profile_posts') {
        let targetUrn = request.profileUrn;
        let creatorId = request.creatorId;

        if (!creatorId && request.url) creatorId = extractCreatorId(request.url);
        if (!targetUrn && request.vanityName) targetUrn = vanityToUrn[request.vanityName];
        else if (!targetUrn && creatorId) targetUrn = vanityToUrn[creatorId];

        if (!targetUrn && (request.vanityName || creatorId)) {
            const idToCheck = request.vanityName || creatorId;
            getProfile(idToCheck).then(profile => {
                if (profile && profile.profileUrn) {
                    getPostsByProfile(profile.profileUrn).then(posts => {
                        sendResponse({ success: true, posts: posts });
                    });
                } else {
                    const tabSession = senderTabId ? getSession(senderTabId) : null;
                    if (tabSession && tabSession.profileUrn) {
                        chrome.tabs.get(senderTabId, (tab) => {
                            if (chrome.runtime.lastError || !tab || !tab.url) {
                                sendResponse({ success: false, error: 'Profile not identified yet.' });
                                return;
                            }
                            const currentTabVanity = extractCreatorId(tab.url);
                            if (currentTabVanity && currentTabVanity.toLowerCase() === idToCheck.toLowerCase()) {
                                getPostsByProfile(tabSession.profileUrn).then(posts => {
                                    sendResponse({ success: true, posts: posts });
                                });
                            } else {
                                sendResponse({ success: false, error: 'Profile not identified yet.' });
                            }
                        });
                    } else {
                        sendResponse({ success: false, error: 'Profile not identified yet.' });
                    }
                }
            });
            return true;
        }

        if (targetUrn) {
            getPostsByProfile(targetUrn).then(posts => {
                sendResponse({ success: true, posts: posts });
            });
            return true;
        } else {
            if (creatorId) {
                getPostsByProfile(creatorId, false).then(posts => {
                    sendResponse({ success: true, posts: posts });
                });
                return true;
            }
            sendResponse({ success: false, error: 'No profileUrn found.' });
        }
    } else if (request.action === 'clear_database') {
        clearAllPosts().then(success => {
            const keysToRemove = Object.keys(tabSessions).map(id => `logs_${id}`);
            chrome.storage.local.remove(keysToRemove);
            tabSessions = {};
            vanityToUrn = {};
            chrome.storage.local.set({ vanityToUrn: {} });
            sendResponse({ success: success });
        });
        return true;
    } else if (request.action === 'get_watchlist_status') {
        const creatorId = request.creatorId || extractCreatorId(request.url);
        if (creatorId) {
            getProfile(creatorId).then(profile => {
                sendResponse({ inWatchlist: profile ? !!profile.inWatchlist : false, profile: profile });
            });
            return true;
        }
        sendResponse({ inWatchlist: false });
    } else if (request.action === 'toggle_watchlist') {
        const creatorId = request.creatorId || extractCreatorId(request.url);
        if (creatorId) {
            getProfile(creatorId).then(profile => {
                const newStatus = profile ? !profile.inWatchlist : true;
                const tabSession = senderTabId ? getSession(senderTabId) : null;
                const newProfile = profile || {
                    creatorId: creatorId,
                    profileUrn: request.profileUrn || (tabSession ? tabSession.profileUrn : null),
                    profileUrl: request.url
                };
                newProfile.inWatchlist = newStatus;
                newProfile.lastUpdated = Date.now();

                if (!newProfile.profileUrn && tabSession && tabSession.profileUrn) {
                    newProfile.profileUrn = tabSession.profileUrn;
                }

                saveProfileToDB(newProfile).then(() => {
                    sendResponse({ success: true, inWatchlist: newStatus });
                });
            });
            return true;
        }
        sendResponse({ success: false, error: 'Could not identify profile.' });
    } else if (request.action === 'get_all_watchlist_profiles') {
        getWatchlistProfiles().then(profiles => {
            sendResponse({ success: true, profiles: profiles });
        });
        return true;
    } else if (request.action === 'update_all_profiles') {
        updateAllProfiles().then(results => {
            sendResponse({ success: true, results: results });
        });
        return true;
    } else if (request.action === 'delete_profile') {
        const { creatorId, profileUrn } = request;
        deleteProfileData(creatorId, profileUrn).then(result => {
            Object.values(tabSessions).forEach(session => {
                if (session.profileUrn === profileUrn) {
                    session.profileUrn = null;
                }
            });
            sendResponse(result);
        });
        return true;
    }
});

// Finalize Watchlist Sync
async function watchlistFinalizeAndRender(tabId) {
    const session = getSession(tabId);
    const allDbPosts = await getPostsByProfile(session.profileUrn);

    chrome.storage.local.set({
        [`logs_${tabId}`]: [{
            url: "db-render",
            timestamp: Date.now(),
            extractedPosts: allDbPosts
        }]
    });

    chrome.tabs.sendMessage(tabId, {
        action: "fetching_complete",
        profileUrn: session.profileUrn
    }).catch(() => { });

    if (isUpdatingProfiles) {
        stopCurrentProfileFetch();
    }

    if (session.profileUrn) {
        await migrateProfileUrn(null, session.profileUrn);
    }
}

// Watchlist Sync pagination
async function runWatchlistSync(tabId) {
    const session = getSession(tabId);
    if (!session || !session.profileUrn || !session.queryId) return;

    session.isFetching = true;
    chrome.tabs.sendMessage(tabId, { action: 'watchlist_sync_start' }).catch(() => { });

    try {
        const latestDbPost = await getLatestPostForProfile(session.profileUrn);
        const latestDbUrn = latestDbPost ? latestDbPost.urn : null;
        const isColdStart = !latestDbUrn;
        const BATCH_SIZE = isColdStart ? 100 : 20;

        let start = 0;
        let paginationToken = null;
        const newPostsBuffer = [];
        const MAX_BATCHES = 200;
        let batchCount = 0;
        let syncDone = false;

        while (batchCount < MAX_BATCHES) {
            batchCount++;
            let data;
            try {
                data = await watchlistFetch(session, start, paginationToken, BATCH_SIZE);
            } catch (fetchErr) {
                console.error("WatchlistSync fetch error:", fetchErr);
                break;
            }

            // Post raw JSON to backend for parsing
            const parseResponse = await fetchWithAuth(`${BACKEND_API}/v1/parse-posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawData: data, profileUrn: session.profileUrn })
            });
            const parsedData = await parseResponse.json();
            
            if (!parsedData || !parsedData.success) {
                console.error("WatchlistSync server parsing failed");
                break;
            }

            const batch = parsedData.posts;

            if (isColdStart) {
                if (batch.length === 0) {
                    syncDone = true;
                    break;
                }
                await savePostsToDB(batch);
                
                const nextToken = parsedData.nextToken;
                if (!nextToken || nextToken === paginationToken) {
                    syncDone = true;
                    break;
                }
                paginationToken = nextToken;
                start += batch.length;
                continue;
            }

            if (batch.length === 0) {
                syncDone = true;
                break;
            }

            const overlapIdx = batch.findIndex(p => p.urn === latestDbUrn);

            if (overlapIdx !== -1) {
                const newInBatch = batch.slice(0, overlapIdx);
                newPostsBuffer.push(...newInBatch);
                syncDone = true;
                break;
            } else {
                newPostsBuffer.push(...batch);
                const nextToken = parsedData.nextToken;
                if (!nextToken || nextToken === paginationToken) {
                    syncDone = true;
                    break;
                }
                paginationToken = nextToken;
                start += batch.length;
            }
        }

        if (newPostsBuffer.length > 0) {
            const seenUrns = new Set();
            const uniqueNew = newPostsBuffer.filter(p => {
                if (seenUrns.has(p.urn)) return false;
                seenUrns.add(p.urn);
                return true;
            });
            await savePostsToDB(uniqueNew);
        }

    } catch (e) {
        console.error("WatchlistSync loop error:", e);
    }

    session.isFetching = false;
    await watchlistFinalizeAndRender(tabId);
}

// Fetch helper using cookies
async function watchlistFetch(session, start, paginationToken, batchSize = 100) {
    let variables = `(count:${batchSize},start:${start},profileUrn:${encodeURIComponent(session.profileUrn)}`;
    if (paginationToken) variables += `,paginationToken:${paginationToken}`;
    variables += ')';

    const url = `https://www.linkedin.com/voyager/api/graphql?variables=${variables}&queryId=${session.queryId}`;

    const safeHeaders = {};
    for (const [k, v] of Object.entries(session.headers || {})) {
        if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())) {
            safeHeaders[k] = v;
        }
    }
    safeHeaders['X-Source'] = 'WatchlistSync';

    const res = await fetch(url, { method: 'GET', headers: safeHeaders, credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fetchNextBatch(tabId, nextUrl = null) {
    const session = getSession(tabId);
    if (!session.isFetching) return;

    let url = nextUrl || session.nextUrl;
    if (!url) {
        let count = 100;
        let variables = `(count:${count},start:${session.currentStart},profileUrn:${encodeURIComponent(session.profileUrn)}`;

        if (session.currentPaginationToken) {
            variables += `,paginationToken:${session.currentPaginationToken}`;
        }
        variables += `)`;

        url = `https://www.linkedin.com/voyager/api/graphql?variables=${variables}&queryId=${session.queryId}`;
    }

    const requestHeaders = { ...session.headers, "X-Source": "Interceptor" };

    chrome.tabs.sendMessage(tabId, {
        action: "fetch_url",
        url: url,
        headers: requestHeaders
    });
}

function extractCreatorId(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        const match = urlObj.pathname.match(/\/in\/([^\/]+)/);
        return match ? match[1].toLowerCase() : null;
    } catch (e) {
        const match = url.match(/\/in\/([^\/]+)/);
        return match ? match[1].toLowerCase() : null;
    }
}

async function updateAllProfiles() {
    const profiles = await getWatchlistProfiles();
    const results = [];

    for (const profile of profiles) {
        const anySession = Object.values(tabSessions).find(s => s.headers && s.queryId);
        if (!anySession) {
            results.push({ id: profile.creatorId, status: 'skipped', reason: 'No active session' });
            continue;
        }

        if (!profile.profileUrn) {
            results.push({ id: profile.creatorId, status: 'failed', reason: 'No URN' });
            continue;
        }

        try {
            const fetchedCount = await fetchProfileUpdates(profile.profileUrn, anySession);
            results.push({ id: profile.creatorId, status: 'success', count: fetchedCount });

            profile.lastFetched = Date.now();
            await saveProfileToDB(profile);

            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            results.push({ id: profile.creatorId, status: 'error', error: e.message });
        }
    }
    return results;
}

function fetchProfileUpdates(profileUrn, session) {
    return new Promise((resolve, reject) => {
        const count = 20;
        const start = 0;
        if (!session.queryId) return reject(new Error("No queryId"));

        const variables = `(count:${count},start:${start},profileUrn:${encodeURIComponent(profileUrn)})`;
        const url = `https://www.linkedin.com/voyager/api/graphql?variables=${variables}&queryId=${session.queryId}`;

        const requestHeaders = { ...session.headers, "X-Source": "Interceptor" };

        fetch(url, {
            method: 'GET',
            headers: requestHeaders,
            credentials: 'include'
        })
            .then(res => res.json())
            .then(async data => {
                // Parse on server
                const parseResponse = await fetchWithAuth(`${BACKEND_API}/v1/parse-posts`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rawData: data, profileUrn })
                });
                const parsedResult = await parseResponse.json();

                if (parsedResult && parsedResult.success && parsedResult.posts.length > 0) {
                    savePostsToDB(parsedResult.posts).then(newCount => {
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
    let session = tabId ? getSession(tabId) : null;
    if (!session) {
        session = Object.values(tabSessions).find(s => s.headers);
    }
    if (!session || !tabId) return;
    if (!socialDetailUrn) return;

    const queryId = "voyagerSocialDashComments.afec6d88d7810d45548797a8dac4fb87";

    let variables = `(count:10,numReplies:1,socialDetailUrn:${encodeURIComponent(socialDetailUrn)},sortOrder:RELEVANCE,start:${start}`;

    if (paginationToken) {
        variables += `,paginationToken:${paginationToken}`;
    }
    variables += `)`;

    const encodedVariables = encodeURIComponent(variables);
    const url = `https://www.linkedin.com/voyager/api/graphql?variables=${encodedVariables}&queryId=${queryId}`;

    const requestHeaders = { ...session.headers, "X-Source": "Interceptor" };

    chrome.tabs.sendMessage(tabId, {
        action: "fetch_url",
        url: url,
        headers: requestHeaders,
        isCommentFetch: true
    });
}

function saveLog(logEntry, skipDB = false, tabId = null) {
    const session = tabId ? getSession(tabId) : null;
    const vanity = session ? session.vanityName : null;

    if (logEntry.extractedPosts && logEntry.extractedPosts.length > 0) {
        logEntry.extractedPosts.forEach(post => {
            if (vanity && !post.creatorId) post.creatorId = vanity;
            if (session && session.profileUrn && !post.profileUrn) post.profileUrn = session.profileUrn;
        });

        // Only save to IndexedDB if skipDB is false!
        if (!skipDB) {
            savePostsToDB(logEntry.extractedPosts).then(count => {
                console.log(`Saved ${count} posts to IndexedDB.`);
            }).catch(err => {
                console.error("Failed to save posts to IndexedDB:", err);
            });
        }
    }

    const storageKey = tabId ? `logs_${tabId}` : 'logs';

    chrome.storage.local.get({ [storageKey]: [] }, (result) => {
        let logs = result[storageKey] || [];
        logs = logs.map(log => {
            const { body, ...rest } = log;
            return rest;
        });

        logs.unshift(logEntry);

        const MAX_LOGS = 1000;
        if (logs.length > MAX_LOGS) {
            logs.length = MAX_LOGS;
        }

        const trySave = (logsToSave) => {
            chrome.storage.local.set({ [storageKey]: logsToSave }, () => {
                if (chrome.runtime.lastError) {
                    const err = chrome.runtime.lastError.message;
                    if (err.includes("quota") || err.includes("exceeded")) {
                        if (logsToSave.length > 1) {
                            const newLength = Math.max(1, Math.floor(logsToSave.length * 0.9));
                            const trimmedLogs = logsToSave.slice(0, newLength);
                            trySave(trimmedLogs);
                        } else {
                            chrome.storage.local.set({ [storageKey]: [logEntry] });
                        }
                    }
                }
            });
        };
        trySave(logs);
    });
}

chrome.debugger.onDetach.addListener((source, reason) => {
    attachedTabs.delete(source.tabId);
});

function extractTimestampFromUrn(urn) {
    if (!urn) return 0;
    const match = urn.match(/(\d+)/);
    if (!match) return 0;
    const id = BigInt(match[1]);
    return Number(id >> 22n);
}

// Queue Processing
function startProfileUpdates(urls) {
    if (isUpdatingProfiles) return;
    if (!urls || urls.length === 0) return;

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

function processNextProfile() {
    if (!isUpdatingProfiles) return;

    if (updateQueue.length === 0) {
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

    const vanityMatch = profileUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    const vanityName = vanityMatch ? vanityMatch[1] : profileUrl;

    broadcastWatchlistProgress({
        action: 'profile_update_progress',
        message: `Processing ${processed}/${total}: ${vanityName}`,
        total: total,
        processed: processed - 1
    });

    chrome.tabs.create({ url: profileUrl, active: false }, (tab) => {
        updateTabId = tab.id;
        broadcastWatchlistProgress({
            action: 'profile_update_progress',
            message: `  ⏳ Loading ${vanityName}...`,
            total: total,
            processed: processed - 1
        });

        updateTabTimeout = setTimeout(() => {
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
    if (updateTabTimeout) {
        clearTimeout(updateTabTimeout);
        updateTabTimeout = null;
    }

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

    const tabToClose = updateTabId;
    updateTabId = null;
    if (tabToClose) {
        chrome.tabs.remove(tabToClose).catch(() => { });
    }

    setTimeout(() => {
        processNextProfile();
    }, 2000);
}

// External Messages Listener (from login page)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log("[Background] Received external message:", request);
    if (request.action === "save_token") {
        const token = request.token;
        chrome.storage.local.set({ auth_token: token }, () => {
            console.log("[Background] Clerk auth token saved successfully.");
            sendResponse({ success: true });
            
            // Notify all active tabs to check auth and refresh
            chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: "auth_state_changed", isAuthenticated: true }).catch(() => {});
                });
            });
        });
        return true;
    }
});

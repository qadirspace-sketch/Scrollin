// Minimal stand-in for the chrome.* extension APIs the UI uses, answering the
// background script's messages with sample data. Preview only.
import { POSTS_BY_CREATOR, WATCHLIST } from './mockData';

const store = {};
const storageListeners = new Set();
const messageListeners = new Set();
const watchlist = new Map(WATCHLIST.map(p => [p.creatorId, p]));

const vanityFrom = (url) => {
    const match = (url || '').match(/\/in\/([^/]+)/);
    return match ? match[1].toLowerCase() : null;
};

const postBackend = (path, body) =>
    fetch(`/__mock/${path}`, { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());

const USER = { firstName: 'Alex', fullName: 'Alex Rivera', email: 'alex@example.com' };

function handle(message) {
    switch (message.action) {
        case 'get_tab_id': return { tabId: 1 };
        case 'check_auth': return { isAuthenticated: true, user: USER };
        case 'fetch_auth_user': return { success: true, user: USER };
        case 'url_changed':
        case 'get_profile_posts': {
            const vanity = message.vanityName || vanityFrom(message.currentUrl || message.url);
            return { success: true, posts: POSTS_BY_CREATOR[vanity] || [] };
        }
        case 'get_watchlist_status': {
            const vanity = message.creatorId || vanityFrom(message.url);
            const profile = watchlist.get(vanity);
            return { inWatchlist: !!profile?.inWatchlist, profile };
        }
        case 'toggle_watchlist': {
            const vanity = message.creatorId || vanityFrom(message.url);
            const profile = watchlist.get(vanity) || { creatorId: vanity, profileUrl: message.url };
            profile.inWatchlist = !profile.inWatchlist;
            watchlist.set(vanity, profile);
            return { success: true, inWatchlist: profile.inWatchlist };
        }
        case 'get_all_watchlist_profiles':
            return { success: true, profiles: [...watchlist.values()].filter(p => p.inWatchlist) };
        case 'calculate_viral_posts': return postBackend('calculate-viral-posts', message);
        case 'analyze_patterns': return postBackend('analyze-patterns', message);
        default:
            console.info('[Preview] Unmocked message:', message.action);
            return { success: false, error: `"${message.action}" is not available in preview` };
    }
}

const sendMessage = (message, callback) => {
    Promise.resolve(handle(message)).then(response => {
        if (callback) setTimeout(() => callback(response), 0);
    });
};

window.chrome = {
    runtime: {
        id: 'preview',
        lastError: undefined,
        sendMessage,
        getURL: (path) => `/${path}`,
        onMessage: {
            addListener: (fn) => messageListeners.add(fn),
            removeListener: (fn) => messageListeners.delete(fn),
        },
    },
    tabs: {
        sendMessage: (_tabId, message, callback) => sendMessage(message, callback),
        query: (_q, callback) => callback?.([{ id: 1, url: window.location.href }]),
        get: (id, callback) => callback?.({ id, url: window.location.href }),
        create: ({ url }) => window.open(url, '_blank'),
        reload: () => window.location.reload(),
        remove: () => {},
    },
    storage: {
        local: {
            get: (keys, callback) => {
                const result = {};
                if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
                    for (const [k, fallback] of Object.entries(keys)) result[k] = k in store ? store[k] : fallback;
                } else {
                    for (const k of [].concat(keys ?? Object.keys(store))) if (k in store) result[k] = store[k];
                }
                callback?.(result);
            },
            set: (items, callback) => {
                const changes = {};
                for (const [k, v] of Object.entries(items)) {
                    changes[k] = { oldValue: store[k], newValue: v };
                    store[k] = v;
                }
                storageListeners.forEach(fn => fn(changes, 'local'));
                callback?.();
            },
            remove: (keys, callback) => {
                [].concat(keys).forEach(k => delete store[k]);
                callback?.();
            },
        },
        onChanged: {
            addListener: (fn) => storageListeners.add(fn),
            removeListener: (fn) => storageListeners.delete(fn),
        },
    },
};

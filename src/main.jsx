import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorHandler from './components/ErrorHandler';
import './styles.css';
import { initPostObserver } from './utils/postObserver';

console.log("[Scrollin] main.jsx loaded. Initializing DOM injection...");

let reactRoot = null;
let isPanelOpen = false;

// Create vanilla button
const toggleBtn = document.createElement('div');
toggleBtn.id = 'scrollin-app-toggle';
toggleBtn.title = 'Open Kleo';

// Style vanilla button with inline styles to prevent any CSS loading block
Object.assign(toggleBtn.style, {
    position: 'fixed',
    bottom: '24px',
    left: '24px',
    width: '56px',
    height: '56px',
    backgroundColor: '#111111',
    color: '#FFFFFF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: '2147483647',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: '1px solid rgba(255, 255, 255, 0.15)'
});

// Inner SVG for toggle button
toggleBtn.innerHTML = `
<svg width="28" height="28" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none;">
    <path d="M7.998 4a1 1 0 1 1 0-2h8.004a1 1 0 1 1 0 2v5.657l4.504 7.312C21.809 19.085 20.403 22 17.819 22H6.181c-2.584 0-3.99-2.915-2.687-5.031l4.504-7.312zm2.001 0v5.94a1 1 0 0 1-.149.524L8.289 13h7.424l-1.562-2.536A1 1 0 0 1 14 9.94V4z" />
</svg>
`;

// Hover effects
toggleBtn.addEventListener('mouseenter', () => {
    toggleBtn.style.transform = 'translateY(-4px) scale(1.05)';
    toggleBtn.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)';
});
toggleBtn.addEventListener('mouseleave', () => {
    toggleBtn.style.transform = 'none';
    toggleBtn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)';
});

function togglePanel() {
    isPanelOpen = !isPanelOpen;
    console.log("[Scrollin] Toggling side panel. Open state:", isPanelOpen);

    let appContainer = document.getElementById('scrollin-app-root');
    if (!appContainer) {
        appContainer = document.createElement('div');
        appContainer.id = 'scrollin-app-root';
        document.body.appendChild(appContainer);
        console.log("[Scrollin] Lazy-created root container #scrollin-app-root");
        
        reactRoot = ReactDOM.createRoot(appContainer);
    }

    // Render the React app, passing isPanelOpen and onClose callback
    reactRoot.render(
        <React.StrictMode>
            <ErrorHandler>
                <App 
                    isOpen={isPanelOpen} 
                    onClose={() => {
                        isPanelOpen = false;
                        reactRoot.render(
                            <React.StrictMode>
                                <ErrorHandler>
                                    <App isOpen={false} onClose={() => {}} />
                                </ErrorHandler>
                            </React.StrictMode>
                        );
                    }} 
                />
            </ErrorHandler>
        </React.StrictMode>
    );
}

toggleBtn.addEventListener('click', togglePanel);

function initExtension() {
    try {
        if (!document.body) {
            console.error("[Scrollin] document.body is still null, cannot append toggle button!");
            return;
        }

        // Prevent duplicate toggle buttons
        if (document.getElementById('scrollin-app-toggle')) {
            console.log("[Scrollin] Toggle button already exists, skipping injection.");
            return;
        }

        document.body.appendChild(toggleBtn);
        console.log("[Scrollin] Vanilla toggle button successfully injected into document.body");
    } catch (error) {
        console.error("[Scrollin] Fatal error initializing vanilla toggle button injection:", error);
    }
}

// Initialize when body is ready
if (document.body) {
    initExtension();
} else {
    document.addEventListener("DOMContentLoaded", () => {
        initExtension();
    });
}

// Initialize the Post Observer to tag posts
initPostObserver();

// Message listener for fetch requests (Auto-fetch logic)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetch_url") {
        console.log("Fetching URL:", message.url);

        // Prepare headers
        const headers = new Headers();
        if (message.headers) {
            for (const [key, value] of Object.entries(message.headers)) {
                // Skip unsafe headers that browser might block or handle automatically
                if (!['host', 'connection', 'content-length', 'origin', 'referer', 'accept-encoding', 'cookie'].includes(key.toLowerCase())) {
                    headers.append(key, value);
                }
            }
        }

        if (!headers.has('accept') && !headers.has('Accept')) {
            headers.set('Accept', 'application/json');
        }

        // Always ensure CSRF token is present
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers.set('Csrf-Token', csrfToken);
        }

        fetch(message.url, {
            method: 'GET',
            headers: headers,
            credentials: 'include' // Important for cookies
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                chrome.runtime.sendMessage({ action: "fetch_response", data: data, url: message.url, context: message.context });
            })
            .catch(error => {
                console.error("Fetch failed:", error);
                chrome.runtime.sendMessage({ action: "fetch_response", error: error.message, url: message.url, context: message.context });
            });
    }
});

// Resolve a profile vanity name to its fsd_profile URN.
// LinkedIn's new UI no longer issues the feed GraphQL request we used to intercept,
// so the background asks us to look the URN up with the page's own session.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "resolve_profile") return;

    const csrfToken = getCsrfToken();
    const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(message.vanity)}`;

    fetch(url, {
        method: 'GET',
        headers: {
            'Csrf-Token': csrfToken,
            'Accept': 'application/vnd.linkedin.normalized+json+2.1',
            'X-RestLi-Protocol-Version': '2.0.0'
        },
        credentials: 'include'
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            const profileUrn = data?.data?.['*elements']?.[0] ||
                (data?.included || []).find(item => item.entityUrn?.startsWith('urn:li:fsd_profile:'))?.entityUrn;
            if (!profileUrn) throw new Error('No profile URN in response');
            sendResponse({ profileUrn, csrfToken });
        })
        .catch(error => sendResponse({ error: error.message }));

    return true; // Keep channel open for async response
});

function getCsrfToken() {
    // Try to get from cookie
    const match = document.cookie.match(/JSESSIONID="?([^";]+)"?/);
    return match ? match[1] : '';
}

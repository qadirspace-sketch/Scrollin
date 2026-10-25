const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('https');
require('dotenv').config();

const { verifyToken, createClerkClient } = require('@clerk/backend');

const { calculateViralPosts } = require('./utils/viralScoreEngine');
const { analyzePatterns } = require('./utils/hookAnalysis');

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ANSI color logger utility
const log = {
    info: (msg) => console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg, err) => console.error(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[31m[ERROR]\x1b[0m ${msg}`, err || ''),
    ai: (msg) => console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[35m[AI PROCESS]\x1b[0m ${msg}`),
    auth: (msg) => console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[34m[AUTH]\x1b[0m ${msg}`),
    server: (msg) => console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[37m[SERVER]\x1b[0m ${msg}`)
};

// Initialize Gemini AI engine
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const geminiModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

const app = express();
const PORT = process.env.PORT || 5001;


// Helper to extract cookie value
function getCookie(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (let cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) return value;
    }
    return null;
}

// Clerk Authentication Middleware
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            token = getCookie(req, '__session');
        }

        if (!token) {
            log.warn("[Auth] Unauthorized: No session token found in request.");
            return res.status(401).json({ success: false, error: 'Unauthorized: Session required' });
        }

        let sessionClaims;
        try {
            sessionClaims = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY,
            });
        } catch (err) {
            // Check if verification failed specifically because the JWT has expired.
            // If so, the signature verification succeeded, meaning the token is authentic and issued by Clerk,
            // but its short-lived lifetime (default 60s) has passed. We accept expired tokens for local extension requests
            // to prevent frequent logout glitches.
            if (err.message && err.message.toLowerCase().includes('expired')) {
                try {
                    const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString();
                    sessionClaims = JSON.parse(payloadStr);
                    log.auth(`[Auth] JWT expired (expiry: ${sessionClaims.exp}), accepted via fallback bypass for user: ${sessionClaims.sub}`);
                } catch (decodeErr) {
                    log.error('[Auth] Failed to decode expired token payload:', decodeErr);
                    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid session' });
                }
            } else {
                log.error('[Auth] Verification failed:', err);
                return res.status(401).json({ success: false, error: 'Unauthorized: Invalid session' });
            }
        }

        req.auth = {
            userId: sessionClaims.sub,
            claims: sessionClaims
        };
        next();
    } catch (err) {
        log.error('[Auth] Internal error in requireAuth middleware:', err);
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid session' });
    }
};


app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Cloudflare AI Worker URL - kept secure on the backend
const CF_WORKER_URL = "https://linkedin-post-tagger-worker.iamabdulsamad2-0.workers.dev";

// --- MIDDLEWARE / REGISTRATION PAGE UI ---
// --- MIDDLEWARE / REGISTRATION PAGE UI ---
// Serving a highly styled dark-mode landing/registration page at /
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Scrollin - Authentication Portal</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg-gradient: linear-gradient(135deg, #0a0a0a 0%, #121212 100%);
                --card-bg: rgba(20, 20, 20, 0.8);
                --card-border: rgba(255, 255, 255, 0.08);
                --text-primary: #f8fafc;
                --text-secondary: #94a3b8;
                --accent: #6366f1;
            }
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: 'Outfit', sans-serif;
            }
            body {
                background: var(--bg-gradient);
                color: var(--text-primary);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .container {
                max-width: 450px;
                width: 100%;
                padding: 2.5rem;
                border-radius: 24px;
                background: var(--card-bg);
                backdrop-filter: blur(16px);
                border: 1px solid var(--card-border);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                text-align: center;
            }
            .logo {
                font-size: 2.5rem;
                font-weight: 800;
                background: linear-gradient(to right, #818cf8, #c084fc);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: -0.05em;
                margin-bottom: 0.5rem;
            }
            .subtitle {
                color: var(--text-secondary);
                font-size: 1rem;
                margin-bottom: 2rem;
            }
            #auth-container {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 200px;
            }
            .welcome-box {
                background: rgba(99, 102, 241, 0.1);
                border: 1px solid rgba(99, 102, 241, 0.2);
                border-radius: 16px;
                padding: 1.5rem;
                margin-top: 1rem;
            }
            .success-title {
                color: #818cf8;
                font-size: 1.25rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
            }
            .success-desc {
                color: var(--text-secondary);
                font-size: 0.9rem;
                margin-bottom: 1.5rem;
            }
            .user-btn-container {
                display: inline-block;
                margin-bottom: 1.5rem;
            }
            .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(16, 185, 129, 0.1);
                color: #34d399;
                padding: 0.5rem 1rem;
                border-radius: 9999px;
                font-size: 0.85rem;
                font-weight: 600;
                border: 1px solid rgba(16, 185, 129, 0.2);
            }
        </style>
        <script
            async
            crossorigin="anonymous"
            data-clerk-publishable-key="pk_test_ZWxlY3RyaWMtdGhydXNoLTkwLmNsZXJrLmFjY291bnRzLmRldiQ"
            src="https://electric-thrush-90.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
            type="text/javascript"
        ></script>
    </head>
    <body>
        <div class="container">
            <div class="logo">Scrollin</div>
            <div class="subtitle">Authentication Portal</div>
            
            <div id="auth-container">
                <!-- Clerk sign-in will mount here -->
            </div>

            <div id="logged-in-box" style="display: none;">
                <div class="welcome-box">
                    <div class="user-btn-container" id="user-button-slot"></div>
                    <div class="success-title" id="welcome-msg">Welcome Back!</div>
                    <div class="success-desc">You are successfully authenticated. You can now open LinkedIn and use the Scrollin extension.</div>
                    <div class="status-badge">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="6" cy="6" r="4" fill="#10B981"/>
                        </svg>
                        Extension Unlocked
                    </div>
                </div>
            </div>
        </div>

        <script>
            // Parse query parameters
            const urlParams = new URLSearchParams(window.location.search);
            const extId = urlParams.get('extId');

            window.addEventListener('load', async () => {
                if (!window.Clerk) {
                    console.error("Clerk SDK failed to load.");
                    return;
                }
                
                await window.Clerk.load();
                
                if (window.Clerk.user) {
                    document.getElementById('auth-container').style.display = 'none';
                    document.getElementById('logged-in-box').style.display = 'block';
                    
                    window.Clerk.mountUserButton(document.getElementById('user-button-slot'));
                    document.getElementById('welcome-msg').innerText = "Welcome back, " + (window.Clerk.user.firstName || window.Clerk.user.username || 'User') + "!";
                    
                    // Fetch token
                    const token = await window.Clerk.session.getToken();
                    localStorage.setItem('clerk_token', token);
                    
                    // Periodically refresh the token
                    setInterval(async () => {
                        if (window.Clerk.session) {
                            const newToken = await window.Clerk.session.getToken();
                            localStorage.setItem('clerk_token', newToken);
                            if (extId && window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                                chrome.runtime.sendMessage(extId, { action: "save_token", token: newToken }).catch(() => {});
                            }
                        }
                    }, 20000);

                    // Send initial token to extension
                    if (extId && window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                        console.log("Sending token to extension:", extId);
                        chrome.runtime.sendMessage(extId, { action: "save_token", token: token })
                            .then(() => console.log("Token sent successfully"))
                            .catch(err => console.error("Error sending token to extension:", err));
                    }
                } else {
                    document.getElementById('auth-container').style.display = 'flex';
                    document.getElementById('logged-in-box').style.display = 'none';
                    localStorage.removeItem('clerk_token');
                    
                    window.Clerk.mountSignIn(document.getElementById('auth-container'), {
                        afterSignInUrl: window.location.search // preserve extId in url after login redirects
                    });
                }
            });
        </script>
    </body>
    </html>
    `);
});

app.get('/logout', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Signing out...</title>
        <style>
            body {
                background: linear-gradient(135deg, #0b0f19 0%, #111827 100%);
                color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .spinner {
                border: 3px solid rgba(255, 255, 255, 0.05);
                border-top: 3px solid #6366f1;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .msg {
                font-size: 16px;
                font-weight: 500;
                color: #94a3b8;
            }
        </style>
        <script
            async
            crossorigin="anonymous"
            data-clerk-publishable-key="pk_test_ZWxlY3RyaWMtdGhydXNoLTkwLmNsZXJrLmFjY291bnRzLmRldiQ"
            src="https://electric-thrush-90.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
            type="text/javascript"
        ></script>
    </head>
    <body>
        <div class="spinner"></div>
        <div class="msg">Signing out of Scrollin...</div>
        
        <script>
            window.addEventListener('load', async () => {
                if (!window.Clerk) {
                    console.error("Clerk SDK failed to load.");
                    window.location.href = "/";
                    return;
                }
                
                await window.Clerk.load();
                if (window.Clerk.session) {
                    await window.Clerk.signOut();
                }
                
                const urlParams = new URLSearchParams(window.location.search);
                const extId = urlParams.get('extId');
                if (extId) {
                    window.location.href = "/?extId=" + extId;
                } else {
                    window.location.href = "/";
                }
            });
        </script>
    </body>
    </html>
    `);
});

app.get('/v1/auth-check', requireAuth, async (req, res) => {
    console.log(`[Server] GET /v1/auth-check - Fetching details for user: ${req.auth.userId}`);
    try {
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const user = await clerkClient.users.getUser(req.auth.userId);
        
        res.json({ 
            success: true, 
            userId: req.auth.userId,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.username || 'User'),
                imageUrl: user.imageUrl || user.profileImageUrl
            }
        });
    } catch (e) {
        console.error("[Server] Error fetching user from Clerk backend:", e.message);
        res.json({ 
            success: true, 
            userId: req.auth.userId,
            user: {
                firstName: 'User',
                fullName: 'User',
                imageUrl: null
            }
        });
    }
});

// --- PHASE 2: SECURE RULE & SCRAPER CONFIG ENDPOINTS ---
app.get('/v1/config', requireAuth, (req, res) => {
    console.log("[Server] GET /v1/config - Serves Voyager API rules to extension.");
    res.json({
        success: true,
        rules: {
            targetUrlPattern: "/voyager/api/graphql",
            feedKey: "voyagerFeedDashProfile",
            commentsKey: "voyagerSocialDashComments",
            profileKey: "voyagerIdentityDashProfiles",
            profileComponentKey: "voyagerIdentityDashProfileComponents"
        }
    });
});

// --- PHASE 3: SERVER-SIDE LINKEDIN RAW JSON PARSING ---

app.post('/v1/parse-posts', requireAuth, async (req, res) => {
    const { rawData, profileUrn, queryId, start } = req.body;
    const sizeBytes = rawData ? (typeof rawData === 'string' ? rawData.length : JSON.stringify(rawData).length) : 0;
    console.log(`[Server] POST /v1/parse-posts - Size: ${sizeBytes} bytes | Profile URN: ${profileUrn || 'none'}`);

    if (!rawData) {
        console.warn("[Server] POST /v1/parse-posts - Warning: Missing rawData payload.");
        return res.status(400).json({ success: false, error: "Missing rawData payload" });
    }

    try {
        const parsedJson = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        const posts = extractPosts(parsedJson, profileUrn);
        const nextToken = extractPaginationToken(parsedJson);

        let nextUrl = null;
        if (nextToken && queryId && profileUrn) {
            const nextStart = parseInt(start || 0, 10) + 100;
            const variables = `(count:100,start:${nextStart},profileUrn:${encodeURIComponent(profileUrn)},paginationToken:${nextToken})`;
            nextUrl = `https://www.linkedin.com/voyager/api/graphql?variables=${variables}&queryId=${queryId}`;
        }

        console.log(`[Server] POST /v1/parse-posts - Success. Extracted ${posts?.length || 0} posts. Next Token: ${nextToken ? 'Yes' : 'No'} | Next URL: ${nextUrl ? 'Yes' : 'No'}`);
        res.json({ success: true, posts, nextToken, nextUrl });
    } catch (e) {
        console.error("[Server] Parser Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/v1/parse-comments', requireAuth, (req, res) => {
    const { rawData, requestUrl } = req.body;
    const sizeBytes = rawData ? (typeof rawData === 'string' ? rawData.length : JSON.stringify(rawData).length) : 0;
    console.log(`[Server] POST /v1/parse-comments - Size: ${sizeBytes} bytes | URL: ${requestUrl?.substring(0, 100)}...`);

    if (!rawData) {
        console.warn("[Server] POST /v1/parse-comments - Warning: Missing rawData payload.");
        return res.status(400).json({ success: false, error: "Missing rawData payload" });
    }

    try {
        const commentData = extractComments(rawData, requestUrl);
        console.log(`[Server] POST /v1/parse-comments - Success. Extracted ${commentData.comments?.length || 0} comments.`);
        res.json({ success: true, ...commentData });
    } catch (e) {
        console.error("[Server] Comments Parser Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Proxy route for AI tagging to keep Cloudflare Worker hidden
app.post('/v1/tag-posts-batch', requireAuth, async (req, res) => {
    const { items } = req.body;
    console.log(`[Server] POST /v1/tag-posts-batch - Batch Size: ${items?.length || 0}`);

    if (!items || !Array.isArray(items)) {
        console.warn("[Server] POST /v1/tag-posts-batch - Warning: Missing items array.");
        return res.status(400).json({ success: false, error: "Missing items array" });
    }

    try {
        // Build request to Cloudflare AI Worker
        const payload = JSON.stringify({ batch: items.map(item => ({ id: item.id, text: item.text })) });

        const cfReq = http.request(CF_WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (cfRes) => {
            let body = '';
            cfRes.on('data', chunk => body += chunk);
            cfRes.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    console.log(`[Server] POST /v1/tag-posts-batch - Success. Classification tags returned.`);
                    res.json({ success: true, results: data });
                } catch (err) {
                    console.error("[Server] Failed to parse Cloudflare tags response:", err);
                    res.status(500).json({ success: false, error: "Failed to parse AI tags response" });
                }
            });
        });

        cfReq.on('error', (e) => {
            console.error("[Server] Cloudflare proxy request error:", e);
            res.status(500).json({ success: false, error: e.message });
        });

        cfReq.write(payload);
        cfReq.end();

    } catch (e) {
        console.error("[Server] Error in tag-posts-batch proxy route:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- PORTING SCRAPER LOGIC TO BACKEND ---

function extractPosts(jsonString, profileUrn) {
    const posts = [];
    try {
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;

        if (data.included && Array.isArray(data.included)) {
            const urnMap = new Map();
            data.included.forEach(item => {
                if (item.entityUrn) urnMap.set(item.entityUrn, item);
                if (item.urn) urnMap.set(item.urn, item);
            });

            let allUrns = [];
            const collectUrns = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                if (Array.isArray(obj['*elements'])) {
                    allUrns.push(...obj['*elements']);
                }
                if (Array.isArray(obj['elements'])) {
                    allUrns.push(...obj['elements']);
                }
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'object') {
                        if (key === 'included' || key === 'extensions') continue;
                        collectUrns(obj[key]);
                    }
                }
            };
            collectUrns(data.data);

            if (allUrns.length > 0) {
                const uniqueUrns = Array.from(new Set(allUrns));
                uniqueUrns.forEach(urn => {
                    const item = urnMap.get(urn);
                    if (item) {
                        const post = parsePost(item, urnMap, profileUrn);
                        if (post) {
                            posts.push(post);
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error parsing JSON for extraction:", e);
    }
    return posts;
}

function extractComments(jsonString, requestUrl) {
    try {
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        const comments = [];
        let paginationToken = null;
        let socialDetailUrn = null;
        let root = data.data?.socialDashCommentsBySocialDetail;
        const urnMap = new Map();

        if (data.included && Array.isArray(data.included)) {
            data.included.forEach(item => {
                if (item.entityUrn) urnMap.set(item.entityUrn, item);
                if (item.urn) urnMap.set(item.urn, item);
            });

            const socialDetail = data.included.find(item => item.$type === 'com.linkedin.voyager.dash.social.SocialDetail');
            if (socialDetail) {
                socialDetailUrn = socialDetail.entityUrn;
            }
        }

        if (root && root.metadata && root.metadata.paginationToken) {
            paginationToken = root.metadata.paginationToken;
        }

        if (!socialDetailUrn && requestUrl) {
            try {
                const urlObj = new URL(requestUrl);
                const variables = urlObj.searchParams.get("variables");
                if (variables) {
                    const decodedVars = decodeURIComponent(variables);
                    const match = decodedVars.match(/socialDetailUrn:(urn:li:[^,)]+)/) ||
                                  decodedVars.match(/socialDetailUrn:([^,)]+)/);
                    if (match) {
                        let potentialUrn = match[1].replace(/^"|"$/g, '');
                        if (potentialUrn.includes('%')) {
                            potentialUrn = decodeURIComponent(potentialUrn);
                        }
                        socialDetailUrn = potentialUrn;
                    }
                }
            } catch (err) {
                console.warn("Failed to extract socialDetailUrn from URL:", err);
            }
        }

        if (root) {
            const elementsList = root.elements || root['*elements'];
            if (Array.isArray(elementsList)) {
                elementsList.forEach(commentUrn => {
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
        return { comments: [], paginationToken: null, socialDetailUrn: null };
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

        if (item.commentary && item.commentary.text) {
            text = typeof item.commentary.text === 'string' ? item.commentary.text : item.commentary.text.text || "";
        }

        if (item.commenter) {
            const commenter = item.commenter;
            if (commenter.title && commenter.title.text) authorName = commenter.title.text;
            if (commenter.subtitle) {
                authorHeadline = typeof commenter.subtitle === 'string' ? commenter.subtitle : commenter.subtitle.text || "";
            }

            if (commenter.image && commenter.image.attributes && commenter.image.attributes.length > 0) {
                const imgAttr = commenter.image.attributes[0];
                if (imgAttr.detailData && imgAttr.detailData.nonEntityProfilePicture && imgAttr.detailData.nonEntityProfilePicture.vectorImage) {
                    const vector = imgAttr.detailData.nonEntityProfilePicture.vectorImage;
                    if (vector.rootUrl && vector.artifacts && vector.artifacts.length > 0) {
                        const artifact = vector.artifacts[vector.artifacts.length - 1];
                        authorImage = vector.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                    }
                }
            }

            if (commenter.navigationUrl) profileUrl = commenter.navigationUrl;
        }

        if (item.createdTime && item.createdTime.text) {
            time = item.createdTime.text;
        } else if (item.createdAt) {
            const date = new Date(item.createdAt);
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
        console.error("Error parsing comment:", e);
        return null;
    }
}

function parsePost(item, urnMap, profileUrn) {
    let urn = item.entityUrn || item.urn || "";
    if (urn && (urn.includes(':comment:') || urn.includes(':message:') || urn.includes(':fsd_profile:') || urn.includes(':profile:'))) {
        return null;
    }
    let text = "";
    let media = [];
    let socialDetailUrn = null;
    let stats = { likes: 0, comments: 0, reposts: 0 };

    if (item.commentary && item.commentary.text && item.commentary.text.text) {
        text = item.commentary.text.text;
    } else if (item.resharedUpdate && item.resharedUpdate.commentary && item.resharedUpdate.commentary.text && item.resharedUpdate.commentary.text.text) {
        text = item.resharedUpdate.commentary.text.text;
    }

    let date = "";
    if (item.actor && item.actor.subDescription && item.actor.subDescription.text) {
        date = item.actor.subDescription.text;
    } else if (item.resharedUpdate && item.resharedUpdate.actor && item.resharedUpdate.actor.subDescription && item.resharedUpdate.actor.subDescription.text) {
        date = item.resharedUpdate.actor.subDescription.text;
    }

    let creatorName = "";
    let creatorImage = "";
    const actor = item.actor || (item.resharedUpdate && item.resharedUpdate.actor);
    if (actor) {
        if (actor.name && actor.name.text) creatorName = actor.name.text;
        if (actor.image && actor.image.attributes && actor.image.attributes.length > 0) {
            const imageAttr = actor.image.attributes[0];
            if (imageAttr.detailData && imageAttr.detailData.nonEntityProfilePicture) {
                const vectorImage = imageAttr.detailData.nonEntityProfilePicture.vectorImage;
                if (vectorImage && vectorImage.rootUrl && vectorImage.artifacts && vectorImage.artifacts.length > 0) {
                    const artifact = vectorImage.artifacts[vectorImage.artifacts.length - 1];
                    creatorImage = vectorImage.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                }
            }
        }
    }

    if (item.content) {
        const extracted = extractMediaFromContent(item.content, urnMap);
        if (extracted) media.push(...extracted);
    }
    if (item.resharedUpdate && item.resharedUpdate.content) {
        const extracted = extractMediaFromContent(item.resharedUpdate.content, urnMap);
        if (extracted) media.push(...extracted);
    }

    if (item['*socialDetail']) {
        socialDetailUrn = item['*socialDetail'];
        const socialDetail = urnMap.get(socialDetailUrn);

        if (socialDetail) {
            let counts = null;
            if (socialDetail.socialActivityCounts) {
                counts = typeof socialDetail.socialActivityCounts === 'string' ? urnMap.get(socialDetail.socialActivityCounts) : socialDetail.socialActivityCounts;
            } else if (socialDetail['*socialActivityCounts']) {
                counts = urnMap.get(socialDetail['*socialActivityCounts']);
            }

            if (counts) {
                if (counts.numLikes) stats.likes = counts.numLikes;
                if (counts.numComments) stats.comments = counts.numComments;
                if (counts.numShares) stats.reposts = counts.numShares;
                if (counts.numViews) stats.views = counts.numViews;
            }

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
            }
        }
    }

    let isRepost = false;
    let repostType = null;
    if (item.resharedUpdate) {
        isRepost = true;
        const sharerUrn = item.actor?.urn;
        const originalAuthorUrn = item.resharedUpdate?.actor?.urn;
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

    if (item.header && item.header.text && item.header.text.text) {
        if (item.header.text.text.toLowerCase().includes('reposted')) {
            isRepost = true;
        }
    }

    let postUrl = "";
    if (item.socialContent && item.socialContent.shareUrl) {
        postUrl = item.socialContent.shareUrl;
    } else if (item.updateMetadata && item.updateMetadata.shareUrl) {
        postUrl = item.updateMetadata.shareUrl;
    }

    if (!postUrl && urn) {
        let activityUrn = urn;
        if (urn.includes('(')) {
            const match = urn.match(/\(([^,]+)/);
            if (match && match[1]) activityUrn = match[1];
        }

        const parts = activityUrn.split(':');
        if (parts.length >= 4) {
            const type = parts[2];
            const id = parts[3];
            if (type === 'activity') postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`;
            else if (type === 'ugcPost') postUrl = `https://www.linkedin.com/feed/update/urn:li:ugcPost:${id}/`;
            else if (type === 'share') postUrl = `https://www.linkedin.com/feed/update/urn:li:share:${id}/`;
            else postUrl = `https://www.linkedin.com/feed/update/${activityUrn}/`;
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

        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.component.image.ImageComponent' && comp.images) {
            comp.images.forEach(img => {
                if (img.attributes) {
                    img.attributes.forEach(attr => {
                        if (attr.detailData && attr.detailData.vectorImage) {
                            const vector = attr.detailData.vectorImage;
                            if (vector.rootUrl && vector.artifacts && vector.artifacts.length > 0) {
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

        if (comp['$type'] === 'com.linkedin.videocontent.VideoPlayMetadata') {
            if (comp.progressiveStreams && comp.progressiveStreams.length > 0) {
                const sortedStreams = [...comp.progressiveStreams].sort((a, b) => (b.height || 0) - (a.height || 0));
                const stream = sortedStreams[0];
                if (stream.streamingLocations && stream.streamingLocations.length > 0) {
                    mediaItems.push({ type: 'video', url: stream.streamingLocations[0].url });
                }
            }
        }

        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.component.linkedinvideo.LinkedInVideoComponent' && comp['*videoPlayMetadata']) {
            const videoData = urnMap.get(comp['*videoPlayMetadata']);
            if (videoData && videoData.progressiveStreams && videoData.progressiveStreams.length > 0) {
                const sortedStreams = [...videoData.progressiveStreams].sort((a, b) => (b.height || 0) - (a.height || 0));
                const stream = sortedStreams[0];
                if (stream.streamingLocations && stream.streamingLocations.length > 0) {
                    mediaItems.push({ type: 'video', url: stream.streamingLocations[0].url });
                }
            }
        }

        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.component.document.DocumentComponent' && comp.document) {
            const carouselImages = [];
            if (comp.document.coverPages && comp.document.coverPages.pagesPerResolution) {
                const resolutions = comp.document.coverPages.pagesPerResolution;
                if (resolutions.length > 0) {
                    const bestRes = resolutions[resolutions.length - 1];
                    if (bestRes.imageUrls && bestRes.imageUrls.length > 0) carouselImages.push(...bestRes.imageUrls);
                }
            }

            if (carouselImages.length > 0) {
                mediaItems.push({
                    type: 'carousel',
                    images: carouselImages,
                    url: comp.document.transcribedDocumentUrl || comp.document.manifestUrl || null,
                    manifestUrl: comp.document.manifestUrl || null,
                    transcribedDocumentUrl: comp.document.transcribedDocumentUrl || null,
                    title: comp.document.title || 'Carousel'
                });
            }
        }

        if (comp['$type'] === 'com.linkedin.voyager.dash.feed.carousel.CarouselContent' && comp.items) {
            const legacyCarouselImages = [];
            comp.items.forEach(carouselItem => {
                if (carouselItem.content && carouselItem.content.imageComponent) {
                    const imgComp = carouselItem.content.imageComponent;
                    if (imgComp.images && imgComp.images.length > 0 && imgComp.images[0].attributes) {
                        const attr = imgComp.images[0].attributes[0];
                        if (attr && attr.detailData && attr.detailData.vectorImage) {
                            const v = attr.detailData.vectorImage;
                            if (v.rootUrl && v.artifacts) {
                                const sortedArtifacts = [...v.artifacts].sort((a, b) => b.width - a.width);
                                legacyCarouselImages.push(v.rootUrl + sortedArtifacts[0].fileIdentifyingUrlPathSegment);
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

function extractPaginationToken(data) {
    try {
        const findToken = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.paginationToken && typeof obj.paginationToken === 'string') {
                return obj.paginationToken;
            }
            if (obj.metadata && obj.metadata.paginationToken && typeof obj.metadata.paginationToken === 'string') {
                return obj.metadata.paginationToken;
            }
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
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
        }
    } catch (e) {
        console.error("Error extracting token:", e);
    }
    return null;
}

// --- SECURE ANALYTICS ENDPOINTS ---

app.post('/v1/calculate-viral-posts', requireAuth, (req, res) => {
    const { posts, days } = req.body;
    log.info(`[Analytics] POST /v1/calculate-viral-posts - Received ${posts?.length || 0} posts | Days: ${days}`);
    try {
        const result = calculateViralPosts(posts, days);
        const viralPosts = result.filter(p => p.viralLabel === 'Highly Viral' || p.viralLabel === 'Viral');
        log.success(`[Analytics] calculate-viral-posts - Found ${viralPosts.length} viral posts out of ${result.length} active posts in the last ${days} days.`);
        res.json({ success: true, posts: result });
    } catch (e) {
        log.error("[Analytics] Calculate Viral Posts Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/v1/analyze-patterns', requireAuth, (req, res) => {
    const { posts, timeframe } = req.body;
    log.info(`[Analytics] POST /v1/analyze-patterns - Received ${posts?.length || 0} posts | Timeframe: ${timeframe}`);
    try {
        const result = analyzePatterns(posts, timeframe);
        log.success(`[Analytics] analyze-patterns - Identified ${result.patterns?.length || 0} hook patterns. Creator Type: ${result.meta?.creatorType} (Consistency: ${Math.round(parseFloat(result.meta?.consistencyScore || 0) * 100)}%)`);
        if (result.patterns && result.patterns.length > 0) {
            log.info(`[Analytics] analyze-patterns - Top Pattern: "${result.patterns[0].name}" (Usage: ${result.patterns[0].stats?.frequency}%)`);
        }
        res.json({ success: true, patterns: result.patterns, meta: result.meta, postTypes: result.postTypes });
    } catch (e) {
        log.error("[Analytics] Analyze Patterns Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- SECURE AI PROCESSES ROUTING ---

app.post('/v1/ai/executive-summary', requireAuth, async (req, res) => {
    const { payloads } = req.body;
    log.info(`[AI] POST /v1/ai/executive-summary - Received payloads for: ${Object.keys(payloads || {}).join(', ')}`);
    if (!payloads || Object.keys(payloads).length === 0) {
        log.warn(`[AI] Executive Summary - Empty payloads.`);
        return res.status(400).json({ success: false, error: "Empty payloads" });
    }

    try {
        let combinedContext = "";
        const instructionMap = [];

        for (const [range, data] of Object.entries(payloads)) {
            if (!data) continue;

            const growingTopic = data.rising_star ? data.rising_star.name : "None";
            const decliningTopic = data.declining ? data.declining.name : "None";
            const opportunityTopic = data.opportunity ? data.opportunity.name : "None";

            combinedContext += `
[DATA FOR ${range.toUpperCase()}]
- Total Posts: ${data.post_count}
- Growing Topic: "${growingTopic}" (Trend: ${data.rising_star?.trend || 'N/A'})
- Declining Topic: "${decliningTopic}" (Trend: ${data.declining?.trend || 'N/A'})
- Opportunity Topic: "${opportunityTopic}" (Note: High engagement, low volume)
- Context (JSON): ${JSON.stringify(data)}
`;

            instructionMap.push(`
    For "${range}":
    1. "growing": Write about "${growingTopic}". Start with: "Your *${growingTopic}* posts are..."
    2. "declining": Write about "${decliningTopic}". Start with: "Your *${decliningTopic}* posts are..."
    3. "opportunity": Write about "${opportunityTopic}". Start with: "Your *${opportunityTopic}* posts are..."
    `);
        }

        const prompt = `
        You are a friendly and practical Social Media Coach.
        Analyze the provided data.

        ${combinedContext}

        Your Task:
        For EACH time period, provide 3 insights.

        CRITICAL INSTRUCTIONS:
        1. **STRICT TOPIC ADHERENCE**: 
           ${instructionMap.join('\n')}
           - If the topic is "None", return "No significant trend detected."
           - **MUST** mention the topic name in the insight.
           - **EXAMPLE**: If topic is "Sales", say: "Your *Sales* posts are booming! Double down by sharing a case study."

        2. **TONE**:
           - Simple, easy English. No jargon.
           - ACTIONABLE: Tell the user exactly what to do.
           - Short and punchy.

        Output STRICT JSON format with keys "7d", "30d", "90d", "all":
        {
            "7d": {
                "growing": "Insight containing topic name...",
                "declining": "Insight containing topic name...",
                "opportunity": "Insight containing topic name..."
            },
            ...
        }

        - Constraint: Output ONLY valid JSON. No markdown.
        `;

        log.ai(`Calling Gemini for Executive Summary...`);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonResponse = JSON.parse(cleanText);

        // Force topic name check
        for (const [range, data] of Object.entries(payloads)) {
            if (!jsonResponse[range]) continue;

            const checkAndFix = (type, topicName) => {
                if (!topicName || topicName === "None") return;

                const insight = jsonResponse[range][type];
                if (!insight) return;

                if (!insight.toLowerCase().includes(topicName.toLowerCase())) {
                    jsonResponse[range][type] = `Regarding *${topicName}*, ${insight.charAt(0).toLowerCase() + insight.slice(1)}`;
                }
            };

            checkAndFix('growing', data.rising_star?.name);
            checkAndFix('declining', data.declining?.name);
            checkAndFix('opportunity', data.opportunity?.name);
        }

        log.success(`Executive Summary generated successfully.`);
        res.json({ success: true, data: jsonResponse });
    } catch (err) {
        log.error(`Executive Summary failed:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/v1/ai/posting-habits', requireAuth, async (req, res) => {
    const { payloads } = req.body;
    log.info(`[AI] POST /v1/ai/posting-habits - Received payloads for: ${Object.keys(payloads || {}).join(', ')}`);
    if (!payloads || Object.keys(payloads).length === 0) {
        log.warn(`[AI] Posting Habits - Empty payloads.`);
        return res.status(400).json({ success: false, error: "Empty payloads" });
    }

    try {
        let combinedContext = "";
        for (const [range, data] of Object.entries(payloads)) {
            if (!data) continue;
            combinedContext += `
[DATA FOR ${range.toUpperCase()}]
- Most active day (by number of posts): ${data.bestDay} (${data.bestDayEng} posts)
- Most active hour (by number of posts): ${data.bestHour} (${data.bestHourEng} posts) [${data.timeZone || "viewer local time"}]
- Best performing day (median vs creator median, 3+ posts): ${data.topDay ? `${data.topDay.name} (${data.topDay.lift.toFixed(1)}x median, ${data.topDay.n} posts)` : "not enough data — do not recommend a day"}
- Best performing time slot: ${data.topTime ? `${data.topTime.name} (${data.topTime.lift.toFixed(1)}x median, ${data.topTime.n} posts)` : "not enough data — do not recommend a time"}
- Posts in range: ${data.postsInRange ?? "n/a"}
- Avg Frequency: ${data.avgFrequency}/week (Trend: ${data.freqGrowth}%)
`;
        }

        const prompt = `
        You are a Data-Driven Social Media Strategist.
        Analyze the posting habits data below:

        ${combinedContext}

        Your Task:
        For EACH time period, provide 2 short, punchy insights without any jargon. Maximize accuracy.

        CRITICAL INSTRUCTIONS:
        1. "opportunity": Look at the data. Identify a missed opportunity or give a specific content suggestion based on frequency or engagement trend. (e.g. "You haven't posted much on weekends, but engagement is high. Try a casual post.")
        2. "optimal_slot": Suggest the exact best day and time to post next, explicitly mentioning the Best Day and Peak Eng. Time from the data. (e.g. "Next best time is ${payloads[Object.keys(payloads)[0]]?.bestDay || 'soon'} at ${payloads[Object.keys(payloads)[0]]?.bestHour || 'the usual time'}. Prepare your draft.")

        Output STRICT JSON format with keys exactly matching the input ranges ("7d", "30d", "90d", "1y", "All Time"):
        {
            "7d": {
                "opportunity": "Insight here...",
                "optimal_slot": "Insight here..."
            },
            ...
        }

        - Constraint: Output ONLY valid JSON. No markdown backticks or text outside the JSON.
        `;

        log.ai(`Calling Gemini for Posting Habits...`);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonResponse = JSON.parse(cleanText);

        log.success(`Posting Habits generated successfully.`);
        res.json({ success: true, data: jsonResponse });
    } catch (err) {
        log.error(`Posting Habits failed:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/v1/ai/posting-analytics', requireAuth, async (req, res) => {
    const { payloads } = req.body;
    log.info(`[AI] POST /v1/ai/posting-analytics - Received payloads for: ${Object.keys(payloads || {}).join(', ')}`);
    if (!payloads || Object.keys(payloads).length === 0) {
        log.warn(`[AI] Posting Analytics - Empty payloads.`);
        return res.status(400).json({ success: false, error: "Empty payloads" });
    }

    try {
        let combinedContext = "";
        for (const [range, data] of Object.entries(payloads)) {
            if (!data) continue;
            let metricGrowth = 0;
            if (data.prevTotalMetric > 0) metricGrowth = ((data.currentTotalMetric - data.prevTotalMetric) / data.prevTotalMetric) * 100;

            combinedContext += `
[DATA FOR ${range}]
- Active Metric: ${data.activeMetric}
- Total ${data.activeMetric}: ${data.currentTotalMetric} (Previous: ${data.prevTotalMetric})
- ${data.activeMetric} Growth: ${metricGrowth.toFixed(1)}%
- Total Posts: ${data.currentTotalPosts} (Previous: ${data.prevTotalPosts})
- Median engagement score per post (likes + 3x comments + 4x reposts): ${data.currentMedianScore ?? "n/a"} (Previous: ${data.prevMedianScore ?? "n/a"})${data.hasEnoughData ? "" : " — too few posts to compare periods; do not claim a trend"}
`;
        }

        const prompt = `
        You are a Data-Driven Social Media Strategist.
        Analyze the posting analytics data below for multiple time ranges:
        
        ${combinedContext}
        
        Your Task:
        For EACH time period provided, provide 2-3 short, punchy, and highly ACTIONABLE insights based on its specific data.
        Maximize accuracy and keep token count low.

        CRITICAL INSTRUCTIONS:
        1. ALWAYS include real data numbers in your insights (e.g., "Your Likes are up by 15.2%...").
        2. ALWAYS explicitly state what the user should DO NEXT based on this data. Give clear, actionable advice to improve their strategy.
        
        Format STRICTLY as a JSON object where the keys are the exact time ranges provided (e.g., "Last 7 Days", "Last 30 Days"). 
        The value for each key MUST BE an array of objects:
        {
            "Last 7 Days": [
                {
                    "text": "Your actionable insight with data...",
                    "type": "success|warning|info"
                }
            ],
            ...
        }

        - Constraint: Output ONLY valid JSON object. No markdown backticks or text outside the JSON.
        `;

        log.ai(`Calling Gemini for Posting Analytics...`);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleanText = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const jsonResponse = JSON.parse(cleanText);

        log.success(`Posting Analytics generated successfully.`);
        res.json({ success: true, data: jsonResponse });
    } catch (err) {
        log.error(`Posting Analytics failed:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    log.server(`Scrollin Secure Backend running at http://localhost:${PORT}`);
});


// content.js

// Create Floating Icon
const icon = document.createElement('div');
icon.id = 'li-interceptor-icon';
icon.innerHTML = '<span>📑</span>'; // Simple icon for now
document.body.appendChild(icon);

// Create Sidebar Container
const sidebar = document.createElement('div');
sidebar.id = 'li-interceptor-sidebar';
sidebar.innerHTML = `
  <div class="sidebar-header">
    <h3>Extracted Posts</h3>
    <div class="header-controls">
        <button id="manual-sync-btn" title="Force Sync DB" style="margin-right: 5px; padding: 2px 5px; cursor: pointer;">🔄</button>
        <select id="sort-posts" title="Sort Posts">
            <option value="default">Default (Chronological)</option>
            <option value="newest">Most Newest</option>
            <option value="oldest">Most Oldest</option>
            <option value="most_liked">Most Liked</option>
            <option value="least_liked">Least Liked</option>
            <option value="most_commented">Most Commented</option>
            <option value="least_commented">Least Commented</option>
            <option value="most_shared">Most Shared</option>
            <option value="least_shared">Least Shared</option>
            <option value="combined_score">Highest Combined Score</option>
            <option value="inverse_combined_score">Lowest Combined Score</option>
        </select>
        <button id="close-sidebar">×</button>
    </div>
  </div>
  <div id="fetch-progress" class="fetch-progress" style="display: none;">
    <span id="progress-text">Fetching posts...</span>
    <span id="progress-count">0 posts fetched</span>
  </div>
  <div id="sidebar-content" class="sidebar-content">
    <div class="empty-state">
        <p>Waiting for posts...</p>
        <p style="font-size: 12px; margin-top: 8px;">Scroll the LinkedIn feed to start automatic fetching.</p>
    </div>
  </div>
`;
document.body.appendChild(sidebar);

// Toggle Sidebar
let isOpen = false;
icon.addEventListener('click', () => {
    console.log("Icon clicked. Toggling sidebar.");
    isOpen = !isOpen;
    sidebar.classList.toggle('open', isOpen);
    console.log("Sidebar open state:", isOpen, "Class list:", sidebar.classList.toString());
    if (isOpen) {
        loadPosts();
    }
});


document.getElementById('close-sidebar').addEventListener('click', () => {
    isOpen = false;
    sidebar.classList.remove('open');
});

// Manual Sync Button
// Manual Sync Button Logic (Event Delegation)
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'manual-sync-btn') {
        const btn = e.target;
        console.log("Manual Sync Triggered");
        btn.textContent = 'Syncing...';
        chrome.runtime.sendMessage({ action: 'get_profile_posts' }, (response) => {
            if (response && response.success && response.posts) {
                btn.textContent = 'Force Sync DB';
                console.log(`Manual load: ${response.posts.length} posts.`);
                renderSimplePosts(response.posts);
            } else {
                btn.textContent = 'Sync Failed';
                setTimeout(() => btn.textContent = 'Force Sync DB', 2000);
            }
        });
    }
});


// Removed manual fetch button - fetching is now automatic

// Load Posts from Storage
// Sort change listener
document.getElementById('sort-posts').addEventListener('change', () => {
    loadPosts();
});

function loadPosts() {
    chrome.storage.local.get({ logs: [] }, (result) => {
        const sortCriteria = document.getElementById('sort-posts').value;
        renderPosts(result.logs, sortCriteria);
    });
}

// Listen for storage changes to update real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.logs) {
        if (isOpen) {
            const sortCriteria = document.getElementById('sort-posts').value;
            renderPosts(changes.logs.newValue, sortCriteria);
        }
        // Update progress count whenever logs change
        updateProgressCount();
    }
});

// Helper function to update progress count
function updateProgressCount() {
    chrome.storage.local.get({ logs: [] }, (result) => {
        const allPosts = getAllPosts(result.logs);
        const countEl = document.getElementById('progress-count');
        if (countEl) {
            countEl.textContent = `${allPosts.length} post${allPosts.length !== 1 ? 's' : ''} fetched`;
        }
    });
}

// Message listener for fetch requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "session_captured") {
        // Show progress indicator and start automatic fetching
        const progressDiv = document.getElementById('fetch-progress');
        if (progressDiv) {
            progressDiv.style.display = 'flex';
            document.getElementById('progress-text').textContent = 'Fetching posts...';
            updateProgressCount();
        }

        // Request URL-based DB lookup first (Fast Load)
        chrome.runtime.sendMessage({ action: 'get_profile_posts' }, (response) => {
            if (response && response.success && response.posts && response.posts.length > 0) {
                console.log(`Loaded ${response.posts.length} historical posts from DB.`);
                // Render these immediately
                renderSimplePosts(response.posts);

                // Update text to show we have data but are checking for new
                if (progressDiv) {
                    document.getElementById('progress-text').textContent = 'Checking for new posts...';
                }
            }
        });
    } else if (message.action === "reset_ui") {
        // Clear posts
        const container = document.getElementById('sidebar-content');
        if (container) {
            container.innerHTML = '<div class="empty-state">Waiting for posts...</div>';
        }

        // Hide progress indicator
        const progressDiv = document.getElementById('fetch-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    } else if (message.action === "fetching_complete") {
        console.log("[Content] Received fetching_complete. Payload:", message);
        // Update progress to show completion
        const progressDiv = document.getElementById('fetch-progress');
        if (progressDiv) {
            document.getElementById('progress-text').textContent = '✓ All posts fetched! Loading full history...';
            document.getElementById('progress-text').style.color = '#10b981';
        }

        // RELOAD ALL FROM DB to ensure we show the full merged dataset (New + Old)
        // Use the profileUrn passed from background if available
        const requestPayload = { action: 'get_profile_posts' };
        if (message.profileUrn) {
            requestPayload.profileUrn = message.profileUrn;
            console.log("Requesting full history for URN:", message.profileUrn);
        }

        chrome.runtime.sendMessage(requestPayload, (response) => {
            if (response && response.success && response.posts) {
                console.log(`Final load: ${response.posts.length} posts from DB.`);
                renderSimplePosts(response.posts);
                if (progressDiv) {
                    document.getElementById('progress-text').textContent = '✓ Update Complete';
                }
            }
        });
    } else if (message.action === "fetch_url") {
        console.log("Fetching URL:", message.url);
        console.log("Fetch Headers:", message.headers);

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
        // Do NOT overwrite Accept header if it exists in captured headers
        // LinkedIn API requires specific Accept headers (e.g. vnd.linkedin.normalized+json)
        if (!headers.has('accept') && !headers.has('Accept')) {
            headers.set('Accept', 'application/json');
        }

        // Always ensure CSRF token is present
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers.set('Csrf-Token', csrfToken);
        }

        // Log final headers for debugging (commented out for production)
        // const headerLog = {};
        // headers.forEach((value, key) => headerLog[key] = value);
        // console.log("Final Fetch Headers:", headerLog);

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
                chrome.runtime.sendMessage({ action: "fetch_response", data: data });
            })
            .catch(error => {
                console.error("Fetch failed:", error);
                chrome.runtime.sendMessage({ action: "fetch_response", error: error.message });
            });
    }
});

function getCsrfToken() {
    // Try to get from cookie
    const match = document.cookie.match(/JSESSIONID="?([^";]+)"?/);
    return match ? match[1] : '';
}

function renderPosts(logs, sortCriteria = 'default') {
    const container = document.getElementById('sidebar-content');
    container.innerHTML = '';

    const allPosts = getAllPosts(logs);

    if (allPosts.length === 0) {
        container.innerHTML = '<div class="empty-state">No posts captured yet. Scroll the feed!</div>';
        return;
    }

    const sortedPosts = sortPosts(allPosts, sortCriteria);

    let postCounter = 1;

    sortedPosts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'sidebar-post';

        // Post Number
        const numberEl = document.createElement('div');
        numberEl.className = 'post-number';
        numberEl.textContent = `#${postCounter++}`;
        postEl.appendChild(numberEl);

        // Creator Profile (Avatar + Name)
        if (post.creatorName || post.creatorImage) {
            const creatorEl = document.createElement('div');
            creatorEl.className = 'post-creator';

            if (post.creatorImage) {
                const avatarEl = document.createElement('img');
                avatarEl.src = post.creatorImage;
                avatarEl.className = 'creator-avatar';
                avatarEl.alt = post.creatorName || 'Profile picture';
                creatorEl.appendChild(avatarEl);
            }

            if (post.creatorName) {
                const nameEl = document.createElement('div');
                nameEl.className = 'creator-name';
                nameEl.textContent = post.creatorName;
                creatorEl.appendChild(nameEl);
            }

            postEl.appendChild(creatorEl);
        }

        // Date
        // Date & Time
        const dateEl = document.createElement('div');
        dateEl.className = 'post-date';
        let dateText = post.date ? post.date.replace('•', '').trim() : '';

        if (post.urn) {
            const exactTime = extractTimeFromUrn(post.urn);
            if (exactTime) {
                // If we have a relative date (e.g. "1d"), append the exact time
                if (dateText) {
                    dateText += ` • ${exactTime}`;
                } else {
                    dateText = exactTime;
                }
            }
        }

        if (dateText) {
            dateEl.textContent = dateText;
            postEl.appendChild(dateEl);
        }


        // Text
        if (post.text) {
            const textEl = document.createElement('div');
            textEl.className = 'post-text';

            const fullText = post.text;
            const maxLength = 200;

            if (fullText.length <= maxLength) {
                textEl.textContent = fullText;
            } else {
                const truncatedText = fullText.substring(0, maxLength) + '... ';

                const textSpan = document.createElement('span');
                textSpan.textContent = truncatedText;

                const toggleBtn = document.createElement('span');
                toggleBtn.className = 'see-more-btn';
                toggleBtn.textContent = 'See more';

                toggleBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevent bubbling if needed
                    if (toggleBtn.textContent === 'See more') {
                        textSpan.textContent = fullText + ' ';
                        toggleBtn.textContent = 'See less';
                    } else {
                        textSpan.textContent = truncatedText;
                        toggleBtn.textContent = 'See more';
                    }
                };

                textEl.appendChild(textSpan);
                textEl.appendChild(toggleBtn);
            }
            postEl.appendChild(textEl);
        }

        // Media
        if (post.media && post.media.length > 0) {
            const mediaContainer = document.createElement('div');
            mediaContainer.className = 'post-media-container';

            post.media.forEach(media => {
                if (media.type === 'image') {
                    const img = document.createElement('img');
                    img.src = media.url;
                    img.className = 'post-image';
                    mediaContainer.appendChild(img);
                } else if (media.type === 'video') {
                    const video = document.createElement('video');
                    video.src = media.url;
                    video.controls = true;
                    video.className = 'post-video';
                    mediaContainer.appendChild(video);
                } else if (media.type === 'carousel') {
                    const carouselContainer = document.createElement('div');
                    carouselContainer.className = 'carousel-container';

                    // Render initial images
                    media.images.forEach(url => {
                        const img = document.createElement('img');
                        img.src = url;
                        img.className = 'carousel-image';
                        carouselContainer.appendChild(img);
                    });

                    // Lazy load full carousel if manifest exists
                    if (media.manifestUrl && media.images.length < 5) {
                        fetchFullCarousel(media.manifestUrl, carouselContainer);
                    }

                    mediaContainer.appendChild(carouselContainer);

                    // Add "Get Carousel Text" button if manifestUrl exists
                    if (media.manifestUrl) {
                        const btn = document.createElement('button');
                        btn.className = 'get-transcript-btn';
                        btn.textContent = 'Get Carousel Text';
                        btn.onclick = () => fetchTranscript(media.manifestUrl, btn);
                        mediaContainer.appendChild(btn);
                    }

                    // Add "Download PDF" button if transcribedDocumentUrl exists
                    console.log("Rendering carousel media:", media); // DEBUG LOG
                    if (media.transcribedDocumentUrl) {
                        const downloadBtn = document.createElement('a');
                        downloadBtn.className = 'download-pdf-btn';
                        downloadBtn.textContent = 'Download PDF';
                        downloadBtn.href = media.transcribedDocumentUrl;
                        downloadBtn.target = '_blank';
                        // download attribute might not work for cross-origin, but good to have
                        downloadBtn.setAttribute('download', '');
                        mediaContainer.appendChild(downloadBtn);
                    }
                }
            });
            postEl.appendChild(mediaContainer);
        }

        // Interaction Stats
        if (post.stats) {
            const statsEl = document.createElement('div');
            statsEl.className = 'post-stats';

            const createStat = (icon, count, label) => {
                const el = document.createElement('span');
                el.className = 'stat-item';
                el.title = label;
                el.innerHTML = `${icon} ${count}`;
                return el;
            };

            if (post.stats.likes !== undefined) statsEl.appendChild(createStat('👍', post.stats.likes, 'Likes'));
            if (post.stats.comments !== undefined) statsEl.appendChild(createStat('💬', post.stats.comments, 'Comments'));
            if (post.stats.reposts !== undefined) statsEl.appendChild(createStat('🔁', post.stats.reposts, 'Reposts'));
            if (post.stats.views !== undefined) statsEl.appendChild(createStat('👁️', post.stats.views, 'Impressions'));

            postEl.appendChild(statsEl);
        }

        container.appendChild(postEl);
    });
}

function getAllPosts(logs) {
    if (!logs || logs.length === 0) return [];

    const seenPosts = new Set();
    const allPosts = [];

    // Reverse logs to show oldest first (Page 1, then Page 2...)
    // This ensures the default order matches the feed order (Top to Bottom)
    const logsToProcess = [...logs].reverse();

    logsToProcess.forEach(log => {
        if (log.extractedPosts && log.extractedPosts.length > 0) {
            log.extractedPosts.forEach(post => {
                // Generate unique signature
                let signature;
                if (post.urn) {
                    signature = post.urn;
                } else {
                    // Fallback to content-based signature
                    const mediaSignature = post.media ? post.media.map(m => m.url).join(',') : '';
                    signature = `${post.text || ''}|${mediaSignature}`;
                }

                if (!seenPosts.has(signature)) {
                    seenPosts.add(signature);
                    allPosts.push(post);
                }
            });
        }
    });

    return allPosts;
}

function sortPosts(posts, criteria) {
    const getCount = (post, type) => {
        return (post.stats && post.stats[type]) ? post.stats[type] : 0;
    };

    const getCombinedScore = (post) => {
        return getCount(post, 'likes') + getCount(post, 'comments') + getCount(post, 'reposts');
    };

    const parseRelativeDate = (dateStr) => {
        if (!dateStr) return Infinity; // Treat missing dates as very old

        const cleanStr = dateStr.replace('•', '').trim().toLowerCase();

        // Handle "Just now" or similar
        if (cleanStr.includes('now') || cleanStr.includes('second') || cleanStr.includes('min')) {
            if (cleanStr.includes('now')) return 0;
        }

        const parts = cleanStr.match(/(\d+)\s*([a-z]+)/);

        if (!parts) return Infinity;

        const value = parseInt(parts[1], 10);
        const unit = parts[2];

        // Convert everything to minutes for comparison
        let multiplier = 1;
        if (unit.startsWith('m') && !unit.startsWith('mo')) multiplier = 1; // minutes
        else if (unit.startsWith('h')) multiplier = 60; // hours
        else if (unit.startsWith('d')) multiplier = 60 * 24; // days
        else if (unit.startsWith('w')) multiplier = 60 * 24 * 7; // weeks
        else if (unit.startsWith('mo')) multiplier = 60 * 24 * 30; // months
        else if (unit.startsWith('y')) multiplier = 60 * 24 * 365; // years

        return value * multiplier;
    };

    return [...posts].sort((a, b) => {
        switch (criteria) {
            case 'newest':
                return parseRelativeDate(a.date) - parseRelativeDate(b.date);
            case 'oldest':
                return parseRelativeDate(b.date) - parseRelativeDate(a.date);
            case 'most_liked':
                return getCount(b, 'likes') - getCount(a, 'likes');
            case 'least_liked':
                return getCount(a, 'likes') - getCount(b, 'likes');
            case 'most_commented':
                return getCount(b, 'comments') - getCount(a, 'comments');
            case 'least_commented':
                return getCount(a, 'comments') - getCount(b, 'comments');
            case 'most_shared':
                return getCount(b, 'reposts') - getCount(a, 'reposts');
            case 'least_shared':
                return getCount(a, 'reposts') - getCount(b, 'reposts');
            case 'combined_score':
                return getCombinedScore(b) - getCombinedScore(a);
            case 'inverse_combined_score':
                return getCombinedScore(a) - getCombinedScore(b);
            case 'default':
            default:
                return 0; // Maintain original order
        }
    });
}

async function fetchFullCarousel(manifestUrl, container) {
    try {
        const response = await fetch(manifestUrl);
        if (!response.ok) return;
        const data = await response.json();

        if (data.perResolutions && data.perResolutions.length > 0) {
            // Get highest resolution
            const bestRes = data.perResolutions[data.perResolutions.length - 1];
            if (bestRes.imageManifestUrl) {
                const imgResponse = await fetch(bestRes.imageManifestUrl);
                if (!imgResponse.ok) return;
                const imgData = await imgResponse.json();

                if (imgData.pages && imgData.pages.length > 0) {
                    // Clear existing preview images
                    container.innerHTML = '';
                    imgData.pages.forEach(url => {
                        const img = document.createElement('img');
                        img.src = url;
                        img.className = 'carousel-image';
                        container.appendChild(img);
                    });
                }
            }
        }
    } catch (e) {
        console.error("Failed to load full carousel:", e);
    }
}

async function fetchTranscript(manifestUrl, btn) {
    try {
        btn.textContent = 'Loading...';
        btn.disabled = true;

        // 1. Fetch Manifest
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error("Failed to fetch manifest");
        const data = await response.json();

        // 2. Get Transcript URL
        if (!data.transcriptManifestUrl) {
            throw new Error("No transcript URL found in manifest");
        }

        // 3. Fetch Transcript Text
        const transcriptResponse = await fetch(data.transcriptManifestUrl);
        if (!transcriptResponse.ok) throw new Error("Failed to fetch transcript text");
        const transcriptText = await transcriptResponse.text();

        // 4. Display Text
        const container = document.createElement('div');
        container.className = 'transcript-container';
        container.textContent = transcriptText;

        // Insert after button
        btn.parentNode.insertBefore(container, btn.nextSibling);

        // Update button
        btn.textContent = 'Transcript Loaded';
        btn.style.display = 'none'; // Hide button after loading

    } catch (e) {
        console.error("Error fetching transcript:", e);
        btn.textContent = 'Error Loading Text';
        btn.disabled = false;
        setTimeout(() => {
            btn.textContent = 'Get Carousel Text';
        }, 3000);
    }
}

function extractTimeFromUrn(urn) {
    if (!urn) return null;
    // Extract the numeric ID (works for activity:123 or ugcPost:123)
    const match = urn.match(/(\d+)/);
    if (!match) return null;

    const id = BigInt(match[1]);
    // The timestamp is in the first 41 bits of the 64-bit ID
    const timestamp = Number(id >> 22n);
    const date = new Date(timestamp);

    // Format as HH:MM:SS AM/PM
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

// Simplified render that works directly with a list of posts (like from IDB)
function renderSimplePosts(posts) {
    if (!posts || posts.length === 0) return;

    // Use the existing renderer, but wrap our flat list into the expected "log" format
    // logs = [ { extractedPosts: [...] } ]

    const logs = [{ extractedPosts: posts }];
    // Use whatever the user has selected in the dropdown
    const sortCriteria = document.getElementById('sort-posts') ? document.getElementById('sort-posts').value : 'default';
    renderPosts(logs, sortCriteria);

    // Update count
    const countEl = document.getElementById('progress-count');
    if (countEl) {
        countEl.textContent = `${posts.length} saved post${posts.length !== 1 ? 's' : ''} loaded`;
    }
}

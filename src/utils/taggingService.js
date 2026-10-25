
/**
 * Tagging Service for LinkedIn Posts
 * Combines rule-based logic and AI embeddings (future).
 */

import { extractTimeFromUrn } from './timeUtils.js';

const TAGS = [
    "Career Advice",
    "Personal Story",
    "Opinion / Take",
    "LinkedIn Platform",
    "Leadership",
    "Marketing",
    "Hiring",
    "Productivity",
    "Startup",
    "AI / Tech",
    "Software Engineering",
    "Web Development",
    "Design / UX",
    "Mental Health",
    "Work Culture",
    "Motivation",
    "Content Creation",
    "Finance / Investing",
    "Sales",
    "Freelancing",
    "Cybersecurity",
    "Travel",
    "Personal Branding",
    "Life Story",
    "Health & Wellness",
    "General"
];

const RAW_RULES = {
    "Career Advice": [/career/i, /interview/i, /resume/i, /job search/i, /advice/i, /salary/i, /negotiation/i, /\boffer/i, /promotion/i],
    "Personal Story": [/i remember/i, /years ago/i, /my journey/i, /personal/i, /vulnerable/i, /lesson learned/i, /childhood/i, /grateful/i, /life lesson/i],
    "Opinion / Take": [/unpopular opinion/i, /hot take/i, /believe/i, /\bagree/i, /disagree/i, /thoughts\?/i, /perspective/i, /truth is/i, /my take/i],
    "LinkedIn Platform": [/linkedin/i, /algorithm/i, /reach/i, /engagement/i, /content/i, /creator/i, /personal brand/i, /followers/i, /impressions/i],
    "Leadership": [/leader/i, /team/i, /management/i, /boss/i, /vision/i, /manager/i, /delegation/i, /hiring/i, /culture/i, /executive/i],
    "Marketing": [/marketing/i, /brand/i, /sales/i, /customer/i, /copywriting/i, /advertising/i, /\bb2b\b/i, /\bb2c\b/i, /\bgtm\b/i, /growth/i, /\bseo\b/i],
    "Hiring": [/hiring/i, /looking for/i, /open role/i, /apply/i, /job opening/i, /recruiting/i, /remote job/i, /positions/i, /talent/i],
    "Productivity": [/productivity/i, /focus/i, /habit/i, /routine/i, /time management/i, /efficiency/i, /deep work/i, /pomodoro/i, /system/i, /workflow/i],
    "Startup": [/startup/i, /founder/i, /fundraising/i, /venture/i, /bootstrapped/i, /scale/i, /pitch/i, /equity/i, /\bsaas\b/i, /entrepreneur/i, /\bmvp\b/i],
    "AI / Tech": [/\bai\b/i, /artificial intelligence/i, /\btech\b/i, /\bgpt\b/i, /\bllm\b/i, /machine learning/i, /future of work/i, /automation/i, /robot/i, /innovation/i, /\bdata\b/i],
    "Software Engineering": [/software/i, /\bcode\b/i, /coding/i, /programming/i, /developer/i, /engineer/i, /\bgit\b/i, /algorithm/i, /backend/i, /system design/i, /open source/i, /database/i, /cloud/i, /architecture/i],
    "Web Development": [/web dev/i, /frontend/i, /\breact\b/i, /javascript/i, /typescript/i, /\bcss\b/i, /\bhtml\b/i, /next\.js/i, /\bvite\b/i, /tailwind/i, /\bdom\b/i, /ui component/i, /browser/i],
    "Design / UX": [/design/i, /\bux\b/i, /\bui\b/i, /user experience/i, /figma/i, /interface/i, /user centered/i, /human centered/i, /creative/i, /visual/i, /typography/i],
    "Mental Health": [/mental health/i, /burnout/i, /anxiety/i, /stress/i, /well-being/i, /therapy/i, /balance/i, /rest/i, /self-care/i, /overwhelmed/i, /mindfulness/i],
    "Work Culture": [/culture/i, /workplace/i, /toxic/i, /remote work/i, /hybrid/i, /office/i, /colleagues/i, /work environment/i, /employee experience/i, /\bpto\b/i, /work-life/i],
    "Motivation": [/motivation/i, /inspire/i, /mindset/i, /goal/i, /dream/i, /success/i, /failure/i, /keep going/i, /discipline/i, /consistency/i, /growth/i, /hustle/i],
    "Content Creation": [/content creation/i, /storytelling/i, /writing/i, /newsletter/i, /podcast/i, /youtube/i, /video/i, /hook/i, /viral/i, /audience/i, /creator economy/i, /vlog/i, /blog/i, /ghostwriting/i, /content strategy/i],
    "Finance / Investing": [/finance/i, /investing/i, /money/i, /wealth/i, /stock/i, /crypto/i, /market/i, /economy/i, /budget/i, /revenue/i, /profit/i, /\bvc\b/i, /capital/i, /real estate/i],
    "Sales": [/sales/i, /selling/i, /closing/i, /negotiation/i, /pipeline/i, /\bb2b\b/i, /outbound/i, /inbound/i, /cold call/i, /prospecting/i, /\bsdr\b/i, /quota/i, /client/i],
    "Freelancing": [/freelance/i, /client/i, /upwork/i, /fiverr/i, /contract/i, /service/i, /\boffer/i, /solopreneur/i, /consulting/i, /proposal/i, /rates/i],
    "Cybersecurity": [/cybersecurity/i, /hacker/i, /security/i, /infosec/i, /breach/i, /privacy/i, /phishing/i, /malware/i, /vulnerability/i, /penetration test/i],
    "Travel": [/travel/i, /trip/i, /trips/i, /vacation/i, /flight/i, /\bfly\b/i, /airport/i, /hotel/i, /adventure/i, /explore/i, /nomad/i, /tourist/i, /passport/i, /\bcity\b/i, /visit/i],
    "Personal Branding": [/personal brand/i, /reputation/i, /authority/i, /thought leader/i, /audience/i, /community/i, /network/i, /influence/i, /social proof/i],
    "Life Story": [/family/i, /husband/i, /wife/i, /kids/i, /baby/i, /\bmarriage\b/i, /parents/i, /growing up/i, /memories/i, /nostalgia/i, /home/i, /relationship/i, /struggle/i, /sibling/i],
    "Health & Wellness": [/health/i, /fitness/i, /gym/i, /workout/i, /nutrition/i, /diet/i, /sleep/i, /exercise/i, /biohack/i, /running/i, /marathon/i]
};

// Whole-word matching: /rest/ used to fire on "interest", /reach/ on "reached".
// Each plain keyword becomes \bkeyword(s|es|ed|ing|er|ers|ship)?\b; keywords too generic to signal a topic are dropped.
const GENERIC_KEYWORDS = new Set(['rest', 'reach', 'content', 'system', 'home', 'focus', 'team', 'goal', 'apply', 'service', 'scale']);
const toWholeWord = (re) => {
    const src = re.source;
    if (GENERIC_KEYWORDS.has(src)) return null;
    if (src.includes('\\b')) return re;
    const start = /^\w/.test(src) ? '\\b' : '';
    const end = /\w$/.test(src) ? '(?:s|es|ed|ing|er|ers|ship)?\\b' : '';
    return new RegExp(`${start}(?:${src})${end}`, re.flags);
};
const RULES = Object.fromEntries(
    Object.entries(RAW_RULES).map(([tag, patterns]) => [tag, patterns.map(toWholeWord).filter(Boolean)])
);

// Placeholder for Cloudflare Worker URL. User needs to replace this.
const CF_WORKER_URL = "https://linkedin-post-tagger-worker.iamabdulsamad2-0.workers.dev";

// In-memory map to dedup in-flight requests (PostID -> Promise)
const pendingRequests = new Map();

// In-memory Session Cache (cleared on refresh)
const SESSION_CACHE = new Map();

/**
 * Main function to get tags for a post.
 * @param {string} text - The raw text content of the post.
 * @param {string} postId - The unique ID of the post (URN).
 * @returns {Promise<{primaryTag: string, secondaryTag: string|null, confidence: number, source: 'rule'|'ai'}>}
 */
export async function getTagsForPost(text, postId) {
    if (!text) {
        return { primaryTag: "General", secondaryTag: null, confidence: 0, source: 'default' };
    }

    // 0. Check IN-MEMORY Session Cache (Fastest - survives scrolling remounts)
    if (postId && SESSION_CACHE.has(postId)) {
        return SESSION_CACHE.get(postId);
    }

    // 1. Check local cache first (FAST)
    if (postId) {
        const cached = await getFromCache(postId);
        // Only use cache if it was generated by AI (expensive). 
        // Always re-run rules (cheap) to allow for logic updates.
        if (cached && cached.source === 'ai') {
            // Backwards compatibility for cache
            if (cached.secondaryTag && (!cached.secondaryTags || cached.secondaryTags.length === 0)) {
                cached.secondaryTags = [cached.secondaryTag];
            }
            SESSION_CACHE.set(postId, cached); // Hydrate session cache
            return cached;
        }

        // 2. Check for in-flight request (Deduplication)
        // If another component (e.g. Analytics) is already fetching this tag, wait for it.
        if (pendingRequests.has(postId)) {
            // console.log(`[Tagging] Joining in-flight request for ${postId}`); // Optional debug
            return pendingRequests.get(postId);
        }
    }

    // 3. Create the processing promise
    const tagPromise = (async () => {
        try {
            // A. Rule-based tagging (Low Cost)
            const ruleResult = applyRuleBasedTags(text);

            // If confidence is high enough (3+ matches, >0.8), return immediately
            if (ruleResult.confidence > 0.8) {
                const result = { ...ruleResult, source: 'rule' };
                // NEVER cache rule results, so we can tweak rules and see changes instantly.
                // if (postId) saveToCache(postId, result); 

                if (postId) SESSION_CACHE.set(postId, result); // Cache in session
                return result;
            }

            // B. AI Embeddings Fallback (High Cost)
            // Only if configured and rules failed/low confidence
            if (CF_WORKER_URL) {
                try {
                    // console.log(`[Tagging] Calling AI for ${postId}...`);
                    const aiResult = await fetchAIEmbeddings(text, postId);
                    if (aiResult) {
                        const finalResult = { ...aiResult, source: 'ai' };
                        // Normalize AI result
                        if (finalResult.secondaryTag && (!finalResult.secondaryTags || finalResult.secondaryTags.length === 0)) {
                            finalResult.secondaryTags = [finalResult.secondaryTag];
                        }
                        // ONLY cache AI results persistent to disk
                        if (postId) saveToCache(postId, finalResult);

                        if (postId) SESSION_CACHE.set(postId, finalResult); // Cache in session
                        return finalResult;
                    }
                } catch (error) {
                    console.error("[Tagging] AI call failed:", error);
                }
            }

            // C. Fallback to low-confidence rule result or General
            const finalResult = ruleResult.primaryTag
                ? { ...ruleResult, source: 'rule_low_conf' }
                : { primaryTag: "General", secondaryTags: [], confidence: 0, source: 'default' };

            // Do not cache fallbacks either
            if (postId) SESSION_CACHE.set(postId, finalResult); // Cache in session
            return finalResult;

        } finally {
            // cleanup pending request
            if (postId) pendingRequests.delete(postId);
        }
    })();

    // Store promise in map
    if (postId) {
        pendingRequests.set(postId, tagPromise);
    }

    return tagPromise;
}

// --- Helpers ---

async function getFromCache(postId) {
    return new Promise((resolve) => {
        if (!chrome.storage || !chrome.storage.local) {
            resolve(null);
            return;
        }
        chrome.storage.local.get([`tag_${postId}`], (result) => {
            resolve(result[`tag_${postId}`] || null);
        });
    });
}

function saveToCache(postId, data) {
    if (!chrome.storage || !chrome.storage.local) return;
    const obj = {};
    obj[`tag_${postId}`] = data;
    chrome.storage.local.set(obj);
}

/**
 * Gets stats for a creator based on last 7 days of posts.
 * @param {string} creatorName 
 */
export async function getCreatorStats(creatorName) {
    if (!creatorName) return null;

    return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
            const logs = items.logs || [];
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const tagCounts = {};
            let totalPosts = 0;

            // Flatten posts
            const allPosts = [];
            logs.forEach(log => {
                if (log.extractedPosts) {
                    log.extractedPosts.forEach(post => {
                        // Check name match
                        const name = post.actor?.name?.text || post.creatorName;
                        if (name && name.toLowerCase() === creatorName.toLowerCase()) {
                            // Collect all posts for this creator
                            allPosts.push(post);
                        }
                    });
                }
            });

            // Sort by URN (Newest first) - URN typically increments with time or contains ID
            // Safe fallback if URN missing: keep logic simple
            allPosts.sort((a, b) => {
                const idA = a.urn ? extractTimeFromUrn(a.urn)?.getTime() || 0 : 0;
                const idB = b.urn ? extractTimeFromUrn(b.urn)?.getTime() || 0 : 0;
                return idB - idA;
            });

            // Take latest 7
            const recentPosts = allPosts.slice(0, 7);

            if (recentPosts.length === 0) {
                resolve(null);
                return;
            }

            // Count tags for these posts
            const promises = recentPosts.map(async (post) => {
                let tag = null;
                // Try cache key
                const urn = post.urn;
                if (urn && items[`tag_${urn}`]) {
                    tag = items[`tag_${urn}`].primaryTag;
                } else if (post.text) {
                    // Fallback to fast rule
                    const rule = applyRuleBasedTags(post.text);
                    if (rule.confidence > 0.4) tag = rule.primaryTag;
                }

                if (tag && tag !== 'General') {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    totalPosts++;
                }
            });

            Promise.all(promises).then(() => {
                // Find max
                let maxTag = null;
                let maxCount = 0;
                for (const [tag, count] of Object.entries(tagCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        maxTag = tag;
                    }
                }

                resolve({
                    topTag: maxTag,
                    count: maxCount,
                    totalAnalyzed: totalPosts
                });
            });
        });
    });
}

// Batching Globals
const AI_BATCH_QUEUE = [];
let AI_BATCH_TIMEOUT = null;
const BATCH_DELAY = 100; // ms
const MAX_BATCH_SIZE = 10;

// Update fetchAIEmbeddings to use batching
async function fetchAIEmbeddings(text, postId) {
    return new Promise((resolve, reject) => {
        // Add to queue
        AI_BATCH_QUEUE.push({
            text,
            postId, // Needed for mapping response back
            resolve,
            reject
        });

        // Schedule flush
        if (AI_BATCH_QUEUE.length >= MAX_BATCH_SIZE) {
            if (AI_BATCH_TIMEOUT) clearTimeout(AI_BATCH_TIMEOUT);
            flushAIBatch();
        } else if (!AI_BATCH_TIMEOUT) {
            AI_BATCH_TIMEOUT = setTimeout(flushAIBatch, BATCH_DELAY);
        }
    });
}

// Flush the batch
async function flushAIBatch() {
    AI_BATCH_TIMEOUT = null;
    if (AI_BATCH_QUEUE.length === 0) return;

    // formatting the queue for processing
    const batch = [...AI_BATCH_QUEUE];
    AI_BATCH_QUEUE.length = 0; // Clear global queue immediately

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        console.error("[Tagging] chrome.runtime.sendMessage not available");
        batch.forEach(item => item.resolve(null));
        return;
    }

    try {
        console.log(`[Tagging] Sending batch of ${batch.length} items to AI...`);

        // Send batch to background
        // Background will handle parallel processing or true batching
        chrome.runtime.sendMessage({
            action: "fetch_ai_tags_batch",
            items: batch.map(b => ({ text: b.text, id: b.postId }))
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("[Tagging] Runtime message error:", chrome.runtime.lastError.message || chrome.runtime.lastError);
                batch.forEach(item => item.resolve(null));
                return;
            }

            if (response && response.success && response.results) {
                // response.results should be a map: { [id]: { primaryTag: ... } }
                batch.forEach(item => {
                    const result = response.results[item.postId];
                    if (result) {
                        item.resolve(result);
                    } else {
                        // Fallback if no specific result
                        item.resolve(null);
                    }
                });
            } else {
                console.error("[Tagging] Batch failed:", response?.error);
                batch.forEach(item => item.resolve(null));
            }
        });
    } catch (e) {
        console.error("[Tagging] Flush Error:", e);
        batch.forEach(item => item.resolve(null));
    }
}

/**
 * Applies regex-based rules to find tags.
 * @param {string} text
 * @returns {{primaryTag: string|null, secondaryTag: string|null, confidence: number}}
 */
export function applyRuleBasedTags(text) {
    const scores = {};

    // Initialize scores
    TAGS.forEach(tag => scores[tag] = 0);

    // Split text into first line (title/hook) and body for weighting
    const lines = text.split('\n');
    const hook = lines[0] || "";
    const body = text;

    // Look for hashtags explicitly
    const hashtags = text.match(/#[a-z0-9]+/gi) || [];
    const hashtagText = hashtags.join(' ');

    // Apply rules with Math (Frequency * Weight)
    for (const [tag, patterns] of Object.entries(RULES)) {
        patterns.forEach(pattern => {
            // Create a global version of the regex to count all occurrences
            // We use 'pattern.source' and append 'g' to existing flags
            const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
            const regexGlobal = new RegExp(pattern.source, flags);

            // Count matches in different zones
            const bodyMatches = (body.match(regexGlobal) || []).length;
            const hookMatches = (hook.match(regexGlobal) || []).length;
            const hashtagMatches = (hashtagText.match(regexGlobal) || []).length;

            // Scoring Formula:
            // Body: +1 per mention (Volume acts as signal)
            // Hook: +3 per mention (High intent zone)
            // Hashtag: +5 per mention (Explicit categorization)

            if (bodyMatches > 0) {
                scores[tag] += (bodyMatches * 1);
            }
            // Add bonus for Hook (overlap with body is fine, we want to double dip for emphasis)
            if (hookMatches > 0) {
                scores[tag] += (hookMatches * 3);
            }
            // Add massive bonus for Hashtags
            if (hashtagMatches > 0) {
                scores[tag] += (hashtagMatches * 5);
            }
        });
    }

    // Sort tags by score
    const sortedTags = Object.entries(scores)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1]);

    if (sortedTags.length === 0) {
        return { primaryTag: null, secondaryTags: [], confidence: 0 };
    }

    const primary = sortedTags[0];
    const secondaryTags = sortedTags.slice(1).map(t => t[0]);

    // Enhanced Accuracy Confidence Calculation
    // Score > 5 means very strong signal (e.g. 1 hashtag OR 2 hook mentions OR 5 body mentions)
    let confidence = 0.4;
    const score = primary[1];

    if (score >= 3) confidence = 0.6;
    if (score >= 6) confidence = 0.85;
    if (score >= 10) confidence = 0.95;

    // Debug log for tuning
    // console.log(`[Tagging Math] Top: ${primary[0]} (Score: ${score}), 2nd: ${sortedTags[1]?.[0]}`);

    return {
        primaryTag: primary[0],
        secondaryTags: secondaryTags,
        confidence
    };
}

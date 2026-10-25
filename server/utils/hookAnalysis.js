const { extractTimeFromUrn } = require('./timeUtils');
const { WEIGHTS, MIN_BASELINE_POSTS } = require('./viralScoreEngine');

// --- CONSTANTS ---
const MIN_HOURS = 1;
const MAX_VIRAL_WINDOW_HOURS = 72;
const MIN_ENGAGEMENT_THRESHOLD = 5;
const MIN_AGE_HOURS = 2;
const MIN_PATTERN_POSTS = 3; // a pattern needs this many posts before it gets a lift verdict or badge

const median = (values) => {
    const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (xs.length === 0) return null;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

const creatorKeyOf = (post) => post.creatorKey || post.profileUrn || post.creatorName || 'unknown';

const calculateEngagementMetrics = (post) => {
    const stats = post.stats || {};
    const likes = Number(stats.likes) || 0;
    const comments = Number(stats.comments) || 0;
    const shares = Number(stats.reposts) || 0;

    // Same score as src/utils/metrics.js and viralScoreEngine.js
    const totalEngagement = likes * WEIGHTS.likes + comments * WEIGHTS.comments + shares * WEIGHTS.reposts;

    let hoursSincePublished = MIN_HOURS;
    let rawAgeHours = MIN_HOURS;

    if (post.urn) {
        const publishedDate = extractTimeFromUrn(post.urn);
        if (publishedDate) {
            const now = new Date();
            const diffMs = now - publishedDate;
            const diffHours = diffMs / (1000 * 60 * 60);

            rawAgeHours = diffHours;
            hoursSincePublished = Math.min(Math.max(diffHours, MIN_HOURS), MAX_VIRAL_WINDOW_HOURS);
        }
    }

    const engagementVelocity = totalEngagement / hoursSincePublished;

    const followerCount = post.authorDetails?.followerCount || null;
    let normalizedVelocity = engagementVelocity;

    if (followerCount && followerCount > 0) {
        normalizedVelocity = engagementVelocity / followerCount;
    }

    return {
        totalEngagement,
        hoursSincePublished,
        rawAgeHours,
        engagementVelocity,
        normalizedVelocity,
        hasFollowerData: !!followerCount,
        publishedDate: post.urn ? extractTimeFromUrn(post.urn) : null
    };
};

const filterViablePosts = (postsWithMetrics, timeframe) => {
    return postsWithMetrics.filter(post => {
        const m = post.metrics;

        if (m.totalEngagement < MIN_ENGAGEMENT_THRESHOLD) return false;

        const hours24 = 24;

        if (timeframe === 'long_term') {
            if (m.rawAgeHours < 168) return false;
            return true;
        }

        if (timeframe === 'short_term') {
            if (m.rawAgeHours > 2160) return false;
            if (m.rawAgeHours < MIN_AGE_HOURS) return false;
            return true;
        }

        if (timeframe === '30d') return m.rawAgeHours <= 30 * hours24;
        if (timeframe === '60d') return m.rawAgeHours <= 60 * hours24;
        if (timeframe === '90d') return m.rawAgeHours <= 90 * hours24;
        if (timeframe === 'all') return true;

        if (typeof timeframe === 'object' && timeframe.start && timeframe.end) {
            const postDate = m.publishedDate;
            if (!postDate) return false;

            const start = new Date(timeframe.start).getTime();
            const end = new Date(timeframe.end).getTime();
            const endOfDay = end + (24 * 60 * 60 * 1000) - 1;

            return postDate >= start && postDate <= endOfDay;
        }

        return true;
    });
};

const getHook = (text) => {
    if (!text) return "";
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return "";
    if (lines.length === 1) return lines[0];
    return lines[0] + "\n" + lines[1];
};

const analyzeHook = (hookText) => {
    const types = [];
    const cleanHook = hookText.toLowerCase();

    if (cleanHook.includes('?') || /^(do|does|did|is|are|can|could|would|should|who|what|where|when|why|how)\b/.test(cleanHook)) {
        types.push('Question');
    }

    if (/\d+/.test(cleanHook) && /\b(tips|steps|ways|reasons|lessons|mistakes|rules|tools|habits|ideas|examples)\b/.test(cleanHook)) {
        types.push('Listicle');
    }

    if (/\b(stop|don't|never|quit|avoid|fail|worst|waste|trap|lie|hate|wrong|useless|dead)\b/.test(cleanHook)) {
        types.push('Contrarian / Warning');
    }

    if (/\b(how to|guide|tutorial|blueprint|cheat sheet|checklist|roadmap|strategy|framework|masterclass|solved)\b/.test(cleanHook)) {
        types.push('Educational / Value');
    }

    if (/\b(years?|months?|weeks?|days?|hours?|ago|changed|transformed|grew|scaled|earned|generated|\$| revenue)\b/.test(cleanHook)) {
        types.push('Result / Transformation');
    }

    if (/\b(i|my|me|we|our)\b/.test(cleanHook)) {
        if (!types.includes('Educational / Value')) {
            types.push('Personal Story');
        }
    }

    if (hookText.trim().endsWith(':') || hookText.includes('👇') || hookText.includes('🧵')) {
        types.push('Visual Teaser');
    }

    if (types.length === 0 && hookText.length < 50) {
        types.push('Punchy Statement');
    }

    if (types.length === 0) types.push('Observation');

    const len = hookText.length;
    let lengthCategory = 'Medium';
    if (len <= 80) lengthCategory = 'Short';
    else if (len > 200) lengthCategory = 'Long';

    const hasEmoji = /\p{Emoji}/u.test(hookText);
    const startsWithNumber = /^\d/.test(hookText.trim());
    const startsWithQuestion = /^(who|what|where|when|why|how|are|is|do|does|did|can|could|would|should)\b/i.test(hookText.trim());

    return {
        text: hookText,
        types,
        lengthCategory,
        formatting: {
            hasEmoji,
            startsWithNumber,
            startsWithQuestion
        }
    };
};

const analyzeFormat = (fullText, hookText) => {
    if (!fullText) return {
        lineCount: 0, whitespaceDensity: 0, formatType: 'Paragraph', ctaType: 'No CTA', emojisBeyondHook: false
    };

    const lines = fullText.split('\n');
    const nonEmptyLines = lines.map(l => l.trim()).filter(l => l.length > 0);

    const totalLineCount = nonEmptyLines.length;
    const shortLines = nonEmptyLines.filter(l => l.length < 50).length;
    const longLines = nonEmptyLines.filter(l => l.length > 120).length;
    const lineStyle = shortLines > totalLineCount * 0.6 ? 'Mostly Short' : (longLines > totalLineCount * 0.6 ? 'Mostly Long' : 'Mixed');

    const totalChars = fullText.length;
    const whitespaceScore = totalChars > 0 ? (lines.length / totalChars) : 0;

    let formatType = 'Paragraph';
    const listItems = nonEmptyLines.filter(l => /^[•\-\d+\.]/.test(l));
    if (listItems.length > 3) formatType = 'List-based';
    else if (listItems.length > 0) formatType = 'Mixed';

    let ctaType = 'No CTA';
    const lastLines = nonEmptyLines.slice(-3).join(' ').toLowerCase();
    if (lastLines.includes('comment') || lastLines.includes('dm') || lastLines.includes('follow') || lastLines.includes('link')) {
        ctaType = 'Hard CTA';
    } else if (lastLines.includes('?') || lastLines.includes('thought') || lastLines.includes('agree')) {
        ctaType = 'Soft CTA';
    }

    const textBeyondHook = fullText.replace(hookText, '');
    const emojisBeyondHook = /\p{Emoji}/u.test(textBeyondHook);

    return {
        lineCount: totalLineCount,
        lineStyle,
        whitespaceScore,
        formatType,
        ctaType,
        emojisBeyondHook
    };
};

const generateFingerprint = (hookAnalysis, formatAnalysis) => {
    const parts = [
        hookAnalysis.types.join(' + '),
        `${hookAnalysis.lengthCategory} Hook`,
        hookAnalysis.formatting.hasEmoji ? 'Emoji' : 'No Emoji',
        `${formatAnalysis.lineStyle} Lines`,
        formatAnalysis.formatType,
        formatAnalysis.ctaType !== 'No CTA' ? 'CTA' : 'No CTA'
    ];

    return parts.join(' | ');
};

const generateTemplate = (text, analysis) => {
    if (!text) return "";

    const lines = text.split('\n');
    return lines.map(line => {
        let l = line.trim();
        if (l.length === 0) return "";

        l = l.replace(/\d+(?:,\d+)*(?:\.\d+)?/g, '{N}');

        if (l.length < 60) {
            return l;
        }

        const opener = l.split(' ').slice(0, 5).join(' ');
        return `${opener} {details...}`;
    }).join('\n');
};

const analyzePatterns = (posts, timeframe = 'short_term') => {
    const enrichedPosts = posts.map(post => {
        const metrics = calculateEngagementMetrics(post, timeframe);
        return { ...post, metrics };
    });

    const viablePosts = filterViablePosts(enrichedPosts, timeframe);

    // Analyze the most recent 200 posts. (Sorting by velocity favoured posts that were only hours old.)
    const byNewest = (a, b) => (b.metrics.publishedDate?.getTime() || 0) - (a.metrics.publishedDate?.getTime() || 0);
    const topPosts = [...viablePosts].sort(byNewest).slice(0, 200);

    // Per-creator median baseline → lift for each post (null without MIN_BASELINE_POSTS posts)
    const scoresByCreator = new Map();
    topPosts.forEach(p => {
        const k = creatorKeyOf(p);
        if (!scoresByCreator.has(k)) scoresByCreator.set(k, []);
        scoresByCreator.get(k).push(p.metrics.totalEngagement);
    });
    const baselineByCreator = new Map();
    scoresByCreator.forEach((scores, k) => {
        if (scores.length >= MIN_BASELINE_POSTS) baselineByCreator.set(k, median(scores));
    });
    topPosts.forEach(p => {
        const base = baselineByCreator.get(creatorKeyOf(p));
        p.metrics.lift = base > 0 ? p.metrics.totalEngagement / base : null;
    });

    const analyzedPosts = topPosts.map(post => {
        const text = post.text || "";
        const hookText = getHook(text);
        const hookAnalysis = analyzeHook(hookText);
        const formatAnalysis = analyzeFormat(text, hookText);
        const fingerprint = generateFingerprint(hookAnalysis, formatAnalysis);

        return {
            ...post,
            analysis: {
                hook: hookAnalysis,
                format: formatAnalysis,
                fingerprint
            }
        };
    });

    const groups = {};
    analyzedPosts.forEach(post => {
        const primaryHook = post.analysis.hook.types[0] || 'Other';
        const primaryFormat = post.analysis.format.formatType;
        const broadFingerprint = `${primaryHook} ${primaryFormat}`;

        if (!groups[broadFingerprint]) {
            groups[broadFingerprint] = {
                fingerprint: broadFingerprint,
                posts: [],
                totalVelocity: 0,
                totalEngagement: 0,
                count: 0,
                traits: {
                    emojis: 0,
                    shortHook: 0,
                    mediumHook: 0,
                    longHook: 0,
                    cta: 0
                }
            };
        }
        const g = groups[broadFingerprint];
        g.posts.push(post);
        g.totalVelocity += post.metrics.normalizedVelocity;
        g.totalEngagement += post.metrics.totalEngagement;
        g.count += 1;

        if (post.analysis.hook.formatting.hasEmoji) g.traits.emojis++;
        if (post.analysis.hook.lengthCategory === 'Short') g.traits.shortHook++;
        if (post.analysis.hook.lengthCategory === 'Medium') g.traits.mediumHook++;
        if (post.analysis.hook.lengthCategory === 'Long') g.traits.longHook++;
        if (post.analysis.format.ctaType !== 'No CTA') g.traits.cta++;
    });

    const patterns = Object.values(groups).map(group => {
        const emojiCount = group.traits.emojis;
        const noEmojiCount = group.count - emojiCount;

        const shortCount = group.traits.shortHook;
        const mediumCount = group.traits.mediumHook;
        const longCount = group.traits.longHook;

        const traitLabels = [];

        if (emojiCount >= noEmojiCount) traitLabels.push('Emoji Used 🎨');
        else traitLabels.push('Clean Text 📄');

        if (shortCount >= mediumCount && shortCount >= longCount) traitLabels.push('Short Hooks ⚡');
        else if (mediumCount >= shortCount && mediumCount >= longCount) traitLabels.push('Medium Hooks 📝');
        else traitLabels.push('Long Hooks 📖');

        if (group.traits.cta > 0) traitLabels.push('Includes CTA 📣');

        const displayFingerprint = `${group.fingerprint} | ${traitLabels.join(' | ')}`;

        const lifts = group.posts.map(p => p.metrics.lift).filter(l => l !== null);
        return {
            ...group,
            displayFingerprint,
            avgVelocity: group.totalVelocity / group.count,
            medianEngagement: median(group.posts.map(p => p.metrics.totalEngagement)),
            medianLift: lifts.length ? median(lifts) : null,
            hasEnoughData: group.count >= MIN_PATTERN_POSTS && lifts.length >= MIN_PATTERN_POSTS
        };
    });

    // Patterns with enough posts ranked by median lift first; the rest follow by how often they're used
    patterns.sort((a, b) => {
        if (a.hasEnoughData !== b.hasEnoughData) return a.hasEnoughData ? -1 : 1;
        if (a.hasEnoughData) return b.medianLift - a.medianLift;
        return b.count - a.count;
    });
    const byUsage = [...patterns].sort((a, b) => b.count - a.count);

    const totalAnalyzed = topPosts.length;
    let creatorType = 'Varied / Testing';
    let consistencyScore = 0;

    if (totalAnalyzed >= 15 && patterns.length > 0) {
        const top3Patterns = byUsage.slice(0, 3);
        const top3Count = top3Patterns.reduce((sum, p) => sum + p.count, 0);
        const playbookScore = top3Count / totalAnalyzed;

        const top1Count = byUsage[0].count;
        const signatureScore = top1Count / totalAnalyzed;

        if (playbookScore >= 0.40) {
            creatorType = 'Consistent Strategy';
            consistencyScore = playbookScore;
        } else if (signatureScore >= 0.15 && top1Count >= 3) {
            creatorType = 'Consistent Strategy';
            consistencyScore = signatureScore;
        }
    } else if (totalAnalyzed > 0 && totalAnalyzed < 15) {
        creatorType = 'Analyzing Style...';
    }

    const top5Patterns = patterns.slice(0, 5);

    const top5PatternsWithBadges = top5Patterns.map(pattern => {
        const bestPost = [...pattern.posts].sort((a, b) => b.metrics.totalEngagement - a.metrics.totalEngagement)[0];
        const template = generateTemplate(bestPost.text, bestPost.analysis);

        const badges = [];
        // Lift vs the creator's median (1.0 = typical post); null until the pattern has enough posts
        const efficiencyScore = pattern.hasEnoughData ? pattern.medianLift : null;
        const frequency = (pattern.count / topPosts.length) * 100;

        if (efficiencyScore !== null) {
            if (efficiencyScore >= 1.2 && frequency < 20) {
                badges.push({ text: 'Hidden Gem', icon: 'Gem', color: '#a855f7', bg: '#f3e8ff', tooltip: `${efficiencyScore.toFixed(1)}× the median, used in only ${frequency.toFixed(0)}% of posts. Scale this up.` });
            }
            if (efficiencyScore >= 2) {
                badges.push({ text: 'Viral Potential', icon: 'Zap', color: '#eab308', bg: '#fef9c3', tooltip: `${efficiencyScore.toFixed(1)}× the median engagement.` });
            }
            if (frequency >= 20 && efficiencyScore >= 0.8) {
                badges.push({ text: 'Reliable Staple', icon: 'ShieldCheck', color: '#15803d', bg: '#dcfce7', tooltip: `Used in ${frequency.toFixed(0)}% of posts at ${efficiencyScore.toFixed(1)}× the median.` });
            }
        }

        return {
            name: `${bestPost.analysis.hook.types[0]} ${bestPost.analysis.format.formatType}`,
            fingerprint: pattern.fingerprint,
            displayFingerprint: pattern.displayFingerprint,
            stats: {
                avgVelocity: pattern.avgVelocity.toFixed(2),
                // Median engagement score (likes + 3×comments + 4×reposts); key kept for client compatibility
                avgEngagement: (pattern.medianEngagement || 0).toFixed(0),
                medianLift: pattern.medianLift === null ? null : pattern.medianLift.toFixed(2),
                hasEnoughData: pattern.hasEnoughData,
                totalVelocity: pattern.totalVelocity.toFixed(2),
                count: pattern.count,
                frequency: frequency.toFixed(1),
                efficiencyScore: efficiencyScore === null ? null : efficiencyScore.toFixed(2),
                posts: pattern.posts
            },
            badges,
            description: {
                hookType: pattern.posts[0].analysis.hook.types.join(', '),
                format: pattern.posts[0].analysis.format.formatType,
                cta: pattern.posts[0].analysis.format.ctaType
            },
            template
        };
    });

    return {
        patterns: top5PatternsWithBadges,
        // Hook type + format for every analyzed post, so the client can explain any single post
        postTypes: Object.fromEntries(analyzedPosts.filter(p => p.urn).map(p => [p.urn, { hook: p.analysis.hook.types[0] || 'Other', format: p.analysis.format.formatType }])),
        meta: {
            creatorType,
            consistencyScore: consistencyScore.toFixed(2),
            totalAnalyzed
        }
    };
};

module.exports = { analyzePatterns, calculateEngagementMetrics };

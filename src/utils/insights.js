// src/utils/insights.js
// What drives performance for a creator: breakdowns by format, topic, opening, length and timing,
// cadence, engagement mix, and a per-post explanation. Pure functions on top of metrics.js.

import { applyRuleBasedTags } from './taggingService.js';
import { hookLabel } from './patternNames.js';
import {
    counts, engagementScore, interactions, postDate, postTime, median, groupByLift,
    MIN_GROUP_POSTS,
} from './metrics.js';

const DAY = 24 * 60 * 60 * 1000;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
export const TIME_BLOCKS = [0, 3, 6, 9, 12, 15, 18, 21];

const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
export const blockLabel = (start) => `${hourLabel(start)}–${hourLabel((start + 3) % 24)}`;

// --- Post attributes -----------------------------------------------------------------------

export const formatOf = (post) => {
    const types = (post.media || []).map(m => m && m.type);
    if (types.includes('carousel')) return 'Carousel';
    if (types.includes('video')) return 'Video';
    if (types.includes('image')) return 'Image';
    return 'Text';
};

export const wordCount = (post) => (post.text || '').trim().split(/\s+/).filter(Boolean).length;
export const LENGTHS = ['Short (<100 words)', 'Medium (100–250)', 'Long (250+)'];
export const lengthOf = (post) => {
    const w = wordCount(post);
    return w < 100 ? LENGTHS[0] : w < 250 ? LENGTHS[1] : LENGTHS[2];
};

const topicCache = new Map();
export const topicOf = (post) => {
    const key = post.urn || post.text;
    if (topicCache.has(key)) return topicCache.get(key);
    const t = post.text ? applyRuleBasedTags(post.text).primaryTag : null;
    const topic = t && t !== 'General' ? t : null;
    topicCache.set(key, topic);
    return topic;
};

/** Opening (hook) type for a post, from the server's per-post analysis. */
export const openingOf = (post, postTypes) => {
    const t = postTypes && post.urn ? postTypes[post.urn] : null;
    return t ? hookLabel(t.hook) : null;
};

export const hookLine = (post) => (post.text || '').split('\n').map(s => s.trim()).find(Boolean) || 'Untitled post';

// --- Breakdowns ------------------------------------------------------------------------------

/**
 * Rows for one dimension, best first. Each row: { key, n, share, medianLift, enough }.
 * Rows below the minimum sample are kept (shown greyed out) but never ranked as best.
 */
export const breakdown = (scored, keyFn) => {
    const { rows } = groupByLift(scored, keyFn);
    const total = scored.length || 1;
    return rows
        .map(r => ({ key: r.key, n: r.n, share: r.n / total, medianLift: r.medianLift, enough: r.enough }))
        .sort((a, b) => (b.enough - a.enough) || ((b.medianLift ?? -1) - (a.medianLift ?? -1)) || (b.n - a.n));
};

export const contentDrivers = (scored, postTypes) => ({
    format: breakdown(scored, formatOf),
    topic: breakdown(scored, topicOf),
    opening: breakdown(scored, p => openingOf(p, postTypes)),
    length: breakdown(scored, lengthOf),
});

/** 7 × 8 grid (Monday first, 3-hour blocks) of { n, lift } using the viewer's local time. */
export const timingGrid = (scored) => {
    const cells = WEEK_ORDER.map(d => TIME_BLOCKS.map(b => ({ day: d, block: b, posts: [] })));
    scored.forEach(p => {
        const dt = postDate(p);
        if (!dt) return;
        const row = WEEK_ORDER.indexOf(dt.getDay());
        const col = Math.floor(dt.getHours() / 3);
        cells[row][col].posts.push(p);
    });
    return cells.map(row => row.map(c => {
        const lifts = c.posts.map(p => p.lift).filter(l => l != null);
        return { day: c.day, block: c.block, n: c.posts.length, lift: lifts.length ? median(lifts) : null };
    }));
};

export const bestTiming = (scored) => {
    const dated = scored.filter(p => postDate(p));
    const day = groupByLift(dated, p => postDate(p).getDay()).best;
    const block = groupByLift(dated, p => Math.floor(postDate(p).getHours() / 3) * 3).best;
    return {
        day: day ? { label: DAY_NAMES[day.key], lift: day.medianLift, n: day.n } : null,
        block: block ? { label: blockLabel(block.key), lift: block.medianLift, n: block.n } : null,
    };
};

// --- Cadence & mix ---------------------------------------------------------------------------

/** Posting rhythm over the last `weeks` weeks. */
export const cadence = (posts, now = Date.now(), weeks = 12) => {
    const times = posts.map(postTime).filter(t => t !== null).sort((a, b) => a - b);
    const perWeek = Array.from({ length: weeks }, (_, i) => {
        const end = now - (weeks - 1 - i) * 7 * DAY, start = end - 7 * DAY;
        return times.filter(t => t > start && t <= end).length;
    });
    const recent = times.filter(t => now - t <= weeks * 7 * DAY);
    let longestGap = 0;
    for (let i = 1; i < recent.length; i++) longestGap = Math.max(longestGap, recent[i] - recent[i - 1]);
    const activeWeeks = perWeek.filter(n => n > 0).length;
    return {
        perWeek,
        avgPerWeek: recent.length / weeks,
        longestGapDays: recent.length > 1 ? Math.round(longestGap / DAY) : null,
        activeWeeks,
        daysSinceLast: times.length ? Math.floor((now - times[times.length - 1]) / DAY) : null,
    };
};

/** Share of raw interactions that are likes, comments and reposts. */
export const engagementMix = (posts) => {
    const t = posts.reduce((acc, p) => {
        const c = counts(p);
        acc.likes += c.likes; acc.comments += c.comments; acc.reposts += c.reposts;
        return acc;
    }, { likes: 0, comments: 0, reposts: 0 });
    const total = t.likes + t.comments + t.reposts;
    if (!total) return null;
    return { ...t, total, likesShare: t.likes / total, commentsShare: t.comments / total, repostsShare: t.reposts / total };
};

// --- One post, explained -----------------------------------------------------------------------

/**
 * Compares a post's attributes with the creator's breakdowns.
 * Returns rows { label, value, groupLift, enough } — groupLift is how that attribute performs in general.
 */
export const explainPost = (post, drivers, postTypes) => {
    const find = (rows, key) => rows.find(r => r.key === key);
    const dt = postDate(post);
    const rows = [
        { label: 'Opening', value: openingOf(post, postTypes), rows: drivers.opening },
        { label: 'Topic', value: topicOf(post), rows: drivers.topic },
        { label: 'Format', value: formatOf(post), rows: drivers.format },
        { label: 'Length', value: lengthOf(post), rows: drivers.length },
    ].map(({ label, value, rows: r }) => {
        const row = value ? find(r, value) : null;
        return { label, value: value || '—', groupLift: row && row.enough ? row.medianLift : null };
    });
    if (dt) rows.push({ label: 'Posted', value: `${DAY_NAMES[dt.getDay()].slice(0, 3)} ${blockLabel(Math.floor(dt.getHours() / 3) * 3)}`, groupLift: null });
    return rows;
};

// --- Creator summary (archetype) -------------------------------------------------------------

export const creatorArchetype = (scored, now = Date.now()) => {
    if (scored.length < 5) return null;
    const total = scored.reduce((s, p) => s + engagementScore(p), 0);
    const commentShare = total ? scored.reduce((s, p) => s + counts(p).comments * 3, 0) / total : 0;
    const topics = breakdown(scored, topicOf);
    const topTopic = [...topics].sort((a, b) => b.n - a.n)[0];
    const perWeek = cadence(scored, now, 4).avgPerWeek;
    if (commentShare >= 0.4) return { name: 'Conversation starter', detail: `${Math.round(commentShare * 100)}% of engagement is comments` };
    if (topTopic && topTopic.share >= 0.4) return { name: 'Specialist', detail: `${Math.round(topTopic.share * 100)}% of posts are about ${topTopic.key}` };
    if (perWeek >= 4) return { name: 'Prolific publisher', detail: `${perWeek.toFixed(1)} posts a week` };
    return { name: 'Generalist', detail: `${topics.length} topics · ${perWeek.toFixed(1)} posts a week` };
};

export const viralRate = (scored) => {
    const known = scored.filter(p => p.lift != null);
    return known.length ? known.filter(p => p.lift >= 2).length / known.length : null;
};

export { interactions, MIN_GROUP_POSTS };

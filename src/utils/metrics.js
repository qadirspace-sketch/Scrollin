// src/utils/metrics.js
// Single definition of how Scrollin measures post performance.
// Pure functions only (no React / chrome) so they can be tested with `node --test`.
// The server mirrors these rules in server/utils/viralScoreEngine.js and hookAnalysis.js;
// keep WEIGHTS, the baseline rule and thresholds in sync with those files.

import { extractTimeFromUrn, parseRelativeDateToDate } from './timeUtils.js';

export const WEIGHTS = { likes: 1, comments: 3, reposts: 4 };
export const MIN_BASELINE_POSTS = 5;   // posts needed before a creator has a baseline
export const MIN_GROUP_POSTS = 3;      // posts needed before a group (day, topic, pattern) gets a verdict
export const BASELINE_WINDOW_DAYS = 90;
export const VIRAL = 2;                // lift ≥ 2× median
export const HIGHLY_VIRAL = 3;         // lift ≥ 3× median

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (v) => {
    const n = typeof v === 'string' ? parseInt(v.replace(/,/g, ''), 10) : Number(v);
    return Number.isFinite(n) ? n : 0;
};

export const counts = (post) => ({
    likes: num(post?.stats?.likes ?? post?.likes),
    comments: num(post?.stats?.comments ?? post?.comments),
    reposts: num(post?.stats?.reposts ?? post?.reposts),
});

/** likes + 3×comments + 4×reposts */
export const engagementScore = (post) => {
    const c = counts(post);
    return c.likes * WEIGHTS.likes + c.comments * WEIGHTS.comments + c.reposts * WEIGHTS.reposts;
};

/** Raw interactions (likes + comments + reposts), for "how many people reacted" style totals. */
export const interactions = (post) => {
    const c = counts(post);
    return c.likes + c.comments + c.reposts;
};

/** Real view count, or null when LinkedIn didn't provide one (anyone but the logged-in user). */
export const views = (post) => {
    const v = post?.stats?.views;
    return v === undefined || v === null || v === '' ? null : num(v);
};

/** Publish time from the URN snowflake; LinkedIn's frozen relative text only as a fallback. */
export const postDate = (post) => {
    if (!post) return null;
    if (post.urn) {
        const d = extractTimeFromUrn(post.urn);
        if (d) return d;
    }
    if (post.createdAt) {
        const d = new Date(post.createdAt);
        if (!isNaN(d.getTime())) return d;
    }
    if (post.date) return parseRelativeDateToDate(post.date);
    return null;
};

export const postTime = (post) => postDate(post)?.getTime() ?? null;

/** "5m", "3h", "4d", "2w", "5mo", "1y" — computed from the publish time, never stale. */
export const formatAgo = (date, now = Date.now()) => {
    if (!date) return null;
    const diff = Math.max(0, now - date.getTime());
    const min = diff / 60000;
    if (min < 60) return `${Math.max(1, Math.floor(min))}m`;
    const h = min / 60;
    if (h < 24) return `${Math.floor(h)}h`;
    const d = h / 24;
    if (d < 7) return `${Math.floor(d)}d`;
    if (d < 30) return `${Math.floor(d / 7)}w`;
    if (d < 365) return `${Math.floor(d / 30)}mo`;
    return `${Math.floor(d / 365)}y`;
};

export const median = (values) => {
    const xs = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (xs.length === 0) return null;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

export const creatorKey = (post) => post?.creatorKey || post?.profileUrn || post?.creatorName || 'unknown';

/**
 * Per-creator baseline: median score of the creator's posts from the last 90 days,
 * or of all their posts when fewer than MIN_BASELINE_POSTS are recent.
 * Returns Map<creatorKey, { median, n }>; creators without enough posts are absent.
 */
export const buildBaselines = (posts, now = Date.now()) => {
    const byCreator = new Map();
    for (const p of posts || []) {
        const k = creatorKey(p);
        if (!byCreator.has(k)) byCreator.set(k, []);
        byCreator.get(k).push(p);
    }
    const baselines = new Map();
    for (const [k, list] of byCreator) {
        const recent = list.filter(p => {
            const t = postTime(p);
            return t !== null && now - t <= BASELINE_WINDOW_DAYS * DAY_MS;
        });
        const sample = recent.length >= MIN_BASELINE_POSTS ? recent : list;
        if (sample.length < MIN_BASELINE_POSTS) continue;
        const m = median(sample.map(engagementScore));
        if (m !== null) baselines.set(k, { median: m, n: sample.length });
    }
    return baselines;
};

/** Lift = score ÷ creator median; null when the creator has no baseline (or a zero median). */
export const liftFor = (post, baselines) => {
    const b = baselines.get(creatorKey(post));
    if (!b || !(b.median > 0)) return null;
    return engagementScore(post) / b.median;
};

/** Returns posts annotated with { score, lift, viralLabel, publishedAt }. Does not mutate input. */
export const withLift = (posts, now = Date.now()) => {
    const baselines = buildBaselines(posts, now);
    return (posts || []).map(p => {
        const lift = liftFor(p, baselines);
        return { ...p, score: engagementScore(p), lift, viralLabel: viralLabel(lift), publishedAt: postTime(p) };
    });
};

export const viralLabel = (lift) => {
    if (lift === null || lift === undefined) return null;
    if (lift >= HIGHLY_VIRAL) return 'Highly Viral';
    if (lift >= VIRAL) return 'Viral';
    return 'Normal';
};

export const formatLift = (lift) => (lift === null || lift === undefined ? null : `${lift >= 10 ? Math.round(lift) : lift.toFixed(1)}×`);

/** Current and previous windows of equal length, e.g. last 7 days and the 7 before. */
export const periodWindows = (days, now = Date.now()) => ({
    current: { start: now - days * DAY_MS, end: now },
    previous: { start: now - 2 * days * DAY_MS, end: now - days * DAY_MS },
});

export const inWindow = (posts, win) => (posts || []).filter(p => {
    const t = postTime(p);
    return t !== null && t > win.start && t <= win.end;
});

/** % change, or null when either side lacks data (prev must be > 0). */
export const pctChange = (curr, prev) => {
    if (curr === null || prev === null || prev === undefined || !(prev > 0)) return null;
    return ((curr - prev) / prev) * 100;
};

/**
 * Trend of a per-post quality metric (median score) between equal windows.
 * Hidden (null) unless both windows have MIN_GROUP_POSTS posts.
 */
export const medianTrend = (posts, days, now = Date.now(), valueFn = engagementScore) => {
    const w = periodWindows(days, now);
    const curr = inWindow(posts, w.current);
    const prev = inWindow(posts, w.previous);
    const currMedian = curr.length ? median(curr.map(valueFn)) : null;
    const prevMedian = prev.length ? median(prev.map(valueFn)) : null;
    const enough = curr.length >= MIN_GROUP_POSTS && prev.length >= MIN_GROUP_POSTS;
    return {
        current: currMedian, previous: prevMedian, nCurrent: curr.length, nPrevious: prev.length,
        change: enough ? pctChange(currMedian, prevMedian) : null,
    };
};

/**
 * Group posts and rank groups by median lift. Groups below minN are returned with
 * enough=false and never ranked as "best". Posts must already carry `lift` (see withLift).
 */
export const groupByLift = (posts, keyFn, minN = MIN_GROUP_POSTS) => {
    const groups = new Map();
    for (const p of posts || []) {
        const k = keyFn(p);
        if (k === null || k === undefined) continue;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(p);
    }
    const rows = [...groups].map(([key, list]) => {
        const lifts = list.map(p => p.lift).filter(l => l !== null && l !== undefined);
        return {
            key, n: list.length, posts: list,
            medianScore: median(list.map(engagementScore)),
            medianLift: lifts.length ? median(lifts) : null,
            enough: list.length >= minN && lifts.length >= minN,
        };
    });
    const ranked = rows.filter(r => r.enough).sort((a, b) => b.medianLift - a.medianLift);
    return { rows, ranked, best: ranked[0] || null };
};

/** Group with the most posts (activity, not performance). */
export const mostActive = (posts, keyFn) => {
    const c = new Map();
    for (const p of posts || []) {
        const k = keyFn(p);
        if (k === null || k === undefined) continue;
        c.set(k, (c.get(k) || 0) + 1);
    }
    let best = null;
    for (const [key, n] of c) if (!best || n > best.n) best = { key, n };
    return best;
};

export const formatPct = (pct) => (pct === null || pct === undefined ? null : `${pct >= 0 ? '+' : ''}${pct.toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`);

/** Summary of one creator's captured posts: volume, median quality and a 30-day trend. */
export const creatorSummary = (posts, now = Date.now()) => {
    const list = posts || [];
    const trend = medianTrend(list, 30, now);
    return {
        postsCount: list.length,
        medianScore: median(list.map(engagementScore)),
        postsLast30: inWindow(list, periodWindows(30, now).current).length,
        trendChange: trend.change, // % change in median score vs the previous 30 days, or null
    };
};

// Viral labelling. Mirrors src/utils/metrics.js — keep WEIGHTS, the baseline rule
// (median of the creator's last 90 days, or all posts when fewer than 5 are recent;
// no baseline below 5 posts) and the 2×/3× thresholds in sync with that file.

const WEIGHTS = { likes: 1, comments: 3, reposts: 4 };
const MIN_BASELINE_POSTS = 5;
const BASELINE_WINDOW_DAYS = 90;
const VIRAL = 2;
const HIGHLY_VIRAL = 3;
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const score = (p) =>
    (Number(p.likes) || 0) * WEIGHTS.likes +
    (Number(p.comments) || 0) * WEIGHTS.comments +
    (Number(p.reposts) || 0) * WEIGHTS.reposts;

const median = (values) => {
    const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (xs.length === 0) return null;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

const timeOf = (p) => {
    const t = new Date(p.createdAt).getTime();
    return Number.isFinite(t) && t > 0 ? t : null;
};

const label = (lift) => {
    if (lift === null) return null;
    if (lift >= HIGHLY_VIRAL) return 'Highly Viral';
    if (lift >= VIRAL) return 'Viral';
    return 'Normal';
};

/**
 * @param posts [{ id, likes, comments, reposts, createdAt, creatorKey }] — all captured posts
 *              (the baseline uses each creator's full history, not just the window)
 * @param days  window to return (7 or 30)
 * @returns posts published within the window, sorted by score, each with
 *          { weightedEngagement, performanceRatio (lift, null without baseline), viralLabel }
 */
function calculateViralPosts(posts, days = 30, now = Date.now()) {
    if (!Array.isArray(posts) || posts.length === 0) return [];

    const byCreator = new Map();
    for (const p of posts) {
        const k = p.creatorKey || 'unknown';
        if (!byCreator.has(k)) byCreator.set(k, []);
        byCreator.get(k).push(p);
    }

    const baselines = new Map();
    for (const [k, list] of byCreator) {
        const recent = list.filter(p => {
            const t = timeOf(p);
            return t !== null && now - t <= BASELINE_WINDOW_DAYS * ONE_DAY_MS;
        });
        const sample = recent.length >= MIN_BASELINE_POSTS ? recent : list;
        if (sample.length >= MIN_BASELINE_POSTS) baselines.set(k, median(sample.map(score)));
    }

    return posts
        .filter(p => {
            const t = timeOf(p);
            return t !== null && (now - t) / ONE_DAY_MS <= days;
        })
        .map(p => {
            const base = baselines.get(p.creatorKey || 'unknown');
            const weightedEngagement = score(p);
            const lift = base > 0 ? weightedEngagement / base : null;
            return {
                ...p,
                weightedEngagement,
                performanceRatio: lift === null ? null : Number(lift.toFixed(2)),
                viralLabel: label(lift),
            };
        })
        .sort((a, b) => b.weightedEngagement - a.weightedEngagement);
}

module.exports = { calculateViralPosts, WEIGHTS, MIN_BASELINE_POSTS, VIRAL, HIGHLY_VIRAL };

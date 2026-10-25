// Tests for src/utils/insights.js — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLift } from '../src/utils/metrics.js';
import { formatOf, lengthOf, breakdown, timingGrid, cadence, engagementMix, explainPost, contentDrivers, LENGTHS } from '../src/utils/insights.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const urnAt = (ms) => `urn:li:activity:${BigInt(ms) << 22n}`;
let seq = 0;
const post = ({ daysAgo = 1, likes = 100, comments = 0, reposts = 0, media = [], text = 'Hello world' } = {}) => ({
    urn: urnAt(NOW - daysAgo * DAY + (seq++)), profileUrn: 'c', stats: { likes, comments, reposts }, media, text,
});

test('format and length buckets', () => {
    assert.equal(formatOf(post({ media: [{ type: 'carousel' }] })), 'Carousel');
    assert.equal(formatOf(post({ media: [{ type: 'image' }] })), 'Image');
    assert.equal(formatOf(post()), 'Text');
    assert.equal(lengthOf(post({ text: 'word '.repeat(300) })), LENGTHS[2]);
});

test('breakdown ranks groups with enough posts by lift, small groups last', () => {
    const posts = withLift([
        ...[1, 2, 3].map(d => post({ daysAgo: d, likes: 300, media: [{ type: 'carousel' }] })),
        ...[4, 5, 6, 7].map(d => post({ daysAgo: d, likes: 100 })),
        post({ daysAgo: 8, likes: 900, media: [{ type: 'video' }] }),
    ], NOW);
    const rows = breakdown(posts, formatOf);
    assert.equal(rows[0].key, 'Carousel');
    assert.equal(rows[rows.length - 1].key, 'Video');
    assert.equal(rows[rows.length - 1].enough, false);
});

test('timing grid is 7 days × 8 three-hour blocks', () => {
    const grid = timingGrid(withLift([post(), post({ daysAgo: 2 })], NOW));
    assert.equal(grid.length, 7);
    assert.ok(grid.every(r => r.length === 8));
    assert.equal(grid.flat().reduce((s, c) => s + c.n, 0), 2);
});

test('cadence: posts per week, average and longest gap', () => {
    const c = cadence([post({ daysAgo: 1 }), post({ daysAgo: 3 }), post({ daysAgo: 20 })], NOW, 4);
    assert.equal(c.perWeek.length, 4);
    assert.equal(c.perWeek[3], 2);
    assert.equal(c.avgPerWeek, 0.75);
    assert.equal(c.longestGapDays, 17);
    assert.ok(c.daysSinceLast <= 1);
});

test('engagement mix shares add up to 1', () => {
    const m = engagementMix([post({ likes: 60, comments: 30, reposts: 10 })]);
    assert.equal(m.likesShare, 0.6);
    assert.ok(Math.abs(m.commentsShare + m.likesShare + m.repostsShare - 1) < 1e-9);
    assert.equal(engagementMix([post({ likes: 0 })]), null);
});

test('explainPost compares the post with how its attributes perform', () => {
    const posts = withLift([
        ...[1, 2, 3].map(d => post({ daysAgo: d, likes: 300, media: [{ type: 'carousel' }] })),
        ...[4, 5, 6].map(d => post({ daysAgo: d, likes: 100 })),
    ], NOW);
    const rows = explainPost(posts[0], contentDrivers(posts, {}), {});
    const format = rows.find(r => r.label === 'Format');
    assert.equal(format.value, 'Carousel');
    assert.ok(format.groupLift > 1);
});

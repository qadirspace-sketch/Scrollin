// Run with: npm test (from the project root)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateViralPosts } = require('./viralScoreEngine');

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const p = (id, creatorKey, likes, daysAgo) => ({ id, creatorKey, likes, comments: 0, reposts: 0, createdAt: NOW - daysAgo * DAY });

test('same weights as the client: likes + 3×comments + 4×reposts', () => {
    const posts = [...[1, 2, 3, 4].map(d => p('b' + d, 'c', 10, d)), { id: 'x', creatorKey: 'c', likes: 100, comments: 10, reposts: 5, createdAt: NOW - DAY }];
    const x = calculateViralPosts(posts, 7, NOW).find(r => r.id === 'x');
    assert.equal(x.weightedEngagement, 150);
});

test('per-creator median baseline: a small creator breakout beats a big creator normal post', () => {
    const posts = [
        ...[1, 2, 3, 4, 5].map(d => p('s' + d, 'small', 100, d)), p('sHit', 'small', 300, 2),
        ...[1, 2, 3, 4, 5].map(d => p('b' + d, 'big', 2500, d)), p('bHit', 'big', 3000, 2),
    ];
    const out = calculateViralPosts(posts, 7, NOW);
    assert.equal(out.find(r => r.id === 'sHit').viralLabel, 'Highly Viral');
    assert.equal(out.find(r => r.id === 'bHit').viralLabel, 'Normal');
});

test('same label in the 7-day and 30-day windows', () => {
    const posts = [...[1, 4, 8, 12, 20].map(d => p('n' + d, 'c', 100, d)), p('hit', 'c', 220, 3)];
    const label7 = calculateViralPosts(posts, 7, NOW).find(r => r.id === 'hit').viralLabel;
    const label30 = calculateViralPosts(posts, 30, NOW).find(r => r.id === 'hit').viralLabel;
    assert.equal(label7, 'Viral');
    assert.equal(label30, 'Viral');
});

test('no label without 5 posts for the creator', () => {
    const out = calculateViralPosts([p('a', 'few', 10, 1), p('b', 'few', 500, 2)], 7, NOW);
    assert.ok(out.every(r => r.viralLabel === null && r.performanceRatio === null));
});

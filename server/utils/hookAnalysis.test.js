// Run with: npm test (from the project root)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzePatterns } = require('./hookAnalysis');

const DAY = 86400000;
const urnAt = (ms) => `urn:li:activity:${BigInt(Math.round(ms)) << 22n}`;
let i = 0;
const post = (text, likes, daysAgo) => ({
    urn: urnAt(Date.now() - daysAgo * DAY - (i++) * 1000),
    profileUrn: 'creator-1', text, stats: { likes, comments: 0, reposts: 0 },
});

test('a pattern seen in one post gets no lift verdict or badge', () => {
    const posts = [
        ...Array.from({ length: 8 }, (_, k) => post(`What is the best way to hire engineers in ${k}?\nMore text here.`, 100, k + 1)),
        post('Stop hiring for culture fit.\nHere is why it backfires.', 2000, 10),
    ];
    const { patterns } = analyzePatterns(posts, 'all');
    const lucky = patterns.find(p => p.stats.count === 1);
    assert.ok(lucky, 'one-post pattern is still listed');
    assert.equal(lucky.stats.hasEnoughData, false);
    assert.equal(lucky.stats.medianLift === null || lucky.stats.efficiencyScore === null, true);
    assert.equal(lucky.badges.length, 0);
});

test('patterns with enough posts are ranked by median lift, not volume', () => {
    const posts = [
        ...Array.from({ length: 10 }, (_, k) => post(`What is the best way to hire engineers ${k}?\nMore text.`, 100, k + 1)),
        ...Array.from({ length: 4 }, (_, k) => post(`Stop hiring for culture fit ${k}.\nHere is why.`, 400, k + 12)),
    ];
    const { patterns } = analyzePatterns(posts, 'all');
    const ranked = patterns.filter(p => p.stats.hasEnoughData);
    assert.ok(ranked.length >= 2);
    assert.ok(Number(ranked[0].stats.medianLift) > Number(ranked[1].stats.medianLift));
    assert.equal(ranked[0].stats.count, 4);
});

test('returns the hook type of every analyzed post', () => {
    const posts = Array.from({ length: 6 }, (_, k) => post(`What is the best way to hire ${k}?\nMore text.`, 100, k + 1));
    const { postTypes } = analyzePatterns(posts, 'all');
    assert.equal(Object.keys(postTypes).length, 6);
    assert.equal(postTypes[posts[0].urn].hook, 'Question');
});

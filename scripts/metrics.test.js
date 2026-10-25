// Tests for src/utils/metrics.js — run with: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    engagementScore, postDate, formatAgo, median, buildBaselines, withLift, viralLabel,
    medianTrend, groupByLift, mostActive, pctChange, MIN_BASELINE_POSTS,
} from '../src/utils/metrics.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
// LinkedIn activity URNs are snowflakes: id >> 22 = publish time in ms
const urnAt = (ms) => `urn:li:activity:${BigInt(ms) << 22n}`;
let seq = 0;
const post = ({ creator = 'A', daysAgo = 1, likes = 0, comments = 0, reposts = 0, date } = {}) => ({
    urn: urnAt(NOW - daysAgo * DAY + (seq++)), profileUrn: creator,
    stats: { likes, comments, reposts }, date,
});
const scored = (creator, score, daysAgo = 1) => post({ creator, daysAgo, likes: score });

test('one engagement score: likes + 3×comments + 4×reposts', () => {
    assert.equal(engagementScore(post({ likes: 100, comments: 10, reposts: 5 })), 150);
    assert.equal(engagementScore({ stats: { likes: '1,204', comments: '3', reposts: undefined } }), 1213);
});

test('lift compares each creator with their own median', () => {
    const posts = [
        ...[1, 2, 3, 4, 5].map(d => scored('small', 100, d)), scored('small', 300, 6),
        ...[1, 2, 3, 4, 5].map(d => scored('big', 2500, d)), scored('big', 3000, 6),
    ];
    const out = withLift(posts, NOW);
    const smallHit = out.find(p => p.profileUrn === 'small' && p.score === 300);
    const bigHit = out.find(p => p.profileUrn === 'big' && p.score === 3000);
    assert.equal(smallHit.lift, 3);
    assert.equal(bigHit.lift, 1.2);
    assert.ok(smallHit.lift > bigHit.lift);
});

test('no baseline (and no lift or label) under the minimum post count', () => {
    const posts = [scored('few', 100), scored('few', 500), scored('few', 90)];
    assert.ok(posts.length < MIN_BASELINE_POSTS);
    const out = withLift(posts, NOW);
    assert.ok(out.every(p => p.lift === null && p.viralLabel === null));
});

test('baseline uses last 90 days when there are enough recent posts', () => {
    const old = [1, 2, 3, 4, 5].map(i => scored('g', 10, 200 + i));
    const recent = [1, 2, 3, 4, 5].map(i => scored('g', 1000, i));
    const b = buildBaselines([...old, ...recent], NOW).get('g');
    assert.equal(b.median, 1000);
    assert.equal(b.n, 5);
});

test('labels use the same thresholds for every window', () => {
    assert.equal(viralLabel(2.2), 'Viral');
    assert.equal(viralLabel(3), 'Highly Viral');
    assert.equal(viralLabel(1.99), 'Normal');
    assert.equal(viralLabel(null), null);
});

test('dates come from the URN, not the frozen relative text', () => {
    const p = post({ daysAgo: 23, date: '2d • ' });
    const d = postDate(p);
    assert.equal(Math.round((NOW - d.getTime()) / DAY), 23);
    assert.equal(formatAgo(d, NOW), '3w');
    assert.equal(formatAgo(new Date(NOW - 3 * DAY), NOW), '3d');
});

test('median resists a single breakout', () => {
    assert.equal(median([100, 100, 100, 100, 5000]), 100);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), null);
});

test('posting more is not growth: median trend stays flat', () => {
    const prev = [8, 9, 10].map(d => scored('t', 200, d));
    const curr = [1, 2, 3, 4, 5, 6].map(d => scored('t', 200, d));
    const t = medianTrend([...prev, ...curr], 7, NOW);
    assert.equal(t.nCurrent, 6);
    assert.equal(t.nPrevious, 3);
    assert.equal(t.change, 0);
});

test('trend hidden when a window has fewer than 3 posts', () => {
    const t = medianTrend([scored('t', 100, 1), scored('t', 100, 2), scored('t', 100, 3), scored('t', 50, 9)], 7, NOW);
    assert.equal(t.change, null);
    assert.equal(pctChange(10, 0), null);
});

test('one lucky post is never the best group; best is by lift, most active by count', () => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8].map(d => scored('h', 100, d));
    const lucky = { ...scored('h', 900, 9) };
    const posts = withLift([...base, lucky], NOW).map((p, i) => ({ ...p, g: i === 8 ? 'lucky' : i < 5 ? 'mon' : 'tue' }));
    // tue posts get a higher score so their median lift beats mon
    posts.filter(p => p.g === 'tue').forEach(p => { p.lift = 1.5; });
    const g = groupByLift(posts, p => p.g);
    assert.equal(g.rows.find(r => r.key === 'lucky').enough, false);
    assert.equal(g.best.key, 'tue');
    assert.equal(mostActive(posts, p => p.g).key, 'mon');
});

test('topic tags match whole words only', async () => {
    const { applyRuleBasedTags } = await import('../src/utils/taggingService.js');
    const tagsOf = (text) => applyRuleBasedTags(text);
    const partial = tagsOf("I'm interested in what you've reached so far, interesting stuff");
    assert.notEqual(partial.primaryTag, 'Mental Health');
    assert.notEqual(partial.primaryTag, 'LinkedIn Platform');
    assert.equal(tagsOf('We are hiring two engineers. Apply via the recruiting page. #hiring').primaryTag, 'Hiring');
    assert.equal(tagsOf('Burnout is real. Protect your mental health and rest.').primaryTag, 'Mental Health');
    assert.equal(tagsOf('Leadership lesson: great managers delegate').primaryTag, 'Leadership');
});

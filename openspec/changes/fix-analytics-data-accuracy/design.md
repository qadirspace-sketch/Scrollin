# Design

## Context

See proposal.md (Why) for the list of wrong numbers. Facts that shape the approach:

- Captured posts carry `stats.{likes, comments, reposts}`. `stats.views` exists only for the logged-in user's own posts.
- The post URN is a LinkedIn snowflake ID: `id >> 22` is the publish time in ms (`extractTimeFromUrn`). The `date` field is LinkedIn's relative text ("2d •") frozen at capture time.
- Posts carry `profileUrn` (the profile being captured), which is the natural creator key. `creatorName` is the fallback.
- Viral labelling (`/v1/calculate-viral-posts`) and hook patterns (`/v1/analyze-patterns`) run on the backend, which the last commit introduced on purpose. Everything else computes on the client.
- There is no test framework. Node 24 runs `node --test` on ESM `.js` files directly.

## Goals / Non-Goals

**Goals:** one definition per metric, honest "not enough data" states, and the same numbers on the client and the server.

**Non-Goals:**
- No layout or visual changes.
- No new data capture (for example follower counts).
- Legacy unrendered views (`Analytics`, `HookAnalytics`, `TopicAnalytics`, `PostList`, `PostItem`) stay as they are.
- AI-generated summary text stays as it is.

## Decisions

1. **`src/utils/metrics.js` is the single client definition.** It holds pure functions with no React or chrome dependencies, so `node --test` can cover them:
   - `engagementScore`, `postDate`, `formatAgo`, `median`, `creatorKey`
   - `buildBaselines(posts)`, giving a map from creator key to `{ median, n }`
   - `withLift(posts)`, `viralLabel(lift)`, `periodWindows(days)`, `trend(curr, prev)`, `groupByLift(posts, keyFn, minN)`
   - the constants `WEIGHTS`, `MIN_BASELINE_POSTS = 5`, `MIN_GROUP_POSTS = 3`, `VIRAL = 2`, `HIGHLY_VIRAL = 3`

   Views import from it rather than re-deriving anything.
   *Alternative:* move all math to the server. Rejected for now: it adds a network round trip to every view and is a larger change. The server keeps only the two endpoints it already owns.

2. **The server mirrors the same rules.** `viralScoreEngine` and `hookAnalysis` get the same weights, a per-creator median baseline (with the same 90-day/5-post rule) and the same thresholds. The client sends `creatorKey` with each post. The duplication is accepted and named in both files. Each server change gets a `node --test` check against the same fixtures as the client.

3. **Median baseline per creator, last 90 days, falling back to all posts.** The median resists breakout skew. A 90-day window follows a creator's growth. The 5-post minimum avoids verdicts from noise. Lift is undefined (`null`) without a baseline, and every view treats `null` as "not enough data".

4. **Trends compare equal-length windows with medians.** Example: last 7 days vs the 7 before. Each window needs at least 3 posts, otherwise the trend is hidden. Counts (posts, viral posts, interactions) compare as counts. Quality compares as a median.

5. **Dashboard cards keep their slots, with honest content:**
   - "Avg Engagement %" becomes "Median engagement · 7D", with its 7D trend.
   - "Top Topic 7D" means the topic with the highest median lift among topics with at least 2 posts in 7 days (sample shown). "General" is excluded.
   - "Viral Posts" keeps the 7D/30D toggle, with the subtitle "≥2× creator median" and a computed change vs the previous window.
   - The dark card becomes "Interactions · last 30 days" (likes + comments + reposts), with a computed change vs the previous 30 days.

6. **Tag rules get whole-word regexes generated at load time.** Each keyword becomes `\bkeyword(?:s|es|ed|ing|er|ers|ship)?\b`. Keywords that are too generic to carry topic meaning are dropped: rest, reach, content, system, home, focus, team, goal, apply, service, scale. Regex literals that already contain `\b` stay as they are.

7. **Creator stats show only real data.** `p.role` and `p.followers` are shown when stored; otherwise "—". The topic comes from tagging the creator's posts. "Avg engagement" becomes the median score.

## Risks / Trade-offs

- [Users see fewer numbers at first: "not enough data" more often] → Better than wrong numbers. Each such state names the threshold ("needs 5 posts").
- [The client and server formulas could drift] → Constants are documented in both files, and shared fixture tests on both sides fail on drift.
- [Snowflake decoding assumes LinkedIn's ID scheme] → It is already relied on throughout. The relative-date fallback is kept for URNs without timestamps.

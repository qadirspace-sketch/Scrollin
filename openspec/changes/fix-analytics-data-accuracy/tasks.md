# Tasks

## 1. Shared metrics

- [x] 1.1 Create `src/utils/metrics.js` (score, dates, median, baselines, lift, labels, windows, trends, grouping, constants). Add `scripts/metrics.test.js` with fixtures covering each spec scenario, and verify with `npm test`.

## 2. Server parity

- [x] 2.1 Update `server/utils/viralScoreEngine.js` to weights 1/3/4, a per-creator median baseline (90d/5-post rule), thresholds 2×/3× for every window, and `null` labels without a baseline. Add `server/utils/viralScoreEngine.test.js` with the same fixtures, and verify with `node --test`.
- [x] 2.2 Update `server/utils/hookAnalysis.js`: score weights, a median baseline over analyzed posts, patterns ranked by median lift, and badges requiring ≥3 posts. Verify with a `node --test` case where a 1-post pattern gets no badge.

## 3. Dashboard and feed

- [x] 3.1 `Sidebar.jsx`: send `creatorKey`/`createdAt` to viral scoring, attach lift to display posts, and show "#N rank" only for performance sorts. Verify with `npm run build`.
- [x] 3.2 `DashboardStats.jsx`: remove fabricated views, rate and hardcoded trends, and implement the four cards from design decision 5 with computed trends. Verify in the test harness that no hardcoded trend text remains (grep) and the cards render with sample posts.
- [x] 3.3 `DashboardFeedItem.jsx`: age from the URN, badge from lift ("2.4× median" / "Not enough data"), no fixed like thresholds. Verify in the harness.

## 4. Analytics views

- [x] 4.1 `PostingAnalytics.jsx`: engagement = shared score, engagement rate only when views exist, growth from per-post medians with the 3-post rule. Verify with build plus the harness.
- [x] 4.2 `PostingHabits.jsx`: best day/hour by median lift (≥3 posts), "Most active" kept for counts, heatmap cell values = median score, timezone label from the browser. Verify in the harness.
- [x] 4.3 `utils/taggingService.js`: whole-word rules and dropped generic keywords. Add test cases for "interested"/"reached" to `scripts/metrics.test.js`.
- [x] 4.4 `TopicIntelligence.jsx`: medians and lift per topic, ≥3 posts for best/declining/opportunity, "General" excluded. Verify in the harness.

## 5. Creators and reports

- [x] 5.1 `Watchlist.jsx` and `CreatorIntelligence.jsx`: delete the estimated role/followers/topic generators, and compute stats from the shared module. Verify with grep for `getEstimated` (none left) plus the build.
- [x] 5.2 `FullDnaReport.jsx`: replace the hardcoded grade and recommendations with lines derived from computed habits/topics/patterns, or omit them. Verify with grep for "~18%" (none) plus the harness.
- [x] 5.3 `RightSidebarWidgets.jsx`: rank trending patterns by lift and hide them below the minimum sample. Verify in the harness.

## 6. Integration

- [x] 6.1 Run `node --test`, `npm run build`, then render dashboard, analytics, habits, topics and DNA in the harness with sample data, and confirm the numbers match hand-computed fixture values.

## Workflow follow-up

- Restart the backend, reload the extension in Arc, and check against a real profile.
- Archive the change after verification.

# Proposal

## Why

Many numbers in Scrollin are invented, hardcoded, or computed inconsistently, so users can't trust any insight:

- Impressions are fabricated as `likes × 20`.
- Trend badges (`+0.6%`, `+28% MoM`, `+1`) are literal strings.
- Creator follower counts and roles are generated from a hash of the profile ID.
- "Engagement" has three different formulas across pages.
- Every comparison uses the mean, which a single breakout post skews.

Fixing the data comes before the planned UI/UX work, because a redesign of wrong numbers is still wrong.

## What Changes

- Add one shared metrics module used by every view. It defines:
  - the engagement score (likes + 3×comments + 4×reposts)
  - each creator's median baseline
  - lift (score ÷ baseline) and the performance labels
  - publish dates taken from the post ID
  - minimum sample sizes
- **Dashboard**:
  - remove fabricated impressions and engagement rate, and every hardcoded trend
  - show the median score, viral count and total interactions, each with a real change vs the previous period of the same length
- **Feed**:
  - date from the publish time, not the frozen "2d" text captured at sync time
  - performance badge from lift, not fixed like counts
  - the "#N rank" pill shown only when the list is actually ranked by performance
- **Posting Analytics**:
  - one engagement definition
  - engagement rate only when real view counts exist
  - growth compares per-post medians, not totals
- **Posting Habits**:
  - best day and hour ranked by median lift with a minimum number of posts per slot
  - "most active" kept as a separate, correctly labelled fact
- **Topic tagging**:
  - whole-word matching
  - overly generic keywords removed
  - "General" never wins top topic
- **Topic Intelligence**: medians, lift and minimum sample sizes.
- **Watchlist and Creator Intelligence**:
  - no invented followers, roles or topics
  - stats from the shared module
- **Full DNA Report**:
  - no hardcoded grade or recommendations
  - lines built from computed results, or omitted
- **Server** (`viralScoreEngine`, `hookAnalysis`):
  - same score weights and median baseline per creator
  - the same viral thresholds for 7 and 30 days
  - patterns ranked by lift with minimum counts
- **BREAKING (displayed values):** numbers that were fabricated disappear or change meaning. Labels change where the old label was wrong (for example "Most Active Day" vs "Best Day").

## Capabilities

### New Capabilities
- `content-metrics`: how Scrollin scores posts, establishes baselines, dates posts, labels performance, and decides when there is enough data to show an insight.

### Modified Capabilities

(none — no existing specs)

## Impact

- New: `src/utils/metrics.js` plus tests (`node --test`).
- Client:
  - `DashboardStats.jsx`, `DashboardFeedItem.jsx`, `Sidebar.jsx`
  - `PostingAnalytics.jsx`, `PostingHabits.jsx`, `TopicIntelligence.jsx`
  - `Watchlist.jsx`, `CreatorIntelligence.jsx`, `FullDnaReport.jsx`, `RightSidebarWidgets.jsx`
  - `utils/taggingService.js`
- Server: `server/utils/viralScoreEngine.js`, `server/utils/hookAnalysis.js`. The backend must be restarted.
- No layout or styling changes; those come in the later UI/UX change.
- Legacy views no longer rendered (`Analytics.jsx`, `HookAnalytics.jsx`, `TopicAnalytics.jsx`, `PostList.jsx`, `PostItem.jsx`) are left untouched.

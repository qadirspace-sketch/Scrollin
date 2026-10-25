# Spec Delta

## Purpose

Defines how Scrollin measures LinkedIn post performance — scoring, per-creator baselines, dates, labels, trends and minimum sample sizes — so every view shows the same, honest numbers.

## ADDED Requirements

### Requirement: One engagement score everywhere
Every view and server endpoint SHALL score a post as likes + 3 × comments + 4 × reposts. A view labelled "engagement" SHALL use this score or state plainly which raw count it shows.

#### Scenario: Same post, same score on every page
- **WHEN** a post has 100 likes, 10 comments and 5 reposts
- **THEN** its engagement score is 150 on the dashboard, in analytics, habits, topics and on the server

### Requirement: Performance is relative to the creator's median
A post's lift SHALL be its score divided by its creator's baseline: the median score of that creator's posts from the last 90 days, or all their posts when fewer than 5 are recent. Without at least 5 posts the creator has no baseline and lift is unknown.

#### Scenario: Large and small creators compared fairly
- **WHEN** a 5k-follower creator's post scores 300 against a median of 100, and a 100k creator's post scores 3,000 against a median of 2,500
- **THEN** the first post has a lift of 3.0× and ranks above the second (1.2×)

#### Scenario: Too few posts
- **WHEN** a creator has 3 captured posts
- **THEN** no lift, viral label or performance badge is shown for their posts

### Requirement: Consistent performance labels
Posts with a known lift SHALL be labelled "Highly Viral" at 3× or more, "Viral" at 2× or more and below 3×, and "Normal" otherwise, using the same thresholds for every time window.

#### Scenario: 7-day and 30-day agree
- **WHEN** a post published 3 days ago has a lift of 2.2×
- **THEN** it is "Viral" in both the 7-day and the 30-day view

### Requirement: Dates come from the publish time
Post dates, ages ("3d ago") and time windows SHALL use the publish time encoded in the post's URN. The relative date text captured from LinkedIn MAY be used only when the URN has no timestamp.

#### Scenario: Old capture
- **WHEN** a post was captured 3 weeks ago while LinkedIn showed "2d"
- **THEN** Scrollin shows it as about 23 days old

### Requirement: No fabricated numbers
Scrollin SHALL NOT display impressions, engagement rate, follower counts, roles, grades, trends or uplift percentages unless they are measured or computed from captured data. When a value is unavailable, the view SHALL show it as unavailable instead of estimating it.

#### Scenario: Other people's posts
- **WHEN** posts have no view counts (any creator other than the logged-in user)
- **THEN** no impressions total or engagement rate is shown

#### Scenario: Trend badge
- **WHEN** a card shows a change such as "+12%"
- **THEN** that value is computed from the current and previous periods

### Requirement: Trends compare like with like
A trend SHALL compare the current window with the previous window of the same length, using per-post medians for quality metrics. It SHALL be shown only when both windows contain at least 3 posts.

#### Scenario: Posting more is not growth
- **WHEN** a creator posts twice as often with the same median score
- **THEN** the median-score trend is about 0%, and the post count change is reported separately

### Requirement: Insights need a minimum sample
A "best" verdict (day, hour, topic, hook pattern) SHALL require at least 3 posts in that group and SHALL rank groups by median lift, not by how often they occur. How often something occurs SHALL be labelled as activity, such as "Most active day".

#### Scenario: One lucky post
- **WHEN** a hook pattern appears in 1 post with a 5× lift
- **THEN** it is not called a "Hidden Gem" or "best" pattern

#### Scenario: Most active vs best
- **WHEN** a creator posts most on Mondays but Tuesday posts have the highest median lift with at least 3 posts
- **THEN** "Most active day" is Monday and "Best day" is Tuesday

### Requirement: Topic tags match whole words
Rule-based topic tags SHALL match keywords as whole words (allowing common suffixes such as -s, -ing, -er, -ship). "General" SHALL NOT be reported as a top or trending topic.

#### Scenario: Partial words
- **WHEN** a post says "I'm interested in what you've reached"
- **THEN** it is not tagged "Mental Health" (rest) or "LinkedIn Platform" (reach)

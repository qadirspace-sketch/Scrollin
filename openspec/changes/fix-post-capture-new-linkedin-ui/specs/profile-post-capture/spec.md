# Spec Delta

## Purpose

Defines how Scrollin detects that the user is viewing a LinkedIn profile and collects that profile's posts, independent of which LinkedIn web UI is served.

## ADDED Requirements

### Requirement: Capture starts on profile visit without relying on LinkedIn's own requests
When a LinkedIn tab shows a profile page (`/in/<vanity>/` or any sub-page), the extension SHALL start collecting that profile's posts even if the page never issues a feed GraphQL request.

#### Scenario: New LinkedIn UI profile visit
- **WHEN** the user opens `https://www.linkedin.com/in/<vanity>/recent-activity/all/` and the page loads via the new server-rendered UI
- **THEN** the extension fetches that profile's posts and they appear in the Scrollin panel

#### Scenario: Panel not opened yet
- **WHEN** the user visits a profile without opening the Scrollin panel
- **THEN** capture still runs, and opening the panel afterwards shows the collected posts

### Requirement: Capture follows in-app navigation
The extension SHALL start capture for a new profile when the user navigates between profiles without a full page reload, and SHALL NOT show the previous profile's posts for the new one.

#### Scenario: SPA navigation to another profile
- **WHEN** the user is on profile A and clicks through to profile B within LinkedIn
- **THEN** the session resets and posts for profile B are collected

### Requirement: Single capture per profile visit
The extension SHALL start at most one capture run per profile visit, whether capture is triggered by intercepting LinkedIn's request or by the profile-visit trigger.

#### Scenario: Both triggers available
- **WHEN** LinkedIn does send the feed request and the profile-visit trigger also fires
- **THEN** only one fetch run happens for that profile

### Requirement: Capture targets the viewed profile
The extension SHALL collect posts for the profile named in the tab's URL, and SHALL NOT take the profile identity from unrelated LinkedIn requests (such as navigation or messaging queries carrying the logged-in user's own profile).

#### Scenario: Viewing someone else's profile
- **WHEN** the logged-in user opens another member's activity page and LinkedIn also issues requests containing the user's own profile URN
- **THEN** the collected posts belong to the viewed member, not the logged-in user

### Requirement: Watchlist behaviour preserved
For profiles already in the watchlist or with stored posts, capture SHALL use the incremental watchlist sync and preload stored posts, exactly as before.

#### Scenario: Watchlisted profile visit
- **WHEN** the user visits a profile that has posts stored in the local database
- **THEN** stored posts show immediately and only new posts are fetched and saved

### Requirement: Failure is visible in logs, not silent
If the profile URN cannot be resolved, the extension SHALL log a clear console error naming the vanity and reason, and SHALL NOT start a fetch with missing parameters.

#### Scenario: Identity lookup fails
- **WHEN** LinkedIn's identity API returns an error or no URN for the vanity
- **THEN** a `[Capture]` error is logged in the service worker console and no fetch is started

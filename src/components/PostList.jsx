import React, { useMemo, useEffect } from 'react';
import DashboardFeedItem from './DashboardFeedItem';
import { extractTimeFromUrn } from '../utils/timeUtils';
import { Virtuoso } from 'react-virtuoso';

const PostList = ({ posts, sortCriteria, contentFilter = 'all', dateRange = { start: null, end: null }, searchTerm = '', onFilteredCountChange, sourceFilter = 'all', isGridView = false, isAnalyticsGrid = false }) => {
    const processedPosts = useMemo(() => {
        if (!posts || posts.length === 0) return [];

        const seenPosts = new Set();
        const allPosts = [];

        // Reverse logs to show oldest first (Page 1, then Page 2...)
        const logsToProcess = [...posts].reverse();

        logsToProcess.forEach(log => {
            if (log.extractedPosts && log.extractedPosts.length > 0) {
                log.extractedPosts.forEach(post => {
                    let signature;
                    if (post.urn) {
                        signature = post.urn;
                    } else {
                        const mediaSignature = post.media ? post.media.map(m => m.url).join(',') : '';
                        signature = `${post.text || ''}|${mediaSignature}`;
                    }

                    if (!seenPosts.has(signature)) {
                        seenPosts.add(signature);
                        allPosts.push(post);
                    }
                });
            }
        });

        // Apply content filter
        let filtered = filterByContentType(allPosts, contentFilter);

        // Apply Search Filter
        if (searchTerm && searchTerm.trim() !== '') {
            const lowerTerm = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(post =>
                post.text && post.text.toLowerCase().includes(lowerTerm)
            );
        }

        // Apply date range filter
        if (dateRange.start || dateRange.end) {
            filtered = filtered.filter(post => {
                if (!post.urn) return false;
                const postDate = extractTimeFromUrn(post.urn);
                if (!postDate) return false;

                // Reset time part for accurate date comparison
                const checkDate = new Date(postDate);
                checkDate.setHours(0, 0, 0, 0);

                if (dateRange.start) {
                    const startDate = new Date(dateRange.start);
                    startDate.setHours(0, 0, 0, 0);
                    if (checkDate < startDate) return false;
                }

                if (dateRange.end) {
                    const endDate = new Date(dateRange.end);
                    endDate.setHours(0, 0, 0, 0);
                    // Compare simply <= for end date (inclusive)
                    if (checkDate > endDate) return false;
                }

                return true;
            });
        }

        // Sort the filtered posts
        return sortPosts(filtered, sortCriteria);
    }, [posts, sortCriteria, contentFilter, dateRange, searchTerm]);

    // Update filtered count whenever processedPosts changes
    useEffect(() => {
        if (onFilteredCountChange) {
            onFilteredCountChange(processedPosts.length);
        }
    }, [processedPosts, onFilteredCountChange]);

    if (processedPosts.length === 0) {
        return (
            <div className="empty-state">
                <p>
                    {searchTerm
                        ? `No posts found matching "${searchTerm}"`
                        : (dateRange.start || dateRange.end) ? 'No posts found' : 'Waiting for posts...'
                    }
                </p>
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                    {searchTerm
                        ? 'Try a different keyword or check for typos.'
                        : (dateRange.start || dateRange.end)
                            ? 'No posts match the selected date range. Try adjusting the dates.'
                            : (contentFilter !== 'all'
                                ? 'No posts match the selected filter. Try a different filter or scroll the LinkedIn feed.'
                                : 'Scroll the LinkedIn feed to start automatic fetching.')
                    }
                </p>
            </div>
        );
    }

    if (isGridView) {
        return (
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
                    gap: '24px',
                    width: '100%',
                    padding: '4px',
                    alignItems: 'start'
                }}
            >
                {processedPosts.map((post, index) => (
                    <DashboardFeedItem
                        key={post.urn || index}
                        post={post}
                        index={index}
                        isGridView={true}
                        isAnalyticsGrid={isAnalyticsGrid}
                    />
                ))}
            </div>
        );
    }

    // Virtuoso handles the scrolling logic and only renders visible items
    return (
        <Virtuoso
            style={{ height: '100%', width: '100%' }}
            data={processedPosts}
            itemContent={(index, post) => (
                <div style={{ paddingBottom: '12px' }}>
                    <DashboardFeedItem post={post} index={index} isGridView={false} isAnalyticsGrid={isAnalyticsGrid} />
                </div>
            )}
            overscan={200} // Pre-render 200px of content for smoother scrolling
        />
    );
};

// Helper function for content type filtering
const filterByContentType = (posts, filter) => {
    if (filter === 'all') return posts;

    return posts.filter(post => {
        const hasMedia = post.media && post.media.length > 0;

        switch (filter) {
            case 'text_only':
                // Only posts without any media
                return !hasMedia;

            case 'with_images':
                // Posts with at least one image (not carousel or video)
                return hasMedia && post.media.some(m => m.type === 'image' && !m.isCarousel);

            case 'with_carousel':
                // Posts with carousel
                return hasMedia && post.media.some(m => m.type === 'carousel' || m.isCarousel);

            case 'with_videos':
                // Posts with videos
                return hasMedia && post.media.some(m => m.type === 'video');

            case 'reposts_only':
                return post.isRepost;

            case 'own_content':
                // Show original posts AND self-reposts. Hide reposts of others.
                if (!post.isRepost) return true;
                return post.isRepost && post.repostType === 'self';

            default:
                return true;
        }
    });
};

// Helper function for sorting (moved from content.js)
const sortPosts = (posts, criteria) => {
    const getCount = (post, type) => {
        return (post.stats && post.stats[type]) ? post.stats[type] : 0;
    };

    const getCombinedScore = (post) => {
        return getCount(post, 'likes') + getCount(post, 'comments') + getCount(post, 'reposts');
    };

    const parseRelativeDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return Infinity;

        const cleanStr = dateStr.replace('•', '').trim().toLowerCase();

        if (cleanStr.includes('now') || cleanStr.includes('second') || cleanStr.includes('min')) {
            if (cleanStr.includes('now')) return 0;
        }

        const parts = cleanStr.match(/(\d+)\s*([a-z]+)/);

        if (!parts) return Infinity;

        const value = parseInt(parts[1], 10);
        const unit = parts[2];

        let multiplier = 1;
        if (unit.startsWith('m') && !unit.startsWith('mo')) multiplier = 1;
        else if (unit.startsWith('h')) multiplier = 60;
        else if (unit.startsWith('d')) multiplier = 60 * 24;
        else if (unit.startsWith('w')) multiplier = 60 * 24 * 7;
        else if (unit.startsWith('mo')) multiplier = 60 * 24 * 30;
        else if (unit.startsWith('y')) multiplier = 60 * 24 * 365;

        return value * multiplier;
    };

    const getPostTimestamp = (post) => {
        if (!post) return 0;
        if (post.createdAt) {
            const t = new Date(post.createdAt).getTime();
            if (!isNaN(t)) return t;
        }
        if (post.urn) {
            const date = extractTimeFromUrn(post.urn);
            if (date) return date.getTime();
        }
        if (post.date) {
            const offsetMin = parseRelativeDate(post.date);
            if (offsetMin !== Infinity) {
                return Date.now() - (offsetMin * 60 * 1000);
            }
        }
        return 0;
    };

    return [...posts].sort((a, b) => {
        switch (criteria) {
            case 'newest':
                return getPostTimestamp(b) - getPostTimestamp(a);
            case 'oldest':
                return getPostTimestamp(a) - getPostTimestamp(b);
            case 'most_liked':
                return getCount(b, 'likes') - getCount(a, 'likes');
            case 'least_liked':
                return getCount(a, 'likes') - getCount(b, 'likes');
            case 'most_commented':
                return getCount(b, 'comments') - getCount(a, 'comments');
            case 'least_commented':
                return getCount(a, 'comments') - getCount(b, 'comments');
            case 'most_shared':
                return getCount(b, 'reposts') - getCount(a, 'reposts');
            case 'least_shared':
                return getCount(a, 'reposts') - getCount(b, 'reposts');
            case 'combined_score':
                return getCombinedScore(b) - getCombinedScore(a);
            case 'inverse_combined_score':
                return getCombinedScore(a) - getCombinedScore(b);
            case 'default':
            default:
                return 0;
        }
    });
}

export default PostList;

import React, { useState, useEffect } from 'react';
import Media from './Media';
import { ThumbsUp, MessageCircle, Repeat, Eye, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { extractTimeFromUrn, formatFullDate } from '../utils/timeUtils';
import { getTagsForPost, getCreatorStats } from '../utils/taggingService';
import PostTagOverlay from './PostTagOverlay';

const PostItem = ({ post = {}, index, searchTerm = '', sourceFilter = 'all' }) => {
    // ... existing state ...
    const [isExpanded, setIsExpanded] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [paginationToken, setPaginationToken] = useState(null);
    const [hasMoreComments, setHasMoreComments] = useState(true);

    // ... highlightText helper ...
    const highlightText = (text, term) => {
        if (!term || !text) return text;
        const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === term.toLowerCase() ? (
                        <span key={i} style={{ backgroundColor: '#bbf7d0', color: '#14532d', borderRadius: '2px', padding: '0 2px' }}>
                            {part}
                        </span>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    const fullText = post?.text || '';
    const maxLength = 200;
    const shouldTruncate = fullText.length > maxLength;
    const displayedText = isExpanded || !shouldTruncate ? fullText : fullText.substring(0, maxLength) + '... ';
    // --- Tagging Logic ---
    const [tags, setTags] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (post?.text) {
                // Fetch tags
                const tagResult = await getTagsForPost(post.text, post.urn);
                if (isMounted) setTags(tagResult);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [post?.text, post?.urn]);
    // ---------------------

    // ... (rest of useEffects) ...

    useEffect(() => {
        const handleMessage = (message) => {
            if (message.action === "comments_fetched") {
                // Check if these comments belong to this post
                // We need a way to match comments to the post.
                // The background script sends socialDetailUrn.
                if (post?.socialDetailUrn && message.socialDetailUrn === post.socialDetailUrn) {
                    setIsLoadingComments(false);
                    if (message.comments && message.comments.length > 0) {
                        setComments(prev => {
                            // Deduplicate based on URN
                            const existingUrns = new Set(prev.map(c => c.urn));
                            const newComments = message.comments.filter(c => !existingUrns.has(c.urn));
                            return [...prev, ...newComments];
                        });
                    }

                    if (message.paginationToken) {
                        setPaginationToken(message.paginationToken);
                        setHasMoreComments(true);
                    } else {
                        setHasMoreComments(false);
                    }
                }
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, [post?.socialDetailUrn]);

    const [isAutoFetching, setIsAutoFetching] = useState(false);

    useEffect(() => {
        if (isAutoFetching && !isLoadingComments && hasMoreComments) {
            handleFetchComments(true);
        } else if (isAutoFetching && !hasMoreComments) {
            setIsAutoFetching(false);
        }
    }, [isLoadingComments, hasMoreComments, isAutoFetching]);

    const handleFetchComments = (fetchAll = false) => {
        if (!post?.socialDetailUrn) {
            console.warn("No socialDetailUrn for this post, cannot fetch comments.");
            return;
        }

        if (fetchAll) {
            setIsAutoFetching(true);
        }

        setIsLoadingComments(true);
        chrome.runtime.sendMessage({
            action: "fetch_comments",
            socialDetailUrn: post.socialDetailUrn,
            start: comments.length,
            paginationToken: paginationToken
        });
    };

    const toggleComments = () => {
        setShowComments(!showComments);
        if (!showComments && comments.length === 0) {
            handleFetchComments();
        }
    };

    // Safe date derivation
    let dateText = '';
    let parsedDate = null;
    let fullDateString = 'Unknown Date';

    if (post.urn) {
        parsedDate = extractTimeFromUrn(post.urn);
        if (parsedDate) {
            fullDateString = formatFullDate(post.urn);
        }
    }

    if (post.date && typeof post.date === 'string') {
        dateText = post.date;
    } else if (parsedDate) {
        if (!isNaN(parsedDate.getTime())) {
            dateText = parsedDate.toLocaleDateString();
        } else {
            dateText = 'Unknown Date';
        }
    } else {
        dateText = 'Unknown Date';
    }

    // Clean up the scraped date text to avoid double bullets or messy formatting
    const adjustedDateText = dateText.replace(/•/g, '').trim();

    // Debug Filter Logic: Hide if source doesn't match
    if (sourceFilter !== 'all' && tags) {
        // If filter is 'rule', hide 'ai' or 'default'
        if (sourceFilter === 'rule' && tags.source !== 'rule') return null;
        // If filter is 'ai', hide 'rule' or 'default'
        if (sourceFilter === 'ai' && tags.source !== 'ai') return null;
    }

    return (
        <div className="sidebar-post">
            <div className="post-number">#{index}</div>

            {(post?.creatorName || post?.creatorImage) && (
                <div className="post-creator">
                    {post?.creatorImage && (
                        <img
                            src={post.creatorImage}
                            alt={post.creatorName || 'Profile picture'}
                            className="creator-avatar"
                        />
                    )}
                    {post?.creatorName && (
                        <div className="creator-name">
                            {post.creatorName}
                            {post.isRepost && (
                                <span className="repost-badge" title="This is a reposted update" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '6px', fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>
                                    <Repeat size={12} style={{ marginRight: '2px' }} /> Reposted
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Date & Time */}
            <div className="post-date" title={`Exact Post Time: ${fullDateString}`}>
                {adjustedDateText} • {fullDateString}
            </div>

            {/* AI Tags */}
            {tags && (tags.primaryTag || tags.secondaryTag) && (
                <div style={{ marginTop: '8px', marginBottom: '4px' }}>
                    <PostTagOverlay
                        primaryTag={tags.primaryTag}
                        secondaryTag={tags.secondaryTag}
                        confidence={tags.confidence}
                        source={tags.source}
                    />
                </div>
            )}

            {fullText && (
                <div className="post-text">
                    <span>{highlightText(displayedText, searchTerm)}</span>
                    {shouldTruncate && (
                        <span
                            className="see-more-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                        >
                            {isExpanded ? 'See less' : 'See more'}
                        </span>
                    )}
                </div>
            )}

            {post?.media && post.media.length > 0 && (
                <div className="post-media-container">
                    {post.media.map((media, i) => (
                        <Media key={i} media={media} />
                    ))}
                </div>
            )}

            {post?.stats && (
                <div className="post-stats">
                    {post.stats.likes !== undefined && (
                        <span className="stat-item" title="Likes">
                            <ThumbsUp size={14} /> {post.stats.likes}
                        </span>
                    )}
                    {post.stats.comments !== undefined && (
                        <span
                            className="stat-item clickable"
                            title="Comments"
                            onClick={toggleComments}
                        >
                            <MessageCircle size={14} /> {post.stats.comments}
                        </span>
                    )}
                    {post.stats.reposts !== undefined && (
                        <span className="stat-item" title="Reposts">
                            <Repeat size={14} /> {post.stats.reposts}
                        </span>
                    )}
                    {post.stats.views !== undefined && (
                        <span className="stat-item" title="Impressions">
                            <Eye size={14} /> {post.stats.views}
                        </span>
                    )}
                </div>
            )}

            {showComments && (
                <div className="comments-section">
                    <div className="comments-header">
                        <h4>Comments</h4>
                        <button className="close-comments" onClick={() => setShowComments(false)}>
                            <ChevronUp size={16} />
                        </button>
                    </div>

                    {comments.length === 0 && !isLoadingComments && (
                        <div className="no-comments">No comments fetched yet.</div>
                    )}

                    <div className="comments-list">
                        {comments.map((comment, i) => (
                            <div key={i} className="comment-item">
                                <div className="comment-header">
                                    {comment.authorImage && (
                                        <img src={comment.authorImage} alt={comment.authorName} className="comment-avatar" />
                                    )}
                                    <div className="comment-author-info">
                                        {comment.profileUrl ? (
                                            <a href={comment.profileUrl} target="_blank" rel="noopener noreferrer" className="comment-author-name link">
                                                {comment.authorName}
                                            </a>
                                        ) : (
                                            <span className="comment-author-name">{comment.authorName}</span>
                                        )}
                                        {comment.authorHeadline && (
                                            <span className="comment-author-headline">{comment.authorHeadline}</span>
                                        )}
                                    </div>
                                    <span className="comment-time">{comment.time}</span>
                                </div>
                                <div className="comment-text">{comment.text}</div>
                            </div>
                        ))}
                    </div>

                    {isLoadingComments && (
                        <div className="loading-comments">
                            <Loader size={16} className="spin" /> Loading comments...
                        </div>
                    )}

                    {!isLoadingComments && hasMoreComments && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="load-more-comments" onClick={() => handleFetchComments(false)} style={{ flex: 1 }}>
                                Load more comments
                            </button>
                            <button
                                className="load-more-comments"
                                onClick={() => handleFetchComments(true)}
                                style={{ flex: 1, backgroundColor: '#CC4E2E', color: 'white', border: 'none' }}
                            >
                                Load all comments
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostItem;

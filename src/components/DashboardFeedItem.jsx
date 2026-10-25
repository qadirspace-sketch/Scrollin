import React, { useState, useEffect } from 'react';
import { formatFullDate } from '../utils/timeUtils';
import { getTagsForPost } from '../utils/taggingService';
import Icon from './Icon';

const PostTags = ({ post }) => {
    const [tags, setTags] = useState(post.tags || null);

    useEffect(() => {
        if (tags) return;

        let mounted = true;
        if (post.text) {
            getTagsForPost(post.text, post.urn).then(result => {
                if (mounted && result) {
                    setTags(result);
                }
            });
        }
        return () => { mounted = false; };
    }, [post.text, post.urn, tags]);

    if (!tags || !tags.primaryTag) return null;

    return (
        <div style={{ marginTop: 11 }}>
            <span className="tag-sq">
                <Icon name="topics" size={13} color="var(--accent-deep)" />
                {tags.primaryTag}
            </span>
        </div>
    );
};

const MediaGallery = ({ media }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Normalize media items
    const items = React.useMemo(() => {
        if (!media || media.length === 0) return [];

        // Handle explicit carousel type that might contain nested images
        if (media.length === 1 && media[0].type === 'carousel') {
            if (media[0].images && Array.isArray(media[0].images) && media[0].images.length > 0) {
                return media[0].images.map(url => ({ type: 'image', url }));
            }
            // If it's a carousel but no images array, treat the main url as content (fallback)
            return [media[0]];
        }

        return media;
    }, [media]);

    if (!items || items.length === 0) return null;

    const showControls = items.length > 1;

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
    };

    const currentItem = items[currentIndex];

    // Detect video type
    const isVideo = currentItem.type === 'video' || (typeof currentItem.url === 'string' && (currentItem.url.includes('.mp4') || currentItem.type === 'video'));

    return (
        <div className="carousel" style={{ marginTop: '12px', aspectRatio: '16/9' }}>
            {/* Content */}
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                {isVideo ? (
                    <video
                        src={currentItem.url || currentItem}
                        controls
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                ) : (
                    <img
                        src={currentItem.url || currentItem}
                        alt={`Slide ${currentIndex + 1}`}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain' // "Perfect image size" - don't crop
                        }}
                    />
                )}
            </div>

            {/* Controls */}
            {showControls && (
                <>
                    <button className="carousel-arrow" style={{ left: 9 }} onClick={handlePrev}>
                        <Icon name="chevL" size={16} color="#FFFFFF" />
                    </button>
                    <button className="carousel-arrow" style={{ right: 9 }} onClick={handleNext}>
                        <Icon name="chevR" size={16} color="#FFFFFF" />
                    </button>
                    <div className="carousel-count">{currentIndex + 1} / {items.length}</div>
                </>
            )}
        </div>
    );
};

// Highlight search term in text
const highlightText = (text, term) => {
    if (!term || !term.trim() || !text) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase()
            ? <mark key={i} style={{ backgroundColor: '#fef08a', color: '#000', borderRadius: '2px', padding: '0 1px' }}>{part}</mark>
            : part
    );
};

const DashboardFeedItem = ({ post, index, isGridView, isAnalyticsGrid, searchTerm = '' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [liked, setLiked] = useState(false);

    // Heuristic for Badge
    let badge = null;
    const likes = post.stats?.likes || 0;
    const comments = post.stats?.comments || 0;
    const reposts = post.stats?.reposts || 0;

    // Use Calculated Viral Label if available
    if (post.viralLabel) {
        if (post.viralLabel === 'Highly Viral') {
            badge = { text: 'Highly Viral', pillClass: 'pill-orange', dotColor: 'var(--orange)' };
        } else if (post.viralLabel === 'Viral') {
            badge = { text: 'Viral', pillClass: 'pill-green', dotColor: 'var(--green)' };
        } else if (post.viralLabel === 'Normal') {
            badge = { text: 'Normal', pillClass: 'pill-blue', dotColor: 'var(--accent)' };
        }
    }
    // Fallback heuristic if no label (e.g. fresh start or older post logic)
    else if (likes > 500) {
        badge = { text: 'High Engagement', pillClass: 'pill-green', dotColor: 'var(--green)' };
    } else if (comments > 50) {
        badge = { text: 'Conversation Starter', pillClass: 'pill-green', dotColor: 'var(--green)' };
    }

    const dateStr = post.urn ? formatFullDate(post.urn) : post.date;
    const timeAgo = post.date ? post.date.replace('•', '').trim() : '';

    return (
        <div className="post" style={{ marginBottom: isGridView ? '0' : '18px', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="post-top">
                <img 
                    className="av" 
                    src={post.creatorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.creatorName || 'User')}&background=random`} 
                    width={42} 
                    height={42} 
                    alt={post.creatorName || 'User'} 
                />
                <div style={{ minWidth: 0 }}>
                    <div className="post-name">
                        {post.creatorName || 'Unknown User'}{' '}
                        <Icon name="verified" size={15} color="var(--accent-deep)" style={{ display: 'inline', marginLeft: '2px' }} />
                    </div>
                    <div className="post-meta">Posted {timeAgo || 'some time'} ago · LinkedIn</div>
                </div>

                <div className="post-badges">
                    <span className="pill pill-blue">#{index + 1} rank</span>
                    {post.isRepost && (
                        <span className="pill pill-blue">
                            <span className="pill-dot" style={{ background: 'var(--accent)' }} />
                            Repost
                        </span>
                    )}
                    {badge && (
                        <span className={`pill ${badge.pillClass}`}>
                            <span className="pill-dot" style={{ background: badge.dotColor }} />
                            {badge.text}
                        </span>
                    )}
                </div>
            </div>

            {/* Content Text */}
            <div className="post-text">
                {post.text && post.text.length > 250 && !isExpanded ? (
                    <>
                        {highlightText(post.text.substring(0, 250), searchTerm)}...
                        <span
                            onClick={() => setIsExpanded(true)}
                            className="read-more"
                            style={{ marginLeft: '4px' }}
                        >
                            Read more
                        </span>
                    </>
                ) : (
                    <>
                        {highlightText(post.text, searchTerm)}
                        {post.text && post.text.length > 250 && (
                            <span
                                onClick={() => setIsExpanded(false)}
                                className="read-more"
                                style={{ marginLeft: '6px', color: 'var(--muted)', fontSize: '12px' }}
                            >
                                Show less
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Tags Display */}
            {post.tags ? (
                <div style={{ marginTop: 11 }}>
                    <span className="tag-sq">
                        <Icon name="topics" size={13} color="var(--accent-deep)" />
                        {post.tags.primaryTag}
                    </span>
                </div>
            ) : (
                <PostTags post={post} />
            )}

            {/* Media Gallery */}
            <MediaGallery media={post.media} />

            {/* Footer Stats & Actions */}
            <div className="post-foot">
                <button className="post-stat" onClick={() => setLiked(l => !l)} style={liked ? { color: "var(--accent-deep)" } : null}>
                    <Icon name="like" size={16} color={liked ? "var(--accent-deep)" : "var(--muted)"} />
                    {liked ? likes + 1 : likes}
                </button>
                <div className="post-stat">
                    <Icon name="comment" size={16} color="var(--muted)" /> {comments}
                </div>
                <div className="post-stat">
                    <Icon name="share" size={16} color="var(--muted)" /> {reposts}
                </div>
                
                <div className="spacer" />

                <button 
                    className="post-stat" 
                    onClick={() => post.url ? window.open(post.url, '_blank') : (post.urn && window.open(`https://www.linkedin.com/feed/update/${post.urn}/`, '_blank'))}
                    title="Open on LinkedIn"
                >
                    <Icon name="link" size={16} color="var(--muted)" />
                </button>
                <button className="post-stat" title="Bookmark">
                    <Icon name="bookmark" size={16} color="var(--muted)" />
                </button>
            </div>

            {/* Analytics Specific Grid Extra Details */}
            {isAnalyticsGrid && (
                <div style={{ 
                    marginTop: '13px', 
                    paddingTop: '13px', 
                    borderTop: '1px solid #F0F0F2', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    backgroundColor: 'var(--surface-2)',
                    margin: '13px -18px -17px -18px',
                    padding: '13px 18px',
                    borderBottomLeftRadius: 'var(--r-card)',
                    borderBottomRightRadius: 'var(--r-card)'
                }}>
                    <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Engagement</div>
                        <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--ink)' }}>
                            {(likes + comments + reposts).toLocaleString()}
                        </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
                        <span style={{ fontSize: '12.5px', fontWeight: '550', color: 'var(--ink)' }}>{dateStr}</span>
                    </div>
                    <button
                        onClick={() => post.url ? window.open(post.url, '_blank') : (post.urn && window.open(`https://www.linkedin.com/feed/update/${post.urn}/`, '_blank'))}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent',
                            border: 'none', color: 'var(--accent-deep)', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer'
                        }}
                    >
                        View post <Icon name="link" size={14} color="var(--accent-deep)" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default DashboardFeedItem;

import { getTagsForPost } from './taggingService';

export const generateCSV = async (posts) => {
    if (!posts || posts.length === 0) return '';

    // Define columns
    const headers = [
        'Date',
        'Creator',
        'Type',
        'Primary Tag',
        'Secondary Tags',
        'Engagement Score',
        'Likes',
        'Comments',
        'Reposts',
        'Views',
        'Post Text',
        'Post Link',
        'Media URLs'
    ];

    // Helper to escape CSV fields (handle commas, quotes, newlines)
    const escape = (field) => {
        if (field === null || field === undefined) return '';
        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    };

    // Helper to get post type
    const getPostType = (post) => {
        if (post.isRepost) return 'Repost';
        if (!post.media || post.media.length === 0) return 'Text';
        if (post.media.some(m => m.type === 'video')) return 'Video';
        if (post.media.some(m => m.type === 'carousel' || m.isCarousel)) return 'Carousel';
        return 'Image';
    };

    // Map posts to rows
    const rowPromises = posts.map(async (post) => {
        const stats = post.stats || {};
        const score = (stats.likes || 0) + (stats.comments || 0) + (stats.reposts || 0);

        // Extract media URLs
        const mediaUrls = post.media ? post.media.map(m => m.url || (m.images ? m.images.join('; ') : '')).join('; ') : '';

        // Extract Post URL
        const postUrl = post.postUrl || (post.urn ? `https://www.linkedin.com/feed/update/${post.urn}/` : '');

        // Get Tags
        const { primaryTag, secondaryTags } = await getTagsForPost(post.text, post.urn);

        return [
            escape(post.date || ''),
            escape(post.creatorName || ''),
            escape(getPostType(post)),
            escape(primaryTag || 'General'),
            escape(secondaryTags ? secondaryTags.join('; ') : ''),
            score,
            stats.likes || 0,
            stats.comments || 0,
            stats.reposts || 0,
            stats.views || 0,
            escape(post.text || ''),
            escape(postUrl || post.urn || ''),
            escape(mediaUrls)
        ].join(',');
    });

    const rows = await Promise.all(rowPromises);
    return [headers.join(','), ...rows].join('\n');
};

export const downloadCSV = (content, filename = 'linkedin_posts_export.csv') => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

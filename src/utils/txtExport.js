export const downloadTXT = (posts, filename = 'linkedin_posts.txt') => {
    if (!posts || posts.length === 0) {
        alert("No posts to download.");
        return;
    }

    const content = posts
        .map(post => {
            const date = post.date ? `[${post.date}] ` : '';
            const creator = post.creatorName ? `${post.creatorName}: ` : '';
            const text = post.text || '';
            return `${date}${creator}\n${text}\n\n---`;
        })
        .join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
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

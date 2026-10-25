
export const extractTimeFromUrn = (urn) => {
    if (!urn || typeof urn !== 'string') return null;
    const match = urn.match(/(\d+)/);
    if (!match) return null;

    const id = BigInt(match[1]);
    const timestamp = Number(id >> 22n);
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) return null;

    // Validate that the year is within modern LinkedIn era (2010 to 2030)
    // Non-snowflake IDs (like company IDs or sequence IDs) will yield dates near 1970
    const year = date.getFullYear();
    if (year < 2010 || year > 2030) return null;

    return date;
};

export const parseRelativeDateToDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const cleanStr = dateStr.replace(/•/g, '').trim().toLowerCase();
    
    // Handle "just now", "1 min ago", etc.
    if (cleanStr.includes('now') || cleanStr.includes('second') || (cleanStr.includes('min') && !cleanStr.includes('month'))) {
        return new Date();
    }
    
    const parts = cleanStr.match(/(\d+)\s*([a-z]+)/);
    if (!parts) return null;
    
    const value = parseInt(parts[1], 10);
    const unit = parts[2];
    
    const now = new Date();
    if (unit.startsWith('h')) {
        now.setHours(now.getHours() - value);
    } else if (unit.startsWith('d')) {
        now.setDate(now.getDate() - value);
    } else if (unit.startsWith('w')) {
        now.setDate(now.getDate() - (value * 7));
    } else if (unit.startsWith('mo')) {
        now.setMonth(now.getMonth() - value);
    } else if (unit.startsWith('y')) {
        now.setFullYear(now.getFullYear() - value);
    } else if (unit.startsWith('m')) { // minutes fallback
        now.setMinutes(now.getMinutes() - value);
    }
    return now;
};

export const getPostDateObj = (post) => {
    if (!post) return null;
    if (post.dateObj instanceof Date && !isNaN(post.dateObj.getTime())) return post.dateObj;
    if (post.createdAt) {
        const d = new Date(post.createdAt);
        if (!isNaN(d.getTime())) return d;
    }
    if (post.urn) {
        const d = extractTimeFromUrn(post.urn);
        if (d) return d;
    }
    if (post.date) {
        const d = parseRelativeDateToDate(post.date);
        if (d) return d;
    }
    return null;
};

export const getPostHour = (urn) => {
    const date = extractTimeFromUrn(urn);
    if (!date) return null;
    return date.getHours(); // 0-23
};

// Keep the formatting function if needed elsewhere
export const formatTime = (urn) => {
    const date = extractTimeFromUrn(urn);
    if (!date) return null;
    return date.toLocaleString('en-US', {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

export const formatFullDate = (urn) => {
    const date = extractTimeFromUrn(urn);
    if (!date) return 'Unknown Date';
    return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};


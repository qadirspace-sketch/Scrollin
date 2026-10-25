import React from 'react';

// Thin outline icons for the app shell (the filled duotone set lives in Icon.jsx).
const PATHS = {
    home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
    recent: 'M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4M12 8v4l3 2',
    posts: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 9h8M8 13h8M8 17h5',
    performance: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
    timing: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7v5l3.5 2',
    topics: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
    hooks: 'M4 6h16M4 12h10M4 18h6',
    watchlist: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2',
    insights: 'M3 12h4l3-7 4 14 3-7h4',
    remix: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
    dna: 'M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12M8 7h8M8 17h8',
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
    sync: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
    sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
    panel: 'M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM9 4.5v15',
    close: 'M6 6l12 12M18 6L6 18',
    chevR: 'M9 6l6 6-6 6',
    chevD: 'M6 9l6 6 6-6',
    updown: 'M8 9l4-4 4 4M8 15l4 4 4-4',
    calendar: 'M5.5 5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3.5 10h17M8 3v4M16 3v4',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    check: 'M5 12l5 5 9-10',
    plus: 'M12 5v14M5 12h14',
    logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};

const LineIcon = ({ name, size = 18, color = 'currentColor', strokeWidth = 1.7, style }) => {
    const d = PATHS[name];
    if (!d) return null;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', display: 'block', ...style }}>
            <path d={d} />
        </svg>
    );
};

export default LineIcon;

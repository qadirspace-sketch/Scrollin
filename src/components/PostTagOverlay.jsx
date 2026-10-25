
import React from 'react';

const PostTagOverlay = ({ primaryTag, secondaryTag, confidence, source, topTopic }) => {
    // Style configurations
    const baseStyle = {
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        fontFamily: 'var(--font-family)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 10,
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
    };

    // ... (Map logic is unchanged, just referenced) ...
    const primaryColorMap = {
        "Career Advice": "#E3F2FD", // Blue
        "Personal Story": "#F3E5F5", // Purple
        "Opinion / Take": "#FFF3E0", // Orange
        "LinkedIn Platform": "#E8EAF6", // Indigo
        "Leadership": "#E0F2F1", // Teal
        "Marketing": "#FBE9E7", // Deep Orange
        "Hiring": "#F1F8E9", // Light Green
        "Productivity": "#FFF8E1", // Amber
        "Startup": "#ECEFF1", // Blue Gray
        "Software Engineering": "#E1F5FE", // Light Blue
        "Web Development": "#E0F7FA", // Cyan/Teal
        "AI / Tech": "#E0F7FA", // Cyan
        "Design / UX": "#FCE4EC", // Pink
        "Mental Health": "#F3E5F5", // Light Purple
        "Work Culture": "#FAFAFA", // Gray/White
        "Motivation": "#FFFDE7", // Light Yellow
        "Content Creation": "#F3E5F5", // Lavender
        "Finance / Investing": "#E8F5E9", // Green
        "Sales": "#FFEBEE", // Red
        "Freelancing": "#FBE9E7", // Peach
        "Cybersecurity": "#FFEBEE", // Pale Red
        "General": "#F5F5F5"
    };

    const textColorMap = {
        "Career Advice": "#1565C0",
        "Personal Story": "#7B1FA2",
        "Opinion / Take": "#E65100",
        "LinkedIn Platform": "#283593",
        "Leadership": "#00695C",
        "Marketing": "#D84315",
        "Hiring": "#33691E",
        "Productivity": "#FF8F00",
        "Startup": "#37474F",
        "Software Engineering": "#0277BD",
        "Web Development": "#006064",
        "AI / Tech": "#006064",
        "Design / UX": "#C2185B",
        "Mental Health": "#7B1FA2",
        "Work Culture": "#424242",
        "Motivation": "#FBC02D",
        "Content Creation": "#8E24AA",
        "Finance / Investing": "#2E7D32",
        "Sales": "#C62828",
        "Freelancing": "#D84315",
        "Cybersecurity": "#B71C1C",
        "General": "#616161"
    }

    const bg = primaryColorMap[primaryTag] || "#fff";
    const color = textColorMap[primaryTag] || "#333";

    return (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <div style={{ ...baseStyle, backgroundColor: bg, color: color, border: `1px solid ${color}20` }}>
                <span>{getTagIcon(primaryTag)}</span>
                <span>{primaryTag}</span>
                {/* Debug Mode: Show Source Explicitly */}
                <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.8 }}>
                    {source === 'ai' ? '✨ (AI)' : '(Rule)'} {confidence ? `| ${Math.round(confidence * 100)}%` : ''}
                </span>
            </div>
            {secondaryTag && (
                <div style={{ ...baseStyle, backgroundColor: '#f5f5f5', color: '#666', border: '1px solid #eee', transform: 'scale(0.9)' }}>
                    {secondaryTag}
                </div>
            )}

            {/* Top Topic Badge */}
            {topTopic && (
                <div style={{ ...baseStyle, backgroundColor: '#FFF8E1', color: '#F57F17', border: '1px solid #FFD54F', marginLeft: '4px' }} title="Top topic for this user (last 7 days)">
                    <span>🏆</span>
                    <span>{topTopic}</span>
                </div>
            )}
        </div>
    );
};

// Helper for icons
function getTagIcon(tag) {
    switch (tag) {
        case "Career Advice": return "💼";
        case "Personal Story": return "📖";
        case "Opinion / Take": return "🗣️";
        case "LinkedIn Platform": return "🔗";
        case "Leadership": return "👑";
        case "Marketing": return "📢";
        case "Hiring": return "🤝";
        case "Productivity": return "⚡";
        case "Startup": return "🚀";
        case "Software Engineering": return "💻";
        case "Web Development": return "🌐";
        case "AI / Tech": return "🤖";
        case "Design / UX": return "🎨";
        case "Mental Health": return "🧠";
        case "Work Culture": return "🏢";
        case "Motivation": return "🔥";
        case "Content Creation": return "✍️";
        case "Finance / Investing": return "💰";
        case "Sales": return "🏷️";
        case "Freelancing": return "🏖️";
        case "Cybersecurity": return "🛡️";
        default: return "📄";
    }
}

export default PostTagOverlay;

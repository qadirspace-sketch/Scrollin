
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
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E5E5',
    };

    // ... (Map logic is unchanged, just referenced) ...
    const primaryColorMap = {
        "Career Advice": "#F4F4F4", // Blue
        "Personal Story": "#F3E5F5", // Purple
        "Opinion / Take": "#FFF3E0", // Orange
        "LinkedIn Platform": "#F4F4F4", // Indigo
        "Leadership": "#E0F2F1", // Teal
        "Marketing": "#FBE9E7", // Deep Orange
        "Hiring": "#F1F8E9", // Light Green
        "Productivity": "#FFF8E1", // Amber
        "Startup": "#F4F4F4", // Blue Gray
        "Software Engineering": "#F4F4F4", // Light Blue
        "Web Development": "#E0F7FA", // Cyan/Teal
        "AI / Tech": "#E0F7FA", // Cyan
        "Design / UX": "#FCE4EC", // Pink
        "Mental Health": "#F3E5F5", // Light Purple
        "Work Culture": "#FFFFFF", // Gray/White
        "Motivation": "#FFFDE7", // Light Yellow
        "Content Creation": "#F3E5F5", // Lavender
        "Finance / Investing": "#E8F5E9", // Green
        "Sales": "#FFEBEE", // Red
        "Freelancing": "#FBE9E7", // Peach
        "Cybersecurity": "#FFEBEE", // Pale Red
        "General": "#FFFFFF"
    };

    const textColorMap = {
        "Career Advice": "#111111",
        "Personal Story": "#7B1FA2",
        "Opinion / Take": "#E65100",
        "LinkedIn Platform": "#111111",
        "Leadership": "#00695C",
        "Marketing": "#D84315",
        "Hiring": "#33691E",
        "Productivity": "#FF8F00",
        "Startup": "#333333",
        "Software Engineering": "#111111",
        "Web Development": "#006064",
        "AI / Tech": "#006064",
        "Design / UX": "#C2185B",
        "Mental Health": "#7B1FA2",
        "Work Culture": "#333333",
        "Motivation": "#FBC02D",
        "Content Creation": "#8E24AA",
        "Finance / Investing": "#2E7D32",
        "Sales": "#C62828",
        "Freelancing": "#D84315",
        "Cybersecurity": "#B71C1C",
        "General": "#6B6B6B"
    }

    const bg = primaryColorMap[primaryTag] || "#FFFFFF";
    const color = textColorMap[primaryTag] || "#333333";

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
                <div style={{ ...baseStyle, backgroundColor: '#FFFFFF', color: '#6B6B6B', border: '1px solid #F4F4F4', transform: 'scale(0.9)' }}>
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

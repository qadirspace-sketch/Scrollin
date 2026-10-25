import React, { useState } from 'react';
import Icon from './Icon';

const DashboardSidebar = ({ activeTab, onTabChange, profile, isFetching, fetchCount = 0, onLogout }) => {
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const menuItems = [
        { id: 'dashboard', iconName: 'dashboard', label: 'Dashboard', tabName: 'Dashboard' },
        { id: 'analytics', iconName: 'analytics', label: 'Posting Analytics', tabName: 'Posting Analytics' },
        { id: 'habits', iconName: 'habits', label: 'Posting Habits', tabName: 'Posting Habits' },
        { id: 'topics', iconName: 'topics', label: 'Topic Intelligence', tabName: 'Topic Intelligence' },
        { id: 'hooks', iconName: 'hooks', label: 'Hooks & Patterns', tabName: 'Hooks & Patterns' },
        { id: 'creators', iconName: 'creators', label: 'Creator Intelligence', tabName: 'Creator Intelligence' },
        { id: 'watchlist', iconName: 'watchlist', label: 'Watchlist', tabName: 'Watchlist' },
        { id: 'remix', iconName: 'remix', label: 'Idea Remix Lab', tabName: 'Idea Remix Lab' },
        { id: 'dna', iconName: 'dna', label: 'Full DNA Report', tabName: 'Full DNA Report' },
    ];

    const handleTabClick = (tabName) => {
        if (onTabChange) {
            onTabChange(tabName);
        }
    };

    const profileName = profile?.fullName || profile?.name || 'User';
    const profileImage = profile?.imageUrl || profile?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=6366f1&color=fff&bold=true`;
    const profileHeadline = profile?.headline || '';

    return (
        <div className="rail">
            {/* Logo */}
            <div className="rail-logo" title="Scrollin">
                <Icon name="bolt" size={22} color="#FFFFFF" />
            </div>

            {/* Navigation Buttons */}
            <div className="rail-nav">
                {menuItems.map((item, index) => {
                    const isActive = activeTab === item.tabName;
                    const showDot = item.id === 'dashboard' && isFetching;
                    return (
                        <button
                            key={index}
                            className={`rail-btn ${isActive ? 'active' : ''}`}
                            onClick={() => handleTabClick(item.tabName)}
                            title={item.label}
                        >
                            <Icon name={item.iconName} size={22} color={isActive ? '#FFFFFF' : 'var(--on-dark-mute)'} />
                            {showDot && <span className="rail-dot" />}
                            <span className="tip">{item.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* User Profile Footer */}
            <div className="rail-foot">
                <button 
                    className="rail-btn" 
                    onClick={() => handleTabClick('Watchlist')} 
                    title="Settings"
                >
                    <Icon name="settings" size={21} color="var(--on-dark-mute)" />
                    <span className="tip">Settings</span>
                </button>

                {/* Profile Avatar with Popover */}
                <div className="rail-profile-wrap">
                    <button
                        className="rail-avatar-btn"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        title={profileName}
                    >
                        <img
                            className="rail-avatar"
                            src={profileImage}
                            alt={profileName}
                        />
                        <span className="rail-avatar-ring" />
                    </button>

                    {/* Profile Popover Menu */}
                    {showProfileMenu && (
                        <div className="rail-profile-popover" onMouseLeave={() => setShowProfileMenu(false)}>
                            <div className="rail-profile-header">
                                <img
                                    className="rail-profile-av"
                                    src={profileImage}
                                    alt={profileName}
                                />
                                <div className="rail-profile-info">
                                    <div className="rail-profile-name">{profileName}</div>
                                    {profileHeadline && (
                                        <div className="rail-profile-headline">{profileHeadline}</div>
                                    )}
                                </div>
                            </div>
                            <div className="rail-profile-divider" />
                            <div className="rail-profile-stats">
                                <span>{fetchCount} posts tracked</span>
                            </div>
                            <div className="rail-profile-divider" />
                            <button className="rail-profile-logout" onClick={onLogout}>
                                <Icon name="logout" size={16} color="#ef4444" />
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Subtle Chevron indicator */}
            <div className="rail-chevron">
                <Icon name="chevR" size={11} color="var(--muted)" />
            </div>
        </div>
    );
};

export default DashboardSidebar;

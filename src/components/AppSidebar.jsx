import React, { useState, useEffect, useRef } from 'react';
import LineIcon from './LineIcon';

// Sidebar navigation. `id` values are the tab names the rest of the app already uses.
export const NAV_SECTIONS = [
    {
        items: [
            { id: 'Overview', label: 'Overview', icon: 'home' },
            { id: 'Posts', label: 'Posts', icon: 'posts', countKey: 'posts' },
            { id: 'Insights', label: 'Insights', icon: 'performance' },
        ]
    },
    { title: 'Track', items: [{ id: 'Creators', label: 'Creators', icon: 'watchlist', countKey: 'watchlist' }] },
    { title: 'Create', items: [{ id: 'Studio', label: 'Studio', icon: 'remix' }] },
];

export const labelForTab = (id) => {
    if (id === 'Settings') return 'Settings';
    for (const s of NAV_SECTIONS) for (const it of s.items) if (it.id === id) return it.label;
    return id;
};

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

const Avatar = ({ name, image, size = 30 }) => (
    image
        ? <img className="sx-av" src={image} alt="" width={size} height={size} style={{ width: size, height: size }} />
        : <span className="sx-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{initialsOf(name)}</span>
);
export { Avatar, initialsOf };

const AppSidebar = ({
    activeTab, onNavigate, creator, trackedCreators = [], counts = {}, recents = [],
    searchTerm, onSearchChange, onSearchSubmit, searchRef, isFetching, syncLabel, onCollapse,
}) => {
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [recentsOpen, setRecentsOpen] = useState(false);
    const switcherRef = useRef(null);

    useEffect(() => {
        if (!switcherOpen) return;
        const close = (e) => { if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [switcherOpen]);

    // Data comes from the LinkedIn page that's open, so switching creator opens their activity page
    const openCreator = (c) => {
        setSwitcherOpen(false);
        const url = c.profileUrl || `https://www.linkedin.com/in/${c.creatorId}/`;
        window.location.href = url.replace(/\/?$/, '/') + (url.includes('recent-activity') ? '' : 'recent-activity/all/');
    };

    return (
        <aside className="sx-side" aria-label="Scrollin navigation">
            <div className="sx-side-top" ref={switcherRef}>
                <div className="sx-logo" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.4" strokeLinecap="round"><path d="M5 7h14M5 12h9M5 17h5" /></svg>
                </div>
                <button type="button" className="sx-switch" onClick={() => setSwitcherOpen(o => !o)} aria-haspopup="menu" aria-expanded={switcherOpen}>
                    <Avatar name={creator?.name} image={creator?.image} size={30} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <span className="sx-switch-sub">Viewing</span>
                        <span className="sx-switch-name">{creator?.name || 'No profile open'}</span>
                    </span>
                    <LineIcon name="updown" size={16} color="#8A8A8A" />
                </button>
                {switcherOpen && (
                    <div className="sx-menu" role="menu" style={{ top: 58, left: 50 }}>
                        <div style={{ padding: '8px 10px 6px', fontSize: 12, color: 'var(--muted)' }}>Tracked creators</div>
                        {trackedCreators.length === 0 && (
                            <div style={{ padding: '6px 10px 10px', fontSize: 13, color: 'var(--muted)' }}>None yet. Add creators from the Watchlist.</div>
                        )}
                        {trackedCreators.map(c => (
                            <button key={c.creatorId} type="button" className="sx-mi" role="menuitem" onClick={() => openCreator(c)}>
                                <Avatar name={c.name || c.creatorId} size={24} />
                                <span className="sx-trunc" style={{ flex: 1 }}>{c.name || c.creatorId}</span>
                                <LineIcon name="external" size={14} color="#8A8A8A" />
                            </button>
                        ))}
                        <div style={{ height: 1, background: '#EEE', margin: '6px 0' }} />
                        <button type="button" className="sx-mi" role="menuitem" onClick={() => { setSwitcherOpen(false); onNavigate('Watchlist'); }}>
                            <LineIcon name="plus" size={16} /> Track a creator
                        </button>
                    </div>
                )}
            </div>

            <form className="sx-search" role="search" onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }}>
                <LineIcon name="search" size={16} color="#6B6B6B" />
                <label htmlFor="sx-quick-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search posts</label>
                <input id="sx-quick-search" ref={searchRef} type="search" placeholder="Search posts…" value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)} />
                <span className="sx-kbd">⌘K</span>
            </form>

            <nav className="sx-nav" aria-label="Main">
                {NAV_SECTIONS.map((section, si) => (
                    <React.Fragment key={si}>
                        {section.title && <div className="sx-group">{section.title}</div>}
                        {section.items.map(item => (
                            <React.Fragment key={item.id}>
                                <button type="button" className={`sx-item ${activeTab === item.id ? 'on' : ''}`}
                                    aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
                                    <LineIcon name={item.icon} color="#444" />
                                    {item.label}
                                    {item.countKey && counts[item.countKey] > 0 && <span className="sx-count">{counts[item.countKey]}</span>}
                                </button>
                                {item.id === 'Overview' && (
                                    <>
                                        <button type="button" className="sx-item" aria-expanded={recentsOpen} onClick={() => setRecentsOpen(o => !o)}>
                                            <LineIcon name="recent" color="#444" />
                                            Recents
                                            <span style={{ marginLeft: 'auto', color: '#8A8A8A', display: 'flex', transform: recentsOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                                                <LineIcon name="chevR" size={15} />
                                            </span>
                                        </button>
                                        {recentsOpen && (
                                            <div className="sx-sub">
                                                {recents.length === 0 && <div style={{ padding: '7px 10px', fontSize: 12.5, color: 'var(--muted)' }}>Nothing yet</div>}
                                                {recents.map((r, i) => (
                                                    <button key={i} type="button" className="sx-subitem" onClick={() => onNavigate(r.tab)}>
                                                        <b>{labelForTab(r.tab)}</b>
                                                        <span>{r.creator || '—'}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </React.Fragment>
                        ))}
                    </React.Fragment>
                ))}
                <div style={{ flex: 1, minHeight: 14 }} />
                <button type="button" className={`sx-item ${activeTab === 'Settings' ? 'on' : ''}`} aria-current={activeTab === 'Settings' ? 'page' : undefined} onClick={() => onNavigate('Settings')}>
                    <LineIcon name="settings" color="#444" /> Settings
                </button>
            </nav>

            <div className="sx-side-foot">
                <button type="button" className="sx-ibtn" onClick={onCollapse} aria-label="Collapse sidebar" title="Collapse sidebar">
                    <LineIcon name="panel" />
                </button>
                <span className="sx-sync">
                    <span className={`sx-dot ${isFetching ? 'live' : ''}`} />
                    <span className="sx-trunc">{syncLabel}</span>
                </span>
            </div>
        </aside>
    );
};

export default AppSidebar;

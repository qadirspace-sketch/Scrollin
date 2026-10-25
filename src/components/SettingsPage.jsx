import React, { useState } from 'react';
import LineIcon from './LineIcon';

const Row = ({ title, desc, children }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 20px', borderTop: '1px solid #F0F0F0' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 500 }}>{title}</div>
            {desc && <div style={{ fontSize: 13.5, color: '#6B6B6B', marginTop: 3, lineHeight: 1.45 }}>{desc}</div>}
        </div>
        {children}
    </div>
);

const SettingsPage = ({ authUser, postCount = 0, onLogout, onExport, onClearData }) => {
    const [confirming, setConfirming] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [cleared, setCleared] = useState(false);
    const name = authUser?.fullName || [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || authUser?.name || 'Signed in';
    const email = authUser?.primaryEmailAddress?.emailAddress || authUser?.email || '';

    const clearNow = async () => {
        setClearing(true);
        const ok = await onClearData();
        setClearing(false);
        setConfirming(false);
        setCleared(!!ok);
    };

    return (
        <div className="sx-page" style={{ maxWidth: 820 }}>
            <div className="sx-ph"><div><h1 className="sx-h1">Settings</h1><p className="sx-lede">Account and data stored in this browser</p></div></div>

            <section className="sx-card" aria-labelledby="set-acc" style={{ marginBottom: 24, overflow: 'hidden' }}>
                <div className="sx-ch" style={{ paddingBottom: 16 }}><h2 id="set-acc" className="sx-h2">Account</h2></div>
                <Row title={name} desc={email}>
                    <button type="button" className="sx-btn line" onClick={onLogout}><LineIcon name="logout" size={16} /> Sign out</button>
                </Row>
            </section>

            <section className="sx-card" aria-labelledby="set-data" style={{ marginBottom: 24, overflow: 'hidden' }}>
                <div className="sx-ch" style={{ paddingBottom: 16 }}><h2 id="set-data" className="sx-h2">Data</h2></div>
                <Row title="Export posts" desc={`Download the ${postCount} posts for the profile that's open as a text file.`}>
                    <button type="button" className="sx-btn line" onClick={onExport} disabled={!postCount}><LineIcon name="download" size={16} /> Export</button>
                </Row>
                <Row title="Delete all captured data" desc={cleared ? 'All captured posts were deleted.' : 'Removes every captured post and watchlist history from this browser. This cannot be undone.'}>
                    <button type="button" className="sx-btn danger" onClick={() => setConfirming(true)}><LineIcon name="trash" size={16} /> Delete all data</button>
                </Row>
            </section>

            <section className="sx-card" aria-labelledby="set-about" style={{ overflow: 'hidden' }}>
                <div className="sx-ch" style={{ paddingBottom: 16 }}><h2 id="set-about" className="sx-h2">About</h2></div>
                <Row title="Scrollin" desc="LinkedIn content intelligence · version 3.0" />
                <Row title="How scores work" desc="Engagement score = likes + 3×comments + 4×reposts. Lift compares a post with its creator's median from the last 90 days. Insights need at least 3 posts in a group and 5 posts per creator." />
            </section>

            {confirming && (
                <div className="sx-dialog-bg" onClick={() => !clearing && setConfirming(false)}>
                    <div className="sx-dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-desc" onClick={(e) => e.stopPropagation()}>
                        <h2 id="del-title" className="sx-h2" style={{ fontSize: 18 }}>Delete all captured data?</h2>
                        <p id="del-desc" style={{ margin: '8px 0 20px', fontSize: 14, lineHeight: 1.5, color: '#555555' }}>
                            Every captured post for every creator will be removed from this browser. You can capture them again by revisiting profiles.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button type="button" className="sx-btn line" onClick={() => setConfirming(false)} disabled={clearing} autoFocus>Cancel</button>
                            <button type="button" className="sx-btn danger" onClick={clearNow} disabled={clearing}>{clearing ? 'Deleting…' : 'Delete all data'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;

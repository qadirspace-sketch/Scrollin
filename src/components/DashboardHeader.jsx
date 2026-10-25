import React, { useState } from 'react';
import { Search, Bell, Plus, FileText, RefreshCw, Trash2 } from 'lucide-react';

const DashboardHeader = ({ onSearch, searchTerm, onDateFilter, dateFilter, fetchCount = 0, isFetching = false, onClearDB, onResync, onDownloadTXT, sortBy, onSortChange, onAddCreatorsClick, analyzeOwnContentOnly, setAnalyzeOwnContentOnly }) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            {/* Left Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Search */}
                <div style={{ position: 'relative', width: '320px' }}>
                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        placeholder="Search posts..."
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 36px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            color: '#000000',
                            WebkitAppearance: 'none',
                            appearance: 'none'
                        }}
                        onFocus={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.color = '#000000'; }}
                        onBlur={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.color = '#000000'; }}
                    />
                </div>

                {/* Sort Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500', whiteSpace: 'nowrap' }}>Sort by:</span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <select
                            value={sortBy}
                            onChange={(e) => onSortChange(e.target.value)}
                            style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '14px',
                                outline: 'none',
                                color: '#000000',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                minWidth: '130px'
                            }}
                        >
                            <option value="newest">Newest Post</option>
                            <option value="oldest">Oldest Post</option>
                            <option value="most_commented">Most Commented</option>
                            <option value="least_commented">Least Commented</option>
                            <option value="most_liked">Most Liked</option>
                            <option value="least_liked">Least Liked</option>
                            <option value="most_shared">Most Shared</option>
                            <option value="least_shared">Least Shared</option>
                        </select>
                        <svg style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#64748b' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </div>

            </div>

            {/* Right Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                {/* Own Content Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        onClick={() => setAnalyzeOwnContentOnly && setAnalyzeOwnContentOnly(!analyzeOwnContentOnly)}
                    >
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#000000', whiteSpace: 'nowrap' }}>Own content</span>
                        <div style={{
                            width: '36px', height: '20px',
                            backgroundColor: analyzeOwnContentOnly ? '#7B9F85' : '#cbd5e1',
                            borderRadius: '10px',
                            position: 'relative',
                            transition: 'background-color 0.2s'
                        }}>
                            <div style={{
                                width: '16px', height: '16px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '2px',
                                left: analyzeOwnContentOnly ? '18px' : '2px',
                                transition: 'left 0.2s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                            }}></div>
                        </div>
                    </div>
                </div>

                {/* Vertical Divider */}
                <div style={{ height: '24px', width: '1px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />

                {/* Actions */}
                <button
                    onClick={onDownloadTXT}
                    title="Download Posts as TXT"
                    style={{
                        padding: '8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <FileText size={16} />
                </button>

                <button
                    onClick={onResync}
                    title="Force Resync"
                    style={{
                        padding: '8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <RefreshCw size={16} />
                </button>

                <button
                    onClick={onClearDB}
                    title="Clear Database"
                    style={{
                        padding: '8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Trash2 size={16} />
                </button>

                {/* Add Creators Button */}
                <button
                    onClick={onAddCreatorsClick}
                    style={{
                        backgroundColor: '#CC4E2E',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4), 0 2px 4px -1px rgba(99, 102, 241, 0.2)'
                    }}>
                    <Plus size={16} strokeWidth={3} />
                    Add Creators
                </button>
            </div>
        </div>
    );
};



export default DashboardHeader;

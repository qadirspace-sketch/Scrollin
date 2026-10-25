import React, { useState, useEffect, useMemo } from 'react';
import { Folder, ArrowLeft, X, FileText, Download } from 'lucide-react';
import PostItem from './PostItem';
import { getTagsForPost } from '../utils/taggingService';
import { generateCSV, downloadCSV } from '../utils/csvExport';

const TagFolders = ({ posts, isOpen, onClose }) => {
    const [categorizedPosts, setCategorizedPosts] = useState({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [selectedTag, setSelectedTag] = useState(null);

    // Reset when closed
    useEffect(() => {
        if (!isOpen) {
            setSelectedTag(null);
        }
    }, [isOpen]);

    // Analyze posts when opened
    useEffect(() => {
        if (isOpen && posts.length > 0) {
            analyzePosts();
        }
    }, [isOpen, posts]);

    const analyzePosts = async () => {
        setIsAnalyzing(true);
        setProgress(0);

        const groups = {};
        const total = posts.length;
        let processed = 0;

        // Process in batches to avoid locking UI
        const batchSize = 10;

        for (let i = 0; i < total; i += batchSize) {
            const batch = posts.slice(i, i + batchSize);
            const promises = batch.map(async (post) => {
                if (!post.text) return { tag: 'General', post };

                // Use the full async tagging service (Cache -> Rules -> AI)
                // We pass URN to check cache
                const result = await getTagsForPost(post.text, post.urn);
                return { tag: result.primaryTag || 'General', post };
            });

            const results = await Promise.all(promises);

            results.forEach(({ tag, post }) => {
                if (!groups[tag]) groups[tag] = [];
                groups[tag].push(post);
            });

            processed += batch.length;
            setProgress(Math.floor((processed / total) * 100));

            // Small delay to let UI breathe if needed, though await allows microtasks
            await new Promise(r => setTimeout(r, 0));
        }

        setCategorizedPosts(groups);
        setIsAnalyzing(false);
    };

    const handleDownloadFolder = async (e, tag, groupPosts) => {
        e.stopPropagation(); // Prevent opening the folder

        if (!groupPosts || groupPosts.length === 0) {
            alert('No posts to export in this folder!');
            return;
        }

        try {
            const csvContent = await generateCSV(groupPosts);
            const timestamp = new Date().toISOString().slice(0, 10);
            const sanitizedTag = tag.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            downloadCSV(csvContent, `linkedin_${sanitizedTag}_${timestamp}.csv`);
        } catch (error) {
            console.error("Failed to generate CSV for folder", error);
            alert("Failed to generate CSV export.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="analytics-overlay" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#101010',
            zIndex: 100, // Higher than basic content
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            {/* Header */}
            <div className="sidebar-header" style={{
                padding: '16px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fff',
                width: '100%'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedTag ? (
                        <button
                            onClick={() => setSelectedTag(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#6b7280'
                            }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                    ) : (
                        <Folder size={20} color="#BF360C" />
                    )}
                    <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                        {selectedTag ? selectedTag : 'Tags Folders'}
                    </h2>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={24} color="#6b7280" />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#f9fafb' }}>

                {isAnalyzing ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#6b7280'
                    }}>
                        <div className="loading-spinner" style={{ marginBottom: '16px' }}></div>
                        <p>Categorizing posts...</p>
                        <div style={{
                            width: '200px',
                            height: '6px',
                            background: '#e5e7eb',
                            borderRadius: '3px',
                            marginTop: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: '#BF360C',
                                transition: 'width 0.2s ease'
                            }} />
                        </div>
                    </div>
                ) : selectedTag ? (
                    // Post List for Selected Tag
                    <div className="posts-container">
                        <div style={{ marginBottom: '16px', color: '#6b7280', fontSize: '13px' }}>
                            Showing {categorizedPosts[selectedTag]?.length} posts in {selectedTag}
                        </div>
                        {categorizedPosts[selectedTag]?.map((post, idx) => (
                            <PostItem key={post.urn || idx} post={post} />
                        ))}
                    </div>
                ) : (
                    // Folders Grid
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '16px'
                    }}>
                        {Object.entries(categorizedPosts).sort((a, b) => b[1].length - a[1].length).map(([tag, groupPosts]) => (
                            <div
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                style={{
                                    background: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                                className="folder-item"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                }}
                            >
                                <Folder size={40} color="#FBC02D" fill="#FFF8E1" style={{ marginBottom: '8px' }} />
                                <span style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    color: '#374151',
                                    marginBottom: '4px',
                                    lineHeight: '1.2'
                                }}>
                                    {tag}
                                </span>
                                <span style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                                    {groupPosts.length} posts
                                </span>

                                <button
                                    onClick={(e) => handleDownloadFolder(e, tag, groupPosts)}
                                    title={`Download ${tag} posts`}
                                    style={{
                                        background: '#f3f4f6',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        color: '#4b5563',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '11px',
                                        marginTop: 'auto'
                                    }}
                                    className="folder-download-btn"
                                >
                                    <Download size={12} />
                                    <span>CSV</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {!isAnalyzing && Object.keys(categorizedPosts).length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: '40px', color: '#9ca3af' }}>
                        No posts found to categorize.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TagFolders;

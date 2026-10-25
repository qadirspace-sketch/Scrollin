import React, { useState, useEffect } from 'react';
import Transcript from './Transcript';

const Media = ({ media }) => {
    if (media.type === 'image') {
        return <img src={media.url} className="post-image" alt="Post content" />;
    }

    if (media.type === 'video') {
        return <video src={media.url} controls className="post-video" />;
    }

    if (media.type === 'carousel') {
        return <Carousel media={media} />;
    }

    return null;
};

const Carousel = ({ media }) => {
    const [images, setImages] = useState(media.images || []);

    useEffect(() => {
        const fetchFullCarousel = async () => {
            if (!media.manifestUrl || (media.images && media.images.length >= 5)) return;

            try {
                const response = await fetch(media.manifestUrl);
                if (!response.ok) return;
                const data = await response.json();

                if (data.perResolutions && data.perResolutions.length > 0) {
                    const bestRes = data.perResolutions[data.perResolutions.length - 1];
                    if (bestRes.imageManifestUrl) {
                        const imgResponse = await fetch(bestRes.imageManifestUrl);
                        if (!imgResponse.ok) return;
                        const imgData = await imgResponse.json();

                        if (imgData.pages && imgData.pages.length > 0) {
                            setImages(imgData.pages);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load full carousel:", e);
            }
        };

        fetchFullCarousel();
    }, [media.manifestUrl, media.images]);

    const handleDownload = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(media.transcribedDocumentUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${media.title ? media.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'document'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback to opening in new tab if fetch fails
            window.open(media.transcribedDocumentUrl, '_blank');
        }
    };

    return (
        <>
            <div className="carousel-container">
                {images.map((url, index) => (
                    <img key={index} src={url} className="carousel-image" alt={`Page ${index + 1}`} />
                ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {media.manifestUrl && <Transcript manifestUrl={media.manifestUrl} />}
                {media.transcribedDocumentUrl && (
                    <button
                        onClick={handleDownload}
                        className="download-pdf-btn"
                        style={{ flex: 1 }}
                    >
                        Download PDF
                    </button>
                )}
            </div>
        </>
    );
};

export default Media;

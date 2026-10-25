import React, { useState } from 'react';

const Transcript = ({ manifestUrl }) => {
    const [loading, setLoading] = useState(false);
    const [text, setText] = useState(null);
    const [error, setError] = useState(null);

    const fetchTranscript = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Manifest
            const response = await fetch(manifestUrl);
            if (!response.ok) throw new Error("Failed to fetch manifest");
            const data = await response.json();

            // 2. Get Transcript URL
            if (!data.transcriptManifestUrl) {
                throw new Error("No transcript URL found in manifest");
            }

            // 3. Fetch Transcript Text
            const transcriptResponse = await fetch(data.transcriptManifestUrl);
            if (!transcriptResponse.ok) throw new Error("Failed to fetch transcript text");
            const transcriptText = await transcriptResponse.text();

            setText(transcriptText);
        } catch (e) {
            console.error("Error fetching transcript:", e);
            setError("Error loading text");
            setTimeout(() => setError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    if (text) {
        return (
            <div className="transcript-container">
                {text}
            </div>
        );
    }

    return (
        <button
            className="get-transcript-btn"
            onClick={fetchTranscript}
            disabled={loading}
        >
            {loading ? 'Loading...' : error ? error : 'Get Carousel Text'}
        </button>
    );
};

export default Transcript;

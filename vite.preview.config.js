// Dev-only config for previewing the Scrollin UI in a plain browser tab,
// outside LinkedIn and without the extension runtime. See preview/README.md.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';
import { resolve } from 'path';

const require = createRequire(import.meta.url);
const { calculateViralPosts } = require('./server/utils/viralScoreEngine');
const { analyzePatterns } = require('./server/utils/hookAnalysis');

// Serve the backend's pure analytics endpoints from the dev server so the
// preview gets real numbers without auth or a running backend.
const mockBackend = () => ({
    name: 'scrollin-mock-backend',
    configureServer(server) {
        server.middlewares.use('/__mock', (req, res) => {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                    const { posts, days, timeframe } = JSON.parse(body || '{}');
                    if (req.url.startsWith('/calculate-viral-posts')) {
                        res.end(JSON.stringify({ success: true, posts: calculateViralPosts(posts, days) }));
                    } else if (req.url.startsWith('/analyze-patterns')) {
                        const result = analyzePatterns(posts, timeframe);
                        res.end(JSON.stringify({ success: true, patterns: result.patterns, meta: result.meta }));
                    } else {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ success: false, error: 'Not mocked' }));
                    }
                } catch (e) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
        });
    }
});

export default defineConfig({
    root: resolve(__dirname, 'preview'),
    server: { port: 8080, fs: { allow: [resolve(__dirname)] } },
    plugins: [react(), mockBackend()],
    define: { 'process.env': {} }
});

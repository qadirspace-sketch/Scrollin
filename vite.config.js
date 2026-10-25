import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { obfuscator } from 'rollup-obfuscator';

export default defineConfig({
    server: {
        port: 8080
    },
    plugins: [
        react(),
        obfuscator({
            compact: true,
            controlFlowFlattening: false,
            controlFlowFlatteningThreshold: 0,
            numbersToExpressions: false,
            simplify: true,
            stringArray: true,
            stringArrayEncoding: ['base64', 'rc4'],
            stringArrayThreshold: 0.8,
            splitStrings: true,
            splitStringsChunkLength: 3,
            unicodeArrayThreshold: 0.8,
            debugProtection: false,
            debugProtectionInterval: 0
        })
    ],
    build: {
        minify: true,
        sourcemap: false,
        assetsInlineLimit: 1000000,
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/main.jsx'),
                background: resolve(__dirname, 'src/background.js')
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
            }
        },
        outDir: 'dist',
        emptyOutDir: true,
    },
    define: {
        'process.env': {}
    }
});

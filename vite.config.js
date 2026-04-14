import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    base: './',
    server: {
        open: '/index.src.html'
    },
    build: {
        rollupOptions: {
            input: {
                index: resolve(rootDir, 'index.src.html'),
                app: resolve(rootDir, 'app.src.html')
            }
        }
    }
});

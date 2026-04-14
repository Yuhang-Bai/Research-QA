import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    base: './',
    server: {
        open: '/'
    },
    build: {
        rollupOptions: {
            input: {
                index: resolve(rootDir, 'index.html'),
                app: resolve(rootDir, 'app.html')
            }
        }
    }
});

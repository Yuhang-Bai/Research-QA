import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const copies = [
    ['index.src.html', 'index.html'],
    ['app.src.html', 'app.html']
];

for (const [sourceName, targetName] of copies) {
    const sourcePath = resolve(distDir, sourceName);
    const targetPath = resolve(distDir, targetName);

    try {
        await access(sourcePath, constants.F_OK);
        await copyFile(sourcePath, targetPath);
    } catch (error) {
        console.warn(`Skipped ${sourceName}: ${error.message}`);
    }
}

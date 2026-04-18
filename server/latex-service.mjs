import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { buildProblemLatexDocument } from './latex-export.mjs';

const PORT = Number(process.env.RQ_LATEX_PORT || 18765);
const HOST = process.env.RQ_LATEX_HOST || '127.0.0.1';
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function withCorsHeaders(headers = {}) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        ...headers
    };
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, withCorsHeaders({
        'Content-Type': 'application/json; charset=utf-8'
    }));
    response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body) {
    response.writeHead(statusCode, withCorsHeaders({
        'Content-Type': 'text/plain; charset=utf-8'
    }));
    response.end(body);
}

function collectRequestBody(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;

        request.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Request body is too large.'));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });

        request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        request.on('error', reject);
    });
}

function runProcess(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            windowsHide: true,
            ...options
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', reject);
        child.on('close', (code) => {
            resolve({
                code,
                stdout,
                stderr
            });
        });
    });
}

async function commandExists(command) {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = await runProcess(locator, [command]);
    return result.code === 0;
}

async function detectCompiler() {
    const candidates = [
        {
            name: 'tectonic',
            check: ['tectonic'],
            run: async (texPath, workDir) => runProcess('tectonic', ['--keep-logs', '--outdir', workDir, texPath], { cwd: workDir })
        },
        {
            name: 'xelatex',
            check: ['xelatex'],
            run: async (texPath, workDir) => {
                const firstPass = await runProcess('xelatex', ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', texPath], { cwd: workDir });
                if (firstPass.code !== 0) {
                    return firstPass;
                }
                return runProcess('xelatex', ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', texPath], { cwd: workDir });
            }
        },
        {
            name: 'lualatex',
            check: ['lualatex'],
            run: async (texPath, workDir) => {
                const firstPass = await runProcess('lualatex', ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', texPath], { cwd: workDir });
                if (firstPass.code !== 0) {
                    return firstPass;
                }
                return runProcess('lualatex', ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', texPath], { cwd: workDir });
            }
        },
        {
            name: 'pdflatex',
            check: ['pdflatex'],
            run: async (texPath, workDir) => {
                const firstPass = await runProcess('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', texPath], { cwd: workDir });
                if (firstPass.code !== 0) {
                    return firstPass;
                }
                return runProcess('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', texPath], { cwd: workDir });
            }
        }
    ];

    for (const candidate of candidates) {
        const available = await Promise.all(candidate.check.map((command) => commandExists(command)));
        if (available.every(Boolean)) {
            return candidate;
        }
    }

    return null;
}

async function compileItemToPdf(item, options = {}) {
    const compiler = await detectCompiler();
    if (!compiler) {
        throw new Error('No LaTeX engine was found. Install Tectonic, XeLaTeX, LuaLaTeX, or pdfLaTeX and retry.');
    }

    const workDir = await mkdtemp(join(tmpdir(), 'rq-latex-'));
    const texPath = join(workDir, 'document.tex');
    const pdfPath = join(workDir, 'document.pdf');
    const logPath = join(workDir, 'document.log');

    try {
        const latexSource = buildProblemLatexDocument(item, options);
        await writeFile(texPath, latexSource, 'utf8');

        const result = await compiler.run(texPath, workDir);
        if (result.code !== 0) {
            let logTail = '';
            try {
                const logContent = await readFile(logPath, 'utf8');
                logTail = logContent.split(/\r?\n/).slice(-40).join('\n').trim();
            } catch (error) {
                logTail = '';
            }

            throw new Error([
                `Compile failed with ${compiler.name}.`,
                result.stderr.trim(),
                logTail
            ].filter(Boolean).join('\n\n'));
        }

        const pdf = await readFile(pdfPath);
        return {
            compiler: compiler.name,
            pdf
        };
    } finally {
        await rm(workDir, { recursive: true, force: true });
    }
}

function validateItemPayload(item) {
    return item && typeof item === 'object' && typeof item.title === 'string';
}

const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'OPTIONS') {
        response.writeHead(204, withCorsHeaders());
        response.end();
        return;
    }

    if (request.method === 'GET' && url.pathname === '/api/latex/health') {
        const compiler = await detectCompiler();
        sendJson(response, 200, {
            ok: true,
            compiler: compiler?.name || '',
            configuredPort: PORT
        });
        return;
    }

    if (request.method === 'POST' && url.pathname === '/api/latex/compile-pdf') {
        try {
            const rawBody = await collectRequestBody(request);
            const payload = JSON.parse(rawBody || '{}');
            if (!validateItemPayload(payload.item)) {
                sendJson(response, 400, { error: 'Expected a problem payload with title, desc, preamble, and answers.' });
                return;
            }

            const { pdf, compiler } = await compileItemToPdf(payload.item, { language: payload.language });
            response.writeHead(200, withCorsHeaders({
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="research-problem.pdf"',
                'X-RQ-Latex-Compiler': compiler
            }));
            response.end(pdf);
            return;
        } catch (error) {
            sendText(response, 500, error.message || 'LaTeX compile failed.');
            return;
        }
    }

    sendJson(response, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => {
    console.log(`Research QA LaTeX service listening on http://${HOST}:${PORT}/api/latex`);
});

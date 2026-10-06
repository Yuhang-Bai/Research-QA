import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
let server, browser, base;
const problem = (id = 'a', title = 'Original A') => ({ id, title, desc: 'Original statement', preamble: '',
    answers: [], date: '2026-10-01T12:00:00Z', isPinned: false, pinnedAt: '', sortRank: 0, shareId: '' });
const dbKey = 'rq_v2_local_database';
const mainKey = 'rq_v2_main_audit-main';
const config = { token: 'audit-fake-token-not-real', mainGistId: 'audit-main' };

test.before(async () => {
    await fs.access(path.join(root, 'index.html'));
    server = http.createServer(async (req, res) => {
        const relative = new URL(req.url, 'http://localhost').pathname;
        if (relative === '/__fixture') { res.setHeader('Content-Type', 'text/html'); res.end('<title>Isolated test fixture</title>'); return; }
        const target = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
        if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try { const content = await fs.readFile(target); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' })[path.extname(target)] || 'application/octet-stream'); res.end(content); }
        catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
});
test.after(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); });

async function context(t, mock) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = []; ctx.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    // Tests never send requests to GitHub or any other external service.
    await ctx.route('**/*', route => {
        if (route.request().url().startsWith(base)) return route.continue();
        if (new URL(route.request().url()).hostname === 'api.github.com' && mock) return mock(route);
        return route.abort();
    });
    t.after(async () => { await ctx.close(); assert.deepEqual(errors, []); });
    return ctx;
}
async function seed(ctx, items, settings = { token: '', mainGistId: '' }) {
    const p = await ctx.newPage(); await p.goto(base + '__fixture');
    await p.evaluate(async ({ items, settings }) => {
        localStorage.setItem('rq_v2_config', JSON.stringify(settings));
        const key = settings.mainGistId ? 'rq_v2_main_' + settings.mainGistId : 'rq_v2_local_database';
        await new Promise((resolve, reject) => {
            const request = indexedDB.open('research-qa-vite', 10);
            request.onupgradeneeded = () => request.result.createObjectStore('kv', { keyPath: 'key' });
            request.onsuccess = () => { const db = request.result, tx = db.transaction('kv', 'readwrite');
                for (const [id, value] of Object.entries({ [key]: { items, trash: [] }, [`${key}:version`]: 'v1', [`${key}:dirty`]: false })) tx.objectStore('kv').put({ key: id, value });
                tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
        });
    }, { items, settings }); await p.close();
}
async function read(p, key = dbKey) {
    return p.evaluate(key => new Promise((resolve, reject) => { const r = indexedDB.open('research-qa-vite'); r.onsuccess = () => {
        const db = r.result, q = db.transaction('kv').objectStore('kv').get(key);
        q.onsuccess = () => { db.close(); resolve(q.result?.value); }; q.onerror = () => reject(q.error); }; }), key);
}
async function open(ctx, query = '') {
    const p = await ctx.newPage(); p.setDefaultTimeout(10000); await p.goto(base + query);
    await p.waitForFunction(() => document.querySelector('#sync-status').textContent !== 'Not connected');
    if (query.includes('item=')) await p.locator('#detail-title').waitFor({ state: 'visible' });
    return p;
}
async function beginEdit(p, title) { await p.locator('#edit-problem-btn').click(); await p.locator('#composer-title-input').fill(title); }
async function save(p) { await p.locator('#save-composer-btn').click(); await p.locator('#composer').waitFor({ state: 'hidden' }); }
async function until(fn) { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 30)); } assert.fail('Timed out waiting for state'); }
const response = (data, version = 'v1') => ({ history: [{ version }], files: { 'main_db.json': { filename: 'main_db.json', content: JSON.stringify(data) } } });

test('different tabs preserve independent saves; same-field conflicts retain the draft', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]);
    const a = await open(c, '?item=a'), b = await open(c, '?item=b');
    await beginEdit(a, 'New A'); await beginEdit(b, 'New B'); await save(a); await save(b);
    assert.deepEqual((await read(b)).items.map(x => x.title), ['New A', 'New B']);
    const one = await open(c, '?item=a'), two = await open(c, '?item=a');
    await beginEdit(one, 'First writer'); await beginEdit(two, 'Second writer'); await save(one);
    await two.locator('#save-composer-btn').click(); await until(async () => (await two.locator('#toast-stack').innerText()).includes('another tab'));
    assert.equal(await two.locator('#composer-title-input').inputValue(), 'Second writer');
    assert.equal(await two.locator('#composer').isVisible(), true);
    assert.equal((await read(two)).items[0].title, 'First writer');
});

test('invalid import leaves storage intact; numeric IDs survive a UI export/import', async t => {
    const c = await context(t); await seed(c, [problem(1700000000000), problem(1700000000001, 'Numeric B')]);
    const p = await open(c); let dialogs = 0; p.on('dialog', d => { dialogs++; return d.accept(); });
    await p.locator('#import-file-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') });
    await until(async () => (await p.locator('#toast-stack').innerText()).includes('Import failed'));
    assert.equal((await read(p)).items.length, 2); assert.equal(dialogs, 0);
    const downloading = p.waitForEvent('download'); await p.locator('#export-btn').click(); const stream = await (await downloading).createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk); const bytes = Buffer.concat(chunks);
    assert.deepEqual(JSON.parse(bytes).library.problems.map(x => x.id), ['1700000000000', '1700000000001']);
    await p.locator('#import-file-input').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: bytes });
    await until(async () => (await p.locator('#toast-stack').innerText()).includes('Import completed'));
    assert.deepEqual((await read(p)).items.map(x => x.id), ['1700000000000', '1700000000001']);
    assert.equal((await read(p, dbKey + ':beforeImport')).items.length, 2);
    const popup = c.waitForEvent('page'); await p.locator('.problem-row').first().click(); const detail = await popup;
    await detail.waitForLoadState(); assert.ok(detail.url().includes('item=1700000000000'));
});

test('sharing and a later edit retain linkage and publish updated content', async t => {
    let shared;
    const c = await context(t, async route => {
        const req = route.request();
        if (req.method() === 'POST' || req.method() === 'PATCH') { shared = JSON.parse(JSON.parse(req.postData()).files['shared_item.json'].content); return route.fulfill({ json: { id: 'audit-share' } }); }
        return route.fulfill({ json: { files: { 'shared_item.json': { filename: 'shared_item.json', content: JSON.stringify(shared) } } } });
    });
    await seed(c, [problem()], { token: config.token, mainGistId: '' }); const p = await open(c, '?item=a');
    await p.locator('#share-item-btn').click(); await until(async () => (await read(p)).items[0].shareId === 'audit-share');
    await p.reload(); await p.locator('#detail-title').waitFor({ state: 'visible' }); await beginEdit(p, 'Updated share'); await save(p);
    await until(() => shared?.title === 'Updated share');
    assert.equal((await read(p)).items[0].shareId, 'audit-share'); await until(async () => !(await read(p, dbKey + ':dirty')));
});

test('offline shared edits survive reload and can be retried explicitly', async t => {
    let offline = true, published;
    const c = await context(t, route => { if (offline) return route.abort(); published = JSON.parse(JSON.parse(route.request().postData()).files['shared_item.json'].content); return route.fulfill({ json: { id: 'audit-share' } }); });
    await seed(c, [{ ...problem(), shareId: 'audit-share' }], { token: config.token, mainGistId: '' });
    const p = await open(c, '?item=a'); await beginEdit(p, 'Offline draft saved'); await save(p);
    assert.equal(await read(p, dbKey + ':dirty'), true); await p.reload(); await p.locator('#detail-title').waitFor({ state: 'visible' });
    assert.equal(await p.locator('#detail-title').innerText(), 'Offline draft saved');
    offline = false; await p.locator('#sync-btn').click(); await until(async () => !(await read(p, dbKey + ':dirty')));
    assert.equal(published.title, 'Offline draft saved');
});

test('closing during an upload preserves dirty state and prevents startup overwrite', async t => {
    let held, interrupted = true; const remote = { items: [problem()], trash: [] };
    const c = await context(t, route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: response(remote) });
        if (interrupted) return new Promise(resolve => { held = { route, resolve }; });
        return route.fulfill({ json: { history: [{ version: 'v2' }] } });
    });
    await seed(c, remote.items, config); const p = await open(c, '?item=a'); await beginEdit(p, 'Durable during upload'); await save(p); await until(() => held);
    assert.equal(await read(p, mainKey + ':dirty'), true); await p.close(); held.resolve();
    const next = await open(c, '?item=a'); assert.equal((await read(next, mainKey)).items[0].title, 'Durable during upload');
    interrupted = false; await next.locator('#sync-btn').click(); await until(async () => !(await read(next, mainKey + ':dirty')));
});

test('an old upload acknowledgement cannot clear newer pending edits', async t => {
    const remote = { items: [problem()], trash: [] }; let version = 'v1'; const held = [];
    const c = await context(t, route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: response(remote, version) });
        return new Promise(resolve => held.push({ route, resolve, payload: JSON.parse(JSON.parse(route.request().postData()).files['main_db.json'].content) }));
    });
    await seed(c, remote.items, config); const p = await open(c, '?item=a'); await beginEdit(p, 'First upload'); await save(p); await until(() => held.length === 1);
    await beginEdit(p, 'Newer edit'); await save(p);
    version = 'v2'; remote.items = held[0].payload.items; await held[0].route.fulfill({ json: { history: [{ version }] } }); held[0].resolve();
    await until(() => held.length === 2); assert.equal(await read(p, mainKey + ':dirty'), true);
    assert.equal(held[1].payload.items[0].title, 'Newer edit'); version = 'v3';
    await held[1].route.fulfill({ json: { history: [{ version }] } }); held[1].resolve();
    await until(async () => !(await read(p, mainKey + ':dirty'))); assert.equal((await read(p, mainKey)).items[0].title, 'Newer edit');
});

test('a slow startup pull cannot overwrite a local save made while it was pending', async t => {
    let firstGet; const original = { items: [problem()], trash: [] }; let remote = structuredClone(original), version = 'v1', gets = 0;
    const c = await context(t, route => {
        if (route.request().method() === 'GET') {
            if (gets++ === 0) return new Promise(resolve => { firstGet = { route, resolve }; });
            return route.fulfill({ json: response(remote, version) });
        }
        remote = JSON.parse(JSON.parse(route.request().postData()).files['main_db.json'].content); version = 'v2';
        return route.fulfill({ json: { history: [{ version }] } });
    });
    await seed(c, original.items, config); const p = await open(c, '?item=a'); await until(() => firstGet);
    await beginEdit(p, 'New while pull pending'); await save(p); await until(async () => !(await read(p, mainKey + ':dirty')));
    await firstGet.route.fulfill({ json: response(original, 'v1') }); firstGet.resolve(); await p.waitForTimeout(150);
    assert.equal((await read(p, mainKey)).items[0].title, 'New while pull pending');
});

test('details skip the hidden list; home uses bounded batches and searches all records', async t => {
    const c = await context(t); await seed(c, Array.from({ length: 1000 }, (_, i) => problem('p' + i, 'Problem ' + i)));
    const p = await open(c, '?item=p0'); assert.equal(await p.locator('.problem-row').count(), 0);
    await p.locator('#back-home-btn').click(); assert.equal(await p.locator('.problem-row').count(), 100);
    await p.locator('[data-load-more]').click(); assert.equal(await p.locator('.problem-row').count(), 200);
    await p.locator('#search-input').fill('Problem 999'); await until(async () => await p.locator('.problem-row').count() === 1);
    assert.ok((await p.locator('.problem-row').innerText()).includes('999'));
});

test('normal note edit/delete/restore works and cancelling new leaves no record', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a'); p.on('dialog', d => d.accept());
    await p.locator('#new-note-btn').click(); await p.locator('.cm-content').fill('New note marker'); await save(p);
    await p.locator('[data-note-action="edit"]').click(); await p.locator('.cm-content').fill('Edited note marker'); await save(p);
    assert.equal((await read(p)).items[0].answers[0].text, 'Edited note marker');
    await p.locator('[data-note-action="delete"]').click(); await until(async () => (await read(p)).trash.length === 1);
    const id = (await read(p)).trash[0].id; const trash = await open(c, '?view=trash&item=' + encodeURIComponent(id));
    await trash.locator('#restore-item-btn').click(); await until(async () => (await read(trash)).trash.length === 0);
    assert.equal((await read(trash)).items[0].answers[0].text, 'Edited note marker');
    await trash.locator('#back-home-btn').click(); await trash.locator('#create-item-btn').click(); await trash.locator('#cancel-composer-btn').click();
    await trash.locator('#back-home-btn').click(); assert.equal(await trash.locator('.problem-row').count(), 1);
});

test('returning home offers to preserve an unsaved draft', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a'); let prompted = false;
    p.on('dialog', async d => { prompted = true; await d.dismiss(); }); await beginEdit(p, 'Unsaved title');
    await p.locator('#back-home-btn').click(); assert.equal(prompted, true);
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Unsaved title'); assert.ok(p.url().includes('item=a'));
});

test('new main-gist setup saves the local library before a failed first upload', async t => {
    let offline = true, published;
    const c = await context(t, route => {
        if (route.request().method() === 'POST') return route.fulfill({ json: { id: 'audit-main' } });
        if (offline) return route.abort();
        if (route.request().method() === 'GET') return route.fulfill({ json: response({ items: [], trash: [] }) });
        published = JSON.parse(JSON.parse(route.request().postData()).files['main_db.json'].content);
        return route.fulfill({ json: { history: [{ version: 'v2' }] } });
    });
    await seed(c, [problem()]); const p = await open(c); await p.locator('#config-btn').click();
    await p.locator('#config-token-input').fill(config.token); await p.locator('#save-config-btn').click();
    await p.locator('#config-modal').waitFor({ state: 'hidden' });
    assert.equal((await read(p, mainKey)).items[0].title, 'Original A'); assert.equal(await read(p, mainKey + ':dirty'), true);
    await p.reload(); assert.equal(await p.locator('.problem-row').count(), 1);
    offline = false; await p.locator('#sync-btn').click(); await until(async () => !(await read(p, mainKey + ':dirty')));
    assert.equal(published.items[0].title, 'Original A');
});

test('unknown non-empty remote is never overwritten by a dirty local cache', async t => {
    let patches = 0; const remote = { items: [problem('remote', 'Keep remote')], trash: [] };
    const c = await context(t, route => { if (route.request().method() === 'PATCH') patches++; return route.fulfill({ json: response(remote) }); });
    await seed(c, [problem()], config); const setup = await c.newPage(); await setup.goto(base + '__fixture');
    await setup.evaluate(() => new Promise(resolve => { const r = indexedDB.open('research-qa-vite'); r.onsuccess = () => {
        const db = r.result, tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ key: 'rq_v2_main_audit-main:version', value: '' }); tx.objectStore('kv').put({ key: 'rq_v2_main_audit-main:dirty', value: true });
        tx.oncomplete = () => { db.close(); resolve(); }; }; })); await setup.close();
    const p = await open(c); await p.locator('#sync-btn').click();
    await until(async () => (await p.locator('#toast-stack').innerText()).includes('base version is unknown'));
    assert.equal(patches, 0); assert.equal((await read(p, mainKey)).items[0].title, 'Original A'); assert.equal(await read(p, mainKey + ':dirty'), true);
});

test('toggling one note preserves the other rendered note elements', async t => {
    const c = await context(t); const p0 = problem(); p0.answers = [0, 1, 2].map(i => ({ id: 'note-' + i, text: 'Text $x_' + i + '$', date: p0.date }));
    await seed(c, [p0]); const p = await open(c, '?item=a');
    await p.evaluate(() => { window.untouchedNote = document.querySelector('[data-note-id="note-1"]'); });
    for (let i = 0; i < 5; i++) await p.locator('[data-note-action="toggle"]').first().click();
    assert.equal(await p.evaluate(() => window.untouchedNote === document.querySelector('[data-note-id="note-1"]')), true);
});

test('an arriving pull does not replace the comparison base of an open draft', async t => {
    let held;
    const c = await context(t, route => new Promise(resolve => { held = { route, resolve }; }));
    await seed(c, [problem()], config); const p = await open(c, '?item=a'); await until(() => held);
    await beginEdit(p, 'Unsaved local draft');
    await held.route.fulfill({ json: response({ items: [problem('a', 'Remote changed')], trash: [] }, 'v2') }); held.resolve();
    await p.waitForTimeout(100);
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Unsaved local draft');
    assert.equal((await read(p, mainKey)).items[0].title, 'Original A');
    assert.equal(await p.locator('#detail-title').innerText(), 'Original A');
});

test('a failed local transaction retains the draft and cannot start an upload', async t => {
    let patches = 0;
    const c = await context(t, route => { if (route.request().method() === 'PATCH') patches++; return route.abort(); });
    await seed(c, [problem()]); const p = await open(c, '?item=a');
    await p.evaluate(() => { const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (record, ...args) {
        if (record.key === 'rq_v2_local_database:dirty') throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
        return original.call(this, record, ...args);
    }; });
    await beginEdit(p, 'Must remain a draft'); await p.locator('#save-composer-btn').click();
    await until(async () => (await p.locator('#toast-stack').innerText()).includes('quota'));
    assert.equal((await read(p)).items[0].title, 'Original A'); assert.equal(patches, 0);
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Must remain a draft');
    assert.equal(await p.locator('#composer').isVisible(), true);
});

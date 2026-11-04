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

async function context(t, mock, options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
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
// Exercise disclosure menus as users do, rather than forcing hidden buttons.
async function clickAction(p, selector) {
    const target = p.locator(selector);
    const details = target.locator('xpath=ancestor::details[1]');
    if (await details.count() && !(await details.evaluate(element => element.open))) {
        await details.locator(':scope > summary').click();
    }
    await target.click();
}
const row = (p, id) => p.locator(`.problem-row[data-item-id=${JSON.stringify(String(id))}]`);
async function selectRow(p, id) {
    await row(p, id).locator('a.problem-row-link').click();
    await until(async () => new URL(p.url()).searchParams.get('item') === String(id));
}
async function visibleIds(p) { return p.locator('.problem-row').evaluateAll(rows => rows.map(row => row.dataset.itemId)); }
async function assertNoHorizontalOverflow(p) {
    const dimensions = await p.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.width + 1, JSON.stringify(dimensions));
    assert.ok(dimensions.body <= dimensions.width + 1, JSON.stringify(dimensions));
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
    const downloading = p.waitForEvent('download'); await clickAction(p, '#export-btn'); const stream = await (await downloading).createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk); const bytes = Buffer.concat(chunks);
    assert.deepEqual(JSON.parse(bytes).library.problems.map(x => x.id), ['1700000000000', '1700000000001']);
    await p.locator('#import-file-input').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: bytes });
    await until(async () => (await p.locator('#toast-stack').innerText()).includes('Import completed'));
    assert.deepEqual((await read(p)).items.map(x => x.id), ['1700000000000', '1700000000001']);
    assert.equal((await read(p, dbKey + ':beforeImport')).items.length, 2);
    const pageCount = c.pages().length; await selectRow(p, '1700000000000');
    assert.equal(c.pages().length, pageCount); assert.ok(p.url().includes('item=1700000000000'));
});

test('sharing and a later edit retain linkage and publish updated content', async t => {
    let shared;
    const c = await context(t, async route => {
        const req = route.request();
        if (req.method() === 'POST' || req.method() === 'PATCH') { shared = JSON.parse(JSON.parse(req.postData()).files['shared_item.json'].content); return route.fulfill({ json: { id: 'audit-share' } }); }
        return route.fulfill({ json: { files: { 'shared_item.json': { filename: 'shared_item.json', content: JSON.stringify(shared) } } } });
    });
    await seed(c, [problem()], { token: config.token, mainGistId: '' }); const p = await open(c, '?item=a');
    await clickAction(p, '#share-item-btn'); await until(async () => (await read(p)).items[0].shareId === 'audit-share');
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
    offline = false; await clickAction(p, '#sync-btn'); await until(async () => !(await read(p, dbKey + ':dirty')));
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
    interrupted = false; await clickAction(next, '#sync-btn'); await until(async () => !(await read(next, mainKey + ':dirty')));
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

test('the persistent sidebar uses bounded compact batches and searches all records', async t => {
    const c = await context(t); await seed(c, Array.from({ length: 1000 }, (_, i) => problem('p' + i, 'Problem ' + i)));
    const p = await open(c, '?item=p0'); assert.equal(await p.locator('.problem-row').count(), 100);
    assert.equal(await p.locator('#library-sidebar').isVisible(), true);
    assert.equal(await p.locator('.problem-row-excerpt').count(), 0);
    assert.equal(await p.locator('.problem-row[data-draggable="true"]').count(), 0);
    await clickAction(p, '#back-home-btn'); assert.equal(await p.locator('.problem-row').count(), 100);
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
    await clickAction(trash, '#restore-item-btn'); await until(async () => (await read(trash)).trash.length === 0);
    assert.equal((await read(trash)).items[0].answers[0].text, 'Edited note marker');
    await clickAction(trash, '#back-home-btn'); await trash.locator('#create-item-btn').click(); await trash.locator('#cancel-composer-btn').click();
    await clickAction(trash, '#back-home-btn'); assert.equal(await trash.locator('.problem-row').count(), 1);
});

test('returning home offers to preserve an unsaved draft', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a'); let prompted = false;
    p.on('dialog', async d => { prompted = true; await d.dismiss(); }); await beginEdit(p, 'Unsaved title');
    await clickAction(p, '#back-home-btn'); assert.equal(prompted, true);
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
    await seed(c, [problem()]); const p = await open(c); await clickAction(p, '#config-btn');
    await p.locator('#config-token-input').fill(config.token); await p.locator('#save-config-btn').click();
    await p.locator('#config-modal').waitFor({ state: 'hidden' });
    assert.equal((await read(p, mainKey)).items[0].title, 'Original A'); assert.equal(await read(p, mainKey + ':dirty'), true);
    await p.reload(); assert.equal(await p.locator('.problem-row').count(), 1);
    offline = false; await clickAction(p, '#sync-btn'); await until(async () => !(await read(p, mainKey + ':dirty')));
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
    const p = await open(c); await clickAction(p, '#sync-btn');
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

// Notebook navigation: all fixtures are synthetic and stay inside isolated contexts.
test('sidebar selection stays in the workspace and Back/Forward restores selections', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]);
    const p = await open(c); const pages = c.pages().length;
    await selectRow(p, 'a'); assert.equal(await p.locator('#detail-title').innerText(), 'Original A');
    await selectRow(p, 'b'); assert.equal(await p.locator('#detail-title').innerText(), 'Original B');
    assert.equal(c.pages().length, pages); assert.equal(await p.locator('#library-sidebar').isVisible(), true);
    assert.equal(await row(p, 'b').locator('a.problem-row-link').getAttribute('aria-current'), 'page');
    await p.goBack(); await until(async () => (await p.locator('#detail-title').innerText()) === 'Original A');
    assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
    await p.goForward(); await until(async () => (await p.locator('#detail-title').innerText()) === 'Original B');
    assert.equal(new URL(p.url()).searchParams.get('item'), 'b');
});

test('the explicit open-tab action preserves the current document', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]);
    const p = await open(c, '?item=a'); const popup = c.waitForEvent('page');
    await row(p, 'b').locator('[data-list-action="open-tab"]').click(); const detail = await popup;
    await detail.waitForLoadState(); await detail.locator('#detail-title').waitFor({ state: 'visible' });
    assert.equal(new URL(detail.url()).searchParams.get('item'), 'b');
    assert.equal(await detail.locator('#detail-title').innerText(), 'Original B');
    assert.equal(await detail.evaluate(() => window.opener), null);
    assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
    assert.equal(await p.locator('#detail-title').innerText(), 'Original A');
});

test('repeated selected-row clicks preserve the open draft and do not add history', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    let dialogs = 0; p.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
    await beginEdit(p, 'Draft title'); await p.locator('.cm-content').fill('Draft body');
    const historyLength = await p.evaluate(() => history.length);
    for (let i = 0; i < 3; i++) await row(p, 'a').locator('a.problem-row-link').click();
    assert.equal(dialogs, 0); assert.equal(await p.evaluate(() => history.length), historyLength);
    assert.equal(await p.locator('#composer').isVisible(), true);
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Draft title');
    assert.equal(await p.locator('.cm-content').innerText(), 'Draft body');
    assert.equal((await read(p)).items[0].title, 'Original A');
});

test('rejecting sidebar, Trash, and New navigation preserves the draft and route', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    let dialogs = 0; p.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
    await beginEdit(p, 'Keep this draft'); await p.locator('.cm-content').fill('Uncommitted body');
    await p.locator('#composer-preamble-input').fill('\\newcommand{\\R}{\\mathbb{R}}');
    for (const selector of ['.problem-row[data-item-id="b"] a.problem-row-link', '[data-view-mode="trash"]', '#create-item-btn']) {
        await p.locator(selector).click();
        assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
        assert.equal(new URL(p.url()).searchParams.has('view'), false);
        assert.equal(await p.locator('#composer-title-input').inputValue(), 'Keep this draft');
        assert.equal(await p.locator('.cm-content').innerText(), 'Uncommitted body');
        assert.equal(await p.locator('#composer-preamble-input').inputValue(), '\\newcommand{\\R}{\\mathbb{R}}');
        assert.equal(await p.locator('[data-view-mode="active"]').evaluate(element => element.classList.contains('active')), true);
    }
    assert.equal(dialogs, 3); assert.equal((await read(p)).items.length, 2);
    assert.equal((await read(p)).items[0].title, 'Original A');
});

test('accepting sidebar navigation discards only the unsaved draft', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    let dialogs = 0; p.on('dialog', async dialog => { dialogs++; await dialog.accept(); });
    await beginEdit(p, 'Discard this title'); await p.locator('.cm-content').fill('Discard this body');
    await selectRow(p, 'b'); await p.locator('#composer').waitFor({ state: 'hidden' });
    assert.equal(dialogs, 1); assert.equal(await p.locator('#detail-title').innerText(), 'Original B');
    assert.deepEqual((await read(p)).items.map(item => [item.title, item.desc]), [
        ['Original A', 'Original statement'], ['Original B', 'Original statement']
    ]);
    await selectRow(p, 'a'); await p.locator('#edit-problem-btn').click();
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Original A');
    assert.equal(await p.locator('.cm-content').innerText(), 'Original statement');
});

test('cancelled browser Back keeps the draft and later Back/Forward still work', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    await selectRow(p, 'b'); await beginEdit(p, 'Keep B draft');
    let accept = false, dialogs = 0; p.on('dialog', async dialog => { dialogs++; await (accept ? dialog.accept() : dialog.dismiss()); });
    await p.goBack(); await until(() => dialogs === 1);
    assert.equal(new URL(p.url()).searchParams.get('item'), 'b');
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Keep B draft');
    assert.equal(await p.locator('#composer').isVisible(), true);
    accept = true; await p.goBack(); await until(async () => (await p.locator('#detail-title').innerText()) === 'Original A');
    assert.equal(await p.locator('#composer').isVisible(), false);
    await p.goForward(); await until(async () => (await p.locator('#detail-title').innerText()) === 'Original B');
    assert.equal((await read(p)).items.find(item => item.id === 'b').title, 'Original B');
});

test('library filters, derived tags, and note search leave the current document intact', async t => {
    const c = await context(t); const a = { ...problem(), desc: 'Working statement #algebra', isPinned: true };
    const b = { ...problem('b', 'Original B'), answers: [{ id: 'n-b', text: 'A private note marker #topology', date: a.date }] };
    const shared = { ...problem('c', 'Shared C'), desc: 'Another statement #algebra', shareId: 'audit-existing-share' };
    await seed(c, [a, b, shared]); const p = await open(c, '?item=a');
    await p.locator('#library-filter-panel > summary').click();
    for (const [filter, ids] of [['pinned', ['a']], ['notes', ['b']], ['shared', ['c']]]) {
        await p.locator(`[data-library-filter="${filter}"]`).click();
        await until(async () => JSON.stringify(await visibleIds(p)) === JSON.stringify(ids));
        assert.equal(await p.locator('#detail-title').innerText(), 'Original A');
        assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
        assert.equal(await p.locator('.problem-row[data-draggable="true"]').count(), 0);
    }
    await p.locator('[data-library-filter="all"]').click();
    await p.locator('[data-library-tag]').filter({ hasText: /algebra/i }).first().click();
    await until(async () => JSON.stringify(await visibleIds(p)) === JSON.stringify(['a', 'c']));
    // Clicking the selected tag clears it without changing the active document.
    await p.locator('[data-library-tag]').filter({ hasText: /algebra/i }).first().click();
    await p.locator('#search-input').fill('private note marker');
    await until(async () => JSON.stringify(await visibleIds(p)) === JSON.stringify(['b']));
    assert.equal(await p.locator('#detail-title').innerText(), 'Original A');
    assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
    await p.locator('#search-input').fill('No match synthetic token');
    await until(async () => (await visibleIds(p)).length === 0);
    assert.equal(await p.locator('#detail-title').innerText(), 'Original A');
});

test('renaming and pinning update the persistent sidebar without reopening the problem', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    await beginEdit(p, 'Renamed in notebook'); await save(p);
    assert.ok((await row(p, 'a').innerText()).includes('Renamed in notebook'));
    assert.equal(await p.locator('#detail-title').innerText(), 'Renamed in notebook');
    await clickAction(p, '#pin-item-btn'); await until(async () => (await read(p)).items.find(item => item.id === 'a').isPinned);
    await clickAction(p, '[data-library-filter="pinned"]'); await until(async () => JSON.stringify(await visibleIds(p)) === '["a"]');
    await clickAction(p, '#pin-item-btn'); await until(async () => !(await read(p)).items.find(item => item.id === 'a').isPinned);
    await until(async () => (await visibleIds(p)).length === 0);
    assert.equal(await p.locator('#detail-title').innerText(), 'Renamed in notebook');
    assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
});

test('keyboard Enter opens a sidebar link in the current workspace', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    const pages = c.pages().length; await row(p, 'b').locator('a.problem-row-link').focus(); await p.keyboard.press('Enter');
    await until(async () => new URL(p.url()).searchParams.get('item') === 'b');
    assert.equal(await p.locator('#detail-title').innerText(), 'Original B'); assert.equal(c.pages().length, pages);
});

test('navigation in the same event turn as Save cannot move or corrupt the saving document', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    p.on('dialog', dialog => dialog.dismiss()); await beginEdit(p, 'Saved A only');
    // Dispatch in one event turn so navigation lands during the asynchronous IDB commit.
    await p.evaluate(() => {
        document.querySelector('#save-composer-btn').click();
        document.querySelector('.problem-row[data-item-id="b"] a.problem-row-link').click();
        document.querySelector('[data-view-mode="trash"]').click();
        document.querySelector('#create-item-btn').click();
    });
    await p.locator('#composer').waitFor({ state: 'hidden' });
    assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
    assert.equal(new URL(p.url()).searchParams.has('view'), false);
    assert.equal(await p.locator('#detail-title').innerText(), 'Saved A only');
    assert.deepEqual((await read(p)).items.map(item => [item.id, item.title]), [['a', 'Saved A only'], ['b', 'Original B']]);
});

test('a delayed legacy-share hydration cannot replace the home workspace after leaving', async t => {
    let held; const c = await context(t, route => new Promise(resolve => { held = { route, resolve }; }));
    await seed(c, [{ ...problem(), desc: '', shareId: 'audit-late-share' }, problem('b', 'Original B')]); const p = await open(c);
    await selectRow(p, 'a'); await until(() => held); await clickAction(p, '#back-home-btn');
    await held.route.fulfill({ json: { files: { 'shared_item.json': { filename: 'shared_item.json', content: JSON.stringify({ ...problem(), title: 'Too late remote title', desc: 'Late hydrated statement' }) } } } });
    held.resolve(); await p.waitForTimeout(150);
    assert.equal(new URL(p.url()).searchParams.has('item'), false);
    assert.equal(await p.locator('#detail-view').isVisible(), false);
    assert.equal(await p.locator('#library-sidebar').isVisible(), true);
    assert.equal((await read(p)).items.find(item => item.id === 'a').desc, '');
    await selectRow(p, 'b'); assert.equal(await p.locator('#detail-title').innerText(), 'Original B');
});

test('visitor shares remain read-only and do not expose the owned library', async t => {
    let writes = 0; const c = await context(t, route => {
        if (route.request().method() !== 'GET') writes++;
        return route.fulfill({ json: { files: { 'shared_item.json': { filename: 'shared_item.json', content: JSON.stringify(problem('visitor', 'Visitor document')) } } } });
    });
    await seed(c, [problem('private', 'Owned private document')]); const p = await open(c, '?gist=audit-visitor');
    await until(async () => (await p.locator('#detail-title').innerText()) === 'Visitor document');
    assert.equal(await p.locator('#library-sidebar').isVisible(), false);
    assert.equal(await p.locator('#library-toggle-btn').isVisible(), false);
    assert.equal(await p.locator('.problem-row').count(), 0);
    assert.equal(await p.locator('#edit-problem-btn').isEnabled(), false);
    assert.equal(await p.locator('#new-note-btn').isEnabled(), false);
    assert.equal(await p.locator('#share-item-btn').isEnabled(), false);
    assert.equal((await read(p)).items[0].title, 'Owned private document'); assert.equal(writes, 0);
});

test('desktop Source, Preview, and Split preserve one draft and keep Save available', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    await beginEdit(p, 'Three editor views'); await p.locator('.cm-content').fill('View switch draft marker');
    for (const mode of ['preview', 'source', 'split']) {
        await p.locator(`button[data-editor-view="${mode}"]`).click();
        assert.equal(await p.locator('#save-composer-btn').isVisible(), true);
        assert.equal(await p.locator('#composer-title-input').inputValue(), 'Three editor views');
        if (mode !== 'source') {
            await until(async () => (await p.locator('#composer-preview').innerText()).includes('View switch draft marker'));
            assert.equal(await p.locator('#composer-preview').isVisible(), true);
        }
        if (mode !== 'preview') assert.equal(await p.locator('.cm-content').isVisible(), true);
    }
    await save(p); assert.equal((await read(p)).items[0].desc, 'View switch draft marker');
});

test('390px mobile drawer, Escape, preview, and save work without horizontal overflow', async t => {
    const c = await context(t, undefined, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    await assertNoHorizontalOverflow(p);
    assert.equal(await p.locator('#library-toggle-btn').isVisible(), true);
    await p.locator('#library-toggle-btn').click();
    assert.equal(await p.locator('#library-toggle-btn').getAttribute('aria-expanded'), 'true');
    assert.equal(await p.locator('#library-scrim').isVisible(), true); await assertNoHorizontalOverflow(p);
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#library-toggle-btn').getAttribute('aria-expanded'), 'false');
    assert.equal(await p.locator('#library-scrim').isVisible(), false);
    await p.locator('#library-toggle-btn').click(); await row(p, 'a').locator('a.problem-row-link').click();
    assert.equal(await p.locator('#library-toggle-btn').getAttribute('aria-expanded'), 'false');
    await p.locator('#library-toggle-btn').click(); await selectRow(p, 'b');
    assert.equal(await p.locator('#library-toggle-btn').getAttribute('aria-expanded'), 'false');
    await beginEdit(p, 'Mobile saved title');
    await p.locator('button[data-editor-view="source"]').click(); await p.locator('.cm-content').fill('Mobile draft body');
    await assertNoHorizontalOverflow(p);
    await p.locator('button[data-editor-view="preview"]').click();
    await until(async () => (await p.locator('#composer-preview').innerText()).includes('Mobile draft body'));
    assert.equal(await p.locator('#composer-preview').isVisible(), true);
    assert.equal(await p.locator('#save-composer-btn').isVisible(), true); await assertNoHorizontalOverflow(p);
    const saveBounds = await p.locator('#save-composer-btn').boundingBox();
    assert.ok(saveBounds && saveBounds.y >= 0 && saveBounds.y + saveBounds.height <= 845, JSON.stringify(saveBounds));
    await save(p);
    assert.equal((await read(p)).items.find(item => item.id === 'b').desc, 'Mobile draft body');
    assert.equal(await p.locator('#detail-title').innerText(), 'Mobile saved title'); await assertNoHorizontalOverflow(p);
});


test('changing language after opening the editor preserves its controls and unsaved draft', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    await beginEdit(p, 'Language-independent draft'); await p.locator('.cm-content').fill('Draft body stays here');
    await clickAction(p, '#language-btn');
    assert.equal(await p.locator('html').getAttribute('lang'), 'zh-CN');
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Language-independent draft');
    assert.equal(await p.locator('.cm-content').innerText(), 'Draft body stays here');
    assert.equal(await p.locator('button[data-editor-view]').count(), 3);
    assert.equal(await p.locator('#save-composer-btn').isVisible(), true);
    await clickAction(p, '#language-btn');
    assert.equal(await p.locator('html').getAttribute('lang'), 'en');
    await save(p); assert.equal((await read(p)).items[0].desc, 'Draft body stays here');
});


test('rejecting draft discard before deleting the selected sidebar row leaves data intact', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    const dialogs = []; p.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await (/unsaved/i.test(dialog.message()) ? dialog.dismiss() : dialog.accept());
    });
    await beginEdit(p, 'Keep the selected draft'); await row(p, 'a').click({ button: 'right' });
    await until(() => dialogs.some(message => /unsaved/i.test(message)));
    assert.equal((await read(p)).items.length, 2); assert.equal((await read(p)).trash.length, 0);
    assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
    assert.equal(await p.locator('#composer').isVisible(), true);
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Keep the selected draft');
});

test('delayed sharing links only its source problem after same-tab navigation', async t => {
    let held, posts = 0; const published = [];
    const c = await context(t, route => {
        if (route.request().method() === 'POST') {
            posts++;
            return new Promise(resolve => { held = { route, resolve }; });
        }
        if (route.request().method() === 'PATCH') {
            published.push(JSON.parse(JSON.parse(route.request().postData()).files['shared_item.json'].content));
            return route.fulfill({ json: { id: 'audit-delayed-share' } });
        }
        return route.abort();
    });
    await seed(c, [problem(), problem('b', 'Original B')], { token: config.token, mainGistId: '' });
    const p = await open(c, '?item=a'); await clickAction(p, '#share-item-btn'); await until(() => held);
    // Repeated commands while the request is in flight must not create more copies.
    await p.evaluate(() => { document.querySelector('#share-item-btn').click(); document.querySelector('#share-item-btn').click(); });
    await selectRow(p, 'b'); await p.locator('#edit-problem-btn').click();
    assert.equal(await p.locator('#composer').isVisible(), false);
    await held.route.fulfill({ json: { id: 'audit-delayed-share' } }); held.resolve();
    await until(async () => (await read(p)).items.find(item => item.id === 'a').shareId === 'audit-delayed-share');
    await until(async () => !(await read(p, dbKey + ':dirty')));
    await until(async () => await p.locator('#share-item-btn').isEnabled());
    assert.equal(posts, 1); assert.equal(new URL(p.url()).searchParams.get('item'), 'b');
    assert.equal((await read(p)).items.find(item => item.id === 'b').shareId, '');
    await beginEdit(p, 'B stays private'); await save(p);
    assert.equal((await read(p)).items.find(item => item.id === 'b').shareId, '');
    assert.ok(published.length > 0); assert.ok(published.every(item => item.id === 'a'));
    await selectRow(p, 'a'); assert.equal(await p.locator('#share-item-btn').isEnabled(), true);
});

test('deleting a shared summary invalidates its pending hydration and returns home', async t => {
    let held; const c = await context(t, route => new Promise(resolve => { held = { route, resolve }; }));
    await seed(c, [{ ...problem(), desc: '', shareId: 'audit-delete-share' }, problem('b', 'Original B')]);
    const p = await open(c); p.on('dialog', dialog => dialog.accept()); await selectRow(p, 'a'); await until(() => held);
    await row(p, 'a').click({ button: 'right' });
    await until(async () => (await read(p)).trash.some(item => item.id === 'a'));
    assert.equal(new URL(p.url()).searchParams.has('item'), false);
    await held.route.fulfill({ json: { files: { 'shared_item.json': { filename: 'shared_item.json', content: JSON.stringify({ ...problem(), title: 'Deleted remote copy', desc: 'Must not reappear' }) } } } });
    held.resolve(); await p.waitForTimeout(150);
    assert.equal(await p.locator('#detail-view').isVisible(), false);
    assert.equal(new URL(p.url()).searchParams.has('item'), false);
    assert.deepEqual((await read(p)).items.map(item => item.id), ['b']);
    assert.equal((await read(p)).trash.find(item => item.id === 'a').desc, '');
});

test('sidebar mutations cannot advance an open draft baseline past another tab edit', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]);
    const draft = await open(c, '?item=a'), writer = await open(c, '?item=a');
    await beginEdit(draft, 'Local title draft'); await draft.locator('.cm-content').fill('Local competing body');
    await writer.locator('#edit-problem-btn').click(); await writer.locator('.cm-content').fill('Other tab body'); await save(writer);
    await row(draft, 'b').locator('[data-list-action="pin"]').click();
    await until(async () => (await draft.locator('#toast-stack').innerText()).includes('close the editor'));
    await row(draft, 'b').click({ button: 'right' });
    assert.equal((await read(draft)).items.find(item => item.id === 'b').isPinned, false);
    assert.equal((await read(draft)).items.length, 2); assert.equal((await read(draft)).trash.length, 0);
    assert.equal(await draft.locator('.problem-row[data-draggable="true"]').count(), 0);
    await draft.locator('#save-composer-btn').click();
    await until(async () => (await draft.locator('#toast-stack').innerText()).includes('another tab'));
    assert.equal((await read(draft)).items.find(item => item.id === 'a').desc, 'Other tab body');
    assert.equal(await draft.locator('#composer').isVisible(), true);
    assert.equal(await draft.locator('.cm-content').innerText(), 'Local competing body');
});

test('Escape dismisses menus and settings and respects consumed editor events', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    let dialogs = 0; p.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
    await beginEdit(p, 'Escape-safe draft'); await p.locator('.cm-content').fill('Preserved Escape body');
    await p.locator('#workspace-menu > summary').click(); await p.keyboard.press('Escape');
    assert.equal(await p.locator('#workspace-menu').evaluate(menu => menu.open), false);
    assert.equal(await p.locator('#composer').isVisible(), true); assert.equal(dialogs, 0);
    await p.locator('.cm-content').evaluate(editor => {
        // Model an inner editor command that consumes Escape before document listeners.
        editor.addEventListener('keydown', event => event.preventDefault(), { once: true });
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    assert.equal(await p.locator('#composer').isVisible(), true); assert.equal(dialogs, 0);
    await clickAction(p, '#config-btn'); await p.locator('#config-modal').waitFor({ state: 'visible' });
    await p.keyboard.press('Escape'); await p.locator('#config-modal').waitFor({ state: 'hidden' });
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Escape-safe draft');
    assert.equal(await p.locator('.cm-content').innerText(), 'Preserved Escape body'); assert.equal(dialogs, 0);
});

test('a desktop Split draft survives tablet and mobile resizing with Save in view', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    await beginEdit(p, 'Responsive split draft'); await p.locator('.cm-content').fill('Resized draft content');
    await p.locator('button[data-editor-view="split"]').click();
    await p.setViewportSize({ width: 1100, height: 800 });
    assert.equal(await p.locator('#composer').evaluate(editor => getComputedStyle(editor).position), 'static');
    assert.equal(await p.locator('#library-sidebar').isVisible(), true); await assertNoHorizontalOverflow(p);
    await p.setViewportSize({ width: 390, height: 844 });
    await until(async () => (await p.locator('#library-toggle-btn').getAttribute('aria-expanded')) === 'false');
    assert.equal(await p.locator('#composer').isVisible(), true);
    assert.equal(await p.locator('.cm-content').isVisible(), true);
    assert.equal(await p.locator('button[data-editor-view="split"]').isVisible(), false);
    assert.equal(await p.locator('.cm-content').innerText(), 'Resized draft content');
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Responsive split draft');
    const bounds = await p.locator('#save-composer-btn').boundingBox();
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 845, JSON.stringify(bounds));
    await assertNoHorizontalOverflow(p); await save(p);
    assert.equal((await read(p)).items[0].desc, 'Resized draft content');
});

test('mobile visitor pages have no library drawer and keep the shared document readable', async t => {
    const c = await context(t, route => route.fulfill({ json: { files: { 'shared_item.json': { filename: 'shared_item.json', content: JSON.stringify(problem('visitor', 'Mobile visitor document')) } } } }),
        { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await seed(c, [problem('private', 'Private local problem')]); const p = await open(c, '?gist=audit-mobile-visitor');
    await until(async () => (await p.locator('#detail-title').innerText()) === 'Mobile visitor document');
    assert.equal(await p.locator('#library-toggle-btn').isVisible(), false);
    assert.equal(await p.locator('#library-sidebar').isVisible(), false);
    assert.equal(await p.locator('#library-scrim').isVisible(), false);
    assert.equal(await p.locator('.main-panel').evaluate(panel => panel.inert), false);
    assert.equal(await p.locator('#edit-problem-btn').isEnabled(), false);
    await assertNoHorizontalOverflow(p);
    await p.locator('#context-toggle-btn').click(); assert.equal(await p.locator('#context-panel').isVisible(), true);
    await p.keyboard.press('Escape'); assert.equal(await p.locator('#context-panel').isVisible(), false);
    assert.equal(await p.locator('#detail-title').isVisible(), true);
    assert.equal((await read(p)).items[0].title, 'Private local problem');
});

test('finishing a current-item deletion does not override a newer sidebar selection', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    p.on('dialog', dialog => dialog.accept());
    await p.evaluate(() => {
        document.querySelector('.problem-row[data-item-id="a"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        document.querySelector('.problem-row[data-item-id="b"] a.problem-row-link').click();
    });
    await until(async () => (await p.locator('#toast-stack').innerText()).includes('Problem moved to trash'));
    assert.equal(new URL(p.url()).searchParams.get('item'), 'b');
    assert.equal(await p.locator('#detail-title').innerText(), 'Original B');
    assert.deepEqual((await read(p)).items.map(item => item.id), ['b']);
    assert.equal((await read(p)).trash[0].id, 'a');
});

test('an in-flight sidebar pin blocks editor entry until its comparison baseline is committed', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    const immediate = await p.evaluate(() => {
        document.querySelector('.problem-row[data-item-id="b"] [data-list-action="pin"]').click();
        document.querySelector('#edit-problem-btn').click();
        document.querySelector('#new-note-btn').click();
        document.querySelector('#create-item-btn').click();
        return { editorOpened: !document.querySelector('#composer').classList.contains('hidden'), item: new URL(location.href).searchParams.get('item') };
    });
    assert.equal(immediate.editorOpened, false); assert.equal(immediate.item, 'a');
    await until(async () => (await read(p)).items.find(item => item.id === 'b').isPinned);
    await until(async () => !(await p.locator('#workspace-save-status').innerText()).includes('Saving'));
    await beginEdit(p, 'Edited after pin committed'); await save(p);
    assert.equal((await read(p)).items.find(item => item.id === 'a').title, 'Edited after pin committed');
    assert.equal((await read(p)).items.find(item => item.id === 'b').isPinned, true);
    assert.equal((await read(p)).items.length, 2);
});


async function assertTagPanelLayout(p, expectedTags) {
    const metrics = await p.locator('.tag-panel').evaluate(panel => {
        const heading = panel.querySelector('h2').getBoundingClientRect();
        const tags = panel.querySelector('#library-tags');
        const body = tags.getBoundingClientRect();
        return {
            display: getComputedStyle(panel).display,
            panelWidth: panel.clientWidth, panelScrollWidth: panel.scrollWidth,
            tagsWidth: tags.clientWidth, tagsScrollWidth: tags.scrollWidth,
            headingBottom: heading.bottom, tagsTop: body.top,
            panelLeft: panel.getBoundingClientRect().left, tagsLeft: body.left,
            buttons: [...tags.querySelectorAll('button')].map(button => ({
                width: button.getBoundingClientRect().width,
                clientWidth: button.clientWidth, scrollWidth: button.scrollWidth
            }))
        };
    });
    assert.equal(metrics.display, 'block', JSON.stringify(metrics));
    assert.ok(metrics.tagsTop >= metrics.headingBottom, JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.tagsLeft - metrics.panelLeft) <= 1, JSON.stringify(metrics));
    assert.ok(metrics.tagsWidth >= metrics.panelWidth - 20, JSON.stringify(metrics));
    assert.ok(metrics.panelScrollWidth <= metrics.panelWidth + 1, JSON.stringify(metrics));
    assert.ok(metrics.tagsScrollWidth <= metrics.tagsWidth + 1, JSON.stringify(metrics));
    assert.equal(metrics.buttons.length, expectedTags);
    for (const button of metrics.buttons) {
        assert.ok(button.width <= metrics.tagsWidth + 1, JSON.stringify(metrics));
        assert.ok(button.scrollWidth <= button.clientWidth + 1, JSON.stringify(metrics));
    }
    await assertNoHorizontalOverflow(p);
}

for (const filled of [false, true]) {
    test(`the ${filled ? 'filled' : 'empty'} Tags panel stays single-column without horizontal overflow`, async t => {
        const c = await context(t);
        const longTag = 'long_research_tag_' + 'x'.repeat(70);
        await seed(c, filled ? [{ ...problem(), desc: `Statement #algebra #图论 #${longTag}` }] : []);
        const p = await open(c, filled ? '?item=a' : '');
        await p.locator('#library-filter-panel > summary').click();
        for (const width of [1586, 1100, 390]) {
            await p.setViewportSize({ width, height: 1000 });
            if (width === 390 && filled) {
                await p.locator('#library-toggle-btn').click();
                assert.equal(await p.locator('#library-toggle-btn').getAttribute('aria-expanded'), 'true');
            }
            await assertTagPanelLayout(p, filled ? 3 : 0);
            assert.equal(await p.locator('.tag-hint').isVisible(), !filled);
        }
    });
}

async function directoryScreenshot(p, name) {
    if (!process.env.RESEARCH_QA_SCREENSHOT_DIR) return;
    await fs.mkdir(process.env.RESEARCH_QA_SCREENSHOT_DIR, { recursive: true });
    await p.screenshot({ path: path.join(process.env.RESEARCH_QA_SCREENSHOT_DIR, name + '.png'), animations: 'disabled' });
    const metrics = await p.evaluate(() => {
        const bounds = selector => {
            const element = document.querySelector(selector), box = element.getBoundingClientRect();
            return { width: box.width, height: box.height, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight };
        };
        return { fixture: 'Synthetic data only; all external requests intercepted', viewport: { width: innerWidth, height: innerHeight },
            sidebar: bounds('#library-sidebar'), list: bounds('#problem-list'), firstTitle: bounds('.problem-row h3'),
            expanded: document.querySelector('#directory-dialog').open };
    });
    await fs.writeFile(path.join(process.env.RESEARCH_QA_SCREENSHOT_DIR, name + '.json'), JSON.stringify({ browser: browser.version(), ...metrics }, null, 2));
}
const longDirectoryTitle = 'Synthetic question: classification of compact operators and spectral bounds under changing boundary conditions — 完整长标题与数学问题检索 — ' + 'unbroken_identifier_'.repeat(12);
const directoryItems = () => Array.from({ length: 230 }, (_, i) => ({
    ...problem('directory-' + i, i === 7 ? longDirectoryTitle : `Synthetic research question ${String(i).padStart(3, '0')}: estimates, examples and open directions`),
    desc: i === 229 ? 'Synthetic body marker needle-at-the-end #analysis' : 'Synthetic statement #analysis',
    answers: i === 9 ? [{ id: 'synthetic-note', text: 'note-only-directory-marker', date: '2026-10-01T12:00:00Z' }] : []
}));

test('New from the expanded directory returns to the existing editor and saves one local problem', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    await p.locator('#expand-directory-btn').click(); await p.locator('#create-item-btn').click();
    assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.open), false);
    assert.equal(await p.locator('#composer').isVisible(), true);
    assert.equal((await read(p)).items.length, 1);
    await p.locator('#composer-title-input').fill('Synthetic problem from directory');
    await p.locator('.cm-content').fill('Synthetic equation $x^2 + y^2 = 1$'); await save(p);
    const saved = await read(p);
    assert.equal(saved.items.length, 2); assert.equal(saved.items.find(item => item.id === 'a').title, 'Original A');
    assert.equal(saved.items.find(item => item.id !== 'a').desc, 'Synthetic equation $x^2 + y^2 = 1$');
    await p.locator('#expand-directory-btn').click(); await selectRow(p, 'a');
    assert.equal(await p.locator('#detail-title').innerText(), 'Original A');
});

test('directory defaults give the list space and resizing/collapse persist without changing data', async t => {
    const c = await context(t, null, { viewport: { width: 1180, height: 757 } });
    await seed(c, directoryItems()); const p = await open(c, '?item=directory-0');
    const before = await read(p);
    const sidebar = p.locator('#library-sidebar'), list = p.locator('#problem-list'), handle = p.locator('#directory-resizer');
    assert.equal(Math.round((await sidebar.boundingBox()).width), 340);
    assert.equal(await p.locator('#library-filter-panel').evaluate(panel => panel.open), false);
    const bounds = await list.boundingBox();
    assert.ok(bounds.width >= 300 && bounds.height >= 300, JSON.stringify(bounds));
    await directoryScreenshot(p, '01-desktop-1180');
    const separator = await handle.boundingBox();
    await p.mouse.move(separator.x + separator.width / 2, separator.y + 100);
    await p.mouse.down(); await p.mouse.move(separator.x + 93, separator.y + 100, { steps: 10 }); await p.mouse.up();
    const resized = Math.round((await sidebar.boundingBox()).width);
    assert.ok(resized >= 425 && resized <= 435, String(resized));
    await handle.focus(); await p.keyboard.press('Home'); assert.equal(Math.round((await sidebar.boundingBox()).width), 280);
    await p.keyboard.press('End'); assert.equal(Math.round((await sidebar.boundingBox()).width), 520);
    await p.keyboard.press('ArrowLeft'); assert.equal(Math.round((await sidebar.boundingBox()).width), 500);
    await p.reload(); await p.locator('#detail-title').waitFor(); assert.equal(Math.round((await sidebar.boundingBox()).width), 500);
    await p.locator('#collapse-library-btn').click(); assert.equal(await sidebar.isVisible(), false);
    assert.equal(await p.locator('#library-toggle-btn').getAttribute('aria-expanded'), 'false');
    await directoryScreenshot(p, '02-desktop-collapsed');
    await p.reload(); await p.locator('#detail-title').waitFor(); assert.equal(await sidebar.isVisible(), false);
    await p.locator('#library-toggle-btn').click(); assert.equal(Math.round((await sidebar.boundingBox()).width), 500);
    await p.setViewportSize({ width: 761, height: 757 });
    assert.ok((await sidebar.boundingBox()).width <= 341); await assertNoHorizontalOverflow(p);
    await p.setViewportSize({ width: 1180, height: 757 }); assert.equal(Math.round((await sidebar.boundingBox()).width), 500);
    await handle.dblclick(); assert.equal(Math.round((await sidebar.boundingBox()).width), 340);
    assert.deepEqual(await read(p), before); assert.equal(await read(p, dbKey + ':dirty'), false);
});

test('expanded directory shows full titles, searches all batches and returns to reading with history', async t => {
    const c = await context(t, null, { viewport: { width: 1180, height: 757 } });
    await seed(c, directoryItems()); const p = await open(c, '?item=directory-0'); const pages = c.pages().length;
    await p.locator('#expand-directory-btn').click();
    assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.open), true);
    assert.equal(await p.locator('#search-input').evaluate(input => input === document.activeElement), true);
    assert.equal(await p.locator('.problem-row').count(), 100);
    const title = row(p, 'directory-7').locator('h3');
    assert.equal(await title.innerText(), longDirectoryTitle);
    const metrics = await title.evaluate(h => ({ clamp: getComputedStyle(h).webkitLineClamp, height: h.clientHeight, scrollHeight: h.scrollHeight, width: h.clientWidth, scrollWidth: h.scrollWidth }));
    assert.equal(metrics.clamp, 'none'); assert.ok(metrics.scrollHeight <= metrics.height + 1); assert.ok(metrics.scrollWidth <= metrics.width + 1);
    await title.scrollIntoViewIfNeeded(); await directoryScreenshot(p, '03-expanded-full-title');
    await p.locator('[data-load-more]').click(); assert.equal(await p.locator('.problem-row').count(), 200);
    await p.locator('#search-input').fill('needle-at-the-end'); await until(async () => JSON.stringify(await visibleIds(p)) === '["directory-229"]');
    await selectRow(p, 'directory-229'); assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.open), false);
    assert.ok((await p.locator('#detail-title').innerText()).includes('229')); assert.equal(c.pages().length, pages);
    assert.equal(await p.locator('#search-input').inputValue(), 'needle-at-the-end');
    await p.goBack(); await until(async () => (await p.locator('#detail-title').innerText()).includes('000'));
    await p.goForward(); await until(async () => (await p.locator('#detail-title').innerText()).includes('229'));
    await p.locator('#expand-directory-btn').click(); await p.locator('#search-input').fill('note-only-directory-marker');
    await until(async () => JSON.stringify(await visibleIds(p)) === '["directory-9"]');
    await p.locator('#search-input').fill('synthetic-absent-token'); await until(async () => (await visibleIds(p)).length === 0);
    assert.equal(await p.locator('#directory-results').innerText(), '0 / 230');
    assert.equal(await p.locator('#directory-results').getAttribute('aria-label'), '0 of 230 results');
    await p.locator('#close-directory-btn').click(); assert.ok((await p.locator('#detail-title').innerText()).includes('229'));
    await assertNoHorizontalOverflow(p);
});

test('directory filters stay discoverable when folded and survive expanded browsing', async t => {
    const c = await context(t); const items = directoryItems(); items[3].isPinned = true;
    await seed(c, items); const p = await open(c, '?item=directory-0');
    const fullHeight = (await p.locator('#problem-list').boundingBox()).height;
    await p.locator('#library-filter-panel > summary').click(); await p.locator('[data-library-filter="pinned"]').click();
    await until(async () => JSON.stringify(await visibleIds(p)) === '["directory-3"]');
    await p.locator('#library-filter-panel > summary').click();
    assert.ok((await p.locator('#active-filter-label').innerText()).includes('Pinned'));
    assert.ok((await p.locator('#problem-list').boundingBox()).height >= fullHeight - 1);
    await p.locator('#expand-directory-btn').click(); assert.deepEqual(await visibleIds(p), ['directory-3']);
    await clickAction(p, '[data-library-filter="all"]'); await p.locator('[data-library-tag="analysis"]').click();
    await p.locator('#library-filter-panel > summary').click(); assert.ok((await p.locator('#active-filter-label').innerText()).includes('#analysis'));
    await p.keyboard.press('Escape'); assert.equal(new URL(p.url()).searchParams.get('item'), 'directory-0');
});

test('repeated directory opens, Escape, selection and draft rejection retain one functional list', async t => {
    const c = await context(t); await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c, '?item=a');
    const before = await read(p); let discard = false;
    p.on('dialog', dialog => discard ? dialog.accept() : dialog.dismiss());
    await beginEdit(p, 'Protected directory draft'); await p.locator('.cm-content').fill('Synthetic $x^2$ draft');
    for (let i = 0; i < 8; i++) {
        await p.locator('#expand-directory-btn').click();
        await row(p, 'b').locator('a').click();
        assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
        assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.open), true);
        await p.keyboard.press('Escape');
        assert.equal(await p.locator('#composer-title-input').inputValue(), 'Protected directory draft');
        assert.equal(await p.locator('.cm-content').innerText(), 'Synthetic $x^2$ draft');
        assert.equal(await p.locator('#problem-list').count(), 1);
        assert.equal(await p.locator('#library-sidebar').evaluate(sidebar => sidebar.parentElement.classList.contains('workspace')), true);
        assert.equal(await p.locator('#expand-directory-btn').evaluate(button => button === document.activeElement), true);
    }
    assert.deepEqual(await read(p), before);
    await p.locator('#expand-directory-btn').click(); discard = true; await selectRow(p, 'b');
    assert.equal(await p.locator('#composer').isVisible(), false); assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.open), false);
    assert.deepEqual(await read(p), before);
    await p.locator('#expand-directory-btn').click(); await row(p, 'b').locator('a').click();
    assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.open), false);
});

test('mobile expanded directory keeps full titles, modal focus and reversible drawer state', async t => {
    const c = await context(t, null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await seed(c, directoryItems()); const p = await open(c, '?item=directory-0');
    for (let i = 0; i < 3; i++) {
        await p.locator('#library-toggle-btn').click(); await p.locator('#expand-directory-btn').click();
        await p.locator('#search-input').fill('完整长标题'); await until(async () => JSON.stringify(await visibleIds(p)) === '["directory-7"]');
        const h = row(p, 'directory-7').locator('h3');
        assert.equal(await h.innerText(), longDirectoryTitle);
        assert.equal(await h.evaluate(h => h.scrollHeight <= h.clientHeight + 1 && h.scrollWidth <= h.clientWidth + 1), true);
        await assertNoHorizontalOverflow(p);
        if (!i) await directoryScreenshot(p, '04-mobile-expanded');
        await p.locator('#close-directory-btn').focus(); await p.keyboard.press('Shift+Tab');
        assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.contains(document.activeElement)), true);
        await selectRow(p, 'directory-7');
        assert.equal(await p.locator('#directory-dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await p.locator('#library-toggle-btn').getAttribute('aria-expanded'), 'false');
        assert.equal(await p.locator('.main-panel').evaluate(panel => panel.inert), false);
        await p.locator('#library-sidebar').waitFor({ state: 'hidden' });
        assert.equal(await p.locator('#library-sidebar').isVisible(), false);
    }
    await p.locator('#library-toggle-btn').click(); await p.locator('#expand-directory-btn').click();
    await p.setViewportSize({ width: 1180, height: 757 }); await p.keyboard.press('Escape');
    assert.equal(await p.locator('#library-sidebar').isVisible(), true);
    assert.equal(await p.locator('.main-panel').evaluate(panel => panel.inert), false);
    await p.setViewportSize({ width: 320, height: 568 }); await p.locator('#library-toggle-btn').click();
    await p.locator('#expand-directory-btn').click(); await assertNoHorizontalOverflow(p); await p.keyboard.press('Escape');
    await p.keyboard.press('Escape'); await p.locator('#library-sidebar').waitFor({ state: 'hidden' });
    assert.equal(await p.locator('#library-sidebar').isVisible(), false);
    assert.equal(await p.locator('.main-panel').evaluate(panel => panel.inert), false);
});

test('home is a full-width problem directory at desktop and mobile breakpoints', async t => {
    const c = await context(t); await seed(c, directoryItems()); const p = await open(c);
    const before = await read(p);
    for (const width of [1440, 1180, 761, 760, 390, 320]) {
        await p.setViewportSize({ width, height: width < 760 ? 844 : 900 });
        assert.equal(await p.locator('#home-directory-title').isVisible(), true);
        assert.equal(await p.locator('.main-panel').isVisible(), false);
        assert.equal(await p.locator('#library-toggle-btn').isVisible(), false);
        assert.equal(await p.locator('#expand-directory-btn').isVisible(), false);
        assert.equal(await p.locator('#library-sidebar').evaluate(sidebar => sidebar.inert), false);
        const box = await p.locator('#library-sidebar').boundingBox();
        assert.ok(box.width >= Math.min(width, 1100) - 1, JSON.stringify(box));
        assert.equal(await p.locator('.problem-row').count(), 100);
        const title = row(p, 'directory-7').locator('h3');
        assert.equal(await title.innerText(), longDirectoryTitle);
        assert.equal(await title.evaluate(h => h.scrollHeight <= h.clientHeight + 1 && h.scrollWidth <= h.clientWidth + 1), true);
        await assertNoHorizontalOverflow(p);
        if (width === 1180 || width === 390) {
            await p.locator('#problem-list').evaluate(list => { list.scrollTop = 0; });
            await directoryScreenshot(p, width === 1180 ? '05-home-desktop' : '06-home-mobile');
        }
    }
    assert.deepEqual(await read(p), before); assert.equal(await read(p, dbKey + ':dirty'), false);
});

test('home stays accessible with a collapsed reading sidebar and preserves its device preferences', async t => {
    const c = await context(t);
    const preferences = { width: 500, collapsed: true };
    await c.addInitScript(value => {
        if (location.protocol === 'http:') localStorage.setItem('rq_v2_directory_layout', JSON.stringify(value));
    }, preferences);
    await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c);
    assert.equal(await p.locator('#library-sidebar').isVisible(), true);
    await row(p, 'a').locator('a.problem-row-link').focus(); await p.keyboard.press('Enter');
    await until(async () => new URL(p.url()).searchParams.get('item') === 'a');
    assert.equal(await p.locator('#detail-title').evaluate(title => title === document.activeElement), true);
    assert.equal(await p.locator('#library-sidebar').isVisible(), false);
    await p.locator('#breadcrumb-home-btn').click();
    assert.equal(await p.locator('#home-directory-title').isVisible(), true);
    assert.equal(await p.locator('#search-input').evaluate(input => input === document.activeElement), true);
    await p.reload(); await p.locator('#home-directory-title').waitFor();
    assert.equal(await p.locator('#library-sidebar').evaluate(sidebar => sidebar.inert), false);
    assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('rq_v2_directory_layout'))), preferences);
    await selectRow(p, 'b'); assert.equal(await p.locator('#library-sidebar').isVisible(), false);
    await p.locator('#library-toggle-btn').click();
    assert.equal(Math.round((await p.locator('#library-sidebar').boundingBox()).width), 500);
});

test('home search, filters, batches and scroll survive selection and return navigation', async t => {
    const c = await context(t); const items = directoryItems(); items[229].isPinned = true;
    await seed(c, items); const p = await open(c); const before = await read(p);
    await p.locator('[data-load-more]').click(); assert.equal(await p.locator('.problem-row').count(), 200);
    await row(p, 'directory-90').scrollIntoViewIfNeeded();
    const homeScroll = await p.locator('#problem-list').evaluate(list => list.scrollTop);
    await selectRow(p, 'directory-90'); await p.goBack();
    assert.equal(await p.locator('#search-input').evaluate(input => input === document.activeElement), true);
    assert.ok(Math.abs(await p.locator('#problem-list').evaluate(list => list.scrollTop) - homeScroll) <= 1);
    await p.goForward(); await p.locator('#breadcrumb-home-btn').click();
    assert.equal(await p.locator('.problem-row').count(), 200);
    assert.ok(Math.abs(await p.locator('#problem-list').evaluate(list => list.scrollTop) - homeScroll) <= 1);
    await p.locator('#search-input').fill('needle-at-the-end');
    await until(async () => JSON.stringify(await visibleIds(p)) === '["directory-229"]');
    await p.locator('#library-filter-panel > summary').click(); await p.locator('[data-library-filter="pinned"]').click();
    await selectRow(p, 'directory-229'); assert.ok((await p.locator('#detail-title').innerText()).includes('229'));
    await p.goBack(); assert.equal(await p.locator('#home-directory-title').isVisible(), true);
    assert.equal(await p.locator('#search-input').inputValue(), 'needle-at-the-end');
    assert.deepEqual(await visibleIds(p), ['directory-229']);
    await p.goForward(); assert.ok((await p.locator('#detail-title').innerText()).includes('229'));
    await p.locator('#breadcrumb-home-btn').click();
    assert.equal(await p.locator('[data-library-filter="pinned"]').getAttribute('aria-pressed'), 'true');
    await p.locator('#search-input').fill('absent-directory-query');
    await until(async () => (await visibleIds(p)).length === 0);
    assert.ok((await p.locator('.directory-empty').innerText()).includes('change the filters'));
    assert.deepEqual(await read(p), before); assert.equal(await read(p, dbKey + ':dirty'), false);
});

test('empty home supports new, cancel and save, and distinguishes empty filters and trash', async t => {
    const c = await context(t); await seed(c, []); const p = await open(c);
    assert.ok((await p.locator('.directory-empty').textContent()).includes('No problems yet'));
    await p.locator('#create-item-btn').click(); assert.equal(await p.locator('#composer').isVisible(), true);
    await p.locator('#cancel-composer-btn').click(); await clickAction(p, '#back-home-btn');
    assert.equal((await read(p)).items.length, 0);
    await p.locator('[data-view-mode="trash"]').click();
    assert.ok((await p.locator('.directory-empty').textContent()).includes('Trash is empty'));
    await p.locator('[data-view-mode="active"]').click(); await p.locator('#create-item-btn').click();
    await p.locator('#composer-title-input').fill('Synthetic question from home');
    await p.locator('.cm-content').fill('Synthetic statement $x + y = 1$'); await save(p);
    await p.locator('#breadcrumb-home-btn').click(); assert.equal(await p.locator('.problem-row').count(), 1);
    assert.ok((await p.locator('.problem-row h3').innerText()).includes('Synthetic question from home'));
    await p.locator('#library-filter-panel > summary').click(); await p.locator('[data-library-filter="pinned"]').click();
    assert.ok((await p.locator('.directory-empty').textContent()).includes('No Match'));
    assert.ok(!(await p.locator('.directory-empty').textContent()).includes('No problems yet'));
    assert.equal((await read(p)).items.length, 1);
});

test('mobile home opens details without a drawer and returns to the searchable list', async t => {
    const c = await context(t, null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await seed(c, [problem(), problem('b', 'Original B')]); const p = await open(c);
    for (let i = 0; i < 3; i++) {
        await selectRow(p, 'b'); await p.locator('#library-sidebar').waitFor({ state: 'hidden' });
        assert.equal(await p.locator('.main-panel').evaluate(panel => panel.inert), false);
        assert.equal(await p.locator('#library-scrim').isVisible(), false);
        await p.locator('#breadcrumb-home-btn').click();
        assert.equal(await p.locator('#library-sidebar').isVisible(), true);
        assert.equal(await p.locator('#library-sidebar').evaluate(sidebar => sidebar.inert), false);
        await p.keyboard.press('Escape'); assert.equal(await p.locator('#library-sidebar').isVisible(), true);
        await assertNoHorizontalOverflow(p);
    }
    await p.locator('#search-input').fill('Original B');
    await until(async () => JSON.stringify(await visibleIds(p)) === '["b"]');
    await p.setViewportSize({ width: 320, height: 568 }); await assertNoHorizontalOverflow(p);
    await selectRow(p, 'b'); await p.locator('#breadcrumb-home-btn').click();
    assert.deepEqual(await visibleIds(p), ['b']); assert.equal(await read(p, dbKey + ':dirty'), false);
});

test('browser Back to the home directory protects an unsaved draft', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c);
    await selectRow(p, 'a'); await beginEdit(p, 'Synthetic protected home draft');
    let discard = false, prompts = 0;
    p.on('dialog', dialog => { prompts++; return discard ? dialog.accept() : dialog.dismiss(); });
    await p.goBack(); await until(() => prompts === 1);
    assert.equal(new URL(p.url()).searchParams.get('item'), 'a');
    assert.equal(await p.locator('#composer-title-input').inputValue(), 'Synthetic protected home draft');
    assert.equal((await read(p)).items[0].title, 'Original A');
    discard = true; await p.goBack(); await until(() => prompts === 2);
    assert.equal(await p.locator('#home-directory-title').isVisible(), true);
    assert.equal(await p.locator('#composer').isVisible(), false);
    assert.equal((await read(p)).items[0].title, 'Original A');
});

test('the compact directory gives most of the viewport to questions and filters do not move the list', async t => {
    const c = await context(t);
    await seed(c, Array.from({ length: 50 }, (_, i) => problem('compact-' + i, `Synthetic question ${i + 1}: structural bounds and examples`)));
    const p = await open(c); const before = await read(p);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 757 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
        await p.setViewportSize(viewport);
        const list = await p.locator('#problem-list').boundingBox();
        assert.ok(list.y <= (viewport.width > 760 ? 115 : 145), JSON.stringify({ viewport, list }));
        assert.ok(list.height / viewport.height >= (viewport.width === 320 ? 0.75 : 0.82), JSON.stringify({ viewport, list }));
        assert.equal(await p.locator('#search-input').isVisible(), true);
        assert.equal(await p.locator('#create-item-btn').isVisible(), true);
        await p.locator('#library-filter-panel > summary').click();
        assert.equal(await p.locator('[data-library-filter="pinned"]').isVisible(), true);
        const panel = await p.locator('.filter-scroll').boundingBox();
        assert.ok(panel.x >= 0 && panel.x + panel.width <= viewport.width + 1, JSON.stringify(panel));
        const opened = await p.locator('#problem-list').boundingBox();
        assert.equal(opened.y, list.y); assert.equal(opened.height, list.height);
        await p.keyboard.press('Escape');
        assert.equal(await p.locator('#library-filter-panel').evaluate(filter => filter.open), false);
        await assertNoHorizontalOverflow(p);
    }
    assert.deepEqual(await read(p), before); assert.equal(await read(p, dbKey + ':dirty'), false);
});

test('mobile reading and editing start below the compact bar without hidden sidebar rows', async t => {
    const title = 'Synthetic question: Rainbow spanning trees under degree constraints';
    const c = await context(t, null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await seed(c, [{ ...problem('a', title), desc: 'Synthetic statement with enough content to inspect the reading area.\n\nA second paragraph stays in the same document.' }]);
    const p = await open(c, '?item=a'); const before = await read(p);
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
        await p.setViewportSize(viewport);
        const main = await p.locator('.main-panel').boundingBox(), statement = await p.locator('#problem-render').boundingBox();
        assert.ok(main.y <= 45 && main.height >= viewport.height - 45, JSON.stringify({ main, viewport }));
        assert.ok(statement.y < 280, JSON.stringify(statement));
        assert.equal(await p.locator('#context-panel').isVisible(), false);
        await p.locator('#library-toggle-btn').click(); await p.keyboard.press('Escape');
        assert.equal((await p.locator('.main-panel').boundingBox()).y, main.y);
        await p.locator('#edit-problem-btn').click();
        const editor = await p.locator('#editor-host').boundingBox(), saveButton = await p.locator('#save-composer-btn').boundingBox();
        assert.ok(editor.height >= viewport.height * 0.4, JSON.stringify({ editor, viewport }));
        assert.ok(saveButton.y >= 0 && saveButton.y + saveButton.height <= viewport.height + 1, JSON.stringify(saveButton));
        await p.locator('#cancel-composer-btn').click(); await assertNoHorizontalOverflow(p);
    }
    assert.deepEqual(await read(p), before); assert.equal(await read(p, dbKey + ':dirty'), false);
});

test('auxiliary context is closed by default and opening it does not reduce the document width', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await p.setViewportSize(viewport);
        const before = await p.locator('.main-panel').boundingBox();
        assert.equal(await p.locator('#context-panel').isVisible(), false);
        if (viewport.width === 1440) assert.ok(before.width / viewport.width >= 0.75, JSON.stringify(before));
        await p.locator('#context-toggle-btn').click();
        assert.equal(await p.locator('#context-panel').isVisible(), true);
        assert.equal((await p.locator('.main-panel').boundingBox()).width, before.width);
        await p.locator('[data-close-context]').click();
        assert.equal(await p.locator('#context-panel').isVisible(), false);
        await p.locator('#context-toggle-btn').click(); await p.keyboard.press('Escape');
        assert.equal(await p.locator('#context-panel').isVisible(), false);
        await assertNoHorizontalOverflow(p);
    }
    assert.equal(await read(p, dbKey + ':dirty'), false);
});

test('opening an editor does not steal focus after the user chooses another field', async t => {
    const c = await context(t); await seed(c, [problem()]); const p = await open(c, '?item=a');
    const before = await read(p);
    await p.evaluate(() => {
        document.querySelector('#edit-problem-btn').click();
        document.querySelector('#composer-preamble-input').focus();
    });
    await p.waitForTimeout(100);
    assert.equal(await p.locator('#composer-preamble-input').evaluate(input => input === document.activeElement), true);
    await p.locator('#composer-preamble-input').fill('\\newcommand{\\R}{\\mathbb{R}}');
    assert.equal(await p.locator('.cm-content').innerText(), 'Original statement');
    assert.equal(await p.locator('#composer-preamble-input').inputValue(), '\\newcommand{\\R}{\\mathbb{R}}');
    assert.deepEqual(await read(p), before);
    p.once('dialog', dialog => dialog.accept());
    await p.locator('#cancel-composer-btn').click();
    await p.evaluate(() => {
        document.querySelector('#new-note-btn').click();
        document.querySelector('button[data-editor-view="preview"]').focus();
    });
    await p.waitForTimeout(100);
    assert.equal(await p.locator('button[data-editor-view="preview"]').evaluate(button => button === document.activeElement), true);
    assert.deepEqual(await read(p), before);
});

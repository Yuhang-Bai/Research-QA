import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMainDatabase, fetchSharedItem, saveMainDatabase } from '../src/data/gist.js';

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
function fixture(file) { return { history: [{ version: 'v1' }], files: { 'main_db.json': { filename: 'main_db.json', ...file } } }; }
test('truncated content is replaced by the full raw response', async () => {
    const calls = [], value = { items: [{ id: 'a', title: 'A' }], trash: [] };
    globalThis.fetch = async (url) => { calls.push(url); return new Response(url.includes('/raw/') ? JSON.stringify(value) : JSON.stringify(fixture({ content: '{', truncated: true, raw_url: 'https://gist.githubusercontent.com/audit/raw/data' }))); };
    const result = await fetchMainDatabase({ mainGistId: 'audit' });
    assert.deepEqual(result.database, value); assert.equal(calls.length, 2);
});
test('shared gists use the same truncation handling', async () => {
    globalThis.fetch = async (url) => new Response(url.includes('/raw/') ? '{"id":"a","title":"Shared"}' : JSON.stringify({ files: { 'shared_item.json': { filename: 'shared_item.json', content: '{', truncated: true, raw_url: 'https://gist.githubusercontent.com/audit/raw/data' } } }));
    assert.equal((await fetchSharedItem('audit')).title, 'Shared');
});
test('a truncated file without a raw URL fails explicitly', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify(fixture({ content: '{}', truncated: true })));
    await assert.rejects(fetchMainDatabase({ mainGistId: 'audit' }), /truncated/);
});
test('unknown remote version never sends a PATCH', async () => {
    const calls = []; globalThis.fetch = async (...args) => { calls.push(args); throw Error('must not reach network'); };
    await assert.rejects(saveMainDatabase({ mainGistId: 'audit' }, {}, { expectedVersion: '' }), { code: 'sync-conflict' });
    assert.equal(calls.length, 0);
});
test('moved remote version prevents PATCH', async () => {
    const methods = []; globalThis.fetch = async (url, options = {}) => { methods.push(options.method || 'GET'); return new Response(JSON.stringify({ history: [{ version: 'v2' }] })); };
    await assert.rejects(saveMainDatabase({ mainGistId: 'audit' }, {}, { expectedVersion: 'v1' }), { code: 'sync-conflict' });
    assert.deepEqual(methods, ['GET']);
});
test('matching version sends the intended snapshot and returns its new version', async () => {
    let written; globalThis.fetch = async (url, options = {}) => { if (options.method === 'PATCH') written = JSON.parse(options.body); return new Response(JSON.stringify({ history: [{ version: written ? 'v2' : 'v1' }] })); };
    assert.equal(await saveMainDatabase({ mainGistId: 'audit' }, { items: [], trash: [] }, { expectedVersion: 'v1' }), 'v2');
    assert.deepEqual(JSON.parse(written.files['main_db.json'].content), { items: [], trash: [] });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WORKSPACE_FORMAT,
    parseWorkspaceSnapshot,
    deserializeWorkspaceSnapshot,
    serializeWorkspaceSnapshot
} from '../src/data/workspace.js';

const sampleDatabase = {
    items: [
        {
            id: 'item-1',
            title: 'Planar Turán number of C8',
            desc: 'What is $\\mathrm{ex}_P(n, C_8)$?',
            preamble: '\\newcommand{\\ex}{\\mathrm{ex}}',
            date: '2026-05-01T10:00:00.000Z',
            isPinned: true,
            pinnedAt: '2026-05-02T08:00:00.000Z',
            sortRank: 0,
            shareId: 'abc123',
            answers: [
                {
                    id: 'note-1',
                    text: 'Tried discharging, stuck on degree-5 vertices.',
                    date: '2026-05-03T12:00:00.000Z'
                }
            ]
        }
    ],
    trash: [
        {
            id: 'trash-note-9',
            type: 'note',
            data: {
                id: 'note-9',
                text: 'Dead-end lemma.',
                date: '2026-04-20T09:00:00.000Z'
            },
            parentId: 'item-1',
            parentTitle: 'Planar Turán number of C8',
            parentPreamble: '',
            deletedAt: '2026-04-21T09:00:00.000Z'
        },
        {
            id: 'item-2',
            type: 'item',
            title: 'Old problem',
            desc: 'Removed.',
            preamble: '',
            date: '2026-03-01T00:00:00.000Z',
            isPinned: false,
            pinnedAt: '',
            sortRank: 3,
            shareId: '',
            answers: [],
            deletedAt: '2026-03-05T00:00:00.000Z'
        }
    ]
};

test('workspace snapshot round-trips problems without losing fields', () => {
    const snapshot = serializeWorkspaceSnapshot(sampleDatabase, { exportedAt: '2026-06-11T00:00:00.000Z' });
    assert.equal(snapshot.format, WORKSPACE_FORMAT);

    const restored = deserializeWorkspaceSnapshot(snapshot);
    const [item] = restored.items;
    const [original] = sampleDatabase.items;

    assert.equal(item.id, original.id);
    assert.equal(item.title, original.title);
    assert.equal(item.desc, original.desc);
    assert.equal(item.preamble, original.preamble);
    assert.equal(item.date, original.date);
    assert.equal(item.isPinned, original.isPinned);
    assert.equal(item.pinnedAt, original.pinnedAt);
    assert.equal(item.sortRank, original.sortRank);
    assert.equal(item.shareId, original.shareId);
    assert.deepEqual(item.answers, original.answers);
});

test('workspace snapshot round-trips note and problem trash entries', () => {
    const snapshot = serializeWorkspaceSnapshot(sampleDatabase);
    const restored = deserializeWorkspaceSnapshot(snapshot);

    const [noteEntry, itemEntry] = restored.trash;

    assert.equal(noteEntry.type, 'note');
    assert.equal(noteEntry.parentId, 'item-1');
    assert.equal(noteEntry.parentTitle, 'Planar Turán number of C8');
    assert.equal(noteEntry.deletedAt, '2026-04-21T09:00:00.000Z');
    assert.deepEqual(noteEntry.data, sampleDatabase.trash[0].data);

    assert.equal(itemEntry.type, 'item');
    assert.equal(itemEntry.id, 'item-2');
    assert.equal(itemEntry.deletedAt, '2026-03-05T00:00:00.000Z');
    assert.equal(itemEntry.title, 'Old problem');
});

test('workspace snapshot survives a JSON stringify/parse cycle', () => {
    const snapshot = serializeWorkspaceSnapshot(sampleDatabase);
    const restored = deserializeWorkspaceSnapshot(JSON.parse(JSON.stringify(snapshot)));
    assert.equal(restored.items.length, 1);
    assert.equal(restored.trash.length, 2);
});

test('deserialize passes through non-workspace payloads unchanged', () => {
    const legacyPayload = { items: [{ id: 'x' }], trash: [] };
    assert.equal(deserializeWorkspaceSnapshot(legacyPayload), legacyPayload);

    const wrapped = { db: { items: [], trash: [] } };
    assert.equal(deserializeWorkspaceSnapshot(wrapped), wrapped.db);
});

test('serialize tolerates empty or malformed databases', () => {
    const empty = serializeWorkspaceSnapshot(null);
    assert.deepEqual(empty.library.problems, []);
    assert.deepEqual(empty.library.trash, []);

    const restored = deserializeWorkspaceSnapshot(serializeWorkspaceSnapshot({}));
    assert.deepEqual(restored, { items: [], trash: [] });
});

test('numeric legacy IDs survive export/import, including trash parent links', () => {
    const db = structuredClone(sampleDatabase);
    db.items[0].id = 1700000000000;
    db.items[0].answers[0].id = 1700000000001;
    db.trash[0].parentId = 1700000000000;
    const restored = parseWorkspaceSnapshot(JSON.parse(JSON.stringify(serializeWorkspaceSnapshot(db))));
    assert.equal(restored.items[0].id, '1700000000000');
    assert.equal(restored.items[0].answers[0].id, '1700000000001');
    assert.equal(restored.trash[0].parentId, restored.items[0].id);
});
test('unrelated JSON cannot be normalized into an empty import', () => {
    for (const payload of [{ hello: 'world' }, {}, null, 42, { items: 'wrong' }, { items: [], trash: {} }]) {
        assert.throws(() => parseWorkspaceSnapshot(payload));
    }
});
test('legacy arrays and wrapped backups remain importable', () => {
    const rows = [{ id: 123, title: 'Legacy', desc: 'Text', answers: [] }];
    assert.equal(parseWorkspaceSnapshot(rows).items[0].id, 123);
    assert.equal(parseWorkspaceSnapshot({ db: { items: rows } }).items[0].id, 123);
});
test('unsupported workspace versions and missing library arrays are rejected', () => {
    const snapshot = serializeWorkspaceSnapshot(sampleDatabase);
    assert.throws(() => parseWorkspaceSnapshot({ ...snapshot, version: 99 }), /version/);
    assert.throws(() => parseWorkspaceSnapshot({ ...snapshot, library: {} }), /arrays/);
});
test('missing, duplicate, or unsafe IDs and malformed content are rejected', () => {
    for (const rows of [[{ id: '', title: 'A' }], [{ id: 'x', title: 'A' }, { id: 'x', title: 'B' }], [{ id: 'x" onmouseover="x', title: 'A' }], [{ id: 'a', title: 'A', desc: 42 }], [{ id: 'a', title: 'A', answers: [null] }]]) {
        assert.throws(() => parseWorkspaceSnapshot({ items: rows, trash: [] }));
    }
});
test('null sort ranks are not converted to zero', () => {
    const snapshot = serializeWorkspaceSnapshot({ items: [{ ...sampleDatabase.items[0], sortRank: null }] });
    assert.equal(snapshot.library.problems[0].pin.sortRank, null);
    assert.equal(deserializeWorkspaceSnapshot(snapshot).items[0].sortRank, null);
});

test('malformed portable trash content is rejected before conversion', () => {
    const snapshot = serializeWorkspaceSnapshot(sampleDatabase);
    snapshot.library.trash[0].note.content = 42;
    assert.throws(() => parseWorkspaceSnapshot(snapshot), /note content/);
    const second = serializeWorkspaceSnapshot(sampleDatabase);
    second.library.trash[1].problem.statement = { invalid: true };
    assert.throws(() => parseWorkspaceSnapshot(second), /workspace problem/);
});

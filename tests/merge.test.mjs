import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalConflictError, mergeDatabases, sharedContentChanged } from '../src/data/merge.js';

const base = { items: [{ id: 'a', title: 'A', sortRank: 0 }, { id: 'b', title: 'B', sortRank: 1 }], trash: [] };
test('two stale tabs editing different problems preserve both saves', () => {
    const first = structuredClone(base), second = structuredClone(base);
    first.items[0].title = 'A edited'; second.items[1].title = 'B edited';
    const merged = mergeDatabases(base, second, first);
    assert.deepEqual(merged.items.map((x) => x.title), ['A edited', 'B edited']);
});
test('conflicting edits to the same field are rejected without mutation', () => {
    const first = structuredClone(base), second = structuredClone(base);
    first.items[0].title = 'First'; second.items[0].title = 'Second';
    assert.throws(() => mergeDatabases(base, second, first), LocalConflictError);
    assert.equal(first.items[0].title, 'First'); assert.equal(second.items[0].title, 'Second');
});
test('a pin/rank update does not replace another tab\'s edited content', () => {
    const first = structuredClone(base), second = structuredClone(base);
    first.items[0].title = 'Changed'; second.items[0].sortRank = 1; second.items[1].sortRank = 0;
    assert.equal(mergeDatabases(base, second, first).items[0].title, 'Changed');
});
test('concurrent insertions are retained', () => {
    const first = structuredClone(base), second = structuredClone(base);
    first.items.push({ id: 'c', title: 'C' }); second.items.push({ id: 'd', title: 'D' });
    assert.deepEqual(mergeDatabases(base, second, first).items.map(x => x.id), ['a', 'b', 'c', 'd']);
});
test('deleting a problem edited in another tab is rejected', () => {
    const first = structuredClone(base), second = structuredClone(base);
    first.items[0].title = 'Changed'; second.trash.push(second.items.shift());
    assert.throws(() => mergeDatabases(base, second, first), LocalConflictError);
});
test('unrelated deletions and updates merge across active and trash collections', () => {
    const first = structuredClone(base), second = structuredClone(base);
    first.items[1].title = 'Changed B'; second.trash.push(second.items.shift());
    const merged = mergeDatabases(base, second, first);
    assert.deepEqual(merged.items.map(x => x.title), ['Changed B']); assert.equal(merged.trash[0].id, 'a');
});

test('pin/reorder metadata does not publish potentially stale shared bodies', () => {
    const before = { id: 'a', title: 'A', desc: 'Body', answers: [], shareId: 'share', sortRank: 0 };
    assert.equal(sharedContentChanged(before, { ...before, sortRank: 9, isPinned: true }), false);
    assert.equal(sharedContentChanged(before, { ...before, title: 'Edited' }), true);
    assert.equal(sharedContentChanged(before, { ...before, answers: [{ id: 'n', text: 'Note' }] }), true);
});

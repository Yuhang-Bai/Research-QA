const emptyDatabase = () => ({ items: [], trash: [] });
export const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function sharedContentChanged(before, after) {
    if (!before || before.shareId !== after.shareId) return true;
    return ['title', 'desc', 'preamble', 'answers'].some((key) => !sameValue(before[key], after[key]));
}

export class LocalConflictError extends Error {
    constructor() {
        super('This content changed in another tab. Your draft is still open. Copy it before reloading the latest version.');
        this.code = 'local-conflict';
    }
}

function mergeRecord(base, next, latest) {
    if (sameValue(base, next)) return latest;
    if (sameValue(base, latest) || sameValue(next, latest)) return next;
    if (!base || !next || !latest) throw new LocalConflictError();
    const merged = { ...latest };
    for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
        if (sameValue(base[key], next[key])) continue;
        if (!sameValue(base[key], latest[key]) && !sameValue(next[key], latest[key])) {
            throw new LocalConflictError();
        }
        if (key in next) merged[key] = next[key];
        else delete merged[key];
    }
    return merged;
}

function mergeCollection(base, next, latest) {
    const index = (rows) => new Map(rows.map((row) => [String(row.id), row]));
    const before = index(base), after = index(next), current = index(latest);
    const ids = new Set([...current.keys(), ...after.keys(), ...before.keys()]);
    return [...ids].map((id) => mergeRecord(before.get(id), after.get(id), current.get(id))).filter(Boolean);
}

// Apply only this tab's changes to the latest committed database. Deletes and
// moves to/from trash are committed together by the storage transaction.
export function mergeDatabases(base = emptyDatabase(), next = emptyDatabase(), latest = emptyDatabase()) {
    return {
        items: mergeCollection(base.items, next.items, latest.items),
        trash: mergeCollection(base.trash, next.trash, latest.trash)
    };
}

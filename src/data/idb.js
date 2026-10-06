import Dexie from 'dexie';
import { LocalConflictError, mergeDatabases, sameValue, sharedContentChanged } from './merge.js';

const DATABASE_NAME = 'research-qa-vite';

const database = new Dexie(DATABASE_NAME);
database.version(1).stores({
    kv: '&key'
});

const table = database.table('kv');

export async function getValue(key) {
    const record = await table.get(key);
    return record?.value;
}

export async function setValue(key, value) {
    await table.put({ key, value, updatedAt: new Date().toISOString() });
}

async function readState(key) {
    const keys = [key, `${key}:revision`, `${key}:version`, `${key}:dirty`, `${key}:pendingShares`];
    const [data, revision, version, dirty, pendingShares] = await table.bulkGet(keys);
    return {
        database: data?.value,
        revision: revision?.value || 0,
        version: version?.value || '',
        dirty: Boolean(dirty?.value),
        pendingShares: Object.assign(Object.create(null), pendingShares?.value || {})
    };
}

export function readDatabaseState(key) {
    return database.transaction('r', table, () => readState(key));
}

async function writeState(key, state) {
    const values = { [key]: state.database, [`${key}:revision`]: state.revision,
        [`${key}:version`]: state.version, [`${key}:dirty`]: state.dirty,
        [`${key}:pendingShares`]: state.pendingShares };
    await table.bulkPut(Object.entries(values).map(([key, value]) => ({ key, value, updatedAt: new Date().toISOString() })));
}

export function commitDatabase(key, base, next, { normalize, remote = false, replace = false } = {}) {
    return database.transaction('rw', table, async () => {
        const state = await readState(key);
        const latest = normalize(state.database || { items: [], trash: [] });
        if (replace && !sameValue(base, latest)) throw new LocalConflictError();
        const merged = normalize(replace ? next : mergeDatabases(base, next, latest));
        if (replace) await setValue(`${key}:beforeImport`, latest);
        for (const item of merged.items) {
            if (item.shareId && sharedContentChanged(latest.items.find((row) => String(row.id) === String(item.id)), item)) {
                state.pendingShares[item.shareId] = item;
            }
        }
        // Do not publish a queued copy of a problem the user has since removed.
        for (const gistId of Object.keys(state.pendingShares)) {
            if (!merged.items.some((item) => item.shareId === gistId)) delete state.pendingShares[gistId];
        }
        state.database = merged;
        state.revision += 1;
        state.dirty = remote || Object.keys(state.pendingShares).length > 0;
        await writeState(key, state);
        return state;
    });
}

export function replaceFromRemote(key, next, expectedRevision, version, normalize) {
    return database.transaction('rw', table, async () => {
        const state = await readState(key);
        if (state.revision !== expectedRevision || state.dirty) throw new LocalConflictError();
        state.database = normalize(next);
        state.revision += 1;
        state.version = version;
        state.dirty = false;
        state.pendingShares = {};
        await writeState(key, state);
        return state;
    });
}

export function acknowledgeSync(key, sent, version = sent.version) {
    return database.transaction('rw', table, async () => {
        const state = await readState(key);
        for (const [id, item] of Object.entries(sent.pendingShares)) {
            if (sameValue(state.pendingShares[id], item)) delete state.pendingShares[id];
        }
        state.version = version;
        // An older response must not acknowledge edits made during its upload.
        state.dirty = state.revision !== sent.revision || Object.keys(state.pendingShares).length > 0;
        await writeState(key, state);
        return state;
    });
}

import Dexie from 'dexie';

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

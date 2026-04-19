const CONFIG_KEY = 'rq_v2_config';
const LEGACY_CONFIG_KEY = 'v7_config';
const LOCKED_CONFIG_KEY = 'rq_v2_locked_config';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function readJson(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        return null;
    }
}

function normalizeConfig(config = {}) {
    return {
        token: typeof config.token === 'string' ? config.token.trim() : '',
        mainGistId: typeof config.mainGistId === 'string' ? config.mainGistId.trim() : ''
    };
}

function normalizeLockedRecord(record = {}) {
    return {
        version: Number.isFinite(record.version) ? record.version : 1,
        username: typeof record.username === 'string' ? record.username.trim() : '',
        salt: typeof record.salt === 'string' ? record.salt.trim() : '',
        iv: typeof record.iv === 'string' ? record.iv.trim() : '',
        ciphertext: typeof record.ciphertext === 'string' ? record.ciphertext.trim() : ''
    };
}

function hasLockedRecord(record = {}) {
    return Boolean(record.username && record.salt && record.iv && record.ciphertext);
}

function bytesToBase64(bytes) {
    let output = '';
    bytes.forEach((value) => {
        output += String.fromCharCode(value);
    });
    return btoa(output);
}

function base64ToBytes(value) {
    const input = atob(value);
    const output = new Uint8Array(input.length);
    for (let index = 0; index < input.length; index += 1) {
        output[index] = input.charCodeAt(index);
    }
    return output;
}

async function deriveAesKey(password, saltBytes, usages) {
    const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 210000,
            hash: 'SHA-256'
        },
        material,
        {
            name: 'AES-GCM',
            length: 256
        },
        false,
        usages
    );
}

function hasMeaningfulConfig(config = {}) {
    return Boolean(config.token || config.mainGistId);
}

function mergeConfig(current = {}, legacy = {}) {
    return normalizeConfig({
        token: current.token || legacy.token || '',
        mainGistId: current.mainGistId || legacy.mainGistId || ''
    });
}

export function loadConfig() {
    const current = normalizeConfig(readJson(CONFIG_KEY) || {});
    const legacy = normalizeConfig(readJson(LEGACY_CONFIG_KEY) || {});
    const merged = mergeConfig(current, legacy);

    if (hasMeaningfulConfig(legacy) && (
        merged.token !== current.token ||
        merged.mainGistId !== current.mainGistId
    )) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    }

    return merged;
}

export function saveConfig(config) {
    const normalized = normalizeConfig(config);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
}

export function clearStoredConfig() {
    localStorage.removeItem(CONFIG_KEY);
}

export function loadLegacyConfig() {
    return normalizeConfig(readJson(LEGACY_CONFIG_KEY) || {});
}

export function getConfigSource() {
    const currentRaw = readJson(CONFIG_KEY);
    const current = normalizeConfig(currentRaw || {});
    const legacy = normalizeConfig(readJson(LEGACY_CONFIG_KEY) || {});
    const locked = normalizeLockedRecord(readJson(LOCKED_CONFIG_KEY) || {});

    if (hasLockedRecord(locked)) {
        return 'current';
    }

    if (hasMeaningfulConfig(legacy) && (
        (legacy.token && !current.token) ||
        (legacy.mainGistId && !current.mainGistId)
    )) {
        return 'legacy';
    }

    if (currentRaw) {
        return 'current';
    }

    if (hasMeaningfulConfig(legacy)) {
        return 'legacy';
    }

    return 'none';
}

export function hasLegacyConfig() {
    return hasMeaningfulConfig(normalizeConfig(readJson(LEGACY_CONFIG_KEY) || {}));
}

export function getLockedConfigProfile() {
    const locked = normalizeLockedRecord(readJson(LOCKED_CONFIG_KEY) || {});
    if (!hasLockedRecord(locked)) {
        return null;
    }

    return {
        username: locked.username
    };
}

export function hasLockedConfig() {
    return Boolean(getLockedConfigProfile());
}

export async function lockConfig(config, credentials) {
    const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
    const password = typeof credentials?.password === 'string' ? credentials.password : '';
    if (!username || !password) {
        throw new Error('App username and password are required.');
    }

    const normalized = normalizeConfig(config);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(password, salt, ['encrypt']);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(JSON.stringify(normalized))
    );

    const record = {
        version: 1,
        username,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext))
    };

    localStorage.setItem(LOCKED_CONFIG_KEY, JSON.stringify(record));
    localStorage.removeItem(CONFIG_KEY);
    return normalized;
}

export async function unlockConfig(credentials) {
    const locked = normalizeLockedRecord(readJson(LOCKED_CONFIG_KEY) || {});
    if (!hasLockedRecord(locked)) {
        return loadConfig();
    }

    const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
    const password = typeof credentials?.password === 'string' ? credentials.password : '';
    if (!username || !password || username !== locked.username) {
        throw new Error('Incorrect username or password.');
    }

    try {
        const key = await deriveAesKey(password, base64ToBytes(locked.salt), ['decrypt']);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToBytes(locked.iv) },
            key,
            base64ToBytes(locked.ciphertext)
        );
        const parsed = JSON.parse(decoder.decode(decrypted));
        const legacy = normalizeConfig(readJson(LEGACY_CONFIG_KEY) || {});
        return mergeConfig(normalizeConfig(parsed), legacy);
    } catch (error) {
        throw new Error('Incorrect username or password.');
    }
}

export function clearLockedConfig() {
    localStorage.removeItem(LOCKED_CONFIG_KEY);
}

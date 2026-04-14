const CONFIG_KEY = 'rq_v2_config';
const LEGACY_CONFIG_KEY = 'v7_config';

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

export function loadLegacyConfig() {
    return normalizeConfig(readJson(LEGACY_CONFIG_KEY) || {});
}

export function getConfigSource() {
    const currentRaw = readJson(CONFIG_KEY);
    const current = normalizeConfig(currentRaw || {});
    const legacy = normalizeConfig(readJson(LEGACY_CONFIG_KEY) || {});

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

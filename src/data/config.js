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

export function loadConfig() {
    const next = readJson(CONFIG_KEY);
    if (next) {
        return normalizeConfig(next);
    }

    const legacy = readJson(LEGACY_CONFIG_KEY);
    const normalized = normalizeConfig(legacy || {});
    if (legacy) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    }
    return normalized;
}

export function saveConfig(config) {
    const normalized = normalizeConfig(config);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
}

export function getConfigSource() {
    if (readJson(CONFIG_KEY)) {
        return 'current';
    }

    if (readJson(LEGACY_CONFIG_KEY)) {
        return 'legacy';
    }

    return 'none';
}

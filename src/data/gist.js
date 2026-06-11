const GITHUB_API = 'https://api.github.com';

function buildHeaders(token, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (token) {
        headers.Authorization = `token ${token}`;
    }
    return headers;
}

async function parseResponse(response) {
    if (!response.ok) {
        throw new Error(describeApiFailure(response));
    }

    return response.json();
}

function describeApiFailure(response) {
    if (response.status === 401) {
        return 'GitHub rejected the token (401). Check that the token is valid and has the "gist" scope.';
    }

    if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
            const reset = Number(response.headers.get('x-ratelimit-reset'));
            const resetText = Number.isFinite(reset) && reset > 0
                ? ` Limit resets at ${new Date(reset * 1000).toLocaleTimeString()}.`
                : '';
            return `GitHub API rate limit reached (403).${resetText} Configure a token to raise the limit.`;
        }
        return 'GitHub denied the request (403). The token may lack the "gist" scope.';
    }

    if (response.status === 404) {
        return 'Gist not found (404). Check the gist ID, or configure a token if the gist is secret.';
    }

    return `GitHub API ${response.status}: ${response.statusText}`;
}

function extractGistVersion(gist) {
    return gist?.history?.[0]?.version || gist?.updated_at || '';
}

export class SyncConflictError extends Error {
    constructor(remoteVersion) {
        super('The remote database changed since the last sync on this device.');
        this.name = 'SyncConflictError';
        this.code = 'sync-conflict';
        this.remoteVersion = remoteVersion;
    }
}

async function fetchJsonFromRawUrl(url, token) {
    const response = await fetch(url, { headers: buildHeaders(token) });
    if (!response.ok) {
        throw new Error(`Unable to read gist file content: ${response.status}`);
    }

    return response.text();
}

async function readJsonFile(file, token) {
    const content = file.content ?? (file.raw_url ? await fetchJsonFromRawUrl(file.raw_url, token) : '');
    if (!content) {
        throw new Error('The gist file is empty.');
    }

    return JSON.parse(content);
}

function pickJsonFile(files, preferredNames) {
    for (const name of preferredNames) {
        if (files[name]) {
            return files[name];
        }
    }

    return Object.values(files).find((file) => file.filename.endsWith('.json'));
}

export async function fetchMainDatabase(config) {
    if (!config.mainGistId) {
        throw new Error('Main database gist ID is not configured.');
    }

    const response = await fetch(`${GITHUB_API}/gists/${config.mainGistId}`, {
        headers: buildHeaders(config.token)
    });
    const gist = await parseResponse(response);
    const file = pickJsonFile(gist.files, ['main_db.json', 'research_data.json']);

    if (!file) {
        throw new Error('No main database JSON file was found in the gist.');
    }

    return {
        database: await readJsonFile(file, config.token),
        version: extractGistVersion(gist)
    };
}

export async function fetchMainDatabaseVersion(config) {
    const response = await fetch(`${GITHUB_API}/gists/${config.mainGistId}`, {
        headers: buildHeaders(config.token)
    });
    const gist = await parseResponse(response);
    return extractGistVersion(gist);
}

export async function saveMainDatabase(config, database, options = {}) {
    if (!config.mainGistId) {
        throw new Error('Main database gist ID is not configured.');
    }

    // Optimistic concurrency: refuse to overwrite a remote copy that moved on
    // since this device last synced, unless the caller explicitly forces it.
    if (options.expectedVersion && !options.force) {
        const remoteVersion = await fetchMainDatabaseVersion(config);
        if (remoteVersion && remoteVersion !== options.expectedVersion) {
            throw new SyncConflictError(remoteVersion);
        }
    }

    const response = await fetch(`${GITHUB_API}/gists/${config.mainGistId}`, {
        method: 'PATCH',
        headers: buildHeaders(config.token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            files: {
                'main_db.json': {
                    content: JSON.stringify(database, null, 2)
                }
            }
        })
    });

    const gist = await parseResponse(response);
    return extractGistVersion(gist);
}

export async function fetchSharedItem(gistId, token = '') {
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
        headers: buildHeaders(token)
    });
    const gist = await parseResponse(response);
    const file = pickJsonFile(gist.files, ['shared_item.json']);

    if (!file) {
        throw new Error('The shared gist does not contain shared_item.json.');
    }

    return readJsonFile(file, token);
}

export async function saveSharedItem(gistId, token, item) {
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            files: {
                'shared_item.json': {
                    content: JSON.stringify(item, null, 2)
                }
            }
        })
    });

    await parseResponse(response);
}

export async function createMainDatabase(token) {
    const response = await fetch(`${GITHUB_API}/gists`, {
        method: 'POST',
        headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            description: 'Research QA Main DB',
            public: false,
            files: {
                'main_db.json': {
                    content: JSON.stringify({ items: [], trash: [] }, null, 2)
                }
            }
        })
    });

    const gist = await parseResponse(response);
    return gist.id;
}

export async function createSharedItem(token, item) {
    const response = await fetch(`${GITHUB_API}/gists`, {
        method: 'POST',
        headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            description: `[Shared] ${item.title}`,
            public: false,
            files: {
                'shared_item.json': {
                    content: JSON.stringify(item, null, 2)
                }
            }
        })
    });

    const gist = await parseResponse(response);
    return gist.id;
}

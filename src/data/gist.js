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
        throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
    }

    return response.json();
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

    return readJsonFile(file, config.token);
}

export async function saveMainDatabase(config, database) {
    if (!config.mainGistId) {
        throw new Error('Main database gist ID is not configured.');
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

    await parseResponse(response);
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

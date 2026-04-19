const WORKSPACE_FORMAT = 'research-qa-workspace';
const WORKSPACE_VERSION = 1;

function toText(value) {
    return typeof value === 'string' ? value : '';
}

function toBoolean(value) {
    return Boolean(value);
}

function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function slugify(title, fallback = 'problem') {
    const base = toText(title)
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return base || fallback;
}

function serializeNote(note = {}) {
    return {
        id: toText(note.id),
        updatedAt: toText(note.date),
        content: toText(note.text)
    };
}

function serializeProblem(problem = {}) {
    return {
        kind: 'problem',
        id: toText(problem.id),
        slug: slugify(problem.title, toText(problem.id) || 'problem'),
        title: toText(problem.title),
        statement: toText(problem.desc),
        latexPreamble: toText(problem.preamble),
        updatedAt: toText(problem.date),
        pin: {
            enabled: toBoolean(problem.isPinned),
            pinnedAt: toText(problem.pinnedAt),
            sortRank: toNumberOrNull(problem.sortRank)
        },
        share: {
            gistId: toText(problem.shareId)
        },
        notes: Array.isArray(problem.answers) ? problem.answers.map(serializeNote) : []
    };
}

function serializeTrashEntry(entry = {}) {
    if (entry?.type === 'note') {
        return {
            kind: 'note',
            id: toText(entry.id),
            deletedAt: toText(entry.deletedAt),
            parent: {
                id: toText(entry.parentId),
                title: toText(entry.parentTitle),
                latexPreamble: toText(entry.parentPreamble)
            },
            note: serializeNote(entry.data)
        };
    }

    const problem = serializeProblem(entry);
    return {
        kind: 'problem',
        deletedAt: toText(entry.deletedAt),
        problem
    };
}

function deserializeNote(note = {}) {
    return {
        id: toText(note.id),
        text: toText(note.content),
        date: toText(note.updatedAt)
    };
}

function deserializeProblem(problem = {}) {
    return {
        id: toText(problem.id),
        title: toText(problem.title),
        desc: toText(problem.statement),
        preamble: toText(problem.latexPreamble),
        date: toText(problem.updatedAt),
        isPinned: toBoolean(problem.pin?.enabled),
        pinnedAt: toText(problem.pin?.pinnedAt),
        sortRank: toNumberOrNull(problem.pin?.sortRank),
        shareId: toText(problem.share?.gistId),
        answers: Array.isArray(problem.notes) ? problem.notes.map(deserializeNote) : []
    };
}

function deserializeTrashEntry(entry = {}) {
    if (entry?.kind === 'note') {
        return {
            id: toText(entry.id),
            type: 'note',
            deletedAt: toText(entry.deletedAt),
            parentId: toText(entry.parent?.id),
            parentTitle: toText(entry.parent?.title),
            parentPreamble: toText(entry.parent?.latexPreamble),
            data: deserializeNote(entry.note)
        };
    }

    const problem = deserializeProblem(entry.problem);
    return {
        ...problem,
        type: 'item',
        deletedAt: toText(entry.deletedAt)
    };
}

export function serializeWorkspaceSnapshot(database, options = {}) {
    const problems = Array.isArray(database?.items) ? database.items : [];
    const trash = Array.isArray(database?.trash) ? database.trash : [];

    return {
        format: WORKSPACE_FORMAT,
        version: WORKSPACE_VERSION,
        exportedAt: options.exportedAt || new Date().toISOString(),
        library: {
            problems: problems.map(serializeProblem),
            trash: trash.map(serializeTrashEntry)
        }
    };
}

export function deserializeWorkspaceSnapshot(payload = {}) {
    if (payload?.format !== WORKSPACE_FORMAT) {
        return payload?.db || payload;
    }

    const library = payload.library || {};
    const problems = Array.isArray(library.problems) ? library.problems : [];
    const trash = Array.isArray(library.trash) ? library.trash : [];

    return {
        items: problems.map(deserializeProblem),
        trash: trash.map(deserializeTrashEntry)
    };
}

export { WORKSPACE_FORMAT, WORKSPACE_VERSION };

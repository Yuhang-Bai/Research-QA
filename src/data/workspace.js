const WORKSPACE_FORMAT = 'research-qa-workspace';
const WORKSPACE_VERSION = 1;

function toText(value) {
    return typeof value === 'string' ? value : '';
}

function toId(value) {
    return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
        ? String(value) : '';
}

function toBoolean(value) {
    return Boolean(value);
}

function toNumberOrNull(value) {
    if (value == null || value === '') return null;
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
        id: toId(note.id),
        updatedAt: toText(note.date),
        content: toText(note.text)
    };
}

function serializeProblem(problem = {}) {
    return {
        kind: 'problem',
        id: toId(problem.id),
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
            id: toId(entry.id),
            deletedAt: toText(entry.deletedAt),
            parent: {
                id: toId(entry.parentId),
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
        id: toId(note.id),
        text: toText(note.content),
        date: toText(note.updatedAt)
    };
}

function deserializeProblem(problem = {}) {
    return {
        id: toId(problem.id),
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
            id: toId(entry.id),
            type: 'note',
            deletedAt: toText(entry.deletedAt),
            parentId: toId(entry.parent?.id),
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

    if (payload.version !== WORKSPACE_VERSION) {
        throw new Error(`Unsupported workspace version: ${payload.version}`);
    }
    if (!Array.isArray(payload.library?.problems) || !Array.isArray(payload.library?.trash)) {
        throw new Error('Invalid workspace: problems and trash must be arrays.');
    }

    const library = payload.library || {};
    const problems = Array.isArray(library.problems) ? library.problems : [];
    const trash = Array.isArray(library.trash) ? library.trash : [];

    return {
        items: problems.map(deserializeProblem),
        trash: trash.map(deserializeTrashEntry)
    };
}

function requireObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}.`);
}

function validateIds(rows, label) {
    const seen = new Set();
    for (const row of rows) {
        requireObject(row, label);
        const id = toId(row.id);
        // IDs are embedded in DOM attributes and must also be safe selectors.
        if (!id.trim() || /[\s"'<>\\]/u.test(id) || seen.has(id)) throw new Error(`Invalid or duplicate ${label} ID.`);
        seen.add(id);
    }
}

function validateNotes(notes) {
    if (!Array.isArray(notes)) throw new Error('Invalid notes array.');
    validateIds(notes, 'note');
    for (const note of notes) {
        if (typeof note.text !== 'string') throw new Error('Invalid note content.');
    }
}

function validateProblem(problem) {
    if (typeof problem.title !== 'string') throw new Error('Invalid problem title.');
    if (problem.desc != null && typeof problem.desc !== 'string') throw new Error('Invalid statement.');
    if (problem.preamble != null && typeof problem.preamble !== 'string') throw new Error('Invalid LaTeX preamble.');
    if (problem.answers != null) validateNotes(problem.answers);
}

function validatePortableProblem(problem) {
    requireObject(problem, 'workspace problem');
    validateIds([problem], 'problem');
    if (typeof problem.title !== 'string' || typeof problem.statement !== 'string' || !Array.isArray(problem.notes)
        || (problem.latexPreamble != null && typeof problem.latexPreamble !== 'string')) {
        throw new Error('Invalid workspace problem.');
    }
    validateIds(problem.notes, 'note');
    if (problem.notes.some((note) => typeof note.content !== 'string')) throw new Error('Invalid note content.');
}

// Validate before normalization can turn an unrelated/malformed file into an
// empty database. Missing legacy trash is allowed; missing items is not.
export function parseWorkspaceSnapshot(payload) {
    if (payload?.format && payload.format !== WORKSPACE_FORMAT) throw new Error('Unknown backup format.');
    if (payload?.format === WORKSPACE_FORMAT) {
        const problems = payload.library?.problems;
        if (Array.isArray(problems)) {
            validateIds(problems, 'problem');
            problems.forEach(validatePortableProblem);
        }
        if (Array.isArray(payload.library?.trash)) {
            for (const entry of payload.library.trash) {
                requireObject(entry, 'trash entry');
                if (entry.kind === 'problem') validatePortableProblem(entry.problem);
                else if (entry.kind === 'note') {
                    validateIds([entry.note], 'note');
                    if (typeof entry.note.content !== 'string') throw new Error('Invalid note content.');
                } else throw new Error('Invalid trash entry kind.');
            }
        }
    }
    const parsed = deserializeWorkspaceSnapshot(payload);
    const value = Array.isArray(parsed) ? { items: parsed, trash: [] } : parsed;
    requireObject(value, 'backup');
    if (!Array.isArray(value.items) || (value.trash != null && !Array.isArray(value.trash))) {
        throw new Error('Invalid backup: expected an items array.');
    }
    validateIds(value.items, 'problem');
    value.items.forEach(validateProblem);
    validateIds(value.trash || [], 'trash entry');
    for (const entry of value.trash || []) {
        if (entry.type === 'note') {
            validateNotes([entry.data]);
            if (!toId(entry.parentId)) throw new Error('Invalid parent problem ID.');
        } else {
            validateProblem(entry);
        }
    }
    return value;
}

export { WORKSPACE_FORMAT, WORKSPACE_VERSION };

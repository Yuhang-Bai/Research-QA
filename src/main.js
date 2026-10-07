import {
    clearLockedConfig,
    clearStoredConfig,
    getConfigSource,
    getLockedConfigProfile,
    hasLegacyConfig,
    loadConfig,
    loadLegacyConfig,
    lockConfig,
    saveConfig,
    unlockConfig
} from './data/config.js';
import { acknowledgeSync, commitDatabase, getValue, readDatabaseState, replaceFromRemote, setValue } from './data/idb.js';
import { createMainDatabase, createSharedItem, fetchMainDatabase, fetchSharedItem, saveMainDatabase, saveSharedItem } from './data/gist.js';
import { parseWorkspaceSnapshot, serializeWorkspaceSnapshot } from './data/workspace.js';
import { createMarkdownEditor } from './lib/editor.js';
import { contentTags, contentReferences, matchesLibraryFilter } from './lib/notebook.js';
import { MATHJAX_UNAVAILABLE_EVENT, renderDocument, renderInlineMath, renderPreviewDocument, setRenderedHtml, typesetElement } from './lib/renderer.js';

const LOCAL_DATABASE_KEY = 'rq_v2_local_database';
const UI_LANGUAGE_KEY = 'rq_v2_language';

const I18N = {
    en: {
        documentTitle: 'Research QA',
        brandEyebrow: 'Mathematical Problem Ledger',
        sync: 'Sync',
        export: 'Export',
        import: 'Import',
        settings: 'Settings',
        legacy: 'Legacy',
        importLegacy: 'Import legacy data',
        importLegacyUnavailable: 'No legacy config',
        exportPdf: 'Export PDF',
        exportNotePdf: 'Export PDF',
        storageLocalFirst: 'Local-first',
        storageGistSync: 'Gist sync',
        storageSharedReadOnly: 'Shared read-only',
        sidebarTitle: 'Problems',
        new: 'New',
        statusNotConnected: 'Not connected',
        viewProblems: 'Problems',
        viewTrash: 'Trash',
        search: 'Search',
        searchPlaceholder: 'Search titles, body, and notes',
        emptyEyebrow: 'Rewrite Ready',
        emptyTitle: 'Your existing data stays intact',
        emptyDescription: 'The new app keeps the legacy gist structure compatible and moves the working copy into a local-first flow without touching your saved problems.',
        newProblemButton: 'New problem',
        configureSync: 'Configure sync',
        heroProblem: 'Problem',
        heroNotLoaded: 'Not loaded',
        heroRemoteDefault: 'Local-first',
        detailEmptyTitle: 'No problem selected',
        detailEmptySubtitle: 'Pick a problem on the left to read the statement and research notes.',
        pin: 'Pin',
        unpin: 'Unpin',
        share: 'Share',
        edit: 'Edit',
        delete: 'Delete',
        statementKicker: 'Problem Statement',
        statement: 'Statement',
        notesKicker: 'Notes Timeline',
        researchNotes: 'Research Notes',
        addNote: 'Add note',
        editProblemMode: 'Edit problem',
        contentEditor: 'Content editor',
        closeEditor: 'Close editor',
        titleLabel: 'Title',
        titlePlaceholder: 'Enter a problem title',
        preambleLabel: 'LaTeX preamble',
        source: 'Source',
        preview: 'Preview',
        cancel: 'Cancel',
        save: 'Save',
        syncBridge: 'Sync Bridge',
        syncSettings: 'Sync settings',
        closeSettings: 'Close settings',
        githubToken: 'GitHub Token',
        githubTokenPlaceholder: 'Required for private gist read/write',
        mainGistId: 'Main database Gist ID',
        mainGistPlaceholder: 'Leave blank to stay local-first; with a token, a main gist can be created automatically',
        configNote: 'The new app imports legacy v7_config settings automatically and keeps reading main_db.json / shared_item.json.',
        saveSettings: 'Save settings',
        statusLoadedCache: 'Loaded cache',
        statusLoadingShare: 'Loading share',
        statusSharedView: 'Shared view',
        statusLoadFailed: 'Load failed',
        toastNoRemoteGist: 'No remote gist configured. Changes will stay in local cache.',
        statusLocalMode: 'Local mode',
        statusSyncing: 'Syncing',
        statusImportedLegacy: 'Imported legacy data',
        toastImportedLegacy: 'Imported legacy data: {problems} problems, {trash} trash items',
        statusSynced: 'Synced',
        toastPulledLatest: 'Pulled the latest data from GitHub gist',
        statusOfflineCache: 'Offline cache',
        statusSavedLocally: 'Saved locally',
        statusLocalAhead: 'Unsynced local changes',
        toastLocalAheadHint: 'This device has changes that are not on the remote gist yet. Press Sync to resolve.',
        confirmPullOverwriteLocal: 'This device has unsynced local changes. Pulling will replace them with the remote copy. Continue?',
        confirmConflictOverwrite: 'The remote database changed since this device last synced (possibly from another device). Overwrite the remote copy with this device\'s data? Cancel keeps your changes on this device only.',
        toastConflictKeptLocal: 'Your changes are kept on this device. Press Sync to review the remote copy.',
        statusLoadingSharedItem: 'Loading shared item',
        statusSyncedSharedItem: 'Synced shared item',
        statusSharedItemUnavailable: 'Shared item unavailable',
        viewTrashCount: 'Trash {count}',
        viewProblemsCount: 'Problems {count}',
        noMatch: 'No Match',
        noResults: 'No results match the current search.',
        noProblems: 'No problems yet.',
        archivedNoteTitle: 'Archived note - {title}',
        note: 'Note',
        deletedAt: 'Deleted {date}',
        sharedBadge: 'Shared',
        pinnedBadge: 'Pinned',
        notesCount: '{count} notes',
        restoreNoteHint: 'Restore this note to return it to its original problem, or delete it permanently.',
        archivedNote: 'Archived note',
        trashBadge: 'Trash',
        originalProblem: 'Original problem',
        readyToRestore: 'Ready to restore',
        restoreNoteDescription: 'This note is currently stored in trash. Restoring it will attach it back to the original problem when possible.',
        trashedProblem: 'Trashed problem',
        detailTrashSubtitle: 'This is a trash view. You can restore the item or delete it permanently.',
        detailProblemSubtitle: 'Markdown, MathJax, theorem/proof blocks, and local-first caching stay in one workspace.',
        updatedAt: 'Updated {date}',
        sharedGist: 'Shared gist',
        mainGist: 'Main gist',
        localCache: 'Local cache',
        restoreDelete: 'Restore / Delete',
        noNotesEyebrow: 'No Notes Yet',
        noNotesTitle: 'No research notes yet.',
        noNotesDescription: 'Capture ideas, failed attempts, local lemmas, and proof fragments here so they stay searchable.',
        collapse: 'Collapse',
        expand: 'Expand',
        editNote: 'Edit',
        deleteNote: 'Delete',
        newProblem: 'New problem',
        defaultUntitledProblem: 'Untitled problem',
        problemEditor: 'Problem editor',
        newNoteMode: 'New note',
        editNoteMode: 'Edit note',
        researchNote: 'Research note',
        toastSaved: 'Saved',
        confirmMoveNoteToTrash: 'Move this note to trash?',
        toastNoteMovedToTrash: 'Note moved to trash',
        promptTrashAction: 'Enter 1 to restore, or 2 to delete permanently.',
        confirmMoveProblemToTrash: 'Move this problem to trash?',
        toastProblemMovedToTrash: 'Problem moved to trash',
        recoveredNoteTitle: 'Recovered note - {title}',
        recoveredNoteDescription: 'Auto-generated so a restored note is not lost when its original problem no longer exists.',
        toastRestoredFromTrash: 'Restored from trash',
        confirmPermanentDelete: 'Delete permanently? This cannot be undone.',
        toastPermanentlyDeleted: 'Permanently deleted',
        toastShareLinkCopied: 'Share link copied',
        promptShareLink: 'Share link',
        toastNeedTokenForShare: 'Configure a GitHub token before creating a share link.',
        toastCreatedSharedGist: 'Created a shared gist. Note: anyone with the link can view it. Click Share again to copy the link.',
        toastPinned: 'Pinned to the top section',
        toastUnpinned: 'Removed from the pinned section',
        statusCreatingMainGist: 'Creating main gist',
        toastCreatedMainGist: 'Created main database gist: {id}',
        confirmImportOverwrite: 'Importing will overwrite the current local cache and remote main database. Continue?',
        toastImportCompleted: 'Import completed',
        toastImportFailed: 'Import failed: {message}',
        toastNoLegacyConfig: 'No legacy config was found in this browser.',
        confirmImportLegacyOverwrite: 'Importing legacy data will overwrite the current local cache with the old main gist. Continue?',
        toastPdfPopupBlocked: 'The browser blocked the PDF window. Allow pop-ups for this site and try again.',
        backToProblems: 'Back to problems',
        toastMathJaxUnavailable: 'The math rendering engine failed to load (CDN unreachable). Formulas are shown as source until the page reloads with a working connection.'
    },
    zh: {
        documentTitle: 'Research QA',
        brandEyebrow: '数学问题手账',
        sync: '同步',
        export: '导出',
        import: '导入',
        settings: '设置',
        legacy: '旧版',
        importLegacy: '导入旧版数据',
        importLegacyUnavailable: '无旧版配置',
        exportPdf: '导出 PDF',
        exportNotePdf: '导出 PDF',
        storageLocalFirst: '本地优先',
        storageGistSync: 'Gist 同步',
        storageSharedReadOnly: '分享只读',
        sidebarTitle: '问题',
        new: '新建',
        statusNotConnected: '未连接',
        viewProblems: '问题',
        viewTrash: '回收站',
        search: '搜索',
        searchPlaceholder: '搜索标题、正文和笔记',
        emptyEyebrow: '准备就绪',
        emptyTitle: '你的已有数据保持原样',
        emptyDescription: '新应用兼容旧版 gist 数据结构，并把工作副本迁移到本地优先流程，不会改动已保存的问题。',
        newProblemButton: '新建问题',
        configureSync: '配置同步',
        heroProblem: '问题',
        heroNotLoaded: '未加载',
        heroRemoteDefault: '本地优先',
        detailEmptyTitle: '未选择问题',
        detailEmptySubtitle: '在左侧选择一个问题，查看题面和研究笔记。',
        pin: '置顶',
        unpin: '取消置顶',
        share: '分享',
        edit: '编辑',
        delete: '删除',
        statementKicker: '题面',
        statement: '题面',
        notesKicker: '笔记时间线',
        researchNotes: '研究笔记',
        addNote: '添加笔记',
        editProblemMode: '编辑问题',
        contentEditor: '内容编辑器',
        closeEditor: '关闭编辑器',
        titleLabel: '标题',
        titlePlaceholder: '输入问题标题',
        preambleLabel: 'LaTeX 导言区',
        source: '源码',
        preview: '预览',
        cancel: '取消',
        save: '保存',
        syncBridge: '同步桥',
        syncSettings: '同步设置',
        closeSettings: '关闭设置',
        githubToken: 'GitHub Token',
        githubTokenPlaceholder: '读写私有 gist 时必填',
        mainGistId: '主数据库 Gist ID',
        mainGistPlaceholder: '留空则保持本地优先；填写 token 后可自动创建主 gist',
        configNote: '新应用会自动导入旧版 v7_config 设置，并继续读取 main_db.json / shared_item.json。',
        saveSettings: '保存设置',
        statusLoadedCache: '已加载缓存',
        statusLoadingShare: '加载分享中',
        statusSharedView: '分享视图',
        statusLoadFailed: '加载失败',
        toastNoRemoteGist: '未配置远端 gist，更改将只保存在本地缓存。',
        statusLocalMode: '本地模式',
        statusSyncing: '同步中',
        statusImportedLegacy: '已导入旧版数据',
        toastImportedLegacy: '已导入旧版数据：{problems} 个问题，{trash} 条回收站记录',
        statusSynced: '已同步',
        toastPulledLatest: '已从 GitHub gist 拉取最新数据',
        statusOfflineCache: '离线缓存',
        statusSavedLocally: '已保存到本地',
        statusLocalAhead: '本地有未同步修改',
        toastLocalAheadHint: '本设备有尚未同步到远端 gist 的修改，点击“同步”处理。',
        confirmPullOverwriteLocal: '本设备有未同步的本地修改，拉取会用远端副本覆盖它们。继续吗？',
        confirmConflictOverwrite: '远端数据库在本设备上次同步后发生了变化（可能来自其他设备）。要用本设备的数据覆盖远端吗？选择“取消”则只在本设备保留你的修改。',
        toastConflictKeptLocal: '你的修改已保留在本设备。点击“同步”查看远端副本。',
        statusLoadingSharedItem: '加载分享条目中',
        statusSyncedSharedItem: '分享条目已同步',
        statusSharedItemUnavailable: '分享条目不可用',
        viewTrashCount: '回收站 {count}',
        viewProblemsCount: '问题 {count}',
        noMatch: '无匹配',
        noResults: '没有符合当前搜索的结果。',
        noProblems: '还没有问题。',
        archivedNoteTitle: '已归档笔记 - {title}',
        note: '笔记',
        deletedAt: '删除于 {date}',
        sharedBadge: '已分享',
        pinnedBadge: '置顶',
        notesCount: '{count} 条笔记',
        restoreNoteHint: '恢复此笔记可将它放回原问题，也可以永久删除。',
        archivedNote: '已归档笔记',
        trashBadge: '回收站',
        originalProblem: '原问题',
        readyToRestore: '可恢复',
        restoreNoteDescription: '此笔记当前在回收站中。恢复时会尽可能挂回原问题。',
        trashedProblem: '已删除问题',
        detailTrashSubtitle: '这是回收站视图。你可以恢复该条目，或永久删除。',
        detailProblemSubtitle: 'Markdown、MathJax、定理/证明块和本地优先缓存都在同一工作区中。',
        updatedAt: '更新于 {date}',
        sharedGist: '分享 gist',
        mainGist: '主 gist',
        localCache: '本地缓存',
        restoreDelete: '恢复 / 删除',
        noNotesEyebrow: '暂无笔记',
        noNotesTitle: '还没有研究笔记。',
        noNotesDescription: '把想法、失败的尝试、局部引理和证明片段记在这里，方便随时搜索。',
        collapse: '收起',
        expand: '展开',
        editNote: '编辑',
        deleteNote: '删除',
        newProblem: '新建问题',
        defaultUntitledProblem: '未命名问题',
        problemEditor: '问题编辑器',
        newNoteMode: '新建笔记',
        editNoteMode: '编辑笔记',
        researchNote: '研究笔记',
        toastSaved: '已保存',
        confirmMoveNoteToTrash: '把这条笔记移入回收站？',
        toastNoteMovedToTrash: '笔记已移入回收站',
        promptTrashAction: '输入 1 恢复，输入 2 永久删除。',
        confirmMoveProblemToTrash: '把这个问题移入回收站？',
        toastProblemMovedToTrash: '问题已移入回收站',
        recoveredNoteTitle: '恢复的笔记 - {title}',
        recoveredNoteDescription: '原问题已不存在时自动生成，避免恢复的笔记丢失。',
        toastRestoredFromTrash: '已从回收站恢复',
        confirmPermanentDelete: '永久删除？此操作无法撤销。',
        toastPermanentlyDeleted: '已永久删除',
        toastShareLinkCopied: '分享链接已复制',
        promptShareLink: '分享链接',
        toastNeedTokenForShare: '创建分享链接前请先配置 GitHub token。',
        toastCreatedSharedGist: '已创建分享 gist。注意：任何拿到链接的人都能查看。再次点击“分享”复制链接。',
        toastPinned: '已置顶',
        toastUnpinned: '已取消置顶',
        statusCreatingMainGist: '正在创建主 gist',
        toastCreatedMainGist: '已创建主数据库 gist：{id}',
        confirmImportOverwrite: '导入将覆盖当前本地缓存和远端主数据库。继续吗？',
        toastImportCompleted: '导入完成',
        toastImportFailed: '导入失败：{message}',
        toastNoLegacyConfig: '此浏览器中没有找到旧版配置。',
        confirmImportLegacyOverwrite: '导入旧版数据会用旧的主 gist 覆盖当前本地缓存。继续吗？',
        toastPdfPopupBlocked: '浏览器拦截了 PDF 窗口。请允许本站弹出窗口后重试。',
        backToProblems: '返回问题列表',
        toastMathJaxUnavailable: '数学公式渲染引擎加载失败（CDN 无法访问）。在网络恢复并刷新页面前，公式将以源码形式显示。'
    }
};

let activeLanguage = 'en';

function readStoredLanguage() {
    try {
        return localStorage.getItem(UI_LANGUAGE_KEY) === 'zh' ? 'zh' : 'en';
    } catch (error) {
        return 'en';
    }
}

function persistLanguage(language) {
    activeLanguage = language === 'zh' ? 'zh' : 'en';
    try {
        localStorage.setItem(UI_LANGUAGE_KEY, activeLanguage);
    } catch (error) {
        // Ignore persistence failures in private browsing contexts.
    }
    return activeLanguage;
}

function interpolate(text, params = {}) {
    return String(text).replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createId(prefix = 'id') {
    if (window.crypto?.randomUUID) {
        return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clone(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function normalizeNote(note = {}) {
    return {
        id: typeof note.id === 'string' || Number.isFinite(note.id) ? String(note.id) : createId('note'),
        text: typeof note.text === 'string' ? note.text : '',
        date: typeof note.date === 'string' ? note.date : new Date().toISOString()
    };
}

function normalizeItem(item = {}) {
    const parsedSortRank = item.sortRank == null || item.sortRank === '' ? NaN : Number(item.sortRank);
    return {
        id: item.id == null ? createId('item') : String(item.id),
        title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled problem',
        desc: typeof item.desc === 'string' ? item.desc : '',
        preamble: typeof item.preamble === 'string' ? item.preamble : '',
        answers: Array.isArray(item.answers) ? item.answers.map(normalizeNote) : [],
        date: typeof item.date === 'string' ? item.date : new Date().toISOString(),
        isPinned: Boolean(item.isPinned),
        pinnedAt: typeof item.pinnedAt === 'string'
            ? item.pinnedAt
            : (item.isPinned
                ? (typeof item.date === 'string' ? item.date : new Date().toISOString())
                : ''),
        sortRank: Number.isFinite(parsedSortRank) ? parsedSortRank : null,
        shareId: typeof item.shareId === 'string' && item.shareId.trim() ? item.shareId.trim() : ''
    };
}

function toTimestamp(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
}

function compareItems(a, b) {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
    }

    const aHasRank = Number.isFinite(a.sortRank);
    const bHasRank = Number.isFinite(b.sortRank);
    if (aHasRank && bHasRank && a.sortRank !== b.sortRank) {
        return a.sortRank - b.sortRank;
    }
    if (aHasRank !== bHasRank) {
        return aHasRank ? -1 : 1;
    }

    if (a.isPinned && b.isPinned) {
        return toTimestamp(b.pinnedAt || b.date) - toTimestamp(a.pinnedAt || a.date);
    }

    return toTimestamp(b.date) - toTimestamp(a.date);
}

function resequenceItemRanks(items) {
    let pinnedIndex = 0;
    let regularIndex = 0;

    items.forEach((item) => {
        if (item.isPinned) {
            item.sortRank = pinnedIndex++;
            return;
        }
        item.sortRank = regularIndex++;
    });
}

function sortItemsInPlace(items) {
    items.sort(compareItems);
    resequenceItemRanks(items);
    return items;
}

function normalizeTrashEntry(entry = {}) {
    if (entry.type === 'note') {
        return {
            id: typeof entry.id === 'string'
                ? entry.id
                : (typeof entry.data?.id === 'string' ? `trash-${entry.data.id}` : createId('trash-note')),
            type: 'note',
            data: normalizeNote(entry.data || {}),
            parentId: entry.parentId ?? null,
            parentTitle: typeof entry.parentTitle === 'string' ? entry.parentTitle : 'Unknown problem',
            parentPreamble: typeof entry.parentPreamble === 'string' ? entry.parentPreamble : '',
            deletedAt: typeof entry.deletedAt === 'string' ? entry.deletedAt : new Date().toISOString()
        };
    }

    return {
        ...normalizeItem(entry),
        type: 'item',
        deletedAt: typeof entry.deletedAt === 'string' ? entry.deletedAt : new Date().toISOString()
    };
}

function normalizeDatabase(raw = {}) {
    if (Array.isArray(raw)) {
        return {
            items: sortItemsInPlace(raw.map(normalizeItem)),
            trash: []
        };
    }

    return {
        items: Array.isArray(raw.items) ? sortItemsInPlace(raw.items.map(normalizeItem)) : [],
        trash: Array.isArray(raw.trash) ? raw.trash.map(normalizeTrashEntry) : []
    };
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleString(activeLanguage === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

function pruneMap(map, maxSize) {
    while (map.size > maxSize) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
    }
}

function hashString(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

class ResearchQaApp {
    constructor() {
        const initialRoute = this.readRouteFromLocation();
        this.language = persistLanguage(readStoredLanguage());
        this.configSource = getConfigSource();
        this.authProfile = getLockedConfigProfile();
        this.authSession = null;
        this.requiresUnlock = !initialRoute.visitorGistId && Boolean(this.authProfile);
        this.config = this.requiresUnlock ? { token: '', mainGistId: '' } : loadConfig();
        this.db = normalizeDatabase({});
        this.baseDb = clone(this.db);
        this.listLimit = 100;
        this.libraryFilter = 'all';
        this.libraryTag = '';
        this.contextVisible = window.matchMedia('(min-width: 1201px)').matches;
        this.editorView = 'source';
        this.saving = false;
        this.sharing = false;
        this.pendingLocalCommits = 0;
        this.tagCache = new WeakMap();
        this.syncJobs = new Map();
        this.remoteDbVersion = '';
        this.localDirty = false;
        this.viewMode = initialRoute.viewMode;
        this.pageMode = initialRoute.pageMode;
        this.currentId = initialRoute.itemId;
        this.currentItem = null;
        this.currentSummary = null;
        this.currentSource = 'local';
        this.selectionToken = 0;
        this.expandedNotes = new Set();
        this.pinFeedback = {
            itemId: null,
            state: ''
        };
        this.pinFeedbackTimer = null;
        this.dragState = {
            itemId: null,
            pinGroup: '',
            overId: null,
            position: 'before',
            previewChanged: false,
            committed: false
        };
        this.noteDragState = {
            noteId: null,
            overId: null,
            position: 'before',
            previewChanged: false,
            committed: false,
            active: false,
            pointerId: null,
            startX: 0,
            startY: 0
        };
        this.pendingListDragPreview = null;
        this.listDragFrame = 0;
        this.pendingNoteDragPreview = null;
        this.noteDragFrame = 0;
        this.renderCache = {
            noteBodies: new Map()
        };
        this.lastListHtml = '';
        this.lastDetailTitleKey = '';
        this.lastProblemRenderKey = '';
        this.searchTimer = null;
        this.suppressRowClickUntil = 0;
        this.visitorGistId = initialRoute.visitorGistId;
        this.composerState = {
            open: false,
            kind: 'problem',
            noteId: null
        };
        this.previewTimer = null;
        this.statusState = {
            key: 'statusNotConnected',
            params: {}
        };

        const readerCards = document.querySelectorAll('.reader-card');

        this.elements = {
            appShell: document.querySelector('.app-shell'),
            workspace: document.querySelector('.workspace'),
            topbarActions: document.querySelector('.topbar-actions'),
            brandEyebrow: document.querySelector('.topbar-brand .eyebrow'),
            backHomeButton: document.getElementById('back-home-btn'),
            list: document.getElementById('problem-list'),
            searchInput: document.getElementById('search-input'),
            searchLabel: document.querySelector('.search-shell span'),
            syncStatus: document.getElementById('sync-status'),
            viewStatus: document.getElementById('view-status'),
            storageLabel: document.getElementById('storage-label'),
            sidebarTitle: document.querySelector('.accent-panel h2'),
            emptyState: document.getElementById('empty-state'),
            emptyEyebrow: document.querySelector('#empty-state .eyebrow'),
            emptyTitle: document.querySelector('#empty-state h2'),
            emptyDescription: document.querySelector('#empty-state p'),
            detailView: document.getElementById('detail-view'),
            detailTitle: document.getElementById('detail-title'),
            detailSubtitle: document.getElementById('detail-subtitle'),
            heroKind: document.getElementById('hero-kind'),
            heroUpdated: document.getElementById('hero-updated'),
            heroRemote: document.getElementById('hero-remote'),
            problemRender: document.getElementById('problem-render'),
            noteList: document.getElementById('note-list'),
            problemSectionKicker: readerCards[0]?.querySelector('.section-kicker') ?? null,
            problemSectionTitle: readerCards[0]?.querySelector('h3') ?? null,
            notesSectionKicker: readerCards[1]?.querySelector('.section-kicker') ?? null,
            notesSectionTitle: readerCards[1]?.querySelector('h3') ?? null,
            composer: document.getElementById('composer'),
            composerModeLabel: document.getElementById('composer-mode-label'),
            composerTitleText: document.getElementById('composer-title-text'),
            composerTitleField: document.getElementById('composer-title-field'),
            composerTitleLabel: document.querySelector('#composer-title-field span'),
            composerTitleInput: document.getElementById('composer-title-input'),
            composerPreambleField: document.getElementById('composer-preamble-field'),
            composerPreambleLabel: document.querySelector('#composer-preamble-field span'),
            composerPreambleInput: document.getElementById('composer-preamble-input'),
            composerPreview: document.getElementById('composer-preview'),
            composerCloseButton: document.getElementById('close-composer-btn'),
            sourceCaption: document.querySelector('.editor-panel .panel-caption'),
            previewCaption: document.querySelector('.preview-panel .panel-caption'),
            editorHost: document.getElementById('editor-host'),
            configModal: document.getElementById('config-modal'),
            configModalEyebrow: document.querySelector('#config-modal .eyebrow'),
            configModalTitle: document.querySelector('#config-modal h2'),
            configTokenLabel: document.querySelector('#config-token-input')?.closest('.field')?.querySelector('span') ?? null,
            configTokenInput: document.getElementById('config-token-input'),
            configGistLabel: document.querySelector('#config-gist-input')?.closest('.field')?.querySelector('span') ?? null,
            configGistInput: document.getElementById('config-gist-input'),
            configAuthUsernameLabel: document.querySelector('#config-auth-username-input')?.closest('.field')?.querySelector('span') ?? null,
            configAuthUsernameInput: document.getElementById('config-auth-username-input'),
            configAuthPasswordLabel: document.querySelector('#config-auth-password-input')?.closest('.field')?.querySelector('span') ?? null,
            configAuthPasswordInput: document.getElementById('config-auth-password-input'),
            configAuthPasswordConfirmLabel: document.querySelector('#config-auth-password-confirm-input')?.closest('.field')?.querySelector('span') ?? null,
            configAuthPasswordConfirmInput: document.getElementById('config-auth-password-confirm-input'),
            configAuthNote: document.getElementById('config-auth-note'),
            configNote: document.getElementById('config-sync-note'),
            configActions: document.querySelector('#config-modal .modal-actions'),
            configCloseButton: document.getElementById('close-config-btn'),
            disableLockButton: document.getElementById('disable-lock-btn'),
            authScreen: document.getElementById('auth-screen'),
            authEyebrow: document.querySelector('#auth-screen .eyebrow'),
            authTitle: document.querySelector('#auth-screen h2'),
            authDescription: document.getElementById('auth-description'),
            authUsernameLabel: document.querySelector('#auth-username-input')?.closest('.field')?.querySelector('span') ?? null,
            authUsernameInput: document.getElementById('auth-username-input'),
            authPasswordLabel: document.querySelector('#auth-password-input')?.closest('.field')?.querySelector('span') ?? null,
            authPasswordInput: document.getElementById('auth-password-input'),
            authError: document.getElementById('auth-error'),
            authUnlockButton: document.getElementById('auth-unlock-btn'),
            toastStack: document.getElementById('toast-stack'),
            importFileInput: document.getElementById('import-file-input'),
            syncButton: document.getElementById('sync-btn'),
            exportButton: document.getElementById('export-btn'),
            importButton: document.getElementById('import-btn'),
            configButton: document.getElementById('config-btn'),
            createItemButton: document.getElementById('create-item-btn'),
            emptyCreateButton: document.getElementById('empty-create-btn'),
            emptyConfigButton: document.getElementById('empty-config-btn'),
            activeViewButton: document.querySelector('[data-view-mode="active"]'),
            trashViewButton: document.querySelector('[data-view-mode="trash"]'),
            pinItemButton: document.getElementById('pin-item-btn'),
            shareItemButton: document.getElementById('share-item-btn'),
            pdfItemButton: document.getElementById('pdf-item-btn'),
            editProblemButton: document.getElementById('edit-problem-btn'),
            restoreItemButton: document.getElementById('restore-item-btn'),
            destroyItemButton: document.getElementById('destroy-item-btn'),
            deleteItemButton: document.getElementById('delete-item-btn'),
            newNoteButton: document.getElementById('new-note-btn'),
            cancelComposerButton: document.getElementById('cancel-composer-btn'),
            saveComposerButton: document.getElementById('save-composer-btn'),
            cancelConfigButton: document.getElementById('cancel-config-btn'),
            saveConfigButton: document.getElementById('save-config-btn')
        };

        this.editor = createMarkdownEditor({
            host: this.elements.editorHost,
            placeholderText: 'Markdown / LaTeX',
            onChange: (value) => { this.scheduleComposerPreview(value); this.refreshDraftStatus(); }
        });
    }

    get databaseCacheKey() {
        return this.config.mainGistId ? `rq_v2_main_${this.config.mainGistId}` : LOCAL_DATABASE_KEY;
    }

    get databaseVersionKey() {
        return `${this.databaseCacheKey}:version`;
    }

    get databaseDirtyKey() {
        return `${this.databaseCacheKey}:dirty`;
    }

    sharedCacheKey(gistId) {
        return `rq_v2_shared_${gistId}`;
    }

    text(key, params = {}) {
        const bundle = I18N[this.language] ?? I18N.en;
        const fallback = I18N.en[key] ?? key;
        return interpolate(bundle[key] ?? fallback, params);
    }

    literal(en, zh) {
        return this.language === 'zh' ? zh : en;
    }

    ensureUtilityButtons() {
        if (!document.getElementById('language-btn')) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'language-btn';
            button.className = 'top-btn';
            button.addEventListener('click', () => this.toggleLanguage());
            this.elements.topbarActions.insertBefore(button, this.elements.configButton);
        }

        if (!document.getElementById('import-legacy-btn')) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'import-legacy-btn';
            button.className = 'secondary-btn';
            button.addEventListener('click', () => this.importLegacyData());
            this.elements.configActions.insertBefore(button, this.elements.cancelConfigButton);
        }

        this.elements.languageButton = document.getElementById('language-btn');
        this.elements.importLegacyButton = document.getElementById('import-legacy-btn');
    }

    applyLanguage({ rerender = true } = {}) {
        document.documentElement.lang = this.language === 'zh' ? 'zh-CN' : 'en';
        document.title = this.text('documentTitle');

        this.elements.brandEyebrow.textContent = this.text('brandEyebrow');
        this.elements.backHomeButton.textContent = this.text('backToProblems');
        this.elements.syncButton.textContent = this.text('sync');
        this.elements.exportButton.textContent = this.text('export');
        this.elements.importButton.textContent = this.text('import');
        this.elements.configButton.textContent = this.text('settings');
        this.elements.sidebarTitle.textContent = this.text('sidebarTitle');
        this.elements.createItemButton.textContent = this.text('new');
        this.elements.activeViewButton.textContent = this.text('viewProblems');
        this.elements.trashViewButton.textContent = this.text('viewTrash');
        this.elements.searchLabel.textContent = this.text('search');
        this.elements.searchInput.placeholder = this.text('searchPlaceholder');
        this.elements.emptyEyebrow.textContent = this.text('emptyEyebrow');
        this.elements.emptyTitle.textContent = this.text('emptyTitle');
        this.elements.emptyDescription.textContent = this.text('emptyDescription');
        this.elements.emptyCreateButton.textContent = this.text('newProblemButton');
        this.elements.emptyConfigButton.textContent = this.text('configureSync');
        this.elements.problemSectionKicker.textContent = this.text('statementKicker');
        this.elements.problemSectionTitle.textContent = this.text('statement');
        this.elements.notesSectionKicker.textContent = this.text('notesKicker');
        this.elements.notesSectionTitle.textContent = this.text('researchNotes');
        this.elements.newNoteButton.textContent = this.text('addNote');
        this.elements.pinItemButton.textContent = this.text('pin');
        this.elements.shareItemButton.textContent = this.text('share');
        this.elements.pdfItemButton.textContent = this.text('exportPdf');
        this.elements.editProblemButton.textContent = this.text('edit');
        this.elements.restoreItemButton.textContent = 'Restore';
        this.elements.destroyItemButton.textContent = 'Delete permanently';
        this.elements.composerTitleLabel.textContent = this.text('titleLabel');
        this.elements.composerTitleInput.placeholder = this.text('titlePlaceholder');
        this.elements.composerPreambleLabel.textContent = this.text('preambleLabel');
        this.elements.sourceCaption.textContent = this.text('source');
        this.elements.previewCaption.textContent = this.text('preview');
        this.elements.cancelComposerButton.textContent = this.text('cancel');
        this.elements.saveComposerButton.textContent = this.text('save');
        this.elements.composerCloseButton.setAttribute('aria-label', this.text('closeEditor'));
        this.elements.configModalEyebrow.textContent = this.text('syncBridge');
        this.elements.configModalTitle.textContent = this.text('syncSettings');
        this.elements.configTokenLabel.textContent = this.text('githubToken');
        this.elements.configTokenInput.placeholder = this.text('githubTokenPlaceholder');
        this.elements.configGistLabel.textContent = this.text('mainGistId');
        this.elements.configGistInput.placeholder = this.text('mainGistPlaceholder');
        this.elements.configAuthUsernameLabel.textContent = this.literal('App username', '应用用户名');
        this.elements.configAuthUsernameInput.placeholder = this.literal('Set your own sign-in name', '设置你自己的登录名');
        this.elements.configAuthPasswordLabel.textContent = this.literal('App password', '应用密码');
        this.elements.configAuthPasswordInput.placeholder = this.literal('Leave blank to keep the current password', '留空则保持当前密码');
        this.elements.configAuthPasswordConfirmLabel.textContent = this.literal('Confirm app password', '确认应用密码');
        this.elements.configAuthPasswordConfirmInput.placeholder = this.literal('Repeat the password when changing it', '修改密码时请重复输入');
        this.elements.configAuthNote.textContent = this.literal('Once enabled, your GitHub sync token and gist ID are encrypted locally behind this username/password.', '启用后，你的 GitHub 同步 token 和 gist ID 会在本地用此用户名/密码加密保存。');
        this.elements.configNote.innerHTML = this.text('configNote');
        this.elements.cancelConfigButton.textContent = this.text('cancel');
        this.elements.saveConfigButton.textContent = this.text('saveSettings');
        this.elements.configCloseButton.setAttribute('aria-label', this.text('closeSettings'));
        this.elements.disableLockButton.textContent = this.literal('Disable app login', '关闭应用登录');
        this.elements.authEyebrow.textContent = this.literal('Private Workspace', '私人工作区');
        this.elements.authTitle.textContent = this.literal('Unlock Research QA', '解锁 Research QA');
        this.elements.authDescription.textContent = this.literal('Sign in with your own app account to load the encrypted sync configuration.', '使用你的应用账号登录，以加载加密的同步配置。');
        this.elements.authUsernameLabel.textContent = this.literal('Username', '用户名');
        this.elements.authUsernameInput.placeholder = this.literal('Enter your app username', '输入应用用户名');
        this.elements.authPasswordLabel.textContent = this.literal('Password', '密码');
        this.elements.authPasswordInput.placeholder = this.literal('Enter your app password', '输入应用密码');
        this.elements.authUnlockButton.textContent = this.literal('Unlock', '解锁');

        if (this.elements.languageButton) {
            this.elements.languageButton.textContent = this.language === 'zh' ? 'EN' : 'ZH';
        }

        this.applyNotebookLanguage();
        this.updateLegacyImportButton();
        this.updateDisableLockButton();
        this.refreshComposerChrome();
        this.refreshStatus();
        this.reflectConfig();

        if (rerender) {
            this.renderAll();
        }
    }

    toggleLanguage() {
        this.language = persistLanguage(this.language === 'zh' ? 'en' : 'zh');
        this.applyLanguage();
    }

    refreshComposerChrome() {
        if (this.composerState.kind === 'problem') {
            this.elements.composerModeLabel.textContent = this.text('editProblemMode');
            this.elements.composerTitleText.textContent = this.text('problemEditor');
            return;
        }

        this.elements.composerModeLabel.textContent = this.text(this.composerState.noteId ? 'editNoteMode' : 'newNoteMode');
        this.elements.composerTitleText.textContent = this.text('researchNote');
    }

    updateLegacyImportButton() {
        if (!this.elements.importLegacyButton) {
            return;
        }

        const available = hasLegacyConfig();
        this.elements.importLegacyButton.disabled = !available;
        this.elements.importLegacyButton.textContent = available ? this.text('importLegacy') : this.text('importLegacyUnavailable');
    }

    applyNotebookLanguage() {
        const labels = {
            'workspace-menu-label': ['Workspace', '工作区'], 'tags-label': ['Tags', '标签'],
            'breadcrumb-home-btn': ['Problem library', '问题库'], 'breadcrumb-current': ['Notebook', '研究手账'],
            'reader-mode-label': ['Reading', '阅读'], 'open-item-tab-btn': ['Open in new tab', '在新标签页打开']
        };
        for (const [id, words] of Object.entries(labels)) document.getElementById(id).textContent = this.literal(...words);
        this.elements.createItemButton.textContent = '+ ' + this.text('newProblemButton');
        this.elements.sidebarTitle.textContent = this.literal('My problems', '我的问题');
        this.elements.emptyEyebrow.textContent = this.literal('A place to think', '为思考留一页');
        this.elements.emptyTitle.textContent = this.literal('Every idea starts with a question.', '每个想法，从一个问题开始。');
        this.elements.emptyDescription.textContent = this.literal('Choose a problem from your library, or start a new page. Your statements, formulas, and research notes stay together, saved on this device.', '从左侧选择问题，或开启新的一页。问题、公式与研究记录保存在一起，随时继续思考。');
        this.elements.searchInput.placeholder = this.literal('Search problems…', '搜索问题…');
        const toggle = document.getElementById('library-toggle-btn');
        toggle.setAttribute('aria-label', this.literal('Toggle problem library', '打开或关闭问题库'));
        document.getElementById('context-toggle-btn').setAttribute('aria-label', this.literal('Toggle context panel', '打开或关闭相关资料'));
        document.querySelectorAll('button[data-editor-view]').forEach(button => {
            const labels = { source: ['Edit', '编辑'], preview: ['Preview', '预览'], split: ['Split view', '分栏'] };
            button.textContent = this.literal(...labels[button.dataset.editorView]);
        });
        this.refreshDraftStatus();
    }

    setLibraryOpen(open) {
        this.elements.workspace.classList.toggle('library-open', open);
        const toggle = document.getElementById('library-toggle-btn');
        toggle.setAttribute('aria-expanded', String(open));
        document.getElementById('library-scrim').classList.toggle('hidden', !open);
        if (window.matchMedia('(max-width: 760px)').matches) {
            this.elements.composer.inert = open;
            document.querySelector('.main-panel').inert = open;
            document.getElementById('context-panel').inert = open;
            if (open) this.elements.searchInput.focus();
            else toggle.focus();
        }
    }

    setEditorView(view) {
        this.editorView = view;
        this.elements.composer.dataset.editorView = view;
        document.querySelectorAll('button[data-editor-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.editorView === view)));
    }

    refreshDraftStatus() {
        if (!this.elements) return;
        const draft = this.hasUnsavedComposer();
        const text = this.sharing ? this.literal('Creating shared copy…', '正在创建分享副本…') : (this.saving || this.pendingLocalCommits) ? this.literal('Saving…', '正在保存…') : draft ? this.literal('Unsaved draft', '草稿未保存') : this.composerState.open ? this.literal('No unsaved changes', '没有未保存的更改') : this.text(this.statusState.key, this.statusState.params);
        document.getElementById('workspace-save-status').textContent = text;
        document.getElementById('composer-save-status').textContent = text;
        document.getElementById('workspace-save-status').dataset.state = this.saving ? 'saving' : draft ? 'draft' : 'saved';
        this.elements.saveComposerButton.textContent = this.saving ? this.literal('Saving…', '正在保存…') : this.text('save');
    }

    bindEvents() {
        document.getElementById('library-toggle-btn').addEventListener('click', () => this.setLibraryOpen(!this.elements.workspace.classList.contains('library-open')));
        document.getElementById('library-scrim').addEventListener('click', () => this.setLibraryOpen(false));
        document.getElementById('breadcrumb-home-btn').addEventListener('click', () => this.goHome());
        document.getElementById('open-item-tab-btn').addEventListener('click', () => this.openItemPageInNewTab(this.currentId));
        document.getElementById('context-toggle-btn').addEventListener('click', () => { this.contextVisible = !this.contextVisible; this.renderContext(); });
        document.querySelectorAll('button[data-editor-view]').forEach(button => button.addEventListener('click', () => this.setEditorView(button.dataset.editorView)));
        this.elements.composerTitleInput.addEventListener('input', () => this.refreshDraftStatus());
        this.elements.composerPreambleInput.addEventListener('input', () => this.refreshDraftStatus());
        document.getElementById('library-filters').addEventListener('click', event => {
            const button = event.target.closest('[data-library-filter]'); if (!button) return;
            this.libraryFilter = button.dataset.libraryFilter; this.listLimit = 100; this.renderList();
        });
        document.getElementById('library-tags').addEventListener('click', event => {
            const button = event.target.closest('[data-library-tag]'); if (!button) return;
            this.libraryTag = this.libraryTag === button.dataset.libraryTag ? '' : button.dataset.libraryTag;
            this.listLimit = 100; this.renderList();
        });
        document.getElementById('context-panel').addEventListener('click', event => {
            if (event.target.closest('[data-close-context]')) { this.contextVisible = false; this.renderContext(); }
            const related = event.target.closest('[data-related-item]');
            if (related) this.openItemPage(related.dataset.relatedItem);
            const outline = event.target.closest('[data-outline-target]');
            if (outline) document.getElementById(outline.dataset.outlineTarget)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        document.addEventListener('keydown', event => {
            if (event.defaultPrevented) return;
            if (event.key === 'Escape') {
                if (!this.elements.authScreen.classList.contains('hidden')) return;
                if (!this.elements.configModal.classList.contains('hidden')) { this.closeConfigModal(); return; }
                if (this.elements.workspace.classList.contains('library-open')) { this.setLibraryOpen(false); return; }
                if (window.matchMedia('(max-width: 1200px)').matches && this.contextVisible) { this.contextVisible = false; this.renderContext(); return; }
                const menus = [...document.querySelectorAll('details[open]')];
                if (menus.length) { menus.forEach(menu => { menu.open = false; }); return; }
                if (this.composerState.open) this.closeComposer();
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && this.composerState.open) { event.preventDefault(); this.saveComposer(); }
        });
        window.matchMedia('(max-width: 760px)').addEventListener('change', () => {
            this.setLibraryOpen(false);
            this.elements.composer.inert = false;
            document.querySelector('.main-panel').inert = false;
            document.getElementById('context-panel').inert = false;
        });
        this.elements.syncButton.addEventListener('click', () => this.syncPull());
        this.elements.exportButton.addEventListener('click', () => this.exportBackup());
        this.elements.importButton.addEventListener('click', () => this.elements.importFileInput.click());
        this.elements.configButton.addEventListener('click', () => this.openConfigModal());
        this.elements.createItemButton.addEventListener('click', () => this.createNewItem());
        this.elements.emptyCreateButton.addEventListener('click', () => this.createNewItem());
        this.elements.emptyConfigButton.addEventListener('click', () => this.openConfigModal());
        this.elements.backHomeButton.addEventListener('click', () => this.goHome());
        this.elements.editProblemButton.addEventListener('click', () => this.openProblemEditor());
        this.elements.newNoteButton.addEventListener('click', () => this.openNoteEditor());
        this.elements.deleteItemButton.addEventListener('click', () => this.handleDeleteAction());
        this.elements.restoreItemButton.addEventListener('click', () => this.restoreTrashItem());
        this.elements.destroyItemButton.addEventListener('click', () => this.destroyTrashItem());
        this.elements.pinItemButton.addEventListener('click', () => this.togglePin());
        this.elements.shareItemButton.addEventListener('click', () => this.handleShare());
        this.elements.pdfItemButton.addEventListener('click', () => this.exportCurrentItemPdf());
        this.elements.composerCloseButton.addEventListener('click', () => this.closeComposer());
        this.elements.cancelComposerButton.addEventListener('click', () => this.closeComposer());
        this.elements.saveComposerButton.addEventListener('click', () => this.saveComposer());
        this.elements.configCloseButton.addEventListener('click', () => this.closeConfigModal());
        this.elements.cancelConfigButton.addEventListener('click', () => this.closeConfigModal());
        this.elements.saveConfigButton.addEventListener('click', () => this.saveConfigFromModal());
        this.elements.disableLockButton.addEventListener('click', () => this.disableAppLogin());
        this.elements.authUnlockButton.addEventListener('click', () => this.unlockApp());

        this.elements.searchInput.addEventListener('input', () => { this.listLimit = 100; this.scheduleListRender(); });
        this.elements.composerPreambleInput.addEventListener('input', () => this.scheduleComposerPreview(this.editor.getValue()));
        this.elements.importFileInput.addEventListener('change', (event) => this.importBackup(event));
        this.elements.authPasswordInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this.unlockApp();
            }
        });

        document.querySelectorAll('[data-view-mode]').forEach((button) => {
            button.addEventListener('click', () => this.setViewMode(button.dataset.viewMode));
        });

        this.elements.list.addEventListener('click', (event) => {
            if (event.target.closest('[data-load-more]')) {
                this.listLimit += 100;
                this.renderList();
                return;
            }
            if (Date.now() < this.suppressRowClickUntil) {
                return;
            }

            const listAction = event.target.closest('[data-list-action]');
            if (listAction) {
                event.preventDefault();
                event.stopPropagation();

                if (listAction.dataset.listAction === 'open-tab') {
                    this.openItemPageInNewTab(listAction.dataset.itemId);
                }
                if (listAction.dataset.listAction === 'pin') {
                    this.togglePinById(listAction.dataset.itemId);
                }
                return;
            }

            const row = event.target.closest('[data-item-id]');
            if (!row) {
                return;
            }

            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            this.openItemPage(row.dataset.itemId);
        });

        this.elements.list.addEventListener('contextmenu', (event) => {
            const row = event.target.closest('[data-item-id]');
            if (!row || this.visitorGistId || this.viewMode !== 'active') {
                return;
            }

            event.preventDefault();
            this.deleteItemById(row.dataset.itemId, { prompt: true });
        });

        this.elements.list.addEventListener('dragstart', (event) => this.handleListDragStart(event));
        this.elements.list.addEventListener('dragover', (event) => this.handleListDragOver(event));
        this.elements.list.addEventListener('drop', (event) => this.handleListDrop(event));
        this.elements.list.addEventListener('dragend', () => this.handleListDragEnd());

        this.elements.noteList.addEventListener('click', (event) => {
            const action = event.target.closest('[data-note-action]');
            if (!action) {
                return;
            }

            const noteId = action.dataset.noteId;
            switch (action.dataset.noteAction) {
                case 'toggle':
                    this.toggleNote(noteId);
                    break;
                case 'edit':
                    this.openNoteEditor(noteId);
                    break;
                case 'pdf':
                    this.exportNotePdf(noteId);
                    break;
                case 'delete':
                    this.deleteNote(noteId);
                    break;
                default:
                    break;
            }
        });
        this.elements.noteList.addEventListener('pointerdown', (event) => this.handleNotePointerDown(event));
        document.addEventListener('pointermove', (event) => this.handleNotePointerMove(event));
        document.addEventListener('pointerup', (event) => this.handleNotePointerUp(event));
        document.addEventListener('pointercancel', (event) => this.handleNotePointerCancel(event));

        window.addEventListener('beforeunload', (event) => {
            if (this.hasUnsavedComposer()) { event.preventDefault(); event.returnValue = ''; }
        });
        window.addEventListener('focus', () => this.refreshFromStorage());
        if (typeof BroadcastChannel !== 'undefined') {
            this.storageChannel = new BroadcastChannel('research-qa-storage');
            this.storageChannel.onmessage = (event) => {
                if (event.data === this.databaseCacheKey) this.refreshFromStorage();
            };
        }
        window.addEventListener('popstate', () => this.handlePopState());
    }

    async init() {
        this.ensureUtilityButtons();
        this.bindEvents();
        document.addEventListener(MATHJAX_UNAVAILABLE_EVENT, () => {
            this.toast(this.text('toastMathJaxUnavailable'), 'error');
        }, { once: true });
        this.applyLanguage({ rerender: false });
        if (this.requiresUnlock) {
            this.showAuthScreen();
            return;
        }
        await this.startUnlockedApp();
    }

    async startUnlockedApp() {
        this.applyRouteMode();

        if (this.visitorGistId) {
            this.elements.createItemButton.disabled = true;
            this.reflectConfig();
            await this.loadVisitorItem();
            return;
        }

        const initialState = await readDatabaseState(this.databaseCacheKey);
        const cached = initialState.database;
        this.localDirty = initialState.dirty;
        if (cached) {
            this.db = normalizeDatabase(cached);
            this.baseDb = clone(this.db);
            this.reconcileRouteSelection({ replaceRoute: true });
            if (this.pageMode === 'detail') {
                await this.renderCurrentSelection();
            } else {
                this.renderAll();
            }
            this.setStatusKey('statusLoadedCache');
        } else {
            this.renderAll();
        }

        if (this.config.mainGistId) {
            await this.syncPull({ quiet: Boolean(cached), announceLegacyImport: this.configSource === 'legacy' && !cached });
        } else {
            this.setStatusKey(this.localDirty ? 'statusLocalAhead' : 'statusLocalMode');
        }
    }

    showAuthScreen() {
        document.body.classList.add('auth-locked');
        this.elements.authScreen.classList.remove('hidden');
        this.elements.authUsernameInput.value = this.authProfile?.username ?? '';
        this.elements.authPasswordInput.value = '';
        this.elements.authError.classList.add('hidden');
        this.elements.authError.textContent = '';
        window.requestAnimationFrame(() => this.elements.authPasswordInput.focus());
    }

    hideAuthScreen() {
        document.body.classList.remove('auth-locked');
        this.elements.authScreen.classList.add('hidden');
        this.elements.authError.classList.add('hidden');
        this.elements.authError.textContent = '';
    }

    async unlockApp() {
        try {
            const username = this.elements.authUsernameInput.value.trim();
            const password = this.elements.authPasswordInput.value;
            this.config = await unlockConfig({ username, password });
            this.authSession = { username, password };
            this.authProfile = { username };
            this.requiresUnlock = false;
            this.configSource = getConfigSource();
            this.hideAuthScreen();
            this.reflectConfig();
            await this.startUnlockedApp();
        } catch (error) {
            this.elements.authError.textContent = this.literal('Incorrect username or password.', '用户名或密码不正确。');
            this.elements.authError.classList.remove('hidden');
        }
    }

    updateDisableLockButton() {
        this.elements.disableLockButton.classList.toggle('hidden', !this.authProfile && !this.authSession);
    }

    reflectConfig() {
        this.elements.configTokenInput.value = this.config.token;
        this.elements.configGistInput.value = this.config.mainGistId;
        this.elements.configAuthUsernameInput.value = this.authSession?.username ?? this.authProfile?.username ?? '';
        this.elements.configAuthPasswordInput.value = '';
        this.elements.configAuthPasswordConfirmInput.value = '';
        this.updateDisableLockButton();

        if (this.visitorGistId) {
            this.elements.storageLabel.textContent = this.text('storageSharedReadOnly');
            return;
        }

        this.elements.storageLabel.textContent = this.config.mainGistId
            ? this.text('storageGistSync')
            : this.text('storageLocalFirst');
    }

    setStatusKey(key, params = {}) {
        this.statusState = { key, params };
        this.refreshStatus();
    }

    refreshStatus() {
        this.elements.syncStatus.textContent = this.text(this.statusState.key, this.statusState.params);
        this.refreshDraftStatus();
    }

    readRouteFromLocation() {
        const params = new URLSearchParams(window.location.search);
        const visitorGistId = params.get('gist')?.trim() || '';
        const itemId = params.get('item')?.trim() || null;
        const viewMode = params.get('view') === 'trash' ? 'trash' : 'active';
        return {
            visitorGistId,
            viewMode,
            itemId,
            pageMode: visitorGistId || itemId ? 'detail' : 'home'
        };
    }

    buildRouteUrl({ pageMode = this.pageMode, viewMode = this.viewMode, itemId = this.currentId } = {}) {
        const url = new URL(window.location.href);

        if (this.visitorGistId) {
            url.search = '';
            url.searchParams.set('gist', this.visitorGistId);
            return url;
        }

        url.search = '';
        if (viewMode === 'trash') {
            url.searchParams.set('view', 'trash');
        }
        if (pageMode === 'detail' && itemId) {
            url.searchParams.set('item', itemId);
        }
        return url;
    }

    syncRouteState({ replace = false } = {}) {
        if (this.visitorGistId) {
            this.applyRouteMode();
            return;
        }

        const method = replace ? 'replaceState' : 'pushState';
        const nextItemId = this.pageMode === 'detail' ? this.currentId : null;
        window.history[method]({ pageMode: this.pageMode, viewMode: this.viewMode, itemId: nextItemId }, '', this.buildRouteUrl({
            pageMode: this.pageMode,
            viewMode: this.viewMode,
            itemId: nextItemId
        }));
        this.applyRouteMode();
    }

    applyRouteMode() {
        const homeRoute = !this.visitorGistId && this.pageMode === 'home';
        document.documentElement.dataset.route = homeRoute ? 'home' : 'detail';
        this.elements.appShell.classList.toggle('route-home', homeRoute);
        this.elements.appShell.classList.toggle('route-detail', !homeRoute);
        this.elements.workspace.classList.toggle('route-home', homeRoute);
        this.elements.workspace.classList.toggle('route-detail', !homeRoute);
        this.elements.backHomeButton.classList.toggle('hidden', homeRoute || Boolean(this.visitorGistId));
        this.elements.workspace.classList.toggle('visitor-workspace', Boolean(this.visitorGistId));
        document.getElementById('library-toggle-btn').classList.toggle('hidden', Boolean(this.visitorGistId));
    }

    reconcileRouteSelection({ replaceRoute = false } = {}) {
        if (this.visitorGistId) {
            return;
        }

        if (this.pageMode !== 'detail') {
            this.currentId = null;
            this.currentItem = null;
            this.currentSummary = null;
            if (replaceRoute) {
                this.syncRouteState({ replace: true });
            }
            return;
        }

        const collection = this.getCurrentCollection();
        const exists = collection.some((entry) => String(entry.id) === String(this.currentId));
        if (!exists) {
            this.currentId = null;
        }

        if (!this.currentId) {
            this.pageMode = 'home';
            this.currentItem = null;
            this.currentSummary = null;
        }

        if (replaceRoute) {
            this.syncRouteState({ replace: true });
        }
    }

    async goHome({ replace = false } = {}) {
        if (this.visitorGistId) {
            return;
        }

        if (!this.closeComposer()) return;
        ++this.selectionToken;
        this.pageMode = 'home';
        this.currentId = null;
        this.currentItem = null;
        this.currentSummary = null;
        this.syncRouteState({ replace });
        this.renderAll();
    }

    async openItemPage(itemId, { replace = false } = {}) {
        if (!itemId || this.saving) return;
        if (String(itemId) === String(this.currentId) && this.pageMode === 'detail') { this.setLibraryOpen(false); return; }
        if (!this.closeComposer()) return;
        this.setLibraryOpen(false);
        document.querySelector('.main-panel').scrollTop = 0;
        this.pageMode = 'detail';
        this.currentId = itemId;
        this.syncRouteState({ replace });
        await this.selectItem(itemId, { silent: true });
    }

    openItemPageInNewTab(itemId) {
        if (!itemId) {
            return;
        }

        const detailUrl = this.buildRouteUrl({
            pageMode: 'detail',
            viewMode: this.viewMode,
            itemId
        }).toString();
        window.open(detailUrl, '_blank', 'noopener');
    }

    handlePopState() {
        if (this.visitorGistId) {
            return;
        }
        if (!this.closeComposer()) {
            this.syncRouteState();
            return;
        }

        ++this.selectionToken;
        const route = this.readRouteFromLocation();
        this.viewMode = route.viewMode;
        this.pageMode = route.pageMode;
        this.currentId = route.itemId;
        this.updateViewModeButtons();
        this.applyRouteMode();
        if (this.pageMode === 'detail') {
            this.renderCurrentSelection();
            return;
        }
        this.currentItem = null;
        this.currentSummary = null;
        this.renderAll();
    }

    updateViewModeButtons() {
        document.querySelectorAll('[data-view-mode]').forEach((button) => {
            button.classList.toggle('active', button.dataset.viewMode === this.viewMode);
        });
    }

    toast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'error' : ''}`.trim();
        toast.textContent = message;
        this.elements.toastStack.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 3200);
    }

    getCurrentCollection() {
        return this.viewMode === 'trash' ? this.db.trash : this.db.items;
    }

    async loadVisitorItem() {
        try {
            this.setStatusKey('statusLoadingShare');
            const cached = await getValue(this.sharedCacheKey(this.visitorGistId));
            if (cached) {
                this.currentItem = normalizeItem(cached);
                this.currentId = this.currentItem.id;
                this.currentSource = 'shared';
                this.renderAll();
            }

            const payload = await fetchSharedItem(this.visitorGistId, this.config.token);
            const remote = normalizeItem(parseWorkspaceSnapshot({ items: [payload], trash: [] }).items[0]);
            this.currentItem = remote;
            this.currentId = remote.id;
            this.currentSource = 'shared';
            await setValue(this.sharedCacheKey(this.visitorGistId), remote);
            this.renderAll();
            this.setStatusKey('statusSharedView');
        } catch (error) {
            this.toast(error.message, 'error');
            this.setStatusKey('statusLoadFailed');
            this.renderAll();
        }
    }

    async refreshFromStorage() {
        if (this.visitorGistId || this.requiresUnlock || this.composerState.open || this.saving) return;
        const key = this.databaseCacheKey;
        const state = await readDatabaseState(key);
        if (!state.database || key !== this.databaseCacheKey || this.composerState.open || this.saving) return;
        this.db = normalizeDatabase(state.database);
        this.baseDb = clone(this.db);
        this.reconcileRouteSelection({ replaceRoute: true });
        await this.renderCurrentSelection();
    }

    async syncPull(options = {}) {
        if (this.visitorGistId) return this.loadVisitorItem();
        if (this.hasUnsavedComposer()) {
            this.toast(this.literal('Save or cancel the open draft before syncing.', '请先保存或取消正在编辑的草稿。'));
            return;
        }
        const key = this.databaseCacheKey;
        const state = await readDatabaseState(key);
        if (state.dirty) {
            this.setStatusKey('statusLocalAhead');
            if (!options.quiet) await this.syncPending();
            return;
        }
        if (!this.config.mainGistId) {
            this.setStatusKey('statusLocalMode');
            return;
        }
        try {
            this.setStatusKey('statusSyncing');
            const { database, version } = await fetchMainDatabase({ ...this.config });
            if (this.composerState.open || this.saving) return;
            const next = normalizeDatabase(parseWorkspaceSnapshot(database));
            const saved = await replaceFromRemote(key, next, state.revision, version, normalizeDatabase);
            if (key !== this.databaseCacheKey) return;
            this.db = saved.database;
            this.baseDb = clone(this.db);
            this.remoteDbVersion = version;
            this.localDirty = false;
            this.storageChannel?.postMessage(key);
            this.reconcileRouteSelection({ replaceRoute: true });
            await this.renderCurrentSelection();
            this.setStatusKey('statusSynced');
            if (!options.quiet) this.toast(this.text('toastPulledLatest'));
        } catch (error) {
            this.setStatusKey(error.code === 'local-conflict' ? 'statusLocalAhead' : 'statusOfflineCache');
            if (!options.quiet) this.toast(error.message, 'error');
        }
    }

    async saveDatabaseSnapshot({ replace = false } = {}) {
        this.pendingLocalCommits++;
        this.refreshDraftStatus();
        try {
            const key = this.databaseCacheKey;
            let saved;
            try {
                saved = await commitDatabase(key, clone(this.baseDb), clone(this.db), {
                    normalize: normalizeDatabase, remote: Boolean(this.config.mainGistId), replace
                });
            } catch (error) {
                // Failed deletes, pins and imports must not remain as phantom
                // in-memory changes. An editor keeps its original comparison base.
                this.db = clone(this.baseDb);
                if (!this.composerState.open) await this.refreshFromStorage();
                throw error;
            }
            this.db = saved.database;
            this.baseDb = clone(this.db);
            this.localDirty = saved.dirty;
            this.setStatusKey('statusSavedLocally');
            this.storageChannel?.postMessage(key);
            // Local durability does not wait for the network. The queue and dirty
            // marker live in the same transaction as the user's content.
            if (saved.dirty) void this.syncPending();
        } finally {
            this.pendingLocalCommits--;
            this.refreshDraftStatus();
        }
    }

    async syncPending() {
        const key = this.databaseCacheKey;
        if (this.syncJobs.has(key)) return this.syncJobs.get(key);
        const config = { ...this.config };
        const job = (async () => {
            try {
                if (!navigator.locks?.request) throw new Error('Sync needs browser Web Locks. Your changes are saved locally.');
                await navigator.locks.request('research-qa-sync:' + key, async () => {
                    for (;;) {
                        const sent = await readDatabaseState(key);
                        if (!sent.dirty) return;
                        for (const [gistId, item] of Object.entries(sent.pendingShares)) {
                            await saveSharedItem(gistId, config.token, item);
                        }
                        let version = sent.version;
                        if (config.mainGistId) {
                            if (!version) {
                                const remote = await fetchMainDatabase(config);
                                const contents = parseWorkspaceSnapshot(remote.database);
                                if (contents.items.length || contents.trash?.length) {
                                    throw new Error('The remote contains data but its base version is unknown. Export your local backup before reconnecting.');
                                }
                                // Bootstrap only a verified empty main gist. The
                                // subsequent version check still guards changes.
                                version = remote.version;
                            }
                            version = await saveMainDatabase(config, sent.database, { expectedVersion: version });
                        }
                        const saved = await acknowledgeSync(key, sent, version);
                        if (key === this.databaseCacheKey) {
                            this.remoteDbVersion = saved.version;
                            this.localDirty = saved.dirty;
                            this.setStatusKey(saved.dirty ? 'statusLocalAhead' : (config.mainGistId ? 'statusSynced' : 'statusSavedLocally'));
                        }
                        if (!saved.dirty) return;
                    }
                });
            } catch (error) {
                if (key === this.databaseCacheKey) {
                    this.setStatusKey('statusLocalAhead');
                    this.toast(this.literal('Saved locally; sync is pending. ', '已保存到本地，等待同步。') + error.message, 'error');
                }
            }
        })();
        this.syncJobs.set(key, job);
        try { await job; } finally { this.syncJobs.delete(key); }
    }

    async renderCurrentSelection() {
        if (!this.currentId) {
            this.currentItem = null;
            this.currentSummary = null;
            this.renderAll();
            return;
        }

        await this.selectItem(this.currentId, { silent: true });
    }

    async selectItem(itemId, options = {}) {
        const selectionMark = ++this.selectionToken;
        this.currentId = itemId;
        const summary = this.getCurrentCollection().find((item) => String(item.id) === String(itemId));

        if (!summary) {
            this.currentItem = null;
            this.currentSummary = null;
            if (!this.visitorGistId) {
                this.pageMode = 'home';
                this.currentId = null;
                this.syncRouteState({ replace: true });
            }
            this.renderAll();
            return;
        }

        this.currentSummary = summary;
        this.expandedNotes.clear();

        if (this.viewMode === 'trash') {
            this.currentItem = clone(summary);
            this.currentSource = 'trash';
            this.renderAll();
            return;
        }

        // The owned library is authoritative. Sharing publishes a copy; it
        // must never replace local edits or discard the local share linkage.
        if (summary.shareId) {
            const key = this.databaseCacheKey;
            this.currentItem = clone(summary);
            this.currentSource = 'shared';
            this.renderAll();
            // Older libraries may only contain a shared problem's summary.
            // Hydrate that one case, without blocking local/offline reading.
            const state = await readDatabaseState(key);
            if (!summary.desc && !summary.answers.length && !state.pendingShares[summary.shareId]) {
                try {
                    const payload = await fetchSharedItem(summary.shareId, this.config.token);
                    const remote = parseWorkspaceSnapshot({ items: [payload], trash: [] }).items[0];
                    if (selectionMark !== this.selectionToken || this.composerState.open || key !== this.databaseCacheKey
                        || this.db.items.find(item => String(item.id) === String(summary.id)) !== summary) return;
                    const hydrated = normalizeItem({ ...remote, id: summary.id, shareId: summary.shareId,
                        isPinned: summary.isPinned, pinnedAt: summary.pinnedAt, sortRank: summary.sortRank });
                    this.currentItem = hydrated;
                    this.db.items[this.db.items.indexOf(summary)] = clone(hydrated);
                    // Hydration is local only. A later explicit save publishes it.
                    const saved = await commitDatabase(this.databaseCacheKey, this.baseDb, this.db, {
                        normalize: normalizeDatabase, remote: Boolean(this.config.mainGistId)
                    });
                    this.db = saved.database;
                    this.baseDb = clone(this.db);
                    this.renderAll();
                } catch (error) {
                    this.toast(error.message, 'error');
                }
            }
            return;
        }

        this.currentItem = clone(summary);
        this.currentSource = 'local';
        this.renderAll();
    }

    renderAll() {
        this.applyRouteMode();
        if (!this.visitorGistId) {
            this.renderList();
        } else if (this.lastListHtml) {
            setRenderedHtml(this.elements.list, { html: '' });
            this.lastListHtml = '';
        }
        this.renderDetail();
        this.renderContext();
        this.finishBoot();
    }

    refreshVisiblePanels() {
        if (!this.visitorGistId) this.renderList();
        this.renderDetail();
        this.renderContext();
    }

    scheduleListRender() {
        if (this.searchTimer) {
            window.clearTimeout(this.searchTimer);
        }

        this.searchTimer = window.setTimeout(() => {
            this.searchTimer = null;
            this.renderList();
        }, 80);
    }

    queuePinFeedback(itemId, state) {
        if (this.pinFeedbackTimer) {
            window.clearTimeout(this.pinFeedbackTimer);
        }

        this.pinFeedback = {
            itemId: String(itemId),
            state
        };
        this.pinFeedbackTimer = window.setTimeout(() => {
            this.pinFeedback = {
                itemId: null,
                state: ''
            };
            this.refreshVisiblePanels();
        }, 720);
    }

    canReorderList(term = '') {
        return !this.visitorGistId && this.viewMode === 'active' && !String(term).trim() && this.libraryFilter === 'all' && !this.libraryTag && !this.composerState.open;
    }

    isRowDraggable(row) {
        return Boolean(row?.dataset?.draggable === 'true');
    }

    clearListDropMarkers() {
        this.elements.list.querySelectorAll('.drop-before, .drop-after').forEach((row) => {
            row.classList.remove('drop-before', 'drop-after');
        });
    }

    clearListDragState() {
        if (this.listDragFrame) {
            window.cancelAnimationFrame(this.listDragFrame);
        }
        this.listDragFrame = 0;
        this.pendingListDragPreview = null;
        this.clearListDropMarkers();
        this.elements.list.querySelectorAll('.dragging').forEach((row) => {
            row.classList.remove('dragging');
        });
        this.dragState = {
            itemId: null,
            pinGroup: '',
            overId: null,
            position: 'before',
            previewChanged: false,
            committed: false
        };
    }

    handleListDragStart(event) {
        const row = event.target.closest('.problem-row[data-item-id]');
        if (this.saving || this.sharing || this.pendingLocalCommits || !this.canReorderList(this.elements.searchInput.value) || !this.isRowDraggable(row) || event.target.closest('[data-list-action]')) {
            event.preventDefault();
            return;
        }

        this.dragState = {
            itemId: row.dataset.itemId,
            pinGroup: row.dataset.pinGroup || '',
            overId: null,
            position: 'before',
            previewChanged: false,
            committed: false
        };
        row.classList.add('dragging');
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', row.dataset.itemId);
        }
    }

    handleListDragOver(event) {
        if (!this.dragState.itemId) {
            return;
        }

        const row = event.target.closest('.problem-row[data-item-id]');
        if (!row) {
            event.preventDefault();
            return;
        }

        if (!this.isRowDraggable(row) || row.dataset.pinGroup !== this.dragState.pinGroup) {
            return;
        }

        if (row.dataset.itemId === this.dragState.itemId) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        const position = this.getDragPreviewPosition(row, event);
        this.scheduleListDragPreview(row, position);
    }

    handleListDrop(event) {
        if (!this.dragState.itemId) {
            return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        this.flushListDragPreview();
        this.dragState.committed = true;
        this.suppressRowClickUntil = Date.now() + 220;
        this.commitListPreviewOrder()
            .finally(() => this.clearListDragState());
    }

    handleListDragEnd() {
        if (!this.dragState.itemId) {
            return;
        }

        if (!this.dragState.committed && this.dragState.previewChanged) {
            this.lastListHtml = '';
            this.renderList();
        }
        this.clearListDragState();
    }

    getDragPreviewPosition(row, event) {
        const bounds = row.getBoundingClientRect();
        const offsetY = event.clientY - (bounds.top + bounds.height / 2);
        return offsetY < 0 ? 'before' : 'after';
    }

    scheduleListDragPreview(row, position) {
        this.pendingListDragPreview = { row, position };
        if (this.listDragFrame) {
            return;
        }

        this.listDragFrame = window.requestAnimationFrame(() => {
            this.listDragFrame = 0;
            this.flushListDragPreview();
        });
    }

    flushListDragPreview() {
        const pending = this.pendingListDragPreview;
        this.pendingListDragPreview = null;
        if (this.listDragFrame) {
            window.cancelAnimationFrame(this.listDragFrame);
            this.listDragFrame = 0;
        }

        if (!pending || !this.dragState.itemId || !pending.row?.isConnected) {
            return;
        }

        this.previewListReorder(pending.row, pending.position);
    }

    previewListReorder(targetRow, position) {
        const draggedRow = this.elements.list.querySelector(`.problem-row[data-item-id="${this.dragState.itemId}"]`);
        if (!draggedRow || !targetRow || draggedRow === targetRow) {
            return;
        }

        const container = targetRow.parentElement;
        if (!container) {
            return;
        }

        this.clearListDropMarkers();
        targetRow.classList.add(position === 'before' ? 'drop-before' : 'drop-after');

        const sameTarget = this.dragState.overId === targetRow.dataset.itemId
            && this.dragState.position === position;
        if (sameTarget) {
            return;
        }

        if (position === 'before' && draggedRow.nextElementSibling === targetRow) {
            this.dragState.overId = targetRow.dataset.itemId;
            this.dragState.position = position;
            return;
        }

        if (position === 'after' && targetRow.nextElementSibling === draggedRow) {
            this.dragState.overId = targetRow.dataset.itemId;
            this.dragState.position = position;
            return;
        }

        this.animateListReflow(() => {
            container.insertBefore(
                draggedRow,
                position === 'before' ? targetRow : targetRow.nextElementSibling
            );
        }, { excludeId: this.dragState.itemId });

        this.dragState.overId = targetRow.dataset.itemId;
        this.dragState.position = position;
        this.dragState.previewChanged = true;
    }

    animateListReflow(mutator, options = {}) {
        const rows = Array.from(this.elements.list.querySelectorAll('.problem-row[data-item-id]'));
        if (rows.length > 40) {
            mutator();
            return;
        }

        const firstRects = new Map(rows.map((row) => [row.dataset.itemId, row.getBoundingClientRect()]));
        mutator();

        const excludeId = options.excludeId ? String(options.excludeId) : '';
        Array.from(this.elements.list.querySelectorAll('.problem-row[data-item-id]')).forEach((row) => {
            if (String(row.dataset.itemId) === excludeId) {
                return;
            }

            const first = firstRects.get(row.dataset.itemId);
            if (!first) {
                return;
            }

            const last = row.getBoundingClientRect();
            const deltaX = first.left - last.left;
            const deltaY = first.top - last.top;
            if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
                return;
            }

            row.style.transition = 'none';
            row.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            row.style.willChange = 'transform';
            void row.offsetWidth;

            row.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
            row.style.transform = '';
            const cleanup = () => {
                row.style.transition = '';
                row.style.willChange = '';
            };
            row.addEventListener('transitionend', cleanup, { once: true });
        });
    }

    getPreviewGroupRowIds(pinGroup) {
        return Array.from(this.elements.list.querySelectorAll(`.problem-row[data-pin-group="${pinGroup}"][data-item-id]`))
            .map((row) => row.dataset.itemId);
    }

    async commitListPreviewOrder() {
        const pinGroup = this.dragState.pinGroup;
        const draggedId = this.dragState.itemId;
        const orderedIds = this.getPreviewGroupRowIds(pinGroup);
        if (!orderedIds.length) {
            this.lastListHtml = '';
            this.renderList();
            return;
        }

        const pinnedItems = this.db.items.filter((entry) => entry.isPinned);
        const regularItems = this.db.items.filter((entry) => !entry.isPinned);
        const currentGroup = pinGroup === 'pinned' ? pinnedItems : regularItems;
        if (orderedIds.length !== currentGroup.length) {
            this.lastListHtml = '';
            this.renderList();
            return;
        }

        const itemMap = new Map(currentGroup.map((entry) => [String(entry.id), entry]));
        const orderedGroup = orderedIds.map((id) => itemMap.get(String(id))).filter(Boolean);
        if (orderedGroup.length !== currentGroup.length) {
            this.lastListHtml = '';
            this.renderList();
            return;
        }

        const unchanged = orderedGroup.every((entry, index) => String(entry.id) === String(currentGroup[index].id));
        if (unchanged) {
            this.lastListHtml = '';
            this.renderList();
            return;
        }

        this.db.items = pinGroup === 'pinned'
            ? [...orderedGroup, ...regularItems]
            : [...pinnedItems, ...orderedGroup];
        resequenceItemRanks(this.db.items);

        if (this.currentItem && String(this.currentItem.id) === String(draggedId)) {
            const updated = this.db.items.find((entry) => String(entry.id) === String(draggedId));
            this.currentItem.sortRank = updated?.sortRank ?? this.currentItem.sortRank;
        }

        try {
            await this.saveDatabaseSnapshot();
            this.currentSummary = this.db.items.find((entry) => String(entry.id) === String(draggedId)) ?? this.currentSummary;
            this.lastListHtml = '';
            this.renderList();
        } catch (error) {
            this.toast(error.message, 'error');
            this.lastListHtml = '';
            this.renderList();
        }
    }

    canReorderNotes() {
        return Boolean(this.currentItem) && this.viewMode === 'active' && !this.visitorGistId;
    }

    isNoteDraggable(card) {
        return Boolean(card?.dataset?.noteDraggable === 'true');
    }

    clearNoteDropMarkers() {
        this.elements.noteList.querySelectorAll('.drop-before, .drop-after').forEach((card) => {
            card.classList.remove('drop-before', 'drop-after');
        });
    }

    clearNoteDragState() {
        if (this.noteDragFrame) {
            window.cancelAnimationFrame(this.noteDragFrame);
        }
        this.noteDragFrame = 0;
        this.pendingNoteDragPreview = null;
        this.clearNoteDropMarkers();
        this.elements.noteList.querySelectorAll('.dragging').forEach((card) => {
            card.classList.remove('dragging');
        });
        document.body.classList.remove('note-dragging-active');
        this.noteDragState = {
            noteId: null,
            overId: null,
            position: 'before',
            previewChanged: false,
            committed: false,
            active: false,
            pointerId: null,
            startX: 0,
            startY: 0
        };
    }

    handleNotePointerDown(event) {
        const handle = event.target.closest('[data-note-drag-handle]');
        const card = event.target.closest('.note-card[data-note-id]');
        if (!handle || !this.isNoteDraggable(card)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.noteDragState = {
            noteId: card.dataset.noteId,
            overId: null,
            position: 'before',
            previewChanged: false,
            committed: false,
            active: true,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY
        };
        document.body.classList.add('note-dragging-active');
        card.classList.add('dragging');

        try {
            handle.setPointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture is a nice-to-have; document-level handlers still keep dragging working.
        }
    }

    handleNotePointerMove(event) {
        if (!this.noteDragState.active || event.pointerId !== this.noteDragState.pointerId) {
            return;
        }

        const movedEnough = Math.hypot(
            event.clientX - this.noteDragState.startX,
            event.clientY - this.noteDragState.startY
        ) > 3;
        if (!movedEnough && !this.noteDragState.previewChanged) {
            return;
        }

        event.preventDefault();
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const card = target?.closest?.('.note-card[data-note-id]');
        if (!card) {
            return;
        }

        if (!this.isNoteDraggable(card)) {
            return;
        }

        if (card.dataset.noteId === this.noteDragState.noteId) {
            return;
        }

        const position = this.getDragPreviewPosition(card, event);
        this.scheduleNoteDragPreview(card, position);
    }

    handleNotePointerUp(event) {
        if (!this.noteDragState.active || event.pointerId !== this.noteDragState.pointerId) {
            return;
        }

        event.preventDefault();
        this.flushNoteDragPreview();
        this.noteDragState.committed = true;
        this.commitNotePreviewOrder()
            .finally(() => this.clearNoteDragState());
    }

    handleNotePointerCancel(event) {
        if (!this.noteDragState.active || event.pointerId !== this.noteDragState.pointerId) {
            return;
        }

        if (this.noteDragState.previewChanged) {
            this.renderNotes();
        }
        this.clearNoteDragState();
    }

    scheduleNoteDragPreview(card, position) {
        this.pendingNoteDragPreview = { card, position };
        if (this.noteDragFrame) {
            return;
        }

        this.noteDragFrame = window.requestAnimationFrame(() => {
            this.noteDragFrame = 0;
            this.flushNoteDragPreview();
        });
    }

    flushNoteDragPreview() {
        const pending = this.pendingNoteDragPreview;
        this.pendingNoteDragPreview = null;
        if (this.noteDragFrame) {
            window.cancelAnimationFrame(this.noteDragFrame);
            this.noteDragFrame = 0;
        }

        if (!pending || !this.noteDragState.active || !pending.card?.isConnected) {
            return;
        }

        this.previewNoteReorder(pending.card, pending.position);
    }

    previewNoteReorder(targetCard, position) {
        const draggedCard = this.elements.noteList.querySelector(`.note-card[data-note-id="${this.noteDragState.noteId}"]`);
        if (!draggedCard || !targetCard || draggedCard === targetCard) {
            return;
        }

        const container = targetCard.parentElement;
        if (!container) {
            return;
        }

        this.clearNoteDropMarkers();
        targetCard.classList.add(position === 'before' ? 'drop-before' : 'drop-after');

        const sameTarget = this.noteDragState.overId === targetCard.dataset.noteId
            && this.noteDragState.position === position;
        if (sameTarget) {
            return;
        }

        if (position === 'before' && draggedCard.nextElementSibling === targetCard) {
            this.noteDragState.overId = targetCard.dataset.noteId;
            this.noteDragState.position = position;
            return;
        }

        if (position === 'after' && targetCard.nextElementSibling === draggedCard) {
            this.noteDragState.overId = targetCard.dataset.noteId;
            this.noteDragState.position = position;
            return;
        }

        this.animateNoteReflow(() => {
            container.insertBefore(
                draggedCard,
                position === 'before' ? targetCard : targetCard.nextElementSibling
            );
        }, { excludeId: this.noteDragState.noteId });

        this.noteDragState.overId = targetCard.dataset.noteId;
        this.noteDragState.position = position;
        this.noteDragState.previewChanged = true;
    }

    animateNoteReflow(mutator, options = {}) {
        const cards = Array.from(this.elements.noteList.querySelectorAll('.note-card[data-note-id]'));
        if (cards.length > 40) {
            mutator();
            return;
        }

        const firstRects = new Map(cards.map((card) => [card.dataset.noteId, card.getBoundingClientRect()]));
        mutator();

        const excludeId = options.excludeId ? String(options.excludeId) : '';
        Array.from(this.elements.noteList.querySelectorAll('.note-card[data-note-id]')).forEach((card) => {
            if (String(card.dataset.noteId) === excludeId) {
                return;
            }

            const first = firstRects.get(card.dataset.noteId);
            if (!first) {
                return;
            }

            const last = card.getBoundingClientRect();
            const deltaX = first.left - last.left;
            const deltaY = first.top - last.top;
            if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
                return;
            }

            card.style.transition = 'none';
            card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            card.style.willChange = 'transform';
            void card.offsetWidth;

            card.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
            card.style.transform = '';
            const cleanup = () => {
                card.style.transition = '';
                card.style.willChange = '';
            };
            card.addEventListener('transitionend', cleanup, { once: true });
        });
    }

    getPreviewNoteIds() {
        return Array.from(this.elements.noteList.querySelectorAll('.note-card[data-note-id]'))
            .map((card) => card.dataset.noteId);
    }

    async commitNotePreviewOrder() {
        if (!this.currentItem || !Array.isArray(this.currentItem.answers)) {
            this.renderNotes();
            return;
        }

        const orderedIds = this.getPreviewNoteIds();
        const currentNotes = this.currentItem.answers;
        if (orderedIds.length !== currentNotes.length) {
            this.renderNotes();
            return;
        }

        const noteMap = new Map(currentNotes.map((note) => [String(note.id), note]));
        const orderedNotes = orderedIds.map((id) => noteMap.get(String(id))).filter(Boolean);
        if (orderedNotes.length !== currentNotes.length) {
            this.renderNotes();
            return;
        }

        const unchanged = orderedNotes.every((note, index) => String(note.id) === String(currentNotes[index].id));
        if (unchanged) {
            this.renderNotes();
            return;
        }

        this.currentItem.answers = orderedNotes;
        this.currentItem.date = new Date().toISOString();

        try {
            await this.persistCurrentItem();
            this.renderNotes();
            this.toast(this.literal('Note order saved', '笔记顺序已保存'));
        } catch (error) {
            this.toast(error.message, 'error');
            this.renderNotes();
        }
    }

    finishBoot() {
        if (!document.documentElement.dataset.boot) {
            return;
        }

        window.requestAnimationFrame(() => {
            delete document.documentElement.dataset.boot;
        });
    }

    renderList() {
        if (this.visitorGistId) return;
        const collection = this.getCurrentCollection();
        this.renderLibraryFilters(collection);
        const term = this.elements.searchInput.value.trim().toLowerCase();
        const reorderEnabled = this.canReorderList(term);
        this.elements.viewStatus.textContent = this.viewMode === 'trash'
            ? this.text('viewTrashCount', { count: collection.length })
            : this.text('viewProblemsCount', { count: collection.length });

        const items = collection.filter((entry) => {
            if (this.viewMode === 'active' && (!matchesLibraryFilter(entry, this.libraryFilter) || (this.libraryTag && !this.getItemTags(entry).includes(this.libraryTag)))) return false;
            if (!term) {
                return true;
            }

            if (entry.type === 'note') {
                return `${entry.parentTitle} ${entry.data.text}`.toLowerCase().includes(term);
            }

            const haystack = [entry.title, entry.desc, ...(entry.answers || []).map((note) => note.text)].join(' ').toLowerCase();
            return haystack.includes(term);
        });

        if (!items.length) {
            const emptyHtml = `
                <div class="sidebar-panel">
                    <div class="eyebrow">${this.text('noMatch')}</div>
                    <p class="modal-note">${term ? this.text('noResults') : this.text('noProblems')}</p>
                </div>
            `;
            if (this.lastListHtml === emptyHtml) {
                return;
            }
            this.lastListHtml = emptyHtml;
            setRenderedHtml(this.elements.list, {
                html: emptyHtml
            });
            return;
        }

        const listHtml = `
            <div class="list-card">
                ${items.slice(0, this.listLimit).map((entry) => this.renderListRow(entry, { reorderEnabled: reorderEnabled && items.length <= this.listLimit })).join('')}
            </div>
            ${items.length > this.listLimit ? `<button class="secondary-btn" data-load-more>${this.literal('Show more', '显示更多')} (${this.listLimit}/${items.length})</button>` : ''}
        `;
        if (this.lastListHtml === listHtml) {
            return;
        }
        this.lastListHtml = listHtml;
        const scrollTop = this.elements.list.scrollTop;
        setRenderedHtml(this.elements.list, { html: listHtml });
        this.elements.list.scrollTop = scrollTop;
    }

    getItemTags(item) {
        const cached = this.tagCache.get(item);
        if (cached && cached.desc === item.desc && cached.answers === item.answers) return cached.tags;
        const tags = contentTags(item);
        this.tagCache.set(item, { desc: item.desc, answers: item.answers, tags });
        return tags;
    }

    renderLibraryFilters(collection) {
        const filters = [ ['all', this.literal('All problems', '全部问题')], ['pinned', this.text('pinnedBadge')], ['notes', this.literal('With notes', '有研究记录')], ['shared', this.text('sharedBadge')] ];
        document.getElementById('library-filters').innerHTML = this.viewMode === 'trash' ? '' : filters.map(([key, label]) => `<button type="button" data-library-filter="${key}" aria-pressed="${key === this.libraryFilter}"><span class="filter-dot ${key}"></span>${label}<span>${collection.filter(item => matchesLibraryFilter(item, key)).length}</span></button>`).join('');
        const tags = [...new Set(collection.flatMap(item => this.getItemTags(item)))].sort((a, b) => a.localeCompare(b)).slice(0, 40);
        document.getElementById('library-tags').innerHTML = tags.length ? tags.map(tag => `<button type="button" class="tag-button" data-library-tag="${escapeHtml(tag)}" aria-pressed="${tag === this.libraryTag}">${escapeHtml(tag)}</button>`).join('') : `<p class="tag-hint">${this.literal('Use #tags in your notes to organise ideas.', '在内容中写下 #标签，串联想法。')}</p>`;
    }

    renderListRow(entry, options = {}) {
        const active = String(entry.id) === String(this.currentId);
        const title = entry.type === 'note' ? this.text('archivedNoteTitle', { title: entry.parentTitle }) : (entry.title || this.text('defaultUntitledProblem'));
        const noteCount = entry.answers?.length || 0;
        const url = escapeHtml(this.buildRouteUrl({ pageMode: 'detail', viewMode: this.viewMode, itemId: entry.id }).toString());
        const id = escapeHtml(entry.id);
        const draggable = options.reorderEnabled ? ` draggable="true" data-draggable="true" data-pin-group="${entry.isPinned ? 'pinned' : 'regular'}"` : '';
        return `<article class="problem-row ${active ? 'active' : ''} ${this.viewMode === 'trash' ? 'trash' : ''}" data-item-id="${id}"${draggable}>
            <a class="problem-row-link" href="${url}" ${active ? 'aria-current="page"' : ''}><span class="problem-icon" aria-hidden="true">${entry.isPinned ? '⌖' : '▤'}</span><span class="problem-row-text"><h3>${escapeHtml(title)}</h3><span class="row-secondary">${entry.type === 'note' ? this.text('archivedNote') : this.text('notesCount', {count: noteCount})}${entry.shareId ? ' · ' + this.text('sharedBadge') : ''}</span></span></a>
            <div class="problem-row-actions"><button type="button" class="row-icon-btn" data-list-action="open-tab" data-item-id="${id}" aria-label="${this.literal('Open in new tab', '在新标签页打开')}" title="${this.literal('Open in new tab', '在新标签页打开')}">↗</button>${this.viewMode === 'active' ? `<button type="button" class="row-icon-btn ${entry.isPinned ? 'is-active' : ''}" data-list-action="pin" data-item-id="${id}" aria-label="${entry.isPinned ? this.text('unpin') : this.text('pin')}" title="${entry.isPinned ? this.text('unpin') : this.text('pin')}">⌖</button>` : ''}</div>
        </article>`;
    }

    renderContext() {
        const panel = document.getElementById('context-panel');
        const visible = this.contextVisible && Boolean(this.currentItem) && this.pageMode === 'detail';
        panel.classList.toggle('hidden', !visible);
        this.elements.workspace.classList.toggle('context-open', visible);
        document.getElementById('context-toggle-btn').setAttribute('aria-expanded', String(visible));
        if (!visible) { panel.innerHTML = ''; return; }
        const tags = this.getItemTags(this.currentItem);
        const refs = contentReferences(this.currentItem);
        const related = this.visitorGistId || !tags.length ? [] : this.db.items.filter(item => String(item.id) !== String(this.currentId) && this.getItemTags(item).some(tag => tags.includes(tag))).slice(0, 5);
        const section = (title, body) => `<section class="context-section"><h3>${title}</h3>${body}</section>`;
        const empty = text => `<p class="context-empty">${text}</p>`;
        const outline = [{id:'statement-section', label:this.text('statement')}, {id:'notes-section', label:this.text('researchNotes')}];
        panel.innerHTML = `<button class="context-close icon-btn" data-close-context aria-label="${this.literal('Close context', '关闭相关资料')}">×</button>` + section(this.literal('References', '相关资料'), refs.length ? refs.map(ref => `<a class="context-link" href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▤</span><span>${escapeHtml(ref.title)}</span><span aria-hidden="true">↗</span></a>`).join('') : empty(this.literal('Links in this problem and its notes appear here.', '问题与笔记中的资料链接会显示在这里。')))
            + section(this.literal('Related problems', '相关问题'), related.length ? related.map(item => `<button class="context-link" data-related-item="${escapeHtml(item.id)}"><span aria-hidden="true">▤</span><span>${escapeHtml(item.title)}</span><span aria-hidden="true">›</span></button>`).join('') : empty(this.literal('Add a shared #tag to connect problems.', '用相同的 #标签关联问题。')))
            + section(this.literal('On this page', '本页目录'), `<nav class="page-outline">${outline.map(item => `<button data-outline-target="${item.id}">${item.label}</button>`).join('')}</nav>`)
            + section(this.literal('Notebook details', '手账信息'), `<dl class="context-meta"><dt>${this.text('researchNotes')}</dt><dd>${this.currentItem.answers?.length || 0}</dd><dt>${this.literal('Storage', '存储')}</dt><dd>${this.elements.heroRemote.textContent}</dd></dl>${tags.length ? `<div class="context-tags">${tags.map(tag=>`<span class="tag-button">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}`);
    }

    renderDetail() {
        if (!this.visitorGistId && this.pageMode !== 'detail') {
            setRenderedHtml(this.elements.noteList, { html: '' });
            setRenderedHtml(this.elements.problemRender, { html: '' });
            setRenderedHtml(this.elements.detailTitle, { html: '' });
            this.lastDetailTitleKey = '';
            this.lastProblemRenderKey = '';
            this.elements.emptyState.classList.remove('hidden');
            this.elements.detailView.classList.add('hidden');
            return;
        }

        if (!this.currentItem) {
            this.lastDetailTitleKey = '';
            this.lastProblemRenderKey = '';
            this.elements.emptyState.classList.remove('hidden');
            this.elements.detailView.classList.add('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.detailView.classList.remove('hidden');

        if (this.viewMode === 'trash' && this.currentSummary?.type === 'note') {
            this.lastDetailTitleKey = '';
            this.lastProblemRenderKey = '';
            const archivedNote = this.currentSummary;
            setRenderedHtml(this.elements.detailTitle, {
                html: renderInlineMath(
                    this.text('archivedNoteTitle', { title: archivedNote.parentTitle }),
                    { preamble: archivedNote.parentPreamble }
                )
            });
            typesetElement(this.elements.detailTitle);
            this.elements.detailSubtitle.textContent = this.text('restoreNoteHint');
            this.elements.heroKind.textContent = this.text('archivedNote');
            this.elements.heroUpdated.textContent = this.text('deletedAt', { date: formatDate(archivedNote.deletedAt) });
            this.elements.heroRemote.textContent = this.text('trashBadge');

            const noteHtml = renderDocument(archivedNote.data.text, { preamble: archivedNote.parentPreamble });
            setRenderedHtml(this.elements.problemRender, noteHtml);
            typesetElement(this.elements.problemRender);

            setRenderedHtml(this.elements.noteList, { html: `
                <article class="note-card">
                    <div class="note-card-head">
                        <div>
                            <div class="eyebrow">${this.text('originalProblem')}</div>
                            <strong>${renderInlineMath(archivedNote.parentTitle, { preamble: archivedNote.parentPreamble })}</strong>
                        </div>
                        <span class="meta-pill">${this.text('readyToRestore')}</span>
                    </div>
                    <div class="note-excerpt">${this.text('restoreNoteDescription')}</div>
                </article>
            ` });
            typesetElement(this.elements.noteList);

            this.elements.newNoteButton.disabled = true;
            this.elements.editProblemButton.disabled = true;
            this.elements.pinItemButton.disabled = true;
            this.elements.shareItemButton.disabled = true;
            this.elements.pdfItemButton.disabled = true;
            this.elements.restoreItemButton.classList.remove('hidden');
            this.elements.destroyItemButton.classList.remove('hidden');
            this.elements.deleteItemButton.classList.add('hidden');
            return;
        }

        const title = this.currentItem.title || this.text('defaultUntitledProblem');
        const subtitle = this.viewMode === 'trash'
            ? this.text('detailTrashSubtitle')
            : this.text('detailProblemSubtitle');
        const detailPinFeedback = String(this.pinFeedback.itemId) === String(this.currentItem.id) ? this.pinFeedback.state : '';
        const detailTitleKey = [activeLanguage, title, this.currentItem.preamble].join('\u0001');
        if (this.lastDetailTitleKey !== detailTitleKey) {
            this.lastDetailTitleKey = detailTitleKey;
            setRenderedHtml(this.elements.detailTitle, {
                html: renderInlineMath(title, { preamble: this.currentItem.preamble })
            });
            typesetElement(this.elements.detailTitle);
        }
        this.elements.detailSubtitle.textContent = subtitle;
        this.elements.heroKind.textContent = this.viewMode === 'trash' ? this.text('trashedProblem') : this.text('heroProblem');
        this.elements.heroUpdated.textContent = this.text('updatedAt', { date: formatDate(this.currentItem.date) });
        this.elements.heroRemote.textContent = this.currentSource === 'shared'
            ? this.text('sharedGist')
            : (this.currentSource === 'trash'
                ? this.text('trashBadge')
                : (this.config.mainGistId ? this.text('mainGist') : this.text('localCache')));

        const problemRenderKey = [
            this.currentItem.id,
            this.currentItem.date,
            this.currentItem.preamble,
            this.currentItem.desc
        ].join('\u0001');
        if (this.lastProblemRenderKey !== problemRenderKey) {
            this.lastProblemRenderKey = problemRenderKey;
            const problemHtml = renderDocument(this.currentItem.desc, { preamble: this.currentItem.preamble });
            setRenderedHtml(this.elements.problemRender, problemHtml);
            typesetElement(this.elements.problemRender);
        }

        this.renderNotes();
        this.elements.pinItemButton.textContent = this.currentItem.isPinned ? this.text('unpin') : this.text('pin');
        this.elements.pinItemButton.classList.toggle('pin-active', this.currentItem.isPinned);
        this.elements.pinItemButton.classList.toggle('pin-feedback', Boolean(detailPinFeedback));
        this.elements.pinItemButton.classList.toggle('pin-added', detailPinFeedback === 'pinned');
        this.elements.pinItemButton.classList.toggle('pin-removed', detailPinFeedback === 'unpinned');
        this.elements.newNoteButton.disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.editProblemButton.disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.pinItemButton.disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.shareItemButton.disabled = this.sharing || this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.pdfItemButton.disabled = false;
        this.elements.restoreItemButton.classList.toggle('hidden', this.viewMode !== 'trash');
        this.elements.destroyItemButton.classList.toggle('hidden', this.viewMode !== 'trash');
        this.elements.deleteItemButton.classList.toggle('hidden', this.viewMode === 'trash');
        this.elements.deleteItemButton.textContent = this.text('delete');
    }

    renderNotes() {
        const notes = this.currentItem.answers || [];

        if (!notes.length) {
            setRenderedHtml(this.elements.noteList, { html: `
                <article class="note-card">
                    <div class="note-card-head">
                        <div>
                            <div class="eyebrow">${this.text('noNotesEyebrow')}</div>
                            <strong>${this.text('noNotesTitle')}</strong>
                        </div>
                        ${this.viewMode === 'trash' ? '' : `<button class="pill-btn" id="inline-new-note-btn">${this.text('addNote')}</button>`}
                    </div>
                    <div class="note-excerpt">${this.text('noNotesDescription')}</div>
                </article>
            ` });

            const inlineNew = document.getElementById('inline-new-note-btn');
            if (inlineNew) {
                inlineNew.addEventListener('click', () => this.openNoteEditor());
            }
            return;
        }

        setRenderedHtml(this.elements.noteList, { html: notes.map((note) => {
            const expanded = this.expandedNotes.has(note.id);
            const canReorder = this.canReorderNotes();
            const dragAttrs = canReorder ? ` data-note-draggable="true"` : '';
            const dragHandle = canReorder
                ? `<button class="note-drag-handle" type="button" data-note-drag-handle title="Drag to reorder" aria-label="Drag to reorder">↕</button>`
                : '';
            const body = expanded
                ? `<div class="rich-text" data-note-render="${note.id}"></div>`
                : `<div class="note-excerpt rich-text" data-note-preview="${note.id}"></div>`;
            const toggleLabel = expanded ? this.text('collapse') : this.text('expand');
            const toolbar = this.viewMode === 'trash' || this.visitorGistId ? '' : `
                    <button class="pill-btn soft" data-note-action="edit" data-note-id="${note.id}">${this.text('editNote')}</button>
                    <button class="pill-btn warn" data-note-action="delete" data-note-id="${note.id}">${this.text('deleteNote')}</button>
                `;

            return `
                <article class="note-card" data-note-id="${note.id}"${dragAttrs}>
                    <div class="note-card-head">
                        <div class="note-card-meta">
                            ${dragHandle}
                            <time datetime="${note.date}">${formatDate(note.date)}</time>
                        </div>
                        <div class="note-toolbar">
                            <button class="pill-btn soft" data-note-action="toggle" data-note-id="${note.id}">${toggleLabel}</button>
                            <button class="pill-btn soft" data-note-action="pdf" data-note-id="${note.id}">${this.text('exportNotePdf')}</button>
                            ${toolbar}
                        </div>
                    </div>
                    ${body}
                </article>
            `;
        }).join('') });

        notes.forEach((note) => {
            const expanded = this.expandedNotes.has(note.id);
            const container = expanded
                ? this.elements.noteList.querySelector(`[data-note-render="${note.id}"]`)
                : this.elements.noteList.querySelector(`[data-note-preview="${note.id}"]`);
            if (!container) {
                return;
            }

            const rendered = this.getCachedNoteRender(note, expanded);
            setRenderedHtml(container, rendered);
        });
        typesetElement(this.elements.noteList);
    }

    getCachedNoteRender(note, expanded) {
        const preamble = this.currentItem?.preamble || '';
        const source = note.text || '';
        const mode = expanded ? 'full' : 'preview';
        const cacheKey = [
            mode,
            activeLanguage,
            note.id,
            note.date,
            source.length,
            hashString(preamble),
            hashString(source)
        ].join('\u0001');
        const cached = this.renderCache.noteBodies.get(cacheKey);
        if (cached) {
            return cached;
        }

        const rendered = expanded
            ? renderDocument(source, { preamble })
            : renderPreviewDocument(source, { preamble, length: 300, emptyText: 'No content yet.' });
        this.renderCache.noteBodies.set(cacheKey, rendered);
        pruneMap(this.renderCache.noteBodies, 120);
        return rendered;
    }

    async setViewMode(mode) {
        if (this.saving || mode === this.viewMode) {
            return;
        }

        if (!this.closeComposer()) return;
        ++this.selectionToken;
        this.libraryFilter = 'all';
        this.libraryTag = '';
        this.viewMode = mode;
        this.listLimit = 100;
        this.updateViewModeButtons();

        if (this.pageMode !== 'detail') {
            this.syncRouteState();
            this.renderAll();
            return;
        }

        const collection = this.getCurrentCollection();
        const exists = collection.some((entry) => String(entry.id) === String(this.currentId));
        if (!exists) {
            this.currentId = null;
        }

        if (!this.currentId) {
            await this.goHome();
            return;
        }

        this.syncRouteState();
        await this.renderCurrentSelection();
    }

    createNewItem() {
        if (this.visitorGistId || this.sharing || this.pendingLocalCommits) {
            return;
        }
        if (!this.closeComposer()) return;

        ++this.selectionToken;
        this.viewMode = 'active';
        this.libraryFilter = 'all';
        this.libraryTag = '';
        this.updateViewModeButtons();
        this.setLibraryOpen(false);
        const nextItem = normalizeItem({ id: createId('item'), title: this.text('newProblem'), desc: '', answers: [], date: new Date().toISOString(), isPinned: false });
        // Keep a new problem as a draft until the first successful save.
        this.currentId = nextItem.id;
        this.currentItem = clone(nextItem);
        this.currentSummary = nextItem;
        this.currentSource = 'local';
        this.pageMode = 'detail';
        this.syncRouteState();
        this.renderAll();
        this.openProblemEditor();
    }

    openProblemEditor() {
        if (!this.currentItem || this.viewMode === 'trash' || this.visitorGistId || this.sharing || this.pendingLocalCommits) {
            return;
        }
        if (this.composerState.open && !this.closeComposer()) return;

        this.composerState = { open: true, kind: 'problem', noteId: null };
        this.elements.workspace.classList.add('composer-open');
        this.elements.composer.classList.remove('hidden');
        this.setEditorView('source');
        this.refreshComposerChrome();
        this.elements.composerTitleField.classList.remove('hidden');
        this.elements.composerPreambleField.classList.remove('hidden');
        this.elements.composerTitleInput.value = this.currentItem.title;
        this.elements.composerPreambleInput.value = this.currentItem.preamble;
        this.editor.setValue(this.currentItem.desc);
        this.scheduleComposerPreview(this.currentItem.desc, true);
        this.refreshDraftStatus();
        this.renderList();
        window.setTimeout(() => this.editor.focus(), 40);
    }

    openNoteEditor(noteId = null) {
        if (!this.currentItem || this.viewMode === 'trash' || this.visitorGistId || this.sharing || this.pendingLocalCommits) {
            return;
        }
        if (this.composerState.open && !this.closeComposer()) return;

        const note = noteId ? this.currentItem.answers.find((entry) => entry.id === noteId) : null;
        this.composerState = { open: true, kind: 'note', noteId };
        this.elements.workspace.classList.add('composer-open');
        this.elements.composer.classList.remove('hidden');
        this.setEditorView('source');
        this.refreshComposerChrome();
        this.elements.composerTitleField.classList.add('hidden');
        this.elements.composerPreambleField.classList.add('hidden');
        this.elements.composerTitleInput.value = '';
        this.editor.setValue(note ? note.text : '');
        this.scheduleComposerPreview(note ? note.text : '', true);
        this.refreshDraftStatus();
        this.renderList();
        window.setTimeout(() => this.editor.focus(), 40);
    }

    hasUnsavedComposer() {
        if (!this.composerState.open) return false;
        const note = this.currentItem?.answers?.find((entry) => entry.id === this.composerState.noteId);
        return this.editor.getValue() !== (this.composerState.kind === 'problem' ? this.currentItem?.desc || '' : note?.text || '')
            || (this.composerState.kind === 'problem' && (
                this.elements.composerTitleInput.value !== (this.currentItem?.title || '')
                || this.elements.composerPreambleInput.value !== (this.currentItem?.preamble || '')));
    }

    closeComposer({ discard = false } = {}) {
        if (this.saving && !discard) return false;
        if (!discard && this.hasUnsavedComposer() && !window.confirm(this.literal('Discard the unsaved draft?', '放弃尚未保存的草稿？'))) return false;
        this.composerState = { open: false, kind: 'problem', noteId: null };
        this.elements.workspace.classList.remove('composer-open');
        this.elements.composer.classList.add('hidden');
        this.refreshDraftStatus();
        return true;
    }

    scheduleComposerPreview(value, immediate = false) {
        if (this.previewTimer) {
            window.clearTimeout(this.previewTimer);
        }

        const renderNow = () => {
            const preamble = this.composerState.kind === 'problem'
                ? this.elements.composerPreambleInput.value
                : (this.currentItem?.preamble || '');
            const rendered = renderDocument(value, { preamble });
            setRenderedHtml(this.elements.composerPreview, rendered);
            typesetElement(this.elements.composerPreview);
        };

        if (immediate) {
            renderNow();
            return;
        }

        this.previewTimer = window.setTimeout(renderNow, 180);
    }

    async saveComposer() {
        if (this.saving || this.pendingLocalCommits) return;
        if (!this.currentItem) {
            return;
        }

        this.saving = true;
        this.refreshDraftStatus();
        this.elements.saveComposerButton.disabled = true;
        const before = clone(this.currentItem);
        const body = this.editor.getValue();
        if (this.composerState.kind === 'problem') {
            this.currentItem.title = this.elements.composerTitleInput.value.trim() || this.text('defaultUntitledProblem');
            this.currentItem.desc = body;
            this.currentItem.preamble = this.elements.composerPreambleInput.value.trim();
            this.currentItem.date = new Date().toISOString();
        } else {
            const targetNote = this.currentItem.answers.find((note) => note.id === this.composerState.noteId);
            if (targetNote) {
                targetNote.text = body;
                targetNote.date = new Date().toISOString();
            } else {
                this.currentItem.answers.push(normalizeNote({ id: createId('note'), text: body, date: new Date().toISOString() }));
            }
            this.currentItem.date = new Date().toISOString();
        }

        try {
            await this.persistCurrentItem();
            this.closeComposer({ discard: true });
            this.renderAll();
            this.toast(this.text('toastSaved'));
        } catch (error) {
            this.currentItem = before;
            this.toast(error.message, 'error');
        } finally {
            this.saving = false;
            this.elements.saveComposerButton.disabled = false;
            this.refreshDraftStatus();
        }
    }

    async persistCurrentItem() {
        const normalized = normalizeItem(this.currentItem);
        this.currentItem = normalized;
        const index = this.db.items.findIndex((entry) => String(entry.id) === String(normalized.id));
        if (index === -1) {
            this.db.items.unshift(clone(normalized));
        } else {
            this.db.items[index] = {
                ...this.db.items[index],
                ...clone(normalized)
            };
        }
        sortItemsInPlace(this.db.items);

        await this.saveDatabaseSnapshot();
        this.currentSummary = this.db.items.find((entry) => String(entry.id) === String(normalized.id));
        this.currentItem = clone(this.currentSummary);
    }

    toggleNote(noteId) {
        const expanded = !this.expandedNotes.has(noteId);
        if (expanded) this.expandedNotes.add(noteId);
        else this.expandedNotes.delete(noteId);
        const note = this.currentItem.answers.find((entry) => entry.id === noteId);
        const card = this.elements.noteList.querySelector('[data-note-id="' + CSS.escape(noteId) + '"]');
        const body = card?.querySelector('[data-note-render], [data-note-preview]');
        if (!note || !body) return;
        body.className = expanded ? 'rich-text' : 'note-excerpt rich-text';
        delete body.dataset.noteRender;
        delete body.dataset.notePreview;
        body.dataset[expanded ? 'noteRender' : 'notePreview'] = noteId;
        setRenderedHtml(body, this.getCachedNoteRender(note, expanded));
        card.querySelector('[data-note-action="toggle"]').textContent = this.text(expanded ? 'collapse' : 'expand');
        typesetElement(body);
    }

    async deleteNote(noteId) {
        if (!window.confirm(this.text('confirmMoveNoteToTrash'))) {
            return;
        }

        const index = this.currentItem.answers.findIndex((note) => note.id === noteId);
        if (index === -1) {
            return;
        }

        const deletedNote = this.currentItem.answers.splice(index, 1)[0];
        this.db.trash.unshift({
            id: `trash-${deletedNote.id}`,
            type: 'note',
            data: deletedNote,
            parentId: this.currentItem.id,
            parentTitle: this.currentItem.title,
            parentPreamble: this.currentItem.preamble,
            deletedAt: new Date().toISOString()
        });
        this.currentItem.date = new Date().toISOString();

        try {
            await this.persistCurrentItem();
            this.renderAll();
            this.toast(this.text('toastNoteMovedToTrash'));
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async handleDeleteAction() {
        await this.deleteCurrentItem();
    }

    async deleteCurrentItem() {
        if (!this.currentItem) {
            return;
        }

        await this.deleteItemById(this.currentItem.id, {
            prompt: true
        });
    }

    async deleteItemById(itemId, options = {}) {
        if (this.saving || this.sharing || this.pendingLocalCommits) return;
        if (this.composerState.open && String(itemId) !== String(this.currentId)) {
            this.toast(this.literal('Save or close the editor before changing the library.', '请先保存或关闭编辑器，再修改问题库。')); return;
        }
        if (String(itemId) === String(this.currentId) && !this.closeComposer()) return;
        const {
            prompt = false
        } = options;

        if (!itemId || this.viewMode === 'trash' || this.visitorGistId) {
            return;
        }

        if (prompt && !window.confirm(this.text('confirmMoveProblemToTrash'))) {
            return;
        }

        const index = this.db.items.findIndex((entry) => String(entry.id) === String(itemId));
        if (index === -1) {
            return;
        }

        const deleted = this.db.items.splice(index, 1)[0];
        this.db.trash.unshift({ ...deleted, type: 'item', deletedAt: new Date().toISOString() });
        const deletedCurrent = String(this.currentId) === String(itemId);

        if (deletedCurrent) {
            ++this.selectionToken;
            this.pageMode = 'home';
            this.currentId = null;
            this.currentItem = null;
            this.currentSummary = null;
            this.syncRouteState({ replace: true });
        }

        try {
            await this.saveDatabaseSnapshot();
            this.renderAll();
            this.toast(this.text('toastProblemMovedToTrash'));
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async restoreTrashItem() {
        if (this.sharing || this.saving || this.pendingLocalCommits) return;
        if (this.viewMode !== 'trash' || !this.currentSummary) {
            return;
        }

        const index = this.db.trash.findIndex((entry) => String(entry.id) === String(this.currentSummary.id));
        if (index === -1) {
            return;
        }

        const restoreSelection = ++this.selectionToken;
        const restored = this.db.trash.splice(index, 1)[0];
        delete restored.deletedAt;
        let nextActiveId = null;

        if (restored.type === 'note') {
            const parent = this.db.items.find((entry) => String(entry.id) === String(restored.parentId));
            if (parent) {
                parent.answers.push(normalizeNote(restored.data));
                parent.date = new Date().toISOString();
                nextActiveId = parent.id;
            } else {
                const recoveryItem = normalizeItem({
                    title: this.text('recoveredNoteTitle', { title: restored.parentTitle }),
                    desc: this.text('recoveredNoteDescription'),
                    preamble: restored.parentPreamble,
                    answers: [normalizeNote(restored.data)],
                    date: new Date().toISOString()
                });
                this.db.items.unshift(recoveryItem);
                nextActiveId = recoveryItem.id;
            }
        } else {
            restored.type = 'item';
            const restoredItem = normalizeItem(restored);
            this.db.items.unshift(restoredItem);
            nextActiveId = restoredItem.id;
        }
        sortItemsInPlace(this.db.items);

        try {
            await this.saveDatabaseSnapshot();
            if (restoreSelection !== this.selectionToken) {
                this.renderAll();
                this.toast(this.text('toastRestoredFromTrash'));
                return;
            }
            this.viewMode = 'active';
            this.updateViewModeButtons();
            this.pageMode = nextActiveId ? 'detail' : 'home';
            this.currentId = nextActiveId ?? null;
            this.syncRouteState({ replace: true });
            await this.renderCurrentSelection();
            this.toast(this.text('toastRestoredFromTrash'));
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async destroyTrashItem() {
        if (this.sharing || this.saving || this.pendingLocalCommits) return;
        if (this.viewMode !== 'trash' || !this.currentSummary || !window.confirm(this.text('confirmPermanentDelete'))) {
            return;
        }

        const index = this.db.trash.findIndex((entry) => String(entry.id) === String(this.currentSummary.id));
        if (index === -1) {
            return;
        }

        const destroySelection = ++this.selectionToken;
        this.db.trash.splice(index, 1);
        this.currentId = this.db.trash[0]?.id ?? null;
        this.currentItem = null;
        this.currentSummary = null;

        try {
            await this.saveDatabaseSnapshot();
            if (destroySelection !== this.selectionToken) {
                this.renderAll();
                this.toast(this.text('toastPermanentlyDeleted'));
                return;
            }
            this.pageMode = this.currentId ? 'detail' : 'home';
            this.syncRouteState({ replace: true });
            await this.renderCurrentSelection();
            this.toast(this.text('toastPermanentlyDeleted'));
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async togglePin() {
        if (!this.currentItem || this.viewMode === 'trash') {
            return;
        }

        await this.togglePinById(this.currentItem.id);
    }

    async togglePinById(itemId) {
        if (this.saving || this.sharing || this.pendingLocalCommits || this.composerState.open) {
            this.toast(this.literal('Save or close the editor before changing the library.', '请先保存或关闭编辑器，再修改问题库。'));
            return;
        }
        const index = this.db.items.findIndex((entry) => String(entry.id) === String(itemId));
        if (index === -1) {
            return;
        }

        const target = this.db.items[index];
        target.isPinned = !target.isPinned;
        target.pinnedAt = target.isPinned ? new Date().toISOString() : '';
        target.sortRank = -1;
        sortItemsInPlace(this.db.items);

        if (this.currentItem && String(this.currentItem.id) === String(itemId)) {
            this.currentItem.isPinned = target.isPinned;
            this.currentItem.pinnedAt = target.pinnedAt;
            this.currentItem.sortRank = target.sortRank;
        }

        try {
            await this.saveDatabaseSnapshot();
            if (String(this.currentId) === String(itemId)) this.currentSummary = this.db.items.find((entry) => String(entry.id) === String(itemId)) ?? this.currentSummary;
            this.queuePinFeedback(itemId, target.isPinned ? 'pinned' : 'unpinned');
            this.refreshVisiblePanels();
            this.toast(this.text(target.isPinned ? 'toastPinned' : 'toastUnpinned'));
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async handleShare() {
        if (this.sharing || this.saving || this.pendingLocalCommits || this.composerState.open || this.visitorGistId || !this.currentItem || this.viewMode === 'trash') {
            return;
        }

        const entry = this.db.items.find((item) => String(item.id) === String(this.currentItem.id));
        if (!entry) {
            return;
        }

        try {
            if (entry.shareId) {
                const shareUrl = new URL('./', window.location.href);
                shareUrl.searchParams.set('gist', entry.shareId);
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(shareUrl.toString());
                    this.toast(this.text('toastShareLinkCopied'));
                } else {
                    window.prompt(this.text('promptShareLink'), shareUrl.toString());
                }
                return;
            }

            if (!this.config.token) {
                this.openConfigModal();
                this.toast(this.text('toastNeedTokenForShare'), 'error');
                return;
            }

            const sourceId = String(entry.id);
            const sourceKey = this.databaseCacheKey;
            const sharedCopy = clone(entry);
            this.sharing = true;
            this.refreshDraftStatus();
            const shareId = await createSharedItem(this.config.token, sharedCopy);
            if (sourceKey !== this.databaseCacheKey) throw new Error(this.literal('The library changed while sharing. The shared copy was created but was not linked to this library.', '分享过程中问题库已改变。副本已创建，但没有关联到当前问题库。'));
            const latestEntry = this.db.items.find(item => String(item.id) === sourceId);
            if (!latestEntry) throw new Error(this.literal('The original problem was removed while its shared copy was created.', '分享副本已创建，但原问题已被移除。'));
            latestEntry.shareId = shareId;
            if (String(this.currentId) === sourceId && this.currentItem) this.currentItem.shareId = shareId;
            await this.saveDatabaseSnapshot();
            this.toast(this.text('toastCreatedSharedGist'));
            this.renderAll();
        } catch (error) {
            this.toast(error.message, 'error');
        } finally {
            this.sharing = false;
            this.elements.shareItemButton.disabled = !this.currentItem || this.viewMode === 'trash' || Boolean(this.visitorGistId);
            this.refreshDraftStatus();
        }
    }

    buildPrintableProblemDocument(item) {
        const title = escapeHtml(item.title || this.text('defaultUntitledProblem'));
        const statementHtml = renderDocument(item.desc || '', { preamble: item.preamble });
        const notes = Array.isArray(item.answers) ? item.answers : [];
        const notesHtml = notes.length
            ? notes.map((note) => `
                <article class="print-note">
                    <div class="print-note-meta">${escapeHtml(formatDate(note.date))}</div>
                    <div class="rich-text">${renderDocument(note.text || '', { preamble: item.preamble }).html}</div>
                </article>
            `).join('')
            : `<p class="print-empty">${escapeHtml(this.text('noNotesTitle'))}</p>`;

        return `<!DOCTYPE html>
<html lang="${this.language === 'zh' ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=STIX+Two+Text:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            color-scheme: light;
            --ink: #201913;
            --muted: #675c50;
            --line: rgba(94, 76, 56, 0.18);
            --accent: #0f766e;
            --paper: #fffdf9;
        }
        @page {
            size: A4;
            margin: 15mm;
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
            color: var(--ink);
            background: var(--paper);
        }
        main {
            max-width: 920px;
            margin: 0 auto;
            padding: 28px 12px 36px;
        }
        h1, h2 {
            margin: 0;
            font-family: "STIX Two Text", Georgia, serif;
            font-weight: 600;
        }
        .print-header {
            border-bottom: 1px solid var(--line);
            padding-bottom: 18px;
            margin-bottom: 24px;
        }
        .print-kicker {
            font-size: 12px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 10px;
        }
        .print-meta {
            margin-top: 10px;
            color: var(--muted);
            font-size: 14px;
        }
        .print-section {
            margin-top: 28px;
        }
        .print-section h2 {
            font-size: 24px;
            margin-bottom: 14px;
        }
        .print-note {
            border: 1px solid var(--line);
            border-radius: 18px;
            padding: 16px 18px;
            margin-top: 14px;
            break-inside: avoid;
            background: #fffcf7;
        }
        .print-note-meta {
            margin-bottom: 12px;
            color: var(--muted);
            font-size: 13px;
        }
        .print-empty {
            color: var(--muted);
        }
        .rich-text {
            line-height: 1.75;
        }
        .rich-text img {
            max-width: 100%;
        }
    </style>
    <script>
        window.MathJax = {
            loader: { load: ['[tex]/physics', '[tex]/mhchem', '[tex]/color', '[tex]/cancel', '[tex]/boldsymbol'] },
            tex: {
                packages: { '[+]': ['physics', 'mhchem', 'color', 'cancel', 'boldsymbol'] },
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true,
                tags: 'ams'
            },
            startup: { typeset: false }
        };
    </script>
    <script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
    <main>
        <header class="print-header">
            <div class="print-kicker">${escapeHtml(this.text('heroProblem'))}</div>
            <h1>${title}</h1>
            <div class="print-meta">${escapeHtml(this.text('updatedAt', { date: formatDate(item.date) }))}</div>
        </header>
        <section class="print-section">
            <h2>${escapeHtml(this.text('statement'))}</h2>
            <div class="rich-text">${statementHtml.html}</div>
        </section>
        <section class="print-section">
            <h2>${escapeHtml(this.text('researchNotes'))}</h2>
            ${notesHtml}
        </section>
    </main>
    <script>
        async function waitForMathJax() {
            const deadline = Date.now() + 6000;
            while (Date.now() < deadline) {
                if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
                    await window.MathJax.startup.promise;
                    if (window.MathJax.typesetPromise) {
                        await window.MathJax.typesetPromise();
                    }
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 60));
            }
        }

        window.addEventListener('load', async () => {
            await waitForMathJax();
            window.focus();
            setTimeout(() => window.print(), 120);
        });

        window.addEventListener('afterprint', () => window.close());
    </script>
</body>
</html>`;
    }

    buildPrintableNoteDocument(item, note) {
        const problemTitle = escapeHtml(item.title || this.text('defaultUntitledProblem'));
        const documentTitle = escapeHtml(`${item.title || this.text('defaultUntitledProblem')} - ${this.text('researchNote')}`);
        const noteHtml = renderDocument(note.text || '', { preamble: item.preamble });

        return `<!DOCTYPE html>
<html lang="${this.language === 'zh' ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${documentTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=STIX+Two+Text:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            color-scheme: light;
            --ink: #201913;
            --muted: #675c50;
            --line: rgba(94, 76, 56, 0.18);
            --accent: #0f766e;
            --paper: #fffdf9;
        }
        @page {
            size: A4;
            margin: 15mm;
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
            color: var(--ink);
            background: var(--paper);
        }
        main {
            max-width: 920px;
            margin: 0 auto;
            padding: 28px 12px 36px;
        }
        h1, h2 {
            margin: 0;
            font-family: "STIX Two Text", Georgia, serif;
            font-weight: 600;
        }
        .print-header {
            border-bottom: 1px solid var(--line);
            padding-bottom: 18px;
            margin-bottom: 24px;
        }
        .print-kicker {
            font-size: 12px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 10px;
        }
        .print-meta {
            margin-top: 10px;
            color: var(--muted);
            font-size: 14px;
        }
        .print-section {
            margin-top: 28px;
        }
        .print-section h2 {
            font-size: 24px;
            margin-bottom: 14px;
        }
        .rich-text {
            line-height: 1.75;
        }
        .rich-text img {
            max-width: 100%;
        }
    </style>
    <script>
        window.MathJax = {
            loader: { load: ['[tex]/physics', '[tex]/mhchem', '[tex]/color', '[tex]/cancel', '[tex]/boldsymbol'] },
            tex: {
                packages: { '[+]': ['physics', 'mhchem', 'color', 'cancel', 'boldsymbol'] },
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true,
                tags: 'ams'
            },
            startup: { typeset: false }
        };
    </script>
    <script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
    <main>
        <header class="print-header">
            <div class="print-kicker">${escapeHtml(this.text('researchNote'))}</div>
            <h1>${problemTitle}</h1>
            <div class="print-meta">${escapeHtml(this.text('updatedAt', { date: formatDate(note.date) }))}</div>
        </header>
        <section class="print-section">
            <h2>${escapeHtml(this.text('researchNote'))}</h2>
            <div class="rich-text">${noteHtml.html}</div>
        </section>
    </main>
    <script>
        async function waitForMathJax() {
            const deadline = Date.now() + 6000;
            while (Date.now() < deadline) {
                if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
                    await window.MathJax.startup.promise;
                    if (window.MathJax.typesetPromise) {
                        await window.MathJax.typesetPromise();
                    }
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 60));
            }
        }

        window.addEventListener('load', async () => {
            await waitForMathJax();
            window.focus();
            setTimeout(() => window.print(), 120);
        });

        window.addEventListener('afterprint', () => window.close());
    </script>
</body>
</html>`;
    }

    printHtmlDocument(html) {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.opacity = '0';
        frame.style.pointerEvents = 'none';
        frame.style.border = '0';
        const cleanup = () => frame.remove();
        frame.addEventListener('load', () => {
            frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
        }, { once: true });
        document.body.appendChild(frame);
        frame.srcdoc = html;
        window.setTimeout(cleanup, 60000);
    }

    exportCurrentItemPdf() {
        if (!this.currentItem || (this.viewMode === 'trash' && this.currentSummary?.type === 'note')) {
            return;
        }

        this.printHtmlDocument(this.buildPrintableProblemDocument(this.currentItem));
    }

    exportNotePdf(noteId) {
        if (!this.currentItem || !noteId) {
            return;
        }

        const note = (this.currentItem.answers || []).find((entry) => entry.id === noteId);
        if (!note) {
            return;
        }

        this.printHtmlDocument(this.buildPrintableNoteDocument(this.currentItem, note));
    }

    openConfigModal() {
        this.reflectConfig();
        this.updateLegacyImportButton();
        this.elements.configModal.classList.remove('hidden');
    }

    closeConfigModal() {
        this.elements.configModal.classList.add('hidden');
    }

    async disableAppLogin() {
        const shouldDisable = window.confirm(this.literal(
            'Disable the custom app login and keep the sync config stored in plain local settings for this browser?',
            '关闭应用登录，并把同步配置以明文形式保存在此浏览器的本地设置中？'
        ));
        if (!shouldDisable) {
            return;
        }

        clearLockedConfig();
        this.authProfile = null;
        this.authSession = null;
        this.config = saveConfig(this.config);
        this.configSource = getConfigSource();
        this.reflectConfig();
        this.toast(this.literal('App login disabled for this browser.', '已在此浏览器中关闭应用登录。'));
    }

    async saveConfigFromModal() {
        if (this.sharing || this.saving || this.pendingLocalCommits) return;
        if (this.hasUnsavedComposer()) {
            this.toast(this.literal('Save or cancel the open draft before changing sync settings.', '更改同步设置前，请先保存或取消草稿。'));
            return;
        }
        const previousKey = this.databaseCacheKey;
        try {
            const token = this.elements.configTokenInput.value.trim();
            let mainGistId = this.elements.configGistInput.value.trim();
            const authUsername = this.elements.configAuthUsernameInput.value.trim();
            const authPassword = this.elements.configAuthPasswordInput.value;
            const authPasswordConfirm = this.elements.configAuthPasswordConfirmInput.value;
            if (mainGistId.includes('/')) {
                mainGistId = mainGistId.split('/').pop().replace('.git', '');
            }

            let createdMainGist = false;
            const wantsCredentialUpdate = Boolean(authPassword || authPasswordConfirm
                || (authUsername && authUsername !== this.authSession?.username));
            let nextAuthSession = this.authSession;

            if (wantsCredentialUpdate) {
                if (!authUsername) {
                    throw new Error(this.literal('App username is required to enable the custom login.', '启用应用登录需要填写用户名。'));
                }
                if (!authPassword) {
                    throw new Error(this.literal('Enter a password when setting or changing the custom login.', '设置或修改应用登录时请输入密码。'));
                }
                if (authPassword !== authPasswordConfirm) {
                    throw new Error(this.literal('The password confirmation does not match.', '两次输入的密码不一致。'));
                }
                nextAuthSession = {
                    username: authUsername,
                    password: authPassword
                };
            }

            let createdState = null;
            if (!mainGistId && token) {
                this.setStatusKey('statusCreatingMainGist');
                mainGistId = await createMainDatabase(token);
                createdMainGist = true;
                // Persist the current library before switching the config's
                // cache key. A failed/interrupted first upload remains local.
                createdState = await commitDatabase(`rq_v2_main_${mainGistId}`, normalizeDatabase({}), this.db, {
                    normalize: normalizeDatabase, remote: true
                });
                this.toast(this.text('toastCreatedMainGist', { id: mainGistId }));
            }
            const nextConfig = { token, mainGistId };

            if (nextAuthSession) {
                this.config = await lockConfig(nextConfig, nextAuthSession);
                this.authSession = nextAuthSession;
                this.authProfile = { username: nextAuthSession.username };
                clearStoredConfig();
            } else {
                clearLockedConfig();
                this.authProfile = null;
                this.authSession = null;
                this.config = saveConfig(nextConfig);
            }
            this.configSource = getConfigSource();
            this.reflectConfig();
            this.closeConfigModal();
            if (createdMainGist) {
                this.db = createdState.database;
                this.baseDb = clone(this.db);
                this.localDirty = true;
                this.setStatusKey('statusSavedLocally');
                void this.syncPending();
                this.renderAll();
            } else {
                if (previousKey !== this.databaseCacheKey) {
                    const state = await readDatabaseState(this.databaseCacheKey);
                    this.db = normalizeDatabase(state.database || {});
                    this.baseDb = clone(this.db);
                    this.reconcileRouteSelection({ replaceRoute: true });
                    await this.renderCurrentSelection();
                }
                await this.syncPull();
            }
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async importLegacyData() {
        if (this.sharing || this.saving || this.pendingLocalCommits) return;
        if (this.hasUnsavedComposer()) {
            this.toast(this.literal('Save or cancel the draft before importing.', '导入前请先保存或取消草稿。'));
            return;
        }
        const legacyConfig = loadLegacyConfig();
        if (!legacyConfig.mainGistId) {
            this.toast(this.text('toastNoLegacyConfig'), 'error');
            return;
        }

        if (!window.confirm(this.text('confirmImportLegacyOverwrite'))) {
            return;
        }

        try {
            this.config = this.authSession ? this.config : loadConfig();
            if (!this.config.mainGistId || !this.config.token) {
                const nextConfig = {
                    token: this.config.token || legacyConfig.token,
                    mainGistId: this.config.mainGistId || legacyConfig.mainGistId
                };
                this.config = this.authSession
                    ? await lockConfig(nextConfig, this.authSession)
                    : saveConfig(nextConfig);
                this.configSource = getConfigSource();
                this.reflectConfig();
            }

            this.setStatusKey('statusSyncing');
            const { database, version } = await fetchMainDatabase({
                ...legacyConfig,
                token: legacyConfig.token || this.config.token
            });
            const imported = normalizeDatabase(parseWorkspaceSnapshot(database));
            const target = await readDatabaseState(this.databaseCacheKey);
            this.baseDb = normalizeDatabase(target.database || {});
            this.db = imported;
            if (legacyConfig.mainGistId === this.config.mainGistId && !target.version) {
                // Establish a known base without acknowledging any dirty edits.
                await setValue(this.databaseVersionKey, version);
            }
            await this.saveDatabaseSnapshot({ replace: true });
            this.viewMode = 'active';
            this.updateViewModeButtons();
            this.reconcileRouteSelection({ replaceRoute: true });
            if (this.pageMode === 'detail') {
                await this.renderCurrentSelection();
            } else {
                this.renderAll();
            }
            this.closeConfigModal();
            this.setStatusKey('statusImportedLegacy');
            this.toast(this.text('toastImportedLegacy', {
                problems: this.db.items.length,
                trash: this.db.trash.length
            }));
        } catch (error) {
            this.setStatusKey('statusLoadFailed');
            this.toast(error.message, 'error');
        }
    }

    async exportBackup() {
        const stored = await readDatabaseState(this.databaseCacheKey);
        const payload = serializeWorkspaceSnapshot(stored.database || this.db, {
            exportedAt: new Date().toISOString()
        });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `research-qa-workspace-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async importBackup(event) {
        if (this.sharing || this.saving || this.pendingLocalCommits) { event.target.value = ''; return; }
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (this.hasUnsavedComposer()) {
            this.toast(this.literal('Save or cancel the draft before importing.', '导入前请先保存或取消草稿。'));
            event.target.value = '';
            return;
        }
        try {
            const text = await file.text();
            if (this.composerState.open || this.sharing || this.saving || this.pendingLocalCommits) throw new Error(this.literal('Close the editor and finish saving before importing.', '请先关闭编辑器并完成保存，再导入。'));
            const parsed = JSON.parse(text);
            const nextDatabase = normalizeDatabase(parseWorkspaceSnapshot(parsed));
            if (!window.confirm(this.text('confirmImportOverwrite'))) {
                event.target.value = '';
                return;
            }

            this.db = nextDatabase;
            await this.saveDatabaseSnapshot({ replace: true });
            this.reconcileRouteSelection({ replaceRoute: true });
            if (this.pageMode === 'detail') {
                await this.renderCurrentSelection();
            } else {
                this.renderAll();
            }
            this.toast(this.text('toastImportCompleted'));
        } catch (error) {
            this.toast(this.text('toastImportFailed', { message: error.message }), 'error');
        } finally {
            event.target.value = '';
        }
    }
}

const app = new ResearchQaApp();
app.init();

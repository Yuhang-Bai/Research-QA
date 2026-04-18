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
import { getValue, setValue } from './data/idb.js';
import { createMainDatabase, createSharedItem, fetchMainDatabase, fetchSharedItem, saveMainDatabase, saveSharedItem } from './data/gist.js';
import { createMarkdownEditor } from './lib/editor.js';
import { renderDocument, renderExcerpt, renderInlineMath, setRenderedHtml, typesetElement } from './lib/renderer.js';

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
        compilerUrl: 'Compiler service URL',
        compilerUrlPlaceholder: 'Optional. Example: http://127.0.0.1:18765/api/latex',
        compilerNote: 'Set this to a local LaTeX compiler service if you want true TeX PDF export instead of browser print export.',
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
        statusCompilingPdf: 'Compiling PDF',
        statusOfflineCache: 'Offline cache',
        statusSavedLocally: 'Saved locally',
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
        toastCreatedSharedGist: 'Created a shared gist. Click Share again to copy the link.',
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
        toastLatexPdfReady: 'Compiled PDF is ready',
        toastLatexCompilerFallback: 'LaTeX compiler unavailable. Falling back to browser PDF export.',
        toastLatexCompileFailed: 'LaTeX compile failed: {message}. Falling back to browser PDF export.'
    },
    zh: {}
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
        id: typeof note.id === 'string' ? note.id : createId('note'),
        text: typeof note.text === 'string' ? note.text : '',
        date: typeof note.date === 'string' ? note.date : new Date().toISOString()
    };
}

function normalizeItem(item = {}) {
    const parsedSortRank = Number(item.sortRank);
    return {
        id: item.id ?? createId('item'),
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
            configCompilerUrlLabel: document.querySelector('#config-compiler-url-input')?.closest('.field')?.querySelector('span') ?? null,
            configCompilerUrlInput: document.getElementById('config-compiler-url-input'),
            configCompilerNote: document.getElementById('config-compiler-note'),
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
            onChange: (value) => this.scheduleComposerPreview(value)
        });
    }

    get databaseCacheKey() {
        return this.config.mainGistId ? `rq_v2_main_${this.config.mainGistId}` : LOCAL_DATABASE_KEY;
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
        this.elements.backHomeButton.textContent = 'Back to problems';
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
        this.elements.configCompilerUrlLabel.textContent = this.text('compilerUrl');
        this.elements.configCompilerUrlInput.placeholder = this.text('compilerUrlPlaceholder');
        this.elements.configCompilerNote.textContent = this.text('compilerNote');
        this.elements.configAuthUsernameLabel.textContent = this.literal('App username', 'App username');
        this.elements.configAuthUsernameInput.placeholder = this.literal('Set your own sign-in name', 'Set your own sign-in name');
        this.elements.configAuthPasswordLabel.textContent = this.literal('App password', 'App password');
        this.elements.configAuthPasswordInput.placeholder = this.literal('Leave blank to keep the current password', 'Leave blank to keep the current password');
        this.elements.configAuthPasswordConfirmLabel.textContent = this.literal('Confirm app password', 'Confirm app password');
        this.elements.configAuthPasswordConfirmInput.placeholder = this.literal('Repeat the password when changing it', 'Repeat the password when changing it');
        this.elements.configAuthNote.textContent = this.literal('Once enabled, your GitHub sync token and gist ID are encrypted locally behind this username/password.', 'Once enabled, your GitHub sync token and gist ID are encrypted locally behind this username/password.');
        this.elements.configNote.innerHTML = this.text('configNote');
        this.elements.cancelConfigButton.textContent = this.text('cancel');
        this.elements.saveConfigButton.textContent = this.text('saveSettings');
        this.elements.configCloseButton.setAttribute('aria-label', this.text('closeSettings'));
        this.elements.disableLockButton.textContent = this.literal('Disable app login', 'Disable app login');
        this.elements.authEyebrow.textContent = this.literal('Private Workspace', 'Private Workspace');
        this.elements.authTitle.textContent = this.literal('Unlock Research QA', 'Unlock Research QA');
        this.elements.authDescription.textContent = this.literal('Sign in with your own app account to load the encrypted sync configuration.', 'Sign in with your own app account to load the encrypted sync configuration.');
        this.elements.authUsernameLabel.textContent = this.literal('Username', 'Username');
        this.elements.authUsernameInput.placeholder = this.literal('Enter your app username', 'Enter your app username');
        this.elements.authPasswordLabel.textContent = this.literal('Password', 'Password');
        this.elements.authPasswordInput.placeholder = this.literal('Enter your app password', 'Enter your app password');
        this.elements.authUnlockButton.textContent = this.literal('Unlock', 'Unlock');

        if (this.elements.languageButton) {
            this.elements.languageButton.textContent = this.language === 'zh' ? 'EN' : 'ZH';
        }

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

    bindEvents() {
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

        this.elements.searchInput.addEventListener('input', () => this.renderList());
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
            if (Date.now() < this.suppressRowClickUntil) {
                return;
            }

            const listAction = event.target.closest('[data-list-action]');
            if (listAction) {
                event.preventDefault();
                event.stopPropagation();

                if (listAction.dataset.listAction === 'pin') {
                    this.togglePinById(listAction.dataset.itemId);
                }
                return;
            }

            const row = event.target.closest('[data-item-id]');
            if (!row) {
                return;
            }

            this.openItemPageInNewTab(row.dataset.itemId);
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
                case 'delete':
                    this.deleteNote(noteId);
                    break;
                default:
                    break;
            }
        });

        window.addEventListener('popstate', () => this.handlePopState());
    }

    async init() {
        this.ensureUtilityButtons();
        this.bindEvents();
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

        const cached = await getValue(this.databaseCacheKey);
        if (cached) {
            this.db = normalizeDatabase(cached);
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
            this.setStatusKey('statusLocalMode');
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
            this.elements.authError.textContent = this.literal('Incorrect username or password.', 'Incorrect username or password.');
            this.elements.authError.classList.remove('hidden');
        }
    }

    updateDisableLockButton() {
        this.elements.disableLockButton.classList.toggle('hidden', !this.authProfile && !this.authSession);
    }

    reflectConfig() {
        this.elements.configTokenInput.value = this.config.token;
        this.elements.configGistInput.value = this.config.mainGistId;
        this.elements.configCompilerUrlInput.value = this.config.compilerUrl ?? '';
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

        this.pageMode = 'home';
        this.currentId = null;
        this.currentItem = null;
        this.currentSummary = null;
        this.syncRouteState({ replace });
        this.renderAll();
    }

    async openItemPage(itemId, { replace = false } = {}) {
        if (!itemId) {
            return;
        }

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

            const remote = normalizeItem(await fetchSharedItem(this.visitorGistId, this.config.token));
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

    async syncPull(options = {}) {
        if (this.visitorGistId) {
            await this.loadVisitorItem();
            return;
        }

        if (!this.config.mainGistId) {
            this.toast(this.text('toastNoRemoteGist'));
            this.setStatusKey('statusLocalMode');
            return;
        }

        try {
            this.setStatusKey('statusSyncing');
            const remoteDatabase = normalizeDatabase(await fetchMainDatabase(this.config));
            this.db = remoteDatabase;
            await setValue(this.databaseCacheKey, this.db);
            this.reconcileRouteSelection({ replaceRoute: true });
            if (this.pageMode === 'detail') {
                await this.renderCurrentSelection();
            } else {
                this.renderAll();
            }
            if (options.announceLegacyImport) {
                this.setStatusKey('statusImportedLegacy');
                this.toast(this.text('toastImportedLegacy', {
                    problems: this.db.items.length,
                    trash: this.db.trash.length
                }));
            } else {
                this.setStatusKey('statusSynced');
            }

            if (!options.quiet && !options.announceLegacyImport) {
                this.toast(this.text('toastPulledLatest'));
            }
        } catch (error) {
            this.setStatusKey('statusOfflineCache');
            if (!options.quiet) {
                this.toast(error.message, 'error');
            }
        }
    }

    async saveDatabaseSnapshot() {
        await setValue(this.databaseCacheKey, this.db);
        if (this.config.mainGistId) {
            await saveMainDatabase(this.config, this.db);
            this.setStatusKey('statusSynced');
        } else {
            this.setStatusKey('statusSavedLocally');
        }
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

        if (summary.shareId) {
            const cached = await getValue(this.sharedCacheKey(summary.shareId));
            if (cached && selectionMark === this.selectionToken) {
                this.currentItem = normalizeItem(cached);
                this.currentSource = 'shared';
                this.renderAll();
            }

            try {
                if (!options.silent) {
                    this.setStatusKey('statusLoadingSharedItem');
                }

                const remoteItem = normalizeItem(await fetchSharedItem(summary.shareId, this.config.token));
                if (selectionMark !== this.selectionToken) {
                    return;
                }

                this.currentItem = remoteItem;
                this.currentSource = 'shared';
                await setValue(this.sharedCacheKey(summary.shareId), remoteItem);
                this.renderAll();
                if (!options.silent) {
                    this.setStatusKey('statusSyncedSharedItem');
                }
            } catch (error) {
                if (!cached) {
                    this.toast(error.message, 'error');
                }
                if (!options.silent) {
                    this.setStatusKey('statusSharedItemUnavailable');
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
        this.renderList();
        this.renderDetail();
        this.finishBoot();
    }

    refreshVisiblePanels() {
        if (!this.visitorGistId && this.pageMode === 'home') {
            this.renderList();
            return;
        }

        this.renderDetail();
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
        return !this.visitorGistId && this.pageMode === 'home' && this.viewMode === 'active' && !String(term).trim();
    }

    isRowDraggable(row) {
        return Boolean(row?.dataset?.draggable === 'true');
    }

    clearListDropMarkers() {
        this.elements.list.querySelectorAll('.drop-before, .drop-after, .dragging').forEach((row) => {
            row.classList.remove('drop-before', 'drop-after', 'dragging');
        });
    }

    clearListDragState() {
        this.clearListDropMarkers();
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
        if (!this.isRowDraggable(row) || event.target.closest('[data-list-action]')) {
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
        this.previewListReorder(row, position);
    }

    handleListDrop(event) {
        if (!this.dragState.itemId) {
            return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
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
            this.renderList();
        }
        this.clearListDragState();
    }

    getDragPreviewPosition(row, event) {
        const bounds = row.getBoundingClientRect();
        const offsetX = event.clientX - (bounds.left + bounds.width / 2);
        const offsetY = event.clientY - (bounds.top + bounds.height / 2);
        const horizontalBias = Math.abs(offsetX) > Math.abs(offsetY) * 1.1;
        if (horizontalBias) {
            return offsetX < 0 ? 'before' : 'after';
        }
        return offsetY < 0 ? 'before' : 'after';
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

        if (
            this.dragState.overId === targetRow.dataset.itemId
            && this.dragState.position === position
        ) {
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
            this.renderList();
            return;
        }

        const pinnedItems = this.db.items.filter((entry) => entry.isPinned);
        const regularItems = this.db.items.filter((entry) => !entry.isPinned);
        const currentGroup = pinGroup === 'pinned' ? pinnedItems : regularItems;
        if (orderedIds.length !== currentGroup.length) {
            this.renderList();
            return;
        }

        const itemMap = new Map(currentGroup.map((entry) => [String(entry.id), entry]));
        const orderedGroup = orderedIds.map((id) => itemMap.get(String(id))).filter(Boolean);
        if (orderedGroup.length !== currentGroup.length) {
            this.renderList();
            return;
        }

        const unchanged = orderedGroup.every((entry, index) => String(entry.id) === String(currentGroup[index].id));
        if (unchanged) {
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
            this.renderList();
        } catch (error) {
            this.toast(error.message, 'error');
            this.renderList();
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
        const collection = this.getCurrentCollection();
        const term = this.elements.searchInput.value.trim().toLowerCase();
        const reorderEnabled = this.canReorderList(term);
        this.elements.viewStatus.textContent = this.viewMode === 'trash'
            ? this.text('viewTrashCount', { count: collection.length })
            : this.text('viewProblemsCount', { count: collection.length });

        const items = collection.filter((entry) => {
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
            setRenderedHtml(this.elements.list, {
                html: `
                <div class="sidebar-panel">
                    <div class="eyebrow">${this.text('noMatch')}</div>
                    <p class="modal-note">${term ? this.text('noResults') : this.text('noProblems')}</p>
                </div>
            `
            });
            return;
        }

        setRenderedHtml(this.elements.list, {
            html: `
            <div class="list-card">
                ${items.map((entry) => this.renderListRow(entry, { reorderEnabled })).join('')}
            </div>
        `
        });
        typesetElement(this.elements.list);
    }

    renderListRow(entry, options = {}) {
        if (entry.type === 'note') {
            const activeClass = String(entry.id) === String(this.currentId) ? 'active' : '';
            const excerpt = renderExcerpt(entry.data.text, {
                preamble: entry.parentPreamble,
                length: 180,
                emptyText: 'No content yet.'
            });
            return `
                <article class="problem-row trash ${activeClass}" data-item-id="${entry.id}">
                    <div class="problem-row-top">
                        <h3>${renderInlineMath(this.text('archivedNoteTitle', { title: entry.parentTitle }), { preamble: entry.parentPreamble })}</h3>
                        <span class="meta-pill">${this.text('note')}</span>
                    </div>
                    <div class="problem-row-excerpt rich-text">${excerpt.html}</div>
                    <div class="item-meta">
                        <span class="meta-pill">${this.text('deletedAt', { date: formatDate(entry.deletedAt) })}</span>
                    </div>
                </article>
            `;
        }

        const activeClass = String(entry.id) === String(this.currentId) ? 'active' : '';
        const trashClass = this.viewMode === 'trash' ? 'trash' : '';
        const syncBadge = entry.shareId ? `<span class="meta-pill">${this.text('sharedBadge')}</span>` : '';
        const pinBadge = entry.isPinned ? `<span class="meta-pill">${this.text('pinnedBadge')}</span>` : '';
        const noteCount = Array.isArray(entry.answers) ? entry.answers.length : 0;
        const pinFeedbackState = String(this.pinFeedback.itemId) === String(entry.id) ? this.pinFeedback.state : '';
        const draggableAttrs = options.reorderEnabled
            ? ` draggable="true" data-draggable="true" data-pin-group="${entry.isPinned ? 'pinned' : 'regular'}"`
            : '';
        const pinAction = this.viewMode === 'active' && !this.visitorGistId
            ? `
                <button
                    class="row-icon-btn ${entry.isPinned ? 'is-active' : ''} ${pinFeedbackState ? `is-${pinFeedbackState}` : ''}"
                    type="button"
                    data-list-action="pin"
                    data-item-id="${entry.id}"
                    aria-label="${entry.isPinned ? this.text('unpin') : this.text('pin')}"
                    title="${entry.isPinned ? this.text('unpin') : this.text('pin')}"
                >${entry.isPinned ? this.text('unpin') : this.text('pin')}</button>
            `
            : '';
        const excerpt = renderExcerpt(entry.desc, {
            preamble: entry.preamble,
            length: 200,
            emptyText: 'No content yet.'
        });
        const deletionBadge = entry.deletedAt
            ? `<span class="meta-pill">${this.text('deletedAt', { date: formatDate(entry.deletedAt) })}</span>`
            : `<span class="meta-pill">${formatDate(entry.date)}</span>`;

        return `
            <article class="problem-row ${activeClass} ${trashClass} ${pinFeedbackState ? `pin-feedback pin-${pinFeedbackState}` : ''}" data-item-id="${entry.id}"${draggableAttrs}>
                <div class="problem-row-top">
                    <h3>${renderInlineMath(entry.title || this.text('defaultUntitledProblem'), { preamble: entry.preamble })}</h3>
                    <div class="problem-row-actions">
                        ${pinAction}
                        <span class="meta-pill">${this.text('notesCount', { count: noteCount })}</span>
                    </div>
                </div>
                <div class="problem-row-excerpt rich-text">${excerpt.html}</div>
                <div class="item-meta">
                    ${deletionBadge}
                    ${pinBadge}
                    ${syncBadge}
                </div>
            </article>
        `;
    }

    renderDetail() {
        if (!this.visitorGistId && this.pageMode !== 'detail') {
            this.elements.emptyState.classList.add('hidden');
            this.elements.detailView.classList.add('hidden');
            return;
        }

        if (!this.currentItem) {
            this.elements.emptyState.classList.remove('hidden');
            this.elements.detailView.classList.add('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.detailView.classList.remove('hidden');

        if (this.viewMode === 'trash' && this.currentSummary?.type === 'note') {
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

            this.elements.noteList.innerHTML = `
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
            `;
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
        setRenderedHtml(this.elements.detailTitle, {
            html: renderInlineMath(title, { preamble: this.currentItem.preamble })
        });
        typesetElement(this.elements.detailTitle);
        this.elements.detailSubtitle.textContent = subtitle;
        this.elements.heroKind.textContent = this.viewMode === 'trash' ? this.text('trashedProblem') : this.text('heroProblem');
        this.elements.heroUpdated.textContent = this.text('updatedAt', { date: formatDate(this.currentItem.date) });
        this.elements.heroRemote.textContent = this.currentSource === 'shared'
            ? this.text('sharedGist')
            : (this.currentSource === 'trash'
                ? this.text('trashBadge')
                : (this.config.mainGistId ? this.text('mainGist') : this.text('localCache')));

        const problemHtml = renderDocument(this.currentItem.desc, { preamble: this.currentItem.preamble });
        setRenderedHtml(this.elements.problemRender, problemHtml);
        typesetElement(this.elements.problemRender);

        this.renderNotes();
        this.elements.pinItemButton.textContent = this.currentItem.isPinned ? this.text('unpin') : this.text('pin');
        this.elements.pinItemButton.classList.toggle('pin-active', this.currentItem.isPinned);
        this.elements.pinItemButton.classList.toggle('pin-feedback', Boolean(detailPinFeedback));
        this.elements.pinItemButton.classList.toggle('pin-added', detailPinFeedback === 'pinned');
        this.elements.pinItemButton.classList.toggle('pin-removed', detailPinFeedback === 'unpinned');
        this.elements.newNoteButton.disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.editProblemButton.disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.pinItemButton.disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.shareItemButton.disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        this.elements.pdfItemButton.disabled = false;
        this.elements.restoreItemButton.classList.toggle('hidden', this.viewMode !== 'trash');
        this.elements.destroyItemButton.classList.toggle('hidden', this.viewMode !== 'trash');
        this.elements.deleteItemButton.classList.toggle('hidden', this.viewMode === 'trash');
        this.elements.deleteItemButton.textContent = this.text('delete');
    }

    renderNotes() {
        const notes = this.currentItem.answers || [];

        if (!notes.length) {
            this.elements.noteList.innerHTML = `
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
            `;

            const inlineNew = document.getElementById('inline-new-note-btn');
            if (inlineNew) {
                inlineNew.addEventListener('click', () => this.openNoteEditor());
            }
            return;
        }

        this.elements.noteList.innerHTML = notes.map((note) => {
            const expanded = this.expandedNotes.has(note.id);
            const body = expanded
                ? `<div class="rich-text" data-note-render="${note.id}"></div>`
                : `<div class="note-excerpt rich-text" data-note-preview="${note.id}"></div>`;
            const toggleLabel = expanded ? this.text('collapse') : this.text('expand');
            const toolbar = this.viewMode === 'trash' || this.visitorGistId ? '' : `
                    <button class="pill-btn soft" data-note-action="edit" data-note-id="${note.id}">${this.text('editNote')}</button>
                    <button class="pill-btn warn" data-note-action="delete" data-note-id="${note.id}">${this.text('deleteNote')}</button>
                `;

            return `
                <article class="note-card">
                    <div class="note-card-head">
                        <time datetime="${note.date}">${formatDate(note.date)}</time>
                        <div class="note-toolbar">
                            <button class="pill-btn soft" data-note-action="toggle" data-note-id="${note.id}">${toggleLabel}</button>
                            ${toolbar}
                        </div>
                    </div>
                    ${body}
                </article>
            `;
        }).join('');

        notes.forEach((note) => {
            const expanded = this.expandedNotes.has(note.id);
            const container = expanded
                ? this.elements.noteList.querySelector(`[data-note-render="${note.id}"]`)
                : this.elements.noteList.querySelector(`[data-note-preview="${note.id}"]`);
            if (!container) {
                return;
            }

            const rendered = expanded
                ? renderDocument(note.text, { preamble: this.currentItem.preamble })
                : renderExcerpt(note.text, {
                    preamble: this.currentItem.preamble,
                    length: 220,
                    emptyText: 'No content yet.'
                });
            setRenderedHtml(container, rendered);
            typesetElement(container);
        });
    }

    async setViewMode(mode) {
        if (mode === this.viewMode) {
            return;
        }

        this.viewMode = mode;
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
        if (this.visitorGistId) {
            return;
        }

        const nextItem = normalizeItem({ id: createId('item'), title: this.text('newProblem'), desc: '', answers: [], date: new Date().toISOString(), isPinned: false });
        this.db.items.unshift(nextItem);
        sortItemsInPlace(this.db.items);
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
        if (!this.currentItem || this.viewMode === 'trash' || this.visitorGistId) {
            return;
        }

        this.composerState = { open: true, kind: 'problem', noteId: null };
        this.elements.workspace.classList.add('composer-open');
        this.elements.composer.classList.remove('hidden');
        this.refreshComposerChrome();
        this.elements.composerTitleField.classList.remove('hidden');
        this.elements.composerPreambleField.classList.remove('hidden');
        this.elements.composerTitleInput.value = this.currentItem.title;
        this.elements.composerPreambleInput.value = this.currentItem.preamble;
        this.editor.setValue(this.currentItem.desc);
        this.scheduleComposerPreview(this.currentItem.desc, true);
        window.setTimeout(() => this.editor.focus(), 40);
    }

    openNoteEditor(noteId = null) {
        if (!this.currentItem || this.viewMode === 'trash' || this.visitorGistId) {
            return;
        }

        const note = noteId ? this.currentItem.answers.find((entry) => entry.id === noteId) : null;
        this.composerState = { open: true, kind: 'note', noteId };
        this.elements.workspace.classList.add('composer-open');
        this.elements.composer.classList.remove('hidden');
        this.refreshComposerChrome();
        this.elements.composerTitleField.classList.add('hidden');
        this.elements.composerPreambleField.classList.add('hidden');
        this.elements.composerTitleInput.value = '';
        this.editor.setValue(note ? note.text : '');
        this.scheduleComposerPreview(note ? note.text : '', true);
        window.setTimeout(() => this.editor.focus(), 40);
    }

    closeComposer() {
        this.composerState = { open: false, kind: 'problem', noteId: null };
        this.elements.workspace.classList.remove('composer-open');
        this.elements.composer.classList.add('hidden');
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
        if (!this.currentItem) {
            return;
        }

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
            this.closeComposer();
            this.renderAll();
            this.toast(this.text('toastSaved'));
        } catch (error) {
            this.toast(error.message, 'error');
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

        const persistedItem = this.db.items.find((entry) => String(entry.id) === String(normalized.id));
        if (persistedItem?.shareId) {
            await saveSharedItem(persistedItem.shareId, this.config.token, normalized);
            await setValue(this.sharedCacheKey(persistedItem.shareId), normalized);
        }

        await this.saveDatabaseSnapshot();
        this.currentSummary = persistedItem;
    }

    toggleNote(noteId) {
        if (this.expandedNotes.has(noteId)) {
            this.expandedNotes.delete(noteId);
        } else {
            this.expandedNotes.add(noteId);
        }
        this.renderNotes();
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
            prompt: true,
            returnHomeOnCurrentDelete: true
        });
    }

    async deleteItemById(itemId, options = {}) {
        const {
            prompt = false,
            returnHomeOnCurrentDelete = false
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
            this.currentId = null;
            this.currentItem = null;
            this.currentSummary = null;
        }

        try {
            await this.saveDatabaseSnapshot();
            if (deletedCurrent && returnHomeOnCurrentDelete) {
                await this.goHome({ replace: true });
            } else {
                this.renderAll();
            }
            this.toast(this.text('toastProblemMovedToTrash'));
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async restoreTrashItem() {
        if (this.viewMode !== 'trash' || !this.currentSummary) {
            return;
        }

        const index = this.db.trash.findIndex((entry) => String(entry.id) === String(this.currentSummary.id));
        if (index === -1) {
            return;
        }

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
        if (this.viewMode !== 'trash' || !this.currentSummary || !window.confirm(this.text('confirmPermanentDelete'))) {
            return;
        }

        const index = this.db.trash.findIndex((entry) => String(entry.id) === String(this.currentSummary.id));
        if (index === -1) {
            return;
        }

        this.db.trash.splice(index, 1);
        this.currentId = this.db.trash[0]?.id ?? null;
        this.currentItem = null;
        this.currentSummary = null;

        try {
            await this.saveDatabaseSnapshot();
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
            this.currentSummary = this.db.items.find((entry) => String(entry.id) === String(itemId)) ?? this.currentSummary;
            this.queuePinFeedback(itemId, target.isPinned ? 'pinned' : 'unpinned');
            this.refreshVisiblePanels();
            this.toast(this.text(target.isPinned ? 'toastPinned' : 'toastUnpinned'));
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async handleShare() {
        if (!this.currentItem || this.viewMode === 'trash') {
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

            const shareId = await createSharedItem(this.config.token, this.currentItem);
            entry.shareId = shareId;
            this.currentItem.shareId = shareId;
            await this.saveDatabaseSnapshot();
            this.toast(this.text('toastCreatedSharedGist'));
            this.renderAll();
        } catch (error) {
            this.toast(error.message, 'error');
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

    getCompilerServiceBaseUrl() {
        const explicit = (this.config.compilerUrl || '').trim().replace(/\/+$/, '');
        if (explicit) {
            return explicit;
        }

        if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            return '/api/latex';
        }

        return '';
    }

    sanitizePdfFilename(title) {
        const cleaned = String(title || this.text('defaultUntitledProblem'))
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return `${cleaned || 'research-problem'}.pdf`;
    }

    downloadPdfBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async tryCompilerPdfExport() {
        const compilerBaseUrl = this.getCompilerServiceBaseUrl();
        if (!compilerBaseUrl || !this.currentItem) {
            return { handled: false };
        }

        const previousStatus = this.statusState;
        this.setStatusKey('statusCompilingPdf');

        try {
            const response = await fetch(`${compilerBaseUrl}/compile-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    item: this.currentItem,
                    language: this.language
                })
            });

            if (!response.ok) {
                const message = (await response.text()).trim() || `${response.status} ${response.statusText}`;
                return { handled: false, error: new Error(message), compileFailed: true };
            }

            const blob = await response.blob();
            this.downloadPdfBlob(blob, this.sanitizePdfFilename(this.currentItem.title));
            this.toast(this.text('toastLatexPdfReady'));
            return { handled: true };
        } catch (error) {
            return { handled: false, error };
        } finally {
            this.setStatusKey(previousStatus.key, previousStatus.params);
        }
    }

    exportCurrentItemPdfWithPrint() {
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
            window.setTimeout(() => {
                try {
                    if (!frame.contentWindow?.print) {
                        throw new Error('Print is unavailable in this browser.');
                    }
                    frame.contentWindow.onafterprint = cleanup;
                    frame.contentWindow.focus();
                    frame.contentWindow.print();
                } catch (error) {
                    cleanup();
                    this.toast(this.text('toastPdfPopupBlocked'), 'error');
                }
            }, 700);
        }, { once: true });
        document.body.appendChild(frame);
        frame.srcdoc = this.buildPrintableProblemDocument(this.currentItem);
        window.setTimeout(cleanup, 60000);
    }

    async exportCurrentItemPdf() {
        if (!this.currentItem || (this.viewMode === 'trash' && this.currentSummary?.type === 'note')) {
            return;
        }

        const compileResult = await this.tryCompilerPdfExport();
        if (compileResult.handled) {
            return;
        }

        if (compileResult.error) {
            this.toast(
                this.text(
                    compileResult.compileFailed ? 'toastLatexCompileFailed' : 'toastLatexCompilerFallback',
                    { message: compileResult.error.message }
                ),
                compileResult.compileFailed ? 'error' : 'info'
            );
        }

        this.exportCurrentItemPdfWithPrint();
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
            'Disable the custom app login and keep the sync config stored in plain local settings for this browser?'
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
        this.toast(this.literal('App login disabled for this browser.', 'App login disabled for this browser.'));
    }

    async saveConfigFromModal() {
        try {
            const token = this.elements.configTokenInput.value.trim();
            let mainGistId = this.elements.configGistInput.value.trim();
            const compilerUrl = this.elements.configCompilerUrlInput.value.trim().replace(/\/+$/, '');
            const authUsername = this.elements.configAuthUsernameInput.value.trim();
            const authPassword = this.elements.configAuthPasswordInput.value;
            const authPasswordConfirm = this.elements.configAuthPasswordConfirmInput.value;
            if (mainGistId.includes('/')) {
                mainGistId = mainGistId.split('/').pop().replace('.git', '');
            }

            if (!mainGistId && token) {
                this.setStatusKey('statusCreatingMainGist');
                mainGistId = await createMainDatabase(token);
                this.toast(this.text('toastCreatedMainGist', { id: mainGistId }));
            }

            const nextConfig = { token, mainGistId, compilerUrl };
            const wantsCredentialUpdate = Boolean(authUsername || authPassword || authPasswordConfirm);
            let nextAuthSession = this.authSession;

            if (wantsCredentialUpdate) {
                if (!authUsername) {
                    throw new Error(this.literal('App username is required to enable the custom login.', 'App username is required to enable the custom login.'));
                }
                if (!authPassword) {
                    throw new Error(this.literal('Enter a password when setting or changing the custom login.', 'Enter a password when setting or changing the custom login.'));
                }
                if (authPassword !== authPasswordConfirm) {
                    throw new Error(this.literal('The password confirmation does not match.', 'The password confirmation does not match.'));
                }
                nextAuthSession = {
                    username: authUsername,
                    password: authPassword
                };
            }

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
            await this.syncPull();
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async importLegacyData() {
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
            this.db = normalizeDatabase(await fetchMainDatabase(legacyConfig));
            await setValue(this.databaseCacheKey, this.db);
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

    exportBackup() {
        const payload = {
            exportedAt: new Date().toISOString(),
            version: 2,
            db: this.db
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `research-qa-backup-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async importBackup(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const nextDatabase = normalizeDatabase(parsed.db || parsed);
            if (!window.confirm(this.text('confirmImportOverwrite'))) {
                event.target.value = '';
                return;
            }

            this.db = nextDatabase;
            await this.saveDatabaseSnapshot();
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



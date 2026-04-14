import { getConfigSource, loadConfig, saveConfig } from './data/config.js';
import { getValue, setValue } from './data/idb.js';
import { createMainDatabase, createSharedItem, fetchMainDatabase, fetchSharedItem, saveMainDatabase, saveSharedItem } from './data/gist.js';
import { createMarkdownEditor } from './lib/editor.js';
import { renderDocument, setRenderedHtml, toPlainExcerpt, typesetElement } from './lib/renderer.js';

const LOCAL_DATABASE_KEY = 'rq_v2_local_database';

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
    return {
        id: item.id ?? createId('item'),
        title: typeof item.title === 'string' && item.title.trim() ? item.title : '未命名问题',
        desc: typeof item.desc === 'string' ? item.desc : '',
        preamble: typeof item.preamble === 'string' ? item.preamble : '',
        answers: Array.isArray(item.answers) ? item.answers.map(normalizeNote) : [],
        date: typeof item.date === 'string' ? item.date : new Date().toISOString(),
        isPinned: Boolean(item.isPinned),
        shareId: typeof item.shareId === 'string' && item.shareId.trim() ? item.shareId.trim() : ''
    };
}

function normalizeTrashEntry(entry = {}) {
    if (entry.type === 'note') {
        return {
            type: 'note',
            data: normalizeNote(entry.data || {}),
            parentId: entry.parentId ?? null,
            parentTitle: typeof entry.parentTitle === 'string' ? entry.parentTitle : '未知问题',
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
            items: raw.map(normalizeItem),
            trash: []
        };
    }

    return {
        items: Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [],
        trash: Array.isArray(raw.trash) ? raw.trash.map(normalizeTrashEntry) : []
    };
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleString('zh-CN', {
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
        this.configSource = getConfigSource();
        this.config = loadConfig();
        this.db = normalizeDatabase({});
        this.viewMode = 'active';
        this.currentId = null;
        this.currentItem = null;
        this.currentSummary = null;
        this.currentSource = 'local';
        this.selectionToken = 0;
        this.expandedNotes = new Set();
        this.visitorGistId = new URLSearchParams(window.location.search).get('gist');
        this.composerState = {
            open: false,
            kind: 'problem',
            noteId: null
        };
        this.previewTimer = null;

        this.elements = {
            workspace: document.querySelector('.workspace'),
            list: document.getElementById('problem-list'),
            searchInput: document.getElementById('search-input'),
            syncStatus: document.getElementById('sync-status'),
            viewStatus: document.getElementById('view-status'),
            storageLabel: document.getElementById('storage-label'),
            emptyState: document.getElementById('empty-state'),
            detailView: document.getElementById('detail-view'),
            detailTitle: document.getElementById('detail-title'),
            detailSubtitle: document.getElementById('detail-subtitle'),
            heroKind: document.getElementById('hero-kind'),
            heroUpdated: document.getElementById('hero-updated'),
            heroRemote: document.getElementById('hero-remote'),
            problemRender: document.getElementById('problem-render'),
            noteList: document.getElementById('note-list'),
            composer: document.getElementById('composer'),
            composerModeLabel: document.getElementById('composer-mode-label'),
            composerTitleText: document.getElementById('composer-title-text'),
            composerTitleField: document.getElementById('composer-title-field'),
            composerTitleInput: document.getElementById('composer-title-input'),
            composerPreambleField: document.getElementById('composer-preamble-field'),
            composerPreambleInput: document.getElementById('composer-preamble-input'),
            composerPreview: document.getElementById('composer-preview'),
            editorHost: document.getElementById('editor-host'),
            configModal: document.getElementById('config-modal'),
            configTokenInput: document.getElementById('config-token-input'),
            configGistInput: document.getElementById('config-gist-input'),
            toastStack: document.getElementById('toast-stack'),
            importFileInput: document.getElementById('import-file-input')
        };

        this.editor = createMarkdownEditor({
            host: this.elements.editorHost,
            placeholderText: '在这里输入 Markdown / LaTeX 内容',
            onChange: (value) => this.scheduleComposerPreview(value)
        });
    }

    get databaseCacheKey() {
        return this.config.mainGistId ? `rq_v2_main_${this.config.mainGistId}` : LOCAL_DATABASE_KEY;
    }

    sharedCacheKey(gistId) {
        return `rq_v2_shared_${gistId}`;
    }

    bindEvents() {
        document.getElementById('sync-btn').addEventListener('click', () => this.syncPull());
        document.getElementById('export-btn').addEventListener('click', () => this.exportBackup());
        document.getElementById('import-btn').addEventListener('click', () => this.elements.importFileInput.click());
        document.getElementById('config-btn').addEventListener('click', () => this.openConfigModal());
        document.getElementById('create-item-btn').addEventListener('click', () => this.createNewItem());
        document.getElementById('empty-create-btn').addEventListener('click', () => this.createNewItem());
        document.getElementById('empty-config-btn').addEventListener('click', () => this.openConfigModal());
        document.getElementById('edit-problem-btn').addEventListener('click', () => this.openProblemEditor());
        document.getElementById('new-note-btn').addEventListener('click', () => this.openNoteEditor());
        document.getElementById('delete-item-btn').addEventListener('click', () => this.handleDeleteAction());
        document.getElementById('pin-item-btn').addEventListener('click', () => this.togglePin());
        document.getElementById('share-item-btn').addEventListener('click', () => this.handleShare());
        document.getElementById('close-composer-btn').addEventListener('click', () => this.closeComposer());
        document.getElementById('cancel-composer-btn').addEventListener('click', () => this.closeComposer());
        document.getElementById('save-composer-btn').addEventListener('click', () => this.saveComposer());
        document.getElementById('close-config-btn').addEventListener('click', () => this.closeConfigModal());
        document.getElementById('cancel-config-btn').addEventListener('click', () => this.closeConfigModal());
        document.getElementById('save-config-btn').addEventListener('click', () => this.saveConfigFromModal());

        this.elements.searchInput.addEventListener('input', () => this.renderList());
        this.elements.composerPreambleInput.addEventListener('input', () => this.scheduleComposerPreview(this.editor.getValue()));
        this.elements.importFileInput.addEventListener('change', (event) => this.importBackup(event));

        document.querySelectorAll('[data-view-mode]').forEach((button) => {
            button.addEventListener('click', () => this.setViewMode(button.dataset.viewMode));
        });

        this.elements.list.addEventListener('click', (event) => {
            const row = event.target.closest('[data-item-id]');
            if (!row) {
                return;
            }

            this.selectItem(row.dataset.itemId);
        });

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
    }

    async init() {
        this.bindEvents();
        this.reflectConfig();

        if (this.visitorGistId) {
            document.getElementById('create-item-btn').disabled = true;
            this.elements.storageLabel.textContent = '共享只读';
            await this.loadVisitorItem();
            return;
        }

        const cached = await getValue(this.databaseCacheKey);
        if (cached) {
            this.db = normalizeDatabase(cached);
            this.currentId = this.db.items[0]?.id ?? null;
            await this.renderCurrentSelection();
            this.setStatus('已加载缓存');
        } else {
            this.renderAll();
        }

        if (this.config.mainGistId) {
            await this.syncPull({
                quiet: Boolean(cached),
                announceLegacyImport: this.configSource === 'legacy' && !cached
            });
        } else {
            this.setStatus('本地模式');
        }
    }

    reflectConfig() {
        this.elements.configTokenInput.value = this.config.token;
        this.elements.configGistInput.value = this.config.mainGistId;
        this.elements.storageLabel.textContent = this.config.mainGistId ? 'GitHub gist 同步' : '本地优先';
    }

    setStatus(text) {
        this.elements.syncStatus.textContent = text;
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
            this.setStatus('正在读取共享内容');
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
            this.setStatus('共享视图');
        } catch (error) {
            this.toast(error.message, 'error');
            this.setStatus('读取失败');
            this.renderAll();
        }
    }

    async syncPull(options = {}) {
        if (this.visitorGistId) {
            await this.loadVisitorItem();
            return;
        }

        if (!this.config.mainGistId) {
            this.toast('当前未配置远程 gist，仍会继续保存到本地缓存');
            this.setStatus('本地模式');
            return;
        }

        try {
            this.setStatus('同步中');
            const remoteDatabase = normalizeDatabase(await fetchMainDatabase(this.config));
            this.db = remoteDatabase;
            await setValue(this.databaseCacheKey, this.db);

            if (!this.currentId) {
                this.currentId = this.db.items[0]?.id ?? null;
            } else {
                const stillExists = [...this.db.items, ...this.db.trash].some((entry) => String(entry.id) === String(this.currentId));
                if (!stillExists) {
                    this.currentId = this.db.items[0]?.id ?? null;
                }
            }

            await this.renderCurrentSelection();
            if (options.announceLegacyImport) {
                this.setStatus('已导入旧版数据');
                this.toast(`已导入旧版数据：${this.db.items.length} 个问题，${this.db.trash.length} 个回收站条目`);
            } else {
                this.setStatus('已同步');
            }

            if (!options.quiet && !options.announceLegacyImport) {
                this.toast('已从 GitHub gist 刷新数据');
            }
        } catch (error) {
            this.setStatus('离线缓存');
            if (!options.quiet) {
                this.toast(error.message, 'error');
            }
        }
    }

    async saveDatabaseSnapshot() {
        await setValue(this.databaseCacheKey, this.db);
        if (this.config.mainGistId) {
            await saveMainDatabase(this.config, this.db);
            this.setStatus('已同步');
        } else {
            this.setStatus('已保存到本地缓存');
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
                    this.setStatus('读取共享问题');
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
                    this.setStatus('已同步共享问题');
                }
            } catch (error) {
                if (!cached) {
                    this.toast(error.message, 'error');
                }
                if (!options.silent) {
                    this.setStatus('共享问题读取失败');
                }
            }

            return;
        }

        this.currentItem = clone(summary);
        this.currentSource = 'local';
        this.renderAll();
    }

    renderAll() {
        this.renderList();
        this.renderDetail();
    }

    renderList() {
        const collection = this.getCurrentCollection();
        const term = this.elements.searchInput.value.trim().toLowerCase();
        this.elements.viewStatus.textContent = this.viewMode === 'trash' ? `回收站 ${collection.length}` : `问题 ${collection.length}`;

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
            this.elements.list.innerHTML = `
                <div class="sidebar-panel">
                    <div class="eyebrow">No Match</div>
                    <p class="modal-note">${term ? '没有命中当前检索条件。' : '这里还没有问题。'}</p>
                </div>
            `;
            return;
        }

        this.elements.list.innerHTML = `
            <div class="list-card">
                ${items.map((entry) => this.renderListRow(entry)).join('')}
            </div>
        `;
    }

    renderListRow(entry) {
        if (entry.type === 'note') {
            return `
                <article class="problem-row trash" data-item-id="${entry.parentId}">
                    <div class="problem-row-top">
                        <h3>归档笔记 · ${entry.parentTitle}</h3>
                        <span class="meta-pill">笔记</span>
                    </div>
                    <p>${toPlainExcerpt(entry.data.text, 120)}</p>
                    <div class="item-meta">
                        <span class="meta-pill">删除于 ${formatDate(entry.deletedAt)}</span>
                    </div>
                </article>
            `;
        }

        const activeClass = String(entry.id) === String(this.currentId) ? 'active' : '';
        const trashClass = this.viewMode === 'trash' ? 'trash' : '';
        const syncBadge = entry.shareId ? '<span class="meta-pill">共享</span>' : '';
        const pinBadge = entry.isPinned ? '<span class="meta-pill">置顶</span>' : '';
        const noteCount = Array.isArray(entry.answers) ? entry.answers.length : 0;
        const deletionBadge = entry.deletedAt ? `<span class="meta-pill">删除于 ${formatDate(entry.deletedAt)}</span>` : `<span class="meta-pill">${formatDate(entry.date)}</span>`;

        return `
            <article class="problem-row ${activeClass} ${trashClass}" data-item-id="${entry.id}">
                <div class="problem-row-top">
                    <h3>${entry.title}</h3>
                    <span class="meta-pill">${noteCount} 条笔记</span>
                </div>
                <p>${toPlainExcerpt(entry.desc, 120)}</p>
                <div class="item-meta">
                    ${deletionBadge}
                    ${pinBadge}
                    ${syncBadge}
                </div>
            </article>
        `;
    }

    renderDetail() {
        if (!this.currentItem) {
            this.elements.emptyState.classList.remove('hidden');
            this.elements.detailView.classList.add('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        this.elements.detailView.classList.remove('hidden');

        const title = this.currentItem.title || '未命名问题';
        const subtitle = this.viewMode === 'trash'
            ? '当前是回收站视图。可以恢复，也可以彻底删除。'
            : '支持 Markdown、MathJax 和 theorem/proof 环境。';
        this.elements.detailTitle.textContent = title;
        this.elements.detailSubtitle.textContent = subtitle;
        this.elements.heroKind.textContent = this.viewMode === 'trash' ? '回收站项目' : '问题';
        this.elements.heroUpdated.textContent = `更新于 ${formatDate(this.currentItem.date)}`;
        this.elements.heroRemote.textContent = this.currentSource === 'shared' ? '共享 gist' : (this.config.mainGistId ? '主 gist' : '本地缓存');

        const problemHtml = renderDocument(this.currentItem.desc, { preamble: this.currentItem.preamble });
        setRenderedHtml(this.elements.problemRender, problemHtml);
        typesetElement(this.elements.problemRender);

        this.renderNotes();
        document.getElementById('new-note-btn').disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        document.getElementById('edit-problem-btn').disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        document.getElementById('pin-item-btn').disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        document.getElementById('share-item-btn').disabled = this.viewMode === 'trash' || Boolean(this.visitorGistId);
        document.getElementById('delete-item-btn').textContent = this.viewMode === 'trash' ? '恢复 / 删除' : '删除';
    }

    renderNotes() {
        const notes = this.currentItem.answers || [];

        if (!notes.length) {
            this.elements.noteList.innerHTML = `
                <article class="note-card">
                    <div class="note-card-head">
                        <div>
                            <div class="eyebrow">No Notes Yet</div>
                            <strong>这里还没有研究笔记</strong>
                        </div>
                        ${this.viewMode === 'trash' ? '' : '<button class="pill-btn" id="inline-new-note-btn">开始记录</button>'}
                    </div>
                    <div class="note-excerpt">把思路、局部引理、失败尝试和证明片段放进这里，后续检索和迁移都会保留。</div>
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
                : `<div class="note-excerpt">${toPlainExcerpt(note.text, 220)}</div>`;
            const toggleLabel = expanded ? '收起' : '展开';
            const toolbar = this.viewMode === 'trash' || this.visitorGistId
                ? ''
                : `
                    <button class="pill-btn soft" data-note-action="edit" data-note-id="${note.id}">编辑</button>
                    <button class="pill-btn warn" data-note-action="delete" data-note-id="${note.id}">删除</button>
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
            if (!this.expandedNotes.has(note.id)) {
                return;
            }

            const container = this.elements.noteList.querySelector(`[data-note-render="${note.id}"]`);
            if (!container) {
                return;
            }

            const rendered = renderDocument(note.text, { preamble: this.currentItem.preamble });
            setRenderedHtml(container, rendered);
            typesetElement(container);
        });
    }

    setViewMode(mode) {
        if (mode === this.viewMode) {
            return;
        }

        this.viewMode = mode;
        document.querySelectorAll('[data-view-mode]').forEach((button) => {
            button.classList.toggle('active', button.dataset.viewMode === mode);
        });

        if (mode === 'trash') {
            this.currentId = this.db.trash.find((entry) => entry.type !== 'note')?.id ?? null;
        } else {
            this.currentId = this.db.items[0]?.id ?? null;
        }

        this.renderCurrentSelection();
    }

    createNewItem() {
        if (this.visitorGistId) {
            return;
        }

        const nextItem = normalizeItem({
            id: createId('item'),
            title: '新问题',
            desc: '',
            answers: [],
            date: new Date().toISOString(),
            isPinned: false
        });

        this.db.items.unshift(nextItem);
        this.currentId = nextItem.id;
        this.currentItem = clone(nextItem);
        this.currentSummary = nextItem;
        this.currentSource = 'local';
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
        this.elements.composerModeLabel.textContent = '编辑问题';
        this.elements.composerTitleText.textContent = '问题编辑器';
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

        const note = noteId
            ? this.currentItem.answers.find((entry) => entry.id === noteId)
            : null;

        this.composerState = { open: true, kind: 'note', noteId };
        this.elements.workspace.classList.add('composer-open');
        this.elements.composer.classList.remove('hidden');
        this.elements.composerModeLabel.textContent = note ? '编辑笔记' : '新增笔记';
        this.elements.composerTitleText.textContent = '研究笔记';
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
            this.currentItem.title = this.elements.composerTitleInput.value.trim() || '未命名问题';
            this.currentItem.desc = body;
            this.currentItem.preamble = this.elements.composerPreambleInput.value.trim();
            this.currentItem.date = new Date().toISOString();
        } else {
            const targetNote = this.currentItem.answers.find((note) => note.id === this.composerState.noteId);
            if (targetNote) {
                targetNote.text = body;
                targetNote.date = new Date().toISOString();
            } else {
                this.currentItem.answers.push(normalizeNote({
                    id: createId('note'),
                    text: body,
                    date: new Date().toISOString()
                }));
            }
            this.currentItem.date = new Date().toISOString();
        }

        try {
            await this.persistCurrentItem();
            this.closeComposer();
            this.renderAll();
            this.toast('内容已保存');
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
        if (!window.confirm('确定删除这条笔记并移入回收站吗？')) {
            return;
        }

        const index = this.currentItem.answers.findIndex((note) => note.id === noteId);
        if (index === -1) {
            return;
        }

        const deletedNote = this.currentItem.answers.splice(index, 1)[0];
        this.db.trash.unshift({
            type: 'note',
            data: deletedNote,
            parentId: this.currentItem.id,
            parentTitle: this.currentItem.title,
            deletedAt: new Date().toISOString()
        });
        this.currentItem.date = new Date().toISOString();

        try {
            await this.persistCurrentItem();
            this.renderAll();
            this.toast('笔记已移入回收站');
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async handleDeleteAction() {
        if (this.viewMode === 'trash') {
            const mode = window.prompt('输入 1 恢复，输入 2 彻底删除', '1');
            if (mode === '1') {
                await this.restoreTrashItem();
            } else if (mode === '2') {
                await this.destroyTrashItem();
            }
            return;
        }

        await this.deleteCurrentItem();
    }

    async deleteCurrentItem() {
        if (!this.currentItem || !window.confirm('确定删除这个问题并移入回收站吗？')) {
            return;
        }

        const index = this.db.items.findIndex((entry) => String(entry.id) === String(this.currentItem.id));
        if (index === -1) {
            return;
        }

        const deleted = this.db.items.splice(index, 1)[0];
        this.db.trash.unshift({
            ...deleted,
            type: 'item',
            deletedAt: new Date().toISOString()
        });

        this.currentId = this.db.items[0]?.id ?? null;
        this.currentItem = null;
        this.currentSummary = null;

        try {
            await this.saveDatabaseSnapshot();
            await this.renderCurrentSelection();
            this.toast('问题已移入回收站');
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
        if (restored.type === 'note') {
            const parent = this.db.items.find((entry) => String(entry.id) === String(restored.parentId));
            if (parent) {
                parent.answers.push(normalizeNote(restored.data));
            } else {
                const recoveryItem = normalizeItem({
                    title: `恢复的归档笔记 · ${restored.parentTitle}`,
                    desc: '自动生成，用于承接原问题已不存在的恢复笔记。',
                    answers: [normalizeNote(restored.data)],
                    date: new Date().toISOString()
                });
                this.db.items.unshift(recoveryItem);
            }
        } else {
            restored.type = 'item';
            this.db.items.unshift(normalizeItem(restored));
        }

        try {
            await this.saveDatabaseSnapshot();
            this.setViewMode('active');
            this.toast('已恢复');
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async destroyTrashItem() {
        if (this.viewMode !== 'trash' || !this.currentSummary || !window.confirm('彻底删除后不可恢复，确定继续吗？')) {
            return;
        }

        const index = this.db.trash.findIndex((entry) => String(entry.id) === String(this.currentSummary.id));
        if (index === -1) {
            return;
        }

        this.db.trash.splice(index, 1);
        this.currentId = this.db.trash.find((entry) => entry.type !== 'note')?.id ?? null;
        this.currentItem = null;
        this.currentSummary = null;

        try {
            await this.saveDatabaseSnapshot();
            await this.renderCurrentSelection();
            this.toast('已彻底删除');
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async togglePin() {
        if (!this.currentItem || this.viewMode === 'trash') {
            return;
        }

        const index = this.db.items.findIndex((entry) => String(entry.id) === String(this.currentItem.id));
        if (index === -1) {
            return;
        }

        this.db.items[index].isPinned = !this.db.items[index].isPinned;
        const [moved] = this.db.items.splice(index, 1);
        if (moved.isPinned) {
            this.db.items.unshift(moved);
        } else {
            this.db.items.push(moved);
        }
        this.currentItem.isPinned = moved.isPinned;

        try {
            await this.saveDatabaseSnapshot();
            this.renderAll();
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
                    this.toast('共享链接已复制到剪贴板');
                } else {
                    window.prompt('共享链接', shareUrl.toString());
                }
                return;
            }

            if (!this.config.token) {
                this.openConfigModal();
                this.toast('要创建共享链接，需要先配置 GitHub Token', 'error');
                return;
            }

            const shareId = await createSharedItem(this.config.token, this.currentItem);
            entry.shareId = shareId;
            this.currentItem.shareId = shareId;
            await this.saveDatabaseSnapshot();
            this.toast('已创建共享 gist，再点一次即可复制链接');
            this.renderAll();
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    openConfigModal() {
        this.reflectConfig();
        this.elements.configModal.classList.remove('hidden');
    }

    closeConfigModal() {
        this.elements.configModal.classList.add('hidden');
    }

    async saveConfigFromModal() {
        try {
            const token = this.elements.configTokenInput.value.trim();
            let mainGistId = this.elements.configGistInput.value.trim();
            if (mainGistId.includes('/')) {
                mainGistId = mainGistId.split('/').pop().replace('.git', '');
            }

            if (!mainGistId && token) {
                this.setStatus('创建主数据库 gist');
                mainGistId = await createMainDatabase(token);
                this.toast(`已创建主数据库 ${mainGistId}`);
            }

            this.config = saveConfig({ token, mainGistId });
            this.reflectConfig();
            this.closeConfigModal();
            await this.syncPull();
        } catch (error) {
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
            if (!window.confirm('导入会覆盖当前本地缓存和远程主库，确定继续吗？')) {
                event.target.value = '';
                return;
            }

            this.db = nextDatabase;
            this.currentId = this.db.items[0]?.id ?? null;
            await this.saveDatabaseSnapshot();
            await this.renderCurrentSelection();
            this.toast('导入完成');
        } catch (error) {
            this.toast(`导入失败: ${error.message}`, 'error');
        } finally {
            event.target.value = '';
        }
    }
}

const app = new ResearchQaApp();
app.init();

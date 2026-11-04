// Device-local UI preferences never enter the research database or sync.
const PREFERENCES_KEY = 'rq_v2_directory_layout';
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 520;

export function createProblemDirectory({ workspace, sidebar, searchInput, composer }) {
    const toggle = document.getElementById('library-toggle-btn');
    const expandButton = document.getElementById('expand-directory-btn');
    const scrim = document.getElementById('library-scrim');
    const resizer = document.getElementById('directory-resizer');
    const dialog = document.getElementById('directory-dialog');
    const placeholder = document.createElement('div');
    placeholder.setAttribute('aria-hidden', 'true');
    const narrow = window.matchMedia('(max-width: 760px)');
    let preferences = {};
    try { preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY)) || {}; } catch { /* Use defaults if storage is unavailable. */ }
    let width = Number.isFinite(preferences.width) ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, preferences.width)) : DEFAULT_WIDTH;
    let collapsed = preferences.collapsed === true;
    let drag = null;
    const save = () => {
        try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ width, collapsed })); } catch { /* Layout still works without storage. */ }
    };
    const widthLimit = () => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - 420));
    const applyWidth = () => {
        const effective = Math.min(width, widthLimit());
        // CSS clamps immediately during viewport changes, before resize events run.
        workspace.style.setProperty('--sidebar-width', `clamp(${MIN_WIDTH}px, ${width}px, calc(100vw - 420px))`);
        resizer.setAttribute('aria-valuemax', String(widthLimit()));
        resizer.setAttribute('aria-valuenow', String(effective));
        resizer.setAttribute('aria-valuetext', `${effective}px`);
    };
    const updateVisibility = () => {
        const home = workspace.classList.contains('route-home');
        if (home) workspace.classList.remove('library-open');
        const open = home || (narrow.matches ? workspace.classList.contains('library-open') : !collapsed);
        workspace.classList.toggle('library-collapsed', !home && !narrow.matches && collapsed);
        toggle.setAttribute('aria-expanded', String(open || dialog.open));
        sidebar.inert = !open && !dialog.open;
        const modalDrawer = !home && narrow.matches && open;
        scrim.classList.toggle('hidden', !modalDrawer);
        composer.inert = modalDrawer;
        document.querySelector('.main-panel').inert = modalDrawer;
        document.getElementById('context-panel').inert = modalDrawer;
    };
    const setOpen = open => {
        workspace.classList.toggle('library-open', narrow.matches && open);
        updateVisibility();
        if (narrow.matches && !workspace.classList.contains('route-home')) {
            if (open) searchInput.focus();
            else if (sidebar.contains(document.activeElement)) toggle.focus();
        }
    };
    const setCollapsed = value => {
        if (workspace.classList.contains('route-home')) return;
        collapsed = value;
        updateVisibility(); save();
        if (value) toggle.focus();
        else searchInput.focus();
    };
    const closeExpanded = ({ restoreFocus = true } = {}) => {
        if (!dialog.open) return;
        const scroll = document.getElementById('problem-list').scrollTop;
        dialog.close();
        placeholder.replaceWith(sidebar);
        sidebar.classList.remove('directory-expanded');
        document.getElementById('problem-list').scrollTop = scroll;
        updateVisibility();
        if (restoreFocus) (sidebar.inert ? toggle : expandButton).focus();
    };
    const expand = () => {
        if (dialog.open || workspace.classList.contains('visitor-workspace') || workspace.classList.contains('route-home')) return;
        const scroll = document.getElementById('problem-list').scrollTop;
        sidebar.before(placeholder);
        sidebar.classList.add('directory-expanded');
        sidebar.inert = false;
        dialog.appendChild(sidebar);
        dialog.showModal();
        document.getElementById('problem-list').scrollTop = scroll;
        searchInput.focus();
    };
    const finishDrag = event => {
        if (!drag || (event && event.pointerId !== drag.pointerId)) return;
        const pointer = drag.pointerId;
        drag = null;
        workspace.classList.remove('directory-resizing');
        if (resizer.hasPointerCapture(pointer)) resizer.releasePointerCapture(pointer);
        save();
    };
    resizer.addEventListener('pointerdown', event => {
        if (event.button !== 0 || narrow.matches || dialog.open || collapsed) return;
        event.preventDefault();
        drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: sidebar.getBoundingClientRect().width };
        resizer.setPointerCapture(event.pointerId);
        workspace.classList.add('directory-resizing');
    });
    resizer.addEventListener('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        width = Math.round(Math.max(MIN_WIDTH, Math.min(widthLimit(), drag.startWidth + event.clientX - drag.startX)));
        applyWidth();
    });
    resizer.addEventListener('pointerup', finishDrag);
    resizer.addEventListener('pointercancel', finishDrag);
    resizer.addEventListener('lostpointercapture', finishDrag);
    resizer.addEventListener('keydown', event => {
        const currentWidth = Math.min(width, widthLimit());
        const values = { ArrowLeft: currentWidth - 20, ArrowRight: currentWidth + 20, Home: MIN_WIDTH, End: widthLimit() };
        if (!(event.key in values)) return;
        event.preventDefault();
        width = Math.max(MIN_WIDTH, Math.min(widthLimit(), values[event.key]));
        applyWidth(); save();
    });
    resizer.addEventListener('dblclick', () => { width = DEFAULT_WIDTH; applyWidth(); save(); });
    document.getElementById('collapse-library-btn').addEventListener('click', () => narrow.matches ? setOpen(false) : setCollapsed(true));
    expandButton.addEventListener('click', expand);
    document.getElementById('close-directory-btn').addEventListener('click', () => closeExpanded());
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeExpanded(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) closeExpanded(); });
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])')]
            .filter(element => element.getClientRects().length && !element.closest('[inert]'));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    window.addEventListener('resize', () => { finishDrag(); applyWidth(); });
    narrow.addEventListener('change', () => { finishDrag(); setOpen(false); });
    applyWidth(); updateVisibility();
    return { setOpen, expand, closeExpanded, refresh: updateVisibility, get expanded() { return dialog.open; }, toggle() { narrow.matches ? setOpen(!workspace.classList.contains('library-open')) : setCollapsed(!collapsed); } };
}

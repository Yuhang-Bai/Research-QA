# Data safety and rendering verification

Run from a clean checkout with Node 20 or newer:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Alternatively, set `PLAYWRIGHT_EXECUTABLE_PATH` to an installed Chrome/Chromium
executable. Browser tests use temporary isolated contexts and synthetic records.
All external requests, including every GitHub/Gist request, are intercepted;
remote behavior is simulated. They never use a person's existing browser profile,
token, library, or Gist. The test server serves only the built `dist` directory.

## Persistence behavior

- Each tab compares its edits with its loaded baseline. An IndexedDB transaction
  merges changed fields into the latest saved records. Conflicting writes to the
  same field are rejected; the editor keeps the draft for copying/reconciliation.
- Content, the local revision, dirty flag, and pending shared copies are committed
  together before the network starts. The Sync button retries pending uploads.
  Reload does not pull over dirty data.
- Web Locks serialize uploads from tabs on the same origin. An acknowledgement
  clears only the revision/payload that was sent. A newer edit remains pending.
- Owned problems use the local library as the working copy. Gists publish copies.
  Legacy records that only contain a shared summary are hydrated on demand while
  preserving local IDs, pin order, and share linkage.
- Remote pulls check that the local revision has not changed while fetching.
  Unknown nonempty remote versions and remote conflicts preserve local data and
  stop publishing. Export the local backup before manually reconciling devices.
- Imports validate structure, versions, content, and IDs before confirmation.
  Numeric legacy IDs become strings without changing their values or references.
  A successful replacement also retains the previous database in the same
  IndexedDB `kv` store under `<database key>:beforeImport` for manual recovery.

Web Locks do not coordinate separate devices. GitHub Gist's version read followed
by PATCH is not an atomic compare-and-swap across devices; avoid simultaneous
editing from multiple devices until a server-side conditional-write/merge protocol
is available. Browsers without Web Locks keep edits local and report pending sync.

## Rendering behavior and measured comparison

The notebook workspace retains a compact sidebar on desktop while reading.
The sidebar initially renders at most 100 results; “Show more” adds 100. Search
still examines the whole library. Sidebar rows render escaped titles and counts,
not full statement excerpts or MathJax subtrees. The list keeps its scroll position
when selecting a problem, and regular links navigate in the current workspace.
An explicit open-in-new-tab control remains available.

Drag reordering is available only for a complete, unfiltered collection and is
blocked while the editor is open or a save/share is in progress. Sidebar metadata
mutations are also blocked during an open draft so they cannot advance its
concurrent-edit comparison baseline. Tags are derived from #tags in Markdown;
references and related problems are derived from existing content. No status or
tag fields are added to the portable data format.

Note toggles update only that note's body. Replacing a rendered subtree first
clears its MathJax registrations; superseded queued typesets are skipped.

**Historical measurements from the pre-notebook layout, not current UI results.**

Measured on the same Windows computer with Chrome 154, no CPU throttling, warm
public MathJax resources, and synthetic records (three short formulas per problem):

| Scenario | Before | After |
| --- | --- | --- |
| Detail page with 1000 problems in storage | 80,157 DOM nodes / 3003 math items | 266 DOM nodes / 3 math items |
| Longest main-thread task in that sample | 541 ms | No task exceeding 50 ms observed |
| 20 notes, after 20 expand/collapse actions | 426 math items, 400 detached | 23 math items, 0 detached |
| Search matching 500 problems, longest task | 314 ms | 68 ms, first 100 matches rendered |

These samples are not a guarantee for all hardware or document sizes. Very long
individual statements/previews, external font/MathJax availability, mobile layout,
PDF printing, and multi-device concurrent writes need separate work.

The repository currently tracks root `index.html`, `app.html`, and `assets/` as
well as source files. After source changes, rebuild and refresh those generated
files from `dist` before any future branch-root Pages release. Building or copying
these files locally does not publish a site.

## Notebook redesign verification status

The redesign adds notebook metadata unit tests and browser coverage for same-tab
navigation, history, draft protection, delayed operations, editor views, desktop
sidebar behaviour, visitor isolation, and 390px mobile layout. Run the full
commands above before release. The existing data adapters, renderer, and editor
implementation are unchanged.

In the implementation workspace, unit tests and production build passed. Native
Chromium could not start because its local socket call was denied; the supported
cloud browser also blocked the local preview URL with ERR_BLOCKED_BY_CLIENT.
Consequently, the browser suite, visual screenshots, real responsive rendering,
MathJax visual quality, and updated performance measurements have not been
verified in this workspace. Supplemental synthetic DOM/state checks are useful
for navigation and persistence logic but do not substitute for those checks.
Do not treat this implementation as visually approved or ready for deployment
until real desktop and mobile browser verification succeeds.

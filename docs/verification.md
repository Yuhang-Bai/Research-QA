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

Details do not build the hidden problem list. Home initially renders 100 results;
“Show more” adds 100. Search still examines the whole library. Drag reordering is
available when the full unfiltered list is displayed, so hidden rows cannot be
accidentally dropped from an order update.

Note toggles update only that note's body. Replacing a rendered subtree first
clears its MathJax registrations; superseded queued typesets are skipped.

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

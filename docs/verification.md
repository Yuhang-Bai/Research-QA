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

The notebook workspace starts with a 340px sidebar on desktop while reading.
Drag its right edge to resize (280–520px, with space reserved for the reader),
or use the focused separator's arrow/Home/End keys. Double-click resets the width.
The sidebar can be collapsed and reopened from the top bar. Width and desktop
collapse preferences stay in device-local UI storage, outside research backups
and Gist sync. Filters and tags start folded so the list owns the remaining height.
“Expand directory” opens a modal view of the same search and list with complete,
wrapping titles. Selecting a result returns to reading through the existing draft
protection and navigation flow; Escape or Back to reading cancels browsing.
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

The initial implementation workspace passed unit tests and the production build,
but could not launch native Chromium because its local socket call was denied.
Its cloud browser also blocked the local preview URL with ERR_BLOCKED_BY_CLIENT.
Supplemental synthetic DOM/state checks therefore did not establish visual
correctness.

The subsequently published commit
`c342f4803f8437e6e8cc66ad999278096a9cf150` passed **30/30 unit tests and 39/39
browser regression tests** on GitHub, and both Pages deployment workflows
completed successfully. Live visual inspection then found a legacy CSS grid
rule squeezing the Tags heading and content into separate narrow columns.

The tag-layout fix in main `3904223d58e0c122b5adc129c19c03f6e15347a5` makes
the Tags panel single-column and wraps long tags. Its two regressions cover empty
and populated panels at 1586px, 1100px, and 390px; both were rerun successfully as
part of the directory verification below.

## Directory usability verification — 2026-10-25

Local branch `feat/question-directory-usability` started from clean main
`3904223d58e0c122b5adc129c19c03f6e15347a5`. No AGENTS.md or .agents/skills
were present in the checkout. No packages, data adapters, renderer, or editor
implementation changed. The results below describe the local verification
completed before publication approval; hosted CI and Pages results are checked
separately against the exact published commit.

- `npm test`: **30/30 passed**.
- `npm run build`: **passed** (existing large-chunk advisory remains).
- Chromium 151.0.7922.34: **47/47 browser regressions passed**.
- `git diff --check`: passed.

The six new browser cases cover pointer/keyboard resizing, reset and persisted
collapse state, viewport width limits, expanded full titles (including Chinese
and unbroken strings), search across all 230 synthetic problems and their notes,
load-more batches, empty results, folded active filters, selection and Back/Forward,
eight repeated open/Escape/draft-rejection cycles, the existing New/editor/save
flow with a synthetic formula, and mobile modal focus/selection/resize recovery
at 390px and 320px. Existing persistence and simulated sync regressions also pass.

At 1180×757, the default sidebar measured **340px**, the list **303×378px**,
and the title text column **238px**. The supplied online baseline was 246px,
209×165px, and 145px respectively. These new measurements use synthetic fixtures.

To save the four review screenshots and matching geometry JSON while testing,
set `RESEARCH_QA_SCREENSHOT_DIR` to an output folder before running the browser
suite. Captures show the 1180px reading view, collapsed directory, expanded long
title, and 390px mobile expanded search. All four were visually inspected.
In this implementation workspace, logs and captures are in `../verification/`.

Windows sandbox realpath restrictions blocked the first dependency/build attempts;
the final runs completed with authorized local execution using exact package-lock
versions. Browsers used fresh isolated profiles, synthetic data and fake tokens;
every external request was intercepted. No real research data, Gist, credential,
or existing browser profile was accessed. External fonts and live MathJax CDN
rendering, real network sync, other browser engines, PDF output and deployment
were not verified by this run.

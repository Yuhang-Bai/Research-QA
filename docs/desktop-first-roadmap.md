# Desktop-First Roadmap

## Goal

Move Research-QA from a browser-first app into a desktop-first research workspace without giving up:

- fast local editing
- web publishing
- gist-based sharing
- long-term portability

## Target Architecture

### 1. Canonical data

The long-term source of truth should be an open workspace snapshot:

- `problem` title
- statement in Markdown/LaTeX
- per-problem LaTeX preamble
- notes timeline
- trash metadata
- pin/share metadata

This repo now exports that data as `research-qa-workspace-YYYY-MM-DD.json`.

The snapshot is intentionally app-agnostic enough to migrate into:

- a Tauri desktop app
- a plain file/folder workspace
- a future backend service

### 2. Runtime split

- Desktop app: primary authoring surface
- Web app: lightweight viewer / quick capture / sharing surface
- Gist: optional sync and public-share bridge, not the only master copy

### 3. Storage layers

- Local cache/index: app-managed local database
- Portable backup: workspace snapshot export
- Remote sync: gist today, replaceable later
- Multi-copy backup: Git remote(s), external disk, cloud mirror

## Migration Phases

### Phase A: Prepare the current web app

- isolate storage adapters
- stabilize an open export/import format
- keep old backups importable

### Phase B: Add desktop shell

- scaffold `src-tauri`
- move local persistence from browser-only APIs to desktop-managed storage
- keep the existing Vite frontend

### Phase C: Promote desktop as primary app

- file-system based workspace location selected by the user
- SQLite index for search and fast list rendering
- optional background git sync

### Phase D: Reduce browser responsibilities

- web keeps sharing/readonly/light-edit
- desktop owns heavy editing, backups, export, indexing

## Storage Principles

- never rely on a single hosted free service as the only copy
- keep export/import working across versions
- prefer text-first content over opaque binary-only formats
- treat caches and indexes as rebuildable

## Machine Setup Constraint

When desktop tooling is installed on this machine, keep it off `C:` and use a user-chosen path on `D:` instead.

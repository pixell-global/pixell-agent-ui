## Checklist — Workspace Multi‑Tab + File Editor PRD

Use this checklist to validate the PRD in `docs/workspace-multi-tab-editor.prd.md`.

### A. Workspace Tabs
- [ ] Tab bar supports multiple tabs (chat, editor) with pin/reorder/close and overflow handling
- [ ] New Tab menu includes: New Chat, Open File…, New File…
- [ ] Dirty marker (•) and unsaved-change guard on tab close/navigation

### B. Editor Core
- [ ] Text files open in an editor tab instead of downloading
- [ ] Supported types at v1: txt, csv, rtf
- [ ] Status bar shows encoding, EOL, file size, line:column, mode, dirty state
- [ ] Keyboard shortcuts include Save, Save As, Find/Replace, Go to line, word wrap toggle
- [ ] Autosave with 2s idle debounce; manual save via Cmd/Ctrl+S

### C. CSV Mode
- [ ] Two views: text source and editable grid
- [ ] Delimiter autodetect with manual override
- [ ] Header row toggle, column resize, copy/paste, add/delete rows
- [ ] Virtualized rows for performance

### D. RTF Mode
- [ ] Rich view using Tiptap/ProseMirror and raw source view
- [ ] Conversion pipeline between RTF and HTML
- [ ] Fallback to raw with a warning if conversion fails

### E. Persistence, Conflicts, Recovery
- [ ] Save uses versioned optimistic concurrency
- [ ] Conflict dialog offers overwrite, accept remote, or save as copy
- [ ] Local recovery of unsaved buffers after reload

### F. File Handling Policies
- [ ] Size thresholds: warn ≥2 MB, autosave off ≥5 MB, read‑only ≥10 MB
- [ ] Encoding detection (UTF‑8 default; BOM awareness) and override
- [ ] EOL detection and normalization on save

### G. Navigation Integration
- [ ] File tree click opens editor tab; download is an explicit action
- [ ] Context menu: Open, Open to Side (backlog), Download, Rename, Delete

### H. Accessibility & i18n
- [ ] Tablist/tab/tabpanel roles and keyboard navigation
- [ ] Screen reader labels for status bar and editors
- [ ] i18n for strings (English and Korean supported)

### I. Telemetry & Security
- [ ] Telemetry events for tab/editor lifecycle and autosave
- [ ] Path normalization and ACL enforcement on server
- [ ] HTML sanitization for rich content

### J. Performance Targets
- [ ] Open <1 MB in <300 ms; save <300 ms; typing p95 <16 ms

### K. Architecture & APIs
- [ ] Components defined for tabs, container, editors (txt/csv/rtf), status bar
- [ ] Stores defined for tabs and editor buffers (Zustand)
- [ ] GET /api/files/content returns path, content, size, encoding, EOL, version, mtime
- [ ] POST /api/files/upload accepts path, content, encoding, EOL, expectedVersion and returns new version
- [ ] File create/rename/delete endpoints covered

### L. Milestones & QA
- [ ] Milestones M1–M4 cover tabs, autosave, CSV, RTF, conflicts, recovery, perf/accessibility
- [ ] QA plan includes unit, integration, and E2E tests for major flows



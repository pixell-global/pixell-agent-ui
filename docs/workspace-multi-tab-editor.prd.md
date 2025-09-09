## Workspace Restructure PRD — Multi‑Tab Workspace with Integrated File Editor

Version: 1.0
Owner: Web Platform
Status: Draft
Target release: v0.2.0 (2–3 sprints)

This PRD defines a multi‑tab workspace (chat tabs and file editor tabs) and a robust text file editor supporting txt, csv, and rtf. It specifies UX, architecture, state management, APIs, security, and QA.

### 1) Problem Statement
- Files currently download on click and cannot be opened for in‑app editing.
- Users need multiple contexts open at once (chat + files) similar to an IDE.
- Lack of autosave, recovery, and conflict handling risks data loss.

### 2) Goals
- Multi‑tab workspace with chat and editor tabs.
- Open/edit/save txt, csv, rtf in‑app with a high‑quality editor experience.
- Autosave, dirty markers, unsaved change guards, and local recovery.
- Maintain performance for large files and ensure accessibility.

### 3) Non‑Goals (v1)
- Editing binary formats (e.g., PDF, images, docx, xlsx) beyond read‑only preview.
- Multi‑user real‑time collaborative editing.
- Git integration and advanced diff tooling (backlog).

### 4) Personas
- Analyst/Researcher: edits notes and CSV results while chatting with agents.
- Engineer/Agent Author: iterates on prompts, small datasets, and instructions.
- Ops/Reviewer: quickly inspects logs and exports without downloading.

### 5) User Experience

#### 5.1 Multi‑Tab Workspace
- Tab bar at the top of the workspace pane.
- New Tab button menu: New Chat, Open File…, New File…
- Tabs show: icon, title, dirty marker (•), and close button.
- Tab overflow: horizontal scroll + dropdown list of open tabs.
- Context menu: Close, Close Others, Close Right, Reopen Closed, Pin/Unpin, Rename (file tabs), Reveal in Navigator.
- Drag to reorder; pinned tabs stay left.
- Unsaved change guard on close or navigation.

#### 5.2 Editor Tab UX
- Header: filename; tooltip shows full path.
- Status bar: encoding (UTF‑8 default), EOL (LF/CRLF), file size, cursor line:column, language/mode, dirty state.
- Keyboard shortcuts:
  - Save: Cmd/Ctrl+S
  - Save As: Cmd/Ctrl+Shift+S
  - Find: Cmd/Ctrl+F; Replace: Cmd/Ctrl+Alt+F
  - Go to line: Cmd/Ctrl+G
  - Toggle word wrap: Alt+Z
  - Toggle CSV grid view: Cmd/Ctrl+Alt+V
  - Toggle RTF rich/text view: Cmd/Ctrl+Alt+R
- Autosave: debounced 2s after idle; manual save always available.
- Diff‑on‑save (optional): collapsed banner for large edits (>200 lines changed).

#### 5.3 File Types and Modes
- txt: standard text mode.
- csv: two synchronized views
  - Source view (text)
  - Grid view (editable): delimiter autodetect (comma/semicolon/tab) with manual override; header row toggle; column resize; copy/paste; row add/delete; virtualized rows.
- rtf: two synchronized views
  - Rich view: WYSIWYG via Tiptap/ProseMirror (HTML model)
  - Raw view: RTF source
  - Conversion pipeline: RTF → HTML for display; HTML → RTF for save; show warning when fidelity may be lost and allow fallback to raw view.

#### 5.4 Empty/Loading/Error States
- Empty state with guidance to drag files or select from navigator.
- Loading skeleton for editor area.
- Error banners with retry and “View request log” details.

### 6) Information Architecture & Data Model

#### 6.1 Tab Model
```ts
type WorkspaceTab = {
  id: string;
  type: 'chat' | 'editor';
  title: string;
  icon?: string;
  isPinned: boolean;
  isDirty: boolean;
  state: Record<string, unknown>;
  path?: string;       // editor: workspace‑relative path
  bufferId?: string;   // editor: associated buffer
};

type EditorBuffer = {
  id: string;
  path: string;
  content: string;     // source of truth in memory
  language: 'text' | 'csv' | 'rtf';
  encoding: 'utf8' | 'utf16le' | 'latin1';
  eol: 'LF' | 'CRLF';
  version: number;     // optimistic concurrency token
  lastSavedVersion: number;
  lastSavedAt?: string;
  isSaving: boolean;
  isReadOnly: boolean;
};
```

#### 6.2 Stores (Zustand)
- `tab-store.ts`: CRUD for tabs, pinned state, recently closed tabs.
- `editor-store.ts`: buffers registry, dirty tracking, save queue, autosave scheduler, recovery snapshot persistence.
- Keep chat state in existing stores; do not couple with editor internals.

### 7) System Architecture

#### 7.1 Components
- `WorkspaceTabs` (tab bar) — manages open tabs and tab switching.
- `WorkspaceContainer` — routing surface that renders a tab’s content.
- `FileEditorContainer` — chooses mode (txt/csv/rtf) and status bar; owns buffer lifecycle.
- Editors:
  - `TextEditor` — CodeMirror 6 or Monaco adapter
  - `CsvEditor` — grid + text toggle (`react-data-grid` preferred)
  - `RtfEditor` — Tiptap rich editor + raw view

#### 7.2 Data Flow
1. Click file in navigator → open/focus matching editor tab.
2. If buffer not loaded: GET `/api/files/content?path=<path>`.
3. Initialize `EditorBuffer` with detected encoding/EOL and version.
4. As user types, mark buffer dirty; autosave schedules save job.
5. Save job POSTs `/api/files/upload` with path, content, encoding, eol, expectedVersion.
6. On success: update versions and timestamps; clear dirty.
7. On 409 conflict: show conflict dialog; allow overwrite, accept remote, or save as copy.

#### 7.3 Editor Engine
- Default engine: CodeMirror 6 for light footprint and flexible extensions.
- Abstracted behind `EditorAdapter` to allow future swap with Monaco.

### 8) APIs

We will build upon `apps/web/src/app/api/files/*` route handlers.

#### 8.1 Read File
- GET `/api/files/content?path=<string>`
- 200 Response:
```json
{
  "path": "Amazon/report.csv",
  "content": "col1,col2\n1,2\n",
  "size": 24,
  "encoding": "utf8",
  "eol": "LF",
  "version": 3,
  "mtime": 1710000000000
}
```

#### 8.2 Save File
- POST `/api/files/upload`
- Request:
```json
{
  "path": "Amazon/report.csv",
  "content": "col1,col2\n1,2\n",
  "encoding": "utf8",
  "eol": "LF",
  "expectedVersion": 3
}
```
- 200 Response:
```json
{ "ok": true, "version": 4, "savedBytes": 24, "mtime": 1710000010000 }
```
- 409 Response:
```json
{ "ok": false, "error": "version_conflict", "remoteVersion": 4 }
```

#### 8.3 Create/Rename/Delete
- POST `/api/files/create` → { path, content? }
- POST `/api/files/route` → { from, to }
- DELETE `/api/files/route` → { path }

### 9) File Handling Policies
- Max editable size (soft): 5 MB; warning at 2 MB. Autosave disabled above 5 MB. Hard read‑only at 10 MB.
- Encoding: default UTF‑8; detect BOM; allow override via status bar.
- EOL: detect; allow toggling; normalize on save.
- CSV delimiter detection by sampling first 50 lines; user override persists per buffer.
- RTF conversion with `rtf-to-html` and `html-to-rtf`; fall back to raw with banner on failure.

### 10) Autosave & Recovery
- Debounced autosave (2s idle, 5s max wait) with per‑buffer queue and retry backoff.
- Local recovery: persist unsaved buffers to `localStorage` (compressed) keyed by `bufferId` and `mtime`; prompt to restore on reload.

### 11) Concurrency & Conflicts
- Use `version` from last load/save. Server validates `expectedVersion`.
- Conflict dialog offers: View diff, Keep ours (overwrite), Accept remote, Save as copy.

### 12) Navigation Integration
- Clicking a text file opens an editor tab (no auto download).
- File tree context menu: Open, Open to Side (backlog), Download, Rename, Delete.

### 13) Accessibility & i18n
- Keyboard navigable tablist/tab/tabpanel roles.
- Screen reader labels for status bar, editor, and grid controls.
- Strings under i18n; support English and Korean first.

### 14) Telemetry
- Events: tab_opened, tab_closed, editor_opened, editor_saved, save_failed, conflict_shown, autosave_triggered, csv_toggle_view, rtf_toggle_view.
- Dimensions: file type, file size bucket, duration, error code. No PII.

### 15) Security
- Validate and normalize `path` to workspace root; prevent path traversal.
- Enforce ACLs via existing `lib/security.ts` and storage client.
- Limit payload sizes and sanitize HTML in RTF rich view.

### 16) Performance Targets
- Open file <1 MB: content visible <300 ms on broadband.
- Save <1 MB: <300 ms roundtrip; optimistic UI feedback.
- Typing latency p95 <16 ms for files up to 200k lines in text mode.

### 17) Implementation Plan

#### 17.1 Dependencies
- Add: `@codemirror/*`, `react-codemirror`, `react-data-grid`, `@tiptap/react`, `@tiptap/starter-kit`, `rtf-to-html`, `html-to-rtf`.

#### 17.2 New Files (proposal)
- `apps/web/src/components/workspace/WorkspaceTabs.tsx`
- `apps/web/src/components/workspace/WorkspaceContainer.tsx`
- `apps/web/src/components/editor/FileEditorContainer.tsx`
- `apps/web/src/components/editor/TextEditor.tsx`
- `apps/web/src/components/editor/CsvEditor.tsx`
- `apps/web/src/components/editor/RtfEditor.tsx`
- `apps/web/src/stores/tab-store.ts`
- `apps/web/src/stores/editor-store.ts`

#### 17.3 API updates
- Ensure `/api/files/content` and `/api/files/upload` return/accept `encoding`, `eol`, and `version/expectedVersion`.
- Standardize error payloads and 409 conflict semantics.

#### 17.4 Milestones
- M1: Core tab system; open txt; manual save; unsaved guard; telemetry skeleton.
- M2: Autosave, status bar, find/replace, encoding/EOL; CSV grid/text sync.
- M3: RTF rich/raw with conversion; conflict dialog; recovery flow.
- M4: Performance hardening; accessibility pass; analytics dashboard; docs.

### 18) Acceptance Criteria
- Clicking `.txt/.csv/.rtf` opens an editor tab and never auto‑downloads.
- Dirty marker shows on change; Cmd/Ctrl+S and autosave persist to storage; refresh prompts to restore unsaved data if any.
- CSV grid edits reflect in text view and saved file; delimiter/header handling works.
- RTF rich view loads representative samples; fallback to raw on conversion errors with clear messaging.
- Close dirty tab shows save/discard/cancel.
- Large files hit the documented thresholds and behaviors.
- Keyboard navigation and screen reader roles verified.

### 19) QA Plan
- Unit tests for `tab-store` and `editor-store` covering dirty tracking, autosave, and conflict handling.
- Integration tests for Next.js route handlers for load/save/rename/delete.
- E2E (Playwright): open/edit/save txt; CSV grid↔text; RTF open/edit/save/fallback; unsaved close guard; conflict case; recovery after reload.

### 20) Open Questions
- Choose grid library: `react-data-grid` vs `ag-grid` community (default: `react-data-grid`).
- Should we enable split view (Open to Side) in v1 or v2? Proposed: v2.
- Persist last opened tabs across sessions? Proposed: yes, in `localStorage`.

### 21) Backlog / Future Work
- Real‑time collaborative editing.
- Additional language modes (JSON, Markdown, SQL) with linting.
- Side‑by‑side diff and Git integration.


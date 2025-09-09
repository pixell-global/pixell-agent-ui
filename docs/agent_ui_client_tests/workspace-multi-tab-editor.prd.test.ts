import fs from 'fs'
import path from 'path'

const PRD_PATH = path.resolve(__dirname, '..', 'workspace-multi-tab-editor.prd.md')
const CHECKLIST_PATH = path.resolve(__dirname, '..', 'workspace-multi-tab-editor.checklist.md')

function read(file: string): string {
  return fs.readFileSync(file, 'utf8')
}

describe('PRD and Checklist presence', () => {
  test('PRD file exists and is non-empty', () => {
    const prd = read(PRD_PATH)
    expect(prd.length).toBeGreaterThan(500)
  })

  test('Checklist file exists and is non-empty', () => {
    const list = read(CHECKLIST_PATH)
    expect(list.length).toBeGreaterThan(200)
  })
})

describe('PRD content — Workspace Tabs', () => {
  const prd = read(PRD_PATH)

  test('mentions multi-tab workspace', () => {
    expect(prd).toMatch(/Multi‑Tab Workspace/i)
  })

  test('has New Tab menu items', () => {
    expect(prd).toMatch(/New Chat/i)
    expect(prd).toMatch(/Open File/i)
    expect(prd).toMatch(/New File/i)
  })

  test('has dirty marker and guard', () => {
    expect(prd).toMatch(/dirty marker|unsaved change guard/i)
  })
})

describe('PRD content — Editor Core & Types', () => {
  const prd = read(PRD_PATH)

  test('lists supported types', () => {
    expect(prd).toMatch(/txt, csv, rtf/i)
  })

  test('status bar details', () => {
    expect(prd).toMatch(/Status bar: encoding.*EOL.*line:column.*mode.*dirty/i)
  })

  test('keyboard shortcuts', () => {
    expect(prd).toMatch(/Cmd\/Ctrl\+S/i)
    expect(prd).toMatch(/Cmd\/Ctrl\+F/i)
  })

  test('autosave behavior', () => {
    expect(prd).toMatch(/Autosave: debounced/i)
  })
})

describe('PRD content — CSV and RTF modes', () => {
  const prd = read(PRD_PATH)

  test('csv grid and delimiter handling', () => {
    expect(prd).toMatch(/Grid view \(editable\).*delimiter autodetect/i)
  })

  test('rtf rich and raw with conversion and fallback', () => {
    expect(prd).toMatch(/RTF[\s\S]*Rich view[\s\S]*Raw view[\s\S]*Conversion pipeline/i)
    expect(prd).toMatch(/fallback to raw/i)
  })
})

describe('PRD content — Persistence and Conflicts', () => {
  const prd = read(PRD_PATH)

  test('versioned save and conflict dialog', () => {
    expect(prd).toMatch(/expectedVersion/i)
    expect(prd).toMatch(/409.*conflict/i)
  })

  test('local recovery', () => {
    expect(prd).toMatch(/Local recovery.*unsaved buffers/i)
  })
})

describe('PRD content — File Policies & Navigation', () => {
  const prd = read(PRD_PATH)

  test('size thresholds', () => {
    expect(prd).toMatch(/5 MB|10 MB/i)
  })

  test('encoding and EOL handling', () => {
    expect(prd).toMatch(/Encoding: default UTF/i)
    expect(prd).toMatch(/EOL: detect/i)
  })

  test('navigator integration', () => {
    expect(prd).toMatch(/Clicking a text file opens an editor tab/i)
  })
})

describe('PRD content — A11y, Telemetry, Security, Performance', () => {
  const prd = read(PRD_PATH)

  test('accessibility roles and i18n', () => {
    expect(prd).toMatch(/tablist.*tabpanel/i)
    expect(prd).toMatch(/i18n/i)
  })

  test('telemetry events', () => {
    expect(prd).toMatch(/tab_opened|editor_saved|autosave_triggered/i)
  })

  test('security notes', () => {
    expect(prd).toMatch(/path traversal|ACL/i)
  })

  test('performance targets', () => {
    expect(prd).toMatch(/<300 ms|p95 <16 ms/i)
  })
})

describe('PRD content — Architecture, APIs, QA', () => {
  const prd = read(PRD_PATH)

  test('components and stores defined', () => {
    expect(prd).toMatch(/WorkspaceTabs|FileEditorContainer|editor-store/i)
  })

  test('API contracts present', () => {
    expect(prd).toMatch(/GET `?\/api\/files\/content/i)
    expect(prd).toMatch(/POST `?\/api\/files\/upload/i)
  })

  test('milestones and QA plan', () => {
    expect(prd).toMatch(/Milestones/i)
    expect(prd).toMatch(/QA Plan/i)
  })
})



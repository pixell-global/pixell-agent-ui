import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// Renderer contract
import type { UISpecEnvelope, JsonPatchOp, RenderOptions, IntentClient, IntentResult } from './renderer.contract'
import { renderUISpec, applyPatch } from '@agent-ui/renderer'

function mount(spec: UISpecEnvelope, options?: RenderOptions) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const api = renderUISpec(container, spec, options)
  return { container, unmount: () => { api.unmount(); container.remove() } }
}

const minimalSpec = (overrides: Partial<UISpecEnvelope> = {}): UISpecEnvelope => ({
  manifest: { id: 'example.app.v1', name: 'Example', version: '1.0.0', capabilities: ['page', 'list', 'button'] },
  data: { items: [{ title: 'Hello' }] },
  actions: { open: { kind: 'open_url', url: 'https://example.com' } },
  view: {
    type: 'page',
    title: 'Items',
    children: [
      { type: 'list', props: { data: '@items', item: { type: 'text', props: { text: '{{ title }}' } } } },
      { type: 'button', props: { text: 'Open', onPress: { action: 'open' } } },
    ],
  },
  ...overrides,
})

describe('Agent UI Renderer', () => {
  test('renders page title and list items', () => {
    const spec = minimalSpec()
    const { unmount } = mount(spec)
    expect(screen.getByText('Items')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    unmount()
  })

  test('binds data via @path and {{ templates }}', () => {
    const spec = minimalSpec({ data: { items: [{ title: 'Alpha' }, { title: 'Beta' }] } })
    const { unmount } = mount(spec)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    unmount()
  })

  test('open_url action triggers onOpenUrl callback', async () => {
    const onOpenUrl = jest.fn()
    const spec = minimalSpec()
    const { unmount } = mount(spec, { onOpenUrl })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    })
    expect(onOpenUrl).toHaveBeenCalledWith('https://example.com')
    unmount()
  })

  test('http action calls onHttp with method/url/body and supports stream=false', async () => {
    const onHttp = jest.fn().mockResolvedValue({ status: 200 })
    const spec = minimalSpec({
      actions: {
        call: { kind: 'http', method: 'POST', url: 'https://api.example.com/x', body: { a: 1 } },
      },
      view: {
        type: 'page',
        children: [{ type: 'button', props: { text: 'Call', onPress: { action: 'call' } } }],
      },
    })
    const { unmount } = mount(spec, { onHttp })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Call' }))
    })
    expect(onHttp).toHaveBeenCalledWith({ method: 'POST', url: 'https://api.example.com/x', body: { a: 1 }, headers: undefined, stream: undefined })
    unmount()
  })

  test('state.set updates local UI state via operations', async () => {
    const spec: UISpecEnvelope = {
      ...minimalSpec(),
      data: { posts: [{ title: 'T', comment: '' }] },
      actions: {
        editComment: { kind: 'state.set', operations: [{ path: 'posts[0].comment', value: 'Hi' }] },
      },
      view: {
        type: 'page',
        children: [
          { type: 'text', props: { text: '{{ posts[0].comment }}' } },
          { type: 'button', props: { text: 'Edit', onPress: { action: 'editComment' } } },
        ],
      },
    }
    const { unmount } = mount(spec)
    // non-deterministic multiple empty spans: just ensure at least one empty text is rendered initially
    expect(screen.getAllByText('').length).toBeGreaterThan(0)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Edit' })))
    expect(screen.getByText('Hi')).toBeInTheDocument()
    unmount()
  })

  test('emit action invokes IntentClient.invokeIntent with params', async () => {
    const invokeIntent = jest.fn<Promise<IntentResult>, any[]>().mockResolvedValue({ status: 'ok', traceId: 't1' } as IntentResult)
    const intentClient: IntentClient = { invokeIntent }
    const spec: UISpecEnvelope = {
      ...minimalSpec(),
      actions: { emit: { kind: 'emit', event: 'changed', payload: { x: 1 } } },
      view: { type: 'page', children: [{ type: 'button', props: { text: 'Emit', onPress: { action: 'emit' } } }] },
    }
    const { unmount } = mount(spec, { intentClient })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Emit' })))
    expect(invokeIntent).toHaveBeenCalledWith('changed', { x: 1 }, expect.anything())
    unmount()
  })

  test('applies ui.patch ops to data and view', () => {
    const spec = minimalSpec({ data: { ui: { selected: [] } }, view: { type: 'page', children: [{ type: 'button', props: { text: 'Approve' } }] } })
    const ops: JsonPatchOp[] = [
      { op: 'replace', path: '/data/ui/selected', value: [1, 2, 3] },
      { op: 'add', path: '/view/children/0/props/disabled', value: true },
    ]
    const updated = applyPatch(spec, ops)
    expect((updated.data as any).ui.selected).toEqual([1, 2, 3])
    expect(((updated.view as any).children[0].props as any).disabled).toBe(true)
  })

  test('capability downgrade: table → list when table unsupported', () => {
    const tableSpec: UISpecEnvelope = {
      manifest: { id: 'ex.v1', name: 'Ex', version: '1.0.0', capabilities: ['page', 'table', 'list'] },
      data: { rows: [{ title: 'A' }] },
      actions: {},
      view: {
        type: 'page',
        title: 'Cap Downgrade',
        children: [
          {
            type: 'table',
            props: { data: '@rows', columns: [{ header: 'Title', cell: { type: 'text', props: { text: '{{ title }}' } } }] },
          },
        ],
      },
    }
    const { container, unmount } = mount(tableSpec, { capabilitySet: { components: ['page', 'list'] } })
    // Renderer should fallback internally; verify we see list content
    expect(screen.getByText('A')).toBeInTheDocument()
    unmount(); container.remove()
  })

  test('theme tokens: renderer maps tokens to CSS vars without crashing', () => {
    const spec = minimalSpec({ theme: { tokens: { 'color.primary': '#007bff', 'radius.md': 8 } } })
    const { container, unmount } = mount(spec)
    // smoke: ensure root container exists and tokens do not break rendering
    expect(container).toBeTruthy()
    unmount(); container.remove()
  })

  test('sanitizes dynamic text content (no raw HTML injection)', () => {
    const spec = minimalSpec({ data: { items: [{ title: '<img src=x onerror=alert(1) />' }] } })
    const { unmount } = mount(spec)
    const text = screen.getByText('<img src=x onerror=alert(1) />')
    expect(text).toBeInTheDocument()
    // Expect it to render as text, not as an element
    expect(text.querySelector('img')).toBeNull()
    unmount()
  })

  test('http.extended feature gates PUT/PATCH/DELETE client-side', async () => {
    const onHttp = jest.fn().mockResolvedValue({ ok: true })
    const spec = minimalSpec({
      actions: { del: { kind: 'http', method: 'DELETE', url: '/resource' } },
      view: { type: 'page', children: [{ type: 'button', props: { text: 'Delete', onPress: { action: 'del' } } }] },
    })

    // Without feature → should block (renderer may no-op or warn)
    const { unmount } = mount(spec, { onHttp, capabilitySet: { components: ['page'], features: [] } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })))
    expect(onHttp).not.toHaveBeenCalled()
    unmount()

    // With feature → allowed
    const { unmount: unmount2 } = mount(spec, { onHttp, capabilitySet: { components: ['page'], features: ['http.extended'] } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })))
    expect(onHttp).toHaveBeenCalled()
    unmount2()
  })

  test('unknown components degrade gracefully', () => {
    const spec = minimalSpec({
      view: { type: 'page', children: [{ type: 'unknown', props: { foo: 1 } } as any] },
    })
    const { unmount } = mount(spec)
    // Smoke: page renders and does not crash
    expect(document.body).toBeTruthy()
    unmount()
  })
}) 
## Dynamic UI: Handling Data Updates

This document explains how data flows and updates in the Dynamic UI renderer, how to write specs that mutate UI state, and how the host app can observe or use the updated state.

### High-level data flow

- Button press or input change triggers an action defined in the UI spec
- The renderer executes the action (state.set, http, js, etc.)
- The renderer mutates its internal `localData` based on the action
- React re-renders components bound to the mutated data
- The renderer emits `onDataChange(updatedData)` so the host (e.g. `ActivityPane`) can mirror the state (`uiData`, `dataRef.current`)

In short: the renderer is the source of truth for UI data while the view is mounted; the host mirrors it via `onDataChange`.

### Where data lives

- Renderer: `localData` (private to the renderer, drives bindings)
- Host app: `onDataChange` callback receives a cloned snapshot; `ActivityPane` stores this in `uiData` and `dataRef.current`

You can read the current value from either the UI (via bindings) or from the host mirrors:

```ts
// In ActivityPane
const current = uiData?.posts?.[rowIndex]?.comment
// or
const current = dataRef.current?.posts?.[rowIndex]?.comment
```

### Binding syntax recap

- `@path` reads from renderer state, e.g. `"data": "@posts"`
- `{{ expr }}` interpolates from scope first (row, event, result) then from state, e.g. `"text": "{{ comment }}"`

### Actions that update data

- state.set
  - Directly writes values into `localData` using dot/bracket paths
  - Example: write textarea input into a row
  ```json
  {
    "kind": "state.set",
    "operations": [
      { "path": "posts[{{ rowIndex }}].comment", "value": "{{ event.value }}" }
    ]
  }
  ```

- http
  - Calls the host-provided `onHttp` and can optionally apply the HTTP result using `result.kind === 'state.set'`
  - Example: write API-generated comment to the row
  ```json
  {
    "kind": "http",
    "method": "POST",
    "url": "https://…/gen-comment",
    "body": { "post_id": "{{ row.id }}" },
    "result": {
      "kind": "state.set",
      "operations": [
        { "path": "posts[{{ rowIndex }}].comment", "value": "@result.comment" }
      ]
    }
  }
  ```

- js
  - Runs custom code with a small context: `{ data, setData, scope, http, openUrl }`
  - Prefer `state.set`/`http.result` when possible; use `js` sparingly

### HTTP result shapes and normalization

- Recommended: return a JSON object with the fields you need (e.g., `{ "comment": "..." }`) and reference it with `@result.comment`
- Supported automatically: if the HTTP result is a primitive value (e.g., a plain string), the renderer will wrap it as
  `{ value: result, text: result, comment: result, data: result }`
  so selectors like `@result.comment` or `@result.text` resolve without changing the spec or server.

This means both of the following work:

```json
// Server returns { "comment": "..." }
"value": "@result.comment"

// Server returns "..." (string)
"value": "@result.comment"   // now resolves via normalization
```

### Preventing unnecessary remounts

- The host mounts the renderer once per structural spec
- Remount triggers only when one of these changes: `view`, `actions`, `manifest`, `theme`
- Data-only changes do not remount; they re-render in place
- Keep the `uiSpec` object identity stable unless structure actually changes

### Debugging checklist

- Network: confirm the HTTP response payload is what your spec expects
- Console: with renderer `debug: true`, look for logs:
  - `wire action …` when an action is connected
  - `http.result applied` followed by the next state
- Verify your mapping path and value:
  - Path: e.g., `posts[{{ rowIndex }}].comment`
  - Value: `@result.comment`, `@result.data.comment`, or `{{ event.value }}` depending on context
- Verify bindings on components are correct (e.g., textarea uses `text: "{{ comment }}"`)

### Common pitfalls

- The HTTP result isn’t written to state
  - Ensure your `http.result` block exists and uses `state.set`
  - Ensure the value selector matches the response shape

- The renderer keeps remounting
  - Ensure the host isn’t replacing `uiSpec` identity on each data change
  - Only change `uiSpec.view/actions/manifest/theme` when structure actually changes

- You need the updated data outside the UI
  - Consume it from the host’s mirror (`uiData` or `dataRef.current`) provided by `onDataChange`

### Example: Reddit comment generation

- Textarea shows the current comment via `text: "{{ comment }}"`
- Generate button triggers `genComment` (http)
- HTTP result is mapped to `posts[{{ rowIndex }}].comment`
- Renderer updates `localData`, re-renders textarea, and emits `onDataChange`
- Host can read the value at `uiData.posts[rowIndex].comment`

### Security note on `js` actions

- `js` uses dynamic evaluation; ensure content is trusted or constrain which actions are allowed
- Prefer declarative `state.set` and `http.result` over arbitrary JS when possible

---

If your UI isn’t updating, 90% of the time the cause is a mismatch between the HTTP response shape and the `value` selector in `result.operations`. Fix the selector or the server shape, and the renderer will take care of re-rendering and mirroring the state for you.



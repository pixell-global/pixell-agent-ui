# Dynamic UI PRD (feat/dynamic-ui)

## 1) Overview
**Feature name**: Pixell Dynamic UI  
**Purpose**: Enable the Pixell frontend to translate agent-provided **UI Specs** (declarative JSON) into fully rendered, stylish, modern web interfaces without agents sending HTML/CSS/JS.  

Dynamic UI is the **renderer** that:
- Reads a validated `UISpec` from the agent.
- Maps semantic component definitions to React components in a **component registry**.
- Applies **Pixell design tokens** for a unified, modern look.
- Supports incremental updates via `ui.patch`.

This feature is the *visual execution* of the Agent UI PRD.

---

## 2) Problem Statement
Without Dynamic UI:
- Rendering is inconsistent across agents.
- Styling must be hardcoded by each developer.
- Incremental updates (patches) require manual DOM handling.
- UI rendering is tightly coupled to agent-specific HTML → unsafe, non-portable.

---

## 3) Goals
- Render *any* valid `UISpec` from an agent into a modern, responsive, accessible UI.
- Centralize **component styling and interaction wiring** in the Pixell frontend.
- Ensure **safe rendering** (no inline scripts, no unsanitized HTML).
- Allow agents to update UI dynamically via JSON Patch.
- Provide **theme tokens** for color, typography, spacing, radius.

---

## 4) Visual & Style Requirements
- **Fonts**:
  - Headings: `Poppins`, fallback: `Segoe UI`, `Helvetica Neue`, `sans-serif`
  - Body: `Inter`, fallback: `Roboto`, `system-ui`, `sans-serif`
- **Colors**:
  - Primary text: `#1E1E1E`
  - Accent: Lime `#EEFC7C` for CTAs & highlights
  - Gradient: Red→Pink→Yellow (`linear-gradient(90deg, #FF4D4D, #FF66B2, #FFF27A)`)
- **Layout**:
  - Minimal, generous whitespace
  - Section blocks (Gamma-style) with visual separation
  - Rounded corners (`radius.md`: 12px, `radius.sm`: 6px)
- **Hero Visual**:
  - ASCII IA diagram for brand moments (optional, for large sections)

---

## 5) Architecture
```
Agent (server)
   ↓  ui.render / ui.patch
Pixell Orchestrator
   ↓  WebSocket / HTTP
Pixell Frontend (Next.js)
   ↓
Dynamic UI Renderer
  - Manifest Validator
  - Component Registry
  - Prop/Data Resolver
  - Action Wiring
  - Theme Engine
  - Layout Engine
React Components
   ↓
HTML / CSS / JS
```

---

## 6) Component Registry
Map `UISpec.view.children[].type` → React component.

Example:
```ts
export const REGISTRY = {
  page: Page,
  container: Container,
  text: TextBlock,
  image: ImageBlock,
  link: LinkButton,
  button: PrimaryButton,
  switch: ToggleSwitch,
  textarea: TextArea,
  textfield: TextField,
  radio: RadioGroup,
  checkbox: CheckboxGroup,
  select: SelectBox,
  list: ListView,
  table: DataTable,
  modal: ModalSheet,
  form: FormBlock,
  unknown: UnknownBlock
};
```
- Components use Pixell theme tokens for consistent style.

---

## 7) Rendering Flow
1. **Validate Spec**  
   - Validate `manifest`, `data`, `view`, `actions` against JSON Schema (from `agent_ui`).
2. **Resolve Props**  
   - Replace `@data.path` bindings with live data.
   - Evaluate `{{ template }}` placeholders (safe subset).
3. **Layout Engine**  
   - Apply `container` layout hints (`stack`, `row`, `grid`).
4. **Render Components**  
   - Map spec type to React component.
   - Pass resolved props and wired actions.
5. **Wire Actions**  
   - `open_url` → `window.open`
   - `http` / `invoke_intent` → `IntentClient`
   - `state.set` → Local UI state mutation
6. **Apply Theme**  
   - Map `theme.tokens` to CSS variables.
7. **Patch Updates**  
   - Apply JSON Patch to `data` and `view` state → re-render affected blocks.

---

## 8) Styling Guidelines
- **Buttons**: Rounded, gradient border or fill, hover shadow, accent lime for CTAs.
- **Tables**: Striped rows, hover highlight, compact padding.
- **Cards**: Rounded, soft shadow, whitespace around content.
- **Typography**:  
  - Heading 1: `Poppins` 2rem bold
  - Heading 2: `Poppins` 1.5rem semibold
  - Body: `Inter` 1rem regular
- **Spacing**: 8px grid (4/8/16/24/32px margins/padding).

---

## 9) Example Rendering
UISpec (agent):
```json
{
  "view": {
    "type": "page",
    "title": "Reddit Posts",
    "children": [
      { "type": "table", "props": { "data": "@posts", "columns": [
        { "header": "Title", "cell": { "type": "text", "props": { "text": "{{ title }}" } } }
      ] } },
      { "type": "button", "props": { "text": "Approve", "onPress": { "action": "approve" } } }
    ]
  },
  "data": { "posts": [{ "title": "Hello" }] }
}
```

Frontend renders:
- Full-width page, white background, Poppins heading.
- Modern table with hover effects.
- Lime-accented “Approve” button.

---

## 10) Security & Performance
- No HTML from agents is directly inserted.
- All dynamic text is sanitized.
- Component set is finite; unknown → fallback.
- Initial payload ≤ 500KB, patch updates for large datasets.

---

## 11) Acceptance Criteria
- Any valid UISpec renders without error.
- Styling matches design tokens (fonts, colors, radius, spacing).
- Actions trigger correct client or server behavior.
- UI updates on `ui.patch` without full reload.
- Unknown components degrade gracefully.

---

## 12) Open Questions
- Should table/list components support server-driven pagination?
- How to handle responsive layout hints from agents?

---

## 13) Implementation Steps
1. Implement **component registry** in `apps/web/components/agent-ui/registry.tsx`.
2. Implement **prop resolver** for `@data` and `{{ }}` templates.
3. Implement **action wiring** to `IntentClient`.
4. Implement **theme engine** with CSS variables from `theme.tokens`.
5. Build base components with Pixell style guide.
6. Integrate JSON Patch handler for incremental updates.
7. Add storybook stories for each component type.
8. Add Jest/Playwright tests for rendering & action wiring.

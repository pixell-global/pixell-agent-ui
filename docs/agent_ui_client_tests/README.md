### Agent UI Client Tests (for Next.js)

This folder contains Jest + React Testing Library tests that define the expected behavior of a React/Next.js **Dynamic UI renderer** for Pixell Agent UI specs.

How to use in your frontend repo:

1) Install deps
```bash
npm i -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest typescript
```

2) Configure Jest (jest.config.ts)
```ts
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@agent-ui/renderer$': '<rootDir>/apps/web/components/agent-ui/renderer',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
}
export default config
```

3) Add setup file (jest.setup.ts)
```ts
import '@testing-library/jest-dom'
```

4) Ensure your renderer exports the contract in `renderer.contract.d.ts`:
- `renderUISpec(container, spec, options?)`
- `applyPatch(spec, ops)`
- `IntentClient` interface (optional) with `invokeIntent` and `invokeIntentStream` per PRD

5) Copy tests into your repo and run
```bash
npm test
```

If tests fail, implement/adjust your renderer to satisfy the behaviors defined here. 
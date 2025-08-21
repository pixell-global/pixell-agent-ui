import type { Config } from 'jest'

const config: Config = {
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	moduleNameMapper: {
		'^@agent-ui/renderer$': '<rootDir>/apps/web/components/agent-ui/renderer',
		'\\.(css|less|sass|scss)$': 'identity-obj-proxy',
	},
	transform: {
		'^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true, diagnostics: false }],
	},
	roots: ['<rootDir>/docs/agent_ui_client_tests'],
}
export default config 
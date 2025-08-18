type TokenRecord = Record<string, unknown>

function toCssVarName(tokenKey: string): string {
	return `--paf-${tokenKey.replace(/\./g, '-')}`
}

function toCssValue(key: string, value: unknown): string {
	if (typeof value === 'number') {
		if (key.includes('radius')) return `${value}px`
		return String(value)
	}
	return String(value)
}

export function applyThemeTokens(container: HTMLElement, tokens?: TokenRecord): void {
	if (!tokens) return
	for (const [k, v] of Object.entries(tokens)) {
		try {
			container.style.setProperty(toCssVarName(k), toCssValue(k, v))
		} catch {
			// no-op
		}
	}
} 
export function getByPath(obj: any, path: string): any {
	// Supports dot and bracket notation: a.b[0].c
	const segments: (string | number)[] = []
	path.split('.').forEach((part) => {
		const re = /([^\[]+)|(\[(\d+)\])/g
		let m: RegExpExecArray | null
		while ((m = re.exec(part))) {
			if (m[1]) segments.push(m[1])
			if (m[3]) segments.push(Number(m[3]))
		}
	})
	let cur = obj
	for (const seg of segments) {
		if (cur == null) return undefined
		cur = cur[seg as any]
	}
	return cur
}

export function isArray(value: any): value is any[] {
	return Array.isArray(value)
} 
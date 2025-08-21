export type Delimiter = ',' | '\t' | ';'

export function stripBom(text: string): string {
  if (!text) return text
  // UTF-8 BOM \uFEFF, UTF-16LE BOM handled at read edge; keep simple here
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let inQuotes = false
  const src = stripBom(text)
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    const next = src[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue }
      if (ch === '"') { inQuotes = false; continue }
      cell += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === delimiter) { cur.push(cell); cell = ''; continue }
    if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; continue }
    if (ch === '\r') { continue }
    cell += ch
  }
  // push last cell/row if missing trailing newline
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell)
    rows.push(cur)
  }
  return rows
}

export function sniffDelimiter(text: string): Delimiter {
  const candidates: Delimiter[] = [',', '\t', ';']
  const lines = stripBom(text).split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 10)
  let best: Delimiter = ','
  let bestScore = -1
  for (const cand of candidates) {
    let cols = -1
    let consistent = true
    for (const ln of lines) {
      const parsed = parseCsv(ln + '\n', cand)[0] || []
      if (cols === -1) cols = parsed.length
      else if (parsed.length !== cols) { consistent = false; break }
    }
    // Prefer delimiters that yield >1 columns and consistent columns
    if (consistent && cols > bestScore && cols > 1) {
      bestScore = cols
      best = cand
    }
  }
  return best
}



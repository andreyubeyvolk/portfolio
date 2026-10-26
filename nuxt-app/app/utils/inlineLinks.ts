export interface InlinePart { text: string, to?: string }

// Splits project copy into plain-text and internal-link parts. Link syntax
// in content/*.md: [label](/inhouse/greenflag)--site paths only (must start
// with "/"), so a typo can never turn a sentence into an external link.
export function parseInlineLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push({ text: m[1]!, to: m[2]! })
    last = start + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

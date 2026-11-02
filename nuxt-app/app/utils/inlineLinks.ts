export interface InlinePart { text: string, to?: string, href?: string }

// Splits project copy into plain-text and link parts. Link syntax in
// content/*.md: [label](/inhouse/greenflag) for site paths (must start with
// "/"), or [label](https://...) for an explicit external link.
export function parseInlineLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  const re = /\[([^\]]+)\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push(m[2]!.startsWith('/') ? { text: m[1]!, to: m[2]! } : { text: m[1]!, href: m[2]! })
    last = start + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

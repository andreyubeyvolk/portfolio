// Splits an archive title into its base text and an optional trailing
// bracket badge ("Longread[0001]" -> "Longread" + "[0001]", "Transportation[1/8]"
// -> "Transportation" + "[1/8]"), rendered as a small gray <sup> on the
// static site (see .archive-num, renderTitleInto in archive/index.html).
// A title with no bracket tail (e.g. "Tantra") has no badge.
export function splitArchiveTitle(title: string): { base: string, badge?: string } {
  const match = /^(.*?)(\[[^\]]+\])$/.exec(title)
  if (!match) return { base: title }
  return { base: match[1]!, badge: match[2] }
}

// A description can carry one inline "[LINK]" token (see renderDescriptionInto
// in the static site's archive/index.html)--rendered as a real <a> in the
// same small gray superscript style as the title's bracket badge. No `link`,
// or no "[LINK]" token in the text, and this just returns the plain text.
export function splitArchiveDescription(description: string, link?: string): { before: string, linkText: string, after: string } | null {
  if (!link) return null
  const idx = description.indexOf('[LINK]')
  if (idx === -1) return null
  return {
    before: description.slice(0, idx),
    linkText: '[LINK]',
    after: description.slice(idx + '[LINK]'.length),
  }
}

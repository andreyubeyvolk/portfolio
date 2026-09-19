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

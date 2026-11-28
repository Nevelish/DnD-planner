/** A plain-text teaser of a markdown recap for notifications and Discord:
 * drops markdown syntax, keeps link text, and cuts at a word boundary. */
export function recapExcerpt(markdown: string, max = 200): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[\[([^\]|\n]*)\|([^\]\n]*)\]\]/g, "$2") // [[Page|label]] → label
    .replace(/\[\[([^\]\n]*)\]\]/g, "$1") // [[Page]] → Page
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, list markers
    .replace(/^\[[ xX]\]\s+/gm, "") // checkboxes
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

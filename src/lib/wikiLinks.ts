/**
 * [[Page title]] links between DM notebook pages, Obsidian-style:
 * `[[Baron Vex]]`, or `[[Baron Vex|the baron]]` to show different text.
 * Titles match ignoring case and repeated spaces. Text inside code blocks
 * and `inline code` is left alone.
 */
const WIKI_LINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g;

/** Prefix for the in-document href a wiki link is turned into. */
export const WIKI_HREF_PREFIX = "#wiki:";

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Applies `fn` to every stretch of markdown that isn't code. */
function mapOutsideCode(markdown: string, fn: (text: string) => string): string {
  let fence: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1][0];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker === fence) fence = null;
        return line;
      }
      if (fence) return line;
      // Odd-numbered parts are `inline code` spans.
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, i) => (i % 2 ? part : fn(part)))
        .join("");
    })
    .join("\n");
}

function escapeLinkText(text: string): string {
  return text.replace(/[\\[\]]/g, (c) => `\\${c}`);
}

/** Rewrites wiki links as ordinary markdown links to `#wiki:<title>`, so
 * the markdown renderer can hand them to a component that resolves them. */
export function linkifyWikiLinks(markdown: string): string {
  return mapOutsideCode(markdown, (text) =>
    text.replace(WIKI_LINK, (_match, target: string, label?: string) => {
      const href = encodeURIComponent(target.trim()).replace(/\(/g, "%28").replace(/\)/g, "%29");
      return `[${escapeLinkText((label ?? target).trim())}](${WIKI_HREF_PREFIX}${href})`;
    }),
  );
}

/** The page title a `#wiki:` href points at, or null for ordinary links. */
export function wikiTargetFromHref(href: string | undefined): string | null {
  if (!href?.startsWith(WIKI_HREF_PREFIX)) return null;
  try {
    return decodeURIComponent(href.slice(WIKI_HREF_PREFIX.length));
  } catch {
    return null;
  }
}

/** Every page title this markdown links to, normalised. */
export function wikiLinkTargets(markdown: string): Set<string> {
  const targets = new Set<string>();
  mapOutsideCode(markdown, (text) => {
    for (const m of text.matchAll(WIKI_LINK)) targets.add(normalizeTitle(m[1]));
    return text;
  });
  return targets;
}

/** Points links at a renamed page's new title, keeping any custom text. */
export function renameWikiLinks(markdown: string, oldTitle: string, newTitle: string): string {
  const old = normalizeTitle(oldTitle);
  return mapOutsideCode(markdown, (text) =>
    text.replace(WIKI_LINK, (match, target: string, label?: string) =>
      normalizeTitle(target) === old ? `[[${newTitle}${label ? `|${label}` : ""}]]` : match,
    ),
  );
}

/** While typing: the partial title after an unclosed `[[` right before the
 * caret, or null if the caret isn't inside one. */
export function openWikiLinkQuery(textBeforeCaret: string): string | null {
  return textBeforeCaret.match(/\[\[([^[\]|\n]*)$/)?.[1] ?? null;
}

const blank = (s: string) => " ".repeat(s.length);

/** The markdown with everything that isn't plain prose (code, existing
 * [[links]], [markdown](links) and bare URLs) blanked out, keeping every
 * character's position so matches map back onto the original. */
function maskNonProse(markdown: string): string {
  let fence: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1][0];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker === fence) fence = null;
        return blank(line);
      }
      if (fence) return blank(line);
      return line
        .replace(/`+[^`]*`+/g, blank)
        .replace(/\[\[[^\]\n]*\]\]/g, blank)
        .replace(/!?\[[^\]\n]*\]\([^)\n]*\)/g, blank)
        .replace(/https?:\/\/\S+/g, blank);
    })
    .join("\n");
}

export type Mention = {
  /** The page title that was found. */
  title: string;
  /** Where it was found, and the text as written there. */
  index: number;
  length: number;
  text: string;
};

/** The first plain-text (not yet linked) mention of each title: whole
 * words only, ignoring case, never inside code, links or URLs. Where
 * mentions overlap ("Vex" inside "Baron Vex") the longer one wins.
 * Very short titles (under 3 characters) are skipped as too noisy. */
export function findUnlinkedMentions(markdown: string, titles: string[]): Mention[] {
  const masked = maskNonProse(markdown);
  const found: Mention[] = [];
  for (const title of new Set(titles.map((t) => t.trim()))) {
    if (title.length < 3) continue;
    const words = title.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${words.join("[^\\S\\n]+")}(?![\\p{L}\\p{N}_])`, "iu");
    const m = re.exec(masked);
    if (m) {
      found.push({ title, index: m.index, length: m[0].length, text: markdown.slice(m.index, m.index + m[0].length) });
    }
  }
  const kept: Mention[] = [];
  for (const m of found.sort((a, b) => b.length - a.length)) {
    if (!kept.some((k) => m.index < k.index + k.length && k.index < m.index + m.length)) kept.push(m);
  }
  return kept.sort((a, b) => a.index - b.index);
}

/** Wraps one mention in [[ ]], keeping the text exactly as written. */
export function linkMention(markdown: string, mention: Pick<Mention, "index" | "length">): string {
  const { index, length } = mention;
  return `${markdown.slice(0, index)}[[${markdown.slice(index, index + length)}]]${markdown.slice(index + length)}`;
}

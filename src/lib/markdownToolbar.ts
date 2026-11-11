export type MarkdownAction =
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "h1"
  | "h2"
  | "h3"
  | "bulletList"
  | "numberList"
  | "quote";

type Selection = { value: string; start: number; end: number };
type Result = { value: string; start: number; end: number };

function wrapSelection(sel: Selection, prefix: string, suffix: string = prefix): Result {
  const { value, start, end } = sel;
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);

  if (selected.length === 0) {
    const caret = start + prefix.length;
    return { value: next, start: caret, end: caret };
  }
  return {
    value: next,
    start: start + prefix.length,
    end: start + prefix.length + selected.length,
  };
}

function prefixLines(sel: Selection, prefix: string | ((lineIndex: number) => string)): Result {
  const { value, start, end } = sel;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const prefixed = lines
    .map((line, i) => (typeof prefix === "function" ? prefix(i) : prefix) + line)
    .join("\n");

  const firstPrefixLength = (typeof prefix === "function" ? prefix(0) : prefix).length;
  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);

  return {
    value: next,
    start: start + firstPrefixLength,
    end: end + (prefixed.length - block.length),
  };
}

export function applyMarkdownAction(action: MarkdownAction, sel: Selection): Result {
  switch (action) {
    case "bold":
      return wrapSelection(sel, "**");
    case "italic":
      return wrapSelection(sel, "*");
    case "code":
      return wrapSelection(sel, "`");
    case "link": {
      const { value, start, end } = sel;
      const selected = value.slice(start, end);
      const inserted = selected ? `[${selected}](url)` : "[text](url)";
      const next = value.slice(0, start) + inserted + value.slice(end);
      const urlStart = start + inserted.lastIndexOf("url");
      return { value: next, start: urlStart, end: urlStart + 3 };
    }
    case "h1":
      return prefixLines(sel, "# ");
    case "h2":
      return prefixLines(sel, "## ");
    case "h3":
      return prefixLines(sel, "### ");
    case "quote":
      return prefixLines(sel, "> ");
    case "bulletList":
      return prefixLines(sel, "- ");
    case "numberList":
      return prefixLines(sel, (i) => `${i + 1}. `);
  }
}

// Checklists in markdown ("- [ ] Find the key"). Shared by the notebook's
// readable view, where the boxes can be clicked, and its editor.

// A task list item's start: optional blockquote markers and indentation,
// the bullet or number, then the box.
const TASK_ITEM = /^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\[)([ xX])(\])/;

/**
 * Ticks or unticks the checklist item that starts on `line` (1-based, as in
 * the markdown parser's positions). Returns the new text, or null if that
 * line isn't a checklist item.
 */
export function toggleTaskAtLine(markdown: string, line: number): string | null {
  const lines = markdown.split("\n");
  const text = lines[line - 1];
  if (text === undefined) return null;
  const match = TASK_ITEM.exec(text);
  if (!match) return null;
  const ticked = match[2] !== " ";
  lines[line - 1] = `${match[1]}${ticked ? " " : "x"}${match[3]}${text.slice(match[0].length)}`;
  return lines.join("\n");
}

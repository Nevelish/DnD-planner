// Styles that affect where text wraps inside a textarea.
const COPIED = [
  "box-sizing",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-style",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-style",
  "font-variant",
  "font-weight",
  "font-stretch",
  "font-size",
  "line-height",
  "font-family",
  "text-align",
  "text-transform",
  "text-indent",
  "letter-spacing",
  "word-spacing",
  "tab-size",
] as const;

/**
 * Where the caret at `position` sits inside a textarea, in pixels from the
 * textarea's top-left (ignoring its scroll). Works by laying the same text
 * out in an invisible copy of the textarea and measuring a marker placed
 * at the caret.
 */
export function caretCoordinates(textarea: HTMLTextAreaElement, position: number) {
  const computed = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const prop of COPIED) mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    // clientWidth leaves out the scrollbar, which also narrows the text.
    width: `${textarea.clientWidth + parseFloat(computed.borderLeftWidth) + parseFloat(computed.borderRightWidth)}px`,
  });
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4;
  const coords = { top: marker.offsetTop, left: marker.offsetLeft, lineHeight };
  mirror.remove();
  return coords;
}

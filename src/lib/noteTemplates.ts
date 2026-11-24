/** Starting shapes for a new DM page: a short markdown skeleton to fill in. */
export const NOTE_TEMPLATES = {
  blank: { label: "Blank page", content: "" },
  npc: {
    label: "NPC",
    content: `- **Role:** \n- **Appearance:** \n- **Voice & mannerisms:** \n\n## Wants\n\n## Secrets\n\n## Relationships\n\n## Notes\n`,
  },
  location: {
    label: "Location",
    content: `- **Type:** \n- **Where:** \n\n## First impression\nWhat the party sees, hears and smells when they arrive.\n\n## Who's here\n\n## Secrets\n\n## Hooks\n`,
  },
  sessionPrep: {
    label: "Session prep",
    // The eight steps from "Return of the Lazy Dungeon Master".
    content: `## Review the characters\n\n## Strong start\n\n## Potential scenes\n- \n\n## Secrets & clues\n- \n\n## Fantastic locations\n\n## Important NPCs\n\n## Relevant monsters\n\n## Rewards\n`,
  },
} as const;

export type NoteTemplateKey = keyof typeof NOTE_TEMPLATES;

export function isNoteTemplateKey(value: unknown): value is NoteTemplateKey {
  return typeof value === "string" && Object.hasOwn(NOTE_TEMPLATES, value);
}

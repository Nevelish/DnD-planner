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
  sessionNotes: {
    label: "Session notes",
    // A player's notes from the table, for their own notebook.
    content: `## What happened\n\n## People we met\n- \n\n## Loot & rewards\n- \n\n## Quests & leads\n- \n\n## Questions for next time\n- \n`,
  },
} as const;

export type NoteTemplateKey = keyof typeof NOTE_TEMPLATES;

/** Which templates each notebook offers: the DM plans sessions, players
 * write down what happened in them. */
export function templatesFor(kind: "dm" | "player") {
  return kind === "dm"
    ? (["blank", "npc", "location", "sessionPrep"] as const)
    : (["blank", "npc", "location", "sessionNotes"] as const);
}

/** The Session Zero topics the DM can answer for their table. Stored as
 * { [key]: answer } in Campaign.sessionZero, so questions can be added or
 * reworded later without a migration (an unknown key is just ignored). */
export const SESSION_ZERO_QUESTIONS = [
  {
    key: "tone",
    label: "Tone & themes",
    hint: "Heroic, grim, comedic, horror? What kind of story are we telling?",
  },
  {
    key: "intensity",
    label: "How graphic it gets",
    hint: "Violence, gore, horror: described in detail, or kept vague?",
  },
  {
    key: "death",
    label: "Character death",
    hint: "Can characters die? Resurrection, new character, or something else?",
  },
  {
    key: "pvp",
    label: "Conflict between players",
    hint: "In-character arguments, stealing from each other, attacking each other?",
  },
  {
    key: "romance",
    label: "Romance",
    hint: "Off the table, fade to black, or part of the story?",
  },
  {
    key: "absences",
    label: "Missed sessions",
    hint: "What happens to a character when their player can't make it?",
  },
  {
    key: "table",
    label: "Table rules",
    hint: "Phones, food, breaks, being on time, rules arguments mid-game…",
  },
  {
    key: "pausing",
    label: "Stopping a scene",
    hint: "How anyone can pause or skip something that isn't OK, e.g. an X-card, or just saying \"let's skip this\". No explanation needed.",
  },
] as const;

export type SessionZeroAnswers = Partial<Record<(typeof SESSION_ZERO_QUESTIONS)[number]["key"], string>>;

/** Reads the stored JSON defensively — only known keys with string values. */
export function parseSessionZero(value: unknown): SessionZeroAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: SessionZeroAnswers = {};
  for (const { key } of SESSION_ZERO_QUESTIONS) {
    const answer = (value as Record<string, unknown>)[key];
    if (typeof answer === "string" && answer.trim()) answers[key] = answer;
  }
  return answers;
}

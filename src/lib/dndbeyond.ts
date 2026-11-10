import "server-only";

// D&D Beyond has no official public API. This talks to the same
// undocumented endpoint public character sheets use in the browser. It is
// explicitly best-effort: it can break if D&D Beyond changes this service,
// and callers must always fall back to the manually-entered roster fields.
const CHARACTER_SERVICE_URL =
  "https://character-service.dndbeyond.com/character/v5/character/";

const CHARACTER_URL_PATTERN = /dndbeyond\.com\/characters\/(\d+)/i;

export function parseCharacterId(url: string): string | null {
  const match = url.match(CHARACTER_URL_PATTERN);
  return match ? match[1] : null;
}

type DndBeyondClass = {
  level?: number;
  definition?: { name?: string };
};

type DndBeyondCharacterData = {
  name?: string;
  race?: { fullName?: string; baseRaceName?: string };
  classes?: DndBeyondClass[];
};

export type DndBeyondFetchResult =
  | {
      status: "SUCCESS";
      snapshot: unknown;
      name?: string;
      race?: string;
      level?: number;
      className?: string;
    }
  | { status: "PRIVATE" | "FAILED" };

export async function fetchDndBeyondCharacter(
  characterId: string,
): Promise<DndBeyondFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${CHARACTER_SERVICE_URL}${characterId}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (res.status === 403 || res.status === 404) {
      return { status: "PRIVATE" };
    }
    if (!res.ok) {
      return { status: "FAILED" };
    }

    const json: { data?: DndBeyondCharacterData } = await res.json();
    const data = json?.data;
    if (!data) return { status: "FAILED" };

    const classes = Array.isArray(data.classes) ? data.classes : [];
    const level = classes.reduce((sum, c) => sum + (c.level ?? 0), 0);
    const className = classes
      .map((c) => c.definition?.name)
      .filter(Boolean)
      .join(" / ");

    return {
      status: "SUCCESS",
      snapshot: data,
      name: data.name,
      race: data.race?.fullName ?? data.race?.baseRaceName,
      level: level || undefined,
      className: className || undefined,
    };
  } catch {
    return { status: "FAILED" };
  } finally {
    clearTimeout(timeout);
  }
}

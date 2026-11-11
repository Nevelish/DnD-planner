"use client";

export const SKINS = ["default", "nier"] as const;
export type Skin = (typeof SKINS)[number];
export const DEFAULT_SKIN: Skin = "default";

const STORAGE_KEY = "dnd-planner-skin";

function isSkin(value: unknown): value is Skin {
  return typeof value === "string" && (SKINS as readonly string[]).includes(value);
}

// Safe for SSR: never touches localStorage at module scope. The real value
// is only ever read client-side, inside getClientSnapshot (invoked by
// useSyncExternalStore), never during server rendering.
let current: Skin = DEFAULT_SKIN;
const listeners = new Set<() => void>();

export function getSkin(): Skin {
  return current;
}

export function getClientSnapshot(): Skin {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    current = isSkin(stored) ? stored : DEFAULT_SKIN;
  } catch {
    current = DEFAULT_SKIN;
  }
  return current;
}

export function setSkin(skin: Skin) {
  current = skin;
  if (skin === DEFAULT_SKIN) {
    delete document.documentElement.dataset.skin;
  } else {
    document.documentElement.dataset.skin = skin;
  }
  try {
    localStorage.setItem(STORAGE_KEY, skin);
  } catch {
    // storage unavailable (private browsing, etc.) — skin just won't persist
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

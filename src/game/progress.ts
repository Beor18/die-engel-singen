import { DEFAULT_AUDIO, type AudioSettings } from "./audio";

/**
 * Saved progress, kept in this browser only. Reading or writing storage can
 * fail (private mode, blocked site data), so the game always works without it.
 */

export type Progress = {
  /** Ids of the rescued pages. */
  done: string[];
  seenPrologue: boolean;
  /** Whether the player already went through the first, guided battle. */
  rehearsed: boolean;
  /** The kinds of shadow whose way of singing was already explained. */
  heard: string[];
  audio: AudioSettings;
};

const KEY = "die-engel-singen:la-voz";
const EMPTY: Progress = { done: [], seenPrologue: false, rehearsed: false, heard: [], audio: DEFAULT_AUDIO };

let cache: Progress | null = null;
const listeners = new Set<() => void>();

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      done: Array.isArray(parsed.done) ? parsed.done.filter((d) => typeof d === "string") : [],
      seenPrologue: Boolean(parsed.seenPrologue),
      rehearsed: Boolean(parsed.rehearsed),
      heard: Array.isArray(parsed.heard) ? parsed.heard.filter((h) => typeof h === "string") : [],
      audio: { ...DEFAULT_AUDIO, ...(parsed.audio ?? {}) },
    };
  } catch {
    return EMPTY;
  }
}

export function getProgress(): Progress {
  if (!cache) cache = read();
  return cache;
}

export function getServerProgress(): Progress {
  return EMPTY;
}

export function subscribeProgress(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateProgress(change: (current: Progress) => Progress) {
  cache = change(getProgress());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage is unavailable: progress lasts until the tab closes.
  }
  for (const l of listeners) l();
}

export function markDone(id: string) {
  updateProgress((p) => (p.done.includes(id) ? p : { ...p, done: [...p.done, id] }));
}

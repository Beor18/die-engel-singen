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
  /** Ids of the keepsakes found, in the order they were found. They are never lost. */
  keepsakes: string[];
  /** Ids of the keepsakes the Voice carries now: only these give their gift. */
  carrying: string[];
  /** Everything the Voice has earned: its rank comes from this number. */
  voice: number;
  /** Ids of the pages rescued without the light ever going out. */
  clean: string[];
  /** How many times the verse thief was caught. */
  thief: number;
};

const KEY = "die-engel-singen:la-voz";
/** What a page rescued before the voice was counted is worth. */
const VOICE_PER_OLD_PAGE = 100;
const EMPTY: Progress = {
  done: [],
  seenPrologue: false,
  rehearsed: false,
  heard: [],
  audio: DEFAULT_AUDIO,
  keepsakes: [],
  carrying: [],
  voice: 0,
  clean: [],
  thief: 0,
};

let cache: Progress | null = null;
const listeners = new Set<() => void>();

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const done = strings(parsed.done);
    const keepsakes = strings(parsed.keepsakes);
    return {
      done,
      seenPrologue: Boolean(parsed.seenPrologue),
      rehearsed: Boolean(parsed.rehearsed),
      heard: strings(parsed.heard),
      audio: { ...DEFAULT_AUDIO, ...(parsed.audio ?? {}) },
      keepsakes,
      carrying: strings(parsed.carrying).filter((id) => keepsakes.includes(id)),
      // Someone who played before the voice was counted keeps what those pages gave.
      voice: typeof parsed.voice === "number" && parsed.voice >= 0 ? Math.floor(parsed.voice) : done.length * VOICE_PER_OLD_PAGE,
      clean: strings(parsed.clean),
      thief: typeof parsed.thief === "number" && parsed.thief > 0 ? Math.floor(parsed.thief) : 0,
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

import type { Clima, Escena } from "@/contenido";

/**
 * What the game needs from each page of the book. It is built from
 * `src/contenido/libro.ts` alone: a new page is a new level, nothing to touch here.
 */
export type LevelSource = {
  id: string;
  /** Position of the level, starting at 1. */
  number: number;
  name: string;
  indexName: string;
  route: string;
  image: string;
  alt: string;
  stanzas: string[][];
  meaning: string[];
  tone: string;
  weather: Clima;
  /** The people and things of the painting, placed inside the level. */
  scene?: Escena;
};

export type Dir = "up" | "down" | "left" | "right";
export type Point = { x: number; y: number };
export type Speaker = "angel" | "voice" | "shadow" | "guardian" | "narrator" | "verse" | "figure";

export type DialogueUI = {
  speaker: Speaker;
  name: string;
  text: string;
  /** How many characters are shown, for the typewriter effect. */
  visible: number;
  complete: boolean;
  /** The meaning with hidden letters, while verses are missing. */
  veiled?: boolean;
  /** For people of the painting: their image, shown as the portrait. */
  portrait?: string;
};

export type BattleUI = {
  name: string;
  guardian: boolean;
  health: number;
  maxHealth: number;
  /** "rest" between phrases, while the shadow speaks; "call" while its notes come. */
  phase: "intro" | "rest" | "call" | "end";
  text: string;
  hint: string;
  /** The text is a verse of the poem. */
  verse: boolean;
  canFlee: boolean;
};

/** What a page gave the voice, row by row. */
export type TallyUI = {
  rows: { label: string; amount: number }[];
  total: number;
  /** The rank reached in this page, if the voice grew. */
  grewTo: string | null;
};

export type RevealUI = {
  title: string;
  meaning: string[];
  route: string;
  last: boolean;
  tally: TallyUI;
};

/** A keepsake just found, shown until the player goes on. */
export type FoundUI = {
  image: string;
  name: string;
  line: string;
  /** What it does while it is carried. */
  gift: string;
  /** Whether there was room to carry it right away. */
  carried: boolean;
  /** The voice it gave. */
  voice: number;
  /** How many keepsakes the chest holds now, out of how many there are. */
  count: number;
  total: number;
};

export type VoiceUI = {
  rank: string;
  index: number;
  /** Voice earned inside this rank and how much the rank spans; `span` is 0 at the last one. */
  into: number;
  span: number;
  next: string | null;
};

export type UIState = {
  loading: boolean;
  error: string | null;
  title: string;
  number: number;
  light: number;
  maxLight: number;
  verses: number;
  totalVerses: number;
  portalOpen: boolean;
  titleCard: { title: string; number: number; total: number } | null;
  toast: string | null;
  dialogue: DialogueUI | null;
  battle: BattleUI | null;
  reveal: RevealUI | null;
  paused: boolean;
  blackout: boolean;
  voice: VoiceUI;
  /** Voice just earned: `id` changes with each gain, so the number can pop again. */
  gain: { id: number; amount: number } | null;
  /** News that doesn't stop the game, like a new rank. */
  banner: { title: string; text: string } | null;
  /** The keepsakes the Voice carries. */
  carried: { id: string; name: string; image: string }[];
  found: FoundUI | null;
  /** The thief is running with a verse. */
  chase: boolean;
};

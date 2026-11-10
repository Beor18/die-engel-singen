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

export type RevealUI = {
  title: string;
  meaning: string[];
  route: string;
  last: boolean;
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
};

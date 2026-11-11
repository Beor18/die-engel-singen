import type { Don } from "@/contenido";
import { getProgress, updateProgress, type Progress } from "./progress";
import type { LevelSource } from "./types";

/**
 * What the Voice keeps between pages: the keepsakes of its chest, the gift each
 * one gives while it is carried, and the rank of its voice.
 *
 * Every page hides one keepsake (an element of its scene marked `recuerdo` in
 * `src/contenido/libro.ts`), so a new page brings its own without touching this
 * file. A new kind of gift needs its words here and its rule in the engine.
 */

export type Gift = Don;

/** What each gift does, in the words the player reads. */
export const GIFTS: Record<Gift, string> = {
  destello: "Los versos brillan a través de la oscuridad.",
  suerte: "La penumbra te embosca la mitad de las veces.",
  pausa: "Tenés más margen para responder cada nota.",
  iman: "Los versos vienen a vos desde una casilla de distancia.",
  paso: "Caminás más rápido.",
  sigilo: "Las sombras te ven recién cuando estás cerca.",
  espina: "La sombra que te saca luz se lastima.",
  gloria: "Ganás un cuarto más de voz.",
  aguante: "El primer golpe de cada batalla no te saca luz.",
  brindis: "Cada verso que rescatás te devuelve una llama.",
  mirada: "Ves más lejos en la oscuridad.",
  despertar: "Una vez por página, si tu luz se apaga, se vuelve a encender.",
  hilo: "Cuando cantás, un hilo de luz te marca el verso más cercano.",
  reflejo: "Cada nota justa pega doble.",
  llama: "Tenés una llama más.",
  sello: "El guardián del título empieza más débil.",
  mando: "Tu canto llega más lejos y aturde el doble.",
  compas: "Las sombras cantan una nota menos por frase.",
  despacio: "Las notas de las sombras llegan más despacio.",
  frente: "Hablás primero: cada batalla empieza con un golpe tuyo.",
};

export type Keepsake = {
  /** The name of its image in /public/juego/escenas: no two keepsakes share one. */
  id: string;
  name: string;
  /** What is said when it is found. */
  line: string;
  gift: Gift;
  image: string;
  /** The page that hides it; null for the one no page holds. */
  level: { id: string; name: string; number: number } | null;
};

/** The keepsake of the verse thief: it drops it the first time it is caught. */
export const FEATHER: Keepsake = {
  id: "pluma-angel",
  name: "Pluma de ángel",
  line: "Una pluma blanca, todavía tibia. La sombra que se llevó tu verso la traía escondida.",
  gift: "destello",
  image: "/juego/escenas/pluma-angel.webp",
  level: null,
};

/** Every keepsake of the book, in the order of its pages, and the thief's at the end. */
export function keepsakesOf(levels: LevelSource[]): Keepsake[] {
  const found: Keepsake[] = [];
  for (const level of levels) {
    for (const el of level.scene?.elementos ?? []) {
      if (!el.recuerdo || !el.imagen) continue;
      found.push({
        id: el.imagen,
        name: el.nombre,
        line: el.dice.join(" "),
        gift: el.recuerdo,
        image: `/juego/escenas/${el.imagen}.webp`,
        level: { id: level.id, name: level.indexName, number: level.number },
      });
    }
  }
  return [...found, FEATHER];
}

// ----- The voice ---------------------------------------------------------------

/** What the Voice earns for each thing it does. */
export const VOICE = {
  verse: 10,
  perfect: 3,
  good: 1,
  shadow: 8,
  guardian: 20,
  keepsake: 40,
  thief: 25,
  /** Rescuing a page for the first time, and again. */
  page: 50,
  replay: 15,
  /** Rescuing it without the light ever going out. */
  clean: 25,
};

const RANKS = [
  { name: "Susurro", at: 0, brings: "" },
  { name: "Murmullo", at: 200, brings: "Una llama más." },
  { name: "Voz clara", at: 500, brings: "Una llama más." },
  { name: "Canto", at: 900, brings: "Una llama más, y lugar para llevar dos recuerdos." },
  { name: "Himno", at: 1400, brings: "Una llama más." },
  { name: "Coral", at: 2100, brings: "Una llama más, y lugar para llevar tres recuerdos." },
  { name: "Voz de ángel", at: 3000, brings: "Una aureola sobre tu cabeza." },
];

const BASE_LIGHT = 3;

export type Rank = {
  index: number;
  name: string;
  /** What reaching it brought. */
  brings: string;
  /** Voice earned inside this rank, and how much the rank spans; `span` is 0 at the last one. */
  into: number;
  span: number;
  nextName: string | null;
  /** How many keepsakes can be carried at once. */
  slots: number;
  /** The flames of the light, before any gift. */
  light: number;
  /** The last rank wears a halo. */
  halo: boolean;
};

export function rankOf(voice: number): Rank {
  let index = 0;
  while (index < RANKS.length - 1 && voice >= RANKS[index + 1].at) index++;
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  return {
    index,
    name: rank.name,
    brings: rank.brings,
    into: voice - rank.at,
    span: next ? next.at - rank.at : 0,
    nextName: next?.name ?? null,
    slots: index >= 5 ? 3 : index >= 3 ? 2 : 1,
    light: BASE_LIGHT + Math.min(5, index),
    halo: index === RANKS.length - 1,
  };
}

/** What the Voice takes into a page: its rank, what it carries and the gifts that gives. */
export function loadout(progress: Progress, catalog: Keepsake[]) {
  const rank = rankOf(progress.voice);
  const carried = progress.carrying
    .map((id) => catalog.find((k) => k.id === id))
    .filter((k): k is Keepsake => Boolean(k))
    .slice(0, rank.slots);
  const gifts = new Set(carried.map((k) => k.gift));
  return { rank, carried, gifts, maxLight: rank.light + (gifts.has("llama") ? 1 : 0) };
}

// ----- The chest ---------------------------------------------------------------

/** Puts a keepsake in the chest; it is carried right away if there is room. Returns whether it is carried. */
export function keep(id: string) {
  const before = getProgress();
  if (before.keepsakes.includes(id)) return before.carrying.includes(id);
  const room = before.carrying.length < rankOf(before.voice).slots;
  updateProgress((p) => ({ ...p, keepsakes: [...p.keepsakes, id], carrying: room ? [...p.carrying, id] : p.carrying }));
  return room;
}

/** Carries a keepsake; with no room left, the one carried the longest goes back to the chest. */
export function carry(id: string) {
  updateProgress((p) => {
    if (!p.keepsakes.includes(id) || p.carrying.includes(id)) return p;
    const slots = rankOf(p.voice).slots;
    return { ...p, carrying: [...p.carrying, id].slice(-slots) };
  });
}

export function leave(id: string) {
  updateProgress((p) => ({ ...p, carrying: p.carrying.filter((c) => c !== id) }));
}

/** The three marks of a page: rescued, its keepsake found, and rescued without the light going out. */
export function marksOf(levelId: string, progress: Progress, catalog: Keepsake[]) {
  const keepsake = catalog.find((k) => k.level?.id === levelId);
  return {
    rescued: progress.done.includes(levelId),
    keepsake: keepsake ? progress.keepsakes.includes(keepsake.id) : null,
    clean: progress.clean.includes(levelId),
  };
}

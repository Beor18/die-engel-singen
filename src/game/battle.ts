import { pick, type Rng } from "./rng";

/**
 * The rules of a battle, as call and response: the shadow sings a phrase of
 * dark notes that travel down to the Voice's light, and the Voice answers each
 * one by singing the moment it arrives. An answered note turns into light and
 * flies back at the shadow. Each kind of shadow sings with its own rhythm.
 *
 * Only data and timing live here; the engine plays the battle and draws it.
 */

export type Style = "steady" | "slow" | "rush" | "fade" | "offbeat" | "rests" | "sides";

const STYLES: Record<string, Style> = {
  Duda: "steady",
  Costumbre: "steady",
  Mañana: "slow",
  Miedo: "rush",
  Prisa: "rush",
  Ansia: "rush",
  Olvido: "fade",
  Silencio: "rests",
  Vacío: "rests",
  Ruido: "offbeat",
  Rencor: "offbeat",
  Vergüenza: "sides",
  Culpa: "sides",
  Orgullo: "sides",
};

export const styleOf = (name: string): Style => STYLES[name] ?? "steady";

/** Beats between one note and the next, repeated for as long as the phrase lasts. */
const GAPS: Record<Style, number[]> = {
  steady: [1],
  slow: [1, 1.5, 2],
  rush: [1, 1, 0.5, 0.5],
  fade: [1],
  offbeat: [1.5, 0.5, 1],
  rests: [1, 2],
  sides: [1],
};

/** Short melodies the shadow sings; the Voice answers with the same notes, higher. */
const MOTIFS = [
  [0, 2, 4, 2],
  [4, 2, 0, 2],
  [0, 4, 2, 7],
  [2, 4, 7, 4],
  [0, 2, 0, 4],
  [7, 4, 2, 0],
];

/** What the player is told the first time a kind of shadow sings. */
export function tell(style: Style, name: string) {
  switch (style) {
    case "slow":
      return `${name} te hace esperar: no te apures.`;
    case "rush":
      return `${name} se apura: sus notas llegan cada vez más seguido.`;
    case "fade":
      return `${name} borra sus notas antes de que lleguen: seguí el pulso.`;
    case "offbeat":
      return `${name} canta a destiempo: mirá cada nota, no el pulso.`;
    case "rests":
      return `${name} canta entre silencios: esperá cada nota.`;
    case "sides":
      return `${name} no te mira de frente: sus notas llegan de costado.`;
    default:
      return "";
  }
}

const DOUBTS = [
  "¿Y si nadie te escucha?",
  "Ya lo intentaste. Mirá cómo terminó.",
  "Nadie te pidió que cantaras.",
  "Lo que perdiste no vuelve.",
  "Te vas a equivocar otra vez.",
  "Es tarde para empezar.",
];

const STYLE_DOUBTS: Record<Style, string[]> = {
  steady: ["¿Estás seguro de esto?", "Capaz que no era por acá.", "¿Y si te equivocaste de camino?"],
  slow: ["Mañana. Siempre mañana.", "Ya habrá tiempo.", "Esperá un poco más."],
  rush: ["Si cantás, te van a encontrar.", "Rápido, que se hace tarde.", "Una más. La última."],
  fade: ["¿Cómo era la letra?", "Nadie se acuerda de vos.", "Ya ni sabés qué buscabas."],
  offbeat: ["Mejor callate.", "Nadie te oye con todo esto.", "Más fuerte. Más rápido. Más."],
  rests: ["Quedate. Acá no duele.", "¿Para qué?", "No hay nada del otro lado."],
  sides: ["¿Quién te creés que sos?", "Te están mirando.", "No levantes la voz."],
};

/** A doubt for a shadow of this kind to whisper. */
export function doubt(rng: Rng, style: Style) {
  return rng() < 0.7 ? pick(rng, STYLE_DOUBTS[style]) : pick(rng, DOUBTS);
}

/**
 * Lines of the poem that read whole on their own: they start a sentence, end
 * it or the stanza, and have a few words. The guardian whispers these.
 */
export function wholeLines(stanzas: string[][]) {
  const lines = stanzas.flatMap((stanza) =>
    stanza.filter((line, i) => {
      const text = line.trim();
      const ends = i === stanza.length - 1 || /[.!?…»"]$/.test(text);
      return ends && /^[¿¡«"]?\p{Lu}/u.test(text) && text.split(/\s+/).length >= 3;
    }),
  );
  return lines.length ? lines : DOUBTS;
}

export type Timing = {
  /** Seconds per beat of the pulse. */
  beat: number;
  /** A press closer than this to a note's arrival answers it. */
  good: number;
  /** Closer than this, the answer is perfect. */
  perfect: number;
  /** How far before `good` an eager press still counts, as early. Earlier ones are ignored. */
  early: number;
};

/** Gentle on the first pages, tighter later; windows stay wide enough for phones. */
export function timing(difficulty: number, guardian: boolean): Timing {
  return {
    beat: (0.75 - difficulty * 0.01) * (guardian ? 0.94 : 1),
    good: 0.18 - difficulty * 0.002,
    perfect: 0.08,
    early: 0.2,
  };
}

/** How many beats a note takes from the shadow to the light. */
export const travelBeats = (style: Style) => (style === "rush" ? 1.5 : 2);

export type NoteSpec = {
  /** When it reaches the light, on the battle clock. */
  at: number;
  /** Seconds it takes to get there. */
  travel: number;
  /** Where it comes from: 0 from the shadow, -1 or 1 from either side. */
  side: number;
  degree: number;
};

/** A phrase of `count` notes, the first reaching the light at `first`. */
export function phrase(style: Style, count: number, first: number, beat: number, rng: Rng): NoteSpec[] {
  const gaps = GAPS[style];
  const motif = pick(rng, MOTIFS);
  const start = rng() < 0.5 ? -1 : 1;
  const travel = travelBeats(style) * beat;
  const notes: NoteSpec[] = [];
  let at = first;
  for (let i = 0; i < count; i++) {
    notes.push({ at, travel, side: style === "sides" ? (i % 2 ? -start : start) : 0, degree: motif[i % motif.length] });
    at += gaps[i % gaps.length] * beat;
  }
  return notes;
}

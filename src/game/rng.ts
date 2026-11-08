/** Seeded randomness: the same page always produces the same level. */

export type Rng = () => number;

export function hash(text: string): number {
  let h = 2166136261 >>> 0;
  for (const c of text) {
    h ^= c.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (r: Rng, a: number, b: number) => a + r() * (b - a);
export const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length)];

export function shuffle<T>(r: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

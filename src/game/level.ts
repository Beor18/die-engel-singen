import type { Zona } from "@/contenido";
import { createRng, hash, pick, shuffle, type Rng } from "./rng";
import type { LevelSource, Point } from "./types";

/**
 * Builds a level from its page.
 *
 * The map has the page's proportions (9:16) and is carved from the painting
 * itself: bright areas are floor and dark areas are walls. The weather zones of
 * the book carry over too: `luz` becomes lanterns, `agua` becomes water, and
 * `niebla`, `nube` and `humo` become gloom, where shadows lurk. The verses to
 * collect are the stanzas of the poem. Everything comes from a seed derived from
 * the page id, so the same page always yields the same level.
 */

export const COLS = 27;
export const ROWS = 48;
/** Each tile samples 4 x 4 points of the painting. */
export const SUB = 4;
export const SAMPLE_W = COLS * SUB;
export const SAMPLE_H = ROWS * SUB;

export const FLOOR = 0;
export const WALL = 1;
export const WATER = 2;
export const GLOOM = 3;

export type Lamp = Point & { color: string; radius: number };
export type Verse = Point & { index: number; lines: string[] };
export type ShadowSpawn = Point & { name: string };
export type Fog = { x: number; y: number; rx: number; ry: number; color: string };

export type GameMap = {
  cells: Uint8Array;
  lum: Float32Array;
  start: Point;
  portal: Point;
  angel: Point;
  verses: Verse[];
  lamps: Lamp[];
  shadows: ShadowSpawn[];
  sparkles: Point[];
  fogs: Fog[];
  darkness: number;
};

/** Names of the shadows, shown to the player. */
const SHADOW_NAMES = [
  "Duda",
  "Miedo",
  "Culpa",
  "Olvido",
  "Ruido",
  "Prisa",
  "Vacío",
  "Vergüenza",
  "Rencor",
  "Ansia",
  "Costumbre",
  "Silencio",
  "Orgullo",
  "Mañana",
];

export const at = (x: number, y: number) => y * COLS + x;
export const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
export const walkable = (c: number) => c === FLOOR || c === GLOOM;

const NEIGHBORS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

const cheb = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const toPoint = (i: number): Point => ({ x: i % COLS, y: (i / COLS) | 0 });

/** Walking distance from a tile; -1 where it cannot be reached. */
export function distances(cells: Uint8Array, from: Point): Int16Array {
  const d = new Int16Array(COLS * ROWS).fill(-1);
  if (!inside(from.x, from.y)) return d;
  const queue = [at(from.x, from.y)];
  d[queue[0]] = 0;
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const x = c % COLS;
    const y = (c / COLS) | 0;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const n = at(nx, ny);
      if (d[n] >= 0 || !walkable(cells[n])) continue;
      d[n] = d[c] + 1;
      queue.push(n);
    }
  }
  return d;
}

/** Shortest path between two tiles, excluding the starting one. */
export function findPath(cells: Uint8Array, from: Point, to: Point, blocked?: (x: number, y: number) => boolean) {
  if (!inside(to.x, to.y) || !walkable(cells[at(to.x, to.y)])) return null;
  const prev = new Int32Array(COLS * ROWS).fill(-2);
  const start = at(from.x, from.y);
  const end = at(to.x, to.y);
  prev[start] = -1;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (c === end) break;
    const x = c % COLS;
    const y = (c / COLS) | 0;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const n = at(nx, ny);
      if (prev[n] !== -2 || !walkable(cells[n])) continue;
      if (blocked && n !== end && blocked(nx, ny)) continue;
      prev[n] = c;
      queue.push(n);
    }
  }
  if (prev[end] === -2) return null;
  const steps: Point[] = [];
  for (let c = end; c !== start; c = prev[c]) steps.push(toPoint(c));
  return steps.reverse();
}

function smooth(cells: Uint8Array) {
  const next = new Uint8Array(cells);
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (cells[at(x + dx, y + dy)] === WALL) walls++;
      next[at(x, y)] = walls >= 5 ? WALL : FLOOR;
    }
  }
  return next;
}

function carve(cells: Uint8Array, center: Point, rx: number, ry: number) {
  for (let y = center.y - ry; y <= center.y + ry; y++) {
    for (let x = center.x - rx; x <= center.x + rx; x++) {
      if (x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1) cells[at(x, y)] = FLOOR;
    }
  }
}

function label(cells: Uint8Array) {
  const labels = new Int32Array(COLS * ROWS).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (labels[i] >= 0 || !walkable(cells[i])) continue;
    const id = sizes.length;
    const queue = [i];
    labels[i] = id;
    for (let k = 0; k < queue.length; k++) {
      const c = queue[k];
      const x = c % COLS;
      const y = (c / COLS) | 0;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny)) continue;
        const n = at(nx, ny);
        if (labels[n] >= 0 || !walkable(cells[n])) continue;
        labels[n] = id;
        queue.push(n);
      }
    }
    sizes.push(queue.length);
  }
  return { labels, sizes };
}

/** Joins every walkable island to the one holding the start by digging corridors. */
function connect(cells: Uint8Array, start: Point) {
  for (let round = 0; round < 80; round++) {
    const { labels, sizes } = label(cells);
    const main = labels[at(start.x, start.y)];
    let other = -1;
    let filled = false;
    for (let id = 0; id < sizes.length; id++) {
      if (id === main) continue;
      if (sizes[id] < 4) {
        for (let i = 0; i < cells.length; i++) if (labels[i] === id) cells[i] = WALL;
        filled = true;
        continue;
      }
      other = id;
      break;
    }
    if (other < 0) {
      if (filled) continue;
      return;
    }
    // Search through walls from the main island until reaching the other one.
    const prev = new Int32Array(COLS * ROWS).fill(-2);
    const queue: number[] = [];
    for (let i = 0; i < cells.length; i++) {
      if (labels[i] === main) {
        prev[i] = -1;
        queue.push(i);
      }
    }
    let found = -1;
    for (let k = 0; k < queue.length && found < 0; k++) {
      const c = queue[k];
      const x = c % COLS;
      const y = (c / COLS) | 0;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx > COLS - 2 || ny > ROWS - 2) continue;
        const n = at(nx, ny);
        if (prev[n] !== -2) continue;
        prev[n] = c;
        if (labels[n] === other) {
          found = n;
          break;
        }
        queue.push(n);
      }
    }
    if (found < 0) return;
    for (let c = prev[found]; c >= 0 && prev[c] !== -1; c = prev[c]) cells[c] = FLOOR;
  }
}

function inEllipse(z: { x: number; y: number; rx: number; ry: number }, cx: number, cy: number) {
  const dx = (cx + 0.5 - z.x * COLS) / Math.max(0.8, z.rx * COLS);
  const dy = (cy + 0.5 - z.y * ROWS) / Math.max(0.8, z.ry * ROWS);
  return dx * dx + dy * dy <= 1;
}

function countReachable(cells: Uint8Array, from: Point) {
  let n = 0;
  for (const v of distances(cells, from)) if (v >= 0) n++;
  return n;
}

function nearestFloor(cells: Uint8Array, cx: number, cy: number): Point | null {
  for (let radius = 0; radius < 10; radius++) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== radius) continue;
        if (inside(x, y) && cells[at(x, y)] === FLOOR) return { x, y };
      }
    }
  }
  return null;
}

/** Groups the stanzas into collectible verses: between 3 and 7 per level. */
export function groupVerses(stanzas: string[][]): string[][] {
  let groups = stanzas.filter((s) => s.length > 0).map((s) => [...s]);
  const lines = groups.flat();
  if (groups.length < 3 && lines.length >= 3) {
    const count = Math.min(5, Math.max(3, Math.ceil(lines.length / 3)));
    const perGroup = Math.ceil(lines.length / count);
    groups = [];
    for (let i = 0; i < lines.length; i += perGroup) groups.push(lines.slice(i, i + perGroup));
  }
  while (groups.length > 7) {
    let best = 0;
    for (let i = 1; i < groups.length - 1; i++) {
      if (groups[i].length + groups[i + 1].length < groups[best].length + groups[best + 1].length) best = i;
    }
    groups.splice(best, 2, [...groups[best], ...groups[best + 1]]);
  }
  return groups.length ? groups : [["…"]];
}

/** Farthest-point sampling over walking distance, with a bit of randomness. */
function spreadOut(r: Rng, cells: Uint8Array, candidates: number[], base: Int16Array, count: number) {
  const nearest = Float32Array.from(base, (v) => (v < 0 ? -1 : v));
  const chosen: Point[] = [];
  for (let k = 0; k < count; k++) {
    const alive = candidates.filter((c) => nearest[c] > 0).sort((a, b) => nearest[b] - nearest[a]);
    if (!alive.length) break;
    const c = alive[Math.floor(r() * Math.max(1, Math.floor(alive.length * 0.06)))];
    const p = toPoint(c);
    chosen.push(p);
    const d = distances(cells, p);
    for (let i = 0; i < nearest.length; i++) if (d[i] >= 0 && d[i] < nearest[i]) nearest[i] = d[i];
  }
  return chosen;
}

export function generateMap(source: LevelSource, sample: Uint8ClampedArray, difficulty: number): GameMap {
  const r = createRng(hash(source.id));
  const N = COLS * ROWS;

  // How bright each tile is in the painting.
  const lum = new Float32Array(N);
  let total = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let s = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const p = ((y * SUB + sy) * SAMPLE_W + x * SUB + sx) * 4;
          s += (0.2126 * sample[p] + 0.7152 * sample[p + 1] + 0.0722 * sample[p + 2]) / 255;
        }
      }
      lum[at(x, y)] = s / (SUB * SUB);
      total += lum[at(x, y)];
    }
  }

  const value = Float32Array.from(lum, (v) => v + (r() - 0.5) * 0.07);
  const threshold = [...value].sort((a, b) => a - b)[Math.floor(N * 0.42)];
  let cells: Uint8Array = new Uint8Array(N);
  for (let i = 0; i < N; i++) cells[i] = value[i] >= threshold ? FLOOR : WALL;
  for (let k = 0; k < 3; k++) cells = smooth(cells);

  // Loose pillars in very open spaces, so they don't feel like empty plains.
  for (let y = 2; y < ROWS - 2; y++) {
    for (let x = 2; x < COLS - 2; x++) {
      let open = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (cells[at(x + dx, y + dy)] === FLOOR) open++;
      if (open === 25 && r() < 0.09) cells[at(x, y)] = WALL;
    }
  }

  for (let x = 0; x < COLS; x++) {
    cells[at(x, 0)] = WALL;
    cells[at(x, ROWS - 1)] = WALL;
  }
  for (let y = 0; y < ROWS; y++) {
    cells[at(0, y)] = WALL;
    cells[at(COLS - 1, y)] = WALL;
  }

  // The start sits where the book draws its red star; the portal, on the title.
  const start = { x: Math.floor(COLS / 2), y: Math.round(ROWS * 0.87) };
  const portal = { x: Math.floor(COLS / 2), y: Math.round(ROWS * 0.085) };
  carve(cells, start, 2, 1);
  carve(cells, portal, 2, 1);
  const angel = { x: start.x + 2, y: start.y - 1 };

  const zones: Zona[] = source.weather.zonas ?? [];
  const lightZones = zones.filter((z) => z.tipo === "luz");
  for (const z of lightZones) {
    const c = { x: Math.round(z.x * COLS - 0.5), y: Math.round(z.y * ROWS - 0.5) };
    if (c.x > 1 && c.y > 1 && c.x < COLS - 2 && c.y < ROWS - 2) carve(cells, c, 1, 1);
  }

  connect(cells, start);

  // Water, only where it doesn't cut the way through.
  for (const z of zones.filter((zz) => zz.tipo === "agua")) {
    const candidates: number[] = [];
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (cells[at(x, y)] !== FLOOR || !inEllipse(z, x, y)) continue;
        if (cheb({ x, y }, start) <= 3 || cheb({ x, y }, portal) <= 2) continue;
        candidates.push(at(x, y));
      }
    }
    if (!candidates.length) continue;
    const before = countReachable(cells, start);
    for (const c of candidates) cells[c] = WATER;
    if (countReachable(cells, start) < before - candidates.length) for (const c of candidates) cells[c] = FLOOR;
  }

  // Lamps: the light zones of the book, plus a couple more if needed.
  const tone = source.tone;
  const lamps: Lamp[] = [];
  for (const z of lightZones) {
    const p = nearestFloor(cells, Math.round(z.x * COLS - 0.5), Math.round(z.y * ROWS - 0.5));
    if (!p || cheb(p, start) <= 2 || cheb(p, portal) <= 2) continue;
    if (lamps.some((l) => cheb(l, p) <= 4)) continue;
    lamps.push({ ...p, color: z.color ?? tone, radius: 3.2 });
    if (lamps.length >= 4) break;
  }
  const fromStart = distances(cells, start);
  const reachable: number[] = [];
  for (let i = 0; i < N; i++) if (fromStart[i] >= 0) reachable.push(i);
  const farthest = Math.max(...reachable.map((i) => fromStart[i]));
  for (const share of [0.38, 0.7]) {
    if (lamps.length >= 5) break;
    const target = farthest * share;
    const options = reachable.filter(
      (i) => Math.abs(fromStart[i] - target) < 4 && cells[i] === FLOOR && !lamps.some((l) => cheb(l, toPoint(i)) <= 7),
    );
    if (!options.length) continue;
    const c = pick(r, options);
    lamps.push({ ...toPoint(c), color: tone, radius: 3.2 });
  }

  // Gloom: fog, clouds and smoke from the book, plus the darkest parts of the painting.
  const gloomLimit = [...reachable.map((i) => lum[i])].sort((a, b) => a - b)[Math.floor(reachable.length * 0.13)] ?? 0;
  const gloomZones = zones.filter((z) => z.tipo === "niebla" || z.tipo === "nube" || z.tipo === "humo");
  for (const i of reachable) {
    const p = toPoint(i);
    if (cells[i] !== FLOOR || fromStart[i] < 5 || cheb(p, portal) <= 2) continue;
    if (lamps.some((l) => cheb(l, p) <= 2)) continue;
    if (lum[i] <= gloomLimit || gloomZones.some((z) => inEllipse(z, p.x, p.y))) cells[i] = GLOOM;
  }
  cells[at(angel.x, angel.y)] = FLOOR;

  // Verses, spread out and far from the start.
  const groups = groupVerses(source.stanzas);
  const candidates = reachable.filter((i) => {
    const p = toPoint(i);
    return fromStart[i] >= 6 && cheb(p, portal) > 2 && !lamps.some((l) => l.x === p.x && l.y === p.y);
  });
  const spots = spreadOut(r, cells, candidates, fromStart, groups.length);
  const verses: Verse[] = spots.map((p, i) => ({ ...p, index: i, lines: groups[i] }));

  // Shadows roam far from the start and keep away from lamps.
  const count = Math.min(7, 2 + Math.floor(difficulty * 0.5));
  const names = shuffle(r, [...SHADOW_NAMES]);
  const shadows: ShadowSpawn[] = [];
  for (const i of shuffle(r, [...reachable])) {
    if (shadows.length >= count) break;
    const p = toPoint(i);
    if (fromStart[i] < 10 || lamps.some((l) => cheb(l, p) <= 3)) continue;
    if (verses.some((v) => v.x === p.x && v.y === p.y)) continue;
    if (shadows.some((s) => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) < 6)) continue;
    shadows.push({ ...p, name: names[shadows.length % names.length] });
  }

  const sparkles: Point[] = [];
  for (const z of zones.filter((zz) => zz.tipo === "centelleo")) {
    const within = reachable.filter((i) => inEllipse(z, i % COLS, (i / COLS) | 0));
    for (const i of shuffle(r, within).slice(0, 3)) sparkles.push(toPoint(i));
  }

  const fogs: Fog[] = gloomZones.map((z) => ({
    x: z.x * COLS,
    y: z.y * ROWS,
    rx: Math.max(1.2, z.rx * COLS),
    ry: Math.max(1.2, z.ry * ROWS),
    color: z.color ?? "#8c96a8",
  }));

  const average = total / N;
  const darkness = Math.min(0.94, Math.max(0.8, 0.97 - average * 0.5));

  return { cells, lum, start, portal, angel, verses, lamps, shadows, sparkles, fogs, darkness };
}

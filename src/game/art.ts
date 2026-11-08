import { COLS, FLOOR, GLOOM, ROWS, TILE, WALL, WATER, at, inside, type GameMap } from "./level";
import type { Point } from "./types";

/**
 * Turns a page into the pixel art of its level, once, when the level loads.
 *
 * The ground is paved with irregular flagstones in the colors of the painting,
 * taken one per tile and softened, so its light and palette carry over but the
 * letters of the poem melt away and stay hidden until the end. It is reduced to
 * a small palette and dithered, which gives the soft gradients of pixel art. Walls are raised
 * blocks with rounded corners, a lit rim, a front face and a cast shadow, so
 * the way through reads at a glance.
 */

export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

/** Ordered dithering thresholds for a 4 x 4 pattern, between 0 and 1. */
export const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

/** Height of a wall's front face, in pixels. */
const FACE = 6;
/** Radius of the rounded corners of walls, in pixels. */
const CORNER = 5;

const WATER_COLOR = [16, 40, 70];
const GLOOM_COLOR = [26, 14, 40];
const OUTLINE = [7, 5, 11];

export type Puddle = { x: number; y: number; rx: number; ry: number; seed: number };

export type WorldArt = {
  /** The floor: the painting as pixel art, with water, gloom and puddles. */
  ground: HTMLCanvasElement;
  /** Walls with their outline and cast shadow, on a transparent layer. */
  walls: HTMLCanvasElement;
  /** Where fog drifts: opaque over gloom, transparent elsewhere. */
  gloom: HTMLCanvasElement;
  puddles: Puddle[];
};

export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ihash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Smooth value noise between 0 and 1. With `period`, it tiles every `period` cells. */
export function valueNoise(seed: number, period = 0) {
  const wrap = (v: number) => (period ? ((v % period) + period) % period : v);
  const g = (ix: number, iy: number) => (ihash(wrap(ix), wrap(iy), seed) & 1023) / 1023;
  return (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = g(ix, iy);
    const b = g(ix + 1, iy);
    const c = g(ix, iy + 1);
    const d = g(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Irregular flagstones: distance to the nearest and second nearest stone centers. */
function flagstones(seed: number, C = 10) {
  return (x: number, y: number) => {
    const cx = Math.floor(x / C);
    const cy = Math.floor(y / C);
    let d1 = Infinity;
    let d2 = Infinity;
    let shade = 0;
    let bx = 0;
    let by = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const h = ihash(cx + i, cy + j, seed);
        const px = (cx + i) * C + 2 + (h % (C - 4));
        const py = (cy + j) * C + 2 + ((h >>> 8) % (C - 4));
        const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          shade = ((h >>> 16) % 1000) / 1000;
          bx = px;
          by = py;
        } else if (d < d2) d2 = d;
      }
    }
    return { gap: Math.sqrt(d2) - Math.sqrt(d1), shade, up: x + 0.5 - bx + (y + 0.5 - by) < 0 };
  };
}

/** A palette of `count` colors that represents the chosen pixels, by median cut. */
function medianCut(col: Float32Array, pick: (i: number) => boolean, count: number, stride = 5) {
  const all: number[] = [];
  for (let i = 0; i < col.length / 3; i += stride) if (pick(i)) all.push(i);
  if (!all.length) return Float32Array.of(0, 0, 0);
  const boxes: number[][] = [all];
  while (boxes.length < count) {
    let best = -1;
    let bestScore = 0;
    let bestChannel = 0;
    boxes.forEach((box, k) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255;
        let hi = 0;
        for (const i of box) {
          const v = col[i * 3 + ch];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const score = (hi - lo) * Math.sqrt(box.length);
        if (score > bestScore) {
          bestScore = score;
          best = k;
          bestChannel = ch;
        }
      }
    });
    if (best < 0 || bestScore < 1) break;
    const box = boxes[best];
    box.sort((a, b) => col[a * 3 + bestChannel] - col[b * 3 + bestChannel]);
    const mid = box.length >> 1;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  const palette = new Float32Array(boxes.length * 3);
  boxes.forEach((box, k) => {
    for (let ch = 0; ch < 3; ch++) {
      let s = 0;
      for (const i of box) s += col[i * 3 + ch];
      palette[k * 3 + ch] = Math.round(s / box.length);
    }
  });
  return palette;
}

/** Writes the chosen pixels into `out`, reduced to the palette with ordered dithering. */
function quantize(out: Uint8ClampedArray, col: Float32Array, pick: (i: number) => boolean, palette: Float32Array, amp: number) {
  const n = palette.length / 3;
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const i = y * WORLD_W + x;
      if (!pick(i)) continue;
      const d = (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * amp;
      const r = col[i * 3] + d;
      const g = col[i * 3 + 1] + d;
      const b = col[i * 3 + 2] + d;
      let best = 0;
      let bestDist = Infinity;
      for (let k = 0; k < n; k++) {
        const dr = r - palette[k * 3];
        const dg = g - palette[k * 3 + 1];
        const db = b - palette[k * 3 + 2];
        const dist = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
        if (dist < bestDist) {
          bestDist = dist;
          best = k;
        }
      }
      out[i * 4] = palette[best * 3];
      out[i * 4 + 1] = palette[best * 3 + 1];
      out[i * 4 + 2] = palette[best * 3 + 2];
      out[i * 4 + 3] = 255;
    }
  }
}

/** A value per tile, read anywhere in the world with bilinear interpolation between tile centers. */
function tileField(value: (x: number, y: number) => number) {
  const gw = COLS + 2;
  const grid = new Float32Array(gw * (ROWS + 2));
  for (let y = -1; y <= ROWS; y++) for (let x = -1; x <= COLS; x++) grid[(y + 1) * gw + x + 1] = value(x, y);
  return (px: number, py: number) => {
    const fx = (px + 0.5) / TILE - 0.5;
    const fy = (py + 0.5) / TILE - 0.5;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const ax = fx - ix;
    const ay = fy - iy;
    const o = (iy + 1) * gw + ix + 1;
    const top = grid[o] + (grid[o + 1] - grid[o]) * ax;
    const bottom = grid[o + gw] + (grid[o + gw + 1] - grid[o + gw]) * ax;
    return top + (bottom - top) * ay;
  };
}

/** Walls as pixels: tile blocks with rounded outer corners and filled inner corners. */
function wallPixels(cells: Uint8Array) {
  const W = WORLD_W;
  const mask = new Uint8Array(W * WORLD_H);
  const wall = (x: number, y: number) => !inside(x, y) || cells[at(x, y)] === WALL;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const self = wall(tx, ty);
      const n = wall(tx, ty - 1);
      const s = wall(tx, ty + 1);
      const w = wall(tx - 1, ty);
      const e = wall(tx + 1, ty);
      if (self && !n && !s && !w && !e) {
        // A loose wall is a rock: round, a little irregular, standing on its tile.
        const seed = ihash(tx, ty, 91);
        for (let ly = 0; ly < TILE; ly++) {
          for (let lx = 0; lx < TILE; lx++) {
            const dx = lx + 0.5 - 8;
            const dy = ly + 0.5 - 9;
            const sector = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 6) % 6;
            const radius = 5.6 + ((seed >>> (sector * 3)) % 4) * 0.5;
            if (dx * dx + dy * dy * 1.15 <= radius * radius) mask[(ty * TILE + ly) * W + tx * TILE + lx] = 1;
          }
        }
        continue;
      }
      for (let ly = 0; ly < TILE; ly++) {
        for (let lx = 0; lx < TILE; lx++) {
          let v = self;
          const cx = lx < CORNER ? 0 : lx >= TILE - CORNER ? 1 : -1;
          const cy = ly < CORNER ? 0 : ly >= TILE - CORNER ? 1 : -1;
          if (cx >= 0 && cy >= 0) {
            const sideX = cx === 0 ? w : e;
            const sideY = cy === 0 ? n : s;
            const diagonal = wall(tx + (cx === 0 ? -1 : 1), ty + (cy === 0 ? -1 : 1));
            const ox = cx === 0 ? CORNER - lx - 0.5 : lx - (TILE - CORNER) + 0.5;
            const oy = cy === 0 ? CORNER - ly - 0.5 : ly - (TILE - CORNER) + 0.5;
            const outside = ox * ox + oy * oy > CORNER * CORNER;
            if (self && !sideX && !sideY && outside) v = false;
            if (!self && sideX && sideY && diagonal && outside) v = true;
          }
          if (v) mask[(ty * TILE + ly) * W + tx * TILE + lx] = 1;
        }
      }
    }
  }
  return mask;
}

/** Floor tiles where a puddle fits, away from the start. */
function choosePuddles(map: GameMap, seed: number): Puddle[] {
  const out: Puddle[] = [];
  const free = (x: number, y: number) => inside(x, y) && map.cells[at(x, y)] === FLOOR;
  const near = (p: Point, q: Point, d: number) => Math.abs(p.x - q.x) <= d && Math.abs(p.y - q.y) <= d;
  for (let k = 0; k < 400 && out.length < 12; k++) {
    const h = ihash(k, 7, seed);
    const x = 1 + (h % (COLS - 2));
    const y = 1 + ((h >>> 8) % (ROWS - 2));
    if (!free(x, y) || !free(x - 1, y) || !free(x + 1, y) || !free(x, y + 1)) continue;
    if (near({ x, y }, map.start, 2) || near({ x, y }, map.portal, 2)) continue;
    if (out.some((p) => Math.abs(p.x / TILE - x) < 3 && Math.abs(p.y / TILE - y) < 3)) continue;
    out.push({ x: x * TILE + 8, y: y * TILE + 9, rx: 4 + (h >>> 16) % 3, ry: 2, seed: h % 1000 });
  }
  return out;
}

export function buildWorldArt(
  painting: CanvasImageSource,
  map: GameMap,
  o: { seed: number; tone: string; rain: boolean; petals: boolean },
): WorldArt {
  const W = WORLD_W;
  const H = WORLD_H;
  const N = W * H;
  const cells = map.cells;
  const tone = hexRgb(o.tone);

  // 1. The colors of the painting, one per tile and softened, so the letters of the poem
  //    melt into the background and only its light and palette remain.
  const small = makeCanvas(COLS, ROWS);
  const sg = small.getContext("2d", { willReadFrequently: true })!;
  sg.imageSmoothingEnabled = true;
  sg.imageSmoothingQuality = "high";
  sg.drawImage(painting, 0, 0, COLS, ROWS);
  let grid = Float32Array.from(sg.getImageData(0, 0, COLS, ROWS).data);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(grid.length);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const xx = Math.min(COLS - 1, Math.max(0, x + dx));
              const yy = Math.min(ROWS - 1, Math.max(0, y + dy));
              sum += grid[(yy * COLS + xx) * 4 + ch] * (dx === 0 && dy === 0 ? 4 : 1);
            }
          }
          next[(y * COLS + x) * 4 + ch] = sum / 12;
        }
      }
    }
    grid = next;
  }
  // Floors keep the painting's hue, with their brightness pulled into a range that reads well.
  const channel = (ch: number) =>
    tileField((x, y) => {
      const xx = Math.min(COLS - 1, Math.max(0, x));
      const yy = Math.min(ROWS - 1, Math.max(0, y));
      const o = (yy * COLS + xx) * 4;
      const l = 0.299 * grid[o] + 0.587 * grid[o + 1] + 0.114 * grid[o + 2];
      return 64 + l * 0.5 + (grid[o + ch] - l) * 1.2;
    });
  const fieldR = channel(0);
  const fieldG = channel(1);
  const fieldB = channel(2);

  const walls = wallPixels(cells);
  const waterField = tileField((x, y) => (inside(x, y) && cells[at(x, y)] === WATER ? 1 : 0));
  const gloomField = tileField((x, y) => (inside(x, y) && cells[at(x, y)] === GLOOM ? 1 : 0));
  const grain = valueNoise(o.seed ^ 0x51);
  const stones = flagstones(o.seed ^ 0x3c);

  // 2. The ground: flagstones in the painting's colors, water, gloom, specks and puddles.
  const base = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const water = new Uint8Array(N);
  const gloomMask = makeCanvas(W, H);
  const gm = gloomMask.getContext("2d")!;
  const gloomData = gm.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let r = fieldR(x, y);
      let g = fieldG(x, y);
      let b = fieldB(x, y);
      base[i * 3] = r;
      base[i * 3 + 1] = g;
      base[i * 3 + 2] = b;
      if (waterField(x, y) >= 0.5) {
        water[i] = 1;
        const k = 0.8 + 0.25 * grain(x / 7, y / 3);
        r = (r * 0.3 + WATER_COLOR[0] * 0.7) * k;
        g = (g * 0.3 + WATER_COLOR[1] * 0.7) * k;
        b = (b * 0.3 + WATER_COLOR[2] * 0.7) * k;
      } else {
        const stone = stones(x, y);
        let k = stone.gap < 1 ? 0.58 : 0.88 + stone.shade * 0.18;
        if (stone.gap >= 1 && stone.gap < 2.2) k *= stone.up ? 1.13 : 0.88;
        const h = ihash(x, y, o.seed);
        if (h % 89 === 0) k *= 1.2;
        r *= k;
        g *= k;
        b *= k;
        const amount = smoothstep(0.3, 0.7, gloomField(x, y));
        if (amount > 0) {
          const dim = 1 - 0.22 * amount;
          r = (r + (GLOOM_COLOR[0] - r) * 0.55 * amount) * dim;
          g = (g + (GLOOM_COLOR[1] - g) * 0.55 * amount) * dim;
          b = (b + (GLOOM_COLOR[2] - b) * 0.55 * amount) * dim;
          if (amount > BAYER[(y & 3) * 4 + (x & 3)]) gloomData.data[i * 4 + 3] = 255;
        }
      }
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }
  }
  gm.putImageData(gloomData, 0, 0);

  // Water catches light along its upper shore.
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!water[i]) continue;
      const above = water[i - W];
      const twoAbove = y > 1 ? water[i - 2 * W] : 1;
      const k = !above ? 1.9 : !twoAbove ? 1.3 : 1;
      if (k === 1) continue;
      col[i * 3] = col[i * 3] * k + 18;
      col[i * 3 + 1] = col[i * 3 + 1] * k + 24;
      col[i * 3 + 2] = col[i * 3 + 2] * k + 30;
    }
  }

  const puddles = o.rain ? choosePuddles(map, o.seed) : [];
  for (const p of puddles) {
    for (let y = p.y - p.ry; y <= p.y + p.ry; y++) {
      for (let x = p.x - p.rx; x <= p.x + p.rx; x++) {
        const dx = (x - p.x) / (p.rx + 0.5);
        const dy = (y - p.y) / (p.ry + 0.5);
        if (dx * dx + dy * dy > 1) continue;
        const i = y * W + x;
        const rim = y === p.y - p.ry;
        const shine = y === p.y && x >= p.x - 1 && x <= p.x + 1;
        const k = rim ? 0.5 : 0.62;
        col[i * 3] = col[i * 3] * k + (shine ? 70 : 10);
        col[i * 3 + 1] = col[i * 3 + 1] * k + (shine ? 86 : 18);
        col[i * 3 + 2] = col[i * 3 + 2] * k + (shine ? 104 : 32);
      }
    }
  }

  if (o.petals) {
    for (let k = 0; k < 90; k++) {
      const h = ihash(k, 3, o.seed);
      const x = h % (W - 2);
      const y = (h >>> 9) % H;
      const i = y * W + x;
      if (walls[i] || water[i]) continue;
      const c = h % 3 ? [179, 32, 46] : [224, 122, 134];
      for (const j of [i, i + 1]) {
        col[j * 3] = c[0];
        col[j * 3 + 1] = c[1];
        col[j * 3 + 2] = c[2];
      }
    }
  }

  const ground = makeCanvas(W, H);
  const gctx = ground.getContext("2d")!;
  const groundData = gctx.createImageData(W, H);
  const everything = () => true;
  quantize(groundData.data, col, everything, medianCut(col, everything, 28), 5);
  gctx.putImageData(groundData, 0, 0);

  // 4. Walls: top with texture and lit rim, front face with strata, outline and shadow.
  const below = new Uint8Array(N);
  for (let x = 0; x < W; x++) {
    let d = FACE + 2;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      d = walls[i] ? Math.min(FACE + 2, d + 1) : 0;
      below[i] = d;
    }
  }
  const rock = valueNoise(o.seed ^ 0x2a);
  const boulders = flagstones(o.seed ^ 0x77, 15);
  const wcol = new Float32Array(N * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!walls[i]) continue;
      const pr = base[i * 3];
      const pg = base[i * 3 + 1];
      const pb = base[i * 3 + 2];
      const openLeft = x > 0 && !walls[i - 1];
      const openRight = x < W - 1 && !walls[i + 1];
      let r: number;
      let g: number;
      let b: number;
      const d = below[i];
      if (d <= FACE) {
        const row = FACE - d;
        let k = 1 - (row / FACE) * 0.32;
        if ((row + (ihash(x >> 2, 1, o.seed) % 3)) % 3 === 2) k *= 0.76;
        if (ihash(x, 2, o.seed) % 13 === 0 && row > 0) k *= 0.7;
        if (row === FACE - 1) k *= 0.6;
        if (openLeft) k *= 1.2;
        if (openRight) k *= 0.8;
        r = (pr * 0.2 + tone[0] * 0.04 + 4) * k;
        g = (pg * 0.2 + tone[1] * 0.04 + 4) * k;
        b = (pb * 0.2 + tone[2] * 0.04 + 8) * k;
      } else {
        const block = boulders(x, y);
        const n = rock(x / 2.2 + 40, y / 2.2);
        let k = (block.gap < 1 ? 0.5 : 0.82 + block.shade * 0.3) * (0.9 + 0.2 * n);
        if (block.gap >= 1 && block.gap < 2.4) k *= block.up ? 1.22 : 0.84;
        let add = 0;
        const openTop = y > 0 && !walls[i - W];
        if (openTop) {
          k *= 1.6;
          add = 16;
        } else if (d === FACE + 1) {
          k *= 1.75;
          add = 20;
        } else if (openLeft) k *= 1.2;
        else if (openRight) k *= 0.78;
        r = (pr * 0.34 + tone[0] * 0.08 + 8) * k + add + (openTop ? tone[0] * 0.14 : 0);
        g = (pg * 0.34 + tone[1] * 0.08 + 8) * k + add + (openTop ? tone[1] * 0.14 : 0);
        b = (pb * 0.34 + tone[2] * 0.08 + 14) * k + add + (openTop ? tone[2] * 0.14 : 0);
      }
      wcol[i * 3] = r;
      wcol[i * 3 + 1] = g;
      wcol[i * 3 + 2] = b;
    }
  }
  const wallLayer = makeCanvas(W, H);
  const wctx = wallLayer.getContext("2d")!;
  const wallData = wctx.createImageData(W, H);
  const isWall = (i: number) => walls[i] === 1;
  quantize(wallData.data, wcol, isWall, medianCut(wcol, isWall, 12, 3), 16);

  // Outline around every wall, and a shadow cast down and to the right.
  const wallAt = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || walls[y * W + x] === 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (walls[i]) continue;
      const o4 = i * 4;
      if (wallAt(x - 1, y) || wallAt(x + 1, y) || wallAt(x, y - 1) || wallAt(x, y + 1)) {
        wallData.data[o4] = OUTLINE[0];
        wallData.data[o4 + 1] = OUTLINE[1];
        wallData.data[o4 + 2] = OUTLINE[2];
        wallData.data[o4 + 3] = 255;
        continue;
      }
      for (let k = 1; k <= 5; k++) {
        if (wallAt(x - (k >> 1), y - k)) {
          wallData.data[o4 + 3] = k <= 2 ? 120 : 92;
          break;
        }
      }
    }
  }
  wctx.putImageData(wallData, 0, 0);

  return { ground, walls: wallLayer, gloom: gloomMask, puddles };
}

/** A 64 x 64 tile of drifting fog that repeats seamlessly. */
export function fogTile(seed: number) {
  const S = 64;
  const coarse = valueNoise(seed, 8);
  const fine = valueNoise(seed ^ 0x33, 16);
  const c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = coarse(x / 8, y / 8) * 0.7 + fine(x / 4, y / 4) * 0.3;
      const a = n > 0.62 ? 150 : n > 0.53 ? 95 : 0;
      const i = (y * S + x) * 4;
      img.data[i] = GLOOM_COLOR[0] - 8;
      img.data[i + 1] = GLOOM_COLOR[1] - 4;
      img.data[i + 2] = GLOOM_COLOR[2];
      img.data[i + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

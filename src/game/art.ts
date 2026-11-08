import { COLS, FLOOR, GLOOM, ROWS, TILE, WALL, WATER, at, inside, type GameMap } from "./level";
import type { Point } from "./types";

/**
 * Paints the world of a level, once, when it loads.
 *
 * The ground is a painted stone texture, repeated and tinted with the colors of
 * the page: one color per tile, softened, so the light and palette of the
 * painting carry over while the letters of the poem melt away and stay hidden
 * until the end. Walls are rock with a lit top, a dark front face and a soft
 * shadow on the ground. Everything is painted at ART times the resolution of
 * the map and drawn smoothly, like an illustration.
 */

export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
/** Art pixels per map pixel. */
export const ART = 4;
const AW = WORLD_W * ART;
const AH = WORLD_H * ART;
/** A tile, in art pixels. */
const T = TILE * ART;
/** Height of a wall's front face, in art pixels. */
const FACE = 10 * ART;
/** Radius of the rounded corners of walls, in art pixels. */
const CORNER = 6 * ART;

export type Textures = {
  ground: CanvasImageSource | null;
  rock: CanvasImageSource | null;
  boulder: HTMLImageElement | null;
};

export type Puddle = { x: number; y: number; rx: number; ry: number; seed: number };

export type WorldArt = {
  /** The floor, at ART resolution. */
  ground: HTMLCanvasElement;
  /** Walls and their shadows, on a transparent layer, at ART resolution. */
  walls: HTMLCanvasElement;
  /** One pixel per tile, opaque over gloom: drawn smoothly, it gives soft patches. */
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

/** A canvas of noise, `w` x `h`, gray, to be stretched smoothly over the world. */
function noiseCanvas(w: number, h: number, seed: number, scale: number, lo: number, hi: number) {
  const c = makeCanvas(w, h);
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  const n = valueNoise(seed);
  const m = valueNoise(seed ^ 0x55);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = lo + (hi - lo) * (n(x / scale, y / scale) * 0.7 + m(x / (scale / 2.3), y / (scale / 2.3)) * 0.3);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * The colors of the painting, one per tile and softened. Hue and saturation go to
 * `color`; brightness, pulled into a range that reads well, goes to `light`.
 */
function paintingFields(painting: CanvasImageSource) {
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
  const color = makeCanvas(COLS, ROWS);
  const light = makeCanvas(COLS, ROWS);
  const cg = color.getContext("2d")!;
  const lg = light.getContext("2d")!;
  const ci = cg.createImageData(COLS, ROWS);
  const li = lg.createImageData(COLS, ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    const l = 0.299 * grid[i * 4] + 0.587 * grid[i * 4 + 1] + 0.114 * grid[i * 4 + 2];
    const target = 120 + l * 0.45;
    for (let ch = 0; ch < 3; ch++) ci.data[i * 4 + ch] = target + (grid[i * 4 + ch] - l) * 1.6;
    ci.data[i * 4 + 3] = 255;
    const v = 170 + l * 0.33;
    li.data[i * 4] = li.data[i * 4 + 1] = li.data[i * 4 + 2] = v;
    li.data[i * 4 + 3] = 255;
  }
  cg.putImageData(ci, 0, 0);
  lg.putImageData(li, 0, 0);
  return { color, light };
}

/** A stone texture drawn in code, for when the painted one is missing. */
function fallbackTexture(seed: number, dark: boolean) {
  const S = 256;
  const C = 32;
  const cells = S / C;
  const c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  const n = valueNoise(seed, 16);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = Math.floor(x / C);
      const cy = Math.floor(y / C);
      let d1 = Infinity;
      let d2 = Infinity;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const h = ihash((cx + i + cells) % cells, (cy + j + cells) % cells, seed);
          const px = (cx + i) * C + 4 + (h % (C - 8));
          const py = (cy + j) * C + 4 + ((h >>> 8) % (C - 8));
          const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      const edge = Math.min(1, (d2 - d1) / 4);
      const v = (dark ? 46 : 92) * (0.45 + 0.55 * edge) * (0.85 + 0.3 * n(x / 16, y / 16));
      const i = (y * S + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 1.05;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Fills the current clip (or everything) with a texture repeated so it spans `tiles` tiles. */
function paintTexture(g: CanvasRenderingContext2D, tex: CanvasImageSource, tiles: number, offset = 0) {
  const size = (tex as { width: number }).width || 256;
  const pattern = g.createPattern(tex, "repeat");
  if (!pattern) return;
  const k = (T * tiles) / size;
  g.save();
  g.scale(k, k);
  g.translate(offset, offset * 0.6);
  g.fillStyle = pattern;
  g.fillRect(-offset, -offset * 0.6, AW / k, AH / k);
  g.restore();
}

/** The walls as one shape: tile blocks with rounded outer corners and filled inner corners. */
function footprint(cells: Uint8Array, skip: Set<number>) {
  const p = new Path2D();
  const wall = (x: number, y: number) => !inside(x, y) || cells[at(x, y)] === WALL;
  const r = CORNER;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const n = wall(tx, ty - 1);
      const s = wall(tx, ty + 1);
      const w = wall(tx - 1, ty);
      const e = wall(tx + 1, ty);
      if (wall(tx, ty)) {
        if (skip.has(at(tx, ty))) continue;
        p.roundRect(tx * T, ty * T, T, T, [!n && !w ? r : 0, !n && !e ? r : 0, !s && !e ? r : 0, !s && !w ? r : 0]);
        continue;
      }
      // Inner corners: a fillet in the corner of the floor tile.
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        if (!wall(tx + sx, ty) || !wall(tx, ty + sy) || !wall(tx + sx, ty + sy)) continue;
        const cx = (tx + (sx > 0 ? 1 : 0)) * T;
        const cy = (ty + (sy > 0 ? 1 : 0)) * T;
        p.moveTo(cx, cy);
        p.lineTo(cx - sx * r, cy);
        p.arcTo(cx, cy, cx, cy - sy * r, r);
        p.closePath();
      }
    }
  }
  return p;
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
    out.push({ x: x * TILE + 8, y: y * TILE + 9, rx: 6 + ((h >>> 16) % 4), ry: 3 + ((h >>> 20) % 2), seed: h % 1000 });
  }
  return out;
}

/** Tiles of wall with no wall around them: they are drawn as single rocks. */
export function looseRocks(cells: Uint8Array) {
  const wall = (x: number, y: number) => !inside(x, y) || cells[at(x, y)] === WALL;
  const out = new Set<number>();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (wall(x, y) && !wall(x - 1, y) && !wall(x + 1, y) && !wall(x, y - 1) && !wall(x, y + 1)) out.add(at(x, y));
    }
  }
  return out;
}

export function buildWorldArt(
  painting: CanvasImageSource,
  map: GameMap,
  tex: Textures,
  o: { seed: number; tone: string; rain: boolean; petals: boolean },
): WorldArt {
  const cells = map.cells;
  const { color, light } = paintingFields(painting);
  const groundTex = tex.ground ?? fallbackTexture(o.seed, false);
  const rockTex = tex.rock ?? fallbackTexture(o.seed ^ 0x99, true);

  // 1. The ground: stone, a slow variation so the texture doesn't repeat visibly,
  //    and the painting's colors and light.
  const ground = makeCanvas(AW, AH);
  const g = ground.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  paintTexture(g, groundTex, 5);
  g.globalCompositeOperation = "soft-light";
  g.globalAlpha = 0.5;
  paintTexture(g, groundTex, 11, 37);
  g.globalAlpha = 0.85;
  g.globalCompositeOperation = "overlay";
  g.drawImage(noiseCanvas(COLS * 3, ROWS * 3, o.seed, 4, 60, 196), 0, 0, AW, AH);
  g.globalAlpha = 0.72;
  g.globalCompositeOperation = "color";
  g.drawImage(color, 0, 0, AW, AH);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "multiply";
  g.drawImage(light, 0, 0, AW, AH);
  g.globalCompositeOperation = "source-over";

  // Gloom: soft dark patches, one pixel per tile stretched over the world.
  const gloom = makeCanvas(COLS, ROWS);
  const gl = gloom.getContext("2d")!;
  const gi = gl.createImageData(COLS, ROWS);
  for (let i = 0; i < cells.length; i++) {
    gi.data[i * 4] = 20;
    gi.data[i * 4 + 1] = 10;
    gi.data[i * 4 + 2] = 30;
    gi.data[i * 4 + 3] = cells[i] === GLOOM ? 255 : 0;
  }
  gl.putImageData(gi, 0, 0);
  g.globalAlpha = 0.62;
  g.drawImage(gloom, 0, 0, AW, AH);
  g.globalAlpha = 1;

  // Water: deep and dark, with soft wet edges.
  const waterMask = makeCanvas(WORLD_W, WORLD_H);
  const wm = waterMask.getContext("2d")!;
  let hasWater = false;
  wm.fillStyle = "#000";
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== WATER) continue;
    hasWater = true;
    wm.beginPath();
    wm.roundRect((i % COLS) * TILE - 1, ((i / COLS) | 0) * TILE - 1, TILE + 2, TILE + 2, 6);
    wm.fill();
  }
  if (hasWater) {
    const water = makeCanvas(AW, AH);
    const wc = water.getContext("2d")!;
    const deep = wc.createLinearGradient(0, 0, 0, AH);
    deep.addColorStop(0, "#0b1726");
    deep.addColorStop(1, "#08111d");
    wc.fillStyle = deep;
    wc.fillRect(0, 0, AW, AH);
    wc.globalCompositeOperation = "overlay";
    wc.globalAlpha = 0.35;
    paintTexture(wc, groundTex, 7, 13);
    wc.globalAlpha = 1;
    wc.globalCompositeOperation = "destination-in";
    wc.imageSmoothingEnabled = true;
    wc.drawImage(waterMask, 0, 0, AW, AH);
    g.save();
    g.shadowColor = "rgba(0,0,0,0.75)";
    g.shadowBlur = 18;
    g.drawImage(water, 0, 0);
    g.restore();
  }

  const puddles = o.rain ? choosePuddles(map, o.seed) : [];
  for (const p of puddles) {
    const r = p.rx * ART;
    g.save();
    g.translate(p.x * ART, p.y * ART);
    g.scale(1, p.ry / p.rx);
    const pool = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    pool.addColorStop(0, "rgba(6,12,22,0.72)");
    pool.addColorStop(0.75, "rgba(8,14,26,0.55)");
    pool.addColorStop(1, "rgba(8,14,26,0)");
    g.fillStyle = pool;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    const shine = g.createRadialGradient(-r * 0.25, -r * 0.2, 0, -r * 0.25, -r * 0.2, r * 0.6);
    shine.addColorStop(0, "rgba(170,195,225,0.28)");
    shine.addColorStop(1, "rgba(170,195,225,0)");
    g.fillStyle = shine;
    g.fill();
    g.restore();
  }

  if (o.petals) {
    for (let k = 0; k < 140; k++) {
      const h = ihash(k, 3, o.seed);
      const x = (h % WORLD_W) * ART;
      const y = ((h >>> 9) % WORLD_H) * ART;
      const tx = Math.floor(x / T);
      const ty = Math.floor(y / T);
      if (!inside(tx, ty) || cells[at(tx, ty)] === WALL || cells[at(tx, ty)] === WATER) continue;
      g.save();
      g.translate(x, y);
      g.rotate(((h >>> 4) % 628) / 100);
      g.fillStyle = h % 3 ? "rgba(160,22,36,0.9)" : "rgba(214,110,124,0.9)";
      g.beginPath();
      g.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // 2. Walls: shadow on the ground, dark front face, lit rock top.
  const loose = looseRocks(cells);
  const shape = footprint(cells, loose);
  const walls = makeCanvas(AW, AH);
  const w = walls.getContext("2d")!;
  w.imageSmoothingEnabled = true;
  w.imageSmoothingQuality = "high";
  const shadowOf = (path: Path2D, blur: number, dx: number, dy: number, alpha: number) => {
    w.save();
    w.shadowColor = `rgba(0,0,0,${alpha})`;
    w.shadowBlur = blur;
    w.shadowOffsetX = dx + 40000;
    w.shadowOffsetY = dy;
    w.translate(-40000, 0);
    w.fillStyle = "#000";
    w.fill(path);
    w.restore();
  };
  shadowOf(shape, 56, 0, 10, 0.7);
  shadowOf(shape, 22, 16, 30, 0.8);

  // Front face: the whole footprint in dark rock; the raised top covers all but its lower band.
  w.save();
  w.clip(shape);
  paintTexture(w, rockTex, 3.2, 11);
  w.fillStyle = "rgba(2,2,6,0.8)";
  w.fillRect(0, 0, AW, AH);
  const raised = new Path2D();
  raised.addPath(shape, new DOMMatrix().translate(0, -FACE));
  w.save();
  w.clip(raised);
  paintTexture(w, rockTex, 3.2);
  w.globalCompositeOperation = "color";
  w.globalAlpha = 0.5;
  w.drawImage(color, 0, 0, AW, AH);
  w.globalCompositeOperation = "multiply";
  w.globalAlpha = 1;
  w.drawImage(light, 0, 0, AW, AH);
  w.globalCompositeOperation = "source-over";
  // A lit rim along the top's edges, and a fine bright lip where the face begins.
  const outsideTop = new Path2D();
  outsideTop.rect(-200, -200, AW + 400, AH + 400);
  outsideTop.addPath(raised);
  w.fillStyle = "#000";
  w.shadowColor = "rgba(225,232,245,0.6)";
  w.shadowBlur = 8;
  w.shadowOffsetY = 6;
  w.fill(outsideTop, "evenodd");
  w.shadowColor = "rgba(255,248,236,0.7)";
  w.shadowBlur = 3;
  w.shadowOffsetY = -4;
  w.fill(outsideTop, "evenodd");
  w.restore();
  // The face darkens toward the ground.
  const outside = new Path2D();
  outside.rect(-200, -200, AW + 400, AH + 400);
  outside.addPath(shape);
  w.fillStyle = "#000";
  w.shadowColor = "rgba(0,0,0,0.85)";
  w.shadowBlur = 16;
  w.shadowOffsetY = -12;
  w.fill(outside, "evenodd");
  w.restore();

  // Loose rocks.
  for (const i of loose) {
    const x = (i % COLS) * T;
    const y = ((i / COLS) | 0) * T;
    const h = ihash(i, 5, o.seed);
    const size = T * (1.45 + (h % 25) / 100);
    w.save();
    w.shadowColor = "rgba(0,0,0,0.7)";
    w.shadowBlur = 20;
    w.shadowOffsetX = 12;
    w.shadowOffsetY = 18;
    if (tex.boulder) {
      const aspect = tex.boulder.naturalHeight / tex.boulder.naturalWidth;
      w.translate(x + T / 2, y + T * 1.02);
      if (h & 1) w.scale(-1, 1);
      w.drawImage(tex.boulder, -size / 2, -size * aspect, size, size * aspect);
    } else {
      const rock = new Path2D();
      rock.ellipse(x + T / 2, y + T * 0.55, size * 0.46, size * 0.4, 0, 0, Math.PI * 2);
      w.fillStyle = "#1b1c22";
      w.fill(rock);
      w.shadowColor = "transparent";
      w.clip(rock);
      paintTexture(w, rockTex, 2.4, h % 50);
      const lit = w.createRadialGradient(x + T * 0.35, y + T * 0.3, 0, x + T / 2, y + T * 0.55, size * 0.5);
      lit.addColorStop(0, "rgba(255,255,255,0.18)");
      lit.addColorStop(1, "rgba(0,0,0,0.45)");
      w.fillStyle = lit;
      w.fill(rock);
    }
    w.restore();
  }

  return { ground, walls, gloom, puddles };
}

/** A soft, seamless 128 x 128 tile of fog. */
export function fogTile(seed: number) {
  const S = 128;
  const coarse = valueNoise(seed, 4);
  const fine = valueNoise(seed ^ 0x33, 8);
  const c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = coarse(x / 32, y / 32) * 0.7 + fine(x / 16, y / 16) * 0.3;
      const a = Math.max(0, Math.min(1, (n - 0.38) / 0.4));
      const i = (y * S + x) * 4;
      img.data[i] = 30;
      img.data[i + 1] = 22;
      img.data[i + 2] = 44;
      img.data[i + 3] = a * a * 190;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** A soft round puff, to build the shadows out of smoke. */
export function puff(color: string) {
  const S = 64;
  const c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const [r, gg, b] = hexRgb(color);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(0.45, `rgba(${r},${gg},${b},0.8)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return c;
}

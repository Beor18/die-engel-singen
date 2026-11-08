/**
 * Hand-made pixel art. Each sprite is a list of rows where every character is
 * a color from its palette, and "." is transparent. Rows shorter than the
 * sprite width are padded, so a typo can't break the game.
 *
 * Light comes from the top left: highlights on that side, shade on the other,
 * and a dark outline around everything so characters read on any floor.
 */

type Palette = Record<string, string>;
type Rows = readonly string[];

const VOICE: Palette = {
  o: "#1a1220",
  h: "#2e2438",
  H: "#54466c",
  s: "#f3d9bd",
  S: "#d6a98a",
  w: "#f7f0e2",
  m: "#ddd0b5",
  d: "#b0a083",
  D: "#7d6f58",
  r: "#c7242f",
  R: "#8a0f18",
  p: "#ef6a5c",
  b: "#3b2b2c",
};

const HEAD_TOP: Rows = [
  "................",
  "................",
  "................",
  ".....oooooo.....",
  "....ohHHhhho....",
  "...ohHHhhhhho...",
  "..ohHhhhhhhhho..",
];

const CLOAK_BOTTOM: Rows = [
  ".owmmmmmmmmmddo.",
  ".owmmmmmmmmdddo.",
  ".odmmmmmmmmddDo.",
  ".oddddddddddDDo.",
  "..oooooooooooo..",
];

const DOWN: Rows = [
  ...HEAD_TOP,
  "..ohhhssssshho..",
  "..ohsossssosho..",
  "..ohsossssosho..",
  "...oSssssssSo...",
  "...oprrrrrrRo...",
  "..owprrrrrRRdo..",
  "..owwmprRmmmdo..",
  "..owwmmpRmmmdo..",
  ".owwmmmmRmmmddo.",
  ".owwmmmmmmmmddo.",
  ...CLOAK_BOTTOM,
];

const UP: Rows = [
  ...HEAD_TOP,
  "..ohhhhhhhhhho..",
  "..ohHhhhhhhhho..",
  "..ohhhhhhhhhho..",
  "...ohhhhhhhho...",
  "...orrrrrrrRo...",
  "..owrrrrrrRRdo..",
  "..owwmmrRmmmdo..",
  "..owwmmrRmmmdo..",
  ".owwmmmrRmmmddo.",
  ".owwmmmRRmmmddo.",
  ...CLOAK_BOTTOM,
];

const LEFT: Rows = [
  "................",
  "................",
  "................",
  ".....oooooo.....",
  "....ohhHHhho....",
  "...ohhHHHhhho...",
  "..ohhHHhhhhhho..",
  "..ossshhhhhhho..",
  "..ososshhhhhho..",
  "..ososshhhhhho..",
  "...oSssShhhho...",
  "...oprrrrrrRo...",
  "...owprrrrRdo...",
  "...owwmmmmmdo...",
  "..owwmmmmmmddo..",
  "..owwmmmmmmddo..",
  "..owmmmmmmmddo..",
  "..owmmmmmmmddo..",
  "..odmmmmmmdddo..",
  "..odmmmmmmdddo..",
  "..oddddddddDDo..",
  "...ooooooooooo..",
];

const FEET = {
  front: ["....obo..obo....", "....obo.........", ".........obo...."],
  side: [".....obbo.......", "...obo...obo....", "....obo.obo....."],
};

const ANGEL: Palette = {
  o: "#2a2430",
  h: "#ead59c",
  H: "#c4a462",
  s: "#f2e0cc",
  S: "#cdb09a",
  w: "#fcf9f2",
  m: "#e2ddd2",
  d: "#b5afa1",
  D: "#878171",
  W: "#ffffff",
  V: "#d8deea",
  v: "#9ba5bb",
  r: "#98121a",
  R: "#c7242f",
  g: "#ffe9a8",
};

const ANGEL_BODY: Rows = [
  "........................",
  ".........gggggg.........",
  "........g......g........",
  ".........gggggg.........",
  "..........oooo..........",
  ".........ohhhho.........",
  "........ohhHhhho........",
  "........ohssssho........",
  "........ohossoho........",
  "........ohSssSho........",
  ".........oSSSSo.........",
  ".........owwwwo.........",
  "........owwmmmdo........",
  ".......owwmrRmmdo.......",
  ".......owwmrRmmdo.......",
  ".......owmmrRmmdo.......",
  ".......owmmmmmmdo.......",
  "......owwmmmmmmddo......",
  "......owmmmmmmmddo......",
  "......owmmmmmmmddo......",
  ".....owmmmmmmmmdddo.....",
  ".....odmmmmmmmmddDo.....",
  ".....oddddddddddDDo.....",
  "......oooooooooooo......",
];

const WING: Rows = [
  "o........",
  "oo.......",
  "oWo......",
  "oWVo.....",
  "oWVVo....",
  "oWWVvo...",
  "oWWVVvo..",
  ".oWWVVvo.",
  ".oWWWVvvo",
  ".oWWVVvvo",
  "..oWVVvvo",
  "..oWVvvo.",
  "..oWVvo..",
  "...oVvo..",
  "...oVo...",
  "....oo...",
];

const FEATHER: Palette = { o: "#3a2a14", y: "#c9a45c", Y: "#f3d58a", W: "#fff6dc", w: "#8c6a34" };

const FEATHER_ROWS: Rows = [
  "....o....",
  "...oWo...",
  "..oWYyo..",
  "..oWwyo..",
  ".oWYwyyo.",
  ".oWYwyyo.",
  ".oWYwyyo.",
  ".oWYwyyo.",
  "..oYwyo..",
  "..oYwyo..",
  "...owo...",
  "....w....",
  "....w....",
  "....o....",
];

const LAMP_ROWS: Rows = [
  "...oooo...",
  "..offffo..",
  ".offffffo.",
  ".oooooooo.",
  "..oYWWYo..",
  "..oYWWYo..",
  "..oyYYyo..",
  ".oooooooo.",
  "..oFFFFo..",
  "...oFFo...",
  ...Array.from({ length: 12 }, () => "...oPpo..."),
  "..oPPppo..",
  ".oPPPpppo.",
  ".oooooooo.",
];

/** Height of the lamp sprite, to stand it on its tile. */
export const LAMP_HEIGHT = LAMP_ROWS.length;

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function paint(ctx: CanvasRenderingContext2D, rows: Rows, palette: Palette, ox = 0, oy = 0, flip = false) {
  const width = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const color = palette[row[x] ?? "."];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + (flip ? width - 1 - x : x), oy + y, 1, 1);
    }
  });
}

function draw(rows: Rows, palette: Palette, flip = false) {
  const c = makeCanvas(Math.max(...rows.map((r) => r.length)), rows.length);
  paint(c.getContext("2d")!, rows, palette, 0, 0, flip);
  return c;
}

function mix(hex: string, other: string, amount: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(a, s) * (1 - amount) + ch(b, s) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const discs = new Map<string, HTMLCanvasElement>();

/** A filled pixel circle of radius `r`, cached. */
export function disc(r: number, color: string) {
  const key = `${r}${color}`;
  let c = discs.get(key);
  if (!c) {
    c = makeCanvas(2 * r + 1, 2 * r + 1);
    const g = c.getContext("2d")!;
    g.fillStyle = color;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) g.fillRect(x + r, y + r, 1, 1);
    discs.set(key, c);
  }
  return c;
}

/** A filled pixel ellipse, cached. Used for shadows on the ground. */
export function ellipse(rx: number, ry: number, color: string) {
  const key = `e${rx},${ry}${color}`;
  let c = discs.get(key);
  if (!c) {
    c = makeCanvas(2 * rx + 1, 2 * ry + 1);
    const g = c.getContext("2d")!;
    g.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const dx = x / (rx + 0.5);
        const dy = y / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) g.fillRect(x + rx, y + ry, 1, 1);
      }
    }
    discs.set(key, c);
  }
  return c;
}

/** The book's four-pointed star as crisp pixels, with a light core and an outline. */
function star(scale: number, fill: string, core: string, outline: string) {
  // Taller than wide, like the star in the book; at small sizes a square one reads as a cross.
  const sx = scale * 0.72;
  const sy = scale * 1.15;
  const h = Math.ceil(18 * sy) + 1;
  const w = Math.ceil(14 * sx) + 1;
  const shape = makeCanvas(w, h);
  const s = shape.getContext("2d", { willReadFrequently: true })!;
  s.translate(w / 2, h / 2);
  s.scale(sx, sy);
  s.fillStyle = "#000";
  s.fill(new Path2D(STAR));
  const alpha = s.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && alpha[(y * w + x) * 4 + 3] > 110;
  const out = makeCanvas(w + 2, h + 2);
  const g = out.getContext("2d")!;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) {
        const near = Math.abs(x - cx) * 1.6 + Math.abs(y - cy) <= Math.max(1, Math.round(scale * 2));
        g.fillStyle = near ? core : fill;
      } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        g.fillStyle = outline;
      } else continue;
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  return out;
}

const SMOKE_DARK = "#06030a";
const SMOKE_BODY = "#1b1126";
const SMOKE_LIGHT = "#33223f";

/** Where a shadow's eyes are, from the point where it stands. */
export const SMOKE_EYES = [
  [-3, -9],
  [2, -9],
] as const;

/**
 * A shadow: a knot of smoke that never holds still. Puffs are drawn first as
 * outlines, then filled, so they merge into one silhouette.
 */
export function drawSmoke(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, phase: number, calm = 1) {
  const core = [
    [0, -8, 5],
    [-3, -4, 4],
    [3, -4, 4],
    [0, -12, 3],
    [-3, -1, 3],
    [3, -1, 3],
  ];
  const puffs: number[][] = core.map(([x, y, r], k) => [
    x + Math.sin(t * 2.1 + phase + k) * 0.9 * calm,
    y + Math.cos(t * 1.7 + phase + k * 1.3) * 0.9 * calm,
    r,
  ]);
  for (let k = 0; k < 3; k++) {
    const s = (t * 1.2 + phase + k / 3) % 1;
    puffs.push([(k - 1) * 3 + Math.sin(t * 3 + k) * calm, 2 + s * 3, s < 0.5 ? 2 : 1]);
  }
  for (const [x, y, r] of puffs) ctx.drawImage(disc(r + 1, SMOKE_DARK), Math.round(cx + x) - r - 1, Math.round(cy + y) - r - 1);
  for (const [x, y, r] of puffs) ctx.drawImage(disc(r, SMOKE_BODY), Math.round(cx + x) - r, Math.round(cy + y) - r);
  for (const [x, y, r] of puffs.slice(0, 4)) {
    if (r >= 3) ctx.drawImage(disc(r - 2, SMOKE_LIGHT), Math.round(cx + x) - r + 1, Math.round(cy + y) - r + 1);
  }
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = SMOKE_BODY;
  for (let k = 0; k < 4; k++) {
    const s = (t * 0.7 + phase * 0.3 + k / 4) % 1;
    ctx.globalAlpha = alpha * (1 - s);
    const size = 1 + (k & 1);
    ctx.fillRect(Math.round(cx + Math.sin(k * 2.4 + t * 1.5) * 4), Math.round(cy - 15 - s * 9), size, size);
  }
  ctx.globalAlpha = alpha;
}

export type Sprites = {
  /** Per direction: standing, then two steps. */
  voice: Record<"up" | "down" | "left" | "right", HTMLCanvasElement[]>;
  /** Wings up and wings down. */
  angel: HTMLCanvasElement[];
  feather: HTMLCanvasElement;
  lamp: (color: string, lit: boolean, frame: number) => HTMLCanvasElement;
  starRed: HTMLCanvasElement;
  starBig: HTMLCanvasElement;
  starGold: HTMLCanvasElement;
};

function withFeet(rows: Rows, feet: string, bottom: number) {
  const out = [...rows];
  while (out.length <= bottom) out.push("");
  out[bottom] = feet;
  return out;
}

function angelFrame(lift: number) {
  const c = makeCanvas(24, 26);
  const g = c.getContext("2d")!;
  paint(g, WING, ANGEL, 0, 3 + lift);
  paint(g, WING, ANGEL, 15, 3 + lift, true);
  paint(g, ANGEL_BODY, ANGEL);
  return c;
}

export function buildSprites(): Sprites {
  const walk = (rows: Rows, feet: string[], flip = false) => feet.map((f) => draw(withFeet(rows, f, 22), VOICE, flip));
  const lamps = new Map<string, HTMLCanvasElement>();
  return {
    voice: {
      down: walk(DOWN, FEET.front),
      up: walk(UP, FEET.front),
      left: walk(LEFT, FEET.side),
      right: walk(LEFT, FEET.side, true),
    },
    angel: [angelFrame(0), angelFrame(2)],
    feather: draw(FEATHER_ROWS, FEATHER),
    lamp: (color, lit, frame) => {
      const key = `${color}${lit ? 1 : 0}${frame}`;
      let c = lamps.get(key);
      if (!c) {
        c = draw(LAMP_ROWS, {
          o: "#120e0c",
          f: "#4a3c30",
          F: "#2c241d",
          P: "#43382f",
          p: "#241d18",
          Y: lit ? mix(color, "#ffffff", frame ? 0.3 : 0.42) : mix(color, "#000000", 0.62),
          W: lit ? (frame ? "#ffe9b8" : "#fffaf0") : mix(color, "#000000", 0.45),
          y: lit ? color : mix(color, "#000000", 0.75),
        });
        lamps.set(key, c);
      }
      return c;
    },
    starRed: star(0.62, "#98121a", "#d8373f", "#2a0508"),
    starBig: star(0.9, "#98121a", "#d8373f", "#2a0508"),
    starGold: star(0.9, "#f2cf7a", "#fffaf0", "#5a3e10"),
  };
}

/** The four-pointed star of the book's ornament, centered on 0,0 and 18 units tall. */
export const STAR = "M0 -9C-1 -2 -3 -1 -7 0C-3 1 -1 2 0 9C1 2 3 1 7 0C3 -1 1 -2 0 -9Z";

/**
 * Hand-made pixel art. Each sprite is a list of rows where every character is
 * a color from its palette, and "." is transparent. Rows shorter than the
 * sprite width are padded, so a typo can't break the game.
 */

type Palette = Record<string, string>;

const VOICE: Palette = {
  k: "#0b0a10",
  c: "#262a39",
  C: "#3b4054",
  h: "#5a6380",
  f: "#14141c",
  e: "#f2e6c8",
  r: "#98121a",
  R: "#c7242f",
  l: "#7a5a30",
  L: "#ffd98a",
  y: "#fff6d8",
};

const DOWN = [
  "......kkkk......",
  ".....kChhCk.....",
  "....kChhhhCk....",
  "...kCCkkkkCCk...",
  "...kCkffffkCk...",
  "...kCkfefekCk...",
  "...kCCkffkCCk...",
  "..kcCCCrRCCCck..",
  "..kcCCCRrCCCck..",
  "..kccCCCCCCcclk.",
  "..kccCCCCCCckLLk",
  "..kccCCCCCCckLyk",
  "...kcccccccckLk.",
  "...kkcccccckkk..",
  "....kkk..kkk....",
  "................",
];

const UP = [
  "......kkkk......",
  ".....kChhCk.....",
  "....kChhhhCk....",
  "...kCChhhhCCk...",
  "...kCChhhhCCk...",
  "...kCCChhCCCk...",
  "...kCCCCCCCCk...",
  "..kcCCCCCCCCck..",
  "..kcCCCrrCCCck..",
  "..kccCCrCCCcclk.",
  "..kccCCCCCCckLLk",
  "..kccCCCCCCckLyk",
  "...kcccccccckLk.",
  "...kkcccccckkk..",
  "....kkk..kkk....",
  "................",
];

const LEFT = [
  "......kkkk......",
  ".....khhCCk.....",
  "....khhhCCCk....",
  "...kkkkCCCCCk...",
  "...kffkCCCCCk...",
  "...kefkCCCCCk...",
  "...kffkCCCCk....",
  "...kkCCCCCCck...",
  "..klkCCrRCCcck..",
  ".kLLkCCRCCCcck..",
  ".kLykcCCCCCcck..",
  "..kLkcCCCCCcck..",
  "...kccCCCCccck..",
  "...kkcccccccck..",
  "....kkk..kkk....",
  "................",
];

const ANGEL: Palette = {
  k: "#1c1a22",
  s: "#e6dccf",
  e: "#5b5048",
  w: "#d8d4cc",
  W: "#9d9a94",
  r: "#98121a",
};

const ANGEL_ROWS = [
  "......kkkk......",
  ".....kssssk.....",
  "..k..kseesk..k..",
  ".kwk.kssssk.kwk.",
  ".kwwk.kssk.kwwk.",
  "kwwWwkkwwkkwWwwk",
  "kwWWwkwwwwkwWWwk",
  "kwWwkwwrrwwkwWwk",
  ".kwkwwwrrwwwkwk.",
  ".kk.kwwwwwwk.kk.",
  "....kwwWWwwk....",
  "....kwwWWwwk....",
  "...kwwwWWwwwk...",
  "...kwwWWWWwwk...",
  "...kkkkkkkkkk...",
  "................",
];

const SHADOW: Palette = { k: "#050308", S: "#120d18", s: "#2a1f33", E: "#ff2a36" };

const SHADOW_A = [
  "................",
  "......kkkk......",
  "....kkSSSSkk....",
  "...kSSSssSSSk...",
  "..kSSsSSSSsSSk..",
  "..kSSEESSEESSk..",
  "..kSSSSSSSSSSk..",
  ".kSSsSSSSSSsSSk.",
  ".kSSSSSssSSSSSk.",
  ".kSsSSSSSSSSsSk.",
  "kSSSSsSSSSsSSSSk",
  "kSSsSSSSSSSSsSSk",
  "kSkSSSkSSkSSSkSk",
  ".k.kSk.kk.kSk.k.",
  "....k......k....",
  "................",
];

const SHADOW_B = [
  ...SHADOW_A.slice(0, 12),
  "kSSkSSSkkSSSkSSk",
  "..kSk.kSSk.kSk..",
  ".....k....k.....",
  "................",
];

/** Centers of the shadow's eyes inside its sprite, drawn again over the dark. */
export const SHADOW_EYES = [
  [6, 5.5],
  [10, 5.5],
] as const;

const FEATHER: Palette = { y: "#b89a5a", L: "#fff1c2", W: "#e0c890", w: "#8a6a3a" };

const FEATHER_ROWS = [
  "....y....",
  "...yLy...",
  "..yLLLy..",
  "..yLWLy..",
  "..yLWLy..",
  ".yLLWLLy.",
  ".yLLWLLy.",
  "..yLWLy..",
  "..yLWLy..",
  "...yWy...",
  "....w....",
  "...w.....",
  "..w......",
];

const LAMP_ROWS = [
  ".......kk.......",
  "......kkkk......",
  ".....kYYYYk.....",
  ".....kYWWYk.....",
  ".....kYWWYk.....",
  ".....kYYYYk.....",
  "......kkkk......",
  ".......mm.......",
  ".......mm.......",
  ".......mm.......",
  ".......mm.......",
  ".......mm.......",
  "......mmmm......",
  ".....kmmmmk.....",
  "....kkkkkkkk....",
  "................",
];

function withFeet(rows: string[], feet: string) {
  return [...rows.slice(0, 14), feet, rows[15]];
}

function draw(rows: string[], palette: Palette, flip = false) {
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const color = palette[row[x] ?? "."];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? width - 1 - x : x, y, 1, 1);
    }
  });
  return canvas;
}

function mix(hex: string, other: string, amount: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(a, s) * (1 - amount) + ch(b, s) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export type Sprites = {
  voice: Record<"up" | "down" | "left" | "right", HTMLCanvasElement[]>;
  angel: HTMLCanvasElement;
  shadow: HTMLCanvasElement[];
  feather: HTMLCanvasElement;
  lamp: (color: string) => HTMLCanvasElement;
};

export function buildSprites(): Sprites {
  const frames = (rows: string[], flip = false) =>
    [rows, withFeet(rows, "....kkk...kk...."), withFeet(rows, "....kk...kkk....")].map((r) => draw(r, VOICE, flip));
  const lamps = new Map<string, HTMLCanvasElement>();
  return {
    voice: { down: frames(DOWN), up: frames(UP), left: frames(LEFT), right: frames(LEFT, true) },
    angel: draw(ANGEL_ROWS, ANGEL),
    shadow: [draw(SHADOW_A, SHADOW), draw(SHADOW_B, SHADOW)],
    feather: draw(FEATHER_ROWS, FEATHER),
    lamp: (color: string) => {
      let c = lamps.get(color);
      if (!c) {
        c = draw(LAMP_ROWS, { k: "#14100c", m: "#2a2420", Y: mix(color, "#ffffff", 0.35), W: "#fff8e6" });
        lamps.set(color, c);
      }
      return c;
    },
  };
}

/** The four-pointed star of the book's ornament, centered on 0,0 and 18 units tall. */
export const STAR = "M0 -9C-1 -2 -3 -1 -7 0C-3 1 -1 2 0 9C1 2 3 1 7 0C3 -1 1 -2 0 -9Z";



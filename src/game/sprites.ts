/**
 * Small hand-made figures, drawn only if the painted images of public/juego/arte
 * fail to load. Each sprite is a list of rows where every character is a color
 * from its palette, and "." is transparent.
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

export type Sprites = {
  /** Per direction: standing, then two steps. */
  voice: Record<"up" | "down" | "left" | "right", HTMLCanvasElement[]>;
  /** Wings up and wings down. */
  angel: HTMLCanvasElement[];
  feather: HTMLCanvasElement;
  lamp: (color: string, lit: boolean, frame: number) => HTMLCanvasElement;
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
  };
}

/** The four-pointed star of the book's ornament, centered on 0,0 and 18 units tall. */
export const STAR = "M0 -9C-1 -2 -3 -1 -7 0C-3 1 -1 2 0 9C1 2 3 1 7 0C3 -1 1 -2 0 -9Z";

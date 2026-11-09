import { makeCanvas, puff } from "./art";
import { STAR } from "./sprites";

/**
 * The painted images of the game, and soft shapes drawn in code: shadows of
 * smoke, the book's star and the shadows that things cast on the ground.
 * Images live in public/juego/arte. If one fails to load, the game draws a
 * simpler stand-in instead of stopping.
 */

export type Painted = {
  ground: HTMLImageElement | null;
  rock: HTMLImageElement | null;
  boulder: HTMLImageElement | null;
  voiceFront: HTMLImageElement | null;
  voiceBack: HTMLImageElement | null;
  voiceSide: HTMLImageElement | null;
  angel: HTMLImageElement | null;
  lamp: HTMLImageElement | null;
  /** The lamp before it is lit: the same image, darker. */
  lampDark: HTMLCanvasElement | null;
  feather: HTMLImageElement | null;
  /** The Voice cut into a body and a leg for each view, so it can walk. */
  voice: Record<View, VoiceParts> | null;
};

export type View = "front" | "back" | "side";

type Poly = [number, number][];

/** How each painting of the Voice is cut, in its own pixels. The images are 280 pixels tall and stand on y = 280. */
type LegCut = {
  /** Outline of the painted leg reused for both legs. */
  leg: Poly;
  /** What to erase from the body: the legs as they were painted. */
  erase: Poly[];
  /** Where the leg comes out of the cloak, and the middle of the shin there. */
  top: number;
  shin: number;
  /** Where each leg hangs from in the body. */
  hips: [number, number];
  hipY: number;
  /** Turns the leg until it stands straight with the sole flat. */
  turn: number;
  /** Lengthens the leg so it reaches the ground from where it hangs. */
  stretch: number;
  /** Above this line the cloak doesn't sway. */
  waist: number;
};

const CUTS: Record<View, LegCut> = {
  front: {
    leg: [[66, 222], [86, 222], [86, 232], [95, 236], [95, 281], [55, 281], [55, 247], [66, 245]],
    erase: [
      [[64, 222], [87, 222], [87, 233], [97, 237], [97, 282], [53, 282], [53, 247], [64, 245]],
      [[49, 216], [67, 216], [67, 248], [47, 248]],
    ],
    top: 222,
    shin: 76,
    hips: [57, 79],
    hipY: 222,
    turn: 0,
    stretch: 1,
    waist: 140,
  },
  back: {
    leg: [[51, 222], [72, 222], [73, 248], [81, 250], [81, 281], [53, 281], [49, 250]],
    erase: [[[49, 223], [87, 223], [87, 251], [83, 251], [83, 282], [51, 282], [47, 250]]],
    top: 222,
    shin: 62,
    hips: [60, 81],
    hipY: 222,
    turn: 0,
    stretch: 1,
    waist: 140,
  },
  side: {
    leg: [[96, 229], [113, 229], [117, 242], [131, 250], [131, 281], [89, 281], [89, 258], [100, 246]],
    erase: [
      [[28, 230], [51, 230], [51, 247], [48, 282], [0, 282], [0, 252], [22, 240]],
      [[93, 229], [116, 229], [125, 246], [133, 250], [133, 282], [87, 282], [87, 258], [97, 246]],
    ],
    top: 229,
    shin: 105,
    hips: [76, 80],
    hipY: 233,
    turn: 0.237,
    stretch: 1.08,
    waist: 130,
  },
};

/** How many pixels above each cut the painted leg fades out, so it doesn't end in a straight line. */
const FEATHER = 6;

/** How far the leg reaches up under the cloak, so it never shows a gap while it moves. */
const REACH = 32;

export type VoiceParts = {
  body: HTMLCanvasElement;
  leg: HTMLCanvasElement;
  legDark: HTMLCanvasElement;
  /** The point of the leg that hangs from the hip. */
  pivot: { x: number; y: number };
  cut: LegCut;
};

function trace(g: CanvasRenderingContext2D, poly: Poly) {
  g.beginPath();
  poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

function cutVoice(img: HTMLImageElement, cut: LegCut): VoiceParts {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const body = makeCanvas(w, h);
  const b = body.getContext("2d")!;
  b.drawImage(img, 0, 0);
  b.globalCompositeOperation = "destination-out";
  for (const shape of cut.erase) {
    b.fillStyle = "#000";
    trace(b, shape);
    b.fill();
    const top = Math.min(...shape.map(([, y]) => y));
    const edge = shape.filter(([, y]) => y === top).map(([x]) => x);
    const fade = b.createLinearGradient(0, top - FEATHER, 0, top);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,0.9)");
    b.fillStyle = fade;
    b.fillRect(Math.min(...edge), top - FEATHER, Math.max(...edge) - Math.min(...edge), FEATHER);
  }

  const xs = cut.leg.map(([x]) => x);
  const x0 = Math.floor(Math.min(...xs));
  const lw = Math.ceil(Math.max(...xs)) - x0;
  const lh = h - cut.top;
  const only = makeCanvas(lw, lh);
  const o = only.getContext("2d")!;
  o.translate(-x0, -cut.top);
  trace(o, cut.leg);
  o.clip();
  o.drawImage(img, 0, 0);

  const leg = makeCanvas(lw, lh + REACH);
  const g = leg.getContext("2d")!;
  // The shin goes on up under the cloak: its first rows, stretched.
  g.drawImage(only, 0, 0, lw, 5, 0, 0, lw, REACH + 2);
  g.drawImage(only, 0, REACH);
  return { body, leg, legDark: darker(leg, 0.6), pivot: { x: cut.shin - x0, y: REACH }, cut };
}

export type VoicePose = {
  /** How far the body sinks and sways, in image pixels. */
  drop: number;
  sway: number;
  /** How much the bottom of the cloak trails, per pixel below the waist. */
  shear: number;
  legs: { x: number; y: number; angle: number; mirror: boolean; shade: number }[];
};

/**
 * Where everything goes at a moment of the walk. `phase` advances by π each
 * step, `walk` goes from 0 (standing) to 1 (walking) and `t` is the clock,
 * for breathing while still.
 */
export function voicePose(v: VoiceParts, view: View, phase: number, walk: number, t: number): VoicePose {
  const { cut } = v;
  const s = Math.sin(phase);
  const breath = Math.sin(t * 2) * 1.6 * (1 - walk);
  if (view === "side") {
    const length = 279 - cut.hipY + 3;
    const swing = 0.55 * walk * s;
    const drop = length * (1 - Math.cos(swing));
    const legs = [0, 1].map((i) => {
      const angle = cut.turn + (i ? -swing : swing);
      const lift = Math.max(0, Math.cos(phase + i * Math.PI)) * 5 * walk;
      return { x: cut.hips[i], y: cut.hipY + drop - lift, angle, mirror: false, shade: i ? 0.55 : 0 };
    });
    return { drop: drop + breath, sway: 0, shear: (0.07 + 0.03 * Math.sin(phase * 2)) * walk, legs: [legs[1], legs[0]] };
  }
  // Seen from the front, the leg that steps forward comes down the screen; from the back, up.
  const toward = view === "front" ? 1 : -1;
  const legs = [0, 1].map((i) => {
    const step = Math.sin(phase + i * Math.PI);
    const lift = Math.max(0, Math.cos(phase + i * Math.PI)) * 8 * walk;
    return {
      x: cut.hips[i],
      y: cut.hipY + step * toward * 4.5 * walk - lift,
      angle: 0,
      mirror: i === 0,
      shade: Math.max(0, -step * toward) * 0.35 * walk,
    };
  });
  legs.sort((a, b) => a.y - b.y);
  return {
    drop: 3 * s * s * walk + breath,
    sway: 1.4 * s * walk,
    shear: 0.05 * Math.sin(phase - 0.6) * walk,
    legs,
  };
}

/** Draws the Voice standing on (x, y), `height` tall, with its legs and cloak where `pose` says. */
export function drawVoice(ctx: CanvasRenderingContext2D, v: VoiceParts, x: number, y: number, height: number, flip: boolean, pose: VoicePose) {
  const { body, leg, legDark, pivot, cut } = v;
  const k = height / body.height;
  const alpha = ctx.globalAlpha;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -k : k, k);
  ctx.translate(-body.width / 2, -body.height);
  for (const l of pose.legs) {
    ctx.save();
    ctx.translate(l.x, l.y);
    if (l.angle) ctx.rotate(l.angle);
    ctx.scale(l.mirror ? -1 : 1, cut.stretch);
    ctx.drawImage(leg, -pivot.x, -pivot.y);
    if (l.shade > 0.01) {
      ctx.globalAlpha = alpha * l.shade;
      ctx.drawImage(legDark, -pivot.x, -pivot.y);
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  }
  ctx.translate(pose.sway, pose.drop);
  const w = body.width;
  const waist = cut.waist;
  ctx.drawImage(body, 0, 0, w, waist + 1, 0, 0, w, waist + 1);
  ctx.transform(1, 0, pose.shear, 1, -pose.shear * waist, 0);
  ctx.drawImage(body, 0, waist, w, body.height - waist, 0, waist, w, body.height - waist);
  ctx.restore();
}

const FILES = {
  ground: "suelo.webp",
  rock: "roca.webp",
  boulder: "piedra.webp",
  voiceFront: "voz-frente.webp",
  voiceBack: "voz-espalda.webp",
  voiceSide: "voz-perfil.webp",
  angel: "angel.webp",
  lamp: "farol.webp",
  feather: "pluma.webp",
} as const;

let loading: Promise<Painted> | null = null;

function image(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function darker(img: HTMLImageElement | HTMLCanvasElement, amount: number) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = `rgba(4,4,10,${amount})`;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Loads every painted image once; later levels reuse them. */
export function loadPainted(): Promise<Painted> {
  loading ??= (async () => {
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, file]) => [key, await image(`/juego/arte/${file}`)] as const),
    );
    const got = Object.fromEntries(entries) as Record<keyof typeof FILES, HTMLImageElement | null>;
    const { voiceFront: front, voiceBack: back, voiceSide: side } = got;
    const voice =
      front && back && side ? { front: cutVoice(front, CUTS.front), back: cutVoice(back, CUTS.back), side: cutVoice(side, CUTS.side) } : null;
    return { ...got, lampDark: got.lamp ? darker(got.lamp, 0.5) : null, voice };
  })();
  return loading;
}

let blob: HTMLCanvasElement | null = null;

/** A soft dark ellipse, for the shadow of something standing on the ground. */
export function groundShadow() {
  if (!blob) {
    blob = makeCanvas(64, 64);
    const g = blob.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,0.75)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.4)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return blob;
}

/** Draws an image standing on (x, y) with the given height, mirrored if asked. */
export function stand(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  height: number,
  o: { flip?: boolean; tilt?: number; squash?: number } = {},
) {
  const width = (height * img.width) / img.height;
  ctx.save();
  ctx.translate(x, y);
  if (o.tilt) ctx.rotate(o.tilt);
  ctx.scale(o.flip ? -1 : 1, 1);
  const sq = o.squash ?? 1;
  ctx.drawImage(img, -width / 2 / sq, -height * sq, width / sq, height * sq);
  ctx.restore();
}

let smoke: { dark: HTMLCanvasElement; body: HTMLCanvasElement; light: HTMLCanvasElement } | null = null;

/** Where a shadow's eyes are, from the point where it stands. */
export const SMOKE_EYES = [
  [-2.6, -12],
  [2.6, -12],
] as const;

/** A shadow: soft smoke that never holds still, darker at its heart. */
export function drawSmoke(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, phase: number, calm = 1) {
  smoke ??= { dark: puff("#050308"), body: puff("#120b1a"), light: puff("#3a2a48") };
  const { dark, body: fill, light } = smoke;
  const body: [number, number, number][] = [
    [0, -11, 7],
    [-4, -6, 6],
    [4, -6, 6],
    [0, -16, 5],
    [-4, -1, 5],
    [4, -1, 5],
    [0, -3, 6],
  ];
  const alpha = ctx.globalAlpha;
  const at = (k: number, x: number, y: number) => [
    cx + x + Math.sin(t * 2.1 + phase + k) * 1.1 * calm,
    cy + y + Math.cos(t * 1.7 + phase + k * 1.3) * 1.1 * calm,
  ];
  // Wisps rising from the top and trailing at the bottom.
  for (let k = 0; k < 6; k++) {
    const s = (t * 0.55 + phase * 0.2 + k / 6) % 1;
    const r = 4 * (1 - s) + 1.5;
    ctx.globalAlpha = alpha * (1 - s) * 0.7;
    ctx.drawImage(dark, cx + Math.sin(k * 2.4 + t * 1.3) * 5 - r, cy - 18 - s * 16 - r, r * 2, r * 2);
  }
  for (let k = 0; k < 4; k++) {
    const s = (t * 1.1 + phase + k / 4) % 1;
    const r = 4 * (1 - s * 0.6);
    ctx.globalAlpha = alpha * (1 - s) * 0.8;
    ctx.drawImage(dark, cx + (k - 1.5) * 3.5 + Math.sin(t * 3 + k) * calm - r, cy + 2 + s * 4 - r, r * 2, r * 2);
  }
  ctx.globalAlpha = alpha * 0.95;
  body.forEach(([x, y, r], k) => {
    const [px, py] = at(k, x, y);
    ctx.drawImage(dark, px - r * 1.35, py - r * 1.35, r * 2.7, r * 2.7);
  });
  ctx.globalAlpha = alpha;
  body.forEach(([x, y, r], k) => {
    const [px, py] = at(k, x, y);
    ctx.drawImage(fill, px - r, py - r, r * 2, r * 2);
  });
  ctx.globalAlpha = alpha * 0.4;
  body.slice(0, 4).forEach(([x, y, r], k) => {
    const [px, py] = at(k, x, y);
    ctx.drawImage(light, px - r * 0.8 - 1.5, py - r * 0.8 - 1.5, r * 1.2, r * 1.2);
  });
  ctx.globalAlpha = alpha;
}

const star = typeof Path2D === "undefined" ? null : new Path2D(STAR);

/** The book's four-pointed star, with a soft glow. `size` is its height in world pixels. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, glow: string, blur: number) {
  if (!star) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 18, size / 18);
  ctx.shadowColor = glow;
  ctx.shadowBlur = blur;
  ctx.fillStyle = fill;
  ctx.fill(star);
  ctx.restore();
}

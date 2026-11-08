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
};

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

function darker(img: HTMLImageElement, amount: number) {
  const c = makeCanvas(img.naturalWidth, img.naturalHeight);
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
    return { ...got, lampDark: got.lamp ? darker(got.lamp, 0.5) : null };
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

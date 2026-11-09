import { puff } from "./art";

/**
 * The people and things of each painting, inside its level: their images and
 * the small effects drawn in code around them (smoke, steam, a puppet's strings,
 * a cardboard crown). Images live in public/juego/escenas; one that fails to
 * load is drawn as a soft silhouette instead.
 */

export type SceneArt = Map<string, HTMLImageElement>;

function image(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Loads the images a level needs; the ones that fail are left out. */
export async function loadSceneArt(names: string[]): Promise<SceneArt> {
  const unique = [...new Set(names)];
  const loaded = await Promise.all(unique.map(async (n) => [n, await image(`/juego/escenas/${n}.webp`)] as const));
  return new Map(loaded.filter((e): e is [string, HTMLImageElement] => e[1] !== null));
}

let smoke: HTMLCanvasElement | null = null;
let steam: HTMLCanvasElement | null = null;

/** Smoke from a cigarette, or steam from a cup, rising from (x, y). */
export function drawWisps(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, phase: number, isSteam: boolean) {
  smoke ??= puff("#aab0bc");
  steam ??= puff("#f2efe8");
  const img = isSteam ? steam : smoke;
  const alpha = ctx.globalAlpha;
  const count = isSteam ? 5 : 7;
  for (let k = 0; k < count; k++) {
    const s = (t * (isSteam ? 0.45 : 0.3) + k / count + phase) % 1;
    const r = (isSteam ? 0.8 : 1) + s * (isSteam ? 2.4 : 4.2);
    const px = x + Math.sin(s * 5 + k * 1.9 + t * 0.7) * (1 + s * (isSteam ? 2 : 4));
    const py = y - s * (isSteam ? 9 : 16);
    ctx.globalAlpha = alpha * Math.sin(Math.PI * Math.min(1, s * 1.4)) * (isSteam ? 0.32 : 0.28);
    ctx.drawImage(img, px - r, py - r, r * 2, r * 2);
  }
  ctx.globalAlpha = alpha;
}

/** The red strings of a puppet, from its shoulders and hands up into the dark. */
export function drawStrings(ctx: CanvasRenderingContext2D, cx: number, top: number, width: number, height: number, t: number) {
  // Shoulders, the raised hand and the other hand, as the king is painted.
  const anchors: [number, number][] = [
    [-0.28, 0.24],
    [0.18, 0.22],
    [0.4, 0.02],
    [-0.36, 0.55],
  ];
  ctx.save();
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = "rgba(200,30,42,0.85)";
  ctx.shadowColor = "rgba(255,40,50,0.6)";
  ctx.shadowBlur = 2;
  anchors.forEach(([ax, ay], k) => {
    const x = cx + ax * width;
    const y = top + ay * height;
    const sway = Math.sin(t * 1.1 + k) * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.5, y - 60, x + sway + ax * 10, y - 170);
    ctx.stroke();
  });
  ctx.restore();
}

/** A crown cut out of cardboard, sitting on (cx, y), `w` wide. */
export function drawCrown(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number) {
  const h = w * 0.55;
  ctx.save();
  ctx.translate(cx - w / 2, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -h * 0.45);
  ctx.lineTo(w * 0.17, -h * 0.2);
  ctx.lineTo(w * 0.33, -h);
  ctx.lineTo(w * 0.5, -h * 0.3);
  ctx.lineTo(w * 0.67, -h);
  ctx.lineTo(w * 0.83, -h * 0.2);
  ctx.lineTo(w, -h * 0.45);
  ctx.lineTo(w, 0);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, -h, 0, 0);
  grad.addColorStop(0, "#e8c46a");
  grad.addColorStop(1, "#9c7430");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 0.3;
  ctx.strokeStyle = "rgba(60,40,10,0.8)";
  ctx.stroke();
  ctx.restore();
}

/** A soft dark figure, for a person whose image didn't load. */
export function drawSilhouette(ctx: CanvasRenderingContext2D, cx: number, base: number, height: number, width: number) {
  ctx.save();
  ctx.fillStyle = "rgba(14,12,20,0.92)";
  ctx.beginPath();
  ctx.ellipse(cx, base - height * 0.82, width * 0.16, height * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.32, base);
  ctx.quadraticCurveTo(cx - width * 0.3, base - height * 0.6, cx, base - height * 0.7);
  ctx.quadraticCurveTo(cx + width * 0.3, base - height * 0.6, cx + width * 0.32, base);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

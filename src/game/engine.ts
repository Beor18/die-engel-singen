import { MODES, type AudioEngine, type Key } from "./audio";
import {
  COLS,
  GLOOM,
  ROWS,
  SAMPLE_H,
  SAMPLE_W,
  SUB,
  WALL,
  WATER,
  at,
  findPath,
  generateMap,
  inside,
  walkable,
  type GameMap,
  type Lamp,
  type Verse,
} from "./level";
import { createRng, hash, pick, type Rng } from "./rng";
import { buildSprites, SHADOW_EYES, STAR, type Sprites } from "./sprites";
import type { BattleOption, BattleUI, Dir, LevelSource, Point, Speaker, UIState } from "./types";

/**
 * The game engine for one level: exploration, battles and the final reveal.
 * It draws the world on a canvas and publishes a small UI state that React
 * renders as HTML (dialogue, battle menu, HUD), so text stays crisp and readable.
 */

const TILE = 16;
const STEP_TIME = 0.2;
const TYPE_SPEED = 48;
const DELTA: Record<Dir, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

const DOUBTS = [
  "¿Y si nadie te escucha?",
  "Ya lo intentaste. Mirá cómo terminó.",
  "Mañana. Siempre mañana.",
  "Nadie te pidió que cantaras.",
  "Quedate. Acá no duele.",
  "Lo que perdiste no vuelve.",
  "Una más. La última.",
  "¿Quién te creés que sos?",
  "Te vas a equivocar otra vez.",
  "Es tarde para empezar.",
  "Mejor callate.",
  "Nadie se acuerda de vos.",
];

const NAMES: Record<Speaker, string> = {
  angel: "El ángel",
  voice: "La Voz",
  shadow: "Sombra",
  guardian: "Guardián",
  narrator: "",
  verse: "Verso",
};

type Line = { speaker: Speaker; text: string; name?: string; veiled?: boolean };
type Mode = "loading" | "intro" | "explore" | "dialogue" | "battle" | "reveal" | "blackout" | "error";

type Actor = { x: number; y: number; fromX: number; fromY: number; t: number; moving: boolean; duration: number; dir: Dir };
type Shadow = Actor & { name: string; home: Point; timer: number; stunned: number; alive: boolean; phase: number };

type Battle = {
  guardian: boolean;
  name: string;
  hp: number;
  maxHp: number;
  phase: BattleUI["phase"];
  text: string;
  hint: string;
  selected: number;
  shadow: Shadow | null;
  clock: number;
  intro: number;
  notes: { start: number; result: null | "perfect" | "good" | "miss" }[];
  noteTime: number;
  noteIndex: number;
  hits: number;
  perfects: number;
  next: (() => void) | null;
  textClock: number;
  hurt: number;
  dying: number;
  turn: number;
  defendStart: number;
  defendTime: number;
  defendResult: null | "block" | "hit";
  popups: { text: string; t: number; color: string; y: number }[];
  particles: { a: number; r: number; s: number; size: number; o: number }[];
  origin: Point;
};

type Drop = { x: number; y: number; vx: number; vy: number; size: number; rot: number; spin: number; color: string; phase: number };

export type EngineOptions = {
  level: LevelSource;
  total: number;
  maxLight: number;
  audio: AudioEngine;
  touch: boolean;
  tutorial: boolean;
  reducedMotion: boolean;
  onComplete: (id: string) => void;
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const cheb = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const manhattan = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function rgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Hides letters of a text, revealing more as `fraction` grows. */
function veil(text: string, fraction: number, seed: number) {
  const letters: number[] = [];
  for (let i = 0; i < text.length; i++) if (/[\p{L}\p{N}]/u.test(text[i])) letters.push(i);
  const r = createRng(seed);
  const order = letters.map((i) => ({ i, k: r() })).sort((a, b) => a.k - b.k);
  const shown = new Set(order.slice(0, Math.round(fraction * letters.length)).map((o) => o.i));
  return [...text].map((ch, i) => (letters.includes(i) && !shown.has(i) ? "·" : ch)).join("");
}

export class Engine {
  private readonly o: EngineOptions;
  private readonly rng: Rng;
  private readonly difficulty: number;
  private listeners = new Set<() => void>();
  private ui: UIState;

  private canvasEl: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private lightCanvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private raf = 0;
  private session = 0;
  private last = 0;
  private dpr = 1;
  private cw = 0;
  private ch = 0;
  private scale = 4;
  private bottomInset = 0;
  private font = "Georgia, serif";

  private map!: GameMap;
  private sprites!: Sprites;
  private floor!: HTMLCanvasElement;
  private walls!: HTMLCanvasElement;
  private painting!: HTMLImageElement;
  private blurred!: HTMLCanvasElement;
  private creatures: { shadow: HTMLCanvasElement | null; guardian: HTMLCanvasElement | null } = { shadow: null, guardian: null };
  private key!: Key;

  private mode: Mode = "loading";
  private paused = false;
  private time = 0;
  private player: Actor = { x: 0, y: 0, fromX: 0, fromY: 0, t: 1, moving: false, duration: STEP_TIME, dir: "up" };
  private walkClock = 0;
  private held: Dir[] = [];
  private pad: Dir | null = null;
  private path: Point[] = [];
  private light: number;
  private collected = new Set<number>();
  private echoes = 0;
  private checkpoint: Point = { x: 0, y: 0 };
  private visitedLamps = new Set<Lamp>();
  private shadows: Shadow[] = [];
  private portalOpen = false;
  private nearPortal = false;
  private invulnerable = 0;
  private stepsSinceEncounter = 0;
  private singCooldown = 0;
  private singPulse = 0;
  private bumpCooldown = 0;
  private heartTimer = 0;
  private whisperTimer = 3;
  private cam = { x: 0, y: 0 };
  private flash = 0;
  private nextLightning = 8;
  private shake = 0;
  private toast: string | null = null;
  private toastTimer = 0;
  private titleCardTimer = 0;
  private blackoutTimer = 0;
  private drops: Drop[] = [];
  private motes: Drop[] = [];
  private dialogue: { lines: Line[]; i: number; visible: number; then?: () => void } | null = null;
  private battle: Battle | null = null;
  private reveal: { t: number; done: boolean } | null = null;

  constructor(options: EngineOptions) {
    this.o = options;
    this.rng = createRng(hash(options.level.id) ^ 0x9e3779b9);
    this.difficulty = options.level.number - 1;
    this.light = options.maxLight;
    this.ui = this.snapshot();
  }

  // ----- Public API for React ----------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.ui;

  attach(el: HTMLCanvasElement) {
    this.canvasEl = el;
    this.ctx = el.getContext("2d");
    this.lightCanvas = canvas(4, 4);
    this.font = getComputedStyle(document.body).fontFamily || this.font;
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (el.parentElement) this.resizeObserver.observe(el.parentElement);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    void this.load(++this.session);
  }

  detach() {
    this.session++;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.o.audio.setBattle(false);
    this.o.audio.setRain(false);
    this.canvasEl = null;
    this.ctx = null;
  }

  /** Direction from the on-screen pad, or null when released. */
  setPad(dir: Dir | null) {
    this.pad = dir;
    if (dir) this.path = [];
    if (dir && this.mode === "battle" && this.battle?.phase === "menu") this.moveSelection(dir);
  }

  pressA() {
    if (this.paused) return;
    if (this.mode === "intro") this.titleCardTimer = Math.min(this.titleCardTimer, 0.2);
    else if (this.mode === "dialogue") this.advanceDialogue();
    else if (this.mode === "battle") this.battleA();
    else if (this.mode === "explore" && !this.player.moving) this.interact();
  }

  choose(index: number) {
    const b = this.battle;
    if (!b || b.phase !== "menu") return;
    b.selected = index;
    this.battleA();
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.held = [];
    this.pad = null;
    this.emit();
  }

  /** A tap on the world: walk there, or talk to whoever is there. */
  tap(clientX: number, clientY: number) {
    if (this.paused || this.mode === "loading" || this.mode === "error") return;
    if (this.mode !== "explore") {
      this.pressA();
      return;
    }
    if (!this.canvasEl) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const { ox, oy, s } = this.view();
    const wx = ((clientX - rect.left) * this.dpr - ox) / s;
    const wy = ((clientY - rect.top) * this.dpr - oy) / s;
    const target = { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
    const p = this.player;
    if (target.x === p.x && target.y === p.y) {
      this.sing();
      return;
    }
    if (manhattan(target, p) === 1 && (this.isAngel(target) || this.lampAt(target))) {
      p.dir = (Object.keys(DELTA) as Dir[]).find((d) => p.x + DELTA[d].x === target.x && p.y + DELTA[d].y === target.y) ?? p.dir;
      this.interact();
      return;
    }
    const route = findPath(this.map.cells, p, target, (x, y) => this.blocksPlayer({ x, y }));
    if (route?.length) this.path = route;
  }

  debug = {
    collectAll: () => {
      for (const v of this.map.verses) this.collected.add(v.index);
      this.echoes = this.map.verses.length;
      this.openPortal();
    },
    fight: () => this.startBattle(null, false),
    guardian: () => this.startBattle(null, true),
    win: () => {
      if (this.battle) {
        this.battle.hp = 0;
        this.win();
      }
    },
    reveal: () => this.startReveal(),
    state: () => ({ mode: this.mode, player: { x: this.player.x, y: this.player.y }, light: this.light, verses: this.collected.size }),
  };

  // ----- Loading -------------------------------------------------------------

  private async load(session: number) {
    try {
      const src = this.o.level.image;
      const image = await this.loadImage(`/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`).catch(() => this.loadImage(src));
      if (session !== this.session) return;
      this.painting = image;
      const sample = canvas(SAMPLE_W, SAMPLE_H);
      const sctx = sample.getContext("2d", { willReadFrequently: true })!;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(image, 0, 0, SAMPLE_W, SAMPLE_H);
      const data = sctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

      this.map = generateMap(this.o.level, data, this.difficulty);
      this.sprites = buildSprites();
      void this.loadCreature("/juego/sombra.jpg", "shadow");
      void this.loadCreature("/juego/guardian.jpg", "guardian");
      this.buildFloor(data);
      this.buildWalls(data);
      this.blurred = canvas(27, 48);
      const bctx = this.blurred.getContext("2d")!;
      bctx.imageSmoothingQuality = "high";
      bctx.drawImage(image, 0, 0, 27, 48);

      const m = this.map;
      this.player = { x: m.start.x, y: m.start.y, fromX: m.start.x, fromY: m.start.y, t: 1, moving: false, duration: STEP_TIME, dir: "up" };
      this.checkpoint = { ...m.start };
      this.cam = { x: (m.start.x + 0.5) * TILE, y: (m.start.y + 0.5) * TILE };
      this.shadows = m.shadows.map((s, i) => ({
        x: s.x,
        y: s.y,
        fromX: s.x,
        fromY: s.y,
        t: 1,
        moving: false,
        duration: 0.4,
        dir: "down",
        name: s.name,
        home: { x: s.x, y: s.y },
        timer: 1 + i * 0.3,
        stunned: 0,
        alive: true,
        phase: this.rng() * 6,
      }));

      this.key = this.musicalKey();
      const audio = this.o.audio;
      audio.startChoir(this.key, 1);
      audio.setRain(Boolean(this.o.level.weather.particulas?.some((p) => p.tipo === "lluvia")));
      this.initWeather();

      this.mode = "intro";
      this.titleCardTimer = this.o.reducedMotion ? 2 : 3;
      this.emit();
    } catch {
      this.mode = "error";
      this.emit();
    }
  }

  /** The painted portrait of a shadow, with its edges dissolved into the dark. */
  private async loadCreature(src: string, kind: "shadow" | "guardian") {
    try {
      const img = await this.loadImage(`/_next/image?url=${encodeURIComponent(src)}&w=384&q=75`).catch(() => this.loadImage(src));
      const size = 384;
      const c = canvas(size, size);
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, size, size);
      g.globalCompositeOperation = "destination-in";
      const mask = g.createRadialGradient(size / 2, size * 0.42, size * 0.18, size / 2, size * 0.46, size * 0.5);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = mask;
      g.fillRect(0, 0, size, size);
      this.creatures[kind] = c;
    } catch {
      // Without the portrait, the battle draws the shadow as smoke only.
    }
  }

  private loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private musicalKey(): Key {
    const r = createRng(hash(this.o.level.id) ^ 0x51ed27);
    const bright = this.map.darkness < 0.87;
    const roots = [45, 46, 47, 48, 50, 52, 53];
    const mode = bright ? pick(r, [MODES.ionian, MODES.lydian, MODES.dorian]) : pick(r, [MODES.aeolian, MODES.aeolian, MODES.phrygian, MODES.dorian]);
    const minor = mode[2] === 3;
    const progression = minor ? pick(r, [[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 4], [0, 5, 2, 4]]) : pick(r, [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4]]);
    return { root: pick(r, roots), mode, progression };
  }

  private buildFloor(sample: Uint8ClampedArray) {
    const W = COLS * TILE;
    const H = ROWS * TILE;
    this.floor = canvas(W, H);
    const ctx = this.floor.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const cells = this.map.cells;
    const k = TILE / SUB;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const s = ((((py / k) | 0) * SAMPLE_W + ((px / k) | 0)) * 4) | 0;
        let r = sample[s];
        let g = sample[s + 1];
        let b = sample[s + 2];
        const tx = (px / TILE) | 0;
        const ty = (py / TILE) | 0;
        const cell = cells[at(tx, ty)];
        const lx = px % TILE;
        const ly = py % TILE;
        if (cell === GLOOM) {
          r = r * 0.55 + 14;
          g = g * 0.5 + 6;
          b = b * 0.55 + 22;
        } else if (cell === WATER) {
          r = r * 0.45 + 6;
          g = g * 0.5 + 16;
          b = b * 0.55 + 32;
        } else if (cell !== WALL) {
          r = r * 0.98 + 9;
          g = g * 0.98 + 9;
          b = b * 0.98 + 10;
        }
        if (cell !== WALL) {
          let f = 1;
          if (lx === 0 || ly === 0) f *= 0.8;
          if (ty > 0 && cells[at(tx, ty - 1)] === WALL && ly < 4) f *= 0.45 + ly * 0.12;
          r *= f;
          g *= f;
          b *= f;
        }
        const o = (py * W + px) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private buildWalls(sample: Uint8ClampedArray) {
    const W = COLS * TILE;
    const H = ROWS * TILE;
    this.walls = canvas(W, H);
    const ctx = this.walls.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const cells = this.map.cells;
    const isWall = (x: number, y: number) => !inside(x, y) || cells[at(x, y)] === WALL;
    const k = TILE / SUB;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (!isWall(tx, ty)) continue;
        let br = 0;
        let bg = 0;
        let bb = 0;
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            const s = ((ty * SUB + sy) * SAMPLE_W + tx * SUB + sx) * 4;
            br += sample[s];
            bg += sample[s + 1];
            bb += sample[s + 2];
          }
        }
        const n = SUB * SUB;
        const base = [br / n, bg / n, bb / n];
        const below = isWall(tx, ty + 1);
        const above = isWall(tx, ty - 1);
        const left = isWall(tx - 1, ty);
        const right = isWall(tx + 1, ty);
        for (let ly = 0; ly < TILE; ly++) {
          for (let lx = 0; lx < TILE; lx++) {
            const px = tx * TILE + lx;
            const py = ty * TILE + ly;
            const s = ((((py / k) | 0) * SAMPLE_W + ((px / k) | 0)) * 4) | 0;
            const top = [0, 1, 2].map((i) => base[i] * 0.26 + sample[s + i] * 0.08 + 7);
            let c: number[];
            if (!below && ly >= 9) {
              // Front face: two rows of bricks under a lit ledge.
              const row = ly < 13 ? 0 : 1;
              const mortar = ly === 13 || (lx + row * 4) % 8 === 7;
              c = ly === 9 ? top.map((v) => v * 1.9 + 14) : top.map((v) => v * (mortar ? 0.38 : 0.72 - (ly - 10) * 0.03));
            } else {
              c = top.map((v) => v * (0.92 + (((lx * 7 + ly * 13 + tx * 3 + ty * 5) % 5) - 2) * 0.03));
              if (!above && ly === 0) c = c.map((v) => v * 2.1 + 18);
              else if (!above && ly === 1) c = c.map((v) => v * 1.35 + 6);
              else if (!left && lx === 0) c = c.map((v) => v * 1.5 + 8);
              else if (!right && lx === TILE - 1) c = c.map((v) => v * 0.7);
            }
            const o = (py * W + px) * 4;
            img.data[o] = c[0];
            img.data[o + 1] = c[1];
            img.data[o + 2] = c[2];
            img.data[o + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ----- Input ---------------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
    if (target?.closest?.("[data-game-menu]")) return;
    const dir = this.keyDir(e.key);
    if (dir) {
      e.preventDefault();
      if (this.paused) return;
      if (!this.held.includes(dir)) this.held.push(dir);
      if (!e.repeat && this.mode === "battle" && this.battle?.phase === "menu") this.moveSelection(dir);
      if (this.mode === "explore") this.path = [];
      return;
    }
    if (e.key === " " || e.key === "Enter" || e.key === "z" || e.key === "Z" || e.key === "e" || e.key === "E") {
      e.preventDefault();
      if (!e.repeat) this.pressA();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const dir = this.keyDir(e.key);
    if (dir) this.held = this.held.filter((d) => d !== dir);
  };

  private onBlur = () => {
    this.held = [];
    this.pad = null;
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.o.audio.suspend();
      this.held = [];
    } else this.o.audio.resume();
  };

  private keyDir(key: string): Dir | null {
    switch (key) {
      case "ArrowUp":
      case "w":
      case "W":
        return "up";
      case "ArrowDown":
      case "s":
      case "S":
        return "down";
      case "ArrowLeft":
      case "a":
      case "A":
        return "left";
      case "ArrowRight":
      case "d":
      case "D":
        return "right";
      default:
        return null;
    }
  }

  // ----- Loop ----------------------------------------------------------------

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused && this.mode !== "loading" && this.mode !== "error") this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.singCooldown = Math.max(0, this.singCooldown - dt);
    this.singPulse = Math.max(0, this.singPulse - dt * 1.3);
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toast = null;
        this.emit();
      }
    }
    this.updateWeather(dt);

    switch (this.mode) {
      case "intro":
        this.titleCardTimer -= dt;
        if (this.titleCardTimer <= 0) this.say(this.introLines(), () => this.setMode("explore"));
        break;
      case "explore":
        this.updatePlayer(dt);
        this.updateShadows(dt);
        this.updateLightning(dt);
        break;
      case "dialogue":
        this.updateDialogue(dt);
        this.updateLightning(dt);
        break;
      case "battle":
        this.updateBattle(dt);
        break;
      case "reveal":
        this.updateReveal(dt);
        break;
      case "blackout":
        this.blackoutTimer -= dt;
        if (this.blackoutTimer <= 0) this.respawn();
        break;
    }

    if (this.mode !== "reveal") {
      const p = this.playerPos();
      const k = 1 - Math.exp(-dt * 9);
      this.cam.x += ((p.x + 0.5) * TILE - this.cam.x) * k;
      this.cam.y += ((p.y + 0.5) * TILE - this.cam.y) * k;
    }
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    this.emit();
  }

  // ----- Exploration ---------------------------------------------------------

  private playerPos() {
    const p = this.player;
    return { x: lerp(p.fromX, p.x, p.t), y: lerp(p.fromY, p.y, p.t) };
  }

  private isAngel(p: Point) {
    return p.x === this.map.angel.x && p.y === this.map.angel.y;
  }

  private lampAt(p: Point) {
    return this.map.lamps.find((l) => l.x === p.x && l.y === p.y);
  }

  private blocksPlayer(p: Point) {
    if (!inside(p.x, p.y) || !walkable(this.map.cells[at(p.x, p.y)])) return true;
    return this.isAngel(p) || Boolean(this.lampAt(p));
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (p.moving) {
      p.t += dt / p.duration;
      this.walkClock += dt;
      if (p.t >= 1) {
        p.t = 1;
        p.moving = false;
        this.arrive();
      }
    }
    if (!p.moving && this.mode === "explore") {
      const dir = this.held[this.held.length - 1] ?? this.pad;
      if (dir) this.tryMove(dir);
      else if (this.path.length) {
        const next = this.path[0];
        const d = (Object.keys(DELTA) as Dir[]).find((k) => p.x + DELTA[k].x === next.x && p.y + DELTA[k].y === next.y);
        if (!d || !this.tryMove(d)) this.path = [];
        else this.path.shift();
      }
    }
  }

  private tryMove(dir: Dir) {
    const p = this.player;
    p.dir = dir;
    const target = { x: p.x + DELTA[dir].x, y: p.y + DELTA[dir].y };
    if (this.blocksPlayer(target)) {
      if (this.bumpCooldown <= 0) {
        this.o.audio.bump();
        this.bumpCooldown = 0.35;
      }
      return false;
    }
    p.fromX = p.x;
    p.fromY = p.y;
    p.x = target.x;
    p.y = target.y;
    p.t = 0;
    p.moving = true;
    p.duration = STEP_TIME;
    this.o.audio.step(this.map.cells[at(target.x, target.y)] === GLOOM);
    return true;
  }

  private arrive() {
    const p = this.player;
    const m = this.map;
    const verse = m.verses.find((v) => v.x === p.x && v.y === p.y && !this.collected.has(v.index));
    if (verse) {
      this.collect(verse);
      return;
    }

    const lamp = m.lamps.find((l) => cheb(l, p) <= 1);
    if (lamp) this.restAt(lamp, false);

    const atPortal = cheb(p, m.portal) <= 1;
    if (atPortal && this.portalOpen) {
      this.path = [];
      this.startBattle(null, true);
      return;
    }
    if (atPortal && !this.nearPortal) {
      this.nearPortal = true;
      const missing = m.verses.length - this.collected.size;
      this.path = [];
      this.say([{ speaker: "voice", text: `El título está sellado. ${missing === 1 ? "Falta un verso." : `Faltan ${missing} versos.`}` }]);
      return;
    }
    if (!atPortal) this.nearPortal = false;

    this.stepsSinceEncounter++;
    if (m.cells[at(p.x, p.y)] === GLOOM && this.invulnerable <= 0 && this.stepsSinceEncounter >= 5) {
      if (this.rng() < 0.08 + this.difficulty * 0.004) {
        this.path = [];
        this.startBattle(null, false);
      }
    }
  }

  private restAt(lamp: Lamp, spoken: boolean) {
    const p = this.player;
    const firstTime = !this.visitedLamps.has(lamp);
    this.visitedLamps.add(lamp);
    this.checkpoint = { x: p.x, y: p.y };
    const healed = this.light < this.o.maxLight;
    this.light = this.o.maxLight;
    if (healed || firstTime || spoken) this.o.audio.lamp();
    if (spoken) this.say([{ speaker: "narrator", text: "Te quedás un momento junto al farol. Tu luz vuelve, y si se apaga, vas a volver acá." }]);
    else if (firstTime) this.showToast("Un farol. Si tu luz se apaga, volvés acá.");
    else if (healed) this.showToast("Tu luz vuelve.");
    this.emit();
  }

  private collect(v: Verse) {
    this.collected.add(v.index);
    this.echoes++;
    this.path = [];
    const total = this.map.verses.length;
    this.o.audio.verse();
    this.o.audio.setVoices(1 + this.collected.size);
    this.say(
      [{ speaker: "verse", name: `Verso ${this.collected.size} de ${total}`, text: v.lines.join("\n") }],
      () => {
        if (this.collected.size === total) this.openPortal();
      },
    );
  }

  private openPortal() {
    if (this.portalOpen) return;
    this.portalOpen = true;
    this.o.audio.portal();
    this.flash = Math.max(this.flash, this.o.reducedMotion ? 0.2 : 0.5);
    this.say([
      { speaker: "narrator", text: "Arriba, en el título, algo se abre. Se escucha un canto lejano." },
      { speaker: "angel", text: "Ya están todos. Subí hasta el título." },
    ]);
  }

  private interact() {
    const p = this.player;
    const f = { x: p.x + DELTA[p.dir].x, y: p.y + DELTA[p.dir].y };
    const lamp = this.lampAt(f);
    if (this.isAngel(f)) this.talkToAngel();
    else if (lamp) this.restAt(lamp, true);
    else this.sing();
  }

  private talkToAngel() {
    const total = this.map.verses.length;
    const found = this.collected.size;
    const meaning = this.o.level.meaning.join(" ") || this.o.level.alt;
    const lines: Line[] = [];
    if (found < total) {
      lines.push({ speaker: "narrator", text: "El ángel intenta hablar, pero le faltan palabras." });
      lines.push({ speaker: "angel", text: veil(meaning, found / total, hash(this.o.level.id)), veiled: true });
      lines.push({
        speaker: "angel",
        text: found === 0 ? `Encontrá los ${total} versos. Cada uno me devuelve una palabra.` : `Faltan ${total - found}. Ya casi te entiendo.`,
      });
    } else {
      lines.push({ speaker: "angel", text: meaning });
      lines.push({ speaker: "angel", text: "Ahora sí puedo cantar. Subí hasta el título." });
    }
    this.say(lines);
  }

  private sing() {
    if (this.singCooldown > 0) return;
    this.singCooldown = 1.3;
    this.singPulse = 1;
    this.o.audio.hum(pick(this.rng, [0, 2, 4, 7]));
    const p = this.player;
    for (const s of this.shadows) {
      if (!s.alive || manhattan(s, p) > 3) continue;
      s.stunned = 2.2;
      const away = (Object.keys(DELTA) as Dir[])
        .map((d) => ({ x: s.x + DELTA[d].x, y: s.y + DELTA[d].y }))
        .filter((q) => this.shadowCanEnter(q, s) && manhattan(q, p) > manhattan(s, p));
      if (away.length && !s.moving) this.moveActor(s, away[0], 0.3);
    }
  }

  private introLines(): Line[] {
    const total = this.map.verses.length;
    const lines: Line[] = [{ speaker: "narrator", text: this.o.level.alt }];
    lines.push({ speaker: "voice", text: `Las sombras se llevaron ${total} versos de esta página. Los voy a buscar.` });
    if (this.o.tutorial) {
      lines.push({
        speaker: "narrator",
        text: this.o.touch
          ? "Arrastrá el círculo de abajo para caminar, o tocá adonde quieras ir. El botón ✦ sirve para hablar y para cantar."
          : "Caminá con las flechas o con WASD. Espacio sirve para hablar y para cantar.",
      });
      lines.push({
        speaker: "narrator",
        text: "Tu luz es tu vida: si una sombra te alcanza, baja. Los faroles la recuperan. Y cantar asusta a las sombras.",
      });
      lines.push({ speaker: "narrator", text: "El ángel está a tu lado. Hablá con él." });
    }
    return lines;
  }

  // ----- Shadows -------------------------------------------------------------

  private shadowCanEnter(q: Point, self: Shadow) {
    if (!inside(q.x, q.y) || !walkable(this.map.cells[at(q.x, q.y)])) return false;
    if (this.isAngel(q) || this.map.lamps.some((l) => cheb(l, q) <= 1)) return false;
    return !this.shadows.some((o) => o !== self && o.alive && o.x === q.x && o.y === q.y);
  }

  private moveActor(a: Actor, to: Point, duration: number) {
    a.dir = to.x > a.x ? "right" : to.x < a.x ? "left" : to.y > a.y ? "down" : "up";
    a.fromX = a.x;
    a.fromY = a.y;
    a.x = to.x;
    a.y = to.y;
    a.t = 0;
    a.moving = true;
    a.duration = duration;
  }

  private updateShadows(dt: number) {
    const p = this.player;
    const pp = this.playerPos();
    const safe = this.map.lamps.some((l) => cheb(l, p) <= 2);
    let nearest = Infinity;
    let nearestShadow: Shadow | null = null;
    for (const s of this.shadows) {
      if (!s.alive) continue;
      if (s.moving) {
        s.t += dt / s.duration;
        if (s.t >= 1) {
          s.t = 1;
          s.moving = false;
        }
      }
      const d = manhattan(s, p);
      if (d < nearest) {
        nearest = d;
        nearestShadow = s;
      }
      if (s.stunned > 0) {
        s.stunned -= dt;
        continue;
      }
      if (!s.moving) {
        s.timer -= dt;
        if (s.timer <= 0) {
          const sight = 5 + Math.min(3, this.difficulty * 0.25);
          const chase = !safe && d <= sight && this.invulnerable <= 0;
          let next: Point | null = null;
          if (chase) {
            const route = findPath(this.map.cells, s, p, (x, y) => !this.shadowCanEnter({ x, y }, s));
            if (route?.length) next = route[0];
          }
          if (!next) {
            const dirs = (Object.keys(DELTA) as Dir[]).filter((k) => this.shadowCanEnter({ x: s.x + DELTA[k].x, y: s.y + DELTA[k].y }, s));
            if (dirs.length) {
              const keep = dirs.includes(s.dir) && this.rng() < 0.6 ? s.dir : pick(this.rng, dirs);
              next = { x: s.x + DELTA[keep].x, y: s.y + DELTA[keep].y };
            }
          }
          if (next && !(next.x === p.x && next.y === p.y && !chase)) this.moveActor(s, next, chase ? 0.27 : 0.42);
          s.timer = chase ? Math.max(0.12, 0.3 - this.difficulty * 0.01) : 0.6 + this.rng() * 0.9;
        }
      }
      const sx = lerp(s.fromX, s.x, s.t);
      const sy = lerp(s.fromY, s.y, s.t);
      if (this.invulnerable <= 0 && Math.hypot(sx - pp.x, sy - pp.y) < 0.6) {
        this.path = [];
        this.startBattle(s, false);
        return;
      }
    }

    if (nearestShadow && nearest <= 5) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.o.audio.heartbeat(clamp(1 - nearest / 6, 0.2, 1));
        this.heartTimer = 0.5 + nearest * 0.17;
      }
    }
    this.whisperTimer -= dt;
    if (this.whisperTimer <= 0) {
      this.whisperTimer = 4 + this.rng() * 4;
      if (nearestShadow && nearest <= 8) this.o.audio.whisper(clamp((nearestShadow.x - p.x) / 6, -1, 1), 0.025 + (8 - nearest) * 0.006);
    }
  }

  private updateLightning(dt: number) {
    if (!this.o.level.weather.relampagos) return;
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = 10 + this.rng() * 10;
      this.flash = this.o.reducedMotion ? 0.35 : 1;
      this.o.audio.thunder(0.4 + this.rng() * 1.2);
    }
  }

  // ----- Dialogue ------------------------------------------------------------

  private say(lines: Line[], then?: () => void) {
    this.dialogue = { lines, i: 0, visible: 0, then };
    this.mode = "dialogue";
    this.emit();
  }

  private updateDialogue(dt: number) {
    const d = this.dialogue;
    if (!d) return;
    const line = d.lines[d.i];
    if (d.visible >= line.text.length) return;
    const before = Math.floor(d.visible);
    d.visible = Math.min(line.text.length, d.visible + dt * (line.speaker === "verse" ? TYPE_SPEED * 1.6 : TYPE_SPEED));
    const now = Math.floor(d.visible);
    if (now !== before) {
      if (Math.floor(now / 3) !== Math.floor(before / 3)) this.o.audio.blip(line.speaker);
      this.emit();
    }
  }

  private advanceDialogue() {
    const d = this.dialogue;
    if (!d) return;
    const line = d.lines[d.i];
    if (d.visible < line.text.length) {
      d.visible = line.text.length;
      this.emit();
      return;
    }
    this.o.audio.ui();
    if (d.i < d.lines.length - 1) {
      d.i++;
      d.visible = 0;
      this.emit();
      return;
    }
    this.dialogue = null;
    this.mode = "explore";
    this.held = [];
    this.emit();
    d.then?.();
  }

  private showToast(text: string) {
    this.toast = text;
    this.toastTimer = 2.8;
    this.emit();
  }

  // ----- Battle --------------------------------------------------------------

  private startBattle(shadow: Shadow | null, guardian: boolean) {
    const name = guardian ? `La sombra de ${this.o.level.name}` : (shadow?.name ?? pick(this.rng, ["Duda", "Miedo", "Olvido", "Ruido", "Vacío"]));
    const hp = guardian ? Math.min(10, 6 + Math.floor(this.difficulty / 3)) : Math.min(6, 3 + Math.floor(this.difficulty / 4));
    const origin = shadow ? { x: lerp(shadow.fromX, shadow.x, shadow.t), y: lerp(shadow.fromY, shadow.y, shadow.t) } : this.playerPos();
    const count = guardian ? 120 : 80;
    this.battle = {
      guardian,
      name,
      hp,
      maxHp: hp,
      phase: "intro",
      text: guardian
        ? `${name} se levanta y tapa el título.`
        : shadow
          ? `${name} te alcanzó.`
          : `Algo se mueve en la penumbra. Es ${name}.`,
      hint: "",
      selected: 0,
      shadow,
      clock: 0,
      intro: 0,
      notes: [],
      noteTime: 0.9,
      noteIndex: 0,
      hits: 0,
      perfects: 0,
      next: null,
      textClock: 0,
      hurt: 0,
      dying: 0,
      turn: 0,
      defendStart: 0,
      defendTime: 0.9,
      defendResult: null,
      popups: [],
      particles: Array.from({ length: count }, () => ({
        a: this.rng() * Math.PI * 2,
        r: this.rng(),
        s: (this.rng() - 0.5) * 1.4,
        size: 0.1 + this.rng() * 0.18,
        o: this.rng() * 6,
      })),
      origin: { x: (origin.x + 0.5) * TILE, y: (origin.y + 0.5) * TILE },
    };
    this.mode = "battle";
    this.stepsSinceEncounter = 0;
    this.held = [];
    this.o.audio.battleStart();
    this.o.audio.setBattle(true);
    this.emit();
  }

  private battleOptions(b: Battle): BattleOption[] {
    return [
      { id: "sing", label: "Cantar", enabled: true },
      { id: "recall", label: `Recordar (${this.echoes})`, enabled: this.echoes > 0 },
      { id: "breathe", label: "Respirar", enabled: this.light < this.o.maxLight },
      { id: "flee", label: "Huir", enabled: !b.guardian },
    ];
  }

  private battleText(text: string, next: () => void) {
    const b = this.battle!;
    b.phase = "text";
    b.text = text;
    b.hint = "";
    b.next = next;
    b.textClock = 0;
    this.emit();
  }

  private toMenu() {
    const b = this.battle!;
    b.phase = "menu";
    b.text = "¿Qué hacés?";
    b.hint = "";
    this.emit();
  }

  private moveSelection(dir: Dir) {
    const b = this.battle!;
    const col = b.selected % 2;
    const row = Math.floor(b.selected / 2);
    if (dir === "left" || dir === "right") b.selected = row * 2 + (1 - col);
    else b.selected = (1 - row) * 2 + col;
    this.o.audio.move();
    this.emit();
  }

  private battleA() {
    const b = this.battle;
    if (!b) return;
    switch (b.phase) {
      case "intro":
        if (b.intro >= 1) this.battleText(b.text, () => this.toMenu());
        break;
      case "text": {
        const next = b.next;
        b.next = null;
        this.o.audio.ui();
        next?.();
        break;
      }
      case "menu":
        this.chooseOption(this.battleOptions(b)[b.selected]);
        break;
      case "sing": {
        const n = b.notes[b.noteIndex];
        if (!n || n.result) return;
        const elapsed = b.clock - n.start;
        if (elapsed < -0.05) return;
        const delta = Math.abs(elapsed - b.noteTime);
        this.resolveNote(delta < 0.075 ? "perfect" : delta < 0.17 ? "good" : "miss");
        break;
      }
      case "defend": {
        if (b.defendResult) return;
        const elapsed = b.clock - b.defendStart;
        if (elapsed < -0.05) return;
        this.resolveDefend(Math.abs(elapsed - b.defendTime) < 0.16);
        break;
      }
    }
  }

  private chooseOption(option: BattleOption) {
    const b = this.battle!;
    if (!option.enabled) {
      this.o.audio.bump();
      b.hint =
        option.id === "recall"
          ? "Todavía no recuperaste ningún verso de esta página."
          : option.id === "breathe"
            ? "Tu luz ya está completa."
            : "De esta sombra no se puede huir.";
      this.emit();
      return;
    }
    this.o.audio.confirm();
    if (option.id === "sing") {
      const count = b.guardian ? 4 : 3;
      b.noteTime = Math.max(0.55, 0.95 - this.difficulty * 0.022 - (b.guardian ? 0.08 : 0));
      b.notes = Array.from({ length: count }, (_, i) => ({ start: b.clock + 0.55 + i * (b.noteTime + 0.4), result: null }));
      b.noteIndex = 0;
      b.hits = 0;
      b.perfects = 0;
      b.phase = "sing";
      b.text = "Cantás.";
      b.hint = this.o.touch ? "Tocá la pantalla cuando el anillo llegue al círculo." : "Apretá Espacio cuando el anillo llegue al círculo.";
      this.emit();
    } else if (option.id === "recall") {
      this.echoes--;
      const lines = this.map.verses.filter((v) => this.collected.has(v.index)).flatMap((v) => v.lines);
      const line = lines.length ? pick(this.rng, lines) : this.o.level.stanzas.flat()[0];
      this.o.audio.recall();
      b.hurt = 1;
      this.battleText(`Recordás: «${line}»`, () => this.damage(2, "El verso le quita 2 de oscuridad."));
    } else if (option.id === "breathe") {
      this.light = Math.min(this.o.maxLight, this.light + 1);
      this.o.audio.lamp();
      this.battleText("Respirás hondo. Tu luz crece.", () => this.shadowTurn());
    } else if (option.id === "flee") {
      if (this.rng() < 0.7) {
        this.battleText("Te escapás entre las sombras.", () => this.closeBattle("fled"));
      } else this.battleText("La sombra no te deja ir.", () => this.shadowTurn());
    }
  }

  private resolveNote(result: "perfect" | "good" | "miss") {
    const b = this.battle!;
    const n = b.notes[b.noteIndex];
    n.result = result;
    const degree = [0, 2, 4, 7][b.noteIndex % 4];
    if (result === "miss") this.o.audio.miss();
    else {
      this.o.audio.hum(degree, result);
      b.hits++;
      b.hurt = 1;
      if (result === "perfect") b.perfects++;
    }
    b.popups.push({
      text: result === "perfect" ? "Perfecto" : result === "good" ? "Bien" : "Fuera de tiempo",
      t: 0,
      color: result === "miss" ? "#8a8f9c" : result === "perfect" ? "#fff1c2" : "#f7f7f5",
      y: 0,
    });
    b.noteIndex++;
  }

  private finishSing() {
    const b = this.battle!;
    const bonus = b.perfects === b.notes.length ? 1 : 0;
    const total = b.hits + bonus;
    if (total === 0) this.battleText("Tu canto se pierde en el ruido.", () => this.shadowTurn());
    else this.damage(total, bonus ? `¡Todo afinado! Tu canto le quita ${total} de oscuridad.` : `Tu canto le quita ${total} de oscuridad.`);
  }

  private damage(amount: number, text: string) {
    const b = this.battle!;
    b.hp = Math.max(0, b.hp - amount);
    b.hurt = 1;
    this.emit();
    if (b.hp <= 0) this.win();
    else this.battleText(text, () => this.shadowTurn());
  }

  private shadowTurn() {
    const b = this.battle!;
    b.turn++;
    const poem = this.o.level.stanzas.flat();
    const doubt = b.guardian || this.rng() < 0.3 ? pick(this.rng, poem) : pick(this.rng, DOUBTS);
    this.o.audio.whisper(0, 0.06);
    this.battleText(`${b.name}: «${doubt}»`, () => {
      b.phase = "defend";
      b.defendStart = b.clock + 0.45;
      b.defendTime = Math.max(0.6, 1 - this.difficulty * 0.02 - (b.guardian ? 0.1 : 0));
      b.defendResult = null;
      b.text = "¡Resistí!";
      b.hint = this.o.touch ? "Tocá cuando la sombra llegue a tu luz." : "Apretá Espacio cuando la sombra llegue a tu luz.";
      this.emit();
    });
  }

  private resolveDefend(blocked: boolean) {
    const b = this.battle!;
    b.defendResult = blocked ? "block" : "hit";
    if (blocked) {
      this.o.audio.block();
      b.popups.push({ text: "Resististe", t: 0, color: "#fff1c2", y: 1 });
    } else {
      const amount = b.guardian && b.turn % 2 === 0 ? 2 : 1;
      this.light = Math.max(0, this.light - amount);
      this.o.audio.hit();
      if (!this.o.reducedMotion) this.shake = 1;
      b.popups.push({ text: `−${amount} de luz`, t: 0, color: "#ff5a5f", y: 1 });
    }
    this.emit();
  }

  private win() {
    const b = this.battle!;
    b.phase = "end";
    b.dying = 0.001;
    b.clock = 0;
    this.o.audio.victory();
    if (!b.guardian) this.light = Math.min(this.o.maxLight, this.light + 1);
    b.text = b.guardian ? "La sombra se rompe en mil pedazos de luz." : `${b.name} se deshace en luz. Tu luz crece.`;
    b.hint = "";
    this.emit();
  }

  private lose() {
    this.battle = null;
    this.o.audio.setBattle(false);
    this.o.audio.defeat();
    this.mode = "blackout";
    this.blackoutTimer = 2.8;
    this.emit();
  }

  private closeBattle(result: "won" | "fled") {
    const b = this.battle!;
    this.battle = null;
    this.o.audio.setBattle(false);
    if (b.guardian && result === "won") {
      this.startReveal();
      return;
    }
    if (b.shadow) {
      if (result === "won") b.shadow.alive = false;
      else b.shadow.stunned = 3;
    }
    this.invulnerable = 1.6;
    this.mode = "explore";
    this.held = [];
    this.emit();
  }

  private updateBattle(dt: number) {
    const b = this.battle!;
    b.clock += dt;
    b.hurt = Math.max(0, b.hurt - dt * 2.5);
    for (const pop of b.popups) pop.t += dt;
    b.popups = b.popups.filter((pop) => pop.t < 1.2);
    switch (b.phase) {
      case "intro":
        b.intro = Math.min(1, b.intro + dt / (this.o.reducedMotion ? 0.4 : 0.9));
        if (b.intro >= 1 && b.clock > (this.o.reducedMotion ? 0.6 : 1.3)) this.battleText(b.text, () => this.toMenu());
        break;
      case "text":
        b.textClock += dt;
        if (b.textClock > Math.max(2.6, b.text.length * 0.055)) this.battleA();
        break;
      case "sing": {
        const n = b.notes[b.noteIndex];
        if (n && !n.result && b.clock - n.start > b.noteTime + 0.17) this.resolveNote("miss");
        const lastNote = b.notes[b.notes.length - 1];
        if (b.noteIndex >= b.notes.length && b.clock > lastNote.start + b.noteTime + 0.55) this.finishSing();
        break;
      }
      case "defend": {
        const elapsed = b.clock - b.defendStart;
        if (!b.defendResult && elapsed > b.defendTime + 0.16) this.resolveDefend(false);
        if (b.defendResult && elapsed > b.defendTime + 0.85) {
          if (this.light <= 0) this.lose();
          else if (b.defendResult === "block") this.battleText("Resististe. La sombra retrocede.", () => this.toMenu());
          else this.battleText("La sombra te alcanzó. Tu luz baja.", () => this.toMenu());
        }
        break;
      }
      case "end":
        b.dying = Math.min(1, b.dying + dt / 1.6);
        if (b.clock > 2.4) this.closeBattle("won");
        break;
    }
  }

  // ----- Blackout ------------------------------------------------------------

  private respawn() {
    const p = this.player;
    p.x = p.fromX = this.checkpoint.x;
    p.y = p.fromY = this.checkpoint.y;
    p.t = 1;
    p.moving = false;
    this.light = this.o.maxLight;
    for (const s of this.shadows) {
      if (s.alive && cheb(s, p) <= 6) {
        s.x = s.fromX = s.home.x;
        s.y = s.fromY = s.home.y;
        s.t = 1;
        s.moving = false;
      }
    }
    this.invulnerable = 2.5;
    this.mode = "explore";
    this.showToast("Volviste junto a la luz.");
  }

  // ----- Reveal --------------------------------------------------------------

  private startReveal() {
    this.mode = "reveal";
    this.reveal = { t: 0, done: false };
    this.o.audio.setRain(false);
    this.o.audio.stopChoir();
    this.o.audio.reveal();
    this.motes = [];
    this.emit();
  }

  private updateReveal(dt: number) {
    const r = this.reveal!;
    r.t += dt;
    if (r.t > 3.4 && this.motes.length < 60 && this.rng() < 0.6) {
      this.motes.push({
        x: this.rng(),
        y: 1.05,
        vx: (this.rng() - 0.5) * 0.02,
        vy: -(0.03 + this.rng() * 0.05),
        size: 1 + this.rng() * 2,
        rot: 0,
        spin: 0,
        color: this.rng() < 0.5 ? this.o.level.tone : "#fff1c2",
        phase: this.rng() * 6,
      });
    }
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    this.motes = this.motes.filter((m) => m.y > -0.05);
    if (r.t >= 5.8 && !r.done) {
      r.done = true;
      this.o.onComplete(this.o.level.id);
      this.emit();
    }
  }

  // ----- Weather -------------------------------------------------------------

  private initWeather() {
    this.drops = [];
    const area = (this.cw * this.ch) / (this.dpr * this.dpr * 390 * 844);
    for (const { tipo, cantidad = 1 } of this.o.level.weather.particulas ?? []) {
      const base = tipo === "lluvia" ? 110 : tipo === "polen" ? 36 : 30;
      const n = Math.round(base * cantidad * clamp(area, 0.6, 2.4));
      for (let i = 0; i < n; i++) this.drops.push(this.newDrop(tipo, true));
    }
  }

  private newDrop(kind: string, anywhere: boolean): Drop {
    const r = this.rng;
    const y = anywhere ? r() : -0.05;
    if (kind === "lluvia") return { x: r() * 1.2, y, vx: -0.18, vy: 1.4 + r() * 0.6, size: 0.012 + r() * 0.012, rot: 0, spin: 0, color: "lluvia", phase: 0 };
    if (kind === "petalos")
      return { x: r(), y, vx: 0.02, vy: 0.06 + r() * 0.05, size: 2 + r() * 2, rot: r() * 6, spin: (r() - 0.5) * 3, color: r() < 0.6 ? "#b3202e" : "#e07a86", phase: r() * 6 };
    if (kind === "confeti") {
      const colors = ["#e8bd60", "#c7242f", "#f7f7f5", "#6cb6e8", "#98121a"];
      return { x: r(), y, vx: 0, vy: 0.08 + r() * 0.06, size: 2 + r() * 1.5, rot: r() * 6, spin: (r() - 0.5) * 8, color: pick(r, colors), phase: r() * 6 };
    }
    return { x: r(), y: anywhere ? r() : 1.05, vx: 0, vy: -(0.01 + r() * 0.02), size: 1 + r() * 1.5, rot: 0, spin: 0, color: "#ffe6a8", phase: r() * 6 };
  }

  private updateWeather(dt: number) {
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.x += (d.vx + (d.color === "lluvia" ? 0 : Math.sin(this.time * 0.8 + d.phase) * 0.015)) * dt;
      d.y += d.vy * dt;
      d.rot += d.spin * dt;
      if (d.y > 1.05 || d.y < -0.06 || d.x < -0.2 || d.x > 1.25) {
        const kind = d.color === "lluvia" ? "lluvia" : d.color === "#ffe6a8" ? "polen" : d.color === "#b3202e" || d.color === "#e07a86" ? "petalos" : "confeti";
        this.drops[i] = this.newDrop(kind, false);
      }
    }
  }

  // ----- Rendering -----------------------------------------------------------

  private resize() {
    const el = this.canvasEl;
    if (!el?.parentElement) return;
    const rect = el.parentElement.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(1, Math.round(rect.width * this.dpr));
    this.ch = Math.max(1, Math.round(rect.height * this.dpr));
    el.width = this.cw;
    el.height = this.ch;
    const tileCss = clamp(Math.min(rect.width, rect.height) / 10, 34, 64);
    this.scale = Math.max(2, Math.round((tileCss * this.dpr) / TILE));
    this.bottomInset = this.o.touch ? Math.min(170, rect.height * 0.22) * this.dpr : 0;
    if (this.lightCanvas) {
      this.lightCanvas.width = Math.ceil(this.cw / 4);
      this.lightCanvas.height = Math.ceil(this.ch / 4);
    }
    if (this.mode !== "loading") this.initWeather();
  }

  /** Where the world is on screen: scale and offset in device pixels. */
  private view() {
    let s = this.scale;
    let cx = this.cam.x;
    let cy = this.cam.y;
    const mapW = COLS * TILE;
    const mapH = ROWS * TILE;
    if (this.mode === "reveal" && this.reveal) {
      const z = ease(clamp((this.reveal.t - 0.8) / 2.6));
      const area = this.revealArea();
      const fit = Math.min(area.w / mapW, area.h / mapH);
      s = lerp(this.scale, fit, z);
      cx = lerp(this.cam.x, mapW / 2 - (area.x + area.w / 2 - this.cw / 2) / fit, z);
      cy = lerp(this.cam.y, mapH / 2 - (area.y + area.h / 2 - this.ch / 2) / fit, z);
      return { s, ox: this.cw / 2 - cx * s, oy: this.ch / 2 - cy * s };
    }
    const usable = this.ch - this.bottomInset;
    const halfW = this.cw / 2 / s;
    const halfH = usable / 2 / s;
    cx = mapW <= halfW * 2 ? mapW / 2 : clamp(cx, halfW, mapW - halfW);
    cy = mapH <= halfH * 2 ? mapH / 2 : clamp(cy, halfH, mapH - halfH);
    return { s, ox: Math.round(this.cw / 2 - cx * s), oy: Math.round(usable / 2 - cy * s) };
  }

  /** Space for the painting once revealed, leaving room for the text panel. */
  private revealArea() {
    const portrait = this.ch >= this.cw;
    const pad = 16 * this.dpr;
    return portrait
      ? { x: pad, y: pad + 40 * this.dpr, w: this.cw - pad * 2, h: this.ch * 0.56 - pad }
      : { x: pad, y: pad, w: this.cw * 0.56 - pad, h: this.ch - pad * 2 };
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#020305";
    ctx.fillRect(0, 0, this.cw, this.ch);
    if (this.mode === "loading" || this.mode === "error") return;

    const b = this.battle;
    if (b && b.intro >= 1 && this.mode === "battle") {
      this.renderBattle(ctx, b);
      return;
    }

    ctx.save();
    if (this.shake > 0) ctx.translate((this.rng() - 0.5) * 14 * this.shake * this.dpr, (this.rng() - 0.5) * 14 * this.shake * this.dpr);
    this.renderWorld(ctx);
    ctx.restore();

    if (b && this.mode === "battle") this.renderBattleIntro(ctx, b);
    if (this.mode === "blackout") {
      ctx.fillStyle = `rgba(0,0,0,${clamp(1.2 - this.blackoutTimer / 2.8)})`;
      ctx.fillRect(0, 0, this.cw, this.ch);
    }
  }

  private renderWorld(ctx: CanvasRenderingContext2D) {
    const { s, ox, oy } = this.view();
    const m = this.map;
    const t = this.time;
    const reveal = this.mode === "reveal" && this.reveal ? this.reveal.t : -1;
    const wallsAlpha = reveal < 0 ? 1 : 1 - ease(clamp(reveal / 1.4));
    const actorsAlpha = reveal < 0 ? 1 : 1 - clamp(reveal / 1.2);
    const paint = reveal < 0 ? 0 : ease(clamp((reveal - 3.2) / 2));

    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.floor, 0, 0);

    // Visible tiles, to animate only what is on screen.
    const x0 = Math.max(0, Math.floor(-ox / s / TILE) - 1);
    const y0 = Math.max(0, Math.floor(-oy / s / TILE) - 1);
    const x1 = Math.min(COLS - 1, Math.ceil((this.cw - ox) / s / TILE) + 1);
    const y1 = Math.min(ROWS - 1, Math.ceil((this.ch - oy) / s / TILE) + 1);

    if (actorsAlpha > 0) {
      ctx.globalAlpha = actorsAlpha;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const c = m.cells[at(x, y)];
          if (c === WATER) {
            const k = Math.sin(t * 2 + x * 1.3 + y * 0.7);
            ctx.fillStyle = `rgba(170,205,240,${0.12 + k * 0.08})`;
            ctx.fillRect(x * TILE + 3 + ((t * 4 + y * 3) % 8), y * TILE + 5, 5, 1);
            ctx.fillRect(x * TILE + 9 - ((t * 3 + x * 2) % 7), y * TILE + 11, 4, 1);
          } else if (c === GLOOM) {
            const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
            const dx = (h % 9) + Math.sin(t * 0.7 + (h % 13)) * 3;
            const dy = ((h >> 4) % 9) + Math.cos(t * 0.55 + (h % 11)) * 2.5;
            ctx.fillStyle = `rgba(12,4,20,${0.3 + 0.14 * Math.sin(t * 1.1 + (h % 17))})`;
            ctx.beginPath();
            ctx.arc(x * TILE + 3 + dx, y * TILE + 3 + dy, 4 + (h % 4), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      for (const f of m.fogs) {
        const fx = f.x * TILE + Math.sin(t * 0.3 + f.y) * TILE * 0.6;
        const fy = f.y * TILE;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(f.rx, f.ry) * TILE);
        const [r, gg, bb] = rgb(f.color);
        g.addColorStop(0, `rgba(${r},${gg},${bb},0.14)`);
        g.addColorStop(1, `rgba(${r},${gg},${bb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(fx - f.rx * TILE * 1.2, fy - f.ry * TILE * 1.2, f.rx * TILE * 2.4, f.ry * TILE * 2.4);
      }

      // The red star where the page begins, and the title above.
      this.drawStar(ctx, (m.start.x + 0.5) * TILE, (m.start.y + 0.5) * TILE, 0.8, "#98121a", 0);
      this.drawPortal(ctx, t);
      ctx.globalAlpha = 1;
    }

    if (wallsAlpha > 0) {
      ctx.globalAlpha = wallsAlpha;
      ctx.drawImage(this.walls, 0, reveal < 0 ? 0 : (1 - wallsAlpha) * 6);
      ctx.globalAlpha = 1;
    }

    if (actorsAlpha > 0) {
      ctx.globalAlpha = actorsAlpha;
      this.drawActors(ctx, t);
      ctx.globalAlpha = 1;
    }

    if (paint > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = paint;
      ctx.drawImage(this.painting, 0, 0, COLS * TILE, ROWS * TILE);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }

    this.renderLighting(ctx, s, ox, oy, reveal);

    // After the dark: the eyes of the shadows are always visible.
    if (actorsAlpha > 0) {
      ctx.setTransform(s, 0, 0, s, ox, oy);
      for (const sh of this.shadows) {
        if (!sh.alive) continue;
        const sx = lerp(sh.fromX, sh.x, sh.t) * TILE;
        const sy = lerp(sh.fromY, sh.y, sh.t) * TILE - 2 + Math.sin(t * 3 + sh.phase);
        const blink = Math.sin(t * 0.9 + sh.phase * 3) > 0.96 ? 0.2 : 1;
        for (const [ex, ey] of SHADOW_EYES) {
          ctx.fillStyle = `rgba(255,42,54,${0.9 * actorsAlpha})`;
          ctx.fillRect(sx + ex - 1, sy + ey - 0.5 * blink, 1.6, 1.2 * blink);
        }
      }
    }

    this.renderWeather(ctx, reveal);
  }

  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, glow: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    if (glow > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    ctx.fillStyle = color;
    ctx.fill(new Path2D(STAR));
    ctx.restore();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, t: number) {
    const p = this.map.portal;
    const x = (p.x + 0.5) * TILE;
    const y = (p.y + 0.5) * TILE;
    if (!this.portalOpen) {
      ctx.strokeStyle = "rgba(152,18,26,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 12 + Math.sin(t * 2) * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      this.drawStar(ctx, x, y, 1.1, "#98121a", 0);
      return;
    }
    const pulse = (Math.sin(t * 2.4) + 1) / 2;
    const g = ctx.createLinearGradient(x, y - 70, x, y + 8);
    g.addColorStop(0, "rgba(255,241,194,0)");
    g.addColorStop(1, `rgba(255,241,194,${0.35 + pulse * 0.2})`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 9, y - 70, 18, 78);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.6);
    ctx.translate(-x, -y);
    this.drawStar(ctx, x, y, 1.4 + pulse * 0.2, "#fff1c2", 0);
    ctx.restore();
  }

  private drawActors(ctx: CanvasRenderingContext2D, t: number) {
    const m = this.map;
    const items: { y: number; draw: () => void }[] = [];
    for (const l of m.lamps) {
      items.push({ y: l.y, draw: () => ctx.drawImage(this.sprites.lamp(l.color), l.x * TILE, l.y * TILE - 4) });
    }
    for (const v of m.verses) {
      if (this.collected.has(v.index)) continue;
      const bob = Math.sin(t * 2.2 + v.index) * 1.5;
      items.push({ y: v.y, draw: () => ctx.drawImage(this.sprites.feather, v.x * TILE + 3, v.y * TILE + 1 + bob) });
    }
    items.push({ y: m.angel.y, draw: () => ctx.drawImage(this.sprites.angel, m.angel.x * TILE, m.angel.y * TILE - 3 + Math.sin(t * 1.3)) });
    for (const sh of this.shadows) {
      if (!sh.alive) continue;
      const sx = lerp(sh.fromX, sh.x, sh.t);
      const sy = lerp(sh.fromY, sh.y, sh.t);
      const frame = this.sprites.shadow[Math.floor(t * 3 + sh.phase) % 2];
      items.push({
        y: sy,
        draw: () => {
          ctx.globalAlpha *= sh.stunned > 0 ? 0.55 : 0.92;
          ctx.drawImage(frame, sx * TILE, sy * TILE - 2 + Math.sin(t * 3 + sh.phase));
          ctx.globalAlpha /= sh.stunned > 0 ? 0.55 : 0.92;
        },
      });
    }
    const p = this.player;
    const pos = this.playerPos();
    const frames = this.sprites.voice[p.dir];
    const frame = p.moving ? frames[1 + (Math.floor(this.walkClock / 0.13) % 2)] : frames[0];
    const blinking = this.invulnerable > 0 && Math.floor(t * 10) % 2 === 0;
    items.push({
      y: pos.y,
      draw: () => {
        if (!blinking) ctx.drawImage(frame, Math.round(pos.x * TILE), Math.round(pos.y * TILE - 3 + (p.moving ? 1 : 0)));
      },
    });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
  }

  private renderLighting(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number, reveal: number) {
    const lc = this.lightCanvas;
    if (!lc) return;
    const l = lc.getContext("2d")!;
    const t = this.time;
    const m = this.map;
    const darkMul = reveal < 0 ? 1 : 1 - ease(clamp(reveal / 2.2));
    const dark = m.darkness * darkMul * (1 - this.flash * 0.8);
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, lc.width, lc.height);
    if (dark <= 0.01) return;
    l.fillStyle = `rgba(2,3,8,${dark})`;
    l.fillRect(0, 0, lc.width, lc.height);
    l.globalCompositeOperation = "destination-out";

    const lights: { x: number; y: number; r: number; a: number; color?: string; glow?: number }[] = [];
    const pos = this.playerPos();
    const flicker = 1 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 13.1) * 0.02;
    lights.push({ x: pos.x + 0.5, y: pos.y + 0.3, r: (1.7 + this.light * 0.7 + this.singPulse * 2.6) * flicker, a: 1, color: "#ffd98a", glow: 0.16 });
    for (const lamp of m.lamps) lights.push({ x: lamp.x + 0.5, y: lamp.y + 0.2, r: lamp.radius * (1 + Math.sin(t * 5 + lamp.x) * 0.04), a: 1, color: lamp.color, glow: 0.2 });
    for (const v of m.verses) if (!this.collected.has(v.index)) lights.push({ x: v.x + 0.5, y: v.y + 0.5, r: 1.4 + Math.sin(t * 2.2 + v.index) * 0.2, a: 0.85, color: "#fff1c2", glow: 0.18 });
    lights.push({ x: m.angel.x + 0.5, y: m.angel.y + 0.3, r: 1.6, a: 0.8, color: "#cfdcff", glow: 0.1 });
    lights.push({ x: m.start.x + 0.5, y: m.start.y + 0.5, r: 1.2, a: 0.6, color: "#c7242f", glow: 0.12 });
    lights.push({ x: m.portal.x + 0.5, y: m.portal.y + 0.5, r: this.portalOpen ? 4 : 1.2, a: this.portalOpen ? 1 : 0.5, color: this.portalOpen ? "#fff1c2" : "#c7242f", glow: this.portalOpen ? 0.25 : 0.1 });
    for (const sp of m.sparkles) {
      const k = (Math.sin(t * 3 + sp.x * 1.7 + sp.y) + 1) / 2;
      lights.push({ x: sp.x + 0.5, y: sp.y + 0.5, r: 0.4 + k * 0.5, a: 0.7, color: "#ffffff", glow: 0.1 * k });
    }

    const q = 4;
    for (const li of lights) {
      const x = (ox + li.x * TILE * s) / q;
      const y = (oy + li.y * TILE * s) / q;
      const r = (li.r * TILE * s) / q;
      if (x + r < 0 || y + r < 0 || x - r > lc.width || y - r > lc.height) continue;
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${li.a})`);
      g.addColorStop(0.5, `rgba(0,0,0,${li.a * 0.8})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      l.fillStyle = g;
      l.fillRect(x - r, y - r, r * 2, r * 2);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lc, 0, 0, this.cw, this.ch);

    ctx.globalCompositeOperation = "lighter";
    for (const li of lights) {
      if (!li.color || !li.glow) continue;
      const x = ox + li.x * TILE * s;
      const y = oy + li.y * TILE * s;
      const r = li.r * TILE * s * 0.9;
      if (x + r < 0 || y + r < 0 || x - r > this.cw || y - r > this.ch) continue;
      const [cr, cg, cb] = rgb(li.color);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${li.glow * darkMul})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = false;
  }

  private renderWeather(ctx: CanvasRenderingContext2D, reveal: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = this.cw;
    const h = this.ch;
    const alpha = reveal < 0 ? 1 : 1 - clamp(reveal / 1.5);
    if (alpha > 0) {
      ctx.lineCap = "round";
      for (const d of this.drops) {
        if (d.color === "lluvia") {
          ctx.strokeStyle = `rgba(175,195,215,${0.32 * alpha})`;
          ctx.lineWidth = this.dpr;
          ctx.beginPath();
          ctx.moveTo(d.x * w, d.y * h);
          ctx.lineTo(d.x * w + d.vx * d.size * w * 0.6, d.y * h + d.size * h);
          ctx.stroke();
        } else if (d.color === "#ffe6a8") {
          const k = (Math.sin(this.time * 2 + d.phase) + 1) / 2;
          ctx.fillStyle = `rgba(255,230,168,${(0.25 + k * 0.45) * alpha})`;
          ctx.fillRect(d.x * w, d.y * h, d.size * this.dpr, d.size * this.dpr);
        } else {
          ctx.save();
          ctx.translate(d.x * w, d.y * h);
          ctx.rotate(d.rot);
          ctx.globalAlpha = 0.8 * alpha;
          ctx.fillStyle = d.color;
          ctx.fillRect(-d.size * this.dpr, -d.size * this.dpr * 0.5, d.size * this.dpr * 2, d.size * this.dpr);
          ctx.restore();
        }
      }
    }
    if (this.flash > 0 && reveal < 0) {
      ctx.fillStyle = `rgba(220,230,255,${this.flash * (this.o.reducedMotion ? 0.08 : 0.22)})`;
      ctx.fillRect(0, 0, w, h);
    }
    for (const m of this.motes) {
      const k = (Math.sin(this.time * 3 + m.phase) + 1) / 2;
      const [r, g, b] = rgb(m.color);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.4 + k * 0.5})`;
      ctx.fillRect(m.x * w, m.y * h, m.size * this.dpr, m.size * this.dpr);
    }
  }

  private renderBattleIntro(ctx: CanvasRenderingContext2D, b: Battle) {
    const { s, ox, oy } = this.view();
    const x = ox + b.origin.x * s;
    const y = oy + b.origin.y * s;
    const radius = Math.hypot(this.cw, this.ch) * ease(b.intro);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#020305";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(199,36,47,${1 - b.intro})`;
    ctx.lineWidth = 3 * this.dpr;
    ctx.stroke();
  }

  private renderBattle(ctx: CanvasRenderingContext2D, b: Battle) {
    const w = this.cw;
    const h = this.ch;
    const t = this.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate((this.rng() - 0.5) * 18 * this.shake * this.dpr, (this.rng() - 0.5) * 18 * this.shake * this.dpr);

    // Background: the page itself, blurred and dark.
    ctx.imageSmoothingEnabled = true;
    const cover = Math.max(w / this.blurred.width, h / this.blurred.height) * 1.15;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(
      this.blurred,
      w / 2 - (this.blurred.width * cover) / 2 + Math.sin(t * 0.2) * 10,
      h / 2 - (this.blurred.height * cover) / 2,
      this.blurred.width * cover,
      this.blurred.height * cover,
    );
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.38, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, "rgba(2,3,5,0.35)");
    vignette.addColorStop(1, "rgba(2,3,5,0.92)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    const fade = clamp(b.clock / 0.4);
    if (fade < 1) {
      ctx.fillStyle = `rgba(2,3,5,${1 - fade})`;
      ctx.fillRect(0, 0, w, h);
    }

    const portrait = h > w;
    const cx = w / 2;
    const cy = portrait ? h * 0.3 : h * 0.4;
    const size = Math.min(w, h) * (portrait ? 0.3 : 0.24) * (b.guardian ? 1.2 : 1);
    const tone = rgb(this.o.level.tone);

    // The shadow: its painted portrait breathing inside a swirl of smoke.
    const dying = b.dying;
    const painted = b.guardian ? this.creatures.guardian : this.creatures.shadow;
    if (painted) {
      const breathe = 1 + Math.sin(t * 1.6) * 0.025;
      const sz = size * (portrait ? 2.5 : 2.2) * breathe;
      const jitter = b.hurt > 0 ? (this.rng() - 0.5) * 14 * b.hurt * this.dpr : 0;
      const x = cx - sz / 2 + jitter;
      const y = cy - sz * 0.46 - dying * size * 0.8;
      ctx.globalAlpha = (1 - dying) * fade;
      ctx.drawImage(painted, x, y, sz, sz);
      if (b.hurt > 0.05) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = b.hurt * 0.4 * (1 - dying);
        ctx.drawImage(painted, x, y, sz, sz);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = 1;
    }
    for (const p of b.particles) {
      const ang = p.a + t * p.s * 0.6;
      const rad = size * (0.15 + p.r * 0.6) * (1 + 0.07 * Math.sin(t * 2 + p.o));
      let px = cx + Math.cos(ang) * rad * 0.85 + (b.hurt > 0 ? (this.rng() - 0.5) * 10 * b.hurt * this.dpr : 0);
      let py = cy + Math.sin(ang) * rad + Math.sin(t * 1.3 + p.o) * size * 0.04 + p.r * size * 0.25;
      let alpha = painted ? 0.09 : 0.5;
      let color = "4,3,8";
      if (dying > 0) {
        py -= dying * size * (1 + p.r * 2.5);
        px += Math.sin(p.o + dying * 4) * size * 0.3 * dying;
        alpha = 0.6 * (1 - dying);
        color = `${Math.round(lerp(4, tone[0], dying))},${Math.round(lerp(3, tone[1], dying))},${Math.round(lerp(8, tone[2], dying))}`;
      }
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, size * p.size * (dying > 0 ? 1 - dying * 0.6 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    if (dying < 0.4 && !painted) {
      const fadeOut = 1 - dying / 0.4;
      if (b.guardian) {
        ctx.fillStyle = `rgba(232,226,214,${0.9 * fadeOut})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy - size * 0.05, size * 0.27, size * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(199,36,47,${fadeOut})`;
        ctx.lineWidth = 2 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(cx + size * 0.02, cy - size * 0.4);
        ctx.lineTo(cx - size * 0.05, cy - size * 0.2);
        ctx.lineTo(cx + size * 0.04, cy - size * 0.05);
        ctx.lineTo(cx - size * 0.02, cy + size * 0.12);
        ctx.stroke();
      }
      const blink = Math.sin(t * 1.1) > 0.97 ? 0.15 : 1;
      const eyeColor = b.hurt > 0.3 ? "255,255,255" : "255,42,54";
      for (const side of [-1, 1]) {
        const ex = cx + side * size * 0.13;
        const ey = cy - size * 0.08;
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, size * 0.12);
        g.addColorStop(0, `rgba(${eyeColor},${0.85 * fadeOut})`);
        g.addColorStop(1, `rgba(${eyeColor},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(ex - size * 0.12, ey - size * 0.12, size * 0.24, size * 0.24);
        ctx.fillStyle = `rgba(${eyeColor},${fadeOut})`;
        ctx.beginPath();
        ctx.ellipse(ex, ey, size * 0.035, size * 0.022 * blink, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Your light, below.
    const ly = portrait ? h * 0.6 : h * 0.66;
    const lr = (10 + this.light * 3.2) * this.dpr * (1 + Math.sin(t * 6) * 0.03);
    const lg = ctx.createRadialGradient(cx, ly, 0, cx, ly, lr * 3);
    lg.addColorStop(0, "rgba(255,246,216,0.95)");
    lg.addColorStop(0.25, "rgba(255,217,138,0.55)");
    lg.addColorStop(1, "rgba(255,217,138,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(cx - lr * 3, ly - lr * 3, lr * 6, lr * 6);

    // Rings: singing aims at the shadow, defending protects your light.
    const ringBase = size * 0.55;
    if (b.phase === "sing") {
      ctx.strokeStyle = "rgba(247,247,245,0.55)";
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, ringBase, 0, Math.PI * 2);
      ctx.stroke();
      const n = b.notes[b.noteIndex];
      if (n) {
        const p = (b.clock - n.start) / b.noteTime;
        if (p > -0.4) {
          const radius = ringBase * (1 + 2.2 * Math.max(0, 1 - p)) * (p > 1 ? 1 - (p - 1) * 0.6 : 1);
          ctx.strokeStyle = `rgba(255,241,194,${clamp(0.3 + p)})`;
          ctx.lineWidth = 3 * this.dpr;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(2, radius), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      b.notes.forEach((note, i) => {
        ctx.fillStyle = note.result === "miss" ? "rgba(138,143,156,0.9)" : note.result ? "rgba(255,241,194,1)" : "rgba(247,247,245,0.25)";
        ctx.beginPath();
        ctx.arc(cx + (i - (b.notes.length - 1) / 2) * 18 * this.dpr, cy + ringBase + 26 * this.dpr, 4 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (b.phase === "defend") {
      const target = lr * 1.8;
      ctx.strokeStyle = "rgba(255,241,194,0.6)";
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.arc(cx, ly, target, 0, Math.PI * 2);
      ctx.stroke();
      const p = (b.clock - b.defendStart) / b.defendTime;
      if (p > -0.4 && !b.defendResult) {
        const radius = target * (1 + 3 * Math.max(0, 1 - p));
        ctx.strokeStyle = `rgba(199,36,47,${clamp(0.35 + p)})`;
        ctx.lineWidth = 4 * this.dpr;
        ctx.beginPath();
        ctx.arc(cx, ly, Math.max(2, radius), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Floating feedback.
    ctx.textAlign = "center";
    for (const pop of b.popups) {
      ctx.globalAlpha = clamp(1.2 - pop.t);
      ctx.fillStyle = pop.color;
      ctx.font = `italic ${Math.round(22 * this.dpr)}px ${this.font}`;
      const py = (pop.y ? ly - lr * 2.2 : cy - size * 0.75) - pop.t * 30 * this.dpr;
      ctx.fillText(pop.text, cx, py);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----- UI state ------------------------------------------------------------

  private emit() {
    this.ui = this.snapshot();
    for (const l of this.listeners) l();
  }

  private snapshot(): UIState {
    const lvl = this.o.level;
    const ready = this.mode !== "loading" && this.mode !== "error";
    const d = this.dialogue;
    const line = d ? d.lines[d.i] : null;
    const b = this.battle;
    return {
      loading: this.mode === "loading",
      error: this.mode === "error" ? "No se pudo abrir esta página. Probá de nuevo." : null,
      title: lvl.name,
      number: lvl.number,
      light: this.light,
      maxLight: this.o.maxLight,
      verses: this.collected.size,
      totalVerses: ready ? this.map.verses.length : 0,
      portalOpen: this.portalOpen,
      titleCard: this.mode === "intro" ? { title: lvl.name, number: lvl.number, total: this.o.total } : null,
      toast: this.toast,
      dialogue:
        this.mode === "dialogue" && line && d
          ? {
              speaker: line.speaker,
              name: line.name ?? NAMES[line.speaker],
              text: line.text,
              visible: Math.floor(d.visible),
              complete: d.visible >= line.text.length,
              veiled: line.veiled,
            }
          : null,
      battle:
        b && this.mode === "battle"
          ? {
              name: b.name,
              guardian: b.guardian,
              health: b.hp,
              maxHealth: b.maxHp,
              phase: b.phase,
              text: b.text,
              hint: b.hint,
              options: this.battleOptions(b),
              selected: b.selected,
            }
          : null,
      reveal:
        this.reveal?.done && this.mode === "reveal"
          ? { title: lvl.name, meaning: lvl.meaning, route: lvl.route, last: lvl.number === this.o.total }
          : null,
      paused: this.paused,
      blackout: this.mode === "blackout",
    };
  }
}

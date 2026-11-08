import { BAYER, WORLD_H, WORLD_W, buildWorldArt, fogTile, hexRgb, type WorldArt } from "./art";
import { MODES, type AudioEngine, type Key } from "./audio";
import {
  COLS,
  GLOOM,
  ROWS,
  SAMPLE_H,
  SAMPLE_W,
  TILE,
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
import { buildSprites, drawSmoke, ellipse, LAMP_HEIGHT, SMOKE_EYES, type Sprites } from "./sprites";
import type { BattleOption, BattleUI, Dir, LevelSource, Point, Speaker, UIState } from "./types";

/**
 * The game engine for one level: exploration, battles and the final reveal.
 * It draws the world on a canvas and publishes a small UI state that React
 * renders as HTML (dialogue, battle menu, HUD), so text stays crisp and readable.
 */

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
type Glow = { x: number; y: number; r: number; a: number; c: readonly number[]; glow: number };
type Knot = { x: number; y: number; px: number; py: number };

/** Buffers for the light map, computed per world pixel on every frame. */
type LightBuffers = {
  w: number;
  h: number;
  intensity: Float32Array;
  red: Float32Array;
  green: Float32Array;
  blue: Float32Array;
  bloom: Float32Array;
  shade: ImageData;
  glow: ImageData;
};

const WARM = [1, 0.93, 0.8] as const;
const BAND = 5;

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

/** A light's color as multipliers between 0 and 1, softened toward white. */
function tint(hex: string, white = 0.45) {
  return hexRgb(hex).map((v) => (v + (255 - v) * white) / 255);
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
  private glowCanvas: HTMLCanvasElement | null = null;
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogPattern: CanvasPattern | null = null;
  private lightBuffers: LightBuffers | null = null;
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
  private art!: WorldArt;
  private fog!: HTMLCanvasElement;
  private painting!: HTMLImageElement;
  private rainy = false;
  /** How much of each tile the player has seen: explored places stay faintly visible. */
  private seen = new Float32Array(COLS * ROWS);
  private scarf: Knot[] = [];
  private splashes: { x: number; y: number; t: number }[] = [];
  private splashTimer = 0;
  private lampTints = new Map<string, number[]>();
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
    this.glowCanvas = canvas(4, 4);
    this.fogCanvas = canvas(4, 4);
    this.fogPattern = null;
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
    art: () => ({ ground: this.art.ground.toDataURL(), walls: this.art.walls.toDataURL() }),
    sprites: () => {
      const sp = this.sprites;
      const list = [...sp.voice.down, ...sp.voice.up, ...sp.voice.left, ...sp.voice.right, ...sp.angel, sp.feather, sp.lamp("#ffd08a", true, 0), sp.lamp("#ffd08a", false, 0), sp.starRed, sp.starBig, sp.starGold];
      const sheet = canvas(list.reduce((w, c) => w + c.width + 2, 0), 28);
      const g = sheet.getContext("2d")!;
      let x = 0;
      for (const c of list) {
        g.drawImage(c, x, 0);
        x += c.width + 2;
      }
      return sheet.toDataURL();
    },
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
      const particles = this.o.level.weather.particulas ?? [];
      this.rainy = particles.some((p) => p.tipo === "lluvia");
      this.art = buildWorldArt(image, this.map, {
        seed: hash(this.o.level.id),
        tone: this.o.level.tone,
        rain: this.rainy,
        petals: particles.some((p) => p.tipo === "petalos"),
      });
      this.fog = fogTile(hash(this.o.level.id) ^ 0x6f);
      this.seen.fill(0);
      this.scarf = [];
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
      audio.setRain(this.rainy);
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
    if (this.mode !== "battle" && this.mode !== "reveal") {
      this.updateSeen();
      this.updateScarf(dt);
    }

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

  /** Marks what the light reaches as explored. Lit lamps keep their surroundings in memory too. */
  private updateSeen() {
    const mark = (cx: number, cy: number, r: number) => {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (!inside(x, y)) continue;
          const d = Math.hypot(x - cx, y - cy) / r;
          if (d < 1) this.seen[at(x, y)] = Math.max(this.seen[at(x, y)], Math.min(1, (1 - d) * 2.5));
        }
      }
    };
    const pos = this.playerPos();
    mark(pos.x, pos.y, 1.6 + this.light * 0.55);
    for (const lamp of this.visitedLamps) mark(lamp.x, lamp.y, 3);
  }

  /** Where the scarf is tied: the neck, which moves with the direction the Voice faces. */
  private scarfAnchor() {
    const pos = this.playerPos();
    const d = this.player.dir;
    return { x: pos.x * TILE + (d === "left" ? 11 : d === "right" ? 5 : 8), y: pos.y * TILE - 8 + (d === "up" ? 13 : 11) };
  }

  /** The red scarf follows the Voice like a short rope, with gravity and a bit of wind. */
  private updateScarf(dt: number) {
    const a = this.scarfAnchor();
    if (!this.scarf.length) this.scarf = Array.from({ length: 5 }, (_, i) => ({ x: a.x, y: a.y + i * 2, px: a.x, py: a.y + i * 2 }));
    const knots = this.scarf;
    knots[0].x = knots[0].px = a.x;
    knots[0].y = knots[0].py = a.y;
    const dt2 = dt * dt;
    const wind = this.rainy ? -30 : 0;
    for (let i = 1; i < knots.length; i++) {
      const k = knots[i];
      const vx = (k.x - k.px) * 0.9;
      const vy = (k.y - k.py) * 0.9;
      k.px = k.x;
      k.py = k.y;
      k.x += vx + (wind + Math.sin(this.time * 4.3 + i * 0.9) * 26) * dt2;
      k.y += vy + 90 * dt2;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < knots.length; i++) {
        const prev = knots[i - 1];
        const k = knots[i];
        const dx = k.x - prev.x;
        const dy = k.y - prev.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 2.4) {
          k.x = prev.x + (dx / d) * 2.4;
          k.y = prev.y + (dy / d) * 2.4;
        }
      }
    }
  }

  /** The little light that floats around the Voice. It dims as the Voice loses light. */
  private orbPos(t = this.time) {
    const pos = this.playerPos();
    return { x: pos.x * TILE + 8 + Math.cos(t * 1.6) * 9, y: pos.y * TILE - 11 + Math.sin(t * 3.2) * 2 };
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
    // Rain splashes on the visible ground.
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter((s) => s.t < 0.3);
    if (this.rainy && this.map && (this.mode === "explore" || this.mode === "dialogue" || this.mode === "intro")) {
      const { s, ox, oy } = this.view();
      this.splashTimer -= dt;
      while (this.splashTimer < 0) {
        this.splashTimer += 0.03;
        const x = Math.floor((-ox + this.rng() * this.cw) / s);
        const y = Math.floor((-oy + this.rng() * this.ch) / s);
        const tx = Math.floor(x / TILE);
        const ty = Math.floor(y / TILE);
        if (inside(tx, ty) && walkable(this.map.cells[at(tx, ty)])) this.splashes.push({ x, y, t: 0 });
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
    ctx.drawImage(this.art.ground, 0, 0);

    // Visible tiles, to animate only what is on screen.
    const x0 = Math.max(0, Math.floor(-ox / s / TILE) - 1);
    const y0 = Math.max(0, Math.floor(-oy / s / TILE) - 1);
    const x1 = Math.min(COLS - 1, Math.ceil((this.cw - ox) / s / TILE) + 1);
    const y1 = Math.min(ROWS - 1, Math.ceil((this.ch - oy) / s / TILE) + 1);

    if (actorsAlpha > 0) {
      ctx.globalAlpha = actorsAlpha;
      this.drawWater(ctx, x0, y0, x1, y1, t);
      this.drawFog(ctx, s, ox, oy);
      for (const f of m.fogs) {
        const fx = f.x * TILE + Math.sin(t * 0.3 + f.y) * TILE * 0.6;
        const fy = f.y * TILE;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(f.rx, f.ry) * TILE);
        const [r, gg, bb] = rgb(f.color);
        g.addColorStop(0, `rgba(${r},${gg},${bb},0.1)`);
        g.addColorStop(1, `rgba(${r},${gg},${bb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(fx - f.rx * TILE * 1.2, fy - f.ry * TILE * 1.2, f.rx * TILE * 2.4, f.ry * TILE * 2.4);
      }
      // The red star where the page begins, and the title above.
      const star = this.sprites.starRed;
      ctx.drawImage(star, m.start.x * TILE + 8 - (star.width >> 1), m.start.y * TILE + 8 - (star.height >> 1));
      this.drawPortal(ctx, t);
      this.drawSplashes(ctx);
      ctx.globalAlpha = 1;
    }

    if (wallsAlpha > 0) {
      ctx.globalAlpha = wallsAlpha;
      ctx.drawImage(this.art.walls, 0, reveal < 0 ? 0 : Math.round((1 - wallsAlpha) * 6));
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
      ctx.drawImage(this.painting, 0, 0, WORLD_W, WORLD_H);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }

    this.renderLighting(ctx, s, ox, oy, reveal);

    // After the dark: the eyes of the shadows are always visible.
    if (actorsAlpha > 0) {
      ctx.setTransform(s, 0, 0, s, ox, oy);
      for (const sh of this.shadows) {
        if (!sh.alive) continue;
        const sx = Math.round(lerp(sh.fromX, sh.x, sh.t) * TILE + 8);
        const sy = Math.round(lerp(sh.fromY, sh.y, sh.t) * TILE + 13 + Math.cos(t * 1.7 + sh.phase) * 0.9);
        const blink = Math.sin(t * 0.9 + sh.phase * 3) > 0.96;
        const a = actorsAlpha * (sh.stunned > 0 ? 0.45 : 1);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255,40,52,${0.22 * a})`;
        for (const [ex, ey] of SMOKE_EYES) ctx.fillRect(sx + ex - 1, sy + ey - 1, 4, 3);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(255,52,62,${0.95 * a})`;
        for (const [ex, ey] of SMOKE_EYES) ctx.fillRect(sx + ex, sy + ey + (blink ? 0.6 : 0), 2, blink ? 0.4 : 1);
      }
    }

    this.renderWeather(ctx, reveal, s, ox, oy);
  }

  private drawWater(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number) {
    const m = this.map;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (m.cells[at(x, y)] !== WATER) continue;
        const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
        for (let k = 0; k < 2; k++) {
          const phase = (t * (0.3 + (h % 7) * 0.04) + k * 0.5 + (h % 13) / 13) % 1;
          ctx.fillStyle = `rgba(185,215,240,${0.5 * Math.sin(phase * Math.PI)})`;
          ctx.fillRect(x * TILE + ((h >> (k * 4)) % 9) + Math.round(phase * 4), y * TILE + 4 + k * 6 + ((h >> 8) % 3), 2 + k, 1);
        }
      }
    }
    for (const p of this.art.puddles) {
      const phase = (t * 0.8 + p.seed / 1000) % 1;
      const r = 1 + phase * p.rx;
      ctx.fillStyle = `rgba(190,215,235,${0.55 * (1 - phase)})`;
      for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * Math.PI * 2;
        ctx.fillRect(Math.round(p.x + Math.cos(ang) * r), Math.round(p.y + (Math.sin(ang) * r * p.ry) / p.rx), 1, 1);
      }
    }
  }

  /** Fog that drifts over the gloom: a repeating texture, cut to the shape of the gloom. */
  private drawFog(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number) {
    const fc = this.fogCanvas;
    if (!fc) return;
    const fx0 = Math.max(0, Math.floor(-ox / s));
    const fy0 = Math.max(0, Math.floor(-oy / s));
    const w = Math.min(WORLD_W, Math.ceil((this.cw - ox) / s)) - fx0;
    const h = Math.min(WORLD_H, Math.ceil((this.ch - oy) / s)) - fy0;
    if (w <= 0 || h <= 0) return;
    if (fc.width < w || fc.height < h) {
      fc.width = Math.max(fc.width, w);
      fc.height = Math.max(fc.height, h);
      this.fogPattern = null;
    }
    const f = fc.getContext("2d")!;
    this.fogPattern ??= f.createPattern(this.fog, "repeat");
    if (!this.fogPattern) return;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = "source-over";
    f.clearRect(0, 0, w, h);
    f.fillStyle = this.fogPattern;
    const wrap = (v: number) => (((v % 64) + 64) % 64) - 64;
    for (const [speed, alpha, offset] of [
      [4, 1, 0],
      [-2.6, 0.7, 23],
    ]) {
      f.globalAlpha = alpha;
      f.setTransform(1, 0, 0, 1, wrap(Math.round(this.time * speed) + offset - fx0), wrap(Math.round(this.time * speed * 0.35) + offset - fy0));
      f.fillRect(0, 0, w + 128, h + 128);
    }
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalAlpha = 1;
    f.globalCompositeOperation = "destination-in";
    f.drawImage(this.art.gloom, fx0, fy0, w, h, 0, 0, w, h);
    f.globalCompositeOperation = "source-over";
    ctx.drawImage(fc, 0, 0, w, h, fx0, fy0, w, h);
  }

  private drawSplashes(ctx: CanvasRenderingContext2D) {
    for (const sp of this.splashes) {
      ctx.fillStyle = `rgba(205,222,238,${0.65 * (1 - sp.t / 0.3)})`;
      if (sp.t < 0.08) {
        ctx.fillRect(sp.x, sp.y - 1, 1, 1);
        continue;
      }
      const r = sp.t < 0.18 ? 1 : 2;
      ctx.fillRect(sp.x - r, sp.y, 1, 1);
      ctx.fillRect(sp.x + r, sp.y, 1, 1);
      if (r === 1) ctx.fillRect(sp.x, sp.y - 1, 1, 1);
    }
  }

  private drawPortal(ctx: CanvasRenderingContext2D, t: number) {
    const p = this.map.portal;
    const x = p.x * TILE + 8;
    const y = p.y * TILE + 8;
    if (!this.portalOpen) {
      // Embers turning around the closed star.
      for (let k = 0; k < 12; k++) {
        const a = t * 0.6 + (k / 12) * Math.PI * 2;
        ctx.fillStyle = k % 2 ? "rgba(199,36,47,0.85)" : "rgba(152,18,26,0.55)";
        ctx.fillRect(Math.round(x + Math.cos(a) * 13), Math.round(y + Math.sin(a) * 7), 1, 1);
      }
      const star = this.sprites.starBig;
      ctx.drawImage(star, x - (star.width >> 1), y - (star.height >> 1));
      return;
    }
    const pulse = (Math.sin(t * 2.4) + 1) / 2;
    // A beam of light in stepped bands, brighter at the core.
    for (let k = 0; k < 4; k++) {
      const half = 8 - k * 2;
      ctx.fillStyle = `rgba(255,241,194,${(0.1 + k * 0.07) * (0.7 + pulse * 0.3)})`;
      ctx.fillRect(x - half, y - 90, half * 2, 96);
    }
    for (let k = 0; k < 10; k++) {
      const s = (t * 0.45 + k / 10) % 1;
      ctx.fillStyle = `rgba(255,246,216,${1 - s})`;
      ctx.fillRect(Math.round(x + Math.sin(k * 2.1 + t) * 6), Math.round(y - s * 70), 1, 1);
    }
    const star = this.sprites.starGold;
    ctx.drawImage(star, x - (star.width >> 1), y - (star.height >> 1) + Math.round(Math.sin(t * 2) * 2));
  }

  private drawActors(ctx: CanvasRenderingContext2D, t: number) {
    const m = this.map;
    const sp = this.sprites;
    const shade = "rgba(0,0,0,0.4)";
    const items: { y: number; draw: () => void }[] = [];
    const flame = Math.floor(t * 7) % 2;
    for (const l of m.lamps) {
      const lit = this.visitedLamps.has(l);
      items.push({
        y: l.y,
        draw: () => {
          ctx.drawImage(ellipse(4, 1, shade), l.x * TILE + 4, l.y * TILE + 14);
          ctx.drawImage(sp.lamp(l.color, lit, flame), l.x * TILE + 3, l.y * TILE + 16 - LAMP_HEIGHT);
        },
      });
    }
    for (const v of m.verses) {
      if (this.collected.has(v.index)) continue;
      const bob = Math.round(Math.sin(t * 2.2 + v.index) * 1.5);
      items.push({
        y: v.y,
        draw: () => {
          ctx.drawImage(ellipse(3, 1, "rgba(255,226,150,0.3)"), v.x * TILE + 5, v.y * TILE + 13);
          ctx.drawImage(sp.feather, v.x * TILE + 4, v.y * TILE - 1 + bob);
          for (let k = 0; k < 3; k++) {
            const s = (t * 0.8 + k / 3 + v.index * 0.37) % 1;
            ctx.fillStyle = `rgba(255,246,216,${Math.sin(s * Math.PI)})`;
            ctx.fillRect(v.x * TILE + 8 + Math.round(Math.sin(k * 2.7 + v.index) * 6), v.y * TILE + 10 - Math.round(s * 14), 1, 1);
          }
        },
      });
    }
    const a = m.angel;
    const flap = Math.sin(t * 2.6) > 0 ? 1 : 0;
    const hover = Math.round(Math.sin(t * 1.3) * 1.5);
    items.push({
      y: a.y,
      draw: () => {
        ctx.drawImage(ellipse(5, 1, shade), a.x * TILE + 3, a.y * TILE + 14);
        ctx.drawImage(sp.angel[flap], a.x * TILE - 4, a.y * TILE - 13 + hover);
      },
    });
    for (const sh of this.shadows) {
      if (!sh.alive) continue;
      const ty = lerp(sh.fromY, sh.y, sh.t);
      const sx = Math.round(lerp(sh.fromX, sh.x, sh.t) * TILE + 8);
      const sy = Math.round(ty * TILE + 13);
      items.push({
        y: ty,
        draw: () => {
          ctx.drawImage(ellipse(5, 1, "rgba(0,0,0,0.5)"), sx - 5, sy + 1);
          const alpha = ctx.globalAlpha;
          ctx.globalAlpha = alpha * (sh.stunned > 0 ? 0.5 : 0.96);
          drawSmoke(ctx, sx, sy, t, sh.phase, sh.stunned > 0 ? 0.3 : 1);
          ctx.globalAlpha = alpha;
        },
      });
    }
    const p = this.player;
    const pos = this.playerPos();
    const frames = sp.voice[p.dir];
    const step = p.moving ? Math.floor(this.walkClock / 0.12) % 4 : 0;
    const frame = step === 1 ? frames[1] : step === 3 ? frames[2] : frames[0];
    const bob = step === 1 || step === 3 ? -1 : 0;
    const blinking = this.invulnerable > 0 && Math.floor(t * 10) % 2 === 0;
    const px = Math.round(pos.x * TILE);
    const py = Math.round(pos.y * TILE);
    items.push({
      y: pos.y,
      draw: () => {
        ctx.drawImage(ellipse(5, 1, shade), px + 3, py + 14);
        if (blinking) return;
        if (p.dir === "down") this.drawScarf(ctx);
        ctx.drawImage(frame, px, py - 8 + bob);
        if (p.dir !== "down") this.drawScarf(ctx);
      },
    });
    items.sort((i, j) => i.y - j.y);
    for (const it of items) it.draw();
    this.drawOrb(ctx);
  }

  private drawScarf(ctx: CanvasRenderingContext2D) {
    const knots = this.scarf;
    for (let i = 0; i < knots.length - 1; i++) {
      const a = knots[i];
      const b = knots[i + 1];
      ctx.fillStyle = i < 2 ? "#c7242f" : "#8a0f18";
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let k = 0; k <= steps; k++) {
        ctx.fillRect(Math.round(a.x + ((b.x - a.x) * k) / steps), Math.round(a.y + ((b.y - a.y) * k) / steps), i < 2 ? 2 : 1, 1);
      }
    }
  }

  private drawOrb(ctx: CanvasRenderingContext2D) {
    const o = this.orbPos();
    const x = Math.round(o.x);
    const y = Math.round(o.y);
    const k = 0.4 + 0.6 * (this.light / this.o.maxLight);
    for (let i = 1; i <= 2; i++) {
      const trail = this.orbPos(this.time - i * 0.07);
      ctx.fillStyle = `rgba(255,217,138,${(0.5 - i * 0.18) * k})`;
      ctx.fillRect(Math.round(trail.x), Math.round(trail.y), 1, 1);
    }
    ctx.fillStyle = `rgba(255,217,138,${0.85 * k})`;
    ctx.fillRect(x - 1, y, 4, 2);
    ctx.fillRect(x, y - 1, 2, 4);
    ctx.fillStyle = `rgba(255,251,232,${k})`;
    ctx.fillRect(x, y, 2, 2);
  }

  private ensureLight(w: number, h: number) {
    let b = this.lightBuffers;
    if (!b || b.w !== w || b.h !== h) {
      const n = w * h;
      b = {
        w,
        h,
        intensity: new Float32Array(n),
        red: new Float32Array(n),
        green: new Float32Array(n),
        blue: new Float32Array(n),
        bloom: new Float32Array(n),
        shade: new ImageData(w, h),
        glow: new ImageData(w, h),
      };
      this.lightBuffers = b;
      for (const c of [this.lightCanvas, this.glowCanvas]) {
        if (c && (c.width < w || c.height < h)) {
          c.width = Math.max(c.width, w);
          c.height = Math.max(c.height, h);
        }
      }
    }
    return b;
  }

  private lampTint(color: string) {
    let c = this.lampTints.get(color);
    if (!c) {
      c = tint(color);
      this.lampTints.set(color, c);
    }
    return c;
  }

  /**
   * The light map, one value per world pixel: each light adds warmth around it,
   * the rest falls to a dim moonlight, brighter where the Voice has already been.
   * Light is reduced to a few bands with ordered dithering, as in pixel art, and
   * then multiplied over the world. A second pass adds the glow of the lights.
   */
  private renderLighting(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number, reveal: number) {
    const lc = this.lightCanvas;
    const gc = this.glowCanvas;
    if (!lc || !gc) return;
    const t = this.time;
    const m = this.map;
    const darkMul = reveal < 0 ? 1 : 1 - ease(clamp(reveal / 2.2));
    const dark = m.darkness * darkMul * (1 - this.flash * 0.8);
    if (dark <= 0.01) return;

    // The part of the world on screen, coarser while the camera zooms out.
    const k = s >= 2.5 ? 1 : 2;
    const wx0 = Math.max(-k, Math.floor(-ox / s / k) * k);
    const wy0 = Math.max(-k, Math.floor(-oy / s / k) * k);
    const wx1 = Math.min(WORLD_W + k, Math.ceil((this.cw - ox) / s));
    const wy1 = Math.min(WORLD_H + k, Math.ceil((this.ch - oy) / s));
    const w = Math.ceil((wx1 - wx0) / k);
    const h = Math.ceil((wy1 - wy0) / k);
    if (w <= 0 || h <= 0) return;
    const L = this.ensureLight(w, h);
    const n = w * h;
    const { intensity, red, green, blue, bloom } = L;
    intensity.fill(0, 0, n);
    red.fill(0, 0, n);
    green.fill(0, 0, n);
    blue.fill(0, 0, n);
    bloom.fill(0, 0, n);

    const lights: Glow[] = [];
    const pos = this.playerPos();
    const flicker = 1 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 13.1) * 0.02;
    if (this.mode !== "reveal") {
      lights.push({ x: pos.x + 0.5, y: pos.y + 0.35, r: (2.4 + this.light * 0.75 + this.singPulse * 2.6) * flicker, a: 1, c: WARM, glow: 0.2 + this.singPulse * 0.3 });
      const orb = this.orbPos();
      lights.push({ x: orb.x / TILE, y: orb.y / TILE, r: 0.9, a: 0.4, c: [1, 0.95, 0.82], glow: 0.3 * (0.4 + (0.6 * this.light) / this.o.maxLight) });
    }
    for (const lamp of m.lamps) {
      const lit = this.visitedLamps.has(lamp);
      lights.push({
        x: lamp.x + 0.5,
        y: lamp.y + 0.1,
        r: (lit ? lamp.radius : 2.1) * (1 + Math.sin(t * 5 + lamp.x) * 0.04),
        a: lit ? 1 : 0.75,
        c: this.lampTint(lamp.color),
        glow: lit ? 0.4 : 0.22,
      });
    }
    for (const v of m.verses) {
      if (!this.collected.has(v.index)) lights.push({ x: v.x + 0.5, y: v.y + 0.5, r: 1.5 + Math.sin(t * 2.2 + v.index) * 0.2, a: 0.85, c: [1, 0.95, 0.78], glow: 0.3 });
    }
    lights.push({ x: m.angel.x + 0.5, y: m.angel.y + 0.1, r: 1.9, a: 0.85, c: [0.86, 0.9, 1], glow: 0.2 });
    lights.push({ x: m.start.x + 0.5, y: m.start.y + 0.5, r: 1.2, a: 0.6, c: [1, 0.5, 0.5], glow: 0.25 });
    lights.push(
      this.portalOpen
        ? { x: m.portal.x + 0.5, y: m.portal.y + 0.3, r: 4.4, a: 1, c: [1, 0.95, 0.8], glow: 0.45 }
        : { x: m.portal.x + 0.5, y: m.portal.y + 0.5, r: 1.5, a: 0.55, c: [1, 0.45, 0.45], glow: 0.25 },
    );
    for (const sp of m.sparkles) {
      const q = (Math.sin(t * 3 + sp.x * 1.7 + sp.y) + 1) / 2;
      lights.push({ x: sp.x + 0.5, y: sp.y + 0.5, r: 0.5 + q * 0.6, a: 0.7, c: [1, 1, 1], glow: 0.3 * q });
    }

    for (const li of lights) {
      const cx = (li.x * TILE - wx0) / k;
      const cy = (li.y * TILE - wy0) / k;
      const r = (li.r * TILE) / k;
      const bx0 = Math.max(0, Math.floor(cx - r));
      const bx1 = Math.min(w - 1, Math.ceil(cx + r));
      const by0 = Math.max(0, Math.floor(cy - r));
      const by1 = Math.min(h - 1, Math.ceil(cy + r));
      if (bx0 > bx1 || by0 > by1) continue;
      const inv = 1 / (r * r);
      const [cr, cg, cb] = li.c;
      const glowing = li.glow;
      for (let y = by0; y <= by1; y++) {
        const dy = y + 0.5 - cy;
        const dy2 = dy * dy;
        let o = y * w + bx0;
        for (let x = bx0; x <= bx1; x++, o++) {
          const dx = x + 0.5 - cx;
          const d2 = (dx * dx + dy2) * inv;
          if (d2 >= 1) continue;
          const f = 1 - d2;
          const v = li.a * f * (0.55 + 0.45 * f);
          intensity[o] += v;
          red[o] += v * cr;
          green[o] += v * cg;
          blue[o] += v * cb;
          if (glowing) bloom[o] += glowing * f * f * f;
        }
      }
    }

    const ambient = 0.17 + (1 - dark) * 0.6;
    const memory = 0.17 * darkMul;
    const shade = new Uint32Array(L.shade.data.buffer);
    const glow = new Uint32Array(L.glow.data.buffer);
    glow.fill(0xff000000, 0, n);
    const seen = this.seen;
    // Which tiles each column reads from, and how far between them.
    const col0 = new Int32Array(w);
    const col1 = new Int32Array(w);
    const colT = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      const fx = (wx0 + (x + 0.5) * k) / TILE - 0.5;
      const tx = Math.floor(fx);
      col0[x] = tx < 0 ? 0 : tx > COLS - 1 ? COLS - 1 : tx;
      col1[x] = tx + 1 < 0 ? 0 : tx + 1 > COLS - 1 ? COLS - 1 : tx + 1;
      colT[x] = fx - tx;
    }
    const row = new Float32Array(COLS);
    for (let y = 0; y < h; y++) {
      const fy = (wy0 + (y + 0.5) * k) / TILE - 0.5;
      const ty = Math.floor(fy);
      const ay = fy - ty;
      const r0 = (ty < 0 ? 0 : ty > ROWS - 1 ? ROWS - 1 : ty) * COLS;
      const r1 = (ty + 1 < 0 ? 0 : ty + 1 > ROWS - 1 ? ROWS - 1 : ty + 1) * COLS;
      for (let c = 0; c < COLS; c++) row[c] = seen[r0 + c] + (seen[r1 + c] - seen[r0 + c]) * ay;
      const bayerRow = (y & 3) * 4;
      for (let x = 0; x < w; x++) {
        const o = y * w + x;
        const s0 = row[col0[x]];
        const base = ambient + memory * (s0 + (row[col1[x]] - s0) * colT[x]);
        const bay = BAYER[bayerRow + (x & 3)];
        const I = intensity[o];
        let r = base * 0.6;
        let g = base * 0.7;
        let b = base;
        if (I > 0) {
          const inv = 1 / I;
          const hr = red[o] * inv;
          const hg = green[o] * inv;
          const hb = blue[o] * inv;
          const v = I * 1.35;
          let lit = ((v > 1 ? 1 : v) * BAND + 0.5 + (bay - 0.5) * 0.12) | 0;
          lit = lit > BAND ? 1 : lit / BAND;
          r += (hr - r) * lit;
          g += (hg - g) * lit;
          b += (hb - b) * lit;
          const q = bloom[o];
          if (q > 0.01) {
            const gl = q > 1 ? 255 : q * 255;
            glow[o] = 0xff000000 | ((hb * gl) << 16) | ((hg * gl) << 8) | (hr * gl);
          }
        }
        shade[o] = 0xff000000 | ((b > 1 ? 255 : b * 255) << 16) | ((g > 1 ? 255 : g * 255) << 8) | (r > 1 ? 255 : r * 255);
      }
    }
    lc.getContext("2d")!.putImageData(L.shade, 0, 0);
    gc.getContext("2d")!.putImageData(L.glow, 0, 0);

    ctx.setTransform(s * k, 0, 0, s * k, ox + wx0 * s, oy + wy0 * s);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(lc, 0, 0, w, h, 0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = darkMul;
    ctx.drawImage(gc, 0, 0, w, h, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private renderWeather(ctx: CanvasRenderingContext2D, reveal: number, s: number, ox: number, oy: number) {
    const alpha = reveal < 0 ? 1 : 1 - clamp(reveal / 1.5);
    if (alpha > 0 && this.drops.length) {
      // In world pixels, so the weather has the same pixel size as everything else.
      ctx.setTransform(s, 0, 0, s, ox, oy);
      const vx = -ox / s;
      const vy = -oy / s;
      const vw = this.cw / s;
      const vh = this.ch / s;
      for (const d of this.drops) {
        const x = Math.floor(vx + d.x * vw);
        const y = Math.floor(vy + d.y * vh);
        if (d.color === "lluvia") {
          ctx.fillStyle = `rgba(178,200,224,${(0.34 + this.flash * 0.4) * alpha})`;
          ctx.fillRect(x, y, 1, 3);
          ctx.fillRect(x - 1, y + 3, 1, 3);
        } else if (d.color === "#ffe6a8") {
          const k = (Math.sin(this.time * 2 + d.phase) + 1) / 2;
          ctx.fillStyle = `rgba(255,230,168,${(0.3 + k * 0.5) * alpha})`;
          ctx.fillRect(x, y, 1, 1);
        } else {
          const flat = Math.cos(d.rot) > 0;
          ctx.globalAlpha = 0.9 * alpha;
          ctx.fillStyle = d.color;
          ctx.fillRect(x, y, flat ? 2 : 1, flat ? 1 : 2);
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = this.cw;
    const h = this.ch;
    if (this.flash > 0 && reveal < 0) {
      ctx.fillStyle = `rgba(220,230,255,${this.flash * (this.o.reducedMotion ? 0.08 : 0.2)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (reveal < 0) {
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) * 0.56);
      v.addColorStop(0, "rgba(2,3,5,0)");
      v.addColorStop(1, "rgba(2,3,5,0.6)");
      ctx.fillStyle = v;
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

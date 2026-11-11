import { ART, WORLD_H, WORLD_W, buildWorldArt, fogTile, hexRgb, type WorldArt } from "./art";
import { MODES, type AudioEngine, type Key } from "./audio";
import {
  COLS,
  GLOOM,
  ROWS,
  SAMPLE_H,
  SAMPLE_W,
  TILE,
  WALL,
  WATER,
  at,
  distances,
  findPath,
  footprint,
  generateMap,
  INDOORS,
  inside,
  walkable,
  type GameMap,
  type Lamp,
  type Prop,
  type Verse,
} from "./level";
import { drawCrown, drawSilhouette, drawStrings, drawWisps, loadSceneArt, type SceneArt } from "./scene";
import type { ElementoEscena } from "@/contenido";
import { createRng, hash, pick, type Rng } from "./rng";
import {
  drawSmoke,
  drawStar,
  drawVoice,
  groundShadow,
  loadMaterial,
  loadPainted,
  SMOKE_EYES,
  stand,
  voicePose,
  type Painted,
  type View,
} from "./painted";
import { buildSprites, LAMP_HEIGHT, type Sprites } from "./sprites";
import type { BattleUI, Dir, FoundUI, LevelSource, Point, Speaker, TallyUI, UIState } from "./types";
import { doubt, phrase, styleOf, tell, timing, travelBeats, wholeLines, type Style, type Timing } from "./battle";
import { getProgress, subscribeProgress, updateProgress } from "./progress";
import { FEATHER, GIFTS, VOICE, keep, loadout, rankOf, type Gift, type Keepsake } from "./keepsakes";

/**
 * The game engine for one level: exploration, battles and the final reveal.
 * It draws the world on a canvas and publishes a small UI state that React
 * renders as HTML (dialogue, battle panel, HUD), so text stays crisp and readable.
 */

const STEP_TIME = 0.2;
const TYPE_SPEED = 48;
const DELTA: Record<Dir, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

const NAMES: Record<Speaker, string> = {
  angel: "El ángel",
  voice: "La Voz",
  shadow: "Sombra",
  guardian: "Guardián",
  narrator: "",
  verse: "Verso",
  figure: "",
};

type Line = { speaker: Speaker; text: string; name?: string; veiled?: boolean; portrait?: string };
type Mode = "loading" | "intro" | "explore" | "dialogue" | "found" | "battle" | "reveal" | "blackout" | "error";

type Actor = { x: number; y: number; fromX: number; fromY: number; t: number; moving: boolean; duration: number; dir: Dir };
type Shadow = Actor & { name: string; home: Point; timer: number; stunned: number; alive: boolean; phase: number };
/** Someone or something of the painting, inside the level. */
type Thing = Actor & {
  prop: Prop;
  el: ElementoEscena;
  /** How far along its route it is. */
  step: number;
  /** 1 when it is fully there; people who walk away fade out at the end and start over. */
  fade: number;
  phase: number;
  picked: boolean;
  /** How long it has waited for the way to clear. */
  wait: number;
};
/** A small shadow that snatches a verse and runs: catching it gives the verse back. */
type Thief = Actor & { verse: number; timer: number; stunned: number; age: number; phase: number };
/** What a page gave the voice, by what it was earned for. */
type Tally = { verses: number; notes: number; shadows: number; keepsake: number; thief: number; page: number; clean: number };
/** Light motes going from someone toward the nearest missing verse. */
type Trail = { points: Point[]; age: number };

type BattleNote = {
  at: number;
  travel: number;
  side: number;
  degree: number;
  style: Style;
  result: null | "perfect" | "good" | "early" | "late";
  /** When it was answered or missed, for its burst of light or darkness. */
  doneAt: number;
  /** Whether the shadow already sang it. */
  called: boolean;
  /** Waits on the light until the Voice sings: the first note of the rehearsal. */
  hold: boolean;
};

type Battle = {
  guardian: boolean;
  name: string;
  /** The kinds of singing of this battle, one per phrase in turn: the guardian mixes the page's shadows. */
  styles: { style: Style; name: string }[];
  style: Style;
  hp: number;
  maxHp: number;
  phase: BattleUI["phase"];
  text: string;
  hint: string;
  verse: boolean;
  shadow: Shadow | null;
  clock: number;
  intro: number;
  timing: Timing;
  nextBeat: number;
  beats: number;
  /** 1 on each beat, fading: the light and the shadow breathe with it. */
  pulse: number;
  notes: BattleNote[];
  phrases: number;
  /** Notes missed in this phrase. */
  misses: number;
  restUntil: number;
  endAt: number;
  /** The first battle teaches: 1 while one held note waits, 2 for a short phrase that can't hurt. */
  lesson: 0 | 1 | 2;
  /** Answered notes flying back at the shadow as light. */
  bolts: { t: number; amount: number; big: boolean }[];
  /** 1 when a whole phrase was answered, fading. */
  flare: number;
  /** 1 when the light was hit, fading. */
  wound: number;
  /** Whether the keepsake that takes the first blow already took it. */
  shielded: boolean;
  /** Counts down after the light goes out, so the blow is seen before the blackout. */
  losing: number;
  hurt: number;
  dying: number;
  /** Grades over the light; changes to the light itself (low) beside it. */
  popups: { text: string; t: number; color: string; big: boolean; low: boolean }[];
  particles: { a: number; r: number; s: number; size: number; o: number }[];
  origin: Point;
};

/** Seconds an answered note takes to fly from the light to the shadow. */
const BOLT_TIME = 0.28;
/** Seconds the verse thief dashes before it can be stopped with a song. */
const THIEF_SPRINT = 1.6;

type Drop = { x: number; y: number; vx: number; vy: number; size: number; rot: number; spin: number; color: string; phase: number };
type Glow = {
  x: number;
  y: number;
  /** Reach, in tiles. */
  r: number;
  a: number;
  c: readonly number[];
  /** Whether walls cast shadows from this light. */
  shadow: boolean;
  glow: number;
  gx: number;
  gy: number;
  gr: number;
};

/** Buffers for the light map, reused between frames. */
type LightBuffers = {
  intensity: Float32Array;
  red: Float32Array;
  green: Float32Array;
  blue: Float32Array;
  image: ImageData | null;
  /** What the lights add on top, so lit places look warm and not just less dark. */
  bloom: ImageData | null;
};

const WARM = [1, 0.86, 0.66] as const;

/** Heights of the painted figures, in world pixels (a tile is 16). */
const VOICE_TALL = 28;
const ANGEL_TALL = 31;
const LAMP_TALL = 40;
/** Where the Voice holds the lantern in each direction, from its feet. */
const LANTERN: Record<Dir, Point> = { down: { x: -2.7, y: 9.5 }, up: { x: 5, y: 10.1 }, left: { x: -4.7, y: 10.3 }, right: { x: 4.7, y: 10.3 } };
/** Where the lamp's flame is, from the foot of its post. */
const FLAME = { x: 2.7, y: 29 };

export type EngineOptions = {
  level: LevelSource;
  total: number;
  /** Every keepsake of the book: the ones the Voice carries give their gifts here. */
  catalog: Keepsake[];
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
  private paintedArt: Painted | null = null;
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
  private things: Thing[] = [];
  private sceneArt: SceneArt = new Map();
  /** The images of what the Voice has picked up, like a key. */
  /** The images of what the Voice has on it: what it picked up in this page and the keepsakes it carries. */
  private carried = new Set<string>();
  private picked = new Set<string>();
  private maxLight = 3;
  private gifts = new Set<Gift>();
  private rankIndex = 0;
  private halo = false;
  private carriedUI: UIState["carried"] = [];
  private unsubscribe: (() => void) | null = null;
  private tally: Tally = { verses: 0, notes: 0, shadows: 0, keepsake: 0, thief: 0, page: 0, clean: 0 };
  /** Voice earned lately and not shown yet: one number in the HUD, not one per note. */
  private gainSum = 0;
  private gainTimer = 0;
  private gainId = 0;
  /** The rank reached in this page, if the voice grew. */
  private grewTo: string | null = null;
  private banner: UIState["banner"] = null;
  private bannerTimer = 0;
  /** Whether the light went out in this page. */
  private wentOut = false;
  /** Whether the keepsake that relights the Voice was already used in this page. */
  private woke = false;
  private found: FoundUI | null = null;
  private foundAt = 0;
  private afterFound: (() => void) | null = null;
  private thief: Thief | null = null;
  /** How many verses the Voice must hold for the thief to strike; 0 when it doesn't come. */
  private thiefAt = 0;
  private trail: Trail | null = null;
  /** Someone the Voice is walking to, to talk once it gets there. */
  private pendingTalk: Thing | null = null;
  private clapTimer = 0;
  /** 0 while the Voice stands, 1 while it walks; eases between them so the legs settle. */
  private walkBlend = 0;
  /** How far the Voice's body is moved by its walk this frame, in world pixels, for the lantern. */
  private voiceShift = { x: 0, y: 0 };
  private held: Dir[] = [];
  private pad: Dir | null = null;
  private path: Point[] = [];
  private light: number;
  private collected = new Set<number>();
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
    this.refreshLoadout();
    this.light = this.maxLight;
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
    // The chest can be opened in the middle of a page: what is carried changes right away.
    this.unsubscribe = subscribeProgress(() => {
      this.refreshLoadout();
      this.emit();
    });
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
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.o.audio.setBattle(false);
    this.o.audio.setRain(false);
    this.canvasEl = null;
    this.ctx = null;
  }

  /** Direction from the on-screen pad, or null when released. */
  setPad(dir: Dir | null) {
    this.pad = dir;
    if (dir) this.path = [];
  }

  pressA() {
    if (this.paused) return;
    if (this.mode === "intro") this.titleCardTimer = Math.min(this.titleCardTimer, 0.2);
    else if (this.mode === "dialogue") this.advanceDialogue();
    else if (this.mode === "found") this.closeFound();
    else if (this.mode === "battle") this.battleA();
    else if (this.mode === "explore" && !this.player.moving) this.interact();
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
    // Someone or something of the painting: walk up to it and talk.
    const touched = this.thingOnScreen(wx, wy);
    if (touched) {
      const tiles = this.thingTiles(touched);
      const beside = tiles.find((q) => manhattan(q, p) === 1);
      if (beside) {
        p.dir = (Object.keys(DELTA) as Dir[]).find((d) => p.x + DELTA[d].x === beside.x && p.y + DELTA[d].y === beside.y) ?? p.dir;
        this.examine(touched);
        return;
      }
      let best: Point[] | null = null;
      for (const q of tiles) {
        for (const d of Object.values(DELTA)) {
          const n = { x: q.x + d.x, y: q.y + d.y };
          if (this.blocksPlayer(n)) continue;
          const route = findPath(this.map.cells, p, n, (x, y) => this.blocksPlayer({ x, y }));
          if (route && (!best || route.length < best.length)) best = route;
        }
      }
      if (best) {
        this.path = best;
        this.pendingTalk = touched;
        return;
      }
    }
    const route = findPath(this.map.cells, p, target, (x, y) => this.blocksPlayer({ x, y }));
    if (route?.length) this.path = route;
  }

  debug = {
    collectAll: () => {
      for (const v of this.map.verses) this.collected.add(v.index);
      this.openPortal();
    },
    /** Starts a battle against a shadow, by name if given (each name sings its own way). */
    fight: (name?: string) => this.startBattle(null, false, name),
    /** The battle's clock and notes, to answer them on time from a test. */
    battle: () => {
      const b = this.battle;
      return b ? { phase: b.phase, hp: b.hp, lesson: b.lesson, style: b.style, clock: b.clock, notes: b.notes.map((n) => ({ at: n.at, result: n.result, hold: n.hold })) } : null;
    },
    press: () => this.pressA(),
    guardian: () => this.startBattle(null, true),
    win: () => {
      if (this.battle) {
        this.battle.hp = 0;
        this.win();
      }
    },
    reveal: () => this.startReveal(),
    /** Makes the thief strike now, taking the last verse rescued. */
    thief: () => {
      const last = this.map.verses.filter((v) => this.collected.has(v.index)).pop();
      if (last && !this.thief) this.startThief(last);
      return this.thief ? { x: this.thief.x, y: this.thief.y } : null;
    },
    thiefAt: () => (this.thief ? { x: this.thief.x, y: this.thief.y, stunned: this.thief.stunned > 0 } : null),
    /** Where this page's keepsake lies, if it is still there. */
    keepsake: () => {
      const th = this.things.find((x) => x.el.recuerdo && !x.picked);
      return th ? { x: th.x, y: th.y, image: th.el.imagen ?? null } : null;
    },
    gifts: () => [...this.gifts],
    loadout: () => ({ maxLight: this.maxLight, rank: this.rankIndex, carried: [...this.carried] }),
    art: () => {
      const half = (layer: HTMLCanvasElement) => {
        const c = canvas(layer.width / ART, layer.height / ART);
        c.getContext("2d")!.drawImage(layer, 0, 0, c.width, c.height);
        return c.toDataURL();
      };
      return { ground: half(this.art.ground), walls: half(this.art.walls) };
    },
    /** The Voice at eight moments of its walk, for each view, drawn large. */
    walk: (size = 280) => {
      const voice = this.paintedArt?.voice;
      if (!voice) return null;
      const views: View[] = ["front", "back", "side"];
      const k = size / 280;
      const c = canvas(8 * 180 * k, views.length * 300 * k);
      const g = c.getContext("2d")!;
      g.fillStyle = "#3c5a3c";
      g.fillRect(0, 0, c.width, c.height);
      views.forEach((view, row) => {
        for (let i = 0; i < 8; i++) {
          const phase = (i * Math.PI) / 4;
          drawVoice(g, voice[view], (90 + i * 180) * k, (290 + row * 300) * k, size, false, voicePose(voice[view], view, phase, 1, 0));
        }
      });
      return c.toDataURL();
    },
    state: () => ({ mode: this.mode, player: { x: this.player.x, y: this.player.y }, light: this.light, verses: this.collected.size, tally: { ...this.tally } }),
    /** The people and things of the painting in this level. */
    things: () => this.things.map((th) => ({ name: th.el.nombre, x: th.x, y: th.y, copy: th.prop.copy, image: th.el.imagen ?? null })),
    /** Sends the shadows away, to walk a level without battles. */
    calm: () => {
      for (const s of this.shadows) s.alive = false;
      this.stepsSinceEncounter = -1e9;
    },
    /** Where the verses still missing are. */
    verses: () => this.map.verses.filter((v) => !this.collected.has(v.index)).map((v) => ({ x: v.x, y: v.y, index: v.index })),
    /** Walks the Voice to a tile along the way a tap would take; false if it can't get there. */
    walkTo: (x: number, y: number) => {
      const route = findPath(this.map.cells, this.player, { x, y }, (tx, ty) => this.blocksPlayer({ x: tx, y: ty }));
      if (route?.length) this.path = route;
      return Boolean(route?.length);
    },
    /** Puts the Voice on a tile, to check what happens there. */
    goto: (x: number, y: number, dir: Dir = "up") => {
      this.player = { ...this.player, x, y, fromX: x, fromY: y, t: 1, moving: false, dir };
    },
    /** Shows the whole level lit, from afar, to check where everything is. */
    overview: (scale = 1.1) => {
      this.scale = scale;
      this.map.darkness = 0;
      this.seen.fill(1);
    },
    /** Takes them out of the level, to compare how fast it draws without them. */
    clearScene: () => {
      this.things = [];
    },
    /** Talks to one of them, as if the Voice were beside it. */
    talk: (i: number) => this.things[i] && this.examine(this.things[i]),
    /** Where the Voice's feet are on screen, in device pixels. */
    feet: () => {
      const v = this.view();
      const pos = this.playerPos();
      return { x: (pos.x * TILE + 8) * v.s + v.ox, y: (pos.y * TILE + 15) * v.s + v.oy };
    },
  };

  // ----- Loading -------------------------------------------------------------

  private async load(session: number) {
    try {
      const src = this.o.level.image;
      const names = (this.o.level.scene?.elementos ?? []).flatMap((e) => (e.imagen ? [e.imagen] : []));
      const place = this.o.level.scene?.lugar;
      const [image, painted, sceneArt, material] = await Promise.all([
        this.loadImage(`/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`).catch(() => this.loadImage(src)),
        loadPainted(),
        loadSceneArt(names),
        loadMaterial(place),
      ]);
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
      this.paintedArt = painted;
      this.sceneArt = sceneArt;
      this.art = buildWorldArt(
        image,
        this.map,
        { ground: material.ground ?? painted.ground, rock: material.rock ?? painted.rock, boulder: painted.boulder, face: material.face },
        {
          seed: hash(this.o.level.id),
          tone: this.o.level.tone,
          rain: this.rainy,
          petals: particles.some((p) => p.tipo === "petalos"),
          indoors: place ? INDOORS.has(place) : false,
        },
      );
      this.fog = fogTile(hash(this.o.level.id) ^ 0x6f);
      this.seen.fill(0);
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
      const elements = this.o.level.scene?.elementos ?? [];
      this.things = m.props.map((prop, i) => ({
        x: prop.x,
        y: prop.y,
        fromX: prop.x,
        fromY: prop.y,
        t: 1,
        moving: false,
        duration: 0.5,
        dir: "up",
        prop,
        el: elements[prop.index],
        step: 0,
        fade: 1,
        phase: (i * 1.618) % 6.28,
        // A keepsake already in the chest is not on the page any more.
        picked: Boolean(elements[prop.index].recuerdo && getProgress().keepsakes.includes(elements[prop.index].imagen ?? "")),
        wait: 0,
      }));
      this.picked.clear();
      this.refreshLoadout();
      this.light = this.maxLight;
      this.trail = null;
      this.pendingTalk = null;
      this.thief = null;
      // The thief comes to most pages, never the first ones, and always the first time it can.
      const verses = m.verses.length;
      const comes = this.o.level.number >= 2 && !this.o.tutorial && verses >= 3 && (getProgress().thief === 0 || Math.random() < 0.6);
      this.thiefAt = comes ? 2 + Math.floor(Math.random() * (verses - 2)) : 0;

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
      if (this.mode === "explore") this.path = [];
      return;
    }
    if (e.key === " " || e.key === "Enter" || e.key === "z" || e.key === "Z" || e.key === "e" || e.key === "E") {
      e.preventDefault();
      if (!e.repeat) this.pressA();
    }
    if ((e.key === "h" || e.key === "H") && this.mode === "battle") {
      e.preventDefault();
      this.flee();
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
    // What was earned and a new rank wait for the battle to end: there the HUD is hidden.
    if (this.mode !== "battle" && this.mode !== "reveal" && this.mode !== "found") {
      if (this.gainTimer > 0) {
        this.gainTimer -= dt;
        if (this.gainTimer <= 0) {
          this.gainSum = 0;
          this.emit();
        }
      }
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) {
          this.banner = null;
          this.emit();
        }
      }
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toast = null;
        this.emit();
      }
    }
    this.updateWeather(dt);
    if (this.trail) {
      this.trail.age += dt;
      if (this.trail.age > 7) this.trail = null;
    }
    if (this.mode !== "battle" && this.mode !== "reveal") {
      this.updateSeen();
    }

    switch (this.mode) {
      case "intro":
        this.titleCardTimer -= dt;
        if (this.titleCardTimer <= 0) this.say(this.introLines(), () => this.setMode("explore"));
        break;
      case "explore":
        this.updatePlayer(dt);
        this.updateThings(dt);
        this.updateThief(dt);
        // Catching the thief opens a dialogue: the shadows wait for it.
        if (this.mode === "explore") this.updateShadows(dt);
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

  // ----- Voice, rank and keepsakes ---------------------------------------------

  /** Reads what the Voice carries and the rank of its voice: both can change in the middle of a page. */
  private refreshLoadout() {
    const l = loadout(getProgress(), this.o.catalog);
    this.gifts = l.gifts;
    this.maxLight = l.maxLight;
    this.rankIndex = l.rank.index;
    this.halo = l.rank.halo;
    this.carriedUI = l.carried.map((k) => ({ id: k.id, name: k.name, image: k.image }));
    this.carried = new Set([...this.picked, ...l.carried.map((k) => k.id)]);
    if (this.light > this.maxLight) this.light = this.maxLight;
  }

  private stepTime() {
    return this.gifts.has("paso") ? 0.155 : STEP_TIME;
  }

  /** Adds to the voice, for good: it is saved at once, so leaving a page loses nothing. */
  private earn(what: keyof Tally, amount: number) {
    const total = Math.round(amount * (this.gifts.has("gloria") ? 1.25 : 1));
    if (total <= 0) return 0;
    const before = rankOf(getProgress().voice);
    this.tally[what] += total;
    this.gainSum += total;
    this.gainTimer = 2.2;
    this.gainId++;
    updateProgress((p) => ({ ...p, voice: p.voice + total }));
    const after = rankOf(getProgress().voice);
    if (after.index > before.index) {
      this.grewTo = after.name;
      this.banner = { title: `Tu voz creció: ${after.name}`, text: after.brings };
      this.bannerTimer = 5;
      // The new flame comes lit.
      if (after.light > before.light && this.light > 0) this.light = Math.min(this.maxLight, this.light + 1);
      this.o.audio.portal();
      this.flash = Math.max(this.flash, this.o.reducedMotion ? 0.15 : 0.35);
    }
    this.emit();
    return total;
  }

  /** A keepsake goes to the chest, and the game stops to show it. */
  private findKeepsake(k: Keepsake, then?: () => void) {
    const carried = keep(k.id);
    const voice = this.earn("keepsake", VOICE.keepsake);
    const chest = getProgress().keepsakes.length;
    this.found = { image: k.image, name: k.name, line: k.line, gift: GIFTS[k.gift], carried, voice, count: chest, total: this.o.catalog.length };
    this.foundAt = this.time;
    this.afterFound = then ?? null;
    this.mode = "found";
    this.held = [];
    this.path = [];
    this.o.audio.reveal();
    this.emit();
  }

  private closeFound() {
    // A key still held from the dialogue must not put it away unseen.
    if (this.time - this.foundAt < 0.8) return;
    const then = this.afterFound;
    this.found = null;
    this.afterFound = null;
    this.mode = "explore";
    this.held = [];
    this.o.audio.ui();
    this.emit();
    then?.();
  }

  // ----- The verse thief -------------------------------------------------------

  /** A small shadow takes the verse just rescued and lands a few steps away, ready to run. */
  private startThief(v: Verse) {
    const p = this.player;
    const d = distances(this.map.cells, p);
    let spot: Point | null = null;
    for (let y = p.y - 3; y <= p.y + 3; y++) {
      for (let x = p.x - 3; x <= p.x + 3; x++) {
        if (!inside(x, y) || this.blocksPlayer({ x, y })) continue;
        const steps = d[at(x, y)];
        if (steps < 2 || steps > 3) continue;
        if (!spot || steps > d[at(spot.x, spot.y)]) spot = { x, y };
      }
    }
    this.thiefAt = 0;
    // Nowhere to run: it doesn't come.
    if (!spot) return;
    this.collected.delete(v.index);
    this.o.audio.setVoices(1 + this.collected.size);
    this.thief = { x: spot.x, y: spot.y, fromX: spot.x, fromY: spot.y, t: 1, moving: false, duration: 0.3, dir: "up", verse: v.index, timer: 0.5, stunned: 0, age: 0, phase: this.rng() * 6 };
    this.path = [];
    this.o.audio.miss();
    this.o.audio.whisper(0, 0.09);
    if (!this.o.reducedMotion) this.shake = 0.5;
    this.say([
      { speaker: "narrator", text: "Una sombra chiquita te arranca el verso de las manos y sale corriendo." },
      { speaker: "voice", text: "¡Mi verso! Si le canto de cerca, se queda quieta. Tengo que alcanzarla." },
    ]);
  }

  private updateThief(dt: number) {
    const th = this.thief;
    if (!th) return;
    th.age += dt;
    if (th.moving) {
      th.t += dt / th.duration;
      if (th.t >= 1) {
        th.t = 1;
        th.moving = false;
      }
    }
    const p = this.player;
    const pp = this.playerPos();
    if (Math.hypot(lerp(th.fromX, th.x, th.t) - pp.x, lerp(th.fromY, th.y, th.t) - pp.y) < 0.75) {
      this.catchThief();
      return;
    }
    if (th.stunned > 0) {
      th.stunned -= dt;
      return;
    }
    if (th.moving) return;
    th.timer -= dt;
    if (th.timer > 0) return;
    const d = distances(this.map.cells, p);
    const here = d[at(th.x, th.y)];
    const sprint = th.age < THIEF_SPRINT;
    // Far from the Voice it waits, so the chase never leaves the page.
    if (here < 0 || (!sprint && here > 7)) {
      th.timer = 0.3;
      return;
    }
    // It runs for the place farthest from the Voice that it can still reach first: that takes it out of dead ends.
    const mine = distances(this.map.cells, th);
    let goal: Point | null = null;
    let far = here;
    for (let c = 0; c < d.length; c++) {
      if (mine[c] < 0 || d[c] < 0 || mine[c] >= d[c] || d[c] <= far) continue;
      const q = { x: c % COLS, y: (c / COLS) | 0 };
      if (this.blocksPlayer(q)) continue;
      goal = q;
      far = d[c];
    }
    const next = goal ? findPath(this.map.cells, th, goal, (x, y) => this.blocksPlayer({ x, y }) || (x === p.x && y === p.y))?.[0] : null;
    // It bolts at first, faster than the Voice, and then tires little by little.
    if (next) this.moveActor(th, next, sprint ? 0.14 : lerp(0.225, 0.38, clamp((th.age - 8) / 10)));
    else th.timer = 0.3;
  }

  private catchThief() {
    const th = this.thief!;
    this.thief = null;
    this.collected.add(th.verse);
    this.path = [];
    this.o.audio.verse();
    this.o.audio.setVoices(1 + this.collected.size);
    const first = !getProgress().keepsakes.includes(FEATHER.id);
    updateProgress((p) => ({ ...p, thief: p.thief + 1 }));
    this.earn("thief", VOICE.thief);
    const after = () => {
      if (this.collected.size === this.map.verses.length) this.openPortal();
    };
    this.say([{ speaker: "narrator", text: "La alcanzás. Suelta el verso y se deshace en humo." }], () => {
      if (first) this.findKeepsake(FEATHER, after);
      else after();
    });
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
    mark(pos.x, pos.y, 1.6 + this.light * 0.55 + (this.gifts.has("mirada") ? 1.6 : 0));
    for (const lamp of this.visitedLamps) mark(lamp.x, lamp.y, 3);
  }

  private isAngel(p: Point) {
    return p.x === this.map.angel.x && p.y === this.map.angel.y;
  }

  private lampAt(p: Point) {
    return this.map.lamps.find((l) => l.x === p.x && l.y === p.y);
  }

  private blocksPlayer(p: Point) {
    if (!inside(p.x, p.y) || !walkable(this.map.cells[at(p.x, p.y)])) return true;
    // People of the painting who walk are echoes: the Voice and the shadows pass through them, so they never close the way.
    return this.isAngel(p) || Boolean(this.lampAt(p));
  }

  /** The tiles a thing covers now. */
  private thingTiles(th: Thing) {
    return th.prop.route.length > 1 ? [{ x: th.x, y: th.y }] : footprint(th.x, th.y, th.prop.width);
  }

  /** Where a thing is drawn, in world pixels: the middle of its base, its height and width, and its image. */
  private thingBox(th: Thing) {
    const w = th.prop.width;
    const left = th.x - Math.floor((w - 1) / 2);
    const img = th.el.imagen ? this.sceneArt.get(th.el.imagen) : undefined;
    const cx = (left + w / 2 + lerp(th.fromX, th.x, th.t) - th.x) * TILE;
    const base = lerp(th.fromY, th.y, th.t) * TILE + 15;
    let h = (th.el.alto ?? 1.8) * TILE;
    let width = img ? (h * img.naturalWidth) / img.naturalHeight : w * TILE * 0.7;
    // Wide things fill their tiles, unless that would make them taller than they are.
    if (img && w > 1) {
      width = w * TILE * 1.08;
      h = (width * img.naturalHeight) / img.naturalWidth;
      const tallest = (th.el.alto ?? 1.8) * TILE * 1.25;
      if (h > tallest) {
        width *= tallest / h;
        h = tallest;
      }
    }
    return { cx, base, h, width, img };
  }

  /** What of the painting is drawn under a point of the world, to talk to it by touching it. */
  private thingOnScreen(wx: number, wy: number) {
    let best: Thing | null = null;
    for (const th of this.things) {
      if (th.prop.copy || th.picked || !th.el.dice.length || th.fade < 0.3) continue;
      const b = this.thingBox(th);
      if (Math.abs(wx - b.cx) > b.width / 2 || wy > b.base + 2 || wy < b.base - b.h) continue;
      if (!best || th.y > best.y) best = th;
    }
    return best;
  }

  private stepThing(th: Thing, step: number, duration: number) {
    const to = th.prop.route[step];
    th.dir = to.x > th.x ? "right" : to.x < th.x ? "left" : to.y > th.y ? "down" : "up";
    th.fromX = th.x;
    th.fromY = th.y;
    th.x = to.x;
    th.y = to.y;
    th.step = step;
    th.t = 0;
    th.moving = true;
    th.duration = duration;
  }

  /** People of the painting who walk: away from the Voice, or toward each other as verses come back. */
  private updateThings(dt: number) {
    const p = this.player;
    const total = Math.max(1, this.map.verses.length);
    for (const th of this.things) {
      const route = th.prop.route;
      if (th.el.mueve === "aplaude" && !th.prop.copy && cheb(th, p) <= 6) {
        this.clapTimer -= dt;
        if (this.clapTimer <= 0) {
          this.clapTimer = 0.05 + this.rng() * 0.12;
          this.o.audio.clap(clamp((th.x - p.x) / 6, -1, 1), 0.05 * (1 - cheb(th, p) / 7));
        }
      }
      if (route.length < 2) continue;
      if (th.moving) {
        th.t += dt / th.duration;
        if (th.t >= 1) {
          th.t = 1;
          th.moving = false;
        }
        continue;
      }
      if (th.el.mueve === "seAcerca") {
        const goal = Math.round((this.collected.size / total) * (route.length - 1));
        const next = route[th.step + 1];
        if (th.step < goal && next && !(next.x === p.x && next.y === p.y)) this.stepThing(th, th.step + 1, 0.8);
        continue;
      }
      // Walks away; at the end it fades into the dark and starts over.
      const last = th.step >= route.length - 1;
      if (last) {
        th.fade -= dt * 0.7;
        if (th.fade <= 0) {
          const home = route[0];
          th.fade = 0;
          if (cheb(home, p) <= 1) continue;
          th.step = 0;
          th.x = th.fromX = home.x;
          th.y = th.fromY = home.y;
        }
        continue;
      }
      th.fade = Math.min(1, th.fade + dt * 0.7);
      if (th.fade < 0.5 || manhattan(th, p) <= 1) continue;
      const next = route[th.step + 1];
      if (next.x === p.x && next.y === p.y) continue;
      this.stepThing(th, th.step + 1, th.el.mueve === "corre" ? 0.26 : 0.75);
    }
  }

  /** Talks to someone of the painting, or looks at something. People then point the way to a missing verse. */
  private examine(th: Thing) {
    const el = th.el;
    // What can be picked up is picked up: the Voice steps on it.
    if (el.levantar && !th.picked) {
      this.path = [{ x: th.x, y: th.y }];
      return;
    }
    const lines = el.conObjeto && this.carried.has(el.conObjeto.imagen) ? el.conObjeto.dice : el.dice;
    const portrait = el.persona && el.imagen && this.sceneArt.has(el.imagen) ? `/juego/escenas/${el.imagen}.webp` : undefined;
    this.path = [];
    this.say(
      lines.map((text): Line => (el.persona ? { speaker: "figure", name: el.nombre, text, portrait } : { speaker: "narrator", text })),
      () => {
        if (el.persona && this.pointTheWay(th)) this.showToast("Te señala por dónde seguir.");
      },
    );
  }

  /** Light motes from someone, or from the Voice itself, to the nearest verse still missing. */
  private pointTheWay(from: Point | null) {
    const p = this.player;
    const d = distances(this.map.cells, p);
    let best: Verse | null = null;
    for (const v of this.map.verses) {
      if (this.collected.has(v.index) || d[at(v.x, v.y)] < 0) continue;
      if (!best || d[at(v.x, v.y)] < d[at(best.x, best.y)]) best = v;
    }
    if (!best) return false;
    const route = findPath(this.map.cells, p, best);
    if (!route?.length) return false;
    this.trail = { points: [...(from ? [{ x: from.x, y: from.y }] : []), { x: p.x, y: p.y }, ...route], age: 0 };
    return true;
  }

  /** The motes of the trail, flowing toward the verse. Drawn over the dark, like the eyes of the shadows. */
  private drawTrail(ctx: CanvasRenderingContext2D) {
    const tr = this.trail;
    if (!tr) return;
    const pts = tr.points.map((q) => ({ x: q.x * TILE + 8, y: q.y * TILE + 9 }));
    const lengths = [0];
    for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = lengths[lengths.length - 1];
    if (total <= 0) return;
    const fade = Math.min(1, tr.age * 2) * clamp((7 - tr.age) / 2, 0, 1);
    const count = Math.min(48, Math.ceil(total / 9));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < count; k++) {
      const along = (tr.age * 60 + (k / count) * total) % total;
      // Motes only travel as far as the wave has reached.
      if (along > tr.age * 120) continue;
      let i = 1;
      while (i < lengths.length - 1 && lengths[i] < along) i++;
      const f = (along - lengths[i - 1]) / Math.max(0.001, lengths[i] - lengths[i - 1]);
      const x = lerp(pts[i - 1].x, pts[i].x, f) + Math.sin(along * 0.2 + k) * 1.5;
      const y = lerp(pts[i - 1].y, pts[i].y, f) + Math.cos(along * 0.17 + k) * 1.5 - 3;
      const a = fade * (0.55 + 0.45 * Math.sin(this.time * 4 + k));
      const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, `rgba(255,236,190,${0.6 * a})`);
      g.addColorStop(1, "rgba(255,236,190,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = `rgba(255,250,235,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** What shines through the dark: the verse the thief carries, and every missing verse for who carries the feather. */
  private drawGlints(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
    const glint = (x: number, y: number, size: number, k: number) => {
      const pulse = 0.55 + 0.45 * Math.sin(t * 3 + k);
      drawStar(ctx, x, y, size * (0.8 + pulse * 0.4), `rgba(255,246,216,${alpha * (0.5 + pulse * 0.5)})`, "rgba(255,226,160,0.95)", 8 * this.dpr);
    };
    const th = this.thief;
    if (th) {
      const tx = lerp(th.fromX, th.x, th.t) * TILE + 8;
      const ty = lerp(th.fromY, th.y, th.t) * TILE + 13;
      glint(tx + 3, ty - 12, 5, th.phase);
      // Its eyes, smaller than those of the shadows that roam.
      ctx.fillStyle = `rgba(255,70,72,${0.95 * alpha * (th.stunned > 0 ? 0.4 : 1)})`;
      for (const [ex, ey] of SMOKE_EYES) {
        ctx.beginPath();
        ctx.ellipse(tx + ex * 0.6, ty + ey * 0.6, 0.7, 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!this.gifts.has("destello")) return;
    for (const v of this.map.verses) {
      if (!this.collected.has(v.index) && v.index !== th?.verse) glint(v.x * TILE + 8, v.y * TILE + 3, 4, v.index * 1.7);
    }
  }

  /** What can be examined on that tile: someone to talk to, or something to look at. */
  private thingAt(p: Point) {
    return this.things.find((th) => {
      if (th.prop.copy || th.picked || !th.el.dice.length || th.fade < 0.3) return false;
      if (th.prop.route.length > 1) return th.x === p.x && th.y === p.y;
      return footprint(th.x, th.y, th.prop.width).some((q) => q.x === p.x && q.y === p.y);
    });
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
      } else if (this.pendingTalk) {
        const th = this.pendingTalk;
        this.pendingTalk = null;
        const near = this.thingTiles(th).find((q) => manhattan(q, p) === 1);
        if (near) {
          p.dir = (Object.keys(DELTA) as Dir[]).find((k) => p.x + DELTA[k].x === near.x && p.y + DELTA[k].y === near.y) ?? p.dir;
          this.examine(th);
        }
      }
    }
    this.walkBlend += ((p.moving ? 1 : 0) - this.walkBlend) * Math.min(1, dt * 10);
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
    p.duration = this.stepTime();
    this.o.audio.step(this.map.cells[at(target.x, target.y)] === GLOOM);
    return true;
  }

  private arrive() {
    const p = this.player;
    const m = this.map;
    const found = this.things.find((th) => th.el.levantar && !th.picked && th.x === p.x && th.y === p.y);
    if (found) {
      found.picked = true;
      const image = found.el.imagen;
      if (image) {
        this.picked.add(image);
        this.carried.add(image);
      }
      this.path = [];
      const keepsake = found.el.recuerdo ? this.o.catalog.find((k) => k.id === image) : undefined;
      if (keepsake) {
        this.findKeepsake(keepsake);
        return;
      }
      this.o.audio.verse();
      this.say(found.el.dice.map((text) => ({ speaker: "narrator" as const, text })));
      return;
    }
    const pull = this.gifts.has("iman") ? 1 : 0;
    const verse = m.verses.find((v) => cheb(v, p) <= pull && !this.collected.has(v.index));
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
      // No ambush while the thief runs: the chase is trouble enough.
      if (!this.thief && this.rng() < (0.08 + this.difficulty * 0.004) * (this.gifts.has("suerte") ? 0.5 : 1)) {
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
    const healed = this.light < this.maxLight;
    this.light = this.maxLight;
    if (healed || firstTime || spoken) this.o.audio.lamp();
    if (spoken) this.say([{ speaker: "narrator", text: "Te quedás un momento junto al farol. Tu luz vuelve, y si se apaga, vas a volver acá." }]);
    else if (firstTime) this.showToast("Un farol. Si tu luz se apaga, volvés acá.");
    else if (healed) this.showToast("Tu luz vuelve.");
    this.emit();
  }

  private collect(v: Verse) {
    this.collected.add(v.index);
    this.path = [];
    const total = this.map.verses.length;
    this.o.audio.verse();
    this.o.audio.setVoices(1 + this.collected.size);
    if (this.gifts.has("brindis") && this.light < this.maxLight) this.light++;
    this.earn("verses", VOICE.verse);
    this.say(
      [{ speaker: "verse", name: `Verso ${this.collected.size} de ${total}`, text: v.lines.join("\n") }],
      () => {
        if (this.collected.size === total) this.openPortal();
        else if (this.thiefAt && this.collected.size >= this.thiefAt && !this.thief) this.startThief(v);
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
    const thing = this.thingAt(f);
    if (this.isAngel(f)) this.talkToAngel();
    else if (lamp) this.restAt(lamp, true);
    else if (thing) this.examine(thing);
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
    // The angel knows when the page still hides its keepsake.
    if (this.things.some((th) => th.el.recuerdo && !th.picked))
      lines.push({ speaker: "angel", text: "Y esta página guarda algo más: brilla en el piso, y no es un verso." });
    this.say(lines);
  }

  private sing() {
    if (this.singCooldown > 0) return;
    this.singCooldown = 1.3;
    this.singPulse = 1;
    this.o.audio.hum(pick(this.rng, [0, 2, 4, 7]));
    const p = this.player;
    const reach = this.gifts.has("mando") ? 6 : 3;
    const stun = this.gifts.has("mando") ? 4.4 : 2.2;
    if (this.gifts.has("hilo")) this.pointTheWay(null);
    // The thief only hears a song sung close, once its first dash is over.
    if (this.thief && this.thief.age >= THIEF_SPRINT && manhattan(this.thief, p) <= reach) this.thief.stunned = Math.max(this.thief.stunned, stun * 0.7);
    for (const s of this.shadows) {
      if (!s.alive || manhattan(s, p) > reach) continue;
      s.stunned = stun;
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
      if (this.things.some((th) => th.el.persona))
        lines.push({ speaker: "narrator", text: "En cada página vive alguien de su pintura. Si le hablás, te muestra por dónde seguir." });
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
          const sight = 5 + Math.min(3, this.difficulty * 0.25) - (this.gifts.has("sigilo") ? 2.5 : 0);
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

  private startBattle(shadow: Shadow | null, guardian: boolean, forced?: string) {
    const name = guardian ? `La sombra de ${this.o.level.name}` : (shadow?.name ?? forced ?? pick(this.rng, ["Duda", "Miedo", "Olvido", "Ruido", "Vacío"]));
    const styles = guardian ? this.guardianStyles() : [{ style: styleOf(name), name }];
    const lesson = !guardian && !getProgress().rehearsed;
    // The rehearsal leaves a little darkness for one real phrase after the practice.
    const hp = guardian ? 10 + Math.floor(this.difficulty / 3) - (this.gifts.has("sello") ? 3 : 0) : lesson ? 7 : 4 + Math.floor(this.difficulty / 5);
    const pace = timing(this.difficulty, guardian);
    if (this.gifts.has("pausa")) {
      pace.good *= 1.35;
      pace.perfect *= 1.35;
    }
    if (this.gifts.has("despacio")) pace.beat *= 1.2;
    const origin = shadow ? { x: lerp(shadow.fromX, shadow.x, shadow.t), y: lerp(shadow.fromY, shadow.y, shadow.t) } : this.playerPos();
    const count = guardian ? 120 : 80;
    this.battle = {
      guardian,
      name,
      styles,
      style: styles[0].style,
      hp,
      maxHp: hp,
      phase: "intro",
      text: "",
      hint: "",
      verse: false,
      shadow,
      clock: 0,
      intro: 0,
      timing: pace,
      nextBeat: 0,
      beats: 0,
      pulse: 0,
      notes: [],
      phrases: 0,
      misses: 0,
      restUntil: 0,
      endAt: 0,
      lesson: lesson ? 1 : 0,
      // Said to its face: the Voice speaks first, and the hit lands as the shadow starts to whisper.
      bolts: this.gifts.has("frente") && !lesson ? [{ t: -0.5, amount: 1, big: false }] : [],
      flare: 0,
      wound: 0,
      shielded: false,
      losing: 0,
      hurt: 0,
      dying: 0,
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

  /** The guardian opens plainly, then sings like each kind of shadow of its page, one phrase each. */
  private guardianStyles() {
    const kinds = new Map<Style, string>();
    for (const s of this.shadows) {
      const style = styleOf(s.name);
      if (style !== "steady" && !kinds.has(style)) kinds.set(style, s.name);
    }
    return [{ style: "steady" as Style, name: "" }, ...[...kinds].slice(0, 3).map(([style, name]) => ({ style, name }))];
  }

  /** What to tell the player before the next phrase, if anything. */
  private phraseHint() {
    const b = this.battle!;
    if (b.lesson === 1) return this.o.touch ? "Cuando la nota toque tu luz, tocá la pantalla." : "Cuando la nota toque tu luz, apretá Espacio.";
    if (b.lesson === 2) return "Ahora vienen tres seguidas. Respondé cada una cuando llegue.";
    const entry = b.styles[b.phrases % b.styles.length];
    if (b.guardian) {
      if (entry.name) return `Ahora canta como ${entry.name}.`;
      return b.phrases === 0 && b.styles.length > 1 ? "Canta con la voz de las sombras de esta página." : "";
    }
    if (entry.style === "steady" || getProgress().heard.includes(entry.style)) return "";
    updateProgress((p) => ({ ...p, heard: [...p.heard, entry.style] }));
    return tell(entry.style, b.name);
  }

  private whisper() {
    const b = this.battle!;
    const line = b.guardian ? pick(this.rng, wholeLines(this.o.level.stanzas)) : doubt(this.rng, b.style);
    this.o.audio.whisper(0, 0.05);
    return `${b.name}: «${line}»`;
  }

  /** A pause between phrases: the shadow speaks, the pulse goes on. */
  private rest(text: string, hint: string, length = 0, verse = false) {
    const b = this.battle!;
    b.phase = "rest";
    b.text = text;
    b.hint = hint;
    b.verse = verse;
    b.restUntil = b.clock + (length || clamp(1.2 + text.length * 0.03, 2, 3.4));
    this.emit();
  }

  private startPhrase() {
    const b = this.battle!;
    const entry = b.styles[b.phrases % b.styles.length];
    const style: Style = b.lesson ? "steady" : entry.style;
    const usual = b.guardian ? 6 : this.difficulty >= 8 ? 5 : 4;
    const count = b.lesson === 1 ? 1 : b.lesson === 2 ? 3 : usual - (this.gifts.has("compas") ? 1 : 0);
    const beat = b.timing.beat;
    // The first note reaches the light on a beat, and leaves the shadow after now.
    let first = b.nextBeat;
    while (first - travelBeats(style) * beat < b.clock + 0.05) first += beat;
    b.style = style;
    b.notes = phrase(style, count, first, beat, this.rng).map((n) => ({ ...n, style, result: null, doneAt: 0, called: false, hold: b.lesson === 1 }));
    b.misses = 0;
    b.phase = "call";
    b.verse = false;
    this.emit();
  }

  private battleA() {
    const b = this.battle;
    if (!b) return;
    if (b.phase === "rest") {
      // Tapping through the words brings the next phrase sooner.
      b.restUntil = Math.min(b.restUntil, b.clock + 0.3);
      return;
    }
    if (b.phase !== "call" || b.losing > 0) return;
    // The press happened between frames: count it from the last one.
    const now = b.clock + clamp((performance.now() - this.last) / 1000, 0, 0.05);
    const n = b.notes.find((note) => !note.result);
    if (!n) return;
    const { good, perfect, early } = b.timing;
    const delta = now - n.at;
    if (n.hold) {
      if (delta >= -good) this.answer(n, "perfect");
      return;
    }
    if (delta < -(good + early)) return;
    if (delta < -good) this.missNote(n, "early");
    else this.answer(n, Math.abs(delta) <= perfect ? "perfect" : "good");
  }

  private popup(text: string, color: string, big: boolean, low = false) {
    const b = this.battle!;
    // A new grade replaces the last one, so they never pile up.
    if (!low) b.popups = b.popups.filter((pop) => pop.low);
    b.popups.push({ text, t: 0, color, big, low });
  }

  private answer(n: BattleNote, result: "perfect" | "good") {
    const b = this.battle!;
    n.result = result;
    n.doneAt = b.clock;
    this.o.audio.hum(n.degree, result);
    b.bolts.push({ t: 0, amount: result === "perfect" && this.gifts.has("reflejo") ? 2 : 1, big: false });
    if (!b.lesson) this.earn("notes", result === "perfect" ? VOICE.perfect : VOICE.good);
    this.popup(result === "perfect" ? "¡Justo!" : "Bien", result === "perfect" ? "#fff1c2" : "#f7f7f5", result === "perfect");
  }

  private missNote(n: BattleNote, result: "early" | "late") {
    const b = this.battle!;
    n.result = result;
    n.doneAt = b.clock;
    this.o.audio.miss();
    this.popup(result === "early" ? "Temprano" : "Tarde", "#b4b8c4", false);
    if (b.lesson) return;
    b.misses++;
    // The first miss of a phrase dims the light, and then every third one (every second against a guardian).
    if (b.misses % (b.guardian ? 2 : 3) !== 1) return;
    if (this.gifts.has("aguante") && !b.shielded) {
      b.shielded = true;
      this.o.audio.block();
      this.popup("Aguantás el golpe", "#fff1c2", false, true);
      return;
    }
    this.light = Math.max(0, this.light - 1);
    b.wound = 1;
    this.o.audio.hit();
    if (!this.o.reducedMotion) this.shake = 0.7;
    this.popup("−1 de luz", "#ff5a5f", false, true);
    // A thorn: the shadow that hurts the Voice gets hurt.
    if (this.gifts.has("espina")) b.bolts.push({ t: 0, amount: 1, big: false });
    if (this.light <= 0) {
      if (this.gifts.has("despertar") && !this.woke) {
        this.woke = true;
        this.light = 1;
        this.o.audio.lamp();
        this.popup("Tu luz se vuelve a encender", "#fff1c2", false, true);
      } else b.losing = 0.9;
    }
    this.emit();
  }

  private endPhrase() {
    const b = this.battle!;
    b.phrases++;
    if (b.lesson === 1) {
      b.lesson = 2;
      this.rest("¡Eso! Tu canto le devolvió la luz.", this.phraseHint(), 2.6);
      return;
    }
    const whole = b.notes.every((n) => n.result === "perfect" || n.result === "good");
    if (b.lesson === 2) {
      b.lesson = 0;
      updateProgress((p) => ({ ...p, rehearsed: true }));
    }
    const hint = this.phraseHint();
    if (!whole) {
      this.rest(this.whisper(), hint);
      return;
    }
    // A whole phrase answered: the Voice remembers a verse of the page, and it hits harder.
    b.flare = 1;
    if (this.light < this.maxLight) {
      this.light++;
      this.popup("+1 de luz", "#fff1c2", false, true);
    }
    const lines = this.map.verses.filter((v) => this.collected.has(v.index)).flatMap((v) => v.lines);
    if (lines.length) {
      this.o.audio.recall();
      b.bolts.push({ t: -0.3, amount: 2, big: true });
      this.rest(`Recordás: «${pick(this.rng, lines)}»`, hint, 3.2, true);
    } else {
      this.o.audio.lamp();
      b.bolts.push({ t: -0.3, amount: 1, big: true });
      this.rest("¡Frase entera! Tu voz se afina.", hint);
    }
  }

  /** Runs away from a shadow that roams the page; a guardian can't be fled. */
  flee() {
    const b = this.battle;
    if (!b || b.guardian || this.paused || this.mode !== "battle" || (b.phase !== "rest" && b.phase !== "call") || b.losing > 0) return;
    this.o.audio.ui();
    this.closeBattle("fled");
    this.showToast("Te escapaste. La sombra quedó aturdida.");
  }

  private win() {
    const b = this.battle!;
    b.phase = "end";
    b.dying = 0.001;
    b.endAt = b.clock;
    b.bolts = [];
    this.o.audio.victory();
    if (b.lesson) {
      b.lesson = 0;
      updateProgress((p) => ({ ...p, rehearsed: true }));
    }
    const grew = !b.guardian && this.light < this.maxLight;
    if (grew) this.light++;
    this.earn("shadows", b.guardian ? VOICE.guardian : VOICE.shadow);
    b.text = b.guardian ? "La sombra se rompe en mil pedazos de luz." : `${b.name} se deshace en luz.${grew ? " Tu luz crece." : ""}`;
    b.hint = "";
    b.verse = false;
    this.emit();
  }

  private lose() {
    this.wentOut = true;
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
    b.pulse = Math.max(0, b.pulse - dt * 3);
    b.flare = Math.max(0, b.flare - dt * 0.7);
    b.wound = Math.max(0, b.wound - dt * 2);
    for (const pop of b.popups) pop.t += dt;
    b.popups = b.popups.filter((pop) => pop.t < (pop.low ? 1.4 : 0.9));
    if (b.phase === "intro") {
      b.intro = Math.min(1, b.intro + dt / (this.o.reducedMotion ? 0.4 : 0.9));
      if (b.intro >= 1 && b.clock > (this.o.reducedMotion ? 0.6 : 1.3)) {
        b.nextBeat = b.clock + 0.1;
        this.rest(this.whisper(), this.phraseHint());
      }
      return;
    }
    if (b.phase === "end") {
      b.dying = Math.min(1, b.dying + dt / 1.6);
      if (b.clock - b.endAt > 2.4) this.closeBattle("won");
      return;
    }
    // One pulse for the music, the light and the notes; a silent shadow mutes it while it sings.
    while (b.clock >= b.nextBeat) {
      if (!(b.phase === "call" && b.style === "rests")) this.o.audio.pulse(b.beats % 4 === 0);
      b.pulse = 1;
      b.beats++;
      b.nextBeat += b.timing.beat;
    }
    for (const bolt of b.bolts) {
      bolt.t += dt;
      if (bolt.t >= BOLT_TIME) {
        b.hp = Math.max(0, b.hp - bolt.amount);
        b.hurt = 1;
        this.emit();
      }
    }
    b.bolts = b.bolts.filter((bolt) => bolt.t < BOLT_TIME);
    if (b.hp <= 0) {
      this.win();
      return;
    }
    if (b.losing > 0) {
      b.losing -= dt;
      if (b.losing <= 0) this.lose();
      return;
    }
    if (b.phase === "rest") {
      if (b.clock >= b.restUntil) this.startPhrase();
      return;
    }
    for (const n of b.notes) {
      if (!n.called && b.clock >= n.at - n.travel) {
        n.called = true;
        this.o.audio.shadowNote(n.degree);
      }
      if (!n.result && !n.hold && b.clock > n.at + b.timing.good) this.missNote(n, "late");
    }
    if (b.losing > 0) return;
    if (b.notes.every((n) => n.result) && !b.bolts.length && b.clock > Math.max(...b.notes.map((n) => n.doneAt)) + 0.35) this.endPhrase();
  }

  // ----- Blackout ------------------------------------------------------------

  private respawn() {
    const p = this.player;
    p.x = p.fromX = this.checkpoint.x;
    p.y = p.fromY = this.checkpoint.y;
    p.t = 1;
    p.moving = false;
    this.light = this.maxLight;
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
    const id = this.o.level.id;
    this.earn("page", getProgress().done.includes(id) ? VOICE.replay : VOICE.page);
    if (!this.wentOut) {
      this.earn("clean", VOICE.clean);
      updateProgress((p) => (p.clean.includes(id) ? p : { ...p, clean: [...p.clean, id] }));
    }
    this.gainSum = 0;
    this.banner = null;
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
    // Upright, the touch controls take a strip along the bottom; on its side they sit in the corners, clear of the Voice.
    this.bottomInset = this.o.touch && rect.height >= rect.width ? Math.min(170, rect.height * 0.22) * this.dpr : 0;
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

    // The visible part of the world, in world pixels and in tiles.
    const vx0 = Math.max(0, -ox / s);
    const vy0 = Math.max(0, -oy / s);
    const vx1 = Math.min(WORLD_W, (this.cw - ox) / s);
    const vy1 = Math.min(WORLD_H, (this.ch - oy) / s);
    const x0 = Math.max(0, Math.floor(vx0 / TILE) - 1);
    const y0 = Math.max(0, Math.floor(vy0 / TILE) - 1);
    const x1 = Math.min(COLS - 1, Math.ceil(vx1 / TILE) + 1);
    const y1 = Math.min(ROWS - 1, Math.ceil(vy1 / TILE) + 1);

    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    this.blit(ctx, this.art.ground, vx0, vy0, vx1, vy1, 0);

    if (actorsAlpha > 0) {
      ctx.globalAlpha = actorsAlpha;
      this.drawWater(ctx, x0, y0, x1, y1, t);
      this.drawFog(ctx, vx0, vy0, vx1, vy1);
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
      drawStar(ctx, m.start.x * TILE + 8, m.start.y * TILE + 8, 12, "#98121a", "rgba(199,36,47,0.9)", 10 * this.dpr);
      this.drawPortal(ctx, t);
      this.drawSplashes(ctx);
      ctx.globalAlpha = 1;
    }

    if (wallsAlpha > 0) {
      ctx.globalAlpha = wallsAlpha;
      this.blit(ctx, this.art.walls, vx0, vy0, vx1, vy1, reveal < 0 ? 0 : (1 - wallsAlpha) * 6);
      ctx.globalAlpha = 1;
    }

    if (actorsAlpha > 0) {
      ctx.globalAlpha = actorsAlpha;
      this.drawActors(ctx, t, y0 - 2, y1 + 2, x0 - 2, x1 + 2);
      ctx.globalAlpha = 1;
    }

    if (paint > 0) {
      ctx.globalAlpha = paint;
      ctx.drawImage(this.painting, 0, 0, WORLD_W, WORLD_H);
      ctx.globalAlpha = 1;
    }

    this.renderLighting(ctx, s, ox, oy, reveal);

    // After the dark: the eyes of the shadows are always visible.
    if (actorsAlpha > 0) {
      ctx.setTransform(s, 0, 0, s, ox, oy);
      for (const sh of this.shadows) {
        if (!sh.alive) continue;
        const sx = lerp(sh.fromX, sh.x, sh.t) * TILE + 8;
        const sy = lerp(sh.fromY, sh.y, sh.t) * TILE + 13 + Math.cos(t * 1.7 + sh.phase) * 1.1;
        const blink = Math.sin(t * 0.9 + sh.phase * 3) > 0.96 ? 0.15 : 1;
        const a = actorsAlpha * (sh.stunned > 0 ? 0.45 : 1);
        for (const [ex, ey] of SMOKE_EYES) {
          const x = sx + ex + Math.sin(t * 2.1 + sh.phase) * 1.1;
          const y = sy + ey;
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(x, y, 0, x, y, 3.2);
          g.addColorStop(0, `rgba(255,40,50,${0.55 * a})`);
          g.addColorStop(1, "rgba(255,40,50,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 3.2, y - 3.2, 6.4, 6.4);
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = `rgba(255,70,72,${0.95 * a})`;
          ctx.beginPath();
          ctx.ellipse(x, y, 1, 0.55 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      this.drawTrail(ctx);
      this.drawGlints(ctx, t, actorsAlpha);
    }

    this.renderWeather(ctx, reveal);
  }

  /** Draws the visible part of a layer painted at ART resolution. */
  private blit(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, dy: number) {
    if (x1 <= x0 || y1 <= y0) return;
    const sx = Math.max(0, Math.floor(x0 * ART) - 2);
    const sy = Math.max(0, Math.floor((y0 - dy) * ART) - 2);
    const sw = Math.min(layer.width - sx, Math.ceil((x1 - x0) * ART) + 4);
    const sh = Math.min(layer.height - sy, Math.ceil((y1 - y0) * ART) + 4);
    if (sw <= 0 || sh <= 0) return;
    ctx.drawImage(layer, sx, sy, sw, sh, sx / ART, sy / ART + dy, sw / ART, sh / ART);
  }

  private drawWater(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number) {
    const m = this.map;
    ctx.lineCap = "round";
    ctx.lineWidth = 0.6;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (m.cells[at(x, y)] !== WATER) continue;
        const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
        for (let k = 0; k < 2; k++) {
          const phase = (t * (0.25 + (h % 7) * 0.03) + k * 0.5 + (h % 13) / 13) % 1;
          const px = x * TILE + 2 + ((h >> (k * 4)) % 9) + phase * 4;
          const py = y * TILE + 4 + k * 6 + ((h >> 8) % 3);
          ctx.strokeStyle = `rgba(170,200,235,${0.4 * Math.sin(phase * Math.PI)})`;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + 3 + k, py);
          ctx.stroke();
        }
      }
    }
    ctx.lineWidth = 0.45;
    for (const p of this.art.puddles) {
      for (let k = 0; k < 2; k++) {
        const phase = (t * 0.7 + p.seed / 1000 + k * 0.5) % 1;
        const r = 0.8 + phase * p.rx * 0.9;
        ctx.strokeStyle = `rgba(190,212,236,${0.5 * (1 - phase)})`;
        ctx.beginPath();
        ctx.ellipse(p.x + (k ? 2 : -1.5), p.y, r, (r * p.ry) / p.rx, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /** Fog drifting over the gloom: a soft texture cut to the shape of the gloom. */
  private drawFog(ctx: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    const fc = this.fogCanvas;
    if (!fc) return;
    const fx0 = Math.floor(vx0);
    const fy0 = Math.floor(vy0);
    const w = Math.ceil(vx1) - fx0;
    const h = Math.ceil(vy1) - fy0;
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
    f.globalAlpha = 1;
    f.clearRect(0, 0, w, h);
    f.fillStyle = this.fogPattern;
    const wrap = (v: number) => (((v % 128) + 128) % 128) - 128;
    for (const [speed, alpha, offset] of [
      [5, 1, 0],
      [-3.2, 0.7, 51],
    ]) {
      f.globalAlpha = alpha;
      f.setTransform(1, 0, 0, 1, wrap(this.time * speed + offset - fx0), wrap(this.time * speed * 0.35 + offset - fy0));
      f.fillRect(0, 0, w + 256, h + 256);
    }
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalAlpha = 1;
    f.globalCompositeOperation = "destination-in";
    f.imageSmoothingEnabled = true;
    f.drawImage(this.art.gloom, -fx0, -fy0, WORLD_W, WORLD_H);
    f.globalCompositeOperation = "source-over";
    ctx.drawImage(fc, 0, 0, w, h, fx0, fy0, w, h);
  }

  private drawSplashes(ctx: CanvasRenderingContext2D) {
    ctx.lineWidth = 0.4;
    for (const sp of this.splashes) {
      const k = sp.t / 0.3;
      ctx.strokeStyle = `rgba(205,222,240,${0.6 * (1 - k)})`;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, 0.6 + k * 2.6, 0.3 + k * 1.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawPortal(ctx: CanvasRenderingContext2D, t: number) {
    const p = this.map.portal;
    const x = p.x * TILE + 8;
    const y = p.y * TILE + 8;
    if (!this.portalOpen) {
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = `rgba(199,36,47,${0.4 + Math.sin(t * 2) * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 13 + Math.sin(t * 2) * 0.6, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawStar(ctx, x, y, 17, "#98121a", "rgba(199,36,47,0.95)", 14 * this.dpr);
      return;
    }
    const pulse = (Math.sin(t * 2.4) + 1) / 2;
    const beam = ctx.createLinearGradient(0, y - 100, 0, y + 6);
    beam.addColorStop(0, "rgba(255,241,194,0)");
    beam.addColorStop(1, `rgba(255,241,194,${0.32 + pulse * 0.12})`);
    ctx.fillStyle = beam;
    for (const half of [9, 5, 2.5]) ctx.fillRect(x - half, y - 100, half * 2, 106);
    for (let k = 0; k < 12; k++) {
      const q = (t * 0.45 + k / 12) % 1;
      ctx.fillStyle = `rgba(255,246,216,${1 - q})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(k * 2.1 + t) * 6, y - q * 80, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2) * 1.5);
    ctx.rotate(Math.sin(t * 0.8) * 0.15);
    drawStar(ctx, 0, 0, 18, "#fbe3a2", "rgba(255,230,160,1)", 20 * this.dpr);
    ctx.restore();
  }

  private drawActors(ctx: CanvasRenderingContext2D, t: number, top: number, bottom: number, left: number, right: number) {
    const onScreen = (p: Point) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
    const m = this.map;
    const P = this.paintedArt;
    const blob = groundShadow();
    const shadowAt = (x: number, y: number, rx: number, ry: number, a = 1) => {
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * a;
      ctx.drawImage(blob, x - rx, y - ry, rx * 2, ry * 2);
      ctx.globalAlpha = alpha;
    };
    const items: { y: number; draw: () => void }[] = [];
    for (const l of m.lamps) {
      if (!onScreen(l)) continue;
      const lit = this.visitedLamps.has(l);
      const x = l.x * TILE + 8;
      const y = l.y * TILE + 15;
      items.push({
        y: l.y,
        draw: () => {
          shadowAt(x + 1.5, y, 7, 2.6);
          const img = lit ? P?.lamp : P?.lampDark;
          if (img) stand(ctx, img, x, y + 0.5, LAMP_TALL);
          else ctx.drawImage(this.sprites.lamp(l.color, lit, 0), x - 5, y + 1 - LAMP_HEIGHT);
        },
      });
    }
    for (const v of m.verses) {
      if (this.collected.has(v.index) || v.index === this.thief?.verse || !onScreen(v)) continue;
      const bob = Math.sin(t * 2.2 + v.index) * 1.5;
      const x = v.x * TILE + 8;
      const y = v.y * TILE + 13;
      items.push({
        y: v.y,
        draw: () => {
          shadowAt(x, y + 1, 4, 1.4, 0.6);
          if (P?.feather) stand(ctx, P.feather, x, y - 2 + bob, 15, { tilt: Math.sin(t * 1.3 + v.index) * 0.12 });
          else ctx.drawImage(this.sprites.feather, x - 4, y - 14 + bob);
          for (let k = 0; k < 3; k++) {
            const q = (t * 0.8 + k / 3 + v.index * 0.37) % 1;
            ctx.fillStyle = `rgba(255,246,216,${Math.sin(q * Math.PI)})`;
            ctx.beginPath();
            ctx.arc(x + Math.sin(k * 2.7 + v.index) * 6, y - 3 - q * 14, 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      });
    }
    const a = m.angel;
    const hover = Math.sin(t * 1.3) * 1.5;
    items.push({
      y: a.y,
      draw: () => {
        const x = a.x * TILE + 8;
        const y = a.y * TILE + 15;
        shadowAt(x, y, 8, 2.6, 0.75 - hover * 0.05);
        if (P?.angel) stand(ctx, P.angel, x, y - 5 + hover, ANGEL_TALL, { squash: 1 + Math.sin(t * 1.3) * 0.01 });
        else ctx.drawImage(this.sprites.angel[0], x - 12, y - 31 + hover);
      },
    });
    for (const sh of this.shadows) {
      if (!sh.alive || !onScreen(sh)) continue;
      const ty = lerp(sh.fromY, sh.y, sh.t);
      const sx = lerp(sh.fromX, sh.x, sh.t) * TILE + 8;
      const sy = ty * TILE + 13;
      items.push({
        y: ty,
        draw: () => {
          shadowAt(sx, sy + 2, 7, 2.4, 0.9);
          const alpha = ctx.globalAlpha;
          ctx.globalAlpha = alpha * (sh.stunned > 0 ? 0.5 : 1);
          drawSmoke(ctx, sx, sy, t, sh.phase, sh.stunned > 0 ? 0.3 : 1);
          ctx.globalAlpha = alpha;
        },
      });
    }
    const thief = this.thief;
    if (thief) {
      const ty = lerp(thief.fromY, thief.y, thief.t);
      const sx = lerp(thief.fromX, thief.x, thief.t) * TILE + 8;
      const sy = ty * TILE + 13;
      const still = thief.stunned > 0;
      items.push({
        y: ty,
        draw: () => {
          shadowAt(sx, sy + 2, 4.5, 1.6, 0.9);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(0.6, 0.6);
          ctx.globalAlpha *= still ? 0.55 : 1;
          drawSmoke(ctx, 0, 0, t * 1.8, thief.phase, still ? 0.3 : 1);
          ctx.restore();
          // The verse it took, held high.
          const bob = Math.sin(t * 9 + thief.phase) * (still ? 0.3 : 1.2);
          if (P?.feather) stand(ctx, P.feather, sx + 3, sy - 7 + bob, 10, { tilt: 0.5 + Math.sin(t * 7) * 0.15 });
          else ctx.drawImage(this.sprites.feather, sx - 1, sy - 17 + bob);
        },
      });
    }
    const faced = this.mode === "explore" ? this.thingAt({ x: this.player.x + DELTA[this.player.dir].x, y: this.player.y + DELTA[this.player.dir].y }) : undefined;
    for (const th of this.things) {
      if (th.picked || th.fade <= 0 || !th.el.imagen) continue;
      if (!onScreen({ x: th.x, y: th.y - (th.el.alto ?? 2) })) {
        if (!onScreen(th)) continue;
      }
      items.push({ y: lerp(th.fromY, th.y, th.t), draw: () => this.drawThing(ctx, th, t, shadowAt, th === faced) });
    }
    const p = this.player;
    const pos = this.playerPos();
    const blinking = this.invulnerable > 0 && Math.floor(t * 10) % 2 === 0;
    const x = pos.x * TILE + 8;
    const y = pos.y * TILE + 15;
    const view: View = p.dir === "down" ? "front" : p.dir === "up" ? "back" : "side";
    const parts = P?.voice?.[view];
    const flip = p.dir === "right";
    const pose = parts && voicePose(parts, view, (this.walkClock * Math.PI) / this.stepTime(), this.walkBlend, t);
    if (parts && pose) {
      const k = VOICE_TALL / parts.body.height;
      this.voiceShift = { x: pose.sway * k * (flip ? -1 : 1), y: pose.drop * k };
    } else this.voiceShift = { x: 0, y: 0 };
    items.push({
      y: pos.y,
      draw: () => {
        shadowAt(x, y, 6.5, 2.3);
        if (blinking) return;
        if (parts && pose) drawVoice(ctx, parts, x, y, VOICE_TALL, flip, pose);
        else {
          const frames = this.sprites.voice[p.dir];
          const bob = p.moving ? Math.abs(Math.sin((this.walkClock * Math.PI) / this.stepTime())) * 1.3 : 0;
          ctx.drawImage(frames[p.moving ? 1 + (Math.floor(this.walkClock / 0.12) % 2) : 0], x - 8, y - 23 - bob);
        }
        // The highest rank of the voice wears a halo.
        if (this.halo) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `rgba(255,226,150,${0.75 + Math.sin(t * 2) * 0.15})`;
          ctx.lineWidth = 0.7;
          ctx.shadowColor = "rgba(255,214,130,0.9)";
          ctx.shadowBlur = 6 * this.dpr;
          ctx.beginPath();
          ctx.ellipse(x + this.voiceShift.x, y - VOICE_TALL - 1.5 + this.voiceShift.y + Math.sin(t * 1.6) * 0.4, 3.4, 1.1, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      },
    });
    items.sort((i, j) => i.y - j.y);
    for (const it of items) it.draw();
  }

  /** One person or thing of the painting, moving the way the book says it moves. */
  private drawThing(
    ctx: CanvasRenderingContext2D,
    th: Thing,
    t: number,
    shadowAt: (x: number, y: number, rx: number, ry: number, a?: number) => void,
    faced: boolean,
  ) {
    const el = th.el;
    const { cx, base, h, width, img } = this.thingBox(th);
    const mode = el.mueve ?? (el.persona ? "respira" : "quieto");
    const ph = th.phase;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * Math.min(1, th.fade) * (mode === "sombra" ? 0.5 : 1);
    if (mode !== "sombra") shadowAt(cx, base, Math.max(5, width * 0.42), 2.4, el.pasable ? 0.45 : 0.8);
    let dy = 0;
    let tilt = 0;
    let squash = 1;
    let shear = 0;
    let dx = 0;
    if (mode === "respira") squash = 1 + Math.sin(t * 1.7 + ph) * 0.012;
    else if (mode === "baila") {
      tilt = Math.sin(t * 3.2 + ph) * 0.07;
      dy = -Math.abs(Math.sin(t * 3.2 + ph)) * 1.6;
    } else if (mode === "aplaude") dy = -Math.abs(Math.sin(t * 9 + ph)) * 0.9;
    else if (mode === "marioneta") {
      dy = Math.sin(t * 1.4) * 1.4 - 1.5;
      tilt = Math.sin(t * 1.1) * 0.035;
    } else if (mode === "viento") shear = Math.sin(t * 1.3 + ph) * 0.07 + Math.sin(t * 2.9 + ph) * 0.02;
    else if (mode === "sombra") dx = Math.sin(t * 0.35 + ph) * 3;
    else if ((mode === "seAleja" || mode === "corre" || mode === "seAcerca") && th.moving) {
      const pace = mode === "corre" ? 0.13 : 0.38;
      dy = -Math.abs(Math.sin((t / pace) * Math.PI)) * (mode === "corre" ? 1.8 : 0.8);
      tilt = mode === "corre" ? Math.sin((t / pace) * Math.PI) * 0.04 : 0;
    } else if (el.persona && mode !== "quieto") squash = 1 + Math.sin(t * 1.7 + ph) * 0.012;
    // A keepsake floats a little over the floor, like a verse: it is there to be taken.
    if (el.recuerdo) dy = -1.6 + Math.sin(t * 2.2 + ph) * 1.1;

    if (img) {
      ctx.save();
      ctx.translate(cx + dx, base + dy);
      if (tilt) ctx.rotate(tilt);
      if (shear) ctx.transform(1, 0, shear, 1, 0, 0);
      ctx.scale(el.espejado ? -1 : 1, squash);
      ctx.drawImage(img, -width / 2, -h, width, h);
      ctx.restore();
    } else if (el.persona) drawSilhouette(ctx, cx + dx, base + dy, h, width);
    const top = base + dy - h;

    if ((mode === "fuma" || mode === "vapor") && el.humo) {
      const hx = cx + (el.espejado ? 0.5 - el.humo.x : el.humo.x - 0.5) * width;
      drawWisps(ctx, hx, top + el.humo.y * h, t, ph, mode === "vapor");
    }
    if (mode === "marioneta") drawStrings(ctx, cx, top, width, h, t);
    if (mode === "brilla" && (t * 0.45 + ph) % 1 < 0.12) {
      const q = Math.sin((((t * 0.45 + ph) % 1) / 0.12) * Math.PI);
      drawStar(ctx, cx + width * 0.15, base - h * 0.55, 3 + q * 4, `rgba(255,255,255,${q})`, "rgba(255,250,230,0.9)", 6 * this.dpr);
    }
    if (mode === "refleja" && el.vidrio) this.drawReflection(ctx, th, cx - width / 2, top, width, h);
    ctx.globalAlpha = alpha;

    // The small star over what the Voice would talk to.
    if (faced) {
      const pulse = 0.7 + Math.sin(t * 4) * 0.3;
      drawStar(ctx, cx, top - 5 + Math.sin(t * 3) * 1.2, 6, `rgba(244,227,176,${pulse})`, "rgba(255,214,150,0.9)", 8 * this.dpr);
    }
  }

  /** A mirror shows the Voice when it stands in front: with a cardboard crown, as in the book. */
  private drawReflection(ctx: CanvasRenderingContext2D, th: Thing, left: number, top: number, width: number, h: number) {
    const g = th.el.vidrio!;
    const p = this.playerPos();
    const ahead = p.y - th.y;
    if (ahead <= 0 || ahead > 4.5 || Math.abs(p.x - th.x) > 2.5) return;
    const parts = this.paintedArt?.voice?.front;
    if (!parts) return;
    const gx = left + g.x * width;
    const gy = top + g.y * h;
    const gw = g.ancho * width;
    const gh = g.alto * h;
    const near = clamp(1.4 - ahead / 4);
    const tall = gh * (0.45 + near * 0.35);
    const fx = gx + gw / 2 + (p.x - th.x) * gw * 0.18;
    const fy = gy + gh * 0.96;
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, gw, gh);
    ctx.clip();
    ctx.globalAlpha *= 0.85 * near;
    // Seen in a mirror, the lantern stays on the same side as the Voice's.
    drawVoice(ctx, parts, fx, fy, tall, true, voicePose(parts, "front", 0, 0, this.time));
    drawCrown(ctx, fx, fy - tall * 0.83, tall * 0.28);
    const sheen = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
    sheen.addColorStop(0, "rgba(220,230,255,0.12)");
    sheen.addColorStop(0.5, "rgba(20,20,40,0.25)");
    sheen.addColorStop(1, "rgba(220,230,255,0.08)");
    ctx.fillStyle = sheen;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.restore();
  }

  /** Where the Voice's lantern is. */
  private lanternPos() {
    const pos = this.playerPos();
    const at = LANTERN[this.player.dir];
    return { x: pos.x * TILE + 8 + at.x + this.voiceShift.x, y: pos.y * TILE + 15 - at.y + this.voiceShift.y };
  }

  /** Whether light from (x0, y0) reaches (x1, y1), in world pixels: walls in between block it. */
  private sight(x0: number, y0: number, x1: number, y1: number) {
    let tx = Math.floor(x0 / TILE);
    let ty = Math.floor(y0 / TILE);
    const ex = Math.floor(x1 / TILE);
    const ey = Math.floor(y1 / TILE);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const deltaX = dx !== 0 ? TILE / Math.abs(dx) : Infinity;
    const deltaY = dy !== 0 ? TILE / Math.abs(dy) : Infinity;
    let maxX = dx !== 0 ? ((stepX > 0 ? (tx + 1) * TILE : tx * TILE) - x0) / dx : Infinity;
    let maxY = dy !== 0 ? ((stepY > 0 ? (ty + 1) * TILE : ty * TILE) - y0) / dy : Infinity;
    const cells = this.map.cells;
    for (let i = 0; i < 48; i++) {
      if (tx === ex && ty === ey) return true;
      if (maxX < maxY) {
        maxX += deltaX;
        tx += stepX;
      } else {
        maxY += deltaY;
        ty += stepY;
      }
      if (tx === ex && ty === ey) return true;
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || cells[at(tx, ty)] === WALL) return false;
    }
    return true;
  }

  private lampTint(color: string) {
    let c = this.lampTints.get(color);
    if (!c) {
      c = tint(color);
      this.lampTints.set(color, c);
    }
    return c;
  }

  /** Every light in the level: where it falls, how far, its color, and where it glows. */
  private lights(): Glow[] {
    const t = this.time;
    const m = this.map;
    const out: Glow[] = [];
    if (this.mode !== "reveal") {
      const pos = this.playerPos();
      const lantern = this.lanternPos();
      const flicker = 1 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 13.1) * 0.02;
      const strength = 0.45 + (0.55 * this.light) / this.maxLight;
      // The light reaches farther as the voice grows, and with the keepsake that sees far.
      const reach = this.rankIndex * 0.12 + (this.gifts.has("mirada") ? 1.4 : 0);
      out.push({
        x: pos.x * TILE + 8,
        y: pos.y * TILE + 9,
        r: (3 + this.light * 0.8 + reach + this.singPulse * 2.6) * flicker,
        a: 1,
        c: WARM,
        shadow: true,
        glow: (0.42 + this.singPulse * 0.4) * strength * flicker,
        gx: lantern.x,
        gy: lantern.y,
        gr: 12 + this.singPulse * 10,
      });
    }
    for (const lamp of m.lamps) {
      const lit = this.visitedLamps.has(lamp);
      const x = lamp.x * TILE + 8;
      out.push({
        x,
        y: lamp.y * TILE + 9,
        r: (lit ? lamp.radius : 2) * (1 + Math.sin(t * 5 + lamp.x) * 0.04),
        a: lit ? 1 : 0.7,
        c: this.lampTint(lamp.color),
        shadow: true,
        glow: lit ? 0.55 : 0.25,
        gx: x + FLAME.x,
        gy: lamp.y * TILE + 15.5 - FLAME.y,
        gr: lit ? 11 : 6,
      });
    }
    for (const v of m.verses) {
      if (!this.collected.has(v.index)) {
        const x = v.x * TILE + 8;
        const y = v.y * TILE + 8;
        out.push({ x, y, r: 1.5 + Math.sin(t * 2.2 + v.index) * 0.2, a: 0.85, c: [1, 0.95, 0.78], shadow: false, glow: 0.35, gx: x, gy: y, gr: 8 });
      }
    }
    const ax = m.angel.x * TILE + 8;
    out.push({ x: ax, y: m.angel.y * TILE + 6, r: 2, a: 0.85, c: [0.86, 0.9, 1], shadow: false, glow: 0.2, gx: ax, gy: m.angel.y * TILE - 6, gr: 16 });
    const sx = m.start.x * TILE + 8;
    const sy = m.start.y * TILE + 8;
    out.push({ x: sx, y: sy, r: 1.2, a: 0.6, c: [1, 0.5, 0.5], shadow: false, glow: 0.25, gx: sx, gy: sy, gr: 9 });
    const px = m.portal.x * TILE + 8;
    const py = m.portal.y * TILE + 8;
    out.push(
      this.portalOpen
        ? { x: px, y: py, r: 4.4, a: 1, c: [1, 0.95, 0.8], shadow: true, glow: 0.45, gx: px, gy: py - 4, gr: 30 }
        : { x: px, y: py, r: 1.5, a: 0.55, c: [1, 0.45, 0.45], shadow: false, glow: 0.25, gx: px, gy: py, gr: 12 },
    );
    for (const th of this.things) {
      // People of the painting glow faintly, like echoes: they can be seen from afar in the dark.
      if (th.el.persona && th.fade > 0) {
        const b = this.thingBox(th);
        const f = Math.min(1, th.fade) * (0.85 + Math.sin(t * 1.3 + th.phase) * 0.15);
        out.push({ x: b.cx, y: b.base - 6, r: 2.1, a: 0.6 * f, c: [0.82, 0.86, 1], shadow: false, glow: 0.16 * f, gx: b.cx, gy: b.base - b.h * 0.55, gr: 12 });
      }
      if (th.el.recuerdo && !th.picked) {
        // A keepsake shines on the floor, warmer than a verse: it can be found in the dark.
        const b = this.thingBox(th);
        const pulse = 0.8 + Math.sin(t * 2.6 + th.phase) * 0.2;
        out.push({ x: b.cx, y: b.base - 3, r: 1.7 * pulse, a: 0.9, c: [1, 0.86, 0.55], shadow: false, glow: 0.4 * pulse, gx: b.cx, gy: b.base - b.h * 0.5, gr: 9 });
      }
      const L = th.el.luz;
      if (!L || th.picked || th.fade <= 0) continue;
      const b = this.thingBox(th);
      let x = b.cx;
      let y = b.base - 6;
      let gy = th.el.imagen ? b.base - b.h * (L.altura ?? 0.5) : y;
      let k = 1;
      if (th.el.mueve === "titila") k = ((t * 0.31 + th.phase) % 1 < 0.05 && Math.sin(t * 70) > 0 ? 0.25 : 1) * (0.94 + Math.sin(t * 17 + th.phase) * 0.06);
      if (th.el.mueve === "llama") k = 1 + Math.sin(t * 9 + th.phase) * 0.05 + Math.sin(t * 23 + th.phase) * 0.03;
      if (th.el.mueve === "gira") {
        x += Math.cos(t * 0.7 + th.phase) * TILE * 3;
        y += Math.sin(t * 0.9 + th.phase) * TILE * 2;
        gy = y;
      }
      out.push({
        x,
        y,
        r: L.alcance * k,
        a: 0.95 * Math.min(1, th.fade),
        c: this.lampTint(L.color),
        shadow: th.el.mueve !== "gira",
        glow: 0.42 * k * Math.min(1, th.fade),
        gx: x,
        gy,
        gr: th.el.imagen ? 9 : 16,
      });
    }
    for (const sp of m.sparkles) {
      const q = (Math.sin(t * 3 + sp.x * 1.7 + sp.y) + 1) / 2;
      const x = sp.x * TILE + 8;
      const y = sp.y * TILE + 8;
      out.push({ x, y, r: 0.5 + q * 0.6, a: 0.7, c: [1, 1, 1], shadow: false, glow: 0.3 * q, gx: x, gy: y, gr: 5 });
    }
    return out;
  }

  /**
   * The light map: a grid of four cells per tile where each light adds warmth and
   * walls cast shadows, over a dim moonlight that is brighter where the Voice has
   * already been. It is multiplied over the world and stretched smoothly, which
   * softens the edges of the shadows. Then the lights glow.
   */
  private renderLighting(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number, reveal: number) {
    const lc = this.lightCanvas;
    if (!lc) return;
    const m = this.map;
    const darkMul = reveal < 0 ? 1 : 1 - ease(clamp(reveal / 2.2));
    const dark = m.darkness * darkMul * (1 - this.flash * 0.8);
    if (dark <= 0.01) return;

    const C = TILE / 4;
    const cx0 = Math.max(-2, Math.floor(-ox / s / C) - 1);
    const cy0 = Math.max(-2, Math.floor(-oy / s / C) - 1);
    const cx1 = Math.min(COLS * 4 + 2, Math.ceil((this.cw - ox) / s / C) + 1);
    const cy1 = Math.min(ROWS * 4 + 2, Math.ceil((this.ch - oy) / s / C) + 1);
    const w = cx1 - cx0;
    const h = cy1 - cy0;
    if (w <= 0 || h <= 0) return;
    const n = w * h;
    let L = this.lightBuffers;
    if (!L || L.intensity.length < n) {
      L = {
        intensity: new Float32Array(n),
        red: new Float32Array(n),
        green: new Float32Array(n),
        blue: new Float32Array(n),
        image: null,
        bloom: null,
      };
      this.lightBuffers = L;
    }
    if (!L.image || !L.bloom || L.image.width !== w || L.image.height !== h) {
      L.image = new ImageData(w, h);
      L.bloom = new ImageData(w, h);
      if (lc.width < w || lc.height < h * 2 + 2) {
        lc.width = Math.max(lc.width, w);
        lc.height = Math.max(lc.height, h * 2 + 2);
      }
    }
    const { intensity, red, green, blue } = L;
    intensity.fill(0, 0, n);
    red.fill(0, 0, n);
    green.fill(0, 0, n);
    blue.fill(0, 0, n);

    const lights = this.lights();
    for (const li of lights) {
      const R = li.r * TILE;
      const inv = 1 / (R * R);
      const bx0 = Math.max(0, Math.floor((li.x - R) / C) - cx0);
      const bx1 = Math.min(w - 1, Math.ceil((li.x + R) / C) - cx0);
      const by0 = Math.max(0, Math.floor((li.y - R) / C) - cy0);
      const by1 = Math.min(h - 1, Math.ceil((li.y + R) / C) - cy0);
      const [cr, cg, cb] = li.c;
      for (let y = by0; y <= by1; y++) {
        const py = (cy0 + y + 0.5) * C;
        const dy2 = (py - li.y) * (py - li.y);
        for (let x = bx0; x <= bx1; x++) {
          const px = (cx0 + x + 0.5) * C;
          const d2 = ((px - li.x) * (px - li.x) + dy2) * inv;
          if (d2 >= 1) continue;
          if (li.shadow && !this.sight(li.x, li.y, px, py)) continue;
          const f = 1 - d2;
          const v = li.a * f * f;
          const o = y * w + x;
          intensity[o] += v;
          red[o] += v * cr;
          green[o] += v * cg;
          blue[o] += v * cb;
        }
      }
    }

    const ambient = 0.3 + (1 - dark) * 0.6;
    const memory = 0.15 * darkMul;
    const shade = new Uint32Array(L.image.data.buffer);
    const bloom = new Uint32Array(L.bloom!.data.buffer);
    const seen = this.seen;
    for (let y = 0; y < h; y++) {
      const ty = Math.min(ROWS - 1, Math.max(0, Math.floor((cy0 + y) / 4)));
      for (let x = 0; x < w; x++) {
        const o = y * w + x;
        const tx = Math.min(COLS - 1, Math.max(0, Math.floor((cx0 + x) / 4)));
        const base = ambient + memory * seen[ty * COLS + tx];
        let r = base * 0.6;
        let g = base * 0.7;
        let b = base;
        const I = intensity[o];
        let add = 0xff000000;
        if (I > 0) {
          const k = 1 / I;
          const lit = I * 1.5 > 1 ? 1 : I * 1.5;
          const hr = red[o] * k;
          const hg = green[o] * k;
          const hb = blue[o] * k;
          r += (hr - r) * lit;
          g += (hg - g) * lit;
          b += (hb - b) * lit;
          const q = lit * lit * 0.15 * darkMul * 255;
          add = 0xff000000 | ((hb * hb * q) << 16) | ((hg * hg * q) << 8) | (hr * hr * q);
        }
        bloom[o] = add;
        shade[o] = 0xff000000 | ((b > 1 ? 255 : b * 255) << 16) | ((g > 1 ? 255 : g * 255) << 8) | (r > 1 ? 255 : r * 255);
      }
    }
    const lctx = lc.getContext("2d")!;
    lctx.putImageData(L.image, 0, 0);
    lctx.putImageData(L.bloom!, 0, h + 2);

    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(lc, 0, 0, w, h, cx0 * C, cy0 * C, w * C, h * C);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(lc, 0, h + 2, w, h, cx0 * C, cy0 * C, w * C, h * C);

    // Glow, and on wet nights its reflection on the ground.
    ctx.globalCompositeOperation = "lighter";
    for (const li of lights) {
      if (li.glow <= 0) continue;
      const [cr, cg, cb] = li.c.map((v) => Math.round(Math.min(1, v) * 255));
      const g = ctx.createRadialGradient(li.gx, li.gy, 0, li.gx, li.gy, li.gr);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${li.glow * darkMul})`);
      g.addColorStop(0.35, `rgba(${cr},${cg},${cb},${li.glow * 0.35 * darkMul})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(li.gx - li.gr, li.gy - li.gr, li.gr * 2, li.gr * 2);
      if (this.rainy && li.shadow) {
        ctx.save();
        ctx.translate(li.x, li.y + 6);
        ctx.scale(0.35, 1);
        const wet = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
        wet.addColorStop(0, `rgba(${cr},${cg},${cb},${0.16 * darkMul})`);
        wet.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = wet;
        ctx.fillRect(-16, -16, 32, 32);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private renderWeather(ctx: CanvasRenderingContext2D, reveal: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = this.cw;
    const h = this.ch;
    const alpha = reveal < 0 ? 1 : 1 - clamp(reveal / 1.5);
    if (alpha > 0) {
      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(182,202,226,${(0.26 + this.flash * 0.3) * alpha})`;
      ctx.lineWidth = Math.max(1, this.dpr * 0.85);
      ctx.beginPath();
      for (const d of this.drops) {
        if (d.color !== "lluvia") continue;
        ctx.moveTo(d.x * w, d.y * h);
        ctx.lineTo(d.x * w + d.vx * d.size * w * 0.6, d.y * h + d.size * h);
      }
      ctx.stroke();
      for (const d of this.drops) {
        if (d.color === "lluvia") continue;
        if (d.color === "#ffe6a8") {
          const k = (Math.sin(this.time * 2 + d.phase) + 1) / 2;
          ctx.fillStyle = `rgba(255,230,168,${(0.25 + k * 0.45) * alpha})`;
          ctx.beginPath();
          ctx.arc(d.x * w, d.y * h, d.size * this.dpr * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(d.x * w, d.y * h);
          ctx.rotate(d.rot);
          ctx.globalAlpha = 0.85 * alpha;
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, d.size * this.dpr * 1.6, d.size * this.dpr * 0.8 * Math.abs(Math.cos(d.rot * 1.7)) + 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    if (this.flash > 0 && reveal < 0) {
      ctx.fillStyle = `rgba(220,230,255,${this.flash * (this.o.reducedMotion ? 0.08 : 0.22)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (reveal < 0) {
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) * 0.56);
      v.addColorStop(0, "rgba(2,3,5,0)");
      v.addColorStop(1, "rgba(2,3,5,0.62)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    }
    for (const m of this.motes) {
      const k = (Math.sin(this.time * 3 + m.phase) + 1) / 2;
      const [r, g, b] = rgb(m.color);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.4 + k * 0.5})`;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.size * this.dpr * 0.6, 0, Math.PI * 2);
      ctx.fill();
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
    // A phone on its side: the words go to the sides, and the shadow and the light share the whole height.
    const low = !portrait && h < 520 * this.dpr;
    const cx = w / 2;
    const cy = portrait ? h * 0.3 : low ? h * 0.36 : h * 0.4;
    const size = Math.min(w, h) * (portrait ? 0.3 : 0.24) * (b.guardian ? 1.2 : 1);
    const tone = rgb(this.o.level.tone);

    // The shadow: its painted portrait breathing inside a swirl of smoke.
    const dying = b.dying;
    const painted = b.guardian ? this.creatures.guardian : this.creatures.shadow;
    if (painted) {
      const breathe = 1 + Math.sin(t * 1.6) * 0.02 + b.pulse * b.pulse * 0.015;
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

    // Your light, below: the one place where everything happens.
    const ly = portrait ? h * 0.62 : low ? h * 0.74 : h * 0.68;
    const R = clamp(Math.min(w, h) * 0.07, 26 * this.dpr, 44 * this.dpr);
    const strength = 0.5 + 0.5 * (this.light / this.maxLight);
    const beat = b.pulse * b.pulse;
    const glowR = R * 2.8 * strength * (1 + beat * 0.08) * (1 + b.flare * 0.6);
    const lg = ctx.createRadialGradient(cx, ly, 0, cx, ly, glowR);
    lg.addColorStop(0, `rgba(255,246,216,${0.95 * strength})`);
    lg.addColorStop(0.16, `rgba(255,217,138,${0.6 * strength})`);
    lg.addColorStop(1, "rgba(255,217,138,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(cx - glowR, ly - glowR, glowR * 2, glowR * 2);
    if (b.wound > 0) {
      const wg = ctx.createRadialGradient(cx, ly, 0, cx, ly, R * 2.4);
      wg.addColorStop(0, `rgba(255,40,50,${0.55 * b.wound})`);
      wg.addColorStop(1, "rgba(255,40,50,0)");
      ctx.fillStyle = wg;
      ctx.fillRect(cx - R * 2.4, ly - R * 2.4, R * 4.8, R * 4.8);
    }

    const playing = b.phase === "call" || b.phase === "rest";
    const progress = (n: BattleNote) => (b.clock - (n.at - n.travel)) / n.travel;
    // Notes leave the shadow's mouth, or come from the sides when it won't look at you.
    const source = (side: number) =>
      side === 0 ? { x: cx, y: cy - size * 0.05 } : { x: cx + side * Math.min(w * 0.42, size * 1.7), y: cy + size * 0.45 };

    // The ring around the light: where the notes must be answered. It glows as one comes close.
    let near = 0;
    if (b.phase === "call") for (const n of b.notes) if (!n.result) near = Math.max(near, clamp((progress(n) - 0.55) / 0.45));
    const ringR = R * (1 + beat * 0.07);
    ctx.fillStyle = `rgba(255,226,160,${0.05 + 0.1 * near})`;
    ctx.beginPath();
    ctx.arc(cx, ly, ringR, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3 * this.dpr;
    ctx.strokeStyle = `rgba(255,226,160,${(playing ? 0.45 : 0.15) + 0.55 * near})`;
    ctx.stroke();

    if (b.phase === "call") {
      // Faint paths, so it's clear where each note is going.
      ctx.save();
      ctx.setLineDash([2 * this.dpr, 7 * this.dpr]);
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.strokeStyle = "rgba(255,120,128,0.16)";
      for (const side of new Set(b.notes.filter((n) => !n.result).map((n) => n.side))) {
        const s = source(side);
        const len = Math.hypot(cx - s.x, ly - s.y);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(cx - ((cx - s.x) / len) * ringR, ly - ((ly - s.y) / len) * ringR);
        ctx.stroke();
      }
      ctx.restore();
    }

    // The shadow's notes on their way, and what became of the answered ones.
    for (const n of b.notes) {
      if (n.result) {
        const age = b.clock - n.doneAt;
        if (age < 0 || age > 0.5) continue;
        const k = age / 0.5;
        const answered = n.result === "perfect" || n.result === "good";
        ctx.strokeStyle = answered ? `rgba(255,236,180,${(1 - k) * (n.result === "perfect" ? 1 : 0.7)})` : `rgba(255,60,70,${(1 - k) * 0.8})`;
        ctx.lineWidth = (answered ? 4 : 3) * this.dpr * (1 - k * 0.6);
        ctx.beginPath();
        ctx.arc(cx, ly, ringR * (1 + k * (answered ? 1.6 : 0.9)), 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      let p = progress(n);
      if (p < 0) continue;
      if (n.hold) p = Math.min(p, 1);
      const s = source(n.side);
      const x = lerp(s.x, cx, p) + (n.style === "offbeat" ? Math.sin(t * 37 + n.at * 11) * 1.6 * this.dpr : 0);
      const y = lerp(s.y, ly, p);
      let alpha = clamp(p * 6) * (1 - b.dying);
      // Olvido's notes fade on the way: the pulse tells when they arrive.
      if (n.style === "fade") alpha *= p < 0.3 ? 1 : clamp(1 - (p - 0.3) / 0.25);
      this.drawDarkNote(ctx, x, y, R * (0.34 + 0.14 * Math.min(1, p)), alpha);
    }

    // Answered notes fly back at the shadow as light.
    for (const bolt of b.bolts) {
      if (bolt.t < 0) continue;
      const f = bolt.t / BOLT_TIME;
      for (let k = 0; k < 4; k++) {
        const g = Math.max(0, f - k * 0.07);
        const e = 1 - (1 - g) * (1 - g);
        const x = cx + Math.sin(g * Math.PI) * R * (bolt.big ? 0 : 0.7);
        const y = lerp(ly - ringR, cy, e);
        const r = R * (bolt.big ? 0.7 : 0.32) * (1 - k * 0.18);
        const bg = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        bg.addColorStop(0, `rgba(255,248,224,${0.95 - k * 0.22})`);
        bg.addColorStop(0.35, `rgba(255,214,130,${0.6 - k * 0.14})`);
        bg.addColorStop(1, "rgba(255,214,130,0)");
        ctx.fillStyle = bg;
        ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
      }
    }

    // A whole phrase answered: a wave of light.
    if (b.flare > 0) {
      const k = 1 - b.flare;
      ctx.strokeStyle = `rgba(255,236,180,${b.flare * 0.7})`;
      ctx.lineWidth = 6 * this.dpr * b.flare;
      ctx.beginPath();
      ctx.arc(cx, ly, ringR * (1.2 + k * 5), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // The first battle points at the light and says when.
    if (b.lesson && playing) {
      const held = b.notes.find((n) => n.hold && !n.result && b.clock >= n.at);
      const cue = held ?? (b.lesson === 2 ? b.notes.find((n) => !n.result && Math.abs(b.clock - n.at) < 0.18) : undefined);
      ctx.font = `italic ${Math.round(16 * this.dpr)}px ${this.font}`;
      ctx.fillStyle = "rgba(247,247,245,0.75)";
      ctx.fillText(held ? (this.o.touch ? "Tocá" : "Espacio") : "Tu luz", cx, ly + ringR + 24 * this.dpr);
      if (cue) {
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 10);
        ctx.font = `italic ${Math.round(30 * this.dpr)}px ${this.font}`;
        ctx.fillStyle = "#fff1c2";
        ctx.fillText("¡Ahora!", cx, ly - ringR - 16 * this.dpr);
        ctx.globalAlpha = 1;
      }
    }

    // How each answer went, over the light; what happened to the light itself, beside it.
    for (const pop of b.popups) {
      ctx.globalAlpha = clamp((pop.low ? 1.4 : 0.9) - pop.t, 0, 1) * clamp(pop.t * 12);
      ctx.fillStyle = pop.color;
      ctx.font = `italic ${Math.round((pop.big ? 30 : pop.low ? 20 : 24) * this.dpr)}px ${this.font}`;
      ctx.textAlign = pop.low ? "left" : "center";
      if (pop.low) ctx.fillText(pop.text, cx + ringR + 14 * this.dpr, ly + 7 * this.dpr - pop.t * 12 * this.dpr);
      else ctx.fillText(pop.text, cx, ly - ringR - 18 * this.dpr - pop.t * 40 * this.dpr);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.restore();
  }

  /** A note sung by a shadow: a ball of darkness with a red ember inside. */
  private drawDarkNote(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
    g.addColorStop(0, "rgba(255,80,90,0.95)");
    g.addColorStop(0.2, "rgba(160,16,28,0.92)");
    g.addColorStop(0.58, "rgba(12,6,12,0.94)");
    g.addColorStop(1, "rgba(12,6,12,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,96,106,0.75)";
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ----- UI state ------------------------------------------------------------

  private emit() {
    this.ui = this.snapshot();
    for (const l of this.listeners) l();
  }

  private voiceUI(): UIState["voice"] {
    const rank = rankOf(getProgress().voice);
    return { rank: rank.name, index: rank.index, into: rank.into, span: rank.span, next: rank.nextName };
  }

  /** What this page gave the voice, for the end of the page. */
  private tallyUI(): TallyUI {
    const t = this.tally;
    const rows = [
      { label: "Versos rescatados", amount: t.verses },
      { label: "Notas respondidas", amount: t.notes },
      { label: "Sombras vencidas", amount: t.shadows },
      { label: "Recuerdos encontrados", amount: t.keepsake },
      { label: "Ladrona atrapada", amount: t.thief },
      { label: "Página rescatada", amount: t.page },
      { label: "Sin que tu luz se apague", amount: t.clean },
    ].filter((r) => r.amount > 0);
    return { rows, total: rows.reduce((sum, r) => sum + r.amount, 0), grewTo: this.grewTo };
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
      maxLight: this.maxLight,
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
              portrait: line.portrait,
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
              verse: b.verse,
              canFlee: !b.guardian && (b.phase === "rest" || b.phase === "call"),
            }
          : null,
      reveal:
        this.reveal?.done && this.mode === "reveal"
          ? { title: lvl.name, meaning: lvl.meaning, route: lvl.route, last: lvl.number === this.o.total, tally: this.tallyUI() }
          : null,
      voice: this.voiceUI(),
      gain: this.gainSum > 0 && this.mode !== "battle" && this.mode !== "reveal" && this.mode !== "found" ? { id: this.gainId, amount: this.gainSum } : null,
      banner: this.mode === "explore" || this.mode === "dialogue" ? this.banner : null,
      carried: this.carriedUI,
      found: this.mode === "found" ? this.found : null,
      chase: Boolean(this.thief),
      paused: this.paused,
      blackout: this.mode === "blackout",
    };
  }
}

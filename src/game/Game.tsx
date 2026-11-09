"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Adorno } from "@/experiencia/Adorno";
import { AudioEngine, MODES, type AudioSettings, type Key } from "./audio";
import { Engine } from "./engine";
import { getProgress, getServerProgress, markDone, subscribeProgress, updateProgress } from "./progress";
import type { Dir, LevelSource, Speaker, UIState } from "./types";
import "./game.css";

const HUB_KEY: Key = { root: 50, mode: MODES.aeolian, progression: [0, 5, 3, 4] };
const PORTRAITS: Partial<Record<Speaker, string>> = {
  angel: "/juego/angel.jpg",
  voice: "/juego/voz.jpg",
  shadow: "/juego/sombra.jpg",
  guardian: "/juego/guardian.jpg",
};
const PROLOGUE = [
  "Dicen que cada vez que alguien termina de leer un poema, en algún lado un ángel canta.",
  "Estos poemas nunca se terminaron de leer.",
  "Las sombras se comieron sus versos, y los ángeles se quedaron callados.",
  "Quedó una sola cosa encendida: vos.",
  "Sos la Voz. Entrá en cada página, rescatá sus versos y devolvele el canto al coro.",
];

type Screen =
  | { kind: "title" }
  | { kind: "prologue"; then: string }
  | { kind: "choir" }
  | { kind: "level"; id: string; run: number }
  | { kind: "ending" };

type Panel = null | "sound";

const isCoarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

async function share(text: string, path: string) {
  const url = new URL(path, window.location.origin).toString();
  try {
    if (navigator.share) {
      await navigator.share({ title: "La Voz", text, url });
      return "";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "Enlace copiado.";
  } catch {
    return "";
  }
}

export function Game({ levels }: { levels: LevelSource[] }) {
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress);
  const params = useSearchParams();
  const wanted = levels.find((l) => l.id === params.get("nivel")) ?? null;
  const [audio] = useState(() => new AudioEngine());
  const [screen, setScreen] = useState<Screen>({ kind: "title" });
  const [panel, setPanel] = useState<Panel>(null);
  const [awake, setAwake] = useState(false);

  const done = progress.done;
  const doneCount = levels.filter((l) => done.includes(l.id)).length;
  const nextLevel = levels.find((l) => !done.includes(l.id)) ?? null;
  const isUnlocked = (i: number) => i === 0 || done.includes(levels[i].id) || done.includes(levels[i - 1].id);

  useEffect(() => {
    audio.apply(progress.audio);
  }, [audio, progress.audio]);

  // The hub and the ending sing with one voice per rescued page.
  useEffect(() => {
    if (!awake || (screen.kind !== "choir" && screen.kind !== "ending")) return;
    audio.startChoir(HUB_KEY, Math.min(7, 1 + doneCount));
    return () => audio.stopChoir();
  }, [audio, awake, screen.kind, doneCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT") return;
      if (e.key === "m" || e.key === "M") {
        updateProgress((p) => ({ ...p, audio: { ...p.audio, muted: !p.audio.muted } }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wake = () => {
    audio.wake();
    setAwake(true);
  };

  const play = (id: string) => {
    wake();
    if (!getProgress().seenPrologue) setScreen({ kind: "prologue", then: id });
    else setScreen({ kind: "level", id, run: Date.now() });
  };

  const setAudio = (change: Partial<AudioSettings>) => updateProgress((p) => ({ ...p, audio: { ...p.audio, ...change } }));

  return (
    <div className="juego">
      {screen.kind === "title" && (
        <TitleScreen
          primary={
            wanted
              ? { label: `Jugar «${wanted.indexName}»`, onClick: () => play(wanted.id) }
              : nextLevel
                ? { label: doneCount ? "Seguir" : "Empezar", onClick: () => play(nextLevel.id) }
                : {
                    label: "Escuchar el coro",
                    onClick: () => {
                      wake();
                      setScreen({ kind: "ending" });
                    },
                  }
          }
          onChoir={
            doneCount || wanted
              ? () => {
                  wake();
                  setScreen({ kind: "choir" });
                }
              : null
          }
          onSound={() => setPanel("sound")}
        />
      )}

      {screen.kind === "prologue" && (
        <Prologue
          audio={audio}
          onDone={() => {
            updateProgress((p) => ({ ...p, seenPrologue: true }));
            setScreen({ kind: "level", id: screen.then, run: Date.now() });
          }}
        />
      )}

      {screen.kind === "choir" && (
        <Choir
          levels={levels}
          done={done}
          isUnlocked={(i) => isUnlocked(i) || levels[i].id === wanted?.id}
          next={nextLevel}
          onPlay={(id) => play(id)}
          onBack={() => setScreen({ kind: "title" })}
          onSound={() => setPanel("sound")}
        />
      )}

      {screen.kind === "level" && (
        <LevelScreen
          key={`${screen.id}-${screen.run}`}
          level={levels.find((l) => l.id === screen.id) ?? levels[0]}
          total={levels.length}
          maxLight={3 + Math.min(5, doneCount)}
          tutorial={doneCount === 0}
          audio={audio}
          muted={progress.audio.muted}
          onToggleMute={() => setAudio({ muted: !progress.audio.muted })}
          onSound={() => setPanel("sound")}
          onRetry={() => setScreen({ kind: "level", id: screen.id, run: Date.now() })}
          onNext={(id) => {
            const i = levels.findIndex((l) => l.id === id);
            const following = levels.slice(i + 1).find((l) => !getProgress().done.includes(l.id)) ?? levels[i + 1];
            if (following) setScreen({ kind: "level", id: following.id, run: Date.now() });
            else setScreen({ kind: "ending" });
          }}
          onEnding={() => setScreen({ kind: "ending" })}
          onChoir={() => setScreen({ kind: "choir" })}
          soundOpen={panel === "sound"}
        />
      )}

      {screen.kind === "ending" && <Ending count={doneCount} total={levels.length} onChoir={() => setScreen({ kind: "choir" })} />}

      {panel === "sound" && <SoundPanel settings={progress.audio} onChange={setAudio} onClose={() => setPanel(null)} />}
    </div>
  );
}

// ----- Title -----------------------------------------------------------------

function TitleScreen({
  primary,
  onChoir,
  onSound,
}: {
  primary: { label: string; onClick: () => void };
  onChoir: (() => void) | null;
  onSound: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isCoarse()) startRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="titulo-juego" aria-labelledby="titulo-juego">
      <Image src="/juego/portada.jpg" alt="" fill priority sizes="(min-aspect-ratio: 1/1) 60vw, 100vw" className="titulo-fondo" />
      <div className="titulo-velo" />
      <div className="titulo-contenido">
        <p className="titulo-sobre">Un juego dentro de Die Engel Singen</p>
        <h1 id="titulo-juego">La Voz</h1>
        <Adorno className="juego-adorno" />
        <p className="titulo-bajada">Las sombras se comieron los versos del libro. Vos sos lo único que quedó encendido.</p>
        <div className="titulo-acciones">
          <button ref={startRef} type="button" className="boton-juego boton-principal" onClick={primary.onClick}>
            {primary.label}
          </button>
          {onChoir && (
            <button type="button" className="boton-juego" onClick={onChoir}>
              Elegir página
            </button>
          )}
        </div>
        <p className="titulo-nota">
          <span className="solo-fino">Se juega con el teclado: flechas para caminar y Espacio para hablar o cantar.</span>
          <span className="solo-tactil">Se juega tocando la pantalla. Mejor con el sonido prendido.</span>
        </p>
        <div className="titulo-pie">
          <Link href="/" className="enlace-juego">
            Leer el libro
          </Link>
          <button type="button" className="enlace-juego" onClick={onSound}>
            Sonido
          </button>
        </div>
      </div>
    </section>
  );
}

// ----- Prologue --------------------------------------------------------------

function Prologue({ audio, onDone }: { audio: AudioEngine; onDone: () => void }) {
  const [i, setI] = useState(0);
  const advance = useCallback(() => {
    audio.ui();
    if (i < PROLOGUE.length - 1) setI(i + 1);
    else onDone();
  }, [audio, i, onDone]);

  useEffect(() => {
    audio.setRain(true);
    audio.startChoir(HUB_KEY, 1);
    return () => {
      audio.setRain(false);
      audio.stopChoir();
    };
  }, [audio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advance();
      } else if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, onDone]);

  return (
    <section className="prologo" onClick={advance} aria-live="polite">
      <p key={i} className="prologo-linea">
        {PROLOGUE[i]}
      </p>
      <p className="prologo-ayuda">
        <span className="solo-fino">Espacio para seguir</span>
        <span className="solo-tactil">Tocá para seguir</span>
      </p>
      <button
        type="button"
        className="enlace-juego prologo-saltar"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Saltar
      </button>
    </section>
  );
}

// ----- Choir (level select) --------------------------------------------------

function Choir({
  levels,
  done,
  isUnlocked,
  next,
  onPlay,
  onBack,
  onSound,
}: {
  levels: LevelSource[];
  done: string[];
  isUnlocked: (i: number) => boolean;
  next: LevelSource | null;
  onPlay: (id: string) => void;
  onBack: () => void;
  onSound: () => void;
}) {
  const count = levels.filter((l) => done.includes(l.id)).length;
  const lastDone = Math.max(-1, ...levels.map((l, i) => (done.includes(l.id) ? i : -1)));
  return (
    <section className="coro" aria-labelledby="titulo-coro">
      <header className="coro-cabecera">
        <button type="button" className="enlace-juego" onClick={onBack}>
          Volver
        </button>
        <button type="button" className="enlace-juego" onClick={onSound}>
          Sonido
        </button>
      </header>
      <h1 id="titulo-coro">El coro</h1>
      <Adorno className="juego-adorno" />
      <p className="coro-bajada">
        Cada página que rescatás le devuelve una voz al coro. {count === 0 ? "Todavía no canta nadie." : `Ya ${count === 1 ? "canta una voz" : `cantan ${count} voces`} de ${levels.length}.`}
      </p>
      {next && (
        <button type="button" className="boton-juego boton-principal coro-seguir" onClick={() => onPlay(next.id)}>
          {count ? `Seguir con «${next.indexName}»` : `Empezar con «${next.indexName}»`}
        </button>
      )}
      <ol className="coro-paginas">
        {levels.map((l, i) => {
          const rescued = done.includes(l.id);
          const open = isUnlocked(i);
          const fresh = open && !rescued && count > 0 && i > lastDone + 1;
          return (
            <li key={l.id}>
              <button
                type="button"
                className={`coro-pagina${rescued ? " rescatada" : ""}${open ? "" : " cerrada"}`}
                disabled={!open}
                onClick={() => onPlay(l.id)}
                style={{ "--tono": l.tone } as CSSProperties}
              >
                <span className="coro-miniatura">
                  <Image src={l.image} alt="" fill sizes="(max-width: 600px) 30vw, 140px" />
                </span>
                <span className="coro-numero">Página {l.number}</span>
                <span className="coro-nombre">{l.indexName}</span>
                <span className="coro-estado">
                  {rescued ? "Rescatada" : open ? (fresh ? "Nueva" : "Para rescatar") : "Rescatá la anterior"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ----- Level -----------------------------------------------------------------

function LevelScreen({
  level,
  total,
  maxLight,
  tutorial,
  audio,
  muted,
  onToggleMute,
  onSound,
  onRetry,
  onNext,
  onEnding,
  onChoir,
  soundOpen,
}: {
  level: LevelSource;
  total: number;
  maxLight: number;
  tutorial: boolean;
  audio: AudioEngine;
  muted: boolean;
  onToggleMute: () => void;
  onSound: () => void;
  onRetry: () => void;
  onNext: (id: string) => void;
  onEnding: () => void;
  onChoir: () => void;
  soundOpen: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [touch] = useState(isCoarse);
  const [engine] = useState(
    () =>
      new Engine({
        level,
        total,
        maxLight,
        audio,
        touch,
        tutorial,
        reducedMotion: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        onComplete: markDone,
      }),
  );
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [paused, setPaused] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    engine.attach(el);
    if (new URLSearchParams(window.location.search).has("prueba")) (window as unknown as { __laVoz: unknown }).__laVoz = engine.debug;
    return () => engine.detach();
  }, [engine]);

  useEffect(() => {
    engine.setPaused(paused || soundOpen);
  }, [engine, paused, soundOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const down = useRef<{ x: number; y: number } | null>(null);

  return (
    <section className="nivel" style={{ "--tono": level.tone } as CSSProperties} aria-label={`Página ${level.number}: ${level.name}`}>
      <div
        className="lienzo"
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12) engine.tap(e.clientX, e.clientY);
        }}
      >
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>

      {!ui.loading && !ui.error && !ui.reveal && !ui.battle && (
        <Hud ui={ui} muted={muted} onPause={() => setPaused(true)} onToggleMute={onToggleMute} />
      )}

      {ui.loading && (
        <div className="nivel-carga" role="status">
          <p>Abriendo «{level.name}»</p>
          <div className="aviso-barra" />
          <p className="nivel-carga-nota">Suele tardar un par de segundos.</p>
        </div>
      )}

      {ui.error && (
        <div className="nivel-carga" role="alert">
          <p>{ui.error}</p>
          <div className="titulo-acciones">
            <button type="button" className="boton-juego boton-principal" onClick={onRetry}>
              Probar de nuevo
            </button>
            <button type="button" className="boton-juego" onClick={onChoir}>
              Volver al coro
            </button>
          </div>
        </div>
      )}

      {ui.titleCard && (
        <div className="cartel" aria-live="polite">
          <p className="cartel-numero">
            Página {ui.titleCard.number} de {ui.titleCard.total}
          </p>
          <h1 className="cartel-titulo">{ui.titleCard.title}</h1>
          <Adorno className="juego-adorno" />
        </div>
      )}

      {ui.toast && (
        <p className="aviso-juego" role="status">
          {ui.toast}
        </p>
      )}

      {ui.dialogue && <Dialogue ui={ui} onNext={() => engine.pressA()} touch={touch} />}

      {ui.battle && <BattlePanel ui={ui} touch={touch} onA={() => engine.pressA()} onChoose={(i) => engine.choose(i)} />}

      {ui.blackout && (
        <div className="apagon" role="alert">
          <p>Tu luz se apagó.</p>
          <p className="apagon-nota">Volvés al último farol. Los versos que rescataste siguen con vos.</p>
        </div>
      )}

      {ui.reveal && (
        <div className="revelacion" role="dialog" aria-labelledby="revelacion-titulo">
          <p className="revelacion-sobre">Página rescatada</p>
          <h2 id="revelacion-titulo">{ui.reveal.title}</h2>
          <Adorno className="juego-adorno" />
          <div className="revelacion-significado">
            {ui.reveal.meaning.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
          <div className="titulo-acciones">
            {ui.reveal.last ? (
              <button type="button" className="boton-juego boton-principal" onClick={onEnding}>
                Escuchar el coro
              </button>
            ) : (
              <button type="button" className="boton-juego boton-principal" onClick={() => onNext(level.id)}>
                Siguiente página
              </button>
            )}
            <Link href={ui.reveal.route} className="boton-juego">
              Leerla en el libro
            </Link>
          </div>
          <div className="titulo-pie">
            <button type="button" className="enlace-juego" onClick={onChoir}>
              Volver al coro
            </button>
            <button
              type="button"
              className="enlace-juego"
              onClick={async () => setNote(await share(`Rescaté «${level.name}» en La Voz, el juego de Die Engel Singen.`, `/juego?nivel=${level.id}`))}
            >
              Compartir
            </button>
          </div>
          {note && <p className="revelacion-nota">{note}</p>}
        </div>
      )}

      {touch && !ui.loading && !ui.reveal && !ui.battle && !paused && <TouchControls engine={engine} />}

      {paused && !soundOpen && (
        <div className="pausa" role="dialog" aria-labelledby="pausa-titulo" data-game-menu>
          <div className="pausa-caja">
            <h2 id="pausa-titulo">Pausa</h2>
            <p className="pausa-dato">
              «{level.name}», {ui.verses} de {ui.totalVerses} versos.
            </p>
            <button type="button" className="boton-juego boton-principal" autoFocus onClick={() => setPaused(false)}>
              Seguir jugando
            </button>
            <button type="button" className="boton-juego" onClick={onSound}>
              Sonido
            </button>
            <button type="button" className="boton-juego" onClick={onChoir}>
              Volver al coro
            </button>
            <Link href={level.route} className="enlace-juego">
              Leer «{level.name}» en el libro
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function Hud({ ui, muted, onPause, onToggleMute }: { ui: UIState; muted: boolean; onPause: () => void; onToggleMute: () => void }) {
  return (
    <div className="hud">
      <button type="button" className="hud-boton" onClick={onPause} aria-label="Pausa">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14M16 5v14" />
        </svg>
      </button>
      <div className="hud-titulo">
        <span className="hud-nombre">{ui.title}</span>
        <span className="hud-datos">
          <span className="hud-versos" aria-label={`${ui.verses} de ${ui.totalVerses} versos`}>
            <svg viewBox="-8 -10 16 20" aria-hidden="true">
              <path d="M0 -9C-1 -2 -3 -1 -7 0C-3 1 -1 2 0 9C1 2 3 1 7 0C3 -1 1 -2 0 -9Z" />
            </svg>
            {ui.verses}/{ui.totalVerses}
          </span>
          <span className="hud-luz" aria-label={`Luz: ${ui.light} de ${ui.maxLight}`}>
            {Array.from({ length: ui.maxLight }, (_, i) => (
              <span key={i} className={i < ui.light ? "llama" : "llama apagada"} />
            ))}
          </span>
        </span>
      </div>
      <button type="button" className="hud-boton" onClick={onToggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"} aria-pressed={muted}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
        </svg>
      </button>
    </div>
  );
}

function Portrait({ speaker, image }: { speaker: Speaker; image?: string }) {
  const src = image ?? PORTRAITS[speaker];
  if (!src) return null;
  return (
    <span className={image ? "retrato retrato-figura" : "retrato"}>
      <Image src={src} alt="" fill sizes="96px" />
    </span>
  );
}

function Dialogue({ ui, onNext, touch }: { ui: UIState; onNext: () => void; touch: boolean }) {
  const d = ui.dialogue!;
  const shown = d.text.slice(0, d.visible);
  const rest = d.text.slice(d.visible);
  const render = (text: string) =>
    d.veiled
      ? [...text].map((ch, i) =>
          ch === "·" ? (
            <span key={i} className="velado">
              ·
            </span>
          ) : (
            ch
          ),
        )
      : text;

  if (d.speaker === "verse") {
    return (
      <div className="verso" onClick={onNext} role="dialog" aria-label={d.name}>
        <p className="verso-numero">{d.name}</p>
        <p className="verso-texto">
          {shown}
          <span className="pendiente" aria-hidden="true">
            {rest}
          </span>
        </p>
        <Adorno className="juego-adorno" />
        <p className="dialogo-seguir" aria-hidden={!d.complete}>
          {d.complete ? (touch ? "Tocá para seguir" : "Espacio para seguir") : ""}
        </p>
        <p className="solo-lectores" aria-live="polite">
          {d.complete ? d.text : ""}
        </p>
      </div>
    );
  }

  return (
    <div className={`dialogo dialogo-${d.speaker}`} onClick={onNext}>
      <Portrait speaker={d.speaker} image={d.portrait} />
      <div className="dialogo-cuerpo">
        {d.name && <p className="dialogo-nombre">{d.name}</p>}
        <p className="dialogo-texto">
          {render(shown)}
          <span className="pendiente" aria-hidden="true">
            {render(rest)}
          </span>
        </p>
      </div>
      {d.complete && <span className="dialogo-marca" aria-hidden="true" />}
      <p className="solo-lectores" aria-live="polite">
        {d.complete ? `${d.name ? `${d.name}: ` : ""}${d.veiled ? "El ángel habla, pero le faltan palabras." : d.text}` : ""}
      </p>
    </div>
  );
}

function BattlePanel({ ui, touch, onA, onChoose }: { ui: UIState; touch: boolean; onA: () => void; onChoose: (i: number) => void }) {
  const b = ui.battle!;
  const tapAnywhere = b.phase !== "menu" && b.phase !== "end";
  return (
    <>
      {tapAnywhere && <button type="button" className="toque-total" aria-label={b.hint || "Seguir"} onPointerDown={(e) => (e.preventDefault(), onA())} />}
      <div className="batalla-cabecera">
        <Portrait speaker={b.guardian ? "guardian" : "shadow"} />
        <div>
          <p className="batalla-nombre">{b.name}</p>
          <div className="batalla-barra" role="meter" aria-label="Oscuridad" aria-valuemin={0} aria-valuemax={b.maxHealth} aria-valuenow={b.health}>
            <span style={{ width: `${(b.health / b.maxHealth) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="batalla-panel" aria-live="polite">
        <div className="batalla-luz" aria-label={`Tu luz: ${ui.light} de ${ui.maxLight}`}>
          {Array.from({ length: ui.maxLight }, (_, i) => (
            <span key={i} className={i < ui.light ? "llama" : "llama apagada"} />
          ))}
        </div>
        <p className="batalla-texto">{b.text}</p>
        {b.hint && <p className="batalla-pista">{b.hint}</p>}
        {b.phase === "menu" && (
          <div className="batalla-opciones" role="menu">
            {b.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                className={`batalla-opcion${i === b.selected ? " elegida" : ""}${o.enabled ? "" : " inactiva"}`}
                aria-disabled={!o.enabled}
                onClick={() => onChoose(i)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {b.phase === "text" && <p className="dialogo-seguir">{touch ? "Tocá para seguir" : "Espacio para seguir"}</p>}
      </div>
    </>
  );
}

function TouchControls({ engine }: { engine: Engine }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<Dir | null>(null);

  const update = (e: ReactPointerEvent) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let next: Dir | null = null;
    if (Math.hypot(dx, dy) > 12) next = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    if (next !== dir) {
      setDir(next);
      engine.setPad(next);
    }
  };

  const release = () => {
    setDir(null);
    engine.setPad(null);
  };

  return (
    <div className="tactil">
      <div
        ref={padRef}
        className={`pad${dir ? ` pad-${dir}` : ""}`}
        role="group"
        aria-label="Caminar"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "touch") update(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="pad-centro" />
      </div>
      <button
        type="button"
        className="boton-a"
        aria-label="Hablar o cantar"
        onPointerDown={(e) => {
          e.preventDefault();
          engine.pressA();
        }}
      >
        <svg viewBox="-8 -10 16 20" aria-hidden="true">
          <path d="M0 -9C-1 -2 -3 -1 -7 0C-3 1 -1 2 0 9C1 2 3 1 7 0C3 -1 1 -2 0 -9Z" />
        </svg>
      </button>
    </div>
  );
}

// ----- Ending ----------------------------------------------------------------

function Ending({ count, total, onChoir }: { count: number; total: number; onChoir: () => void }) {
  const [note, setNote] = useState("");
  return (
    <section className="final" aria-labelledby="final-titulo">
      <Image src="/juego/angel.jpg" alt="" width={220} height={220} className="final-angel" />
      <h1 id="final-titulo">Los ángeles cantan.</h1>
      <Adorno className="juego-adorno" />
      <p>
        Rescataste {count} de {total} páginas. Cada verso volvió a su lugar, y el coro está completo.
      </p>
      <p className="final-nota">Cuando el libro sume una página nueva, va a aparecer en el coro con más versos para rescatar.</p>
      <div className="titulo-acciones">
        <Link href="/" className="boton-juego boton-principal">
          Leer el libro
        </Link>
        <button type="button" className="boton-juego" onClick={onChoir}>
          Volver al coro
        </button>
      </div>
      <button
        type="button"
        className="enlace-juego"
        onClick={async () => setNote(await share("Rescaté todos los poemas de Die Engel Singen en La Voz. Los ángeles cantan.", "/juego"))}
      >
        Compartir
      </button>
      {note && <p className="revelacion-nota">{note}</p>}
      <p className="final-firma">Die Engel Singen. Poemas de Fernando López.</p>
    </section>
  );
}

// ----- Sound -----------------------------------------------------------------

function SoundPanel({ settings, onChange, onClose }: { settings: AudioSettings; onChange: (c: Partial<AudioSettings>) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const slider = (key: "volume" | "music" | "effects", label: string) => (
    <label className="sonido-fila">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(settings[key] * 100)}
        onChange={(e) => onChange({ [key]: Number(e.target.value) / 100, muted: false })}
      />
      <output>{Math.round(settings[key] * 100)}</output>
    </label>
  );
  return (
    <div className="pausa" role="dialog" aria-labelledby="sonido-titulo" data-game-menu>
      <div className="pausa-caja" ref={ref}>
        <h2 id="sonido-titulo">Sonido</h2>
        {slider("volume", "Volumen")}
        {slider("music", "Música")}
        {slider("effects", "Efectos")}
        <label className="sonido-silencio">
          <input type="checkbox" checked={settings.muted} onChange={(e) => onChange({ muted: e.target.checked })} />
          <span>Silenciar todo</span>
        </label>
        <p className="pausa-dato">La tecla M silencia y vuelve a activar el sonido.</p>
        <button type="button" className="boton-juego boton-principal" onClick={onClose}>
          Listo
        </button>
      </div>
    </div>
  );
}

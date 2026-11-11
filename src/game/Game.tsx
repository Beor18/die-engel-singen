"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Adorno } from "@/experiencia/Adorno";
import { AudioEngine, MODES, type AudioSettings, type Key } from "./audio";
import { Engine } from "./engine";
import { GIFTS, carry, keepsakesOf, leave, marksOf, rankOf, type Keepsake } from "./keepsakes";
import { getProgress, getServerProgress, markDone, subscribeProgress, updateProgress, type Progress } from "./progress";
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

type Panel = null | "sound" | "chest";

const isCoarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const onFullscreenChange = (listener: () => void) => {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
};
const never = () => () => {};

/**
 * Full screen, for phones: lying on its side, a phone gives the game the height
 * the browser's bars were taking. Not every browser allows it (iPhones don't),
 * so `offered` says whether there is anything to offer.
 */
function useFullscreen() {
  const active = useSyncExternalStore(onFullscreenChange, () => Boolean(document.fullscreenElement), () => false);
  const offered = useSyncExternalStore(never, () => Boolean(document.fullscreenEnabled) && isCoarse(), () => false);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  };
  return { offered, active, toggle };
}

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
  const catalog = useMemo(() => keepsakesOf(levels), [levels]);

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
          onChest={progress.voice > 0 || progress.keepsakes.length ? () => setPanel("chest") : null}
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
          progress={progress}
          catalog={catalog}
          onChest={() => setPanel("chest")}
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
          catalog={catalog}
          progress={progress}
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
          onChest={() => setPanel("chest")}
          panelOpen={panel !== null}
        />
      )}

      {screen.kind === "ending" && <Ending count={doneCount} total={levels.length} onChoir={() => setScreen({ kind: "choir" })} />}

      {panel === "sound" && <SoundPanel settings={progress.audio} onChange={setAudio} onClose={() => setPanel(null)} />}
      {panel === "chest" && <Chest catalog={catalog} progress={progress} onClose={() => setPanel(null)} />}
    </div>
  );
}

// ----- Title -----------------------------------------------------------------

function TitleScreen({
  primary,
  onChoir,
  onSound,
  onChest,
}: {
  primary: { label: string; onClick: () => void };
  onChoir: (() => void) | null;
  onSound: () => void;
  onChest: (() => void) | null;
}) {
  const startRef = useRef<HTMLButtonElement>(null);
  const fullscreen = useFullscreen();
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
          {onChest && (
            <button type="button" className="enlace-juego" onClick={onChest}>
              Tu baúl
            </button>
          )}
          <button type="button" className="enlace-juego" onClick={onSound}>
            Sonido
          </button>
          {fullscreen.offered && (
            <button type="button" className="enlace-juego" onClick={fullscreen.toggle}>
              {fullscreen.active ? "Salir de pantalla completa" : "Pantalla completa"}
            </button>
          )}
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
  progress,
  catalog,
  isUnlocked,
  next,
  onPlay,
  onBack,
  onSound,
  onChest,
}: {
  levels: LevelSource[];
  progress: Progress;
  catalog: Keepsake[];
  onChest: () => void;
  isUnlocked: (i: number) => boolean;
  next: LevelSource | null;
  onPlay: (id: string) => void;
  onBack: () => void;
  onSound: () => void;
}) {
  const done = progress.done;
  const count = levels.filter((l) => done.includes(l.id)).length;
  const kept = catalog.filter((k) => progress.keepsakes.includes(k.id)).length;
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
      <div className="coro-voz">
        <VoiceMeter voice={progress.voice} />
        <button type="button" className="boton-juego coro-baul" onClick={onChest}>
          Abrir tu baúl
          <span className="coro-baul-cuenta">
            {kept} de {catalog.length} recuerdos
          </span>
        </button>
      </div>
      <p className="coro-marcas-nota">Cada página guarda tres marcas: rescatarla, encontrar su recuerdo y terminarla sin que tu luz se apague.</p>
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
                <Marks marks={marksOf(l.id, progress, catalog)} />
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
  catalog,
  progress,
  tutorial,
  audio,
  muted,
  onToggleMute,
  onSound,
  onRetry,
  onNext,
  onEnding,
  onChoir,
  onChest,
  panelOpen,
}: {
  level: LevelSource;
  total: number;
  catalog: Keepsake[];
  progress: Progress;
  tutorial: boolean;
  audio: AudioEngine;
  muted: boolean;
  onToggleMute: () => void;
  onSound: () => void;
  onRetry: () => void;
  onNext: (id: string) => void;
  onEnding: () => void;
  onChoir: () => void;
  onChest: () => void;
  /** A panel is open over the level: the sound or the chest. */
  panelOpen: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [touch] = useState(isCoarse);
  const [engine] = useState(
    () =>
      new Engine({
        level,
        total,
        catalog,
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
  const fullscreen = useFullscreen();

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    engine.attach(el);
    if (new URLSearchParams(window.location.search).has("prueba")) (window as unknown as { __laVoz: unknown }).__laVoz = engine.debug;
    return () => engine.detach();
  }, [engine]);

  useEffect(() => {
    engine.setPaused(paused || panelOpen);
  }, [engine, paused, panelOpen]);

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

      {!ui.loading && !ui.error && !ui.reveal && !ui.battle && !ui.found && (
        <Hud ui={ui} muted={muted} onPause={() => setPaused(true)} onToggleMute={onToggleMute} onChest={onChest} />
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

      {(ui.toast || (ui.chase && !ui.dialogue && !ui.battle)) && (
        <p className={`aviso-juego${ui.toast ? "" : " aviso-persecucion"}`} role="status">
          {ui.toast ?? "Una sombra tiene tu verso. Alcanzala."}
        </p>
      )}

      {ui.banner && (
        <div className="cartel-voz" role="status">
          <p className="cartel-voz-titulo">{ui.banner.title}</p>
          {ui.banner.text && <p className="cartel-voz-texto">{ui.banner.text}</p>}
        </div>
      )}

      {ui.found && (
        <div className="hallazgo" role="dialog" aria-labelledby="hallazgo-nombre" data-game-menu>
          <div className="hallazgo-caja">
            <p className="revelacion-sobre">Recuerdo nuevo, +{ui.found.voice} de voz</p>
            <span className="hallazgo-imagen">
              <Image src={ui.found.image} alt="" fill sizes="200px" />
            </span>
            <h2 id="hallazgo-nombre">{ui.found.name}</h2>
            <p className="hallazgo-linea">{ui.found.line}</p>
            <p className="hallazgo-don">
              <span>Mientras lo lleves</span>
              {ui.found.gift}
            </p>
            <p className="pausa-dato">
              {ui.found.carried ? "Ya lo llevás con vos." : "Quedó en tu baúl: no llevás más por ahora. Lo cambiás desde Pausa."} Tenés {ui.found.count} de {ui.found.total}.
            </p>
            <button type="button" className="boton-juego boton-principal" autoFocus onClick={() => engine.pressA()}>
              Guardarlo y seguir
            </button>
          </div>
        </div>
      )}

      {ui.dialogue && <Dialogue ui={ui} onNext={() => engine.pressA()} touch={touch} />}

      {ui.battle && <BattlePanel ui={ui} touch={touch} onA={() => engine.pressA()} onFlee={() => engine.flee()} />}

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
          <div className="cuenta">
            <p className="cuenta-total">
              +{ui.reveal.tally.total} de voz
              {ui.reveal.tally.grewTo && <span className="cuenta-rango">Tu voz creció: {ui.reveal.tally.grewTo}</span>}
            </p>
            <VoiceMeter voice={progress.voice} compact />
            <Marks marks={marksOf(level.id, progress, catalog)} labels />
            <details className="cuenta-detalle">
              <summary>Qué sumó en esta página</summary>
              <ul>
                {ui.reveal.tally.rows.map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <span>+{r.amount}</span>
                  </li>
                ))}
              </ul>
            </details>
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

      {paused && !panelOpen && (
        <div className="pausa" role="dialog" aria-labelledby="pausa-titulo" data-game-menu>
          <div className="pausa-caja pausa-menu">
            <h2 id="pausa-titulo">Pausa</h2>
            <p className="pausa-dato">
              «{level.name}», {ui.verses} de {ui.totalVerses} versos.
            </p>
            <VoiceMeter voice={progress.voice} />
            <button type="button" className="boton-juego boton-principal" autoFocus onClick={() => setPaused(false)}>
              Seguir jugando
            </button>
            <button type="button" className="boton-juego" onClick={onChest}>
              Tu baúl
            </button>
            <button type="button" className="boton-juego" onClick={onSound}>
              Sonido
            </button>
            {fullscreen.offered && (
              <button type="button" className="boton-juego" onClick={fullscreen.toggle}>
                {fullscreen.active ? "Salir de pantalla completa" : "Pantalla completa"}
              </button>
            )}
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

function Hud({
  ui,
  muted,
  onPause,
  onToggleMute,
  onChest,
}: {
  ui: UIState;
  muted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onChest: () => void;
}) {
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
          {ui.carried.length > 0 && (
            <button type="button" className="hud-recuerdos" onClick={onChest} aria-label={`Llevás: ${ui.carried.map((k) => k.name).join(", ")}. Abrir tu baúl`}>
              {ui.carried.map((k) => (
                <span key={k.id} className="hud-recuerdo">
                  <Image src={k.image} alt="" fill sizes="28px" />
                </span>
              ))}
            </button>
          )}
        </span>
        <span className="hud-voz" aria-label={`Tu voz: ${ui.voice.rank}`}>
          <span className="hud-voz-barra" style={{ "--avance": ui.voice.span ? ui.voice.into / ui.voice.span : 1 } as CSSProperties} />
          {ui.gain && (
            <span key={ui.gain.id} className="hud-ganancia">
              +{ui.gain.amount} de voz
            </span>
          )}
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

function BattlePanel({ ui, touch, onA, onFlee }: { ui: UIState; touch: boolean; onA: () => void; onFlee: () => void }) {
  const b = ui.battle!;
  const playing = b.phase === "rest" || b.phase === "call";
  return (
    <>
      {b.phase !== "end" && (
        <button
          type="button"
          className="toque-total"
          aria-label={b.phase === "call" ? "Cantar" : "Seguir"}
          onPointerDown={(e) => (e.preventDefault(), onA())}
        />
      )}
      {/* A duel: the shadow's name up on the left, the Voice's down on the right, the words below both. */}
      {b.phase !== "intro" && (
        <>
          <div className="batalla-cabecera">
            <p className="batalla-nombre">{b.name}</p>
            <div className="batalla-medida">
              <span aria-hidden="true">Oscuridad</span>
              <div className="batalla-barra" role="meter" aria-label="Oscuridad" aria-valuemin={0} aria-valuemax={b.maxHealth} aria-valuenow={b.health}>
                <span style={{ width: `${(b.health / b.maxHealth) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="batalla-pie">
            <div className="batalla-voz">
              <p className="batalla-nombre">
                La Voz
                <span className="batalla-rango">{ui.voice.rank}</span>
              </p>
              <div className="batalla-medida">
                <span aria-hidden="true">Luz</span>
                <div className="batalla-luz" role="meter" aria-label="Tu luz" aria-valuemin={0} aria-valuemax={ui.maxLight} aria-valuenow={ui.light}>
                  {Array.from({ length: ui.maxLight }, (_, i) => (
                    <span key={i} className={i < ui.light ? "llama" : "llama apagada"} />
                  ))}
                </div>
              </div>
            </div>
            <div className="batalla-panel">
              <div className="batalla-dicho" aria-live="polite">
                {b.text && <p className={b.verse ? "batalla-texto batalla-verso" : "batalla-texto"}>{b.text}</p>}
                {b.hint && <p className="batalla-pista">{b.hint}</p>}
              </div>
              {playing && (
                <div className="batalla-acciones">
                  <button type="button" className="batalla-accion batalla-cantar" tabIndex={-1} onPointerDown={(e) => (e.preventDefault(), onA())}>
                    {b.phase === "call" ? "Cantar" : "Seguir"}
                    {!touch && <span className="tecla">Espacio</span>}
                  </button>
                  {b.canFlee && (
                    <button type="button" className="batalla-accion batalla-huir" onClick={onFlee} aria-keyshortcuts="H">
                      Huir
                      {!touch && <span className="tecla">H</span>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
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

  // The controls go away for a battle or a pause: a direction still held must not stay pressed.
  useEffect(() => () => engine.setPad(null), [engine]);

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

// ----- Voice, marks and chest ------------------------------------------------

/** The rank of the voice and how far the next one is. `compact` says it in one line under the bar. */
function VoiceMeter({ voice, compact = false }: { voice: number; compact?: boolean }) {
  const rank = rankOf(voice);
  if (compact) {
    return (
      <div className="voz">
        <div className="voz-barra" style={{ "--avance": rank.span ? rank.into / rank.span : 1 } as CSSProperties} />
        <p className="voz-falta">
          {rank.name}. {rank.nextName ? `Faltan ${rank.span - rank.into} para ${rank.nextName}.` : "Es la voz más alta que hay."}
        </p>
      </div>
    );
  }
  return (
    <div className="voz">
      <p className="voz-rango">
        Tu voz: <strong>{rank.name}</strong>
      </p>
      <div className="voz-barra" style={{ "--avance": rank.span ? rank.into / rank.span : 1 } as CSSProperties} />
      <p className="voz-falta">{rank.nextName ? `Faltan ${rank.span - rank.into} para ${rank.nextName}.` : "Es la voz más alta que hay."}</p>
    </div>
  );
}

/** The three marks of a page. */
function Marks({ marks, labels = false }: { marks: ReturnType<typeof marksOf>; labels?: boolean }) {
  const list = [
    { on: marks.rescued, label: "Rescatada" },
    ...(marks.keepsake === null ? [] : [{ on: marks.keepsake, label: "Recuerdo" }]),
    { on: marks.clean, label: "Sin apagarte" },
  ];
  const got = list.filter((m) => m.on).length;
  return (
    <span className={labels ? "marcas marcas-nombres" : "marcas"} role="img" aria-label={`${got} de ${list.length} marcas: ${list.map((m) => `${m.label} ${m.on ? "sí" : "no"}`).join(", ")}`}>
      {list.map((m) => (
        <span key={m.label} className={m.on ? "marca" : "marca vacia"}>
          {labels && m.label}
        </span>
      ))}
    </span>
  );
}

function Chest({ catalog, progress, onClose }: { catalog: Keepsake[]; progress: Progress; onClose: () => void }) {
  const owned = (k: Keepsake) => progress.keepsakes.includes(k.id);
  const carried = (k: Keepsake) => progress.carrying.includes(k.id);
  const [picked, setPicked] = useState<string | null>(() => (catalog.find(carried) ?? catalog.find(owned))?.id ?? null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const rank = rankOf(progress.voice);
  const count = catalog.filter(owned).length;
  const carrying = catalog.filter(carried).length;
  const shown = catalog.find((k) => k.id === picked) ?? null;

  return (
    <div className="baul" role="dialog" aria-labelledby="baul-titulo" data-game-menu>
      <header className="coro-cabecera">
        <button ref={closeRef} type="button" className="enlace-juego" onClick={onClose}>
          Cerrar
        </button>
        <span className="baul-cuenta">
          {count} de {catalog.length} recuerdos
        </span>
      </header>
      <h2 id="baul-titulo">Tu baúl</h2>
      <Adorno className="juego-adorno" />
      <VoiceMeter voice={progress.voice} />
      <p className="baul-bajada">
        Cada página esconde un recuerdo. Los que llevás con vos te dan su don.{" "}
        {rank.slots === 1 ? "Por ahora podés llevar uno." : `Podés llevar ${rank.slots === 2 ? "dos" : "tres"}.`} Llevás {carrying}.
      </p>

      <div className="baul-ficha" aria-live="polite">
        {!shown && <p className="baul-vacio">Todavía no encontraste ninguno. Buscá en cada página algo que brille en el piso.</p>}
        {shown && owned(shown) && (
          <>
            <span className="baul-ficha-imagen">
              <Image src={shown.image} alt="" fill sizes="160px" />
            </span>
            <div className="baul-ficha-texto">
              <h3>{shown.name}</h3>
              <p className="baul-linea">{shown.line}</p>
              <p className="baul-don">{GIFTS[shown.gift]}</p>
              {carried(shown) ? (
                <button type="button" className="boton-juego" onClick={() => leave(shown.id)}>
                  Dejarlo en el baúl
                </button>
              ) : (
                <button type="button" className="boton-juego boton-principal" onClick={() => carry(shown.id)}>
                  {carrying >= rank.slots ? "Llevarlo en lugar de otro" : "Llevarlo con vos"}
                </button>
              )}
            </div>
          </>
        )}
        {shown && !owned(shown) && (
          <>
            <span className="baul-ficha-imagen baul-silueta">
              <Image src={shown.image} alt="" fill sizes="160px" />
            </span>
            <div className="baul-ficha-texto">
              <h3>Sin encontrar</h3>
              <p className="baul-linea">
                {shown.level ? `Está en la página ${shown.level.number}, «${shown.level.name}».` : "No está en ninguna página. Alguien se lo llevó corriendo."}
              </p>
            </div>
          </>
        )}
      </div>

      <ul className="baul-grilla">
        {catalog.map((k) => {
          const has = owned(k);
          return (
            <li key={k.id}>
              <button
                type="button"
                className={`baul-casilla${has ? "" : " falta"}${carried(k) ? " llevado" : ""}${picked === k.id ? " elegida" : ""}`}
                aria-pressed={picked === k.id}
                onClick={() => setPicked(k.id)}
              >
                <span className={has ? "baul-imagen" : "baul-imagen baul-silueta"}>
                  <Image src={k.image} alt="" fill sizes="(max-width: 600px) 30vw, 120px" />
                </span>
                <span className="baul-nombre">{has ? k.name : k.level ? `Página ${k.level.number}` : "¿Quién lo tiene?"}</span>
                {carried(k) && <span className="baul-etiqueta">Lo llevás</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
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

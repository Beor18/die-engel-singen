"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as EventoPuntero,
  type ReactNode,
} from "react";
import { PAGINAS, indiceDeRuta, type Pagina } from "@/contenido";
import { Adorno } from "./Adorno";
import type { Clima } from "./clima";
import { HojaCompartir, HojaIndice, HojaTexto } from "./Hojas";
import type { Vivo } from "./vivo";
import "./lector.css";

const TAMANOS_PAGINA = "(max-aspect-ratio: 9/16) 100vw, 56.25vh";
const DURACION_LAVADO = 1150;
const DURACION_LAVADO_RAPIDO = 520;

const estaLista = (img: HTMLImageElement | undefined): img is HTMLImageElement =>
  Boolean(img && img.complete && img.naturalWidth > 0);

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

function suscribirSistema(avisar: () => void) {
  const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

const CLAVE_QUIETO = "movimiento-quieto";
const avisosQuieto = new Set<() => void>();
let quietoGuardado: boolean | null = null;

function leerQuieto() {
  if (quietoGuardado === null) {
    try {
      quietoGuardado = localStorage.getItem(CLAVE_QUIETO) === "1";
    } catch {
      quietoGuardado = false;
    }
  }
  return quietoGuardado;
}

function cambiarQuieto(valor: boolean) {
  quietoGuardado = valor;
  try {
    if (valor) localStorage.setItem(CLAVE_QUIETO, "1");
    else localStorage.removeItem(CLAVE_QUIETO);
  } catch {
    // Sin almacenamiento, la elección dura hasta que se cierre la pestaña.
  }
  avisosQuieto.forEach((avisar) => avisar());
}

function suscribirQuieto(avisar: () => void) {
  avisosQuieto.add(avisar);
  return () => {
    avisosQuieto.delete(avisar);
  };
}

/** Lo que pide el dispositivo y lo que eligió quien lee con el botón del índice. */
function useMovimiento() {
  const sistema = useSyncExternalStore(
    suscribirSistema,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const quieto = useSyncExternalStore(suscribirQuieto, leerQuieto, () => false);
  return { sistema, quieto, reducido: sistema || quieto };
}

type Gesto = {
  x: number;
  y: number;
  t: number;
  id: number;
  /** Ya se confirmó que el dedo se mueve en vertical. */
  vertical: boolean;
  /** `true` si el dedo sube, o sea, si baja por el libro. */
  avanza: boolean;
  destino: number | null;
  /** El dedo lleva el lavado. Si es `false`, no hay WebGL o la imagen no está lista. */
  conLavado: boolean;
  progreso: number;
};

function Flecha({ sentido }: { sentido: "anterior" | "siguiente" }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <path
        d={sentido === "anterior" ? "M15 4 7 12l8 8" : "M9 4l8 8-8 8"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** La banda oscura, el adorno y el significado, con las medidas del libro. */
function Significado({ pagina }: { pagina: Pagina }) {
  const s = pagina.significado;
  if (!s || s.enLaImagen) return null;
  const estilo = { "--lineas": pagina.lineasSignificado.length } as CSSProperties;
  return (
    <div className="significado" data-banda={s.banda ?? "suave"} style={estilo}>
      <div className="significado-banda" />
      <Adorno className="adorno significado-adorno" />
      <p className="significado-texto">
        {pagina.lineasSignificado.map((linea, i) => (
          <span key={i}>{linea}</span>
        ))}
      </p>
    </div>
  );
}

export function Lector({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const router = useRouter();
  const indiceUrl = indiceDeRuta(ruta);
  const total = PAGINAS.length;
  const { sistema, quieto, reducido } = useMovimiento();

  // Página a la vista. Puede ir detrás de la URL mientras la siguiente termina de cargar.
  const [mostrada, setMostrada] = useState(indiceUrl);
  const [previa, setPrevia] = useState<number | null>(null);
  const [vecinas, setVecinas] = useState(false);
  const [listas, setListas] = useState<Record<number, boolean>>({});
  const [fallas, setFallas] = useState<Record<number, boolean>>({});
  const [intentos, setIntentos] = useState<Record<number, number>>({});
  const [demorada, setDemorada] = useState(false);
  const [controles, setControles] = useState(true);
  const [hoja, setHoja] = useState<"indice" | "compartir" | "texto" | null>(null);
  const [pista, setPista] = useState(false);

  const raiz = useRef<HTMLDivElement>(null);
  const escena = useRef<HTMLElement>(null);
  const marco = useRef<HTMLDivElement>(null);
  const lienzoVivo = useRef<HTMLCanvasElement>(null);
  const lienzoClima = useRef<HTMLCanvasElement>(null);
  const relampago = useRef<HTMLDivElement>(null);
  const imagenes = useRef(new Map<number, HTMLImageElement>());
  const vivo = useRef<Vivo | null>(null);
  const clima = useRef<Clima | null>(null);
  const mostradaRef = useRef(mostrada);
  const urlRef = useRef(indiceUrl);
  const ultimoPaso = useRef(Number.NEGATIVE_INFINITY);
  const gesto = useRef<Gesto | null>(null);
  const ampliada = useRef(false);
  const usandoTeclado = useRef(false);
  const [motorListo, setMotorListo] = useState(false);

  const pagina = PAGINAS[mostrada];
  const anterior = indiceUrl > 0 ? PAGINAS[indiceUrl - 1] : null;
  const siguiente = PAGINAS[(indiceUrl + 1) % total];
  const enPortada = pagina.tipo === "portada";
  const primerPoema = PAGINAS[(mostrada + 1) % total];

  const ir = useCallback(
    (i: number) => {
      const destino = PAGINAS[i];
      if (!destino || i === urlRef.current) return;
      // Se anota ya: la ruta tarda un instante y un segundo toque debe seguir desde acá.
      urlRef.current = i;
      router.push(destino.ruta, { scroll: false });
    },
    [router],
  );

  /** Deja `destino` como página a la vista. */
  const asentar = useCallback((origen: number, destino: number) => {
    clima.current?.definir(PAGINAS[destino].clima?.particulas, PAGINAS[destino].tono);
    mostradaRef.current = destino;
    setPrevia(origen);
    setMostrada(destino);
  }, []);

  /** Muestra la página `destino`: con lavado si se puede, y si no, con un fundido. */
  const transicionar = useCallback((destino: number) => {
    const origen = mostradaRef.current;
    if (origen === destino) return;
    const a = imagenes.current.get(origen);
    const b = imagenes.current.get(destino);
    const motor = vivo.current;

    if (motor) {
      const ahora = performance.now();
      const rapido = ahora - ultimoPaso.current < 900;
      ultimoPaso.current = ahora;
      const zonas = PAGINAS[destino].clima?.zonas;
      if (estaLista(a) && estaLista(b)) {
        // La primera carilla del lavado se dibuja acá, antes de cambiar la imagen de abajo.
        const dir = destino > origen ? 1 : -1;
        motor.lavar(a, b, dir, rapido ? DURACION_LAVADO_RAPIDO : DURACION_LAVADO, () => {
          if (mostradaRef.current === destino) motor.escena(b, zonas);
        });
      } else {
        motor.escena(estaLista(b) ? b : null, zonas);
      }
    }

    asentar(origen, destino);
  }, [asentar]);

  // La URL cambió: si la imagen ya está, pasamos; si no, espera su onLoad.
  // `complete` también vale para una imagen que ya falló: no va a avisar de nuevo,
  // así que se pasa igual para mostrar el aviso con Reintentar.
  useEffect(() => {
    urlRef.current = indiceUrl;
    if (indiceUrl !== mostradaRef.current && imagenes.current.get(indiceUrl)?.complete) {
      transicionar(indiceUrl);
    }
  }, [indiceUrl, transicionar]);

  // Si el control con foco desapareció al cambiar de página, el foco no vuelve al principio.
  useEffect(() => {
    if (
      usandoTeclado.current &&
      document.activeElement === document.body &&
      !document.querySelector("dialog[open]")
    ) {
      escena.current?.focus({ preventScroll: true });
    }
  }, [indiceUrl, mostrada]);

  useEffect(() => {
    const conTeclado = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "Enter" || e.key === " ") usandoTeclado.current = true;
    };
    const conPuntero = () => {
      usandoTeclado.current = false;
    };
    window.addEventListener("keydown", conTeclado);
    window.addEventListener("pointerdown", conPuntero);
    return () => {
      window.removeEventListener("keydown", conTeclado);
      window.removeEventListener("pointerdown", conPuntero);
    };
  }, []);

  // Con la página ampliada, el dedo tiene que poder recorrerla en cualquier dirección.
  useEffect(() => {
    const vista = window.visualViewport;
    if (!vista) return;
    const alCambiar = () => {
      ampliada.current = vista.scale > 1.05;
      if (escena.current) escena.current.style.touchAction = ampliada.current ? "auto" : "";
    };
    vista.addEventListener("resize", alCambiar);
    return () => vista.removeEventListener("resize", alCambiar);
  }, []);

  // Si la página pedida tarda, se avisa recién después de un rato.
  const esperandoPagina = indiceUrl !== mostrada;
  const primeraCarga = !listas[mostrada] && !fallas[mostrada];
  useEffect(() => {
    if (!esperandoPagina && !primeraCarga) return;
    const t = setTimeout(() => setDemorada(true), 700);
    return () => {
      clearTimeout(t);
      setDemorada(false);
    };
  }, [esperandoPagina, primeraCarga, indiceUrl]);

  const alCargar = useCallback(
    (i: number, img: HTMLImageElement) => {
      imagenes.current.set(i, img);
      setListas((prev) => (prev[i] ? prev : { ...prev, [i]: true }));
      setFallas((prev) => (prev[i] ? { ...prev, [i]: false } : prev));
      if (i === mostradaRef.current) {
        vivo.current?.escena(img, PAGINAS[i].clima?.zonas);
        setVecinas(true);
      } else if (i === urlRef.current) {
        transicionar(i);
      } else {
        // Se sube a la placa de video de antemano, para que el lavado arranque sin tirones.
        const preparar = () => vivo.current?.preparar(img);
        if ("requestIdleCallback" in window) window.requestIdleCallback(preparar, { timeout: 2000 });
        else setTimeout(preparar, 300);
      }
    },
    [transicionar],
  );

  const alFallar = useCallback(
    (i: number) => {
      setFallas((prev) => ({ ...prev, [i]: true }));
      if (i === urlRef.current && i !== mostradaRef.current) transicionar(i);
    },
    [transicionar],
  );

  // Motor visual: se carga aparte para no pesar en la primera pintura.
  useEffect(() => {
    if (reducido) return;
    let cancelado = false;
    const lienzoV = lienzoVivo.current;
    const lienzoC = lienzoClima.current;
    const m = marco.current;
    if (!lienzoV || !lienzoC || !m) return;
    let observador: ResizeObserver | undefined;
    let alRedimensionar: (() => void) | undefined;
    let alCambiarVisibilidad: (() => void) | undefined;
    let alMover: ((e: PointerEvent) => void) | undefined;

    Promise.all([import("./vivo"), import("./clima")])
      .then(([modVivo, modClima]) => {
        if (cancelado) return;
        try {
          const motor = new modVivo.Vivo(lienzoV);
          vivo.current = motor;
          observador = new ResizeObserver(([e]) => {
            motor.redimensionar(e.contentRect.width, e.contentRect.height);
          });
          observador.observe(m);
          const img = imagenes.current.get(mostradaRef.current);
          if (estaLista(img)) motor.escena(img, PAGINAS[mostradaRef.current].clima?.zonas);
          motor.iniciar();
        } catch {
          // Sin WebGL el libro se ve igual, con fundidos en lugar del lavado.
          vivo.current = null;
        }
        try {
          const particulas = new modClima.Clima(lienzoC);
          clima.current = particulas;
          const p = PAGINAS[mostradaRef.current];
          particulas.definir(p.clima?.particulas, p.tono);
          alRedimensionar = () => particulas.redimensionar();
          window.addEventListener("resize", alRedimensionar);
          alMover = (e) => {
            if (e.pointerType === "mouse") particulas.inclinar((e.clientX / window.innerWidth - 0.5) * 2);
          };
          window.addEventListener("pointermove", alMover, { passive: true });
        } catch {
          clima.current = null;
        }
        alCambiarVisibilidad = () => {
          if (document.hidden) {
            vivo.current?.detener();
            clima.current?.detener();
          } else {
            vivo.current?.iniciar();
            clima.current?.iniciar();
          }
        };
        document.addEventListener("visibilitychange", alCambiarVisibilidad);
        setMotorListo(true);
      })
      .catch(() => setMotorListo(true));

    return () => {
      cancelado = true;
      observador?.disconnect();
      if (alRedimensionar) window.removeEventListener("resize", alRedimensionar);
      if (alMover) window.removeEventListener("pointermove", alMover);
      if (alCambiarVisibilidad) document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      vivo.current?.destruir();
      clima.current?.destruir();
      vivo.current = null;
      clima.current = null;
      setMotorListo(false);
    };
  }, [reducido]);

  // Mientras haya una hoja abierta el clima queda tapado: no hace falta gastar en él.
  useEffect(() => {
    if (!motorListo) return;
    if (hoja) {
      vivo.current?.detener();
      clima.current?.detener();
    } else if (!document.hidden) {
      vivo.current?.iniciar();
      clima.current?.iniciar();
    }
  }, [hoja, motorListo]);

  // La apertura se puede saltar desde el primer instante, aunque la portada siga cargando.
  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains("apertura")) return;
    const saltar = () => html.classList.remove("apertura");
    window.addEventListener("pointerdown", saltar);
    window.addEventListener("keydown", saltar);
    return () => {
      window.removeEventListener("pointerdown", saltar);
      window.removeEventListener("keydown", saltar);
    };
  }, []);

  // Si la portada no carga, el aviso con Reintentar no puede quedar a oscuras.
  const portadaFallo = Boolean(fallas[0]);
  useEffect(() => {
    if (portadaFallo) document.documentElement.classList.remove("apertura");
  }, [portadaFallo]);

  // Apertura: negro, la estrella de la portada, un relámpago, y la portada detrás.
  const aperturaLista = motorListo && Boolean(listas[0]);
  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains("apertura")) return;
    if (reducido) {
      html.classList.remove("apertura");
      return;
    }
    if (!aperturaLista) return;

    const capa = marco.current?.querySelector<HTMLElement>('.capa[data-activa="true"]');
    const fondo = raiz.current?.querySelector<HTMLElement>(".fondo");
    const velo = marco.current?.querySelector<HTMLElement>(".apertura-velo");
    const capaViva = lienzoVivo.current;
    if (!capa || !fondo || !velo) {
      html.classList.remove("apertura");
      return;
    }

    let terminada = false;
    const animaciones: Animation[] = [];
    const terminar = () => {
      if (terminada) return;
      terminada = true;
      html.classList.remove("apertura");
      animaciones.forEach((a) => a.cancel());
      window.removeEventListener("pointerdown", terminar);
      window.removeEventListener("keydown", terminar);
    };
    window.addEventListener("pointerdown", terminar, { once: true });
    window.addEventListener("keydown", terminar, { once: true });

    const correr = (el: HTMLElement, cuadros: Keyframe[], opciones: KeyframeAnimationOptions) => {
      const a = el.animate(cuadros, { fill: "forwards", ...opciones });
      animaciones.push(a);
      return a;
    };

    (async () => {
      await esperar(Math.max(0, 1000 - performance.now()));
      if (terminada) return;
      // Primer relámpago: se ve todo un instante y vuelve la oscuridad.
      await correr(
        capa,
        [
          { opacity: 0, filter: "brightness(1)" },
          { opacity: 0.8, filter: "brightness(1.75)", offset: 0.22 },
          { opacity: 0, filter: "brightness(1)" },
        ],
        { duration: 280, easing: "ease-out" },
      ).finished.catch(() => undefined);
      if (terminada) return;
      await esperar(300);
      if (terminada) return;
      // Segundo relámpago: la portada ya no se va.
      correr(
        fondo,
        [{ opacity: 0 }, { opacity: 0.8, offset: 0.14 }, { opacity: 0.15, offset: 0.4 }, { opacity: 1 }],
        { duration: 2300, easing: "ease-out" },
      );
      correr(velo, [{ opacity: 1 }, { opacity: 0 }], { duration: 1700, easing: "ease-in", delay: 300 });
      // Las zonas vivas recién se suman cuando la imagen ya está firme debajo.
      if (capaViva) {
        correr(capaViva, [{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], { duration: 2300 });
      }
      await correr(
        capa,
        [
          { opacity: 0, filter: "brightness(1.9)" },
          { opacity: 0.95, filter: "brightness(1.55)", offset: 0.1 },
          { opacity: 0.32, filter: "brightness(1)", offset: 0.36 },
          { opacity: 1, filter: "brightness(1)" },
        ],
        { duration: 2300, easing: "ease-out" },
      ).finished.catch(() => undefined);
      terminar();
    })();

    return terminar;
  }, [aperturaLista, reducido]);

  // Teclado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (document.querySelector("dialog[open]")) return;
      const actual = urlRef.current;
      const sobreControl = (e.target as HTMLElement | null)?.closest("a,button,input");
      const adelante = () => ir((actual + 1) % PAGINAS.length);
      const atras = () => {
        if (actual > 0) ir(actual - 1);
      };
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          adelante();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          atras();
          break;
        case "Home":
          e.preventDefault();
          ir(0);
          break;
        case "End":
          e.preventDefault();
          ir(PAGINAS.length - 1);
          break;
        case " ":
          if (sobreControl) return;
          e.preventDefault();
          if (e.shiftKey) atras();
          else adelante();
          break;
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ir]);

  // Los controles se retiran solos cuando tapan la página (lo decide el CSS según la pantalla).
  useEffect(() => {
    if (!controles || hoja) return;
    const t = setTimeout(() => setControles(false), 4200);
    return () => clearTimeout(t);
  }, [controles, hoja, mostrada]);

  // Relámpagos suaves y espaciados, solo en los poemas de tormenta.
  const hayRelampagos = Boolean(pagina.clima?.relampagos) && !reducido;
  useEffect(() => {
    if (!hayRelampagos) return;
    let t: ReturnType<typeof setTimeout>;
    const programar = () => {
      t = setTimeout(() => {
        if (!document.hidden && !document.documentElement.classList.contains("apertura")) {
          relampago.current?.animate(
            [
              { opacity: 0 },
              { opacity: 0.55, offset: 0.08 },
              { opacity: 0.12, offset: 0.22 },
              { opacity: 0.38, offset: 0.32 },
              { opacity: 0 },
            ],
            { duration: 620, easing: "ease-out" },
          );
        }
        programar();
      }, 9000 + Math.random() * 14000);
    };
    programar();
    return () => clearTimeout(t);
  }, [hayRelampagos, mostrada]);

  // La pista de gestos aparece una sola vez, en el primer poema que se abre en un celular.
  useEffect(() => {
    if (enPortada || !window.matchMedia("(pointer: coarse)").matches) return;
    let yaVista = true;
    try {
      yaVista = localStorage.getItem("pista-vista") === "1";
      if (!yaVista) localStorage.setItem("pista-vista", "1");
    } catch {
      yaVista = false;
    }
    if (yaVista) return;
    const entra = setTimeout(() => setPista(true), 1400);
    const sale = setTimeout(() => setPista(false), 6000);
    return () => {
      clearTimeout(entra);
      clearTimeout(sale);
      setPista(false);
    };
  }, [enPortada]);

  // Gestos táctiles: se baja por el libro como por cualquier página. El lavado sigue al dedo
  // y solo se completa si se suelta pasado un tercio. Un toque solo muestra u oculta los controles.
  const limpiarArrastre = () => {
    marco.current?.style.removeProperty("--arrastre");
    marco.current?.style.removeProperty("--significado-alfa");
  };

  const cancelarGesto = () => {
    if (gesto.current?.conLavado) vivo.current?.soltarArrastre(false);
    gesto.current = null;
    limpiarArrastre();
  };

  const alTocar = (e: EventoPuntero<HTMLElement>) => {
    if (e.pointerType === "mouse") return;
    // Un segundo dedo es para ampliar, no para pasar de página.
    if (!e.isPrimary) {
      cancelarGesto();
      return;
    }
    // Sobre un control manda el control, salvo en la entrada: desde ahí también se puede deslizar.
    const control = (e.target as HTMLElement).closest("a,button");
    if (control && !control.classList.contains("entrar")) return;
    // Durante la apertura, un toque solo la salta. Con la página ampliada, el dedo la recorre.
    if (ampliada.current || document.documentElement.classList.contains("apertura")) return;
    gesto.current = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      id: e.pointerId,
      vertical: false,
      avanza: false,
      destino: null,
      conLavado: false,
      progreso: 0,
    };
  };

  const alMover = (e: EventoPuntero<HTMLElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y;

    if (!g.vertical) {
      if (Math.abs(dy) < 10 || Math.abs(dy) < Math.abs(e.clientX - g.x)) return;
      // Con una página todavía cargando no hay desde dónde arrastrar.
      if (mostradaRef.current !== urlRef.current) {
        gesto.current = null;
        return;
      }
      g.vertical = true;
      g.avanza = dy < 0;
      const actual = mostradaRef.current;
      const destino = g.avanza ? (actual + 1) % total : actual - 1;
      if (destino >= 0) {
        g.destino = destino;
        const a = imagenes.current.get(actual);
        const b = imagenes.current.get(destino);
        if (vivo.current && estaLista(a) && estaLista(b)) {
          g.conLavado = vivo.current.empezarArrastre(a, b, g.avanza ? -1 : 1);
        }
      }
      setControles(false);
      setPista(false);
    }

    const recorrido = Math.max(0, g.avanza ? -dy : dy);
    if (g.conLavado) {
      const alto = marco.current?.offsetHeight || window.innerHeight;
      g.progreso = Math.min(1, 0.1 + (0.9 * Math.max(0, recorrido - 10)) / (alto * 0.7));
      vivo.current?.moverArrastre(g.progreso);
      marco.current?.style.setProperty("--significado-alfa", String(Math.max(0, 1 - g.progreso * 2.4)));
    } else if (!reducido) {
      marco.current?.style.setProperty("--arrastre", `${(g.avanza ? -recorrido : recorrido) * 0.14}px`);
    }
  };

  const alSoltar = (e: EventoPuntero<HTMLElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    gesto.current = null;
    limpiarArrastre();
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const dt = performance.now() - g.t;

    if (!g.vertical) {
      const esEnlace = (e.target as HTMLElement).closest("a");
      if (!esEnlace && Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 400 && !ampliada.current) {
        setControles((v) => !v);
      }
      return;
    }

    const destino = g.destino;
    const recorrido = Math.max(0, g.avanza ? -dy : dy);
    const rapido = recorrido > 36 && recorrido / Math.max(dt, 1) > 0.45;
    const alcanza = g.conLavado ? g.progreso > 0.33 : recorrido > 64;

    if (destino === null || !(alcanza || rapido)) {
      if (g.conLavado) vivo.current?.soltarArrastre(false);
      return;
    }

    if (g.conLavado) {
      const origen = mostradaRef.current;
      const b = imagenes.current.get(destino);
      const zonas = PAGINAS[destino].clima?.zonas;
      const motor = vivo.current;
      motor?.soltarArrastre(true, () => {
        if (mostradaRef.current === destino && b) motor.escena(b, zonas);
      });
      asentar(origen, destino);
    }
    ir(destino);
  };

  const capas = new Set<number>([mostrada, indiceUrl]);
  if (vecinas) {
    capas.add((indiceUrl + 1) % total);
    if (indiceUrl > 0) capas.add(indiceUrl - 1);
  }

  // El aviso de cierre de <dialog> llega tarde: no debe cerrar otra hoja que ya se abrió.
  const cerrarHoja = (cual: NonNullable<typeof hoja>) => setHoja((actual) => (actual === cual ? null : actual));

  const estilo = { "--tono": pagina.tono } as CSSProperties;
  const fallaActual = Boolean(fallas[mostrada]);
  const reintentar = () => {
    setFallas((prev) => ({ ...prev, [mostrada]: false }));
    setIntentos((prev) => ({ ...prev, [mostrada]: (prev[mostrada] ?? 0) + 1 }));
  };

  return (
    <div
      ref={raiz}
      className="lector"
      style={estilo}
      data-quieto={quieto ? "true" : undefined}
      data-controles={controles || hoja ? "visibles" : "ocultos"}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse" && !controles) setControles(true);
      }}
    >
      <div className="fondo" aria-hidden="true">
        {previa !== null && previa !== mostrada ? (
          <Image
            key={PAGINAS[previa].id}
            className="fondo-imagen"
            src={PAGINAS[previa].imagen.src}
            alt=""
            fill
            sizes="128px"
            quality={60}
          />
        ) : null}
        <Image
          key={pagina.id}
          className="fondo-imagen fondo-nueva"
          src={pagina.imagen.src}
          alt=""
          fill
          sizes="128px"
          quality={60}
        />
      </div>

      <main
        ref={escena}
        tabIndex={-1}
        className="escena"
        onPointerDown={alTocar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={cancelarGesto}
      >
        <div ref={marco} className="marco">
          {[...capas].map((i) => {
            const p = PAGINAS[i];
            return (
              <div key={p.id} className="capa" data-activa={i === mostrada} data-lista={Boolean(listas[i])}>
                <Image
                  key={intentos[i] ?? 0}
                  ref={(img) => {
                    if (img) imagenes.current.set(i, img);
                  }}
                  src={p.imagen.src}
                  alt={p.imagen.alt}
                  fill
                  sizes={TAMANOS_PAGINA}
                  quality={86}
                  loading="eager"
                  fetchPriority={i === indiceUrl ? "high" : "low"}
                  onLoad={(e) => alCargar(i, e.currentTarget)}
                  onError={() => alFallar(i)}
                />
              </div>
            );
          })}

          {!reducido ? <canvas ref={lienzoVivo} className="vivo" aria-hidden="true" /> : null}

          <Significado key={pagina.id} pagina={pagina} />

          {enPortada ? (
            <Link href={primerPoema.ruta} scroll={false} className="entrar">
              Entrar al libro
            </Link>
          ) : null}

          <div className="apertura-velo" aria-hidden="true">
            <Adorno className="adorno apertura-adorno" />
          </div>

          {demorada && !fallaActual ? (
            <div className="espera" role="status">
              <div className="espera-barra" />
              <p>Cargando la página. Suele tardar 2 s.</p>
            </div>
          ) : null}

          {fallaActual ? (
            <div className="falla" role="alert">
              <p>No se pudo cargar esta página.</p>
              <div className="falla-acciones">
                <button type="button" className="boton-accion boton-principal" onClick={reintentar}>
                  Reintentar
                </button>
                <button type="button" className="boton-accion" onClick={() => setHoja("texto")}>
                  Leer el texto
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {children}
      </main>

      <div ref={relampago} className="relampago" aria-hidden="true" />

      {!reducido ? <canvas ref={lienzoClima} className="clima" aria-hidden="true" /> : null}

      <div className="progreso" role="img" aria-label={`Página ${mostrada + 1} de ${total}`}>
        {PAGINAS.map((p, i) => (
          <span key={p.id} className="progreso-marca" data-estado={i < mostrada ? "leida" : i === mostrada ? "actual" : "falta"} />
        ))}
      </div>

      <nav className="controles" aria-label="Recorrido del libro">
        {anterior ? (
          <Link
            href={anterior.ruta}
            scroll={false}
            className="flecha flecha-anterior"
            aria-label={`Página anterior: ${anterior.nombre}`}
          >
            <Flecha sentido="anterior" />
          </Link>
        ) : (
          <span className="flecha flecha-anterior" aria-hidden="true" />
        )}

        <button type="button" className="boton-texto control-indice" onClick={() => setHoja("indice")}>
          Índice
        </button>
        {!enPortada ? (
          <button type="button" className="boton-texto control-lectura" onClick={() => setHoja("texto")}>
            Texto
          </button>
        ) : null}
        <span className="numeral" aria-hidden="true">
          {mostrada + 1} / {total}
        </span>
        <button type="button" className="boton-texto control-compartir" onClick={() => setHoja("compartir")}>
          Compartir
        </button>

        {!enPortada ? (
          <Link
            href={siguiente.ruta}
            scroll={false}
            className="flecha flecha-siguiente"
            aria-label={
              indiceUrl === total - 1 ? "Volver a la portada" : `Página siguiente: ${siguiente.nombre}`
            }
          >
            <Flecha sentido="siguiente" />
          </Link>
        ) : (
          <span className="flecha flecha-siguiente" aria-hidden="true" />
        )}
      </nav>

      {pista ? (
        <p className="pista" aria-hidden="true">
          Deslizá hacia abajo para pasar de página
        </p>
      ) : null}

      <p className="solo-lectores" aria-live="polite">
        Página {indiceUrl + 1} de {total}: {PAGINAS[indiceUrl].nombre}
      </p>

      <HojaIndice abierta={hoja === "indice"} alCerrar={() => cerrarHoja("indice")} actual={mostrada}>
        {!sistema ? (
          <button type="button" className="boton-texto indice-movimiento" onClick={() => cambiarQuieto(!quieto)}>
            {quieto ? "Devolver el movimiento" : "Quitar el movimiento"}
          </button>
        ) : null}
      </HojaIndice>
      <HojaTexto abierta={hoja === "texto"} alCerrar={() => cerrarHoja("texto")} pagina={pagina} />
      <HojaCompartir abierta={hoja === "compartir"} alCerrar={() => cerrarHoja("compartir")} pagina={pagina} />
    </div>
  );
}

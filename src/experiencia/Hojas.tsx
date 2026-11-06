"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LIBRO, PAGINAS, type Pagina } from "@/contenido";
import { imagenParaHistoria, tituloParaCompartir } from "@/lib/metadatos";
import { Adorno } from "./Adorno";

/** Hoja modal sobre el libro. Foco, Escape y fondo inerte vienen de <dialog>. */
function Hoja({
  abierta,
  alCerrar,
  titulo,
  clase,
  cerrarDice = "Cerrar",
  children,
}: {
  abierta: boolean;
  alCerrar: () => void;
  titulo: string;
  clase: string;
  cerrarDice?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      className={`hoja ${clase}`}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
    >
      {abierta ? (
        <div className="hoja-cuerpo">
          <header className="hoja-cabecera">
            <h2 id={idTitulo}>{titulo}</h2>
            <button type="button" className="boton-texto" onClick={alCerrar}>
              {cerrarDice}
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function HojaIndice({
  abierta,
  alCerrar,
  actual,
  children,
}: {
  abierta: boolean;
  alCerrar: () => void;
  actual: number;
  children?: ReactNode;
}) {
  const [resaltada, setResaltada] = useState(actual);
  const [abiertaAntes, setAbiertaAntes] = useState(abierta);

  // Al abrir el índice, la vista previa arranca en la página donde estás.
  if (abierta !== abiertaAntes) {
    setAbiertaAntes(abierta);
    if (abierta) setResaltada(actual);
  }

  const vista = PAGINAS[resaltada] ?? PAGINAS[0];

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Índice" clase="hoja-indice">
      <div className="indice">
        <div>
          <ol className="indice-lista">
            {PAGINAS.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={p.ruta}
                  scroll={false}
                  className="indice-enlace"
                  aria-current={i === actual ? "page" : undefined}
                  onClick={alCerrar}
                  onMouseEnter={() => setResaltada(i)}
                  onFocus={() => setResaltada(i)}
                >
                  <span className="indice-miniatura">
                    <Image src={p.imagen.src} alt="" fill sizes="56px" quality={60} />
                  </span>
                  <span className="indice-nombre">{p.nombre}</span>
                </Link>
              </li>
            ))}
          </ol>
          {children}
        </div>
        <div className="indice-vista" aria-hidden="true">
          <Image
            key={vista.id}
            src={vista.imagen.src}
            alt=""
            fill
            sizes="(min-width: 1400px) 384px, 320px"
            quality={75}
          />
        </div>
      </div>
    </Hoja>
  );
}

export function HojaTexto({
  abierta,
  alCerrar,
  pagina,
}: {
  abierta: boolean;
  alCerrar: () => void;
  pagina: Pagina;
}) {
  return (
    <Hoja
      abierta={abierta}
      alCerrar={alCerrar}
      titulo={pagina.titulo ?? "Sin título"}
      clase="hoja-texto"
      cerrarDice="Volver a la página"
    >
      <article className="lectura">
        {pagina.estrofas.map((estrofa, i) => (
          <p key={i}>
            {estrofa.map((linea, j) => (
              <span key={j}>{linea}</span>
            ))}
          </p>
        ))}
        {pagina.lineasSignificado.length > 0 ? (
          <footer className="lectura-significado">
            <Adorno className="adorno" />
            <p>
              {pagina.lineasSignificado.map((linea, j) => (
                <span key={j}>{linea}</span>
              ))}
            </p>
          </footer>
        ) : null}
      </article>
    </Hoja>
  );
}

type Alcance = "poema" | "libro";

export function HojaCompartir({
  abierta,
  alCerrar,
  pagina,
}: {
  abierta: boolean;
  alCerrar: () => void;
  pagina: Pagina;
}) {
  const esPoema = pagina.tipo === "poema";
  const [alcance, setAlcance] = useState<Alcance>("poema");
  const [aviso, setAviso] = useState("");
  const [nativo, setNativo] = useState(false);
  const [conArchivos, setConArchivos] = useState(false);
  const [origen, setOrigen] = useState("");
  const [imagen, setImagen] = useState<{ id: string; archivo: File } | null>(null);
  const [imagenFallida, setImagenFallida] = useState("");

  useEffect(() => {
    if (!abierta) return;
    // Solo se puede saber en el navegador, y solo importa cuando se abre la hoja.
    /* eslint-disable react-hooks/set-state-in-effect */
    setNativo(typeof navigator.share === "function");
    setConArchivos(
      Boolean(navigator.canShare?.({ files: [new File([], "prueba.jpg", { type: "image/jpeg" })] })),
    );
    setOrigen(window.location.origin);
    setAviso("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [abierta]);

  const destino = esPoema && alcance === "poema" ? pagina : PAGINAS[0];
  const url = `${origen}${destino.ruta}`;
  const titulo = tituloParaCompartir(destino);
  const enlace = encodeURIComponent(url);
  const mensaje = encodeURIComponent(`${titulo}\n${url}`);
  const historia = imagenParaHistoria(destino);
  const preparando =
    abierta && conArchivos && imagen?.id !== destino.id && imagenFallida !== destino.id;

  // iOS exige que share() corra dentro del mismo toque, sin esperas en el medio:
  // por eso la imagen se trae antes, apenas se abre la hoja.
  useEffect(() => {
    if (!abierta || !conArchivos) return;
    const control = new AbortController();
    fetch(historia, { signal: control.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((datos) => {
        setImagen({
          id: destino.id,
          archivo: new File([datos], `${destino.id}.jpg`, { type: "image/jpeg" }),
        });
      })
      .catch((e: DOMException) => {
        if (e.name !== "AbortError") setImagenFallida(destino.id);
      });
    return () => control.abort();
  }, [abierta, conArchivos, historia, destino.id]);

  async function compartirNativo() {
    try {
      await navigator.share({ title: titulo, text: titulo, url });
    } catch {
      // Cerrar el menú del sistema también llega como error: no hay nada que avisar.
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Enlace copiado");
    } catch {
      setAviso(`No se pudo copiar. El enlace es ${url}`);
    }
  }

  function descargarImagen() {
    const a = document.createElement("a");
    a.href = historia;
    a.download = `${destino.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setAviso("Imagen descargada. Subila como historia desde el celular.");
  }

  async function imagenParaHistorias() {
    setAviso("");
    const archivo = imagen?.id === destino.id ? imagen.archivo : null;
    if (archivo && navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: titulo });
        return;
      } catch (e) {
        // Cerrar el menú del sistema no es un error. Cualquier otra cosa cae en la descarga.
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    descargarImagen();
  }

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Compartir" clase="hoja-compartir">
      {esPoema ? (
        <fieldset className="compartir-alcance">
          <legend className="solo-lectores">Qué querés compartir</legend>
          <label>
            <input
              type="radio"
              name="alcance"
              checked={alcance === "poema"}
              onChange={() => setAlcance("poema")}
            />
            <span>Este poema</span>
          </label>
          <label>
            <input
              type="radio"
              name="alcance"
              checked={alcance === "libro"}
              onChange={() => setAlcance("libro")}
            />
            <span>El libro</span>
          </label>
        </fieldset>
      ) : (
        <p className="compartir-que">
          {LIBRO.titulo} {LIBRO.subtitulo}
        </p>
      )}

      <div className="compartir-acciones">
        {nativo ? (
          <button type="button" className="boton-accion boton-principal" onClick={compartirNativo}>
            Compartir enlace
          </button>
        ) : null}
        <a
          className="boton-accion"
          href={`https://wa.me/?text=${mensaje}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        <a
          className="boton-accion"
          href={`https://www.facebook.com/sharer/sharer.php?u=${enlace}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
        <button type="button" className="boton-accion" onClick={copiar}>
          Copiar enlace
        </button>
        <button
          type="button"
          className="boton-accion"
          onClick={imagenParaHistorias}
          disabled={preparando}
        >
          {preparando ? "Preparando la imagen…" : "Imagen para Instagram"}
        </button>
      </div>

      <p className="compartir-aviso" role="status">
        {aviso}
      </p>
    </Hoja>
  );
}

import type { Metadata } from "next";
import { LIBRO, descripcionDe, type Pagina } from "@/contenido";
import { urlDelSitio } from "./sitio";

const LIBRO_COMPLETO = `${LIBRO.titulo} ${LIBRO.subtitulo}`;

export function imagenParaCompartir(p: Pagina) {
  return `/compartir/${p.id}.jpg`;
}

export function imagenParaHistoria(p: Pagina) {
  return `/historia/${p.id}.jpg`;
}

export function tituloParaCompartir(p: Pagina) {
  if (p.compartir?.titulo) return p.compartir.titulo;
  if (p.tipo === "portada") return `${LIBRO_COMPLETO}, de ${LIBRO.autor}`;
  return `${p.nombre}, de ${LIBRO.autor}`;
}

export const metadatosBase: Metadata = {
  metadataBase: new URL(urlDelSitio()),
  applicationName: LIBRO.titulo,
  authors: [{ name: LIBRO.autor }],
  creator: LIBRO.autor,
  title: {
    default: `${LIBRO_COMPLETO}, de ${LIBRO.autor}`,
    template: `%s | ${LIBRO.titulo}`,
  },
  description: LIBRO.descripcion,
  keywords: ["poemas", "poesía", "libro visual", LIBRO.titulo, LIBRO.autor],
  robots: { index: true, follow: true },
};

export function metadatosDePagina(p: Pagina): Metadata {
  const portada = p.tipo === "portada";
  const titulo = tituloParaCompartir(p);
  const descripcion = portada ? LIBRO.descripcion : descripcionDe(p);
  const imagen = {
    url: imagenParaCompartir(p),
    width: 1200,
    height: 630,
    alt: `${titulo}. ${p.imagen.alt}`,
    type: "image/jpeg",
  };

  return {
    title: portada ? { absolute: titulo } : p.nombre,
    description: descripcion,
    alternates: { canonical: p.ruta },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: p.ruta,
      siteName: LIBRO.titulo,
      locale: "es_AR",
      images: [imagen],
      ...(portada
        ? { type: "book" as const, authors: [LIBRO.autor] }
        : { type: "article" as const, authors: [LIBRO.autor] }),
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [imagen],
    },
  };
}

function autor() {
  return { "@type": "Person", name: LIBRO.autor };
}

/** Datos estructurados del libro, para los buscadores. */
export function datosDelLibro(paginas: Pagina[]) {
  const base = urlDelSitio();
  const portada = paginas[0];
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: LIBRO.titulo,
    alternateName: "Los ángeles cantan",
    description: LIBRO.descripcion,
    url: `${base}/`,
    image: `${base}${imagenParaCompartir(portada)}`,
    author: autor(),
    inLanguage: "es",
    genre: "Poesía",
    bookFormat: "https://schema.org/EBook",
    numberOfPages: paginas.length,
    hasPart: paginas
      .filter((p) => p.tipo === "poema")
      .map((p, i) => ({
        "@type": "CreativeWork",
        name: p.nombre,
        position: i + 1,
        url: `${base}${p.ruta}`,
      })),
  };
}

/** Datos estructurados de un poema. */
export function datosDelPoema(p: Pagina) {
  const base = urlDelSitio();
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: p.nombre,
    genre: "Poesía",
    url: `${base}${p.ruta}`,
    image: `${base}${imagenParaCompartir(p)}`,
    inLanguage: "es",
    author: autor(),
    text: p.estrofas.map((e) => e.join("\n")).join("\n\n"),
    isPartOf: { "@type": "Book", name: LIBRO.titulo, url: `${base}/` },
  };
}

/** Serializa datos estructurados sin permitir que cierren la etiqueta script. */
export function jsonLd(datos: unknown) {
  return { __html: JSON.stringify(datos).replace(/</g, "\\u003c") };
}

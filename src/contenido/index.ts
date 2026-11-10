import { PAGINAS_FUENTE } from "./libro";
import type { Pagina, PaginaFuente } from "./tipos";

export { LIBRO } from "./libro";
export type { Pagina, Particulas, Zona, Clima, Escena, ElementoEscena, Lugar, Movimiento, Don } from "./tipos";

const lineas = (texto: string) => texto.trim().split("\n").map((l) => l.trim());

function aEstrofas(texto: string): string[][] {
  return texto
    .trim()
    .split(/\n\s*\n/)
    .map(lineas);
}

function preparar(fuente: PaginaFuente): Pagina {
  const nombre = fuente.nombre ?? fuente.titulo;
  if (!nombre) {
    throw new Error(`La página "${fuente.id}" necesita "titulo" o "nombre".`);
  }
  return {
    ...fuente,
    ruta: fuente.tipo === "portada" ? "/" : `/poema/${fuente.id}`,
    nombre,
    nombreIndice: fuente.nombreEnIndice ?? nombre,
    estrofas: aEstrofas(fuente.texto),
    lineasSignificado: fuente.significado ? lineas(fuente.significado.texto) : [],
  };
}

function validar(paginas: Pagina[]) {
  const vistos = new Set<string>();
  const ordenes = new Set<number>();
  const recuerdos = new Set<string>();
  for (const p of paginas) {
    const suyos = (p.escena?.elementos ?? []).filter((e) => e.recuerdo);
    if (suyos.length > 1) throw new Error(`La página "${p.id}" tiene más de un recuerdo.`);
    for (const r of suyos) {
      if (!r.imagen || !r.levantar || !r.pasable) throw new Error(`El recuerdo de "${p.id}" necesita "imagen", "levantar" y "pasable".`);
      if (recuerdos.has(r.imagen)) throw new Error(`Hay dos recuerdos con la imagen "${r.imagen}".`);
      recuerdos.add(r.imagen);
    }
    if (vistos.has(p.id)) throw new Error(`Hay dos páginas con el id "${p.id}".`);
    if (ordenes.has(p.orden)) throw new Error(`Hay dos páginas con orden ${p.orden}.`);
    if (!/^[a-z0-9-]+$/.test(p.id)) {
      throw new Error(`El id "${p.id}" solo puede tener minúsculas, números y guiones.`);
    }
    vistos.add(p.id);
    ordenes.add(p.orden);
  }
  if (paginas[0]?.tipo !== "portada") {
    throw new Error("La primera página del libro tiene que ser la portada.");
  }
}

/** Todas las páginas, ya ordenadas. */
export const PAGINAS: Pagina[] = PAGINAS_FUENTE.map(preparar).sort((a, b) => a.orden - b.orden);

validar(PAGINAS);

export const POEMAS = PAGINAS.filter((p) => p.tipo === "poema");

export function paginaPorId(id: string) {
  return PAGINAS.find((p) => p.id === id);
}

/** Posición de una dirección en el libro. Lo que no se reconoce cae en la portada. */
export function indiceDeRuta(ruta: string) {
  const limpia = ruta.replace(/\/$/, "") || "/";
  const i = PAGINAS.findIndex((p) => p.ruta === limpia);
  return i < 0 ? 0 : i;
}

/** Primeras líneas del poema en un solo renglón, sin cortar palabras. */
export function descripcionDe(p: Pagina, maximo = 155) {
  if (p.compartir?.descripcion) return p.compartir.descripcion;
  const texto = p.estrofas.flat().join(" ");
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  return `${corte.slice(0, corte.lastIndexOf(" "))}…`;
}

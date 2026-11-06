// Genera los íconos del sitio a partir de la estrella del libro.
// Solo hace falta correrlo si cambia el diseño: node scripts/generar-iconos.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const raiz = process.cwd();
const FONDO = "#0b1318";
const ESTRELLA = "M0 -9C-1 -2 -3 -1 -7 0C-3 1 -1 2 0 9C1 2 3 1 7 0C3 -1 1 -2 0 -9Z";

/** @param {{ radio?: number, escala?: number }} o */
function svg({ radio = 0, escala = 40 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs><radialGradient id="r"><stop offset="0" stop-color="#d3213a" stop-opacity=".55"/><stop offset="1" stop-color="#d3213a" stop-opacity="0"/></radialGradient></defs>
  <rect width="1000" height="1000" rx="${radio}" fill="${FONDO}"/>
  <circle cx="500" cy="500" r="430" fill="url(#r)"/>
  <path transform="translate(500 500) scale(${escala})" d="${ESTRELLA}" fill="#f7f7f5"/>
</svg>`;
}

const png = (fuente, lado) => sharp(Buffer.from(fuente)).resize(lado, lado).png().toBuffer();

/** Un .ico con los PNG adentro, como admiten todos los navegadores actuales. */
function ico(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(imagenes.length, 4);
  const entradas = [];
  let desplazamiento = 6 + imagenes.length * 16;
  for (const { lado, datos } of imagenes) {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado === 256 ? 0 : lado, 0);
    e.writeUInt8(lado === 256 ? 0 : lado, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(datos.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    desplazamiento += datos.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.datos)]);
}

const app = path.join(raiz, "src/app");
const publico = path.join(raiz, "public/iconos");
await mkdir(publico, { recursive: true });

const redondeado = svg({ radio: 210, escala: 44 });
const pleno = svg({ escala: 40 });
const adaptable = svg({ escala: 28 });

await writeFile(path.join(app, "icon.svg"), redondeado);
await writeFile(path.join(app, "apple-icon.png"), await png(pleno, 180));
await writeFile(path.join(publico, "192.png"), await png(pleno, 192));
await writeFile(path.join(publico, "512.png"), await png(pleno, 512));
await writeFile(path.join(publico, "512-adaptable.png"), await png(adaptable, 512));

const lados = [16, 32, 48];
const imagenes = await Promise.all(lados.map(async (lado) => ({ lado, datos: await png(redondeado, lado) })));
await writeFile(path.join(app, "favicon.ico"), ico(imagenes));

console.log("Íconos generados");

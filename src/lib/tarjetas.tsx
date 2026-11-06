import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { LIBRO, type Pagina } from "@/contenido";

/**
 * Imágenes para compartir. Se generan una sola vez, al compilar, y salen en
 * JPEG: WhatsApp descarta las vistas previas demasiado pesadas y un PNG con
 * fotografía de fondo pasaría largamente ese límite.
 */

const NEGRO = "rgb(2,3,5)";

async function leerFuente(archivo: string) {
  return readFile(path.join(process.cwd(), "src/assets/fuentes", archivo));
}

async function fuentes() {
  const [titulo, texto, cursiva] = await Promise.all([
    leerFuente("LibreCaslonDisplay-Regular.ttf"),
    leerFuente("STIXTwoText-Regular.ttf"),
    leerFuente("STIXTwoText-Italic.ttf"),
  ]);
  return [
    { name: "Titulo", data: titulo, weight: 400 as const, style: "normal" as const },
    { name: "Texto", data: texto, weight: 400 as const, style: "normal" as const },
    { name: "Texto", data: cursiva, weight: 400 as const, style: "italic" as const },
  ];
}

function archivoDe(p: Pagina) {
  return path.join(process.cwd(), "public", p.imagen.src.replace(/^\//, ""));
}

function comoDato(buffer: Buffer) {
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function aJpeg(respuesta: ImageResponse, calidad: number) {
  const png = Buffer.from(await respuesta.arrayBuffer());
  return sharp(png).jpeg({ quality: calidad, mozjpeg: true }).toBuffer();
}

function Adorno({ ancho }: { ancho: number }) {
  return (
    <svg width={ancho} height={(ancho * 19) / 220} viewBox="160 -9.5 220 19">
      <path d="M160 0H258M282 0H380" stroke="rgb(240,240,237)" strokeWidth="0.65" fill="none" />
      <path
        d="M270 -9C269 -2 267 -1 263 0C267 1 269 2 270 9C271 2 273 1 277 0C273 -1 271 -2 270 -9Z"
        fill="rgb(247,247,245)"
      />
    </svg>
  );
}

function medidaDeTitulo(nombre: string) {
  if (nombre.length <= 8) return 118;
  if (nombre.length <= 12) return 94;
  if (nombre.length <= 18) return 78;
  return 60;
}

/** Tarjeta de 1200 x 630 para Open Graph y Twitter. */
export async function tarjetaSocial(p: Pagina): Promise<Buffer> {
  const original = archivoDe(p);
  const [fondo, pagina] = await Promise.all([
    sharp(original)
      .resize(1200, 630, { fit: "cover", position: "bottom" })
      .blur(16)
      .modulate({ brightness: 0.62, saturation: 1.15 })
      .jpeg({ quality: 70 })
      .toBuffer(),
    sharp(original).resize(668).jpeg({ quality: 86 }).toBuffer(),
  ]);

  const portada = p.tipo === "portada";
  const nombre = portada ? (p.titulo ?? LIBRO.titulo) : p.nombre;

  const respuesta = new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: NEGRO }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={comoDato(fondo)} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background:
              "linear-gradient(90deg, rgba(2,3,5,0.35) 0%, rgba(2,3,5,0.55) 45%, rgba(2,3,5,0.78) 100%)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          src={comoDato(pagina)}
          width={334}
          height={594}
          style={{
            position: "absolute",
            top: 18,
            left: 64,
            boxShadow: "0 24px 70px rgba(0,0,0,0.75)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 446,
            width: 700,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            color: "rgb(247,247,245)",
          }}
        >
          <div
            style={{
              fontFamily: "Titulo",
              fontSize: medidaDeTitulo(nombre),
              lineHeight: 1.04,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {nombre}
          </div>
          <div style={{ display: "flex", marginTop: 30, marginBottom: 26 }}>
            <Adorno ancho={330} />
          </div>
          {portada ? (
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Texto", fontSize: 36, lineHeight: 1.25 }}>
              <span>{LIBRO.subtitulo}</span>
              <span style={{ fontStyle: "italic", fontSize: 30, marginTop: 14 }}>{LIBRO.lema}</span>
              <span style={{ fontSize: 30, marginTop: 26 }}>{LIBRO.firma}</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Texto", fontSize: 34, lineHeight: 1.25 }}>
              <span>
                {LIBRO.titulo} {LIBRO.subtitulo}
              </span>
              <span style={{ fontStyle: "italic", marginTop: 10 }}>{LIBRO.firma}</span>
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await fuentes() },
  );

  return aJpeg(respuesta, 80);
}

/** La página completa en 1080 x 1920, lista para subir como historia. */
export async function tarjetaHistoria(p: Pagina): Promise<Buffer> {
  const imagen = await sharp(archivoDe(p))
    .resize(1080, 1920, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toBuffer();

  const significado = p.significado && !p.significado.enLaImagen ? p.lineasSignificado : [];
  const alfa = p.significado?.banda === "solida" ? 1 : 0.78;

  const respuesta = new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: "flex", position: "relative", background: NEGRO }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={comoDato(imagen)} width={1080} height={1920} style={{ position: "absolute", top: 0, left: 0 }} />
        {significado.length > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: 1080,
              height: 336,
              display: "flex",
              background: `linear-gradient(0deg, rgba(2,3,5,${alfa}) 0%, rgba(2,3,5,${alfa}) 78.5%, rgba(2,3,5,0) 100%)`,
            }}
          />
        ) : null}
        {significado.length > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 62,
              width: 1080,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "rgb(247,247,245)",
              fontFamily: "Texto",
              fontStyle: "italic",
              fontSize: 44,
              lineHeight: "50px",
            }}
          >
            <div style={{ display: "flex", marginBottom: 26 }}>
              <Adorno ancho={440} />
            </div>
            {significado.map((linea) => (
              <span key={linea}>{linea}</span>
            ))}
          </div>
        ) : null}
      </div>
    ),
    { width: 1080, height: 1920, fonts: await fuentes() },
  );

  return aJpeg(respuesta, 86);
}

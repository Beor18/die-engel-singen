import type { Metadata } from "next";
import { Suspense } from "react";
import { LIBRO, POEMAS } from "@/contenido";
import { Game } from "@/game/Game";
import type { LevelSource } from "@/game/types";

const TITLE = "La Voz, el juego";
const DESCRIPTION =
  "Un juego para rescatar los versos de Die Engel Singen, los poemas de Fernando López. Cada página del libro es un nivel: caminá adentro de la pintura, enfrentá a las sombras con tu canto y devolvele la voz al coro.";
const IMAGE = { url: "/juego/compartir.jpg", width: 1200, height: 630, alt: "La Voz, un juego dentro de Die Engel Singen", type: "image/jpeg" };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/juego" },
  openGraph: {
    title: `${TITLE} | ${LIBRO.titulo}`,
    description: DESCRIPTION,
    url: "/juego",
    siteName: LIBRO.titulo,
    locale: "es_AR",
    type: "website",
    images: [IMAGE],
  },
  twitter: { card: "summary_large_image", title: `${TITLE} | ${LIBRO.titulo}`, description: DESCRIPTION, images: [IMAGE] },
};

/** Every poem of the book becomes a level, in the book's order. */
const LEVELS: LevelSource[] = POEMAS.map((p, i) => ({
  id: p.id,
  number: i + 1,
  name: p.nombre,
  indexName: p.nombreIndice,
  route: p.ruta,
  image: p.imagen.src,
  alt: p.imagen.alt,
  stanzas: p.estrofas,
  meaning: p.lineasSignificado,
  tone: p.tono,
  weather: p.clima ?? {},
}));

export default function GamePage() {
  return (
    <Suspense fallback={<div className="aviso" />}>
      <Game levels={LEVELS} />
    </Suspense>
  );
}

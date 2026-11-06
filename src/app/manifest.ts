import type { MetadataRoute } from "next";
import { LIBRO } from "@/contenido";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${LIBRO.titulo} ${LIBRO.subtitulo}`,
    short_name: LIBRO.titulo,
    description: LIBRO.descripcion,
    lang: "es",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1318",
    theme_color: "#0b1318",
    icons: [
      { src: "/iconos/192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/512.png", sizes: "512x512", type: "image/png" },
      { src: "/iconos/512-adaptable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

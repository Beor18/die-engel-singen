import type { MetadataRoute } from "next";
import { PAGINAS } from "@/contenido";
import { imagenParaCompartir } from "@/lib/metadatos";
import { urlDelSitio } from "@/lib/sitio";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlDelSitio();
  const hoy = new Date();
  const paginas: MetadataRoute.Sitemap = PAGINAS.map((p) => ({
    url: `${base}${p.ruta}`,
    lastModified: hoy,
    changeFrequency: "monthly",
    priority: p.tipo === "portada" ? 1 : 0.8,
    images: [`${base}${imagenParaCompartir(p)}`],
  }));
  return [
    ...paginas,
    { url: `${base}/juego`, lastModified: hoy, changeFrequency: "monthly", priority: 0.7, images: [`${base}/juego/compartir.jpg`] },
  ];
}

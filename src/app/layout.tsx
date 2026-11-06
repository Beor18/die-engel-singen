import { Analytics } from "@vercel/analytics/next";
import type { Viewport } from "next";
import { Libre_Caslon_Display, STIX_Two_Text } from "next/font/google";
import type { ReactNode } from "react";
import { PAGINAS } from "@/contenido";
import { datosDelLibro, jsonLd, metadatosBase } from "@/lib/metadatos";
import "./globals.css";

// La misma familia que usa el PDF para los significados.
const texto = STIX_Two_Text({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--f-texto",
  display: "swap",
});

// Muy parecida a la de los títulos dentro de las imágenes.
const titulo = Libre_Caslon_Display({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--f-titulo",
  display: "swap",
  preload: false,
});

export const metadata = metadatosBase;

export const viewport: Viewport = {
  themeColor: "#0b1318",
  colorScheme: "dark",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

// Antes de la primera pintura, para que la apertura arranque en negro. Sin JavaScript,
// con movimiento reducido o con el movimiento quitado, la portada se ve directamente.
const AL_INICIAR = `(function(){var h=document.documentElement;h.classList.add('js');try{if(location.pathname==='/'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&localStorage.getItem('movimiento-quieto')!=='1'){h.classList.add('apertura');setTimeout(function(){h.classList.remove('apertura')},9000)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: AL_INICIAR }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(datosDelLibro(PAGINAS))} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

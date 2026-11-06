import { PAGINAS } from "@/contenido";
import { ArticuloPagina } from "@/experiencia/ArticuloPagina";
import { metadatosDePagina } from "@/lib/metadatos";

const portada = PAGINAS[0];

export const metadata = metadatosDePagina(portada);

export default function Portada() {
  return <ArticuloPagina pagina={portada} />;
}

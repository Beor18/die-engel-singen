import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { POEMAS, paginaPorId } from "@/contenido";
import { ArticuloPagina } from "@/experiencia/ArticuloPagina";
import { datosDelPoema, jsonLd, metadatosDePagina } from "@/lib/metadatos";

type Props = { params: Promise<{ id: string }> };

// Solo existen las páginas del libro. Se generan todas al compilar.
export const dynamicParams = false;

export function generateStaticParams() {
  return POEMAS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pagina = paginaPorId(id);
  return pagina ? metadatosDePagina(pagina) : {};
}

export default async function Poema({ params }: Props) {
  const { id } = await params;
  const pagina = paginaPorId(id);
  if (!pagina || pagina.tipo !== "poema") notFound();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(datosDelPoema(pagina))} />
      <ArticuloPagina pagina={pagina} />
    </>
  );
}

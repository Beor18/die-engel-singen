import { PAGINAS, paginaPorId } from "@/contenido";
import { tarjetaHistoria } from "@/lib/tarjetas";

type Contexto = { params: Promise<{ archivo: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return PAGINAS.map((p) => ({ archivo: `${p.id}.jpg` }));
}

/** La página completa en 1080 x 1920, para subir como historia a Instagram. */
export async function GET(_: Request, { params }: Contexto) {
  const { archivo } = await params;
  const pagina = paginaPorId(archivo.replace(/\.jpg$/, ""));
  if (!pagina) return new Response("No existe", { status: 404 });

  const imagen = await tarjetaHistoria(pagina);
  return new Response(new Uint8Array(imagen), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(imagen.length),
      "Cache-Control": "public, max-age=86400, s-maxage=31536000",
    },
  });
}

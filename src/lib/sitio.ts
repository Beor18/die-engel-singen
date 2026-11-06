/**
 * Dirección pública del sitio, usada en todas las URL absolutas.
 *
 * Para un dominio propio, definí NEXT_PUBLIC_SITE_URL en Vercel
 * (por ejemplo https://dieengelsingen.com) y volvé a publicar.
 * Sin esa variable se usa el dominio de producción que informa Vercel.
 */
export function urlDelSitio(): string {
  const propia = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (propia) return propia.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

import type { ReactNode } from "react";
import { Lector } from "@/experiencia/Lector";

/**
 * El lector vive en este layout, que no se vuelve a montar al navegar: por eso
 * la lluvia sigue cayendo y una página puede lavarse para dar paso a la otra.
 * Cada ruta solo aporta su texto y sus metadatos.
 */
export default function LayoutLibro({ children }: { children: ReactNode }) {
  return <Lector>{children}</Lector>;
}

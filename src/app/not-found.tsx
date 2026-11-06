import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false },
};

export default function NoEncontrada() {
  return (
    <main className="aviso">
      <h1>Esta página no está en el libro.</h1>
      <p>Puede que el enlace esté incompleto. El libro completo sigue en la portada.</p>
      <Link className="aviso-accion" href="/">
        Ir a la portada
      </Link>
    </main>
  );
}

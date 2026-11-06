"use client";

export default function ErrorDePagina({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="aviso">
      <h1>No se pudo abrir esta página.</h1>
      <p>Probá de nuevo. Si sigue igual, recargá el sitio.</p>
      <button type="button" className="aviso-accion" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}

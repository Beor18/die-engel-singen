import { LIBRO, type Pagina } from "@/contenido";

/**
 * El texto de la página como HTML real: lo leen los lectores de pantalla y los
 * buscadores. No se ve porque ya está integrado en la imagen.
 */
export function ArticuloPagina({ pagina }: { pagina: Pagina }) {
  const portada = pagina.tipo === "portada";
  return (
    <article className="solo-lectores">
      <h1 lang={portada ? "de" : undefined}>{portada ? LIBRO.titulo : pagina.nombre}</h1>
      {pagina.estrofas.map((estrofa, i) => (
        <p key={i}>
          {estrofa.map((linea, j) => (
            <span key={j}>
              {linea}
              <br />
            </span>
          ))}
        </p>
      ))}
      {pagina.lineasSignificado.length > 0 ? (
        <p>
          <em>{pagina.lineasSignificado.join(" ")}</em>
        </p>
      ) : null}
    </article>
  );
}

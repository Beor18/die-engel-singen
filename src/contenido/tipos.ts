/**
 * Tipos del contenido del libro.
 * Para agregar una página solo hace falta tocar `libro.ts`: ver README.
 */

export type TipoParticula = "lluvia" | "petalos" | "polen" | "confeti";

export type Particulas = {
  tipo: TipoParticula;
  /** Multiplica la cantidad base. 1 por defecto. */
  cantidad?: number;
};

/**
 * Una zona "viva" de la imagen. Las coordenadas van de 0 a 1 respecto de la
 * página, con el origen arriba a la izquierda. Nunca pongas una zona de `agua`,
 * `viento` o `nube` sobre texto integrado en la imagen: lo deformaría.
 */
export type Zona = {
  tipo: "agua" | "niebla" | "luz" | "viento" | "humo" | "centelleo" | "nube";
  x: number;
  y: number;
  /** Radio horizontal y vertical de la zona. */
  rx: number;
  ry: number;
  /** Intensidad del efecto. 1 por defecto. */
  fuerza?: number;
  /** Velocidad del efecto. 1 por defecto. */
  velocidad?: number;
  /** Solo para `niebla`, `luz` y `humo`. */
  color?: string;
};

export type Clima = {
  particulas?: Particulas[];
  /** Relámpagos suaves y espaciados. */
  relampagos?: boolean;
  zonas?: Zona[];
};

export type PaginaFuente = {
  /** Identificador único: es también la dirección, /poema/<id>. */
  id: string;
  /** Posición en el libro. Las páginas se ordenan solas por este número. */
  orden: number;
  tipo: "portada" | "poema";
  /** Título tal como aparece en la página, o `null` si no tiene. */
  titulo: string | null;
  /** Nombre de la página en la pestaña y al compartir. Hace falta si `titulo` es `null`. */
  nombre?: string;
  /** Nombre solo para el índice, si tiene que ser distinto de los anteriores. */
  nombreEnIndice?: string;
  imagen: {
    /** Archivo dentro de /public, en formato vertical 9:16. */
    src: string;
    /** Qué se ve en la imagen, para quien no puede verla. */
    alt: string;
  };
  /**
   * Texto de la página, copiado tal cual. Los saltos de línea se respetan y una
   * línea en blanco separa estrofas. Si está integrado en la imagen, no se
   * dibuja encima: alimenta al modo de lectura, a los buscadores y a los
   * lectores de pantalla.
   */
  texto: string;
  significado?: {
    /** Copiado tal cual, con los mismos saltos de línea que en el libro. */
    texto: string;
    /** `true` si ya está en la imagen, para no dibujarlo dos veces. */
    enLaImagen?: boolean;
    /** Banda oscura detrás del significado. `suave` por defecto. */
    banda?: "suave" | "solida";
  };
  /** Color de acento de la página. */
  tono: string;
  /** Datos para compartir. Si faltan, se arman solos con el título y el texto. */
  compartir?: {
    titulo?: string;
    descripcion?: string;
  };
  clima?: Clima;
};

export type Pagina = PaginaFuente & {
  /** Dirección de la página dentro del sitio. */
  ruta: string;
  /** Nombre en la pestaña, al compartir y para lectores de pantalla. */
  nombre: string;
  /** Nombre en el índice. */
  nombreIndice: string;
  /** Estrofas, cada una con sus líneas. */
  estrofas: string[][];
  /** Líneas del significado, vacío si la página no tiene. */
  lineasSignificado: string[];
};

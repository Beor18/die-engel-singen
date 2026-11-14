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

/** Qué clase de lugar muestra la ilustración. En el juego define el piso y las paredes. */
export type Lugar = "campo" | "camino" | "calle" | "salon" | "cuarto" | "teatro" | "pasillo";

/** Cómo se mueve un elemento de la escena en el juego. `respira` por defecto en las personas. */
export type Movimiento =
  | "respira"
  /** No se mueve nada: alguien inmóvil o un objeto. */
  | "quieto"
  /** Sale humo de `humo`, como de un cigarrillo. */
  | "fuma"
  /** Sale vapor de `humo`, como de una taza. */
  | "vapor"
  /** Se aleja caminando hasta `hasta`, se pierde y vuelve a empezar. */
  | "seAleja"
  /** Igual que `seAleja`, pero corriendo. */
  | "corre"
  | "baila"
  | "aplaude"
  /** Cuelga de hilos rojos, como una marioneta. */
  | "marioneta"
  /** Se mece con el viento. */
  | "viento"
  /** Se acerca a `hasta` a medida que encontrás versos. */
  | "seAcerca"
  /** Su luz titila, como un neón. */
  | "titila"
  /** Una luz sin imagen que da vueltas, como las de una fiesta. */
  | "gira"
  /** Su llama tiembla. */
  | "llama"
  /** Un espejo: muestra a la Voz cuando se para delante. `vidrio` dice dónde está el vidrio. */
  | "refleja"
  /** Una sombra pegada a la pared, que apenas se mueve. */
  | "sombra"
  /** Brilla cada tanto, como algo mojado. */
  | "brilla";

/**
 * Lo que hace un recuerdo cuando la Voz lo lleva encima. El juego explica cada
 * don con sus palabras en `src/game/keepsakes.ts`.
 */
export type Don =
  /** Los versos brillan a través de la oscuridad. */
  | "destello"
  /** La penumbra embosca la mitad de las veces. */
  | "suerte"
  /** Más margen para responder cada nota. */
  | "pausa"
  /** Los versos se levantan desde una casilla de distancia. */
  | "iman"
  /** La Voz camina más rápido. */
  | "paso"
  /** Las sombras la ven desde más cerca. */
  | "sigilo"
  /** La sombra que le saca luz pierde fuerza. */
  | "espina"
  /** Gana un cuarto más de voz. */
  | "gloria"
  /** El primer golpe de cada batalla no saca luz. */
  | "aguante"
  /** Cada verso rescatado devuelve una llama. */
  | "brindis"
  /** Ve más lejos en la oscuridad. */
  | "mirada"
  /** Una vez por página, si la luz se apaga, vuelve a encenderse ahí mismo. */
  | "despertar"
  /** Al cantar, un hilo de luz marca el verso más cercano. */
  | "hilo"
  /** Cada nota justa pega doble. */
  | "reflejo"
  /** Una llama más. */
  | "llama"
  /** El guardián del título empieza más débil. */
  | "sello"
  /** El canto llega más lejos y aturde el doble. */
  | "mando"
  /** Las frases de las sombras traen una nota menos. */
  | "compas"
  /** Las notas de las sombras llegan más despacio. */
  | "despacio"
  /** Cada batalla empieza con un golpe de la Voz. */
  | "frente"
  /** Cada verso rescatado hace sonar una campana que aturde a las sombras cercanas. */
  | "repique"
  /** Con una sola llama encendida, cada nota respondida pega doble. */
  | "ardor"
  /** La sombra de la que la Voz se escapa se pierde entre el público y no vuelve. */
  | "salida";

/** Un personaje u objeto de la ilustración que aparece dentro del nivel. */
export type ElementoEscena = {
  /** Imagen en /public/juego/escenas, sin la extensión. Sin imagen, es solo una luz. */
  imagen?: string;
  /** Cómo se llama en el diálogo. */
  nombre: string;
  /** Si es una persona, habla ella; si no, lo describe el narrador. */
  persona?: boolean;
  /** Dónde está en la ilustración, de 0 a 1 como las zonas del clima. */
  x: number;
  y: number;
  /** Alto en casillas del juego. La Voz mide 1,75. */
  alto?: number;
  /** Cuántas casillas ocupa de ancho. 1 por defecto. */
  ancho?: number;
  /** Se puede pasar por encima, como una llave en el piso o el pasto. */
  pasable?: boolean;
  /** Dar vuelta la imagen. */
  espejado?: boolean;
  mueve?: Movimiento;
  /** Adónde va con `seAleja`, `corre` y `seAcerca`, en coordenadas de la ilustración. */
  hasta?: { x: number; y: number };
  /** La luz que da: color, alcance en casillas y a qué altura de la imagen nace (0 abajo, 1 arriba). */
  luz?: { color: string; alcance: number; altura?: number };
  /** De dónde sale el humo o el vapor, de 0 a 1 sobre la imagen. */
  humo?: { x: number; y: number };
  /** Para `refleja`: el vidrio del espejo, de 0 a 1 sobre la imagen. */
  vidrio?: { x: number; y: number; ancho: number; alto: number };
  /** Copias desparramadas por el nivel, además de esta. Las copias no se pueden mirar. */
  copias?: number;
  /** Se levanta al pisarlo y queda guardado, como una llave. */
  levantar?: boolean;
  /**
   * Es el recuerdo de la página: al levantarlo queda para siempre en el baúl y,
   * si la Voz lo lleva, le da este don. Uno solo por página, con `levantar`,
   * `pasable` e imagen propia (su nombre no se puede repetir en otra página).
   */
  recuerdo?: Don;
  /** Lo que dice si es una persona, o lo que se ve al mirarlo. Vacío: no se puede mirar. */
  dice: string[];
  /** Lo que se dice en cambio si la Voz ya levantó el elemento con esa imagen. */
  conObjeto?: { imagen: string; dice: string[] };
};

/** Lo que muestra la ilustración, para que el juego lo ponga dentro del nivel. */
export type Escena = {
  lugar: Lugar;
  elementos: ElementoEscena[];
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
  /** Personajes y objetos de la ilustración que aparecen en el juego. */
  escena?: Escena;
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

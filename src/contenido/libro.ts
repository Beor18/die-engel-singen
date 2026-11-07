import type { PaginaFuente } from "./tipos";

/**
 * EL LIBRO
 *
 * Este es el único archivo que hay que tocar para agregar o cambiar páginas.
 * El índice, la navegación, las direcciones, el sitemap y las imágenes para
 * compartir se arman solos a partir de esta lista. Ver README para un ejemplo.
 *
 * Los textos son copia literal del PDF, incluidas sus particularidades. No los
 * corrijas acá salvo que la corrección también esté en el libro.
 */

export const LIBRO = {
  titulo: "Die Engel Singen",
  subtitulo: "(Los ángeles cantan)",
  lema: "Palabras que nacen donde termina el silencio.",
  autor: "Fernando López",
  firma: "Por Fernando López",
  descripcion:
    "Palabras que nacen donde termina el silencio. Libro visual de poemas de Fernando López.",
} as const;

export const PAGINAS_FUENTE: PaginaFuente[] = [
  {
    id: "portada",
    orden: 0,
    tipo: "portada",
    titulo: "DIE ENGEL SINGEN",
    nombre: "Portada",
    imagen: {
      src: "/libro/portada.png",
      alt: "Portada del libro. Un hombre de abrigo oscuro y capa roja mira un valle bajo la lluvia, junto a unas ruinas. En las nubes se dibujan dos alas.",
    },
    texto: `
(Los ángeles cantan)

Palabras que nacen donde termina el silencio.

Por Fernando López
`,
    tono: "#c8283a",
    clima: {
      particulas: [{ tipo: "lluvia", cantidad: 1.1 }, { tipo: "petalos" }],
      relampagos: true,
      zonas: [
        { tipo: "nube", x: 0.5, y: 0.43, rx: 0.64, ry: 0.115, fuerza: 1, velocidad: 1 },
        { tipo: "niebla", x: 0.5, y: 0.72, rx: 0.62, ry: 0.12, fuerza: 0.24, color: "#aebbc4" },
        { tipo: "agua", x: 0.745, y: 0.712, rx: 0.1, ry: 0.024, fuerza: 0.8 },
        { tipo: "luz", x: 0.69, y: 0.512, rx: 0.17, ry: 0.095, fuerza: 0.2, velocidad: 0.5, color: "#dfe8ee" },
        { tipo: "viento", x: 0.36, y: 0.738, rx: 0.135, ry: 0.07, fuerza: 0.8, velocidad: 1.3 },
        { tipo: "viento", x: 0.1, y: 0.755, rx: 0.14, ry: 0.07, fuerza: 0.8, velocidad: 1.1 },
      ],
    },
  },
  {
    id: "hay-decisiones",
    orden: 1,
    tipo: "poema",
    titulo: null,
    nombre: "Hay decisiones que cambian caminos",
    nombreEnIndice: "DECIDIR",
    imagen: {
      src: "/libro/hay-decisiones.png",
      alt: "Un sendero entre pastos dorados avanza hacia el sol del atardecer, sobre unas sierras lejanas.",
    },
    texto: `
Hay decisiones que cambian
caminos, personas que cambian
la manera de recorrerlos

Tal vez así, eligiendo con el
corazón y encontrando en el
camino a buenas personas
terminan convirtiéndose en
un lugar bonito.

Decidir es un salto de fe, y dar
ese salto a veces cuesta pero
mientras no demos ese salto
nuestras dudas serán traidoras
y nos hará hacer perder el bien
que podríamos ganar por
miedo a intentarlo.
`,
    significado: {
      texto: `
Decidir es un verbo que proviene del latín decidĕre,
que significa «cortar» o «resolver». (la primera sin
titulo)
`,
    },
    tono: "#f0913e",
    clima: {
      particulas: [{ tipo: "polen" }],
      zonas: [
        { tipo: "luz", x: 0.646, y: 0.755, rx: 0.24, ry: 0.12, fuerza: 0.32, velocidad: 0.55, color: "#ffae5c" },
        { tipo: "nube", x: 0.5, y: 0.69, rx: 0.64, ry: 0.055, fuerza: 0.6, velocidad: 0.5 },
        { tipo: "viento", x: 0.2, y: 0.865, rx: 0.3, ry: 0.105, fuerza: 1, velocidad: 1.35 },
        { tipo: "viento", x: 0.85, y: 0.865, rx: 0.24, ry: 0.095, fuerza: 1, velocidad: 1.25 },
      ],
    },
  },
  {
    id: "no-se",
    orden: 2,
    tipo: "poema",
    titulo: "NO SÉ",
    imagen: {
      src: "/libro/no-se.png",
      alt: "Una persona de espaldas camina sola por un camino oscuro, bajo la lluvia y un cielo de tormenta.",
    },
    texto: `
No sé qué hora es,
no sé qué día es.

A veces tampoco sé en qué
momento empecé a sentirme
tan lejos de mí.

Sigo corriendo sin detenerme,
buscando algo que no sé nombrar,
como si en algún lugar existiera una
respuesta a todas esas preguntas
que llevo adentro.

Corro solo. Y aunque haya gente a mi
alrededor, hay silencios que nadie
más escucha.

Los caminos parecen infinitos y ya no
sé cómo me siento. Solo sé que hay algo
en mí que sigue buscando, aunque
todavía no sepa qué es.

Y así sigo caminando, sin parar…
¿Hacia dónde?
Simplemente no lo sé.
`,
    significado: {
      texto: `
Ich weiß es nicht" es una frase en alemán que
significa «no lo sé» (No se)
`,
    },
    tono: "#8fb0c8",
    clima: {
      particulas: [{ tipo: "lluvia" }],
      relampagos: true,
      zonas: [
        { tipo: "nube", x: 0.5, y: 0.775, rx: 0.64, ry: 0.05, fuerza: 0.7, velocidad: 0.8 },
        { tipo: "niebla", x: 0.5, y: 0.815, rx: 0.62, ry: 0.05, fuerza: 0.24, color: "#8ea2b0" },
        { tipo: "agua", x: 0.5, y: 0.885, rx: 0.2, ry: 0.05, fuerza: 0.8 },
      ],
    },
  },
  {
    id: "entre-opuestos",
    orden: 3,
    tipo: "poema",
    titulo: "ENTRE OPUESTOS",
    imagen: {
      src: "/libro/entre-opuestos.png",
      alt: "Un hombre y una mujer se miran de frente, a contraluz, bajo un cielo de tormenta.",
    },
    texto: `
A veces somos tan distintos que parece
imposible encontrarnos.

Vos con tu manera de sentir, yo con mi
forma de callar. Vos con tu energía,
yo buscando calma.

Y, sin embargo, hay algo que nos acerca.
Algo que no necesita demasiadas
explicaciones: una mirada, una risa,
un silencio que se siente bien.

No todo es fácil. Tenemos luces y sombras,
días en los que nos entendemos y otros en
los que no sabemos cómo hacerlo.

Pero entre tantas diferencias, hay algo que
permanece: la forma en que aparecés en mis
pensamientos incluso cuando no te estoy
buscando.

Y tal vez de eso se trate: de encontrarnos
sin dejar de ser quienes somos y elegirnos,
aun siendo distintos.
`,
    significado: {
      texto: `
«Frau und Mann» es una expresión en alemán que
significa «mujer y hombre» (Entre Opuestos)
`,
    },
    tono: "#a9bcc6",
    clima: {
      particulas: [{ tipo: "lluvia", cantidad: 0.85 }],
      relampagos: true,
      zonas: [
        { tipo: "nube", x: 0.5, y: 0.72, rx: 0.64, ry: 0.05, fuerza: 0.7, velocidad: 0.8 },
        { tipo: "niebla", x: 0.5, y: 0.81, rx: 0.62, ry: 0.04, fuerza: 0.2, color: "#93a6b0" },
        { tipo: "centelleo", x: 0.45, y: 0.825, rx: 0.32, ry: 0.022, fuerza: 0.8, velocidad: 1.2 },
        { tipo: "viento", x: 0.07, y: 0.79, rx: 0.1, ry: 0.065, fuerza: 0.85, velocidad: 1.15 },
      ],
    },
  },
  {
    id: "marathon",
    orden: 4,
    tipo: "poema",
    titulo: "Marathon",
    nombreEnIndice: "MARATHON",
    imagen: {
      src: "/libro/marathon.png",
      alt: "Un corredor avanza por una ruta mojada hacia un claro de luz que se abre entre las nubes.",
    },
    texto: `
Para todas las almas bien entrenadas
los años se te escapan.
Donde cada día es una nueva maratón

Perder y ganar
Caer y volar
Sombra y luz

Sueños rotos y renuncia
Tanto sudor y tantas lágrimas
Lamentablemente el corazón no se ha recuperado
`,
    significado: {
      texto: `
"Verlieren und siegen" significa "perder y ganar"
que representa la dualidad de la experiencia y los
altibajos inevitables de la vida. (Marathon)
`,
    },
    tono: "#d9e2e6",
    clima: {
      particulas: [{ tipo: "lluvia" }],
      relampagos: true,
      zonas: [
        { tipo: "luz", x: 0.62, y: 0.605, rx: 0.24, ry: 0.09, fuerza: 0.2, velocidad: 0.45, color: "#e9eef2" },
        { tipo: "nube", x: 0.5, y: 0.625, rx: 0.64, ry: 0.052, fuerza: 0.8, velocidad: 0.8 },
        { tipo: "niebla", x: 0.5, y: 0.72, rx: 0.62, ry: 0.04, fuerza: 0.18, color: "#8b9da9" },
        { tipo: "agua", x: 0.5, y: 0.86, rx: 0.14, ry: 0.052, fuerza: 1 },
        { tipo: "viento", x: 0.08, y: 0.8, rx: 0.13, ry: 0.035, fuerza: 0.8, velocidad: 1.2 },
        { tipo: "viento", x: 0.92, y: 0.8, rx: 0.11, ry: 0.032, fuerza: 0.8, velocidad: 1.1 },
      ],
    },
  },
  {
    id: "auslander",
    orden: 5,
    tipo: "poema",
    titulo: "Ausländer",
    nombreEnIndice: "AUSLÄNDER",
    imagen: {
      src: "/libro/auslander.png",
      alt: "Una pareja camina de noche bajo la lluvia por una calle empedrada con faroles y un café encendido. Al fondo, una cúpula iluminada.",
    },
    texto: `
Otras tierras, otras costumbres
En el pasado estaba frustrado
Ahora soy solo un extranjero

Mi amor, mon chéri
Ciao ragazza, una oportunidad.
Mon amour, Я люблю тебя (te quiero)

Antes de que el sol se ria otra vez
Ven conmigo, te haré bien
`,
    significado: {
      texto: `
"Ausländer" proviene de aus (fuera) y Land
(tierra/país) y significa Extranjero. (Extranjero)
`,
    },
    tono: "#f2b866",
    clima: {
      particulas: [{ tipo: "lluvia", cantidad: 0.9 }],
      zonas: [
        { tipo: "luz", x: 0.947, y: 0.565, rx: 0.08, ry: 0.052, fuerza: 0.5, velocidad: 2.8, color: "#ffd08a" },
        { tipo: "luz", x: 0.403, y: 0.665, rx: 0.055, ry: 0.036, fuerza: 0.42, velocidad: 2.4, color: "#ffd08a" },
        { tipo: "luz", x: 0.09, y: 0.7, rx: 0.17, ry: 0.14, fuerza: 0.13, velocidad: 1.4, color: "#ffae52" },
        { tipo: "luz", x: 0.2, y: 0.82, rx: 0.05, ry: 0.032, fuerza: 0.55, velocidad: 5.5, color: "#ffb75e" },
        { tipo: "agua", x: 0.7, y: 0.875, rx: 0.31, ry: 0.06, fuerza: 0.9 },
        { tipo: "viento", x: 0.96, y: 0.07, rx: 0.1, ry: 0.08, fuerza: 0.9, velocidad: 0.85 },
      ],
    },
  },
  {
    id: "prostitution",
    orden: 6,
    tipo: "poema",
    titulo: "PROSTITUTION",
    imagen: {
      src: "/libro/prostitution.png",
      alt: "Calle de noche bajo la lluvia, con un bar de luces rojas a la izquierda y un hombre de abrigo junto a un farol. El pavimento mojado refleja las luces.",
    },
    texto: `
Entre las nubes veo tu rostro.
Pienso en el amor,
en los corazones y los besos,
en las promesas que se dicen
y en los deseos que se esconden.

Pero también buscan otra cosa:
un cuerpo, un instante,
un poco de alivio
o simplemente dejarse llevar.

Placer y soledad.
Deseo y ternura.
Contradicciones y noches intensas

Y algunos levantan su copa y dicen:

¡Un brindis por la prostitución!
`,
    significado: {
      texto: `
«Prostitution» el deseo se encuentra con el dinero y
la soledad en un instante de compañía
`,
      banda: "solida",
    },
    tono: "#e5343f",
    clima: {
      particulas: [{ tipo: "lluvia", cantidad: 0.9 }],
      zonas: [
        { tipo: "luz", x: 0.07, y: 0.45, rx: 0.17, ry: 0.2, fuerza: 0.18, velocidad: 2, color: "#ff2a35" },
        { tipo: "luz", x: 0.962, y: 0.4, rx: 0.075, ry: 0.05, fuerza: 0.42, velocidad: 2.6, color: "#ff5a55" },
        { tipo: "luz", x: 0.886, y: 0.45, rx: 0.045, ry: 0.03, fuerza: 0.42, velocidad: 2.1, color: "#ff5a55" },
        { tipo: "luz", x: 0.02, y: 0.755, rx: 0.07, ry: 0.042, fuerza: 0.6, velocidad: 5.5, color: "#ff3b30" },
        { tipo: "luz", x: 0.935, y: 0.05, rx: 0.085, ry: 0.05, fuerza: 0.14, velocidad: 0.4, color: "#dfe6ee" },
        { tipo: "agua", x: 0.7, y: 0.795, rx: 0.34, ry: 0.07, fuerza: 1 },
      ],
    },
  },
  {
    id: "platz-eins",
    orden: 7,
    tipo: "poema",
    titulo: "PLATZ EINS",
    imagen: {
      src: "/libro/platz-eins-rojo.png",
      alt: "Un hombre de traje, de espaldas e inmóvil, en medio de una fiesta con luces rojas y azules, copas, champán y papel dorado en el aire.",
    },
    texto: `
Todo el mundo me mira celosamente,
Quise llegar tan alto
que me olvidé de mirar hacia abajo.

Aprendí a sonreír para las fotos,
a recibir aplausos
y a esconder las heridas.

A todo o nada,
Afuera o adentro
ya no estaba seguro de reconocerme
cuando todo quedó en silencio.
`,
    significado: {
      texto: `
«Platz Eins» significa «primer lugar»:
la cima que muchos desean alcanzar,
aunque cuesta permanecer en ella.
`,
      enLaImagen: true,
    },
    tono: "#e8bd60",
    clima: {
      particulas: [{ tipo: "confeti" }],
      zonas: [
        { tipo: "centelleo", x: 0.68, y: 0.505, rx: 0.13, ry: 0.036, fuerza: 1, velocidad: 4.5 },
        { tipo: "luz", x: 0.06, y: 0.58, rx: 0.2, ry: 0.13, fuerza: 0.16, velocidad: 1.05, color: "#ff2030" },
        { tipo: "luz", x: 0.92, y: 0.36, rx: 0.2, ry: 0.13, fuerza: 0.16, velocidad: 0.9, color: "#3a7cff" },
        { tipo: "agua", x: 0.5, y: 0.815, rx: 0.36, ry: 0.034, fuerza: 0.7 },
      ],
    },
  },
  {
    id: "pills-bajo-control",
    orden: 8,
    tipo: "poema",
    titulo: "PILLS BAJO CONTROL",
    imagen: {
      src: "/libro/pills-bajo-control-rojo.png",
      alt: "Un hombre de espaldas fuma frente a los edificios iluminados de una ciudad de noche. En primer plano, un cenicero y un frasco de pastillas volcado sobre una mesa.",
    },
    texto: `
Una para despertar,
otra para dormir.
Una para olvidar tu nombre
Una para aguantar la noche,
otra para sonreír de día.
y otra para volver a sentir.

Toda la izquierda es derecha,
Todo el negro es blanco,
Todo el calor es nieve,
Todo lo alto era bajo.

Todos parecen felices.
`,
    significado: {
      texto: `
«Pastillas Bajo Control»: la ilusión de tener todo y
una forma de escapar de lo que se siente.
`,
      banda: "solida",
    },
    tono: "#5db8ff",
    clima: {
      zonas: [
        { tipo: "humo", x: 0.125, y: 0.385, rx: 0.075, ry: 0.075, fuerza: 0.6, velocidad: 1, color: "#9aa8e0" },
        { tipo: "luz", x: 0.03, y: 0.18, rx: 0.08, ry: 0.24, fuerza: 0.22, velocidad: 3, color: "#ff1a2a" },
        { tipo: "centelleo", x: 0.91, y: 0.46, rx: 0.15, ry: 0.2, fuerza: 1, velocidad: 1.4 },
        { tipo: "centelleo", x: 0.7, y: 0.655, rx: 0.3, ry: 0.052, fuerza: 1, velocidad: 1.1 },
        { tipo: "luz", x: 0.955, y: 0.24, rx: 0.035, ry: 0.03, fuerza: 0.45, velocidad: 1.8, color: "#4fc0ff" },
        { tipo: "agua", x: 0.5, y: 0.79, rx: 0.52, ry: 0.036, fuerza: 0.6, velocidad: 0.7 },
      ],
    },
  },
  {
    id: "guten-appetit",
    orden: 9,
    tipo: "poema",
    titulo: "GUTEN APPETIT",
    imagen: {
      src: "/libro/guten-appetit-rojo.png",
      alt: "Una larga mesa de banquete con mantel de terciopelo rojo, copas de vino, platos dorados y candelabros encendidos. Al fondo, los invitados conversan de pie. En primer plano, una silla dorada vacía.",
    },
    texto: `
Yo puse la mesa.
Ellos pusieron las reglas.

Yo cociné la cena.
Ellos repartieron las sillas.

Brindaron por el esfuerzo,
se sirvieron otra copa
y me agradecieron de pie.

No había lugar para mí.

Pero dejaron los platos.
`,
    significado: {
      texto: `
«Guten Appetit»: buen provecho. Una mesa
donde algunos comen y otros solo sirven.
`,
      enLaImagen: true,
    },
    tono: "#e6b15c",
    clima: {
      particulas: [{ tipo: "polen", cantidad: 0.7 }],
      zonas: [
        { tipo: "viento", x: 0.08, y: 0.195, rx: 0.09, ry: 0.05, fuerza: 1.1, velocidad: 3 },
        { tipo: "luz", x: 0.046, y: 0.172, rx: 0.1, ry: 0.056, fuerza: 0.16, velocidad: 5.5, color: "#ffc16b" },
        { tipo: "luz", x: 0.013, y: 0.21, rx: 0.08, ry: 0.045, fuerza: 0.14, velocidad: 6.1, color: "#ffc16b" },
        { tipo: "luz", x: 0.134, y: 0.218, rx: 0.1, ry: 0.056, fuerza: 0.16, velocidad: 5, color: "#ffc16b" },
        { tipo: "luz", x: 0.14, y: 0.44, rx: 0.1, ry: 0.04, fuerza: 0.16, velocidad: 4.5, color: "#ffc16b" },
        { tipo: "luz", x: 0.96, y: 0.267, rx: 0.08, ry: 0.036, fuerza: 0.16, velocidad: 4.8, color: "#ffc16b" },
        { tipo: "humo", x: 0.046, y: 0.125, rx: 0.06, ry: 0.045, fuerza: 0.35, velocidad: 0.8, color: "#d8c8a8" },
        { tipo: "centelleo", x: 0.28, y: 0.68, rx: 0.3, ry: 0.105, fuerza: 0.7, velocidad: 1.3 },
        { tipo: "agua", x: 0.84, y: 0.765, rx: 0.15, ry: 0.028, fuerza: 0.5, velocidad: 0.6 },
      ],
    },
  },
  {
    id: "prohibido",
    orden: 10,
    tipo: "poema",
    titulo: "PROHIBIDO",
    imagen: {
      src: "/libro/prohibido.png",
      alt: "Una cortina de terciopelo rojo se abre hacia un salón en penumbra, con una pareja en sombras y una lámpara roja. A la derecha, una puerta entreabierta. En primer plano, un vaso y una rosa sobre una mesa.",
    },
    texto: `
Me dijeron que no mirara.
Miré.

Que no tocara.
Toqué.

Que no lo deseara.

Demasiado tarde.

Ahora cierran las puertas
y apagan las luces.

Pero nadie se va.
`,
    significado: {
      texto: `
«Verboten» significa «prohibido»:
aquello que todos condenan de día
y desean cuando cae la noche.
`,
      enLaImagen: true,
    },
    tono: "#d61f2c",
    clima: {
      zonas: [
        { tipo: "nube", x: 0.09, y: 0.25, rx: 0.15, ry: 0.24, fuerza: 0.5, velocidad: 0.6 },
        { tipo: "luz", x: 0.903, y: 0.085, rx: 0.1, ry: 0.06, fuerza: 0.22, velocidad: 1.6, color: "#ff3a2a" },
        { tipo: "luz", x: 0.87, y: 0.2, rx: 0.09, ry: 0.13, fuerza: 0.09, velocidad: 0.7, color: "#ff2020" },
        { tipo: "luz", x: 0.86, y: 0.62, rx: 0.08, ry: 0.1, fuerza: 0.1, velocidad: 1.1, color: "#ff2a20" },
        { tipo: "agua", x: 0.865, y: 0.7, rx: 0.065, ry: 0.14, fuerza: 0.7, velocidad: 0.6 },
        { tipo: "agua", x: 0.18, y: 0.925, rx: 0.3, ry: 0.05, fuerza: 0.5, velocidad: 0.5 },
        { tipo: "centelleo", x: 0.055, y: 0.8, rx: 0.07, ry: 0.05, fuerza: 0.6, velocidad: 1 },
      ],
    },
  },
  {
    id: "morgen",
    orden: 11,
    tipo: "poema",
    titulo: "MORGEN",
    imagen: {
      src: "/libro/morgen.png",
      alt: "Una pareja abrazada, de espaldas, mira el amanecer por un ventanal. En primer plano, una cama deshecha, dos tazas de café humeantes sobre una mesa y un vestido rojo sobre una silla.",
    },
    texto: `
Bebimos por los errores,
besamos por la libertad,
y dejamos la ropa
donde cayó.

Cuando salió el sol,
ella buscó su vestido.

Yo el desayuno.
La noche cumplió su promesa.
`,
    significado: {
      texto: `
«Morgen» significa «mañana»:
cuando amanece y el amor comienza a hablar.
`,
      enLaImagen: true,
    },
    tono: "#f2a65a",
    clima: {
      particulas: [{ tipo: "polen", cantidad: 0.7 }],
      zonas: [
        { tipo: "luz", x: 0.964, y: 0.254, rx: 0.12, ry: 0.07, fuerza: 0.24, velocidad: 0.5, color: "#ffb56b" },
        { tipo: "nube", x: 0.79, y: 0.06, rx: 0.06, ry: 0.07, fuerza: 0.35, velocidad: 0.6 },
        { tipo: "humo", x: 0.24, y: 0.625, rx: 0.05, ry: 0.05, fuerza: 0.5, velocidad: 0.7, color: "#e8d8c0" },
        { tipo: "humo", x: 0.365, y: 0.62, rx: 0.04, ry: 0.035, fuerza: 0.45, velocidad: 0.6, color: "#e8d8c0" },
        { tipo: "luz", x: 0.143, y: 0.323, rx: 0.1, ry: 0.06, fuerza: 0.14, velocidad: 1, color: "#ffc98a" },
        { tipo: "luz", x: 0.3, y: 0.54, rx: 0.2, ry: 0.048, fuerza: 0.06, velocidad: 0.4, color: "#ffb070" },
        { tipo: "agua", x: 0.22, y: 0.755, rx: 0.22, ry: 0.025, fuerza: 0.5, velocidad: 0.5 },
      ],
    },
  },
  {
    id: "el-rey-de-papel",
    orden: 12,
    tipo: "poema",
    titulo: "EL REY DE PAPEL",
    imagen: {
      src: "/libro/el-rey-de-papel.png",
      alt: "Un rey de espaldas, con corona de cartón y capa roja de terciopelo, levanta una mano frente a un público que aplaude en un teatro. Desde arriba, dos manos lo sostienen con hilos rojos.",
    },
    texto: `
Quiere que lo miren,
que repitan su nombre
y aplaudan cada palabra.

Levanta la mano.
La multitud responde.

Baja la mano.
La multitud calla.

La corona es de cartón.
El rey, de papel.

Y detrás del telón,
alguien sostiene los hilos.
`,
    significado: {
      texto: `
«El rey de papel»: el poder de quien necesita que lo miren,
mientras otros deciden qué mostrar.
`,
      enLaImagen: true,
    },
    tono: "#d9333f",
    clima: {
      particulas: [{ tipo: "polen", cantidad: 0.5 }],
      zonas: [
        { tipo: "nube", x: 0.08, y: 0.2, rx: 0.14, ry: 0.18, fuerza: 0.5, velocidad: 0.55 },
        { tipo: "nube", x: 0.93, y: 0.2, rx: 0.13, ry: 0.18, fuerza: 0.5, velocidad: 0.5 },
        { tipo: "viento", x: 0.21, y: 0.5, rx: 0.06, ry: 0.3, fuerza: 0.6, velocidad: 0.8 },
        { tipo: "viento", x: 0.77, y: 0.42, rx: 0.05, ry: 0.22, fuerza: 0.6, velocidad: 0.75 },
        { tipo: "luz", x: 0.02, y: 0.49, rx: 0.06, ry: 0.034, fuerza: 0.24, velocidad: 2.4, color: "#ff3a2a" },
        { tipo: "luz", x: 0.97, y: 0.485, rx: 0.06, ry: 0.034, fuerza: 0.24, velocidad: 2.1, color: "#ff3a2a" },
        { tipo: "luz", x: 0.46, y: 0.59, rx: 0.13, ry: 0.05, fuerza: 0.09, velocidad: 0.8, color: "#ffcc88" },
      ],
    },
  },
  {
    id: "spiegel",
    orden: 13,
    tipo: "poema",
    titulo: "SPIEGEL",
    imagen: {
      src: "/libro/spiegel.png",
      alt: "Un hombre de espaldas, con camisa clara, se mira en un espejo de marco dorado. En el reflejo, con los ojos cerrados, se acomoda una corona de cartón. A la izquierda arde una vela roja.",
    },
    texto: `
Me miré al espejo.

Tenía mis ojos,
mi sonrisa
y la misma camisa de anoche.

Le pregunté si estaba orgulloso.

No respondió.

Estaba ocupado
acomodándose la corona.
`,
    significado: {
      texto: `
«Spiegel» significa «espejo»: a veces criticamos
en otros lo que todavía no reconocemos en nosotros.
`,
      enLaImagen: true,
    },
    tono: "#c8283a",
    clima: {
      zonas: [
        { tipo: "nube", x: 0.66, y: 0.17, rx: 0.22, ry: 0.105, fuerza: 0.2, velocidad: 0.5 },
        { tipo: "luz", x: 0.72, y: 0.115, rx: 0.09, ry: 0.04, fuerza: 0.1, velocidad: 0.9, color: "#ffcf8a" },
        { tipo: "viento", x: 0.0425, y: 0.148, rx: 0.03, ry: 0.025, fuerza: 1.2, velocidad: 3 },
        { tipo: "luz", x: 0.0425, y: 0.15, rx: 0.08, ry: 0.045, fuerza: 0.22, velocidad: 5.5, color: "#ff6a3a" },
        { tipo: "luz", x: 0.06, y: 0.18, rx: 0.12, ry: 0.1, fuerza: 0.07, velocidad: 1.3, color: "#ff2a20" },
        { tipo: "centelleo", x: 0.95, y: 0.25, rx: 0.06, ry: 0.2, fuerza: 0.6, velocidad: 0.8 },
        { tipo: "centelleo", x: 0.03, y: 0.505, rx: 0.05, ry: 0.05, fuerza: 0.6, velocidad: 1.1 },
        { tipo: "nube", x: 0.92, y: 0.715, rx: 0.1, ry: 0.105, fuerza: 0.4, velocidad: 0.4 },
      ],
    },
  },
  {
    id: "dosis",
    orden: 14,
    tipo: "poema",
    titulo: "DOSIS",
    imagen: {
      src: "/libro/dosis.png",
      alt: "Una habitación a oscuras, de noche. A la izquierda, espejos en arco reflejan luces rojas; a la derecha, una ventana mojada por la lluvia deja entrar un resplandor azul. Sobre una mesa redonda y brillante hay una copa, un cenicero de vidrio y una línea de polvo blanco. Al fondo, una cama deshecha.",
    },
    texto: `
Tu boca,
estas palabras,
el silencio
que no se acaba.

Dame una línea.

Mi cabeza
cae de nuevo.

Nos reímos
sin saber por qué.
aunque nadie lo cree.

Tenemos tanto frío.

Así que dame una línea más.
`,
    significado: {
      texto: `
«Dosis»: el frío, el ruido y la necesidad de repetir
aquello que por un momento nos hace sentir.
`,
      enLaImagen: true,
    },
    tono: "#5fb2e6",
    clima: {
      zonas: [
        { tipo: "agua", x: 0.875, y: 0.25, rx: 0.12, ry: 0.24, fuerza: 0.45, velocidad: 0.6 },
        { tipo: "centelleo", x: 0.88, y: 0.22, rx: 0.1, ry: 0.17, fuerza: 0.55, velocidad: 0.9 },
        { tipo: "luz", x: 0.82, y: 0.347, rx: 0.06, ry: 0.02, fuerza: 0.2, velocidad: 2.5, color: "#5cc8ff" },
        { tipo: "luz", x: 0.93, y: 0.4, rx: 0.07, ry: 0.1, fuerza: 0.12, velocidad: 0.6, color: "#ff2a3a" },
        { tipo: "luz", x: 0.06, y: 0.38, rx: 0.08, ry: 0.16, fuerza: 0.12, velocidad: 0.9, color: "#ff2030" },
        { tipo: "luz", x: 0.21, y: 0.29, rx: 0.05, ry: 0.07, fuerza: 0.1, velocidad: 0.7, color: "#ff2030" },
        { tipo: "humo", x: 0.18, y: 0.6, rx: 0.05, ry: 0.035, fuerza: 0.5, velocidad: 0.8, color: "#9fb4c4" },
        { tipo: "centelleo", x: 0.36, y: 0.623, rx: 0.05, ry: 0.012, fuerza: 0.6, velocidad: 1 },
        { tipo: "centelleo", x: 0.47, y: 0.789, rx: 0.04, ry: 0.01, fuerza: 0.5, velocidad: 0.7 },
        { tipo: "nube", x: 0.78, y: 0.69, rx: 0.2, ry: 0.07, fuerza: 0.3, velocidad: 0.35 },
        { tipo: "agua", x: 0.9, y: 0.975, rx: 0.1, ry: 0.022, fuerza: 0.6, velocidad: 0.6 },
      ],
    },
  },
];

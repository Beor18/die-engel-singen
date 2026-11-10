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
    escena: {
      lugar: "campo",
      elementos: [
        { imagen: "cartel", nombre: "Cartel", x: 0.6, y: 0.78, alto: 2.1, dice: ["Un cartel con dos flechas que apuntan a lados opuestos. Ninguna dice adónde lleva."] },
        {
          imagen: "viajero",
          nombre: "Viajero",
          persona: true,
          x: 0.3,
          y: 0.8,
          alto: 1.7,
          dice: ["Yo también me quedé parado en esta curva. Elegí con el corazón, y el camino se volvió un lugar bonito.", "Andá tranquilo. El sol todavía no se fue."],
        },
        { imagen: "arbol", nombre: "Árbol", x: 0.82, y: 0.6, alto: 3.4, mueve: "viento", dice: ["Un árbol solo en medio del campo. Alguien eligió plantarlo acá."] },
        { imagen: "pastos", nombre: "Pasto", x: 0.2, y: 0.9, alto: 1.1, pasable: true, mueve: "viento", copias: 16, dice: [] },
      ],
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
    escena: {
      lugar: "camino",
      elementos: [
        {
          imagen: "caminante",
          nombre: "Alguien",
          persona: true,
          x: 0.5,
          y: 0.8,
          alto: 2,
          mueve: "seAleja",
          hasta: { x: 0.5, y: 0.42 },
          dice: ["No sé qué hora es. Tampoco sé desde cuándo camino.", "Si me quedo quieto es peor. ¿Vos sabés adónde vas?"],
        },
        { imagen: "reloj", nombre: "Reloj", x: 0.25, y: 0.62, alto: 3.1, dice: ["Un reloj de calle. Las agujas se quedaron quietas en una hora que nadie recuerda."] },
        { imagen: "banco", nombre: "Banco", x: 0.74, y: 0.7, alto: 1.3, ancho: 2, dice: ["Un banco mojado. Nadie se sienta a esperar con esta lluvia."] },
      ],
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
    escena: {
      lugar: "camino",
      elementos: [
        {
          imagen: "hombre-opuesto",
          nombre: "Él",
          persona: true,
          x: 0.22,
          y: 0.86,
          alto: 2.1,
          mueve: "seAcerca",
          hasta: { x: 0.47, y: 0.86 },
          dice: ["Ella dice todo lo que siente. Yo me lo guardo.", "Pero cada verso que encontrás me acerca un paso a ella."],
        },
        {
          imagen: "mujer-opuesta",
          nombre: "Ella",
          persona: true,
          x: 0.78,
          y: 0.86,
          alto: 1.95,
          mueve: "seAcerca",
          hasta: { x: 0.53, y: 0.86 },
          dice: ["Él busca calma y yo no sé quedarme quieta.", "No queremos parecernos. Queremos encontrarnos."],
        },
        { imagen: "cerco", nombre: "Cerco", x: 0.1, y: 0.7, alto: 1.4, pasable: true, copias: 4, dice: [] },
        { imagen: "arbusto", nombre: "Arbusto", x: 0.9, y: 0.6, alto: 1.2, pasable: true, mueve: "viento", copias: 6, dice: [] },
      ],
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
    escena: {
      lugar: "camino",
      elementos: [
        {
          imagen: "corredor",
          nombre: "Corredor",
          persona: true,
          x: 0.48,
          y: 0.8,
          alto: 2,
          mueve: "corre",
          hasta: { x: 0.5, y: 0.3 },
          dice: ["No puedo parar. Si paro, los años me alcanzan.", "¿Ves esa luz entre las nubes? Llego ahí y descanso. Eso digo siempre."],
        },
        { imagen: "mojon", nombre: "Mojón", x: 0.28, y: 0.66, alto: 1.2, dice: ["Un mojón al costado de la ruta. Los números se borraron de tanto llover."] },
        { imagen: "baranda", nombre: "Baranda", x: 0.75, y: 0.7, alto: 1.1, pasable: true, copias: 3, dice: [] },
      ],
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
    escena: {
      lugar: "calle",
      elementos: [
        {
          imagen: "pareja-paraguas",
          nombre: "La pareja",
          persona: true,
          x: 0.7,
          y: 0.8,
          alto: 2.1,
          mueve: "seAleja",
          hasta: { x: 0.68, y: 0.4 },
          dice: ["En cada ciudad aprendí a decir te quiero de otra manera.", "Acá los dos somos extranjeros. Juntos, un poco menos."],
        },
        {
          imagen: "mesa-cafe",
          nombre: "Mesa del café",
          x: 0.16,
          y: 0.72,
          alto: 1.6,
          luz: { color: "#ffb35c", alcance: 2.4, altura: 0.6 },
          dice: ["Una mesa de café, todavía tibia. Alguien dejó una taza a medio tomar."],
        },
        { imagen: "maceta", nombre: "Maceta", x: 0.3, y: 0.62, alto: 1.3, copias: 2, dice: ["Una maceta con flores rojas. Son lo único seco de toda la calle."] },
      ],
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
    escena: {
      lugar: "calle",
      elementos: [
        {
          imagen: "hombre-sombrero",
          nombre: "Hombre de sombrero",
          persona: true,
          x: 0.84,
          y: 0.76,
          alto: 2.2,
          dice: ["Acá todo tiene precio. Lo único gratis es la lluvia.", "Adentro nadie pregunta tu nombre. Afuera, nadie lo recuerda."],
        },
        {
          imagen: "bar",
          nombre: "Bar",
          x: 0.12,
          y: 0.72,
          alto: 2.9,
          ancho: 2,
          mueve: "titila",
          luz: { color: "#ff2a3a", alcance: 3.6, altura: 0.85 },
          dice: ["La puerta del bar. Adentro suena una música que no termina nunca."],
        },
        { imagen: "barril", nombre: "Barril", x: 0.26, y: 0.78, alto: 1.4, dice: ["Un barril con dos copas. Una tiene marca de rouge."] },
      ],
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
    escena: {
      lugar: "salon",
      elementos: [
        {
          imagen: "hombre-traje",
          nombre: "Hombre de traje",
          persona: true,
          x: 0.5,
          y: 0.62,
          alto: 2.2,
          mueve: "quieto",
          dice: ["Llegué primero. Todos me aplaudieron.", "Después se fueron a festejar a otro lado. Desde acá arriba no se ve a nadie."],
        },
        {
          imagen: "invitada",
          nombre: "Invitada",
          persona: true,
          x: 0.28,
          y: 0.7,
          alto: 2.1,
          mueve: "baila",
          dice: ["¿Quién? ¿El del primer puesto? Ni idea, pero qué linda fiesta."],
        },
        {
          imagen: "invitado",
          nombre: "Invitado",
          persona: true,
          x: 0.74,
          y: 0.55,
          alto: 2.2,
          mueve: "baila",
          dice: ["Brindo por él. Bah, por quien sea, mientras haya champán."],
        },
        { imagen: "mesa-champan", nombre: "Mesa", x: 0.64, y: 0.8, alto: 2, dice: ["Una botella de champán en hielo. Las copas están llenas, pero nadie brinda."] },
        { nombre: "Luz roja", x: 0.3, y: 0.45, mueve: "gira", luz: { color: "#ff2448", alcance: 4 }, dice: [] },
        { nombre: "Luz azul", x: 0.7, y: 0.4, mueve: "gira", luz: { color: "#3a6bff", alcance: 4 }, dice: [] },
      ],
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
    escena: {
      lugar: "cuarto",
      elementos: [
        {
          imagen: "hombre-fuma",
          nombre: "Hombre",
          persona: true,
          x: 0.2,
          y: 0.74,
          alto: 2,
          mueve: "fuma",
          humo: { x: 0.46, y: 0.1 },
          dice: ["Ya no cuento cuántas tomo. Las cuenta el frasco.", "La ciudad nunca duerme. A veces la envidio."],
        },
        {
          imagen: "mesa-pastillas",
          nombre: "Mesa",
          x: 0.55,
          y: 0.87,
          alto: 1.4,
          mueve: "fuma",
          humo: { x: 0.3, y: 0.13 },
          dice: ["Un cenicero lleno y un frasco volcado. Las pastillas brillan como las luces de la ciudad."],
        },
        { nombre: "Luces de la ciudad", x: 0.86, y: 0.55, luz: { color: "#3d7dff", alcance: 4.5 }, dice: [] },
        { nombre: "Neón", x: 0.74, y: 0.68, mueve: "titila", luz: { color: "#ff3355", alcance: 3 }, dice: [] },
      ],
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
    escena: {
      lugar: "salon",
      elementos: [
        {
          imagen: "mesa-banquete",
          nombre: "Mesa",
          x: 0.32,
          y: 0.72,
          alto: 3.2,
          ancho: 4,
          mueve: "llama",
          luz: { color: "#ffb347", alcance: 3.2, altura: 0.75 },
          dice: ["La mesa está puesta para todos. Hay un plato servido para cada uno, menos para uno."],
        },
        { imagen: "silla-dorada", nombre: "Silla dorada", x: 0.8, y: 0.78, alto: 1.9, dice: ["Una silla dorada, vacía. Es la tuya, pero nadie te la ofrece."] },
        {
          imagen: "comensal",
          nombre: "Comensal",
          persona: true,
          x: 0.56,
          y: 0.55,
          alto: 2.2,
          dice: ["Qué cena. ¿Quién cocinó? Bueno, no importa. Salud."],
        },
        {
          imagen: "comensal-dama",
          nombre: "Invitada",
          persona: true,
          x: 0.72,
          y: 0.6,
          alto: 2.1,
          dice: ["Las sillas ya están repartidas, querido. Quizás la próxima."],
        },
        {
          imagen: "candelabro",
          nombre: "Candelabro",
          x: 0.14,
          y: 0.5,
          alto: 2.6,
          mueve: "llama",
          luz: { color: "#ffb347", alcance: 3, altura: 0.9 },
          dice: ["Un candelabro con cinco velas. La cera cae sobre el mantel y nadie la limpia."],
        },
      ],
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
    escena: {
      lugar: "salon",
      elementos: [
        { imagen: "telon", nombre: "Telón", x: 0.07, y: 0.5, alto: 3.6, dice: ["Un telón de terciopelo rojo. Del otro lado se escucha una música baja."] },
        { imagen: "telon", nombre: "Telón", x: 0.93, y: 0.5, alto: 3.6, espejado: true, dice: [] },
        {
          imagen: "pareja-sombras",
          nombre: "La pareja",
          persona: true,
          x: 0.5,
          y: 0.6,
          alto: 2.1,
          dice: ["Shh. Acá no estamos.", "Lo prohibido tiene la mejor luz. Por eso apagamos todas."],
        },
        {
          imagen: "lampara-roja",
          nombre: "Lámpara roja",
          x: 0.66,
          y: 0.54,
          alto: 2.6,
          luz: { color: "#ff2d2d", alcance: 3.4, altura: 0.85 },
          dice: ["Una lámpara roja. Tiñe todo, hasta lo que no se dice."],
        },
        { imagen: "mesa-rosa", nombre: "Mesa", x: 0.22, y: 0.85, alto: 1.4, dice: ["Un vaso a medio terminar y una rosa. Alguien se fue apurado, o alguien no llegó."] },
        {
          imagen: "puerta",
          nombre: "Puerta",
          x: 0.84,
          y: 0.7,
          alto: 2.7,
          luz: { color: "#ffcf8a", alcance: 2.6, altura: 0.5 },
          dice: ["Una puerta entreabierta. Por la rendija se escapa un poco de luz."],
        },
      ],
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
    escena: {
      lugar: "cuarto",
      elementos: [
        {
          imagen: "pareja-ventana",
          nombre: "La pareja",
          persona: true,
          x: 0.8,
          y: 0.46,
          alto: 2.2,
          dice: ["Mirá. Ya amanece.", "Quedate un rato más. El café todavía está caliente."],
        },
        { imagen: "cama", nombre: "Cama", x: 0.2, y: 0.62, alto: 1.7, ancho: 2, dice: ["La cama deshecha todavía guarda la forma de dos personas."] },
        {
          imagen: "mesa-tazas",
          nombre: "Mesa",
          x: 0.36,
          y: 0.82,
          alto: 1.4,
          mueve: "vapor",
          humo: { x: 0.28, y: 0.16 },
          dice: ["Dos tazas de café. Todavía humean."],
        },
        { imagen: "silla-vestido", nombre: "Silla", x: 0.62, y: 0.82, alto: 1.9, dice: ["Un vestido rojo sobre la silla. Nadie lo levantó desde anoche."] },
        { nombre: "Amanecer", x: 0.8, y: 0.36, luz: { color: "#ffb070", alcance: 5 }, dice: [] },
      ],
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
    escena: {
      lugar: "teatro",
      elementos: [
        {
          imagen: "rey",
          nombre: "Rey de papel",
          persona: true,
          x: 0.42,
          y: 0.74,
          alto: 2.3,
          mueve: "marioneta",
          dice: ["¡Mírenme! Esto es lo que querían, ¿no?", "No puedo bajar la mano. Alguien la sostiene desde arriba."],
        },
        { imagen: "publico", nombre: "Público", x: 0.22, y: 0.58, alto: 1.7, ancho: 2, mueve: "aplaude", dice: ["El público aplaude. Ninguno sabe muy bien por qué."] },
        { imagen: "publico", nombre: "Público", x: 0.7, y: 0.56, alto: 1.7, ancho: 2, mueve: "aplaude", espejado: true, dice: [] },
        { imagen: "telon", nombre: "Telón", x: 0.06, y: 0.6, alto: 3.6, dice: ["El telón. Detrás, alguien tira de los hilos."] },
        { imagen: "telon", nombre: "Telón", x: 0.94, y: 0.6, alto: 3.6, espejado: true, dice: [] },
        { nombre: "Reflector", x: 0.42, y: 0.66, luz: { color: "#ffe2a8", alcance: 3.6 }, dice: [] },
      ],
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
    escena: {
      lugar: "cuarto",
      elementos: [
        {
          imagen: "espejo",
          nombre: "Espejo",
          x: 0.46,
          y: 0.46,
          alto: 3.2,
          mueve: "refleja",
          vidrio: { x: 0.2, y: 0.14, ancho: 0.6, alto: 0.74 },
          dice: ["Te mirás en el espejo. Por un momento, tu reflejo cierra los ojos y se acomoda una corona de cartón."],
        },
        {
          imagen: "hombre-camisa",
          nombre: "Hombre",
          persona: true,
          x: 0.28,
          y: 0.52,
          alto: 2.2,
          dice: ["Me pregunto si estoy orgulloso. El espejo nunca contesta.", "Esperá, que me acomodo la corona."],
        },
        {
          imagen: "vela-roja",
          nombre: "Vela roja",
          x: 0.09,
          y: 0.42,
          alto: 1.3,
          mueve: "llama",
          luz: { color: "#ff4a2a", alcance: 2.8, altura: 0.9 },
          dice: ["Una vela roja. Es la única luz del cuarto que no miente."],
        },
      ],
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
    escena: {
      lugar: "cuarto",
      elementos: [
        {
          imagen: "espejos-arco",
          nombre: "Espejos",
          x: 0.14,
          y: 0.46,
          alto: 2.7,
          mueve: "titila",
          luz: { color: "#ff2840", alcance: 3.2, altura: 0.6 },
          dice: ["Espejos en arco. Repiten una luz roja que no viene de ningún lado."],
        },
        {
          imagen: "ventana",
          nombre: "Ventana",
          x: 0.86,
          y: 0.4,
          alto: 2.9,
          luz: { color: "#4f8dff", alcance: 3.4, altura: 0.55 },
          dice: ["Una ventana mojada. Afuera, la ciudad sigue como si nada."],
        },
        { imagen: "mesa-redonda", nombre: "Mesa", x: 0.45, y: 0.82, alto: 1.5, dice: ["Una copa, un cenicero y una línea blanca sobre la mesa. Nada de esto dura."] },
        { imagen: "cama", nombre: "Cama", x: 0.68, y: 0.7, alto: 1.7, ancho: 2, dice: ["Una cama deshecha. Nadie durmió en ella."] },
      ],
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
  {
    id: "prision",
    orden: 15,
    tipo: "poema",
    titulo: "PRISIÓN",
    imagen: {
      src: "/libro/prision.png",
      alt: "Un pasillo oscuro termina en una puerta cerrada; por la rendija y por debajo se filtra una luz roja. En las paredes se adivinan sombras de figuras. En el piso mojado, delante de la puerta, hay una llave antigua. Arriba y abajo asoman telas de terciopelo rojo.",
    },
    texto: `
Vivo en una prisión
sin barrotes ni cadenas.
Las paredes tienen oídos
y la libertad está de visita.

Discusiones por acá,
amenazas por allá.
Me acusan de ser el monstruo.

El juez, el verdugo y el testigo
tenían la misma cara.

A veces cuesta sobrevivir,
a veces cuesta decidir.
No sé si abrir la puerta.

Pero me dieron la llave.

Después cambiaron la cerradura.
`,
    significado: {
      texto: `
«Prisión»: cuando te ofrecen una salida,
pero alguien más decide si podés usarla.
`,
      enLaImagen: true,
    },
    escena: {
      lugar: "pasillo",
      elementos: [
        {
          imagen: "puerta-roja",
          nombre: "Puerta",
          x: 0.5,
          y: 0.62,
          alto: 3.1,
          ancho: 2,
          luz: { color: "#ff2020", alcance: 3.2, altura: 0.08 },
          dice: ["La puerta está cerrada. Por debajo se filtra una luz roja."],
          conObjeto: { imagen: "llave", dice: ["Probás la llave. Entra, gira… y no abre. Alguien cambió la cerradura."] },
        },
        {
          imagen: "llave",
          nombre: "Llave",
          x: 0.6,
          y: 0.9,
          alto: 0.45,
          pasable: true,
          levantar: true,
          mueve: "brilla",
          dice: ["Una llave antigua, mojada. La guardás. Pesa más de lo que parece."],
        },
        { imagen: "siluetas", nombre: "Sombras", x: 0.2, y: 0.42, alto: 2.4, ancho: 2, pasable: true, mueve: "sombra", dice: [] },
        { imagen: "siluetas", nombre: "Sombras", x: 0.8, y: 0.3, alto: 2.4, ancho: 2, pasable: true, mueve: "sombra", espejado: true, dice: [] },
      ],
    },
    tono: "#e2452f",
    clima: {
      particulas: [{ tipo: "polen", cantidad: 0.4 }],
      zonas: [
        { tipo: "nube", x: 0.1, y: 0.3, rx: 0.1, ry: 0.18, fuerza: 0.35, velocidad: 0.3 },
        { tipo: "nube", x: 0.9, y: 0.32, rx: 0.1, ry: 0.2, fuerza: 0.35, velocidad: 0.28 },
        { tipo: "viento", x: 0.15, y: 0.03, rx: 0.15, ry: 0.04, fuerza: 0.6, velocidad: 0.6 },
        { tipo: "luz", x: 0.08, y: 0.6, rx: 0.08, ry: 0.12, fuerza: 0.12, velocidad: 0.5, color: "#ff1a20" },
        { tipo: "luz", x: 0.92, y: 0.55, rx: 0.08, ry: 0.1, fuerza: 0.12, velocidad: 0.45, color: "#ff1a20" },
        { tipo: "luz", x: 0.583, y: 0.62, rx: 0.015, ry: 0.13, fuerza: 0.25, velocidad: 1.2, color: "#ff4a2a" },
        { tipo: "luz", x: 0.53, y: 0.735, rx: 0.07, ry: 0.015, fuerza: 0.3, velocidad: 0.9, color: "#ffb070" },
        { tipo: "centelleo", x: 0.49, y: 0.61, rx: 0.02, ry: 0.02, fuerza: 0.4, velocidad: 0.7 },
        { tipo: "agua", x: 0.5, y: 0.765, rx: 0.25, ry: 0.02, fuerza: 0.6, velocidad: 0.6 },
        { tipo: "centelleo", x: 0.4, y: 0.81, rx: 0.06, ry: 0.015, fuerza: 0.6, velocidad: 0.8 },
        { tipo: "nube", x: 0.1, y: 0.83, rx: 0.1, ry: 0.04, fuerza: 0.35, velocidad: 0.3 },
      ],
    },
  },
  {
    id: "entre-dos-tierras",
    orden: 16,
    tipo: "poema",
    titulo: "ENTRE DOS TIERRAS",
    imagen: {
      src: "/libro/entre-dos-tierras.png",
      alt: "Bajo un cielo de tormenta, un abismo parte la tierra en dos. A la izquierda, un castillo con estandartes rojos y una mesa servida con mantel rojo, velas encendidas, uvas, pan, una copa y una corona de oro. A la derecha, otro castillo con estandartes azules y, arriba de una escalera de piedra, un trono rojo vacío. Entre los dos bordes cae una cascada envuelta en niebla.",
    },
    texto: `
Te ofrecieron
una silla más alta
y una mesa mejor servida.

Ahora hablás de principios
con la boca llena.

Pusiste un pie de cada lado
para no elegir bando.

Entre dos tierras estás
`,
    significado: {
      texto: `
«Entre dos tierras»: cuando la ambición te lleva
a ocupar ambos bandos sin comprometerte con ninguno.
`,
      enLaImagen: true,
    },
    escena: {
      lugar: "campo",
      elementos: [
        {
          imagen: "trono",
          nombre: "Trono",
          x: 0.9,
          y: 0.6,
          alto: 2.7,
          ancho: 2,
          dice: ["Una silla más alta, arriba de la escalera. Desde ahí se ven las dos tierras, y ninguna es tuya."],
          conObjeto: { imagen: "corona", dice: ["Te sentás con la corona puesta. Los dos bandos te aplauden. Ninguno te cree."] },
        },
        {
          imagen: "mesa-servida",
          nombre: "Mesa",
          x: 0.17,
          y: 0.7,
          alto: 2.2,
          ancho: 4,
          mueve: "llama",
          luz: { color: "#ffc070", alcance: 3, altura: 0.8 },
          dice: ["La mesa mejor servida que viste. Acá todos hablan de principios con la boca llena."],
        },
        {
          imagen: "corona",
          nombre: "Corona",
          x: 0.29,
          y: 0.665,
          alto: 0.5,
          pasable: true,
          levantar: true,
          mueve: "brilla",
          dice: ["Una corona entre el pan y las uvas. La guardás. Nadie te la puso: la agarraste vos."],
        },
        {
          imagen: "estandarte-rojo",
          nombre: "Estandarte rojo",
          x: 0.17,
          y: 0.53,
          alto: 2.6,
          mueve: "viento",
          dice: ["Un estandarte rojo con laureles. Te saluda como si fueras de acá."],
        },
        {
          imagen: "estandarte-azul",
          nombre: "Estandarte azul",
          x: 0.77,
          y: 0.55,
          alto: 2.6,
          mueve: "viento",
          dice: ["Un estandarte azul con una balanza. También te saluda como si fueras de acá."],
        },
      ],
    },
    tono: "#78a9c4",
    clima: {
      relampagos: true,
      zonas: [
        { tipo: "nube", x: 0.38, y: 0.07, rx: 0.3, ry: 0.055, fuerza: 0.35, velocidad: 0.3 },
        { tipo: "nube", x: 0.9, y: 0.3, rx: 0.08, ry: 0.1, fuerza: 0.3, velocidad: 0.28 },
        { tipo: "luz", x: 0.068, y: 0.565, rx: 0.05, ry: 0.03, fuerza: 0.22, velocidad: 2.4, color: "#ffc070" },
        { tipo: "luz", x: 0.9, y: 0.58, rx: 0.06, ry: 0.06, fuerza: 0.12, velocidad: 0.6, color: "#ff3a3a" },
        { tipo: "centelleo", x: 0.12, y: 0.5, rx: 0.1, ry: 0.035, fuerza: 0.55, velocidad: 0.9 },
        { tipo: "centelleo", x: 0.73, y: 0.55, rx: 0.07, ry: 0.025, fuerza: 0.5, velocidad: 0.8 },
        { tipo: "viento", x: 0.17, y: 0.525, rx: 0.03, ry: 0.03, fuerza: 0.5, velocidad: 1.2 },
        { tipo: "viento", x: 0.775, y: 0.53, rx: 0.035, ry: 0.04, fuerza: 0.5, velocidad: 1.1 },
        { tipo: "agua", x: 0.5, y: 0.635, rx: 0.025, ry: 0.035, fuerza: 0.5, velocidad: 0.9 },
        { tipo: "niebla", x: 0.51, y: 0.72, rx: 0.08, ry: 0.07, fuerza: 0.5, velocidad: 0.4 },
      ],
    },
  },
  {
    id: "tanzen",
    orden: 17,
    tipo: "poema",
    titulo: "TANZEN",
    imagen: {
      src: "/libro/tanzen.png",
      alt: "Un salón de baile en penumbra, de noche. En primer plano, una pareja baila abrazada, frente con frente y con los ojos cerrados: él de traje oscuro, ella con un vestido de encaje rojo oscuro y una rosa roja en el pelo. Alrededor, otras parejas bailan en la sombra. A la izquierda, un cortinado de terciopelo rojo y arañas con velas encendidas; a la derecha, ventanales altos con luz azul de luna.",
    },
    texto: `
Nos balanceamos,
entregados y apasionados.

Ella me acerca.
Beso suavemente su rostro
y la música se confunde
con su respiración.

Sus labios rozan mi oído.

Nunca imaginé
que bailar pudiera sentirse así.
`,
    significado: {
      texto: `
«Tanzen» significa «bailar»: cuando dos cuerpos encuentran su propio ritmo.
`,
      enLaImagen: true,
    },
    escena: {
      lugar: "salon",
      elementos: [
        {
          imagen: "pareja-baile",
          nombre: "Pareja",
          x: 0.45,
          y: 0.72,
          alto: 2.2,
          ancho: 2,
          mueve: "baila",
          dice: ["Bailan tan juntos que no te ven. La música se confunde con su respiración."],
        },
        { imagen: "bailarines", nombre: "Bailarines", x: 0.06, y: 0.74, alto: 2.1, mueve: "baila", copias: 2, dice: [] },
        { imagen: "bailarines", nombre: "Bailarines", x: 0.9, y: 0.75, alto: 2.1, mueve: "baila", espejado: true, dice: [] },
        {
          imagen: "arana",
          nombre: "Araña",
          x: 0.06,
          y: 0.53,
          alto: 2,
          mueve: "llama",
          luz: { color: "#ffc070", alcance: 3, altura: 0.7 },
          dice: ["Cinco velas encendidas. La cera cae despacio, al ritmo de la música."],
        },
        { imagen: "arana", nombre: "Araña", x: 0.96, y: 0.655, alto: 2, mueve: "llama", espejado: true, luz: { color: "#ffc070", alcance: 3, altura: 0.7 }, dice: [] },
        {
          imagen: "ventanal",
          nombre: "Ventanal",
          x: 0.92,
          y: 0.5,
          alto: 3.2,
          ancho: 2,
          luz: { color: "#7d9cff", alcance: 3.2, altura: 0.6 },
          dice: ["Afuera es de noche y hace frío. Acá adentro nadie se da cuenta."],
        },
        { imagen: "telon", nombre: "Cortinado", x: 0.05, y: 0.4, alto: 3.6, dice: ["Terciopelo rojo, pesado. Del otro lado no llega ningún ruido."] },
      ],
    },
    tono: "#d14a5c",
    clima: {
      particulas: [{ tipo: "polen", cantidad: 0.35 }],
      zonas: [
        { tipo: "luz", x: 0.06, y: 0.525, rx: 0.06, ry: 0.035, fuerza: 0.22, velocidad: 2.6, color: "#ffc070" },
        { tipo: "luz", x: 0.08, y: 0.665, rx: 0.05, ry: 0.025, fuerza: 0.2, velocidad: 2.2, color: "#ffc070" },
        { tipo: "luz", x: 0.96, y: 0.655, rx: 0.05, ry: 0.025, fuerza: 0.2, velocidad: 2.4, color: "#ffc070" },
        { tipo: "luz", x: 0.93, y: 0.48, rx: 0.08, ry: 0.16, fuerza: 0.1, velocidad: 0.4, color: "#6f95ff" },
        { tipo: "centelleo", x: 0.06, y: 0.525, rx: 0.06, ry: 0.035, fuerza: 0.5, velocidad: 1.1 },
        { tipo: "centelleo", x: 0.96, y: 0.655, rx: 0.05, ry: 0.02, fuerza: 0.5, velocidad: 1 },
        { tipo: "viento", x: 0.04, y: 0.39, rx: 0.045, ry: 0.09, fuerza: 0.4, velocidad: 0.5 },
        { tipo: "agua", x: 0.79, y: 0.865, rx: 0.035, ry: 0.025, fuerza: 0.5, velocidad: 0.6 },
      ],
    },
  },
];

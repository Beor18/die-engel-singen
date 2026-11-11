# Die Engel Singen (Los ángeles cantan)

Libro visual de poemas de Fernando López, hecho experiencia web.

Cada poema tiene su clima: la lluvia, la niebla y las luces se mueven sobre la imagen original, y al pasar de página la lluvia lava una imagen para revelar la siguiente. El texto dentro de las imágenes nunca se toca.

## Agregar una página

Solo hacen falta dos pasos. La navegación, el índice, la dirección, el sitemap y las imágenes para compartir se arman solos.

**1. Copiá la imagen** a `public/libro/`, en formato vertical 9:16. Por ejemplo, `public/libro/mi-poema.png`.

**2. Agregá la página** al final de la lista en [`src/contenido/libro.ts`](src/contenido/libro.ts):

```ts
{
  id: "mi-poema",             // la dirección será /poema/mi-poema
  orden: 9,                   // posición en el libro
  tipo: "poema",
  titulo: "Mi poema",         // tal como aparece, o null si no tiene
  imagen: {
    src: "/libro/mi-poema.png",
    alt: "Qué se ve en la imagen, para quien no puede verla.",
  },
  texto: `
Primera línea del poema,
segunda línea.

Una línea en blanco separa estrofas.
`,
  significado: {
    texto: `
Primera línea del significado,
segunda línea.
`,
  },
  tono: "#8fb0c8",            // color de acento de la página
  clima: {
    particulas: [{ tipo: "lluvia" }],
  },
},
```

Con eso ya está. Antes de publicar, corré `pnpm check`.

### Campos

| Campo | Para qué sirve |
|-------|----------------|
| `id` | Identificador y dirección. Solo minúsculas, números y guiones |
| `orden` | Posición. Las páginas se ordenan solas por este número |
| `titulo` | Título tal como aparece. Si es `null`, sumá `nombre` |
| `nombre` | Nombre en la pestaña y al compartir, para páginas sin título |
| `nombreEnIndice` | Opcional: nombre solo para el índice, si tiene que ser distinto |
| `imagen` | Archivo y descripción de la imagen |
| `texto` | El poema. Si ya está en la imagen no se dibuja encima: se usa en el modo Texto, en los buscadores y en los lectores de pantalla |
| `significado.texto` | Se dibuja en cursiva con el adorno, respetando tus saltos de línea |
| `significado.enLaImagen` | `true` si el significado ya está en la imagen, para no duplicarlo |
| `significado.banda` | `"suave"` por defecto, o `"solida"` para una banda opaca |
| `tono` | Color de acento: progreso y luz alrededor de la página |
| `compartir` | Opcional: `titulo` y `descripcion` propios. Si faltan, salen del título y de las primeras líneas |
| `clima` | Opcional: el clima de la página. Sin clima, la página queda quieta |

### El clima de una página

```ts
clima: {
  particulas: [{ tipo: "lluvia", cantidad: 0.9 }],
  relampagos: true,
  zonas: [
    // Coordenadas de 0 a 1, con origen arriba a la izquierda
    { tipo: "agua", x: 0.5, y: 0.86, rx: 0.14, ry: 0.05 },
    { tipo: "luz", x: 0.9, y: 0.56, rx: 0.08, ry: 0.05, color: "#ffd08a", velocidad: 2.8 },
  ],
},
```

- **Partículas**: `lluvia`, `petalos`, `polen`, `confeti`.
- **Zonas**, hasta 10 por página:
  - `agua`: reflejos que tiemblan.
  - `viento`: pastos, hojas, tela.
  - `nube`: el cielo que respira.
  - `niebla`: velo que se desplaza. Solo aparece sobre las partes claras de la imagen.
  - `luz`: pulso de luz, con `color`.
  - `humo`: columna que sube, con `color`.
  - `centelleo`: las luces encendidas de la imagen titilan.

Nunca pongas `agua`, `viento`, `nube` ni `centelleo` sobre texto integrado en la imagen: lo deformarían o lo harían titilar. La `luz` sí puede pasar por encima, porque solo aclara.

## Trabajar en el proyecto

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # tipos, lint y compilación
```

## Cómo está armado

```
src/contenido/libro.ts      El libro: textos, imágenes y clima de cada página
src/contenido/index.ts      Ordena y valida las páginas
src/app/(libro)/            Rutas: / y /poema/[id]. Aportan texto y metadatos
src/experiencia/Lector.tsx  El lector: navegación, gestos, teclado y apertura
src/experiencia/Hojas.tsx   Índice, modo Texto y Compartir
src/experiencia/vivo.ts     WebGL: zonas vivas y lavado entre páginas
src/experiencia/clima.ts    Canvas: lluvia, pétalos, polen y papel dorado
src/lib/metadatos.ts        SEO, Open Graph, Twitter y datos estructurados
src/lib/tarjetas.tsx        Imágenes para compartir, generadas al compilar
docs/inventario.md          Inventario del PDF y medidas tomadas de él
```

Decisiones que conviene conservar:

- **La imagen original siempre está debajo.** La capa WebGL es transparente salvo en sus zonas, así el texto sigue siendo el `<img>` nítido. Si WebGL falla, el libro se ve igual, con fundidos en lugar del lavado.
- **En celular se pasa de página en vertical**, como al bajar por cualquier página: el dedo sube y el lavado lo sigue. Si se suelta antes de un tercio, vuelve atrás. Un toque solo muestra u oculta los controles, nunca cambia de página.
- **Con movimiento reducido** no hay apertura, clima ni lavado: solo un fundido breve. Lo mismo pasa si se elige **Quitar el movimiento** en el índice.
- **Sin JavaScript** se ven la página y los enlaces a la anterior y la siguiente.
- **El texto nunca se muestra dos veces.** Está en HTML solo para lectores de pantalla y buscadores, y a la vista únicamente si se abre el modo Texto.

## El juego: La Voz

En `/juego` está **La Voz**, un juego hecho con el libro. Sos la última luz encendida; las sombras se comieron los versos y los ángeles se quedaron callados. Cada poema es un nivel: caminás por casillas adentro de la pintura, rescatás sus estrofas, enfrentás a las sombras cantando y, al final, la página se revela entera con su significado. Cada página rescatada le suma una voz al coro.

**Una página nueva es un nivel nuevo, sin tocar el juego.** Todo sale de `src/contenido/libro.ts`:

| Del libro | En el juego |
|-----------|-------------|
| La imagen | El mapa: lo claro se camina y lo oscuro es pared. El piso de adoquines toma los colores y la luz de la pintura, sin su texto. Al terminar, el mapa se convierte en la pintura |
| Las estrofas | Los versos que hay que rescatar, entre 3 y 7 por nivel |
| El significado | Lo que dice el ángel: se entiende a medida que aparecen los versos |
| `luz` del clima | Faroles: recuperan la luz y guardan el lugar |
| `agua` | Agua que no se puede cruzar |
| `niebla`, `nube`, `humo` | Penumbra, donde pueden aparecer sombras |
| `particulas` y `relampagos` | La lluvia, los pétalos, el polen y los relámpagos del nivel |
| `tono` | El color de la página |
| `alt` de la imagen | La descripción con que empieza el nivel |
| `escena` | Los personajes y objetos de la pintura, adentro del nivel, y el tipo de lugar |

El mismo id genera siempre el mismo mapa. Los niveles se juegan en el orden del libro y la dificultad sube con el número de página.

### La escena de un nivel

Lo que muestra la pintura aparece adentro del nivel, en el lugar donde está en la pintura: las personas se pueden saludar, los objetos se pueden mirar, y al revelar la página quedan justo sobre su dibujo. Después de hablar con alguien, una estela de luz te muestra el verso más cercano.

```ts
escena: {
  lugar: "cuarto", // campo, camino, calle, salon, cuarto, teatro o pasillo: cambia el piso y las paredes
  elementos: [
    {
      imagen: "hombre-fuma", // public/juego/escenas/hombre-fuma.webp
      nombre: "Hombre",
      persona: true, // habla él; sin esto, lo describe el narrador
      x: 0.2, y: 0.74, // dónde está en la pintura, de 0 a 1
      alto: 2, // en casillas; la Voz mide 1,75
      mueve: "fuma",
      humo: { x: 0.46, y: 0.1 }, // de dónde sale el humo, sobre la imagen
      dice: ["Ya no cuento cuántas tomo. Las cuenta el frasco."],
    },
    { nombre: "Neón", x: 0.74, y: 0.68, mueve: "titila", luz: { color: "#ff3355", alcance: 3 }, dice: [] },
  ],
},
```

- **`mueve`**: `respira`, `quieto`, `fuma`, `vapor`, `seAleja` y `corre` (hacia `hasta`), `seAcerca` (hacia `hasta`, un paso por cada verso), `baila`, `aplaude`, `marioneta`, `viento`, `titila`, `gira`, `llama`, `refleja` (un espejo, con `vidrio`), `sombra` y `brilla`.
- **Otros campos**: `ancho` en casillas, `pasable`, `espejado`, `luz` con `color`, `alcance` y `altura`, `copias` para desparramar decoración, `levantar` para algo que se guarda al pisarlo, y `conObjeto` para lo que se dice si ya se levantó otra cosa (la llave y la puerta de PRISIÓN).
- **Imágenes**: se generaron con ChatGPT a partir de la ilustración de cada página, en hojas de una fila sobre fondo transparente, y se cortaron en un WebP por elemento. Si falta una imagen, una persona se dibuja como silueta y un objeto no aparece.

### Recuerdos, baúl y voz

Cada página esconde un **recuerdo**: un objeto chico de su escena marcado con `recuerdo` y el nombre de su don. Al pisarlo queda para siempre en el **baúl**, y mientras la Voz lo lleva encima le da ese don.

```ts
{ imagen: "moneda", nombre: "Moneda", x: 0.86, y: 0.54, alto: 0.4, pasable: true, levantar: true, mueve: "brilla", recuerdo: "suerte", dice: ["Una moneda gastada al pie del árbol. La guardás."] },
```

- **Uno por página**, con `levantar`, `pasable` e imagen propia: el nombre de la imagen lo identifica en el baúl, así que no se repite en otra página. El sitio no compila si falta algo de esto.
- **Dones**: `destello`, `suerte`, `pausa`, `iman`, `paso`, `sigilo`, `espina`, `gloria`, `aguante`, `brindis`, `mirada`, `despertar`, `hilo`, `reflejo`, `llama`, `sello`, `mando`, `compas`, `despacio` y `frente`. Qué hace cada uno está en `src/contenido/tipos.ts`; lo que lee quien juega, en `src/game/keepsakes.ts`.
- **Llevar**: se lleva un recuerdo a la vez, dos desde el rango Canto y tres desde Coral. Se cambian en el baúl, que se abre desde el título, el coro o la pausa.
- **Reacciones**: `conObjeto` también vale para los recuerdos que se llevan desde otra página (el Rey de papel le habla distinto a quien lleva la corona).
- **La voz** es la experiencia: suma con cada verso, cada nota respondida, cada sombra vencida, cada recuerdo y cada página, y un extra si la luz no se apaga nunca. Al subir de rango (Susurro, Murmullo, Voz clara, Canto, Himno, Coral, Voz de ángel) gana llamas y lugar para llevar más recuerdos. Los valores y los rangos están en `src/game/keepsakes.ts`.
- **Tres marcas por página**, a la vista en el coro: rescatada, recuerdo encontrado y terminada sin que la luz se apague.
- **La ladrona**: en la mayoría de las páginas, una sombra chiquita roba un verso recién rescatado y sale corriendo. Hay que alcanzarla; cantarle de cerca la deja quieta. La primera vez que se la atrapa suelta la pluma de ángel, el único recuerdo que no está en ninguna página.

- **Controles:** flechas o WASD para caminar y Espacio para hablar o cantar. Esc pausa y M silencia. En celular hay un círculo para caminar, un botón ✦, y también se puede tocar adonde ir.
- **Celular acostado:** el juego se juega igual con la pantalla en horizontal. El círculo y el botón ✦ van a las esquinas de abajo y se corren mientras alguien habla; en la batalla, el nombre de la sombra va a la izquierda y sus palabras a la derecha, para que la sombra y tu luz usen todo el alto. Las reglas están al final de `src/game/game.css`, en `@media (orientation: landscape) and (max-height: 520px)`: cualquier pantalla nueva tiene que entrar ahí también (se prueba en 740 x 340 y en 568 x 300). Donde el navegador lo permite, el título y la pausa ofrecen **Pantalla completa**, que en horizontal devuelve el alto que ocupan las barras.
- **Batallas:** son de pregunta y respuesta, con un pulso que se escucha. La sombra canta una frase de notas oscuras que bajan hasta tu luz, y se responde cada una con Espacio (o tocando la pantalla) justo cuando toca el anillo. Cada nota respondida vuelve como luz y le quita oscuridad a la sombra; la primera que se escapa en una frase te baja la luz. Una frase entera respondida te devuelve luz y hace recordar un verso ya rescatado, que pega más fuerte. La primera batalla es un ensayo guiado que no puede salir mal. Cada sombra canta a su manera según su nombre (Miedo se apura, Olvido borra sus notas, Ruido va a destiempo, Vacío deja silencios, Vergüenza llega de costado, Mañana hace esperar), y el guardián mezcla las de su página. De las sombras que andan sueltas se puede huir con H o con el botón. Las reglas y los tiempos están en `src/game/battle.ts`.
- **Sonido:** todo se sintetiza en el navegador, sin archivos. Hay volumen general, música y efectos, y se guarda en el navegador junto con el progreso.
- **Gráficos:** estilo pintado y realista. Cada nivel se pinta en el navegador a partir de su página: un piso según el lugar (tierra de campo, asfalto, adoquines, mármol, madera o losas) teñido con los colores de la pintura, paredes de papel tapiz en los interiores, paredes de roca con volumen y sombra, agua, niebla que se mueve y charcos cuando llueve. La luz del farol de la Voz y la de los faroles proyecta sombras detrás de las paredes y las rocas, y lo que ya recorriste queda apenas visible. La Voz camina de verdad: sus piernas se recortan de la pintura al cargar y dan pasos, mientras la capa se mece y el cuerpo sube y baja con cada paso.
- **Imágenes:** todas se generaron con ChatGPT. Los retratos y la portada están en `public/juego/`; las texturas y las figuras del mundo (la Voz en tres poses, el ángel, el farol, la pluma, la roca y los pisos y paredes de cada `lugar`), en `public/juego/arte/`; los personajes y objetos de cada pintura, en `public/juego/escenas/`. Si alguna no carga, el juego dibuja una figura más simple. La imagen para compartir, `/juego/compartir.jpg`, se arma al compilar.
- **Pruebas:** con `/juego?prueba=1`, la consola tiene `__laVoz` con atajos para juntar los versos, pelear (`fight("Miedo")` elige la sombra), ver las notas de la batalla (`battle()`), responder (`press()`), revelar la página, caminar hasta una casilla (`walkTo(x, y)`), ver dónde faltan versos (`verses()`), dónde está el recuerdo (`keepsake()`), hacer aparecer a la ladrona (`thief()`) o alejar las sombras (`calm()`), que sirve para filmar.

```
src/game/level.ts    Genera el mapa de un nivel a partir de su página
src/game/art.ts      Pinta el mundo del nivel a partir de su página: piso, paredes, agua y niebla
src/game/painted.ts  Carga las figuras pintadas y los pisos de cada lugar; dibuja la Voz, el humo de las sombras y la estrella
src/game/scene.ts    Carga los personajes y objetos de cada pintura y dibuja su humo, sus hilos y la corona
src/game/engine.ts   Exploración, batallas, luces y revelación, en canvas
src/game/battle.ts   Reglas de la batalla: cómo canta cada sombra, sus frases y los tiempos
src/game/keepsakes.ts Recuerdos, dones, rangos de la voz y lo que suma cada cosa
src/game/progress.ts Lo que se guarda en el navegador: páginas, recuerdos, voz y sonido
src/game/audio.ts    Coro, música de batalla y efectos con Web Audio
src/game/sprites.ts  Figuras de repuesto, por si no cargan las pintadas
src/game/Game.tsx    Pantallas, diálogos, baúl, controles táctiles y sonido
```

El código del juego está en inglés; los textos que se ven, en castellano.

## Publicar

El proyecto está en Vercel. Con el repositorio conectado, cada `git push` a `main` publica solo. También se puede publicar a mano con `vercel --prod`.

### Vercel Web Analytics

Ya está integrado con `@vercel/analytics` y activado en el proyecto `die-engel-singen`. Las visitas se ven en el panel de Vercel, en la pestaña **Analytics**. No cuenta navegadores automatizados.

Si alguna vez publicás el sitio en otro proyecto de Vercel, hay que activarlo de nuevo: abrí **Analytics** en ese proyecto y tocá **Enable**. Sin ese paso el sitio funciona igual, pero no cuenta visitas.

### Dominio propio

1. En Vercel, entrá a **Settings > Domains** y agregá el dominio.
2. En **Settings > Environment Variables**, definí `NEXT_PUBLIC_SITE_URL` con la dirección completa, por ejemplo `https://dieengelsingen.com`.
3. Volvé a publicar. Las URL canónicas, el sitemap y las vistas previas pasan a usar ese dominio.

Sin esa variable se usa el dominio de producción que informa Vercel, así que el sitio siempre apunta a una dirección real.

### Cambiar una imagen

Guardá la versión nueva con otro nombre de archivo y actualizá `imagen.src` en `libro.ts`. Si reemplazás un archivo con el mismo nombre, los navegadores pueden seguir mostrando el anterior hasta un mes.

Si la imagen trae integrado el adorno de líneas y estrella, tiene que ir del rojo de la portada, `#98121A`.

### Vistas previas al compartir

- WhatsApp, Facebook, X y otras redes leen las imágenes de `/compartir/<id>.jpg`, de 1200 x 630 y menos de 100 KB.
- Instagram no muestra vistas previas de enlaces en publicaciones. Por eso Compartir ofrece **Imagen para Instagram**, que entrega la página completa en 1080 x 1920 lista para subir como historia.
- Si cambiás una imagen después de haber compartido el enlace, las redes pueden tardar en actualizarla. En Facebook se fuerza desde su [depurador de contenido compartido](https://developers.facebook.com/tools/debug/).

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

### Vistas previas al compartir

- WhatsApp, Facebook, X y otras redes leen las imágenes de `/compartir/<id>.jpg`, de 1200 x 630 y menos de 100 KB.
- Instagram no muestra vistas previas de enlaces en publicaciones. Por eso Compartir ofrece **Imagen para Instagram**, que entrega la página completa en 1080 x 1920 lista para subir como historia.
- Si cambiás una imagen después de haber compartido el enlace, las redes pueden tardar en actualizarla. En Facebook se fuerza desde su [depurador de contenido compartido](https://developers.facebook.com/tools/debug/).

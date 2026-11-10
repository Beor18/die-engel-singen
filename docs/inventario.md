# Inventario del PDF

Fuente: `Die_Engel_Singen_Fernando_Lopez_actualizado.pdf`, 9 páginas de 540 x 960 puntos (9:16).
Cada página trae una imagen de 941 x 1672 px, extraída sin recomprimir a `public/libro/`.

| Pág. | Archivo | Título en la página | Texto del poema | Significado |
|------|---------|---------------------|-----------------|-------------|
| 1 | `portada.png` | DIE ENGEL SINGEN | En la imagen | No tiene |
| 2 | `hay-decisiones.png` | Sin título | En la imagen | Texto del PDF, 3 líneas |
| 3 | `no-se.png` | NO SÉ | En la imagen | Texto del PDF, 2 líneas |
| 4 | `entre-opuestos.png` | ENTRE OPUESTOS | En la imagen | Texto del PDF, 2 líneas |
| 5 | `marathon.png` | Marathon | En la imagen | Texto del PDF, 3 líneas |
| 6 | `auslander.png` | Ausländer | En la imagen | Texto del PDF, 2 líneas |
| 7 | `prostitution.png` | PROSTITUTION | En la imagen | Texto del PDF, 2 líneas, banda sólida |
| 8 | `platz-eins-rojo.png` | PLATZ EINS | En la imagen | En la imagen, no se dibuja encima |
| 9 | `pills-bajo-control-rojo.png` | PILLS BAJO CONTROL | En la imagen | Texto del PDF, 2 líneas, banda sólida |
| 10 | `guten-appetit-rojo.png` | GUTEN APPETIT | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |
| 11 | `prohibido.png` | PROHIBIDO | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |
| 12 | `morgen.png` | MORGEN | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |
| 13 | `el-rey-de-papel.png` | EL REY DE PAPEL | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |
| 14 | `spiegel.png` | SPIEGEL | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |
| 15 | `dosis.png` | DOSIS | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |
| 16 | `prision.png` | PRISIÓN | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |
| 17 | `entre-dos-tierras.png` | ENTRE DOS TIERRAS | En la imagen | En la imagen, no se dibuja encima. Agregada después: no está en el PDF |

## Medidas tomadas del PDF

Estas medidas salen de los comandos de dibujo del propio PDF y se usan tal cual en `src/experiencia/lector.css`, en puntos de una página de 540 de ancho.

| Elemento | Medida |
|----------|--------|
| Significado | STIX cursiva, 22 pt, interlineado 25,08 pt, centrado |
| Última línea del significado | Línea de base a 40,08 pt del borde inferior |
| Adorno | 34 pt por encima de la primera línea del significado |
| Líneas del adorno | De x = 160 a 258 y de x = 282 a 380 |
| Estrella del adorno | Cuatro puntas, 14 pt de ancho por 18 pt de alto, centrada en x = 270 |
| Banda oscura | Color rgb(2, 3, 5), hasta 132 pt de alto, se disuelve a 168 pt |
| Opacidad de la banda | 78 %, salvo páginas 7 y 9, que son sólidas |

## Color de los adornos

Por pedido del autor, todos los adornos van del rojo de la estrella de la portada, `#98121A`, con trazo de 1,2 pt como en la portada. En el PDF son blancos, con trazo de 0,65 pt.

Los adornos integrados en las imágenes de Platz Eins y Guten Appetit, y las líneas de Pills Bajo Control, se recolorearon píxel a píxel. Esas tres imágenes llevan `-rojo` en el nombre y el resto de cada imagen quedó idéntico al original. Los adornos de Prohibido, Morgen, El rey de papel, Spiegel, Dosis y Prisión ya venían rojos, pero más brillantes: se llevaron al mismo tono. El de Prisión tiene dos líneas a cada lado y se respetó así. El de Entre dos tierras es una flor de lis con volutas, y se llevó al mismo tono.

Entre dos tierras llegó en 992 x 1586, más ancha que 9:16. Para no recortar los costados (el lector llena el marco 9:16), se llevó a 941 de ancho y se completó hasta 1672 con cielo arriba (64 px) y suelo oscuro abajo (104 px), sin tocar nada de la pintura ni del texto.

## Particularidades del original

Se conservan tal cual porque la consigna es no corregir. Quedan anotadas para que el autor decida.

| Página | Texto | Observación |
|--------|-------|-------------|
| 2 | `(la primera sin titulo)` | Parece una nota de trabajo. "titulo" va sin tilde |
| 2 | `nuestras dudas serán traidoras y nos hará hacer perder` | "dudas" en plural, "hará" en singular |
| 3 | `Ich weiß es nicht"` | Falta la comilla de apertura |
| 3 | `(No se)` | Sin tilde, el título es NO SÉ |
| 6 | `se ria otra vez` | "ria" sin tilde |
| 9 | `y otra para volver a sentir.` | Empieza en minúscula después de un punto |
| Dosis | `aunque nadie lo cree.` | Empieza en minúscula después de un punto |
| Entre dos tierras | `Entre dos tierras estás` | Última línea sin punto final; las otras estrofas terminan con punto |

Si el libro cambia, hay que corregir la imagen y el texto de `src/contenido/libro.ts`, para que ambos sigan iguales.

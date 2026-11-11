# Money Grass — notas de la propuesta

**Idea rectora:** la página deja de ser una columna de texto con metadatos sueltos
y pasa a ser una **ficha de obra**: portada a sangre, ficha técnica a la derecha,
lectura indentada debajo.

## a) El rótulo de autoría

Recomiendo **«Créditos»**.

- Es el nombre del dato (`credits`) y el del convenio cultural: lista ordenada de
  quién hizo la obra, con rol opcional. Vale igual para una instalación que para
  una herramienta.
- Viaja a los cinco idiomas sin cambiar de registro ni de longitud: Credits /
  Crédits / Créditos / 制作人员.
- «Builders» es jerga web3: en una obra de arte suena fuera de sitio y no tiene
  equivalente natural en FR ni ZH. «Constructores» traduce literalmente lo que no
  había que traducir. «Hecho por» es una frase verbal entre rótulos que son
  sustantivos (Etiquetas, Periodo, Estado), y crece al traducirse.

Debajo, «en orden de autoría» en mono: el orden es un dato, no azar.

## b) Chips de persona

Píldora con foto circular de 26 px, nombre y, si lo hay, rol en mono. Con cuenta:
borde y flecha ↗ que se tiñe de naranja al pasar, claramente pulsable. Sin cuenta:
mismo chip, sin borde, relleno plano y tinta atenuada — se lee como dato, no como
enlace roto, y ninguna flecha promete un destino. Sin foto: disco de color de
marca con iniciales. Las tres variantes están al final, bajo el separador.

## c) Portada y galería

La portada deja de ser opcional: `thumbnail` manda y ocupa la banda superior
entera. Las capturas bajan a su propia sección con rótulo y contador, en rejilla
asimétrica (la primera a lo ancho) y numeradas: así tres capturas parecen un
conjunto y no un relleno.

## d) La portada combinada

Díptico partido por una diagonal con la línea de espectro del sitio en la costura:
izquierda la ilustración, derecha el render. El hueco pendiente está marcado con
trama y la palabra «Pendiente», no simulado. En móvil la diagonal se vuelve
horizontal y la portada se lee de arriba abajo: dibujo, costura, escena.

## e) Lo que no toco

El orden «ver antes de leer» y la tira de chips mono en mayúsculas. El orden ya es
la decisión correcta —quien llega a un proyecto quiere verlo— y los chips son la
firma técnica del sitio: cambiarlos por etiquetas de color rompería el parentesco
con el listado y con el blog.

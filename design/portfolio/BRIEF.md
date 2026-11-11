# BRIEF — rediseño de la página de un proyecto (ZEROxWORK)

Eres un diseñador de producto. Propón un diseño MEJOR para la página de detalle
de un proyecto del portfolio de zeroxwork.com. Entregas una maqueta HTML, no
código de producción. NO toques ningún archivo del repositorio.

## Qué es el sitio

ZEROxWORK: estudio/colectivo que hace arte y juegos en el metaverso, web3 y
herramientas. Tono: técnico, sobrio, un punto brutalista. Fondo oscuro por
defecto, con tema claro. Tipografías: Space Grotesk (display), Inter (texto),
JetBrains Mono (etiquetas y chips, en mayúsculas con letter-spacing).

## Estado actual (mira assets/current-page.png)

Orden actual de la página:
1. eyebrow "PORTFOLIO" (naranja) -> enlace al listado
2. H1 con el título
3. summary (párrafo gris)
4. galería (vídeo embebido + grid de capturas) — HOY VACÍA en este proyecto
5. "HECHO POR" + nombres subrayados con rol en mono detrás
6. chips: años, estado, tags
7. botones: "Visitar →" / "Repositorio →"
8. cuerpo markdown

Problemas que el dueño ve:
- los nombres de las personas son links subrayados, sin cara; quiere
  **tags de UI con la foto de la persona en un círculo**
- falta portada y faltan capturas (el campo `thumbnail` existe pero la página
  de detalle NO lo pinta en ningún sitio; sólo pinta `screenshots`)
- duda del rótulo "HECHO POR": ¿"Builders"? ¿"Constructores"? Da tu opinión
  razonada en las notas (el sitio se traduce a ES/EN/FR/PT-BR/ZH, tenlo en cuenta).

## Datos reales con los que trabajar (proyecto "Money Grass")

- título: Money Grass
- summary: "Una obra de arte concebida para recorrerla, no para contemplarla."
- cuerpo (primeros párrafos):
  "👉 Visítala en Decentraland — Genesis City, cuatro parcelas."
  "*Money Grass* es una pradera de billetes donde seres sin rostro pastan a
  ciegas, mientras que los carteles que los rodean describen una sociedad
  consumista abocada al matadero."
  "Se trata de una instalación en 3D más que de un juego: no hay nada que ganar
  ni puntuación. Lo que hace este espacio es situarte dentro de la metáfora a tu
  propia escala: llegas, caminas entre los animales que pastan, lees los
  carteles y la obra te llega o no te llega."
- tags: METAVERSE, DECENTRALAND, ART, 3D
- miembros, en este orden exacto (el orden importa, es autoría):
  1. CarlosMu — sin rol — cuenta @carlosmu — foto: assets/carlos.jpg
  2. Pablo — sin rol — cuenta @pablo — SIN foto subida
  3. Llacer — sin rol — SIN cuenta (no enlaza a ninguna parte)
- capturas disponibles: assets/shot-gate.webp, assets/shot-mooney.webp,
  assets/shot-posters.webp
- sin vídeo, sin repo; sí hay enlace externo "Visitar" (Decentraland)
- sin fechas ni estado en este proyecto (otros proyectos sí los tienen)

### Portada de Money Grass (petición explícita del dueño)
Quiere una portada que **combine la ilustración original con la representación
3D**, porque la escena 3D es una reinterpretación del dibujo. No tenemos aún el
archivo de la ilustración suelta: en la maqueta usa un hueco claramente marcado
como "ILUSTRACIÓN ORIGINAL (pendiente)" y compón con él la idea (díptico,
split diagonal, la ilustración sangrando dentro del render, lo que propongas).
Que se entienda la composición, no hace falta la imagen final.

## Restricciones duras

- Sin cambios de backend: usa sólo lo que ya devuelve la API. Los créditos ya
  traen `{ name, role, userId, handle, avatarUrl }`, así que la foto en el chip
  es viable hoy mismo.
- Si un miembro no tiene foto, el sitio genera un SVG local con sus iniciales
  sobre un disco de color de marca (rojo #EF4D42, naranja #EF8D28, azul #2F9CFB,
  cyan #47C8D6, menta #55F0B7, violeta #9B7BF0). Reprodúcelo en la maqueta.
- Un crédito sin cuenta NO enlaza: es texto, y debe distinguirse visualmente de
  los que sí enlazan, sin parecer un error.
- Debe funcionar en tema oscuro y claro, y en móvil (360px) sin scroll lateral.
- Los rótulos son traducibles a 5 idiomas: nada que dependa de que el texto sea
  corto en inglés.
- Sin librerías de componentes. CSS a mano. Puedes cargar las fuentes de Google.

## Tokens reales (cópialos tal cual)

Oscuro: --zx-bg:#0B0F13; --zx-bg-2:#0E141A; --zx-surface:#141B22;
--zx-line:rgba(255,255,255,.07); --zx-line-2:rgba(255,255,255,.13);
--zx-ink:#ECEFF2; --zx-ink-dim:#99A2AB; --zx-ink-faint:#5B6571;
--zx-red:#EF4D42; --zx-orange:#EF8D28; --zx-blue:#2F9CFB; --zx-cyan:#47C8D6;
--zx-mint:#55F0B7; --zx-hover:rgba(255,255,255,.03);

Claro: --zx-bg:#F7F6F2; --zx-bg-2:#EDEBE5; --zx-surface:#FFFFFF;
--zx-line:rgba(11,15,19,.09); --zx-line-2:rgba(11,15,19,.17);
--zx-ink:#0E1318; --zx-ink-dim:#505A64; --zx-ink-faint:#86909A;
--zx-red:#E2453A; --zx-orange:#DB720E; --zx-blue:#1F85EE; --zx-cyan:#17A3B5;
--zx-mint:#19C08A; --zx-hover:rgba(11,15,19,.035);

--zx-maxw: 1180px. Chips existentes: mono 10.5px, uppercase, letter-spacing
.08em, borde 1px var(--zx-line), radio 20px, padding 4px 10px.

## Entregables (en TU carpeta, que se te indica en el prompt)

1. `proposal.html` — una sola página autocontenida (CSS inline en <style>, un
   botón que alterne tema oscuro/claro, imágenes por ruta relativa
   `../assets/...`). Que se vea la página de Money Grass rediseñada **entera**,
   de la portada al cuerpo. Si propones variantes del chip de persona, enséñalas
   en una tira pequeña al final, bajo un separador.
2. `notes.md` — máximo 400 palabras. Qué cambia y por qué, en este orden:
   (a) el rótulo de autoría y tu recomendación concreta de palabra,
   (b) los chips de persona,
   (c) portada y galería,
   (d) la portada combinada de Money Grass,
   (e) una cosa del diseño actual que decidas NO tocar, y por qué.
   Sin relleno, sin repetir el brief.

Escribe en español. No crees más archivos que esos dos.

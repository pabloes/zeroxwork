# Rediseño de la página de proyecto

Las maquetas de las que salió el diseño que hoy tiene el portfolio. Se guardan
aquí porque vivían en una carpeta temporal y se iban a perder, y porque un
diseño acordado es una decisión: sin él, el próximo que toque estas pantallas
sólo tiene el código y ninguna razón.

No es código de producción. Son maquetas HTML sueltas, con datos inventados,
hechas para mirarlas y elegir.

## Verlas

```bash
cd design/portfolio && python3 -m http.server 8799
```

Y abrir `http://127.0.0.1:8799/merged/proposal.html`. Los botones de arriba
cambian entre tres proyectos de prueba —uno completo, uno con lo mínimo legal y
uno con todos los huecos llenos— para ver que la plantilla aguanta los tres sin
dejar agujeros. El botón de la esquina cambia a tema claro.

## Qué hay

| | |
|---|---|
| `BRIEF.md` | El encargo: qué era el sitio, qué tenía la página entonces y qué se pedía. |
| `claude/` | La propuesta de Claude Code, con sus notas. Recomendaba **«Créditos»** como rótulo de autoría. |
| `codex/` | La propuesta de Codex, con sus notas. Recomendaba **«Autoría»**. |
| `merged/` | La mezcla de las dos. **Es la elegida.** |
| `assets/` | Las imágenes que usan las maquetas, más `current-page.png`, que es cómo era la página antes. |

## Lo que se decidió

Pablo eligió `merged/`, con dos correcciones que ya están recogidas en esa
maqueta:

- **El díptico no es una maqueta de dos huecos.** Si un autor quiere una
  portada partida, la compone él y sube una sola imagen. Ni campo nuevo, ni
  migración, ni una plantilla que decida dónde cortar.
- **Fuera los pies de portada.**

El rótulo de autoría quedó en **«Créditos»**, que es lo que recomendaba la
propuesta de Claude Code y lo que usa `merged/`. La alternativa que proponía
Codex, «Autoría», se descartó al elegir la mezcla.

## Dónde está esto en el código

Implementado en el commit `2d015be`. Las reglas van en
`frontend/src/styles/portfolio.scss`, aparte de `theme.scss`; las pantallas
son `frontend/src/pages/Project.tsx`, `frontend/src/pages/Portfolio.tsx`,
`frontend/src/components/ProjectGallery.tsx`,
`frontend/src/components/ProjectCard.tsx` y
`frontend/src/components/MemberList.tsx`.

Lo que la plantilla decide sola, sin que el autor diseñe nada, está escrito al
final de la propia maqueta `merged/`. Si algo de eso cambia, cambiarlo también
ahí: es el sitio donde se explica por qué.

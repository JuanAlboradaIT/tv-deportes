# tv-deportes — datos del panel de la TV

El launcher de la TV **no calcula nada**: descarga este JSON ya procesado:

```
https://juanalboradait.github.io/tv-deportes/sports.json
```

Un GitHub Action lo regenera **cada 4 horas** y también **al hacer push** de cambios en
`config.json`, `motogp.json` o `scripts/build-sports.js`.

## Cómo cambiar el panel (sin conectar la TV)

1. Edita `config.json` y/o `motogp.json`.
2. Haz commit + push a `master`.
3. El Action regenera `sports.json` automáticamente.
4. La TV lo recoge en su siguiente refresco (**cada 30 min**), o al reiniciar el launcher.

## `config.json`

| Campo | Qué hace |
|---|---|
| `lookaheadDays` | Días hacia el futuro que se incluyen (21). |
| `maxEvents` | Máximo de eventos en el panel (20 = 10 por columna). |
| `cutoffHours` | Se ocultan los eventos que empezaron hace más de N horas (3). |
| `f1IncludePractice` | `true` para incluir Libres 1/2/3 de F1 (por defecto `false`). |
| `espnLeagues` | Competiciones de fútbol consultadas en ESPN. |
| `championsLeagueSlug` | Competición de la que se muestran **todos** los partidos. |
| `priorityTeamIds` | IDs ESPN de tus equipos (se muestran sus partidos). |
| `highlightTeamIds` | IDs ESPN que salen **en negrita**. |
| `leagueNames` | Nombre bonito de cada competición. |

### IDs ESPN de los equipos actuales

| Equipo | ID |
|---|---|
| Real Madrid | 86 |
| Almería | 6832 |
| Atlético de Madrid | 1068 |
| Barcelona | 83 |
| Manchester United | 360 |
| Manchester City | 382 |
| Paris Saint-Germain | 160 |
| Liverpool | 364 |
| Arsenal | 359 |

> Para añadir otro equipo, busca su ID en la lista de equipos de su liga:
> `https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams`
> (cambia `esp.1` por `esp.2`, `eng.1`, `fra.1`…).

## `motogp.json`

Calendario **estático** de MotoGP (no hay API gratuita). Cada evento:

```json
{ "utc": "2026-11-22T13:00:00Z", "comp": "MotoGP · GP Portugal", "name": "Carrera" }
```

- `utc` va en **UTC** (la TV lo convierte a hora de Madrid).
- Si cambias una hora, revisa la web oficial de MotoGP: es fácil equivocarse de zona.

## Comprobar que se ha generado

Abre en el navegador:

```
https://juanalboradait.github.io/tv-deportes/sports.json
```

Debe devolver un array de objetos `{ iso, name, comp, highlight }`.

## Fuentes

- **F1**: [Jolpica](https://api.jolpi.ca/ergast/f1/) (sin clave).
- **Fútbol**: [ESPN](https://site.api.espn.com/apis/site/v2/sports/soccer/) (sin clave).
- **MotoGP**: `motogp.json` (manual).

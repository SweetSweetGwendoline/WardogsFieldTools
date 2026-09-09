# Playable layout configuration

Edit `bakurani.js`, `ozeti.js`, or `zestafona.js`, save, and refresh `index.html`.
No build, server, or network connection is required.

## Temporary sharing mode

`LAYOUT_DEBUG_GATE` in `config/layouts.js` is currently `true`. Each fresh page
load starts with Debug off: every map shows Layout 1 and the layout selector
is disabled. Debug unlocks it for the current page session. Turning Debug off
returns to Layout 1 without overwriting the last saved choice for each map.
Debug itself is not remembered; layout choices made while unlocked are saved.

When the data is ready, set `LAYOUT_DEBUG_GATE = false`. The Debug button
disappears, the selector is enabled, and saved selections are restored normally.
No layout data or saved choices need to be migrated.

Each file has three layout slots. Their IDs are stable storage keys; names
can be changed to actual in-game names when known. Add or remove layout objects
if the confirmed count differs. Four towers and three faction spawns are
provided as editable slots, not enforced as a game rule.

## Data readiness

Unconfirmed coordinates stay null. Layout 1 is the current editable dataset;
layouts 2 and 3 have empty positions. Keep provenance and data confidence in
the central docs/PROVENANCE.md document, not in runtime fields or labels.

## Fields

| Field | Meaning |
| --- | --- |
| `id` | Unique, stable ID within this map, e.g. `layout-1`. |
| `name` | Text shown in the layout selector. |
| `controlZone.x`, `.y` | Centre in calculator coordinates. |
| `controlZone.radiusMeters` | Radius in metres, not diameter. 500 means a 1 km-wide circle. |
| `towers` | Tower objects with `number`, `x`, and `y`. |
| `spawns` | Spawn objects with `name`, `x`, and `y`. |

Use decimal dots in JavaScript: `80.52`, not `80,52`. X increases east and Y
increases north. One coordinate unit equals 100 metres. Enter the same X/Y
values you would type into the calculator; do not enter raw game-world units
or image pixel positions.

For example, to update a tower to X80.52 Y69.85:

```js
{ number: 1, x: 80.52, y: 69.85 }
```

To set a zone centre and radius:

```js
controlZone: { x: 79.697, y: 71.656, radiusMeters: 500 }
```

Keep unknown coordinates as `null`. Set `controlZone: null` to omit the zone;
use `towers: []` or `spawns: []` to omit those marker groups. Zero is a real
coordinate and must not be used as an unknown placeholder. Editing towers
does not automatically recalculate the zone centre.

The Overlay icon toggles all three groups together. Empty layouts show no
overlays, while firing/target positions and weapon range circles still work.
All zone boundaries use a solid outline.
Map changes fit the whole terrain; layout changes preserve the current view.

The scripts load after `config/layouts.js` (the registry) and before `src/ui/field-map.js`.
Terrain calibration remains in `data/maps.js` and does not vary with layout.

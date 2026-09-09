# Appearance configuration

Edit these plain JavaScript files and refresh the page. No build is needed.

| File | Purpose |
| --- | --- |
| cursor.js | Custom aiming cursor: colors, centre shape, precision dot and guides. |
| overlays.js | Zone, tower and spawn appearance, including legend colors and symbols. |
| layouts.js | Layout registry and temporary Debug gate. |
| layouts/*.js | Per-layout positions and zone radius in calculator units/metres. |

Appearance never changes coordinates, calculation, or the zone's physical size.
All visual sizes are CSS pixels, so markers keep their screen size while zooming.
Color strings accept CSS color syntax. Opacity values run from 0 to 1.

## Cursor

`CURSOR_APPEARANCE` defines:

- `targetColor` and `sourceColor`: normal cursor and Shift/Ctrl artillery cursor.
  Each color applies to the ring/square, precision dot and guide lines.
- `center.shape`: `"circle"` or `"square"`.
- `center.size`: circle diameter or square side length.
- `center.lineWidth`: outline thickness.
- `center.dotRadius`: precision dot radius; use `0` to hide it.
- `guides.visible`, `opacity`, `lineWidth`, `gap`: guide visibility, transparency,
  thickness and distance from the exact cursor point to the start of each line.
  The renderer keeps the gap at least half the centre size.

For a square with a dot, change only `center.shape` to `"square"`.
The cursor still hides during right-button pan, which shows the grabbing hand.
These controls are interaction behavior, separate from appearance settings.

## Overlays

`OVERLAY_APPEARANCE.zone` sets the shared fill/outline/legend color, independent
fill and outline opacity, and outline thickness. The zone remains a circle
because its layout data defines a radius; changing its appearance does not
change its geometry.

`tower` and `spawn` support `"circle"`, `"square"`, `"triangle"` and `"diamond"`.
Both define `size`, `color` (label and legend), `strokeColor`, `fillColor`,
`lineWidth` and `labelFont`. Change both `color` and `strokeColor` when you want
the outline, label and legend to use the same color.

Tower numbers stay centred inside the symbol. Spawn names stay below it;
`labelOffset` controls that spacing. `labelOutlineColor` and `labelOutlineWidth`
control the spawn text halo. The legend automatically uses the configured shape.

## Interfaces

The controller passes `{ cursor: CURSOR_APPEARANCE, overlays: OVERLAY_APPEARANCE }`
as the `appearance` argument to `createFieldMap`. The map view does not read
the config globals directly and does not mutate the appearance object.

`MapSymbols.trace(context, shape, x, y, size)` constructs a canvas path.
`MapSymbols.marker(context, point, style)` fills/strokes a configured marker,
preserving the caller's canvas styles. `MapSymbols.glyphs` maps shapes to legend
symbols. `MapSymbols.validate(appearance)` checks supported shapes and numeric
ranges at map initialization; invalid configuration reports a descriptive error.

To add a new marker shape, extend the geometry and glyph mapping together in
src/ui/map-symbols.js. Cursor shapes are intentionally limited to circle/square.

"use strict";

// Shared canvas geometry and legend glyphs. No map state or coordinate conversion.
const MapSymbols = (() => {
    const glyphs = Object.freeze({ circle: "○", square: "□", triangle: "△", diamond: "◇" });

    function trace(context, shape, x, y, size) {
        const half = size / 2;
        context.beginPath();
        switch (shape) {
            case "circle":
                context.arc(x, y, half, 0, Math.PI * 2);
                break;
            case "square":
                context.rect(x - half, y - half, size, size);
                break;
            case "triangle":
                context.moveTo(x, y - half);
                context.lineTo(x + half, y + half * 6 / 7);
                context.lineTo(x - half, y + half * 6 / 7);
                context.closePath();
                break;
            case "diamond":
                context.moveTo(x, y - half);
                context.lineTo(x + half, y);
                context.lineTo(x, y + half);
                context.lineTo(x - half, y);
                context.closePath();
                break;
            default:
                throw new Error(`Unsupported map symbol: ${shape}`);
        }
    }

    function marker(context, point, style) {
        context.save();
        trace(context, style.shape, point.x, point.y, style.size);
        context.fillStyle = style.fillColor;
        context.strokeStyle = style.strokeColor;
        context.lineWidth = style.lineWidth;
        context.fill();
        context.stroke();
        context.restore();
    }

    function validate({ cursor, overlays }) {
        function text(value, path) {
            if (typeof value !== "string" || !value.trim()) throw new Error(`${path} must be a nonempty string`);
        }
        function number(value, path, min, max = Infinity) {
            if (!Number.isFinite(value) || value < min || value > max) {
                throw new Error(`${path} must be between ${min} and ${max}`);
            }
        }
        if (!["circle", "square"].includes(cursor.center.shape)) throw new Error("cursor.center.shape must be circle or square");
        text(cursor.targetColor, "cursor.targetColor");
        text(cursor.sourceColor, "cursor.sourceColor");
        if (typeof cursor.guides.visible !== "boolean") throw new Error("cursor.guides.visible must be true or false");
        number(cursor.center.size, "cursor.center.size", 1);
        number(cursor.center.lineWidth, "cursor.center.lineWidth", 0.1);
        number(cursor.center.dotRadius, "cursor.center.dotRadius", 0);
        number(cursor.guides.opacity, "cursor.guides.opacity", 0, 1);
        number(cursor.guides.lineWidth, "cursor.guides.lineWidth", 0.1);
        number(cursor.guides.gap, "cursor.guides.gap", 0);
        number(overlays.zone.fillOpacity, "overlays.zone.fillOpacity", 0, 1);
        number(overlays.zone.strokeOpacity, "overlays.zone.strokeOpacity", 0, 1);
        number(overlays.zone.lineWidth, "overlays.zone.lineWidth", 0.1);
        text(overlays.zone.color, "overlays.zone.color");
        for (const kind of ["tower", "spawn"]) {
            const style = overlays[kind];
            if (!Object.hasOwn(glyphs, style.shape)) throw new Error(`overlays.${kind}.shape is unsupported`);
            number(style.size, `overlays.${kind}.size`, 1);
            number(style.lineWidth, `overlays.${kind}.lineWidth`, 0.1);
            for (const field of ["color", "strokeColor", "fillColor", "labelFont"]) text(style[field], `overlays.${kind}.${field}`);
        }
        number(overlays.spawn.labelOffset, "overlays.spawn.labelOffset", 0);
        number(overlays.spawn.labelOutlineWidth, "overlays.spawn.labelOutlineWidth", 0.1);
        text(overlays.spawn.labelOutlineColor, "overlays.spawn.labelOutlineColor");
    }

    return Object.freeze({ trace, marker, glyphs, validate });
})();

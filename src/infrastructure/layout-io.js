"use strict";

// Canonical data boundary: validate, never infer units or convert coordinates.
const LayoutIO = (() => {
    function validate(value, mapIds) {
        const errors = [];
        const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
        const fail = (path, message) => errors.push(`${path}: ${message}`);
        function fields(value, names, path) {
            if (!object(value)) { fail(path, "expected an object"); return false; }
            for (const key of Object.keys(value)) if (!names.includes(key)) fail(`${path}.${key}`, "unknown field");
            for (const key of names) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "required field");
            return true;
        }
        function position(value, path) {
            if (value.x === null && value.y === null) return;
            if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) fail(path, "x and y must both be finite numbers or both null");
        }
        function markers(values, key, path) {
            if (!Array.isArray(values)) { fail(path, "expected an array"); return; }
            const seen = new Set();
            values.forEach((marker, index) => {
                const at = `${path}[${index}]`;
                if (!fields(marker, [key, "x", "y"], at)) return;
                const valid = key === "number" ? Number.isInteger(marker[key]) && marker[key] > 0
                    : typeof marker[key] === "string" && marker[key].trim().length > 0;
                if (!valid) fail(`${at}.${key}`, key === "number" ? "expected a positive integer" : "expected a nonempty name");
                if (seen.has(marker[key])) fail(`${at}.${key}`, "duplicate marker identifier");
                seen.add(marker[key]);
                position(marker, at);
            });
        }
        if (!fields(value, ["version", "coordinateSystem", "maps"], "document")) return errors;
        if (value.version !== 1) fail("version", "supported version is 1");
        if (value.coordinateSystem !== CoordinateSystem.id) fail("coordinateSystem", `expected ${CoordinateSystem.id}`);
        if (!object(value.maps)) { fail("maps", "expected a map ID to layouts object"); return errors; }
        for (const [mapId, layouts] of Object.entries(value.maps)) {
            const path = `maps.${mapId}`;
            if (!mapIds.includes(mapId)) fail(path, "unknown map ID");
            if (!Array.isArray(layouts)) { fail(path, "expected an array"); continue; }
            const seen = new Set();
            layouts.forEach((layout, index) => {
                const at = `${path}[${index}]`;
                if (!fields(layout, ["id", "name", "controlZone", "towers", "spawns"], at)) return;
                if (typeof layout.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(layout.id)) fail(`${at}.id`, "expected a stable lowercase ID");
                if (seen.has(layout.id)) fail(`${at}.id`, "duplicate layout ID");
                seen.add(layout.id);
                if (typeof layout.name !== "string" || !layout.name.trim()) fail(`${at}.name`, "expected a nonempty name");
                if (layout.controlZone !== null && fields(layout.controlZone, ["x", "y", "radiusMeters"], `${at}.controlZone`)) {
                    position(layout.controlZone, `${at}.controlZone`);
                    if (!Number.isFinite(layout.controlZone.radiusMeters) || layout.controlZone.radiusMeters <= 0) fail(`${at}.controlZone.radiusMeters`, "expected a positive radius in metres");
                }
                markers(layout.towers, "number", `${at}.towers`);
                markers(layout.spawns, "name", `${at}.spawns`);
            });
        }
        return errors;
    }
    function check(value, mapIds) {
        const errors = validate(value, mapIds);
        if (errors.length) throw new Error("Invalid layout data:\n" + errors.join("\n"));
        return value;
    }
    function envelope(maps) { return { version: 1, coordinateSystem: CoordinateSystem.id, maps }; }
    return Object.freeze({
        validate,
        parse(text, mapIds) { return check(JSON.parse(text), mapIds); },
        serialize(maps, mapIds) { return JSON.stringify(check(envelope(maps), mapIds), null, 2) + "\n"; },
        validateRegistry(maps, mapIds) { return validate(envelope(maps), mapIds); },
    });
})();

"use strict";

const SolutionLink = (() => {
    // Temporary local preview. Set false after testing the share button.
    const allowLocalPreview = true;
    const supportsProtocol = protocol => ["https:", "http:"].includes(protocol)
        || (allowLocalPreview && protocol === "file:");
    const keys = ["sx", "sy", "tx", "ty"];

    function parse(hash, maps, layouts, weapons) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const required = ["map", "layout", "weapon", ...keys];
        if (required.some(key => params.getAll(key).length !== 1)) return null;
        const mapId = params.get("map");
        const layoutId = params.get("layout");
        const weapon = params.get("weapon");
        if (!maps.some(map => map.id === mapId)
            || !layouts[mapId]?.some(layout => layout.id === layoutId)
            || !Object.hasOwn(weapons, weapon)) return null;
        const coordinates = keys.map(key => Calculator.parseCoordinate(params.get(key)));
        if (!coordinates.every(Number.isFinite)) return null;
        return { mapId, layoutId, inputs: { weapon, coordinates: coordinates.map(String) } };
    }

    function create(baseUrl, { mapId, layoutId, weapon, coordinates }) {
        const url = new URL(baseUrl);
        if (!supportsProtocol(url.protocol) || !layoutId
            || coordinates.length !== 4 || !coordinates.every(Number.isFinite)) return null;
        const params = new URLSearchParams({ map: mapId, layout: layoutId, weapon });
        keys.forEach((key, index) => params.set(key, String(coordinates[index])));
        url.search = "";
        url.hash = params.toString();
        return url.href;
    }

    return Object.freeze({ parse, create, supportsProtocol });
})();

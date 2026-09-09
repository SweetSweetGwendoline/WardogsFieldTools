"use strict";

// Preserve existing keys so a refactor does not reset users' saved inputs.
function createStorage(backend) {
    const inputKey = "wardogs-calculator-inputs-v1";
    const mapKey = "wardogs-field-map-v1";
    function get(key) {
        try { return backend().getItem(key); } catch { return null; }
    }
    function set(key, value) {
        try { backend().setItem(key, value); } catch { /* Persistence is optional. */ }
    }
    return Object.freeze({
        getInputs() {
            try {
                const value = JSON.parse(get(inputKey));
                return value && Array.isArray(value.coordinates)
                    && value.coordinates.length === 4
                    && value.coordinates.every(coordinate => typeof coordinate === "string")
                    ? value : null;
            } catch { return null; }
        },
        setInputs: value => set(inputKey, JSON.stringify(value)),
        getMap: () => get(mapKey),
        setMap: id => set(mapKey, id),
        getLayout: mapId => get(`${mapKey}-layout-${mapId}`),
        setLayout: (mapId, id) => set(`${mapKey}-layout-${mapId}`, id),
    });
}

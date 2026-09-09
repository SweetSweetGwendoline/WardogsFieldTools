"use strict";

// Composition root: owns application state and connects the UI adapters.
(() => {
    const storage = createStorage(() => localStorage);
    const savedMapId = storage.getMap();
    const linked = SolutionLink.parse(window.location.hash, FIELD_MAPS, FIELD_MAP_LAYOUTS, Calculator.weapons);
    const state = {
        inputs: null,
        firing: [null, null],
        target: [null, null],
        weapon: Calculator.weapons.l81,
        solution: null,
        map: FIELD_MAPS.find(map => map.id === (linked?.mapId || savedMapId)) || FIELD_MAPS[0],
        layout: null,
        debugEnabled: false,
        overlaysVisible: true,
        gridVisible: true,
    };
    let mapView = null;
    const ui = createCalculatorUI({
        onChange: inputs => update(inputs, true),
        getShareLink: () => SolutionLink.create(window.location.href, {
            mapId: state.map.id,
            layoutId: state.layout?.id,
            weapon: state.inputs.weapon,
            coordinates: [...state.firing, ...state.target],
        }),
    });
    const saved = linked?.inputs || storage.getInputs();
    if (saved) {
        ui.setInputs({
            ...saved,
            weapon: Object.hasOwn(Calculator.weapons, saved.weapon) ? saved.weapon : ui.readInputs().weapon,
        });
    }

    function update(inputs, persist = false) {
        state.inputs = inputs;
        const coordinates = inputs.coordinates.map(Calculator.parseCoordinate);
        state.firing = coordinates.slice(0, 2);
        state.target = coordinates.slice(2, 4);
        state.weapon = Calculator.weapons[inputs.weapon];
        state.solution = Calculator.calculate({ firing: state.firing, target: state.target, weaponId: inputs.weapon });
        if (persist) storage.setInputs(inputs);
        ui.render(state.solution, inputs.weapon);
        mapView?.render();
    }

    update(ui.readInputs());
    const errors = LayoutIO.validateRegistry(FIELD_MAP_LAYOUTS, FIELD_MAPS.map(map => map.id));
    if (errors.length) {
        document.getElementById("map-message").textContent = "Invalid layout configuration. See browser console.";
        console.error(errors.join("\n"));
        return;
    }
    mapView = createFieldMap({
        state,
        maps: FIELD_MAPS,
        layouts: FIELD_MAP_LAYOUTS,
        debugGate: LAYOUT_DEBUG_GATE,
        storage,
        onPosition: ui.setPosition,
        initialLayoutId: linked?.layoutId,
    });
})();

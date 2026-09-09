"use strict";

function createFieldMap({ state, maps, layouts: layoutRegistry, debugGate, storage, onPosition, initialLayoutId, appearance }) {
    MapSymbols.validate(appearance);
    const { cursor: cursorStyle, overlays } = appearance;
    for (const kind of ["zone", "tower", "spawn"]) {
        const legend = document.getElementById(`${kind}-key`);
        legend.style.color = overlays[kind].color;
        legend.textContent = `${MapSymbols.glyphs[overlays[kind].shape || "circle"]} ${kind.toUpperCase()}`;
    }
    const METERS_PER_GRID_UNIT = CoordinateSystem.metersPerUnit;
    const canvas = document.getElementById("field-map");
    const context = canvas.getContext("2d");
    const viewport = document.getElementById("map-viewport");
    const selector = document.getElementById("map-select");
    const layoutSelector = document.getElementById("layout-select");
    const debugButton = document.getElementById("layout-debug");
    const message = document.getElementById("map-message");
    const cursor = document.getElementById("map-cursor");
    const overlayButton = document.getElementById("map-overlay");
    const gridButton = document.getElementById("map-grid");
    const images = new Map();
    const TILE_ZOOM = 4;
    const TILE_COUNT = 2 ** TILE_ZOOM;
    const MAX_ZOOM_FACTOR = 16;
    let width = 1;
    let height = 1;
    let scale = 1;
    let minimumScale = 1;
    let center = { x: 0, y: 0 };
    let drag = null;
    let framePending = false;
    let pointer = null;
    let sourceModifier = false;

    function updateSourceModifier(event) {
        const active = Boolean(event.shiftKey || event.ctrlKey);
        if (active !== sourceModifier) {
            sourceModifier = active;
            scheduleDraw();
        }
    }

    function hasPosition(point) {
        return point && Number.isFinite(point.x) && Number.isFinite(point.y);
    }

    function hasZone(zone) {
        return hasPosition(zone) && Number.isFinite(zone.radiusMeters) && zone.radiusMeters > 0;
    }

    function populateLayouts() {
        const layouts = layoutRegistry[state.map.id] || [];
        const locked = debugGate && !state.debugEnabled;
        const savedId = initialLayoutId || storage.getLayout(state.map.id);
        initialLayoutId = null;
        state.layout = (locked
            ? layouts.find((layout) => layout.id === "layout-1")
            : layouts.find((layout) => layout.id === savedId)) || layouts[0] || null;
        layoutSelector.replaceChildren();
        for (const layout of layouts) {
            const option = document.createElement("option");
            option.value = layout.id;
            option.textContent = layout.name;
            layoutSelector.append(option);
        }
        layoutSelector.disabled = locked || layouts.length === 0;
        layoutSelector.value = state.layout?.id || "";
        layoutSelector.title = "Playable layout";
        updateOverlayButton();
    }

    function toScreen(x, y) {
        return { x: width / 2 + (x - center.x) * scale, y: height / 2 - (y - center.y) * scale };
    }

    function toGrid(x, y) {
        return { x: center.x + (x - width / 2) / scale, y: center.y - (y - height / 2) / scale };
    }

    function scheduleDraw() {
        if (!framePending) {
            framePending = true;
            requestAnimationFrame(() => {
                framePending = false;
                draw();
            });
        }
    }

    function getImage(path) {
        if (!images.has(path)) {
            const image = new Image();
            const entry = { image, loaded: false, failed: false };
            images.set(path, entry);
            image.onload = () => {
                entry.loaded = true;
                scheduleDraw();
            };
            image.onerror = () => {
                entry.failed = true;
                scheduleDraw();
            };
            image.src = path;
        }
        return images.get(path);
    }

    function fitMap() {
        const bounds = state.map.bounds;
        minimumScale = Math.min(width / (bounds.maxX - bounds.minX), height / (bounds.maxY - bounds.minY)) * 0.95;
        scale = minimumScale;
        center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
        scheduleDraw();
    }

    function zoom(factor, x = width / 2, y = height / 2) {
        const anchor = toGrid(x, y);
        scale = Math.max(minimumScale, Math.min(minimumScale * MAX_ZOOM_FACTOR, scale * factor));
        center.x = anchor.x - (x - width / 2) / scale;
        center.y = anchor.y + (y - height / 2) / scale;
        scheduleDraw();
    }

    function drawMarker(position, color) {
        if (!position.every(Number.isFinite)) {
            return;
        }
        const point = toScreen(...position);
        context.beginPath();
        context.arc(point.x, point.y, 6, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.strokeStyle = "#101923";
        context.lineWidth = 2;
        context.stroke();
    }

    function drawGrid() {
        if (!state.gridVisible) return;

        const bounds = state.map.bounds;
        const visibleTopLeft = toGrid(0, 0);
        const visibleBottomRight = toGrid(width, height);
        const left = Math.max(bounds.minX, visibleTopLeft.x);
        const right = Math.min(bounds.maxX, visibleBottomRight.x);
        const bottom = Math.max(bounds.minY, visibleBottomRight.y);
        const top = Math.min(bounds.maxY, visibleTopLeft.y);

        if (left >= right || bottom >= top) {
            return;
        }

        // Grid spacing: 100 m squares, with major lines every 1 km.
        const lineStep = 1;
        const majorStep = 10;
        const labelStep = Math.max(1, Math.ceil(65 / (majorStep * scale))) * majorStep;
        const screenLeft = toScreen(left, top).x;
        const screenTop = toScreen(left, top).y;
        const screenRight = toScreen(right, bottom).x;
        const screenBottom = toScreen(right, bottom).y;

        context.save();
        context.font = "11px Arial";
        context.textBaseline = "top";
        context.fillStyle = "#d4e3ed";

        function drawLabel(text, x, y, align = "left", baseline = "top") {
            context.textAlign = align;
            context.textBaseline = baseline;
            context.strokeStyle = "#111b24";
            context.lineWidth = 3;
            context.strokeText(text, x, y);
            context.fillText(text, x, y);
        }

        for (let x = Math.ceil(left / lineStep) * lineStep; x <= right; x += lineStep) {
            const screenX = toScreen(x, top).x;
            const isMajor = x % majorStep === 0;
            context.strokeStyle = isMajor ? "#c1d8e452" : "#c1d8e422";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(screenX, screenTop);
            context.lineTo(screenX, screenBottom);
            context.stroke();
            if (x % labelStep === 0 && screenX > screenLeft + 40 && screenX < screenRight - 45) {
                drawLabel(`X ${x}`, screenX + 4, screenTop + 6);
                drawLabel(`X ${x}`, screenX + 4, screenBottom - 6, "left", "bottom");
            }
        }

        for (let y = Math.ceil(bottom / lineStep) * lineStep; y <= top; y += lineStep) {
            const screenY = toScreen(left, y).y;
            const isMajor = y % majorStep === 0;
            context.strokeStyle = isMajor ? "#c1d8e452" : "#c1d8e422";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(screenLeft, screenY);
            context.lineTo(screenRight, screenY);
            context.stroke();
            if (y % labelStep === 0 && screenY > screenTop + 25 && screenY < screenBottom - 20) {
                drawLabel(`Y ${y}`, screenLeft + 6, screenY + 4);
                drawLabel(`Y ${y}`, screenRight - 6, screenY + 4, "right");
            }
        }

        context.restore();
    }

    function drawTerrain() {
        const bounds = state.map.bounds;
        const tileBounds = state.map.tileBounds;
        const topLeft = toScreen(bounds.minX, bounds.maxY);
        context.save();
        context.beginPath();
        context.rect(topLeft.x, topLeft.y, (bounds.maxX - bounds.minX) * scale, (bounds.maxY - bounds.minY) * scale);
        context.clip();
        const imageOrigin = toScreen(tileBounds.minX, tileBounds.maxY);
        const imageWidth = (tileBounds.maxX - tileBounds.minX) * scale;
        const imageHeight = (tileBounds.maxY - tileBounds.minY) * scale;
        const tileWidth = imageWidth / TILE_COUNT;
        const tileHeight = imageHeight / TILE_COUNT;
        const overview = getImage(`assets/maps/${state.map.id}/overview.webp`);
        if (overview.loaded) {
            context.drawImage(overview.image, imageOrigin.x, imageOrigin.y, imageWidth, imageHeight);
        }

        let failedTiles = false;
        for (let x = 0; x < TILE_COUNT; x += 1) {
            for (let y = 0; y < TILE_COUNT; y += 1) {
                const left = imageOrigin.x + x * tileWidth;
                const top = imageOrigin.y + y * tileHeight;
                if (left > width || top > height || left + tileWidth < 0 || top + tileHeight < 0) {
                    continue;
                }
                const tile = getImage(`assets/maps/${state.map.id}/zoom_${TILE_ZOOM}/${x}_${y}.webp`);
                failedTiles ||= tile.failed;
                if (tile.loaded) {
                    context.drawImage(tile.image, left, top, tileWidth + 0.5, tileHeight + 0.5);
                }
            }
        }
        context.restore();
        message.textContent = overview.failed ? "Map image unavailable" : failedTiles ? "Some detail tiles are unavailable" : "Loading map…";
        message.hidden = overview.loaded && !failedTiles;
    }

    function drawPositions() {
        const source = state.source;
        const target = state.target;
        if (source.every(Number.isFinite)) {
            const origin = toScreen(...source);
            const weapon = state.weapon;
            context.save();
            context.strokeStyle = "#66c0f4";
            context.lineWidth = 2;
            for (const [range, dashed] of [[weapon.maximumRange, false], [weapon.minimumRange, true]]) {
                context.setLineDash(dashed ? [6, 5] : []);
                context.beginPath();
                context.arc(origin.x, origin.y, range / METERS_PER_GRID_UNIT * scale, 0, Math.PI * 2);
                context.stroke();
            }
            context.setLineDash([4, 4]);
            if (target.every(Number.isFinite)) {
                const endpoint = toScreen(...target);
                context.strokeStyle = "#dbe8ee";
                context.beginPath();
                context.moveTo(origin.x, origin.y);
                context.lineTo(endpoint.x, endpoint.y);
                context.stroke();
            }
            context.restore();
        }
        drawMarker(source, "#66c0f4");
        drawMarker(target, "#b7d977");
    }

    function drawControlZone() {
        const zone = state.layout?.controlZone;
        if (!state.overlaysVisible || !hasZone(zone)) {
            return;
        }

        const point = toScreen(zone.x, zone.y);
        context.save();
        context.beginPath();
        context.arc(point.x, point.y, zone.radiusMeters / METERS_PER_GRID_UNIT * scale, 0, Math.PI * 2);
        context.fillStyle = overlays.zone.color;
        context.strokeStyle = overlays.zone.color;
        context.lineWidth = overlays.zone.lineWidth;
        context.setLineDash([]);
        context.globalAlpha = overlays.zone.fillOpacity;
        context.fill();
        context.globalAlpha = overlays.zone.strokeOpacity;
        context.stroke();
        context.restore();
    }

    function drawTowers() {
        if (!state.overlaysVisible) {
            return;
        }
        context.save();
        context.font = overlays.tower.labelFont;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineWidth = 1;

        for (const tower of state.layout?.towers || []) {
            if (!hasPosition(tower)) {
                continue;
            }
            const point = toScreen(tower.x, tower.y);
            const margin = Math.max(20, overlays.tower.size);
            if (point.x < -margin || point.x > width + margin || point.y < -margin || point.y > height + margin) {
                continue;
            }

            MapSymbols.marker(context, point, overlays.tower);
            context.fillStyle = overlays.tower.color;
            context.fillText(String(tower.number), point.x, point.y);
        }

        context.restore();
    }

    function drawSpawns() {
        if (!state.overlaysVisible) {
            return;
        }
        context.save();
        context.font = overlays.spawn.labelFont;
        context.textAlign = "center";
        context.textBaseline = "top";
        for (const spawn of state.layout?.spawns || []) {
            if (!hasPosition(spawn)) {
                continue;
            }
            const point = toScreen(spawn.x, spawn.y);
            const margin = Math.max(80, overlays.spawn.size + overlays.spawn.labelOffset);
            if (point.x < -margin || point.x > width + margin || point.y < -margin || point.y > height + margin) {
                continue;
            }
            MapSymbols.marker(context, point, overlays.spawn);
            context.strokeStyle = overlays.spawn.labelOutlineColor;
            context.lineWidth = overlays.spawn.labelOutlineWidth;
            const labelY = point.y + overlays.spawn.labelOffset;
            context.strokeText(spawn.name, point.x, labelY);
            context.fillStyle = overlays.spawn.color;
            context.fillText(spawn.name, point.x, labelY);
        }
        context.restore();
    }

    function updateGridButton() {
        gridButton.setAttribute("aria-pressed", String(state.gridVisible));
        gridButton.title = state.gridVisible
            ? "Hide grid and edge coordinates"
            : "Show grid and edge coordinates";
    }

    function updateOverlayButton() {
        const available = Boolean(hasZone(state.layout?.controlZone)
            || state.layout?.towers?.some(hasPosition)
            || state.layout?.spawns?.some(hasPosition));
        overlayButton.disabled = !available;
        overlayButton.setAttribute("aria-pressed", String(available && state.overlaysVisible));
        overlayButton.title = !available ? "No overlay positions configured for this layout"
            : state.overlaysVisible ? "Hide towers, spawns and zone" : "Show towers, spawns and zone";
    }

    function drawCursorGuides() {
        if (drag || !pointOnImage(pointer)) return;
        context.save();
        context.strokeStyle = sourceModifier ? cursorStyle.sourceColor : cursorStyle.targetColor;
        context.fillStyle = context.strokeStyle;
        context.lineWidth = cursorStyle.center.lineWidth;
        context.setLineDash([]);
        MapSymbols.trace(context, cursorStyle.center.shape, pointer.x, pointer.y, cursorStyle.center.size);
        context.stroke();
        context.beginPath();
        context.arc(pointer.x, pointer.y, cursorStyle.center.dotRadius, 0, Math.PI * 2);
        context.fill();
        context.restore();

        if (!cursorStyle.guides.visible) return;
        const bounds = state.map.bounds;
        const topLeft = toScreen(bounds.minX, bounds.maxY);
        const bottomRight = toScreen(bounds.maxX, bounds.minY);
        const left = Math.max(0, topLeft.x);
        const right = Math.min(width, bottomRight.x);
        const top = Math.max(0, topLeft.y);
        const bottom = Math.min(height, bottomRight.y);
        if (pointer.x < left || pointer.x > right || pointer.y < top || pointer.y > bottom) return;

        // Leave a small gap around the configured cursor shape.
        const gap = Math.max(cursorStyle.guides.gap, cursorStyle.center.size / 2);
        context.save();
        context.strokeStyle = sourceModifier ? cursorStyle.sourceColor : cursorStyle.targetColor;
        context.globalAlpha = cursorStyle.guides.opacity;
        context.lineWidth = cursorStyle.guides.lineWidth;
        context.setLineDash([]);
        context.beginPath();
        context.moveTo(left, pointer.y);
        context.lineTo(Math.max(left, pointer.x - gap), pointer.y);
        context.moveTo(Math.min(right, pointer.x + gap), pointer.y);
        context.lineTo(right, pointer.y);
        context.moveTo(pointer.x, top);
        context.lineTo(pointer.x, Math.max(top, pointer.y - gap));
        context.moveTo(pointer.x, Math.min(bottom, pointer.y + gap));
        context.lineTo(pointer.x, bottom);
        context.stroke();
        context.restore();
    }

    function pointOnImage(screen) {
        const point = screen ? toGrid(screen.x, screen.y) : null;
        const bounds = state.map.bounds;
        const inside = point && screen.x >= 0 && screen.x <= width
            && screen.y >= 0 && screen.y <= height
            && point.x >= bounds.minX && point.x <= bounds.maxX
            && point.y >= bounds.minY && point.y <= bounds.maxY;
        return inside ? point : null;
    }

    function updateCursorReadout() {
        const point = pointOnImage(pointer);
        const visible = point !== null;
        canvas.dataset.pointerOnImage = String(visible);
        cursor.textContent = visible
            ? `X ${formatMapCoordinate(point.x)} / Y ${formatMapCoordinate(point.y)}`
            : "X — / Y —";
    }

    function clearPointer() {
        pointer = null;
        updateCursorReadout();
        scheduleDraw();
    }

    function draw() {
        updateCursorReadout();
        const pixelRatio = window.devicePixelRatio || 1;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = "#111b24";
        context.fillRect(0, 0, width, height);
        drawTerrain();
        drawControlZone();
        drawGrid();
        drawTowers();
        drawSpawns();
        drawPositions();
        drawCursorGuides();
    }

    function formatMapCoordinate(value) {
        return value.toFixed(2);
    }

    function pointerPosition(event) {
        const rectangle = canvas.getBoundingClientRect();
        return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top };
    }

    function setPosition(event, position) {
        const point = pointOnImage(pointerPosition(event));
        if (point) onPosition(position, point);
    }

    function endDrag() {
        drag = null;
        canvas.classList.remove("dragging");
        scheduleDraw();
    }

    function cancelPointer() {
        endDrag();
        clearPointer();
    }

    canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });
    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        const point = pointerPosition(event);
        zoom(Math.exp(-event.deltaY * 0.0015), point.x, point.y);
    }, { passive: false });
    canvas.addEventListener("pointerdown", (event) => {
        updateSourceModifier(event);
        if (event.button === 0) {
            setPosition(event, sourceModifier ? "source" : "target");
            return;
        }
        if (event.button !== 2) {
            return;
        }
        event.preventDefault();
        drag = { x: event.clientX, y: event.clientY, center: { ...center } };
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("dragging");
        scheduleDraw();
    });
    canvas.addEventListener("pointermove", (event) => {
        updateSourceModifier(event);
        if (drag) {
            center.x = drag.center.x - (event.clientX - drag.x) / scale;
            center.y = drag.center.y + (event.clientY - drag.y) / scale;
        }
        pointer = pointerPosition(event);
        updateCursorReadout();
        scheduleDraw();
    });
    canvas.addEventListener("pointerleave", clearPointer);
    canvas.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("keydown", updateSourceModifier);
    window.addEventListener("keyup", updateSourceModifier);
    window.addEventListener("blur", () => {
        sourceModifier = false;
        cancelPointer();
    });
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("lostpointercapture", endDrag);
    selector.addEventListener("change", () => {
        state.map = maps.find((map) => map.id === selector.value);
        storage.setMap(state.map.id);
        populateLayouts();
        fitMap();
    });
    layoutSelector.addEventListener("change", () => {
        if (debugGate && !state.debugEnabled) {
            populateLayouts();
            return;
        }
        state.layout = layoutRegistry[state.map.id]?.find((layout) => layout.id === layoutSelector.value) || null;
        storage.setLayout(state.map.id, state.layout?.id || "");
        updateOverlayButton();
        scheduleDraw();
    });
    debugButton.hidden = !debugGate;
    debugButton.addEventListener("click", () => {
        state.debugEnabled = !state.debugEnabled;
        debugButton.setAttribute("aria-pressed", String(state.debugEnabled));
        populateLayouts();
        scheduleDraw();
    });
    gridButton.addEventListener("click", () => {
        state.gridVisible = !state.gridVisible;
        updateGridButton();
        scheduleDraw();
    });
    overlayButton.addEventListener("click", () => {
        state.overlaysVisible = !state.overlaysVisible;
        updateOverlayButton();
        scheduleDraw();
    });
    document.getElementById("map-fit").addEventListener("click", fitMap);
    document.getElementById("map-zoom-in").addEventListener("click", () => zoom(1.5));
    document.getElementById("map-zoom-out").addEventListener("click", () => zoom(1 / 1.5));
    selector.value = state.map.id;
    updateGridButton();
    populateLayouts();
    new ResizeObserver(() => {
        width = Math.max(1, viewport.clientWidth);
        height = Math.max(1, viewport.clientHeight);
        canvas.width = Math.round(width * (window.devicePixelRatio || 1));
        canvas.height = Math.round(height * (window.devicePixelRatio || 1));
        fitMap();
    }).observe(viewport);
    return { render: scheduleDraw };
}

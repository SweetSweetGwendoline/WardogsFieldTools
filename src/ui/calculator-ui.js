"use strict";

function createCalculatorUI({ onChange, getShareLink }) {
    const COPY_FEEDBACK_DURATION_MS = 1200;
    const { parseCoordinate, parseCoordinatePair } = Calculator;
    function handleInputChange() { onChange(readInputs()); }
    const coordinateForm = document.getElementById("coordinate-form");
    const weaponSelect = document.getElementById("weapon");
    const coordinateInputs = ["firing-x", "firing-y", "target-x", "target-y"].map(
        (id) => document.getElementById(id)
    );
    const positionInputs = {
        firing: coordinateInputs.slice(0, 2),
        target: coordinateInputs.slice(2, 4),
    };
    const numberFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
    const copyButtons = [...document.querySelectorAll(".copy-position")];
    const copyFeedbackTimers = new WeakMap();
    const shareButton = document.getElementById("copy-link");
    const canShare = SolutionLink.supportsProtocol(window.location.protocol);

    function showCopyFeedback(button, label = `Copy ${button.dataset.position} position`) {
        window.clearTimeout(copyFeedbackTimers.get(button));
        button.classList.add("is-copied");
        button.removeAttribute("title");
        button.setAttribute("aria-label", "Copied");

        const timer = window.setTimeout(() => {
            button.classList.remove("is-copied");
            button.title = label;
            button.setAttribute("aria-label", label);
            copyFeedbackTimers.delete(button);
        }, COPY_FEEDBACK_DURATION_MS);

        copyFeedbackTimers.set(button, timer);
    }

    function readPosition(position) {
        return positionInputs[position].map((input) => parseCoordinate(input.value));
    }

    function updateCopyButtons() {
        const hasCompletePositionPair = coordinateInputs.every(
            input => Number.isFinite(parseCoordinate(input.value))
        );
        const sharingAvailable = canShare && hasCompletePositionPair;
        shareButton.disabled = !sharingAvailable;
        shareButton.hidden = !sharingAvailable;
        copyButtons.forEach((button) => {
            button.disabled = !readPosition(button.dataset.position).every(Number.isFinite);
        });
    }

    async function copyPosition(event) {
        const button = event.currentTarget;
        const inputs = positionInputs[button.dataset.position];

        if (!readPosition(button.dataset.position).every(Number.isFinite)) {
            return;
        }

        const [x, y] = inputs.map((input) => input.value.trim());
        const coordinatePair = `X${x} Y${y}`;

        try {
            await navigator.clipboard.writeText(coordinatePair);
            showCopyFeedback(button);
        } catch {
            // Local-file browsers may block clipboard access; keep manual copying available.
            window.prompt("Copy position (Ctrl+C):", coordinatePair);
        }
    }

    function pasteCoordinates(event) {
        const inputIndex = coordinateInputs.indexOf(event.target);

        if (inputIndex === -1 || !event.clipboardData) {
            return;
        }

        const pair = parseCoordinatePair(event.clipboardData.getData("text/plain"));

        if (pair === null) {
            return;
        }

        event.preventDefault();
        const firstInputIndex = inputIndex - (inputIndex % 2);
        coordinateInputs[firstInputIndex].value = pair[0];
        coordinateInputs[firstInputIndex + 1].value = pair[1];
        handleInputChange();
    }

    function setText(elementId, value) {
        document.getElementById(elementId).textContent = value;
    }

    function setStatus(state, title, detail = "") {
        document.getElementById("status-banner").dataset.state = state;
        setText("status-title", title);
        setText("status-detail", detail);
        document.getElementById("status-detail").hidden = detail === "";
    }

    function clearResults(weaponId) {
        const valueIds = [
            "range-result", "bearing-result", "direction-result",
            "elevation-result", "high-elevation-result",
            "horizontal-offset", "vertical-offset",
        ];
        valueIds.forEach((id) => setText(id, "—"));
        setText("horizontal-direction", "");
        setText("vertical-direction", "");

        // Keep both artillery rows in place, including when an arc has no solution.
        const hasTwoArcs = weaponId === "sph2";
        setText("elevation-arc", hasTwoArcs ? "LOW ARC" : "");
        document.getElementById("elevation-arc").hidden = !hasTwoArcs;
        document.getElementById("high-elevation-row").hidden = !hasTwoArcs;
    }

    function formatElevation(solution) {
        if (solution === null) {
            return "—";
        }

        const minimum = Math.round(solution.minimum);
        const maximum = Math.round(solution.maximum);
        return minimum === maximum
            ? numberFormatter.format(minimum)
            : `${numberFormatter.format(minimum)}–${numberFormatter.format(maximum)}`;
    }

    function formatOffset(east, north) {
        return {
            horizontal: numberFormatter.format(Math.abs(east)),
            vertical: numberFormatter.format(Math.abs(north)),
            horizontalDirection: east < 0 ? "WEST" : "EAST",
            verticalDirection: north < 0 ? "SOUTH" : "NORTH",
        };
    }

    function cycleCoordinateFocus(event) {
        if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        event.preventDefault();
        const index = coordinateInputs.indexOf(event.currentTarget);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (index + direction + coordinateInputs.length) % coordinateInputs.length;
        coordinateInputs[nextIndex].focus();
    }

    function readInputs() {
        return { weapon: weaponSelect.value, coordinates: coordinateInputs.map(input => input.value) };
    }

    function setInputs(inputs) {
        weaponSelect.value = inputs.weapon;
        coordinateInputs.forEach((input, index) => { input.value = inputs.coordinates[index]; });
    }

    function setPosition(name, point) {
        const coordinates = [point.x, point.y];
        positionInputs[name].forEach((input, index) => {
            input.value = coordinates[index].toFixed(2).replace(".", ",");
        });
        handleInputChange();
    }

    function render(solution, weaponId) {
        updateCopyButtons();
        setText("solution-title", Calculator.weapons[weaponId].name + " firing solution");
        clearResults(weaponId);
        const statuses = {
            invalid: ["warning", "Check your coordinates", "Use a finite number for each X and Y coordinate."],
            incomplete: ["idle", "Awaiting coordinates"],
            overflow: ["warning", "Coordinates are too large", "Enter smaller map coordinates to calculate a valid range."],
            coincident: ["warning", "Positions coincide", "The target is at your firing position. Bearing and elevation are undefined."],
            "too-close": ["warning", "Target too close"],
            "too-far": ["warning", "Target too far"],
            valid: ["valid", "Target within range"],
        };
        setStatus(...statuses[solution.status]);
        if (!solution.geometry) return;
        const { east, north, range, bearing, direction } = solution.geometry;
        setText("range-result", numberFormatter.format(Math.round(range)));
        const offset = formatOffset(east, north);
        setText("horizontal-offset", offset.horizontal);
        setText("vertical-offset", offset.vertical);
        setText("horizontal-direction", offset.horizontalDirection);
        setText("vertical-direction", offset.verticalDirection);
        if (range === 0) return;
        setText("bearing-result", String(Math.round(bearing) % 360).padStart(3, "0"));
        setText("direction-result", direction);
        setText("elevation-result", formatElevation(solution.elevation));
        setText("high-elevation-result", formatElevation(solution.highElevation));
    }
    coordinateForm.addEventListener("submit", (event) => event.preventDefault());
    coordinateInputs.forEach((input) => {
        input.addEventListener("input", handleInputChange);
        input.addEventListener("keydown", cycleCoordinateFocus);
    });
    document.querySelectorAll("button, select").forEach((control) => {
        control.tabIndex = -1;
    });
    coordinateForm.addEventListener("paste", pasteCoordinates);
    weaponSelect.addEventListener("change", handleInputChange);
    copyButtons.forEach((button) => button.addEventListener("click", copyPosition));
    shareButton.addEventListener("click", async () => {
        const link = getShareLink();
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            showCopyFeedback(shareButton, "Copy solution link");
        } catch {
            window.prompt("Copy solution link (Ctrl+C):", link);
        }
    });

    return { readInputs, setInputs, setPosition, render };
}

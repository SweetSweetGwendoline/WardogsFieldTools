"use strict";

// Pure calculation and input parsing. Coordinates use CoordinateSystem units.
const Calculator = (() => {
    const { metersPerUnit: METERS_PER_GRID_UNIT } = CoordinateSystem;
    const DEGREES_PER_RADIAN = 180 / Math.PI;
    const RANGE_TOLERANCE = 0.000001;
    const COORDINATE_NUMBER_PATTERN = "[+-]?(?:\\d+(?:[.,]\\d*)?|[.,]\\d+)";
    const COORDINATE_PATTERN = new RegExp(`^${COORDINATE_NUMBER_PATTERN}$`);
    const LABELED_PAIR_PATTERN = new RegExp(
        `^([xy])\\s*[:=]?\\s*(${COORDINATE_NUMBER_PATTERN})\\s*[,;/]?\\s*` +
        `([xy])\\s*[:=]?\\s*(${COORDINATE_NUMBER_PATTERN})$`,
        "i"
    );
    const PLAIN_PAIR_PATTERN = new RegExp(
        `^(${COORDINATE_NUMBER_PATTERN})(?:\\s+|\\s*[;/]\\s*)(${COORDINATE_NUMBER_PATTERN})$`
    );
    const COMPASS_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const WEAPONS = {
        l81: { name: "L81", minimumRange: 132, maximumRange: 684 },
        sph2: { name: "SPH-2", minimumRange: 780, maximumRange: 2629 },
    };

    function isValidCoordinate(value) {
        return Number.isFinite(parseCoordinate(value));
    }

    function parseCoordinate(value) {
        const trimmedValue = value.trim();

        if (trimmedValue === "") {
            return null;
        }

        if (!COORDINATE_PATTERN.test(trimmedValue)) {
            return NaN;
        }

        return Number(trimmedValue.replace(",", "."));
    }

    function parseCoordinatePair(value) {
        const trimmedValue = value.trim();
        const labeledPair = trimmedValue.match(LABELED_PAIR_PATTERN);
        let pair = null;

        if (labeledPair && labeledPair[1].toLowerCase() !== labeledPair[3].toLowerCase()) {
            pair = labeledPair[1].toLowerCase() === "x"
                ? [labeledPair[2], labeledPair[4]]
                : [labeledPair[4], labeledPair[2]];
        } else {
            // Use whitespace, a semicolon, or a slash between unlabeled coordinates.
            // A comma alone remains a decimal separator, never a guessed X/Y split.
            const plainPair = trimmedValue.match(PLAIN_PAIR_PATTERN);
            pair = plainPair ? [plainPair[1], plainPair[2]] : null;
        }

        return pair && pair.every(isValidCoordinate)
            ? pair
            : null;
    }

    // Flat-ground table interpolation; no terrain-height or vehicle-tilt correction.
    function estimateElevation(samples, range) {
        const exactSamples = samples.filter(
            ([sampleRange]) => Math.abs(sampleRange - range) <= RANGE_TOLERANCE
        );

        if (exactSamples.length > 0) {
            const elevations = exactSamples.map(([, elevation]) => elevation);
            return { minimum: Math.min(...elevations), maximum: Math.max(...elevations) };
        }

        const sortedSamples = [...samples].sort((first, second) => first[0] - second[0]);

        for (let index = 1; index < sortedSamples.length; index += 1) {
            const [lowerRange, lowerElevation] = sortedSamples[index - 1];
            const [upperRange] = sortedSamples[index];

            if (range > lowerRange && range < upperRange) {
                // At the maximum-range plateau, use the closest connecting sight value.
                const upperSamples = sortedSamples.filter(([distance]) => distance === upperRange);
                const [, upperElevation] = upperSamples.reduce((closest, sample) => {
                    const sampleDifference = Math.abs(sample[1] - lowerElevation);
                    const closestDifference = Math.abs(closest[1] - lowerElevation);
                    return sampleDifference < closestDifference ? sample : closest;
                });
                const progress = (range - lowerRange) / (upperRange - lowerRange);
                const elevation = lowerElevation + progress * (upperElevation - lowerElevation);
                return { minimum: elevation, maximum: elevation };
            }
        }

        return null;
    }

    function calculateGeometry(coordinates) {
        const [firingX, firingY, targetX, targetY] = coordinates;
        const east = (targetX - firingX) * METERS_PER_GRID_UNIT;
        const north = (targetY - firingY) * METERS_PER_GRID_UNIT;
        const range = Math.hypot(east, north);
        const bearing = (Math.atan2(east, north) * DEGREES_PER_RADIAN + 360) % 360;
        const compassIndex = Math.round(bearing / 45) % COMPASS_DIRECTIONS.length;

        return { east, north, range, bearing, direction: COMPASS_DIRECTIONS[compassIndex] };
    }

    function calculate({ firing, target, weaponId }) {
        if (!Object.hasOwn(WEAPONS, weaponId)) throw new Error("Unknown weapon: " + weaponId);
        if (!Array.isArray(firing) || firing.length !== 2 || !Array.isArray(target) || target.length !== 2) {
            throw new TypeError("Firing and target must each contain two calculator coordinates.");
        }
        const coordinates = [...firing, ...target];
        const empty = { geometry: null, elevation: null, highElevation: null };
        if (coordinates.some(value => value !== null && !Number.isFinite(value))) return { ...empty, status: "invalid" };
        if (coordinates.some(value => value === null)) return { ...empty, status: "incomplete" };
        const geometry = calculateGeometry(coordinates);
        if (!Number.isFinite(geometry.range)) return { ...empty, status: "overflow" };
        const result = { ...empty, geometry };
        if (geometry.range === 0) return { ...result, status: "coincident" };
        const weapon = WEAPONS[weaponId];
        if (geometry.range + RANGE_TOLERANCE < weapon.minimumRange) return { ...result, status: "too-close" };
        if (geometry.range > weapon.maximumRange + RANGE_TOLERANCE) return { ...result, status: "too-far" };
        const tables = ELEVATION_TABLES[weaponId];
        return {
            ...result,
            status: "valid",
            elevation: estimateElevation(tables.single || tables.low, geometry.range),
            highElevation: tables.high ? estimateElevation(tables.high, geometry.range) : null,
        };
    }
    return Object.freeze({ weapons: WEAPONS, parseCoordinate, parseCoordinatePair, calculate });
})();

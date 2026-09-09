"use strict";

// Sizes are CSS pixels. Colors are CSS color strings. See config/README.md.
const CURSOR_APPEARANCE = {
    targetColor: "#b7d977",
    sourceColor: "#66c0f4",
    center: {
        shape: "circle", // circle or square
        size: 12, // diameter / side length
        lineWidth: 1,
        dotRadius: 1.5, // 0 hides the precision dot
    },
    guides: {
        visible: true,
        opacity: 0.45,
        lineWidth: 1,
        gap: 8, // distance from exact cursor point to the start of each guide
    },
};

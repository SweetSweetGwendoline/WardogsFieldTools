"use strict";

// Appearance only. Positions and zone radii belong in config/layouts/.
const OVERLAY_APPEARANCE = {
    zone: {
        color: "#e3b45e",
        fillOpacity: 0.045,
        strokeOpacity: 0.45,
        lineWidth: 1,
    },
    tower: {
        shape: "square", // circle, square, triangle or diamond
        size: 16,
        color: "#bdccd4", // label and legend color
        strokeColor: "rgba(180, 196, 205, 0.65)",
        fillColor: "rgba(19, 31, 43, 0.85)",
        lineWidth: 1,
        labelFont: "11px Arial",
    },
    spawn: {
        shape: "triangle", // circle, square, triangle or diamond
        size: 14,
        color: "#c8b7dc",
        strokeColor: "#c8b7dc",
        fillColor: "rgba(19, 31, 43, 0.85)",
        lineWidth: 1,
        labelFont: "10px Arial",
        labelOffset: 10,
        labelOutlineColor: "#131f2b",
        labelOutlineWidth: 3,
    },
};

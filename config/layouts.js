"use strict";

// Layout registry. Edit the individual map files in config/layouts/.
// These plain scripts also work when index.html is opened directly from disk.
const FIELD_MAP_LAYOUTS = {};

// Temporary sharing restriction. Set false when all layouts are ready:
// the Debug button disappears and normal saved layout selection is restored.
const LAYOUT_DEBUG_GATE = true;

/* The names the engine's sections share. scripts/build-engine.js joins engine/*.js into one module, so a section uses what
   another declares without importing it; checked alone, a section must be told what it takes (the engineering audit,
   item 14: "globals shared across engine sections"; notes plan C2, first step). One section is checked today,
   engine/03-fakenames.js, beside page-logic.js (tsconfig.check.json, `npm run check:types`, CI). Each section that joins
   the check adds here what it takes from the others, so the coupling is written down in one place before the sections
   become real modules. */
declare function norm(t: string): string;
declare const VRB: Set<string>;
declare const STOP: Set<string>;
declare const COMMON: Set<string>;
declare const KNOWN_FIRST: Set<string>;
declare const PLACE_BY: Record<string, unknown>;

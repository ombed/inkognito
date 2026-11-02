/* The engine for the benchmark: scripts/engine-node.js, the one way Node loads redact-engine.js, with every
   top-level name exported and the browser pieces the engine expects in place. The benchmark drives the whole
   chain (discover, redactDocx, verification, the model-output cleaning) and reads internals for its reports.

   require("./engine.js") is the shipped engine. require("./engine.js").load({ patches }) is the same engine
   with textual patches applied, each [from, to] required to match exactly once; sweep.js uses it to score a
   parameter at several values without editing the source. */
module.exports = require("../scripts/engine-node.js");

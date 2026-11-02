/* The files the page ships: the list the service worker keeps for working offline (sw.js, FILES), so a check
   that reads "the page's code" reads all of it, and a new file joins every such check the day it ships.

   On 13.10 the page's logic moved from index.html into page-component.js, and three checks went on reading
   index.html alone, so they checked none of it: the engine names the page reads (tests/pagelogic_t.js), the
   lost backslashes (tests/regex_t.js) and the plural address (tests/address_t.js). They read this list now. */
const fs = require("fs");
const path = require("path");

module.exports = function shipped(root) {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const m = /const FILES=\[([\s\S]*?)\];/.exec(sw);
  if (!m) throw new Error("sw.js: no FILES list");
  const files = (m[1].match(/"\.\/[^"]*"/g) || []).map((s) => s.slice(3, -1)).filter(Boolean);
  if (!files.includes("page-component.js") || !files.includes("redact-engine.js")) throw new Error("sw.js: FILES lacks the page or the engine: " + files);
  return files;
};

/* The libraries the tool takes from other sites, and their copies in the installed packages.
   e2e/base.js serves these copies, so a browser run needs no internet; tests/vendor_t.js checks
   that every address the tool names has one, at that version, and that it is the pinned file. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
// unpkg.com/<package>@<version>/<file> and cdn.jsdelivr.net/npm/<package>@<version>/<file>
const CDN = /^https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net\/npm)\/((?:@[^/@]+\/)?[^/@]+)@([^/]+)\/([^?#]+)/;

// the installed file for a CDN address, or null: the package itself or an alias of it (onnxruntime-web-1.24
// is onnxruntime-web at the engine's version), at exactly the version the address names
function installedFile(url) {
  const m = CDN.exec(url);
  if (!m) return null;
  const [, name, version, rel] = m;
  const nm = path.join(ROOT, "node_modules");
  const dirs = [name, ...fs.readdirSync(nm).filter((d) => d.startsWith(name + "-"))];
  for (const d of dirs) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(nm, d, "package.json"), "utf8")); } catch { continue; }
    const file = path.join(nm, d, rel);
    if (pkg.name === name && pkg.version === version && fs.existsSync(file)) return file;
  }
  return null;
}

// every address the page and the engine take from a CDN, with the hash the tool pins for it: a
// Subresource Integrity sha384, or the engine's SHA-256 for the runtime; the atlas is data, unpinned
function named() {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const support = read("support.js"), page = read("index.html") + read("page-component.js"), eng = read("engine/08-docx.js");
  const out = [];
  for (const k of ["REACT", "REACT_DOM", "BABEL"]) {
    const url = (support.match(new RegExp(`var ${k}_URL = "([^"]+)"`)) || [])[1];
    const pin = (support.match(new RegExp(`var ${k}_SRI = "sha384-([^"]+)"`)) || [])[1];
    out.push({ url, alg: "sha384", pin });
  }
  for (const [, url, pin] of page.matchAll(/\["\w+","(https:\/\/unpkg\.com\/[^"]+)","sha384-([^"]+)"\]/g)) out.push({ url, alg: "sha384", pin });
  for (const [, url] of page.matchAll(/"(https:\/\/cdn\.jsdelivr\.net\/npm\/world-atlas@[^"]+)"/g)) out.push({ url, alg: null, pin: null });
  const ortV = (eng.match(/const ORT_V="([^"]+)"/) || [])[1];
  const [, pre, post] = eng.match(/const ORT_CDN="([^"]+)"\+ORT_V\+"([^"]+)"/) || [];
  const wasm = JSON.parse("{" + (eng.match(/const ORT_WASM=\{([^}]*)\}/) || ["", ""])[1] + "}");
  for (const [name, pin] of Object.entries(wasm)) out.push({ url: pre + ortV + post + name + ".wasm", alg: "sha256", pin });
  return out;
}

module.exports = { CDN, installedFile, named };

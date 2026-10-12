/* The page and its parts (notes plan C1; the engineering audit, item 4: one injected script could read the open
   document and every saved case, and the page's policy let one run).

   The page names every script it runs, so its policy (Content-Security-Policy) allows nothing else:
     - the logic of its component is page-component.js, a plain script. It was the text of index.html's
       <script type="text/x-dc" data-dc-script>, which the page runtime (support.js) turned into code with
       new Function, and the policy needed 'unsafe-eval' for that;
     - the page's own inline scripts are named in the policy by their SHA-256, so it needs no 'unsafe-inline':
       an injected <script> or <img onerror=…> does not run.

     node scripts/page-parts.js    writes the hashes into index.html's policy (npm run build:page; build:design and
                                   bump run it too). tests/csp_t.js fails when they are stale.

   The design canvas and the tests that read the logic's words take the page with its logic back in its place
   (pageWithLogic): the same text index.html was before the move. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// page-component.js holds the logic between these two, exactly as it stood in the page
const HEAD = "window.__dcLogic = { make: function (DCLogic, StreamableLogic, React) {";
const FOOT = ';return (typeof Component!=="undefined"&&Component)||undefined;\n} };\n';
const XDC = /(<script type="text\/x-dc" data-dc-script[^>]*>)([\s\S]*?)(<\/script>)/;
const CSP = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;

function logicOf(js) {
  const a = js.indexOf(HEAD), b = js.lastIndexOf(FOOT);
  if (a < 0 || b < a || js.indexOf(HEAD, a + 1) >= 0) throw new Error("page-component.js: the logic is not between its two lines");
  return js.slice(a + HEAD.length, b);
}

function pageWithLogic(html = read("index.html"), js = read("page-component.js")) {
  const m = html.match(XDC);
  if (!m) throw new Error('index.html: no <script type="text/x-dc" data-dc-script>');
  if (m[2].trim()) throw new Error("index.html: the component's logic is in the page again; it belongs in page-component.js");
  return html.replace(XDC, (_, a, __, z) => a + logicOf(js) + z);
}

// what the browser runs from the page's own text: a script with no src whose type is JavaScript
// (the component's text/x-dc block and data blocks are not run)
function inlineScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const type = (m[1].match(/\btype="([^"]*)"/) || [])[1];
    if (/\bsrc=/.test(m[1]) || (type && !/^(?:text\/javascript|application\/javascript|module)$/i.test(type))) continue;
    out.push(m[2]);
  }
  return out;
}

const hashOf = (code) => "'sha256-" + crypto.createHash("sha256").update(code, "utf8").digest("base64") + "'";

// script-src keeps its other sources and names each inline script by its hash, and no other
function withHashes(html) {
  if ((html.match(new RegExp(CSP.source, "g")) || []).length !== 1) throw new Error("the page has not exactly one policy");
  const hashes = [...new Set(inlineScripts(html).map(hashOf))];
  return html.replace(CSP, (_, a, csp, z) => a + csp.split(";").map((d) => {
    const t = d.trim().split(/\s+/);
    return t[0] === "script-src" ? t.filter((x) => !/^'sha256-/.test(x)).concat(hashes).join(" ") : d.trim();
  }).join("; ") + z);
}

if (require.main === module) {
  const html = read("index.html"), out = withHashes(html);
  if (out !== html) fs.writeFileSync(path.join(ROOT, "index.html"), out);
  console.log("index.html: the policy names its " + inlineScripts(out).length + " inline scripts by hash" + (out !== html ? " (updated)" : ""));
}

module.exports = { HEAD, FOOT, XDC, CSP, logicOf, pageWithLogic, inlineScripts, hashOf, withHashes };

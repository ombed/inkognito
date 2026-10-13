/* The test and expect every browser check uses (docs/QUALITY-PLAN.md, layer 2).

   Each test runs as written, and then the app checks its own promises on the
   screen the test ended on: no card with punctuation at its edge and no two
   cards in the same letters, every listed value that appears in the document
   actually found, overlays sitting on what they point at, no horizontal
   overflow, no unresolved {{ }}, no page error and no runtime warning. So every
   test checks rules it was never written for.

   The checks live in the app (selfCheck in index.html), so the same code can
   later run inside real sessions. A test that deliberately leaves the page in a
   broken state opts out with test.info().annotations.push({ type: "no-self-check" }). */
const base = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { installedFile } = require("./libs");

/* The libraries the tool takes from other sites (React, Babel, d3, topojson, the world atlas, the
   runtime's WebAssembly) come from the installed packages (e2e/libs.js), so a run needs no internet:
   a dropped connection one night failed 290 tests (11.10). package.json pins each at the version the
   page names, and the page still checks every byte itself (Subresource Integrity, the engine's
   SHA-256), so a copy that is not the pinned file fails loudly. An address with no installed copy
   goes to the network, or with E2E_OFFLINE=1 fails, which shows what a run still needs from outside.
   Specs that let the service worker run (sw, moved) keep the network: the worker fetches the CDN
   itself, where routes do not reach, and their offline checks must meet the real thing. */
const TYPES = { ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".wasm": "application/wasm" };
const copies = new Map();
async function serveLocal(route) {
  const url = route.request().url();
  if (!copies.has(url)) { const f = installedFile(url); copies.set(url, f && { body: fs.readFileSync(f), type: TYPES[path.extname(f)] || "application/octet-stream" }); }
  const hit = copies.get(url);
  if (!hit) return process.env.E2E_OFFLINE ? route.abort("internetdisconnected") : route.fallback();
  return route.fulfill({ status: 200, body: hit.body, headers: { "content-type": hit.type, "access-control-allow-origin": "*", "cross-origin-resource-policy": "cross-origin" } });
}

/* "Could not run" must never read as "found nothing" (outside review, H4). The check used
   to sit in a try with an empty catch and default to [] when the hook was missing, so a
   check that threw, or an engine that never finished loading, passed every spec. Only two
   things skip it now, and both are decided here rather than by an exception: the page is
   closed, or the page is not the app at all (null). Anything else comes back as a
   problem: a missing hook is "no-hook", a throwing check is "check-threw". */
async function selfCheckOf(page, hookTimeout = 10000) {
  if (page.isClosed()) return null;
  const isApp = await page.evaluate(() => !!document.querySelector("#dc-root")).catch(() => false);
  if (!isApp) return null;
  // measure the settled screen: running animations and transitions (a screen sliding in,
  // the spotlight moving between steps) finish first, up to 1.5 s, then two frames
  await page.evaluate(async () => {
    const t0 = Date.now();
    while (document.getAnimations().some((a) => a.playState === "running") && Date.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  // the hook is installed once the engine module has loaded; give a slow load a moment
  const hooked = await page.waitForFunction(() => !!window.__pib, null, { timeout: hookTimeout }).then(() => true, () => false);
  if (!hooked) return [{ rule: "no-hook", detail: "window.__pib was never installed, so nothing was checked" }];
  return page.evaluate(() => {
    try { return window.__pib.check(true); } catch (e) { return [{ rule: "check-threw", detail: String((e && e.message) || e).slice(0, 160) }]; }
  });
}

/* One fixed key for the invented names. Since v73.13 each browser draws its own (aliasKey in the page), so each test
   drew new names, and a test that mixes two documents' invented names met, by chance, the restore's guard against
   a shared word («בתשובה יש שמות בדויים של מסמך אחר»): e2e/restore.spec.js failed so in WebKit on 13.10. With one
   key the names are the same in every run, as before v73.13. A test about the key itself takes
   test.use({ aliasPin: null }). */
const ALIAS_PIN = "5eed".repeat(16);

const test = base.test.extend({
  aliasPin: [ALIAS_PIN, { option: true }],
  localLibs: [async ({ context, serviceWorkers }, use) => {
    if (serviceWorkers !== "allow") await context.route(/^https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\//, serveLocal);
    await use();
  }, { auto: true }],
  selfCheck: [async ({ page, aliasPin }, use, info) => {
    await page.addInitScript((pin) => {
      window.__PIB_TEST = true;
      if (pin) try { if (!/^[0-9a-f]{64}$/.test(localStorage.getItem("redact-alias-key") || "")) localStorage.setItem("redact-alias-key", pin); } catch (_) {}
      // the Content-Security-Policy (review H14): anything the page is refused is recorded, and a
      // refusal fails the test, so a host the policy forgot shows here and not in a session
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + String(e.blockedURI).slice(0, 80)));
    }, aliasPin);
    const noise = [];
    page.on("console", (m) => { if (/never resolved/.test(m.text())) noise.push({ rule: "runtime-warning", detail: m.text().slice(0, 160) }); });
    page.on("pageerror", (e) => noise.push({ rule: "page-error", detail: String(e && e.message || e).slice(0, 160) }));
    await use();
    if (info.status !== info.expectedStatus) return;
    if (!page.isClosed()) {
      const csp = await page.evaluate(() => window.__csp || []).catch(() => []);
      base.expect(csp, "nothing refused by the Content-Security-Policy").toEqual([]);
      // the session log drops a value that is not a code or a count, and names it (review L6); the
      // app itself must never log one, or its telemetry is silently thinner than it looks
      const drops = await page.evaluate(() => (window.__pib && window.__pib.log ? window.__pib.log().events : []).filter((e) => e.dropped).map((e) => e.ev + ":" + e.dropped)).catch(() => []);
      base.expect(drops, "no session-log field dropped by the app's own events").toEqual([]);
    }
    if (info.annotations.some((a) => a.type === "no-self-check")) return;
    const found = await selfCheckOf(page);
    if (found === null) return;
    base.expect([...found, ...noise], "self-check on the screen the test ended on").toEqual([]);
  }, { auto: true }],
});

module.exports = { test, expect: base.expect, selfCheckOf };

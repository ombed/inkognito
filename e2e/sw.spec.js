const { test, expect } = require("./base");
const http = require("http");
const fs = require("fs");
const path = require("path");

/* The service worker (sw.js) as a returning visitor meets it: across an update.

   1. An update. The new page comes from the network while the old worker still controls it, and the
      new worker takes over about two seconds later. The version chip asked once, got the old worker's
      answer and kept «מוגש v59 — רענון בלי מטמון» on screen until the next visit, though everything was
      already new (found live on v60). It must end as the page's own chip, and keep the warning when no
      new worker comes, because then the mismatch is real.


   Both run on a server of their own: what sw.js says changes between visits here, and the shared
   server must not change under the other specs. */

const ROOT = path.join(__dirname, "..");
const PAGE_V = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/<div id="ver">גרסה (v\d+)<\/div>/) || [])[1];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

// the repository on a free port; state.worker: "old" serves sw.js as version v1, "fails" answers 500,
// and holdMs keeps sw.js back that long (the new worker arrives after the page has asked)
function serveRepo() {
  const state = { worker: "current", holdMs: 0 };
  const server = http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(req.url.split("?")[0]); } catch (_) { res.writeHead(400).end(); return; }
    const file = path.join(ROOT, url === "/" ? "/index.html" : url);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    const send = () => fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      const body = url === "/sw.js" && state.worker === "old" ? buf.toString("utf8").replace(/const V="hedact-v\d+";/, 'const V="hedact-v1";') : buf;
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
    });
    if (url === "/sw.js" && state.worker === "fails") { res.writeHead(500).end(); return; }
    if (url === "/sw.js" && state.holdMs) { setTimeout(send, state.holdMs); return; }
    send();
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ state, server, base: "http://127.0.0.1:" + server.address().port })));
}

const seen = () => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} };
const controlled = (page) => page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
const workerSays = (page) => page.evaluate(() => new Promise((ok) => {
  navigator.serviceWorker.addEventListener("message", (e) => ok(e.data && e.data.sw), { once: true });
  navigator.serviceWorker.controller.postMessage("version");
}));

test("after an update the version chip ends as the page's own, and warns only while the old worker stays", async ({ page }) => {
  const { state, server, base } = await serveRepo();
  try {
    await page.addInitScript(seen);
    // the visitor's last visit: an older worker installed itself and controls the page
    state.worker = "old";
    await page.goto(base + "/index.html");
    await controlled(page);
    expect(await workerSays(page)).toBe("hedact-v1");
    await page.reload();
    await expect(page.locator("#ver")).toContainText("מוגש v1");

    // the new worker cannot be had: the old one keeps serving, and the warning is true and stays
    state.worker = "fails";
    await page.reload();
    await expect(page.locator("#ver")).toContainText("מוגש v1");
    await page.waitForTimeout(4000);
    await expect(page.locator("#ver")).toContainText("מוגש v1");

    // the update: the old worker answers first, the new one takes over, and the chip is the page's own
    state.worker = "current";
    state.holdMs = 1500;
    await page.reload();
    await expect(page.locator("#ver")).toContainText("מוגש v1");
    await expect(page.locator("#ver")).toHaveText("גרסה " + PAGE_V, { timeout: 20000 });
    expect(await workerSays(page)).toBe("hedact-" + PAGE_V);
  } finally {
    server.close();
  }
});

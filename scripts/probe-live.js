/* The live site, after a deploy: what the hosted site promises, checked from outside.

     node scripts/probe-live.js [--base=https://inkognito.co.il] [--version=v76.1] [--dist=dist] [--wait=120]

   - the public pages answer, marked noindex until the launch and not after it (LAUNCHED in build-hosted.js);
   - the gate: /app/ and every encoded way into it (a path written in another case, with an escaped slash, a
     doubled slash, through ../) answer with a redirect to sign-in, never with a file; a bad session cookie is
     cleared;
   - the security headers, HSTS among them (a year, for this address);
   - nothing added to the pages by Cloudflare's own features (its analytics script, its email decoder…),
     looked for in the home page, the privacy page and the demo, with a browser's identity, since Cloudflare
     adds them only to pages a browser asks for (13.10);
   - with --version, the demo shows that version;
   - with --dist, the public demo is byte for byte the build in that folder, every file under demo/ (on 18.10
     the 38 files of the live v76.1 were the bytes this repository builds);
   the last two retried every 10 seconds for --wait seconds while a deploy spreads.
   Exits 1 on any problem, so a deploy job stops on it. Until 18.10 it lived outside the repository and
   printed its problems without failing. */
const fs = require("fs");
const path = require("path");
const { LAUNCHED } = require("./build-hosted.js");
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const B = arg("base", "https://inkognito.co.il").replace(/\/$/, "");
const VERSION = arg("version", ""), DIST = arg("dist", ""), WAIT = Number(arg("wait", "0"));
const nav = { accept: "text/html,application/xhtml+xml", "sec-fetch-mode": "navigate",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" };
const get = (p, headers = nav) => fetch(B + p, { redirect: "manual", headers });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const bad = [];
  for (const p of ["/", "/login", "/privacy", "/terms", "/accessibility"]) {
    const r = await get(p);
    const line = p.padEnd(26) + r.status + "  robots=" + r.headers.get("x-robots-tag");
    console.log(line);
    if (r.status !== 200 || /noindex/.test(r.headers.get("x-robots-tag") || "") === LAUNCHED) bad.push(line + (LAUNCHED ? " (launched: no noindex)" : ""));
  }
  for (const p of ["/app/", "/app/support.js", "/app%2Fsupport.js", "/%61pp/support.js", "//app/support.js", "/APP/support.js", "/fonts/..%2Fapp%2Fsupport.js", "/app/index.html"]) {
    const r = await get(p);
    const line = p.padEnd(26) + r.status + " " + (r.headers.get("location") || "");
    console.log(line);
    if (r.status !== 302 || !/\/login\.html/.test(r.headers.get("location") || "")) bad.push(line);
  }
  const c = await get("/app/", { ...nav, cookie: "ink_at=x.y.z" });
  const cline = "/app/ (bad cookie)".padEnd(26) + c.status + " " + c.headers.get("location") + " | " + c.headers.get("set-cookie");
  console.log(cline);
  if (!/#error=session$/.test(c.headers.get("location") || "") || !/ink_at=; Path=\/; Max-Age=0/.test(c.headers.get("set-cookie") || "")) bad.push(cline);

  const h = await get("/privacy");
  const body = await h.text();
  const year = (v) => Number((/max-age=(\d+)/.exec(v) || [])[1] || 0) >= 31536000;
  for (const [name, ok] of [["x-frame-options", (v) => /DENY/.test(v)], ["x-content-type-options", (v) => /nosniff/.test(v)],
    ["referrer-policy", (v) => /strict-origin/.test(v)], ["permissions-policy", (v) => /camera=\(\)/.test(v)], ["strict-transport-security", year]]) {
    const v = h.headers.get(name) || "";
    console.log(name.padEnd(26) + v);
    if (!ok(v)) bad.push(name + " missing or too weak: " + (v || "none"));
  }
  const more = (await Promise.all(["/", "/demo/"].map((p) => get(p).then((r) => r.text()).catch(() => "")))).join("\n");
  const injected = ["email-decode", "beacon.min.js", "rocket-loader", "cloudflare-static", "cdn-cgi/challenge", "cf-beacon"].filter((s) => (body + more).includes(s));
  console.log("injected scripts".padEnd(26) + (injected.join(", ") || "none"));
  if (injected.length) bad.push("injected: " + injected.join(", "));

  if (VERSION || DIST) {
    const walk = (d, pre = "") => fs.readdirSync(d, { withFileTypes: true })
      .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), pre + e.name + "/") : [pre + e.name]);
    const files = DIST ? walk(path.join(DIST, "demo")) : [];
    // a folder's index.html is served at the folder's address: the file's own redirects there
    const address = (f) => "/demo/" + f.replace(/(^|\/)index\.html$/, "$1");
    const body = (r) => r.status === 200 ? r.arrayBuffer().then((b) => Buffer.from(b)) : null;
    let shown = "", differs = [];
    for (let t = 0; ; t += 10) {
      const demo = await get("/demo/").then((r) => r.text()).catch(() => "");
      shown = ((demo.match(/id="ver"[^>]*>([^<]*)</) || [])[1] || "").trim();
      differs = [];
      for (const f of files) {
        const live = await get(address(f)).then(body).catch(() => null);
        if (!live || !live.equals(fs.readFileSync(path.join(DIST, "demo", f)))) differs.push(address(f));
      }
      if (((!VERSION || shown.endsWith(" " + VERSION)) && !differs.length) || t >= WAIT) break;
      await sleep(10000);
    }
    if (VERSION) {
      console.log("the demo's version".padEnd(26) + (shown || "none"));
      if (!shown.endsWith(" " + VERSION)) bad.push(`the demo shows "${shown}", not ${VERSION}`);
    }
    if (DIST) {
      console.log("the demo's files".padEnd(26) + `${files.length - differs.length} of ${files.length} are the bytes of ${DIST}`);
      if (differs.length) bad.push("not the bytes of the build: " + differs.join(", "));
    }
  }
  console.log(bad.length ? "\nPROBLEMS:\n  " + bad.join("\n  ") : "\nALL GOOD");
  process.exitCode = bad.length ? 1 : 0;
})().catch((e) => { console.log("FAILED: " + (e.cause ? e.cause.code || e.cause.message : e.message)); process.exitCode = 1; });

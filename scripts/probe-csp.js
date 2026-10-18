/* The page's security policy, live: a real browser opens the public demo, records anything the policy refuses
   and any error on the page, and reports the version and whether the page's logic file ran.

     node scripts/probe-csp.js [url]           (default https://inkognito.co.il/demo/)

   Exits 1 when the policy refused anything, the page threw, or the logic file did not run, so a deploy job
   stops on it. Until 18.10 it lived outside the repository and only printed what it saw. */
const { chromium } = require("@playwright/test");

(async () => {
  const url = process.argv[2] || "https://inkognito.co.il/demo/";
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.__v = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__v.push(e.violatedDirective + " " + String(e.blockedURI).slice(0, 80)));
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e).slice(0, 140)));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector("#dc-root", { timeout: 60000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => ({
    version: (document.getElementById("ver") || {}).textContent || "",
    logicFile: !!(window.__dcLogic && typeof window.__dcLogic.make === "function"),
    refused: window.__v,
    policy: ((document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || "").split(";").find((d) => d.trim().startsWith("script-src")),
    text: document.body.innerText.length,
  }));
  console.log(JSON.stringify({ url, ...r, errors }, null, 1));
  await browser.close();
  const bad = [...r.refused.map((x) => "refused: " + x), ...errors.map((x) => "page error: " + x), ...(r.logicFile ? [] : ["the logic file did not run"])];
  console.log(bad.length ? "\nPROBLEMS:\n  " + bad.join("\n  ") : "\nALL GOOD");
  process.exitCode = bad.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });

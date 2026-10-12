const { test, expect } = require("./base");
const H = require("./helpers");

/* The page runs only the scripts its policy names (the engineering audit of 12.10, item 4; tests/csp_t.js checks the
   policy's text). Every test already fails on anything the policy refuses the page itself (e2e/base.js). Here the
   policy refuses what an injected script would need: an inline handler, and code built from text. The second is
   tried by a script of the site's own, which the policy lets run: code that page.evaluate runs is let build code by
   the browser's debugging protocol whatever the policy says (Chrome's allowUnsafeEvalBlockedByCSP), so a probe
   from there passed on the strict policy too (13.10). */
test("an injected handler does not run, and code is not built from text", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.route("**/eval-probe.js", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8",
    body: "try { window.__built = new Function('return 7')(); } catch (e) { window.__built = e && e.name; }" }));
  await H.boot(page);
  expect(await page.evaluate(() => typeof (window.__dcLogic && window.__dcLogic.make)), "page-component.js registered the logic").toBe("function");
  // and the page runs it: the entry screen is the logic's (a template with no logic draws the header alone)
  await expect(page.getByPlaceholder("הדבקת טקסט לבדיקה…"), "the page runs the logic page-component.js registered").toBeVisible();
  expect(await page.evaluate(() => window.__csp.slice()), "opening the tool breaks no rule of the policy").toEqual([]);

  const r = await page.evaluate(async () => {
    window.__pwned = 0;
    document.body.insertAdjacentHTML("beforeend", '<img id="injected" alt="" src="./no-such-picture.png" onerror="window.__pwned=1">');
    const s = document.createElement("script");
    s.src = "./eval-probe.js";
    await new Promise((res) => { s.onload = res; s.onerror = res; document.head.appendChild(s); });
    await new Promise((res) => setTimeout(res, 1000));
    document.getElementById("injected").remove();
    s.remove();
    window.__csp.splice(0); // refused on purpose here; the fixture checks the rest of the test
    return { pwned: window.__pwned, built: window.__built };
  });
  expect(r.pwned, "the injected onerror did not run").toBe(0);
  expect(r.built, "a script of the site's own cannot build code from text").toBe("EvalError");
});

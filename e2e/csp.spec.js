const { test, expect } = require("./base");
const H = require("./helpers");

/* The page runs only the scripts its policy names (the engineering audit of 12.10, item 4; tests/csp_t.js checks the
   policy's text). Every test already fails on anything the policy refuses the page itself (e2e/base.js). Here the
   policy refuses what an injected script would need: an inline handler, and code built from text. */
test("an injected handler does not run, and code is not built from text", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  expect(await page.evaluate(() => typeof (window.__dcLogic && window.__dcLogic.make)), "the logic came from page-component.js").toBe("function");
  expect(await page.evaluate(() => window.__csp.slice()), "opening the tool breaks no rule of the policy").toEqual([]);

  const r = await page.evaluate(async () => {
    window.__pwned = 0;
    document.body.insertAdjacentHTML("beforeend", '<img id="injected" alt="" src="./no-such-picture.png" onerror="window.__pwned=1">');
    let built;
    try { built = new Function("return 7")(); } catch (e) { built = e && e.name; }
    await new Promise((res) => setTimeout(res, 1000));
    document.getElementById("injected").remove();
    window.__csp.splice(0); // refused on purpose here; the fixture checks the rest of the test
    return { pwned: window.__pwned, built };
  });
  expect(r.pwned, "the injected onerror did not run").toBe(0);
  expect(r.built, "new Function is refused").toBe("EvalError");
});

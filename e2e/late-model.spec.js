const { test, expect } = require("./base");
const H = require("./helpers");

/* A leak, reduced to its mechanism.

   The model found a name several times at full confidence, and the
   name left the tool anyway. The document was long, the model was still
   scanning, and "continue without waiting" bumped the scan counter, so when
   the result arrived it was thrown away whole. Nothing downstream ever saw
   the name: not the rules, not the verifier, not the status bar, which said
   the document was safe.

   Now the scan keeps running after she continues. When it finishes, its
   names go into the rules, not into the list on a screen she has left, and
   the document is processed again. This drives exactly that path with the
   model stubbed to answer slowly. */

const DOC = [
  "שיחה עם ילדה",
  "מי המורה שלך?",
  "אנטונינה. כן, למורה קוראים אנטונינה.",
  "אה, אנטונינה. והיא נחמדה?",
  "כן.",
].join("\n");

test("a name the model finds after she continued still gets replaced", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  // the model answers after twelve seconds, well after she has moved on. The
  // delay has to outlast the time it takes to reach the button on a loaded
  // machine, or the scan simply finishes and the test measures nothing.
  await page.addInitScript(() => {
    window.__ner = { names: () => ["אנטונינה"], delay: () => 12000 };
  });
  await page.reload();
  await H.upload(page, "interview.docx", DOC);
  await H.startScan(page);

  // she does not wait
  const goNow = page.getByRole("button", { name: /לא לחכות למודל/ });
  await expect(goNow).toBeVisible({ timeout: 10000 });
  await goNow.click();
  // v36 (UX #7): the button only stops the wait; she then presses "המשך"
  await expect(H.goButton(page)).toBeEnabled();
  await H.goOn(page);

  // through the places screen if it appears, on to the check screen
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד|המשך|עיבוד/ }).first();
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });

  // the late result arrives: the name is replaced in the document. The rail
  // legitimately still shows it, as the original on its findings card.
  await expect(page.locator('[data-mark][data-val="אנטונינה"]').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator("[data-work] section").first()).not.toContainText("אנטונינה");
  const marks = page.locator("[data-mark]");
  expect(await marks.count()).toBeGreaterThan(0);
  for (const t of await marks.allTextContents()) expect(t).not.toContain("אנטונינה");
});

/* The same answer, landing while the first run is still processing (the hunt of 11.10, logic.md). The run had copied the
   rules when it started and wrote that copy back when it ended: the names the model had just added were dropped, nothing
   was pending, and the bar was green with «אסנת» in clear. Here the first run is held until the model has answered, so the
   answer lands inside it every time, not by luck of timing. */
const MEETING = [
  "סיכום פגישה עם הלקוחה",
  "יעל סיפרה שהילדים אצלה בכל סוף שבוע שני.",
  "אסנת, העובדת הסוציאלית, תבקר בבית בשבוע הבא.",
].join("\n");

test("a name the model finds while the first run is still processing is kept and replaced", async ({ page }) => {
  await H.serveEngineWithStub(page, [
    "const __rdHold = redactDocx;",
    "redactDocx = async (...a) => {",
    "  if (window.__holdRun) {",
    "    window.__holdRun = false;",
    "    if (window.__releaseModel) window.__releaseModel();",
    "    await new Promise((z) => { const t = setInterval(() => { if (window.__modelDone && Date.now() - window.__modelDone > 600) { clearInterval(t); z(); } }, 50); });",
    "  }",
    "  return __rdHold(...a);",
    "};",
  ].join("\n"));
  await H.boot(page);
  // the model answers only when the test releases it: when the first run has started
  await page.addInitScript(() => {
    window.__ner = {
      names: (t) => { window.__modelDone = Date.now(); return ["יעל", "אסנת"].filter((n) => t.includes(n)); },
      until: () => new Promise((z) => { window.__releaseModel = z; }),
    };
  });
  await page.reload();
  await H.upload(page, "meeting.docx", MEETING);
  await H.startScan(page);
  const goNow = page.getByRole("button", { name: /לא לחכות למודל/ });
  await expect(goNow).toBeVisible({ timeout: 10000 });
  await goNow.click();
  await expect(H.goButton(page)).toBeEnabled();
  await page.evaluate(() => { window.__holdRun = true; });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד|המשך|עיבוד/ }).first();
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 30000 });
  // the run landed after the model: both names it found are in the rules, and replaced in the document
  expect(await page.evaluate(() => window.__modelDone > 0)).toBe(true);
  await expect.poll(async () => page.locator("[data-work] section").first().innerText(), { timeout: 30000 }).not.toMatch(/יעל|אסנת/);
});

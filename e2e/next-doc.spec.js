const { test, expect } = require("./base");
const H = require("./helpers");

/* The next document, however it is loaded, starts from nothing of the last one (the independent review of
   6.10). «מסמך חדש» cleared about fifty keys, and a document loaded after the back buttons cleared eight:
   the people screen, the places, the suggestions, the decisions and the last scan of the first document
   were all still there for the second one. One reset now serves «מסמך חדש» and every way of loading a
   document; tests/state_t.js keeps the two from drifting apart again. */

// two people who each speak twice, so the list fills without the model
const FIRST = [
  "פרוטוקול דיון",
  "רחל פרידמן: אני מבקשת לפתוח.",
  "דוד כהן: אני המשיב.",
  "רחל פרידמן: תודה.",
  "דוד כהן: נסכם בכתב.",
].join("\n");
const NEXT = [
  "פרוטוקול ישיבה",
  "יעל ברגר: אני המבקשת.",
  "משה גולן: אני המשיב.",
  "יעל ברגר: אני מבקשת דחייה.",
  "משה גולן: אני מתנגד.",
].join("\n");

// on a phone the settings, and the model switch with them, sit behind a toggle
async function modelOff(page) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
}

// from the people screen to the review screen; the places screen comes when the document has towns
async function listToWork(page) {
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}
async function toWork(page) {
  await H.startScan(page);
  await listToWork(page);
}

const backTo = async (page, labels) => {
  for (const label of labels) {
    await expect(page.locator("[data-back]")).toContainText(label);
    await page.locator("[data-back]").click();
  }
};
const step = (page, name) => page.locator("header nav").getByRole("button", { name, exact: true });
const sheetText = (page) => page.locator("[data-work] section").first().innerText();

/* The reviewer's walk: a first document with two people, back to the file screen by «רשימת השמות» and
   «קובץ», a second document with two other people, and the header's «מי בתיק». The people screen listed
   the FIRST document's people, «המשך» applied them, and the second document's names stayed in the text.
   The same through «מקומות», which went to the places screen with the first document's rules. A header
   step now leads to this document's own list: it is built first, as «המשך — איתור שמות במסמך» does. */
for (const via of ["מי בתיק", "מקומות"]) {
  test(`the next document loaded after the back buttons gets its own list from the header's «${via}»`, async ({ page }) => {
    await H.serveEngineWithStub(page);
    await H.boot(page);
    await modelOff(page);
    await H.upload(page, "first.docx", FIRST);
    await toWork(page);
    await backTo(page, ["רשימת השמות", "קובץ"]);
    await H.upload(page, "next.docx", NEXT);

    // nothing of the first document waits in the state of the second
    const left = await page.evaluate(() => {
      const s = window.__pib.state();
      return { peo: s.peo, peoSug: s.peoSug, peoKept: s.peoKept, cands: s.cands, approved: s.approved, peoNotSame: s.peoNotSame,
        geo: s.geo, geoNames: s.geoNames, geoExtra: s.geoExtra, geoEdits: s.geoEdits, notice: s.notice || "", rules: s.rules, res: s.res };
    });
    expect(left).toEqual({ peo: [], peoSug: [], peoKept: [], cands: [], approved: [], peoNotSame: [],
      geo: null, geoNames: [], geoExtra: [], geoEdits: {}, notice: "", rules: [], res: null });

    await step(page, via).click();
    await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
    const names = await H.listedNames(page);
    expect(names).toEqual(expect.arrayContaining(["יעל ברגר", "משה גולן"]));
    expect(names).not.toContain("רחל פרידמן");
    expect(names).not.toContain("דוד כהן");

    await listToWork(page);
    const text = await sheetText(page);
    expect(text).not.toContain("יעל ברגר");
    expect(text).not.toContain("משה גולן");
    const rules = await page.evaluate(() => window.__pib.state().rules.map((r) => r.value));
    expect(rules).toEqual(expect.arrayContaining(["יעל ברגר", "משה גולן"]));
    expect(rules).not.toContain("רחל פרידמן");
    expect(rules).not.toContain("דוד כהן");
  });
}

/* The same class, later: the first document's model went on scanning after «לא לחכות למודל», and its
   answer came back while the second document was open. It was written into the second document's rules
   («מסמך חדש» and the back buttons alike), and the second document was processed again with the first
   client's name in it. The reset ends the last document's scan with it. */
for (const how of ["«מסמך חדש»", "the back buttons"]) {
  test(`a model still scanning the last document writes nothing into the next one, after ${how}`, async ({ page }) => {
    await H.serveEngineWithStub(page);
    await H.boot(page);
    // only the first document's scan finds a name, and only late
    await page.evaluate(() => {
      window.__ner = {
        delay: (t) => (t.includes("רחל פרידמן") ? 6000 : 0),
        names: (t) => { window.__nerDone = (window.__nerDone || 0) + 1; return t.includes("רחל פרידמן") ? ["שמעון ביטון"] : []; },
        n: () => 2,
      };
    });
    await H.upload(page, "first.docx", FIRST + "\nהעד שמעון ביטון לא הגיע. שמעון ביטון יוזמן שוב.");
    await H.startScan(page);
    await page.getByRole("button", { name: /לא לחכות למודל/ }).click();
    await listToWork(page);

    if (how === "«מסמך חדש»") {
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "מסמך חדש", exact: true }).click();
    } else await backTo(page, ["רשימת השמות", "קובץ"]);
    await modelOff(page);
    await H.upload(page, "next.docx", NEXT);
    await toWork(page);
    await expect(page.locator('[data-mark][data-val="יעל ברגר"]').first()).toBeVisible();

    // the first document's scan answers now, while the second one is on the screen
    await page.waitForFunction(() => window.__nerDone >= 1, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    const now = await page.evaluate(() => {
      const s = window.__pib.state();
      return { rules: s.rules.map((r) => r.value), suggest: ((s.res && s.res.verification.suggest) || []).map((x) => x.value) };
    });
    expect(now.rules).not.toContain("שמעון ביטון");
    expect(now.suggest).not.toContain("שמעון ביטון");
    expect(await page.locator("[data-work]").innerText()).not.toContain("שמעון ביטון");
  });
}

const { test, expect } = require("./base");
const H = require("./helpers");

/* Saved cases belong to whoever uses the tool (the move to inkognito.co.il, 6.10.2026). The hosted
   service runs this same page for every account, and several accounts can share one computer, so every
   read, write and removal of the two case keys ("redact-cases", "redact-profile-last"), and the check
   on their storage events, goes through caseKey(k): the key itself while window.__inkStoreSuffix is
   unset (the public tool, where the saved cases already are), k + ":" + the suffix once the hosted page
   sets it to the signed-in account. The display keys (redact-theme, redact-intro-seen, redact-tour-seen)
   stay shared. Every name here is invented. */

const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n");
const profile = (name, real, fake, updated = "2026-09-01T09:00:00.000Z") => ({ v: 1, name, created: "2026-08-20T09:00:00.000Z", updated, mode: "real",
  rules: [{ value: real, kind: "NAME", replacement: fake, auto: false, g: null }], allow: [], map: { [real]: fake }, removed: [], sent: {},
  styles: { num: "blank", date: "name" } });
const PLAIN_CASE = profile("פלדמן נ׳ גרוס", "מיכאל פלדמן", "יואב כרמי");
const PLAIN_LAST = profile("", "דפנה גרוס", "שירה אלון");
const ACCOUNT_CASE = profile("ברק נ׳ ברק", "עדי ברק", "נועה שגב");
const LAST_CARD = "להמשיך עם הפרופיל מהפעם הקודמת?";

// what the browser holds under the case keys, plain and suffixed, parsed
const store = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
  .filter((k) => /^redact-(cases|profile-last)(:|$)/.test(k)).sort().map((k) => [k, JSON.parse(localStorage.getItem(k))])));

// an init script runs again on every navigation: the storage is seeded once, the suffix set every time
// (a string is stored as it is, anything else as JSON)
function seed(page, items, suffix) {
  return page.addInitScript(([items, suffix]) => {
    if (suffix !== null) window.__inkStoreSuffix = suffix;
    try {
      if (window.sessionStorage.getItem("seeded")) return;
      window.sessionStorage.setItem("seeded", "1");
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    } catch (_) {}
  }, [items, suffix === undefined ? null : suffix]);
}

/* The file of all the cases, as the old address's moved page downloads it («הורדת התיקים לקובץ»,
   forward/index.html): {"inkognito":"cases","v":1,"exported":<ISO date>,"cases":<redact-cases>,"last":<redact-profile-last or null>} */
const casesFile = (cases, last = null) => ({ name: "inkognito-cases-2026-10-06.json", mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify({ inkognito: "cases", v: 1, exported: "2026-10-06T10:00:00.000Z", cases: Object.fromEntries(cases.map((p) => [p.name, p])), last })) });
const CASES_BUTTON = "ייבוא תיקים מקובץ";
// a file chosen through a button, the way she chooses it: the button opens the file picker
async function importFile(page, file, button = CASES_BUTTON) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button, exact: true }).click();
  await (await chooser).setFiles(file);
}
const notice = (page) => page.locator("[data-notice]");

// a document through to the work screen, saved as a named case
async function workAndName(page, caseName) {
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await page.locator("[data-case-field] input").fill(caseName);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
}

test("without an account suffix the keys are the ones the public tool always used: her saved case and last profile are offered, and a new case is written there", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE }, "redact-profile-last": PLAIN_LAST });
  await H.boot(page);
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toBeVisible();
  await expect(page.getByText(LAST_CARD)).toBeVisible();

  await workAndName(page, "לוי נ׳ לוי");
  await expect.poll(async () => Object.keys((await store(page))["redact-cases"] || {}).sort()).toEqual(["לוי נ׳ לוי", PLAIN_CASE.name].sort());
  const s = await store(page);
  expect(Object.keys(s)).toEqual(["redact-cases", "redact-profile-last"]);
  expect(s["redact-cases"][PLAIN_CASE.name]).toEqual(PLAIN_CASE);
  expect(s["redact-profile-last"].name).toBe("לוי נ׳ לוי");
});

test("with an account suffix, cases are read, written and removed under the account's keys, and the plain keys are neither shown nor touched", async ({ page, context }) => {
  await H.serveEngineWithStub(page);
  const plain = { "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE }, "redact-profile-last": PLAIN_LAST };
  await seed(page, { ...plain, "redact-cases:acct-7": { [ACCOUNT_CASE.name]: ACCOUNT_CASE } }, "acct-7");
  await H.boot(page);
  await expect(page.locator(`[data-case="${ACCOUNT_CASE.name}"]`)).toBeVisible();
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toHaveCount(0);
  await expect(page.getByText(LAST_CARD)).toHaveCount(0);

  // another tab of the same account saves a case: this tab's list follows it (the storage event on the account's key)
  const other = await context.newPage();
  await other.goto("/icon.svg");
  const added = profile("שחר נ׳ שחר", "גלית שחר", "מורן לב", "2026-09-03T09:00:00.000Z");
  await other.evaluate(([k, p]) => { const m = JSON.parse(localStorage.getItem(k) || "{}"); m[p.name] = p; localStorage.setItem(k, JSON.stringify(m)); }, ["redact-cases:acct-7", added]);
  await expect(page.locator(`[data-case="${added.name}"]`)).toBeVisible();
  await other.close();

  await workAndName(page, "לוי נ׳ לוי");
  await expect.poll(async () => Object.keys((await store(page))["redact-cases:acct-7"] || {}).sort()).toEqual([ACCOUNT_CASE.name, added.name, "לוי נ׳ לוי"].sort());
  let s = await store(page);
  expect(s["redact-profile-last:acct-7"].name).toBe("לוי נ׳ לוי");
  expect(s["redact-cases"]).toEqual(plain["redact-cases"]);
  expect(s["redact-profile-last"]).toEqual(plain["redact-profile-last"]);

  // a new document: the account's cases are offered, the plain ones are not, and deleting one removes it from the account only
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await expect(page.locator('[data-case="לוי נ׳ לוי"]')).toBeVisible();
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toHaveCount(0);
  await expect(page.getByText(LAST_CARD)).toHaveCount(0);
  await page.locator('[data-case="לוי נ׳ לוי"]').getByRole("button", { name: "מחיקה", exact: true }).click();
  await expect(page.locator('[data-case="לוי נ׳ לוי"]')).toHaveCount(0);
  s = await store(page);
  expect(Object.keys(s["redact-cases:acct-7"]).sort()).toEqual([ACCOUNT_CASE.name, added.name].sort());
  expect(s["redact-profile-last:acct-7"]).toBeUndefined();
  expect(s["redact-cases"]).toEqual(plain["redact-cases"]);
  expect(s["redact-profile-last"]).toEqual(plain["redact-profile-last"]);
});

/* Importing all the cases from one file («ייבוא תיקים מקובץ»). The old address's moved page downloads
   every case of that browser in one file; after signing up she chooses it here. Its cases join the saved
   cases of whoever uses the tool (caseKey), its last profile only when there is none, and nothing is
   ever overwritten: a case whose name is taken stays, and the imported one gets the next free number. */

test("«ייבוא תיקים מקובץ» on the entry screen adds every case of a cases file, and its last profile when there is none", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const a = profile("כהן נ׳ כהן", "אורית כהן", "מירב טל"), b = profile("דהן נ׳ דהן", "יוסי דהן", "רון גל", "2026-09-05T09:00:00.000Z");
  const last = profile("", "תמר רז", "ליאת בר");
  await importFile(page, casesFile([a, b], last));
  await expect(notice(page)).toHaveText("יובאו 2 תיקים.");
  await expect(page.locator(`[data-case="${a.name}"]`)).toBeVisible();
  await expect(page.locator(`[data-case="${b.name}"]`)).toBeVisible();
  await expect(page.getByText(LAST_CARD)).toBeVisible();
  expect(await store(page)).toEqual({ "redact-cases": { [a.name]: a, [b.name]: b }, "redact-profile-last": last });
});

test("a case whose name is taken stays as it is, the imported one gets the next free number, and a last profile already there stays", async ({ page }) => {
  await H.serveEngineWithStub(page);
  const mine = profile("לוי נ׳ לוי", "שרה לוי", "דנה רום"), mine2 = profile("לוי נ׳ לוי 2", "משה לוי", "עמית שור");
  const myLast = profile("", "נגה פז", "הדס ים");
  await seed(page, { "redact-cases": { [mine.name]: mine, [mine2.name]: mine2 }, "redact-profile-last": myLast });
  await H.boot(page);
  const theirs = profile("לוי נ׳ לוי", "רינה לוי", "גילה נוי", "2026-09-07T09:00:00.000Z"), other = profile("אבן נ׳ אבן", "עוז אבן", "טל דור");
  await importFile(page, casesFile([theirs, other], profile("", "אלה גור", "מאיה רון")));
  await expect(notice(page)).toHaveText("יובאו 2 תיקים.");
  const s = await store(page);
  expect(s["redact-cases"]).toEqual({ [mine.name]: mine, [mine2.name]: mine2, "לוי נ׳ לוי 3": { ...theirs, name: "לוי נ׳ לוי 3" }, [other.name]: other });
  expect(s["redact-profile-last"]).toEqual(myLast);
  for (const n of [mine.name, mine2.name, "לוי נ׳ לוי 3", other.name]) await expect(page.locator(`[data-case="${n}"]`)).toBeVisible();
});

test("a malformed or foreign file changes nothing and gets the message of a broken profile file", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE }, "redact-profile-last": PLAIN_LAST });
  await H.boot(page);
  const before = await store(page);
  const env = { inkognito: "cases", v: 1, exported: "2026-10-06T10:00:00.000Z" };
  const one = { [ACCOUNT_CASE.name]: ACCOUNT_CASE };
  const bad = ["{not json", "null", JSON.stringify([ACCOUNT_CASE]), JSON.stringify({ hello: "world" }),
    JSON.stringify({ ...env, v: 2, cases: one, last: null }), JSON.stringify({ ...env, cases: [ACCOUNT_CASE], last: null }),
    JSON.stringify({ ...env, last: null }), JSON.stringify({ ...env, cases: one, last: "x" })];
  for (const body of bad) {
    await page.reload();
    await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toBeVisible({ timeout: 60000 });
    await importFile(page, { name: "cases.json", mimeType: "application/json", buffer: Buffer.from(body) });
    const err = page.getByRole("alert").filter({ hasText: "טעינת הפרופיל נכשלה" });
    await expect(err, body).toBeVisible();
    await expect(err, body).toContainText("ייצוא לקובץ");
    await expect(err, body).not.toContainText(/Expected|position|JSON|Unexpected|undefined/);
    await expect(notice(page), body).toHaveCount(0);
    expect(await store(page), body).toEqual(before);
    await expect(page.locator(`[data-case="${ACCOUNT_CASE.name}"]`), body).toHaveCount(0);
  }
});

test("case names from a file are shown as text, never as markup", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const name = '<img src=x onerror="window.__pwned=1">פרץ';
  await importFile(page, casesFile([profile(name, "חנה פרץ", "רות שני")]));
  await expect(notice(page)).toHaveText("יובאו 1 תיקים.");
  await expect(page.locator("[data-case]").getByText(name, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => [window.__pwned, document.querySelectorAll("main img").length])).toEqual([undefined, 0]);
});

test("the single-profile import still loads one profile, and a cases file given to it adds the cases", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await importFile(page, casesFile([ACCOUNT_CASE]), "ייבוא פרופיל מקובץ");
  await expect(notice(page)).toHaveText("יובאו 1 תיקים.");
  await expect(page.locator(`[data-case="${ACCOUNT_CASE.name}"]`)).toBeVisible();
  // a profile exported from one case («ייצוא לקובץ»): it is loaded as the case in use, as before
  const one = profile("גל נ׳ גל", "איתי גל", "עידו נר");
  await importFile(page, { name: "פרופיל-גל נ׳ גל.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(one)) }, "ייבוא פרופיל מקובץ");
  await expect(page.locator("[data-case-chip]")).toContainText("תיק: גל נ׳ גל");
  expect(Object.keys((await store(page))["redact-cases"])).toEqual([ACCOUNT_CASE.name]);
});

test("with an account suffix the import adds to the account's cases only", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE } }, "acct-9");
  await H.boot(page);
  await importFile(page, casesFile([ACCOUNT_CASE], PLAIN_LAST));
  await expect(notice(page)).toHaveText("יובאו 1 תיקים.");
  expect(await store(page)).toEqual({ "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE },
    "redact-cases:acct-9": { [ACCOUNT_CASE.name]: ACCOUNT_CASE }, "redact-profile-last:acct-9": PLAIN_LAST });
  await expect(page.locator(`[data-case="${ACCOUNT_CASE.name}"]`)).toBeVisible();
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toHaveCount(0);
});

/* "Clear this computer" (modelForget, in the settings: «מחיקת המודל והקבצים השמורים מהמחשב») removes the
   saved cases of every account on the computer too: the plain keys and every key that is one of them
   followed by ":". The display keys and anything else stay. */
test("clearing the tool from the computer removes every saved case on it, of every account, and keeps the display settings", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await page.addInitScript(() => { window.__ner = { env: { local: false, canCache: true, canRun: true }, cached: true }; });
  await seed(page, { "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE }, "redact-profile-last": PLAIN_LAST,
    "redact-cases:acct-1": { [ACCOUNT_CASE.name]: ACCOUNT_CASE }, "redact-profile-last:acct-1": PLAIN_LAST, "redact-profile-last:acct-2": PLAIN_LAST,
    "redact-theme": "light", "redact-cases-notes": "kept", "another-tool": "kept" });
  await H.boot(page);
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toBeVisible();
  const settings = page.locator("[data-settings-toggle]");
  if ((await settings.getAttribute("aria-expanded")) !== "true") await settings.click();
  await page.locator("[data-model-forget]").click();
  await expect(notice(page)).toContainText("המודל והקבצים השמורים נמחקו מהמחשב");
  expect(await store(page)).toEqual({});
  expect(await page.evaluate(() => ["redact-theme", "redact-intro-seen", "redact-tour-seen", "redact-cases-notes", "another-tool"].map((k) => localStorage.getItem(k))))
    .toEqual(["light", "1", "*", "kept", "kept"]);
  await expect(page.locator("[data-case]")).toHaveCount(0);
  await expect(page.getByText(LAST_CARD)).toHaveCount(0);
});

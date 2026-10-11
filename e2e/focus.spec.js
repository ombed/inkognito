const { test, expect } = require("./base");
const H = require("./helpers");

/* Where the keyboard is after a screen changes, and what a screen reader hears (the hunt of 11.10). The button that
   was pressed went with its screen, and the focus fell to the page's body, so every screen started from the top,
   unannounced; the busy text and the review screen's verdict sat in regions that came up with their text, which a
   screen reader does not read. The site's accessibility page promises full keyboard navigation. */

const DOC = ["פרוטוקול דיון", "רחל פרידמן: אני מבקשת לפתוח.", "דוד כהן: אני המשיב.", "רחל פרידמן: תודה.", "דוד כהן: נסכם בכתב. ההורים גרים בחולון ובבת ים."].join("\n");
const focused = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.tagName === "H1" ? "h1:" + a.textContent.trim() : a.tagName.toLowerCase() + ":" + (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 30)) : "none"; });

async function open(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
}

test("each new screen takes the focus on its heading", async ({ page }) => {
  await open(page);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await expect.poll(() => focused(page)).toBe("h1:מי מופיע בתיק");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run).toBeVisible({ timeout: 20000 });
  await expect.poll(() => focused(page)).toMatch(/^h1:/);
  await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  // the file name in the title is wrapped in direction marks
  await expect.poll(() => focused(page)).toMatch(/^h1:\W*hearing\.docx\W*$/);
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.resolve(); });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
  const anyway = page.getByRole("button", { name: /בכל זאת/ });
  if (await anyway.isVisible({ timeout: 800 }).catch(() => false)) await anyway.click();
  // the bar's step 3, which goes with the review screen (a button in the header stays, and keeps the focus)
  await page.locator('[data-bar] [data-step="3"]').click();
  await expect.poll(() => focused(page)).toBe("h1:החזרת שמות מתשובת AI");
});

test("a control that is still there keeps the focus", async ({ page }) => {
  await open(page);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  // the header's steps stay on the screen: «קובץ» keeps the focus it was pressed with
  const step = page.locator("header nav").getByRole("button", { name: "קובץ", exact: true });
  await step.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("header nav").getByRole("button", { name: "קובץ", exact: true })).toHaveAttribute("aria-current", /true|step|page/);
  await page.waitForTimeout(200);
  expect(await focused(page)).toBe("button:קובץ");
});

test("the busy text and the review screen's verdict are said by a status region that is already on the page", async ({ page }) => {
  await open(page);
  const sr = page.locator("[data-sr-status]");
  await expect(sr).toHaveCount(1);
  await expect(sr).toHaveAttribute("role", "status");
  expect((await sr.innerText()).trim()).toBe("");
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  // the verdict the bar shows, said once by the region that was there before it
  const title = (await page.locator("[data-bar-text] b").first().innerText()).trim();
  expect(title.length).toBeGreaterThan(5);
  await expect(sr).toHaveText(title);
  await expect(page.locator("[data-sr-status]")).toHaveCount(1);
});

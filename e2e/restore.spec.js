const { test, expect } = require("./base");
const H = require("./helpers");

/* The restore screen («החזרת שמות מתשובת AI»), from the live check of 6.10. */

// two people who each speak twice, so the list fills without the model
const DOC = [
  "פרוטוקול דיון",
  "רחל פרידמן: אני מבקשת לפתוח.",
  "דוד כהן: אני המשיב.",
  "רחל פרידמן: תודה.",
  "דוד כהן: נסכם בכתב.",
].join("\n");

// on a phone the settings, and the model switch with them, sit behind a toggle
async function modelOff(page) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
}

// from a loaded document to the review screen; the places screen comes when the document has towns
async function toWork(page) {
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  const bar = page.locator("[data-bar]");
  await expect(run.or(bar).first()).toBeVisible({ timeout: 20000 });
  if (await run.isVisible()) await run.click();
  await expect(bar).toBeVisible({ timeout: 20000 });
}

async function firstDoc(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await modelOff(page);
  await H.upload(page, "case.docx", DOC);
  await toWork(page);
}

const fakeOf = async (page, real) => (await page.locator(`[data-mark][data-val="${real}"]`).first().innerText()).trim();
const openRestore = (page) => page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();

async function restore(page, answer) {
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill(answer);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(page.locator("[data-rv-out]")).toBeVisible();
}

/* Each paragraph of the restored answer as laid out: the edge it hugs, and whether its closing
   mark sits to the left of its first letter (read right to left) or to its right. */
const paragraphs = (page) => page.locator("[data-rv-out]").evaluate((out) => {
  const walker = document.createTreeWalker(out, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let full = "", n;
  while ((n = walker.nextNode())) { nodes.push({ n, at: full.length }); full += n.data; }
  const pos = (i) => { for (let k = nodes.length - 1; k >= 0; k--) if (i >= nodes[k].at) return [nodes[k].n, i - nodes[k].at]; return [nodes[0].n, 0]; };
  const rects = (s, e) => { const r = document.createRange(); r.setStart(...pos(s)); r.setEnd(...pos(e)); return [...r.getClientRects()].filter((q) => q.width > 0); };
  const cs = getComputedStyle(out), box = out.getBoundingClientRect();
  const left = box.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
  const right = box.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
  const res = [];
  let i = 0;
  for (const line of full.split("\n")) {
    const s = i, e = i + line.length;
    i = e + 1;
    if (!line.trim()) continue;
    const rs = rects(s, e);
    const L = Math.min(...rs.map((q) => q.left)), R = Math.max(...rs.map((q) => q.right));
    const f = s + line.search(/\S/), first = rects(f, f + 1)[0], last = rects(e - 1, e)[0];
    res.push({
      line,
      lines: new Set(rs.map((q) => Math.round(q.top))).size,
      hugs: right - R <= 2 && L - left > 2 ? "right" : L - left <= 2 && right - R > 2 ? "left" : "both",
      markLeftOfStart: last.right <= first.left + 1,
    });
  }
  return res;
});

for (const size of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }]) {
  test.describe(`at ${size.name} size`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    /* Live check, 6.10: the result was one block with dir="auto", so an answer that opened with a Latin
       letter («Sure!», «Summary:», a ``` fence) laid every Hebrew paragraph out left to right, with its
       full stop on the wrong side. Each paragraph now takes its direction from its own first letter,
       as the paste box above it does, inside a box that is right to left. */
    test("each paragraph of the restored answer reads in its own direction", async ({ page }) => {
      await firstDoc(page);
      const r = await fakeOf(page, "רחל פרידמן"), d = await fakeOf(page, "דוד כהן");
      await openRestore(page);

      // an answer that opens in English
      await restore(page, ["Sure! Here is a summary:", `${r} היא המבקשת.`, `${d} הוא המשיב.`, "Both agree."].join("\n"));
      await expect(page.locator("[data-rv-out]")).toContainText("רחל פרידמן היא המבקשת.");
      let got = await paragraphs(page);
      expect(got.map((p) => p.lines), "each paragraph fits one line, so the edge it hugs says its direction").toEqual([1, 1, 1, 1]);
      expect(got.map((p) => [p.line, p.hugs, p.markLeftOfStart])).toEqual([
        ["Sure! Here is a summary:", "left", false],
        ["רחל פרידמן היא המבקשת.", "right", true],
        ["דוד כהן הוא המשיב.", "right", true],
        ["Both agree.", "left", false],
      ]);

      // an answer that opens in Hebrew, with an English line inside
      await restore(page, [`${d} הוא המשיב.`, "Note: see the protocol.", `${r} היא המבקשת.`].join("\n"));
      await expect(page.locator("[data-rv-out]")).toContainText("דוד כהן הוא המשיב.");
      got = await paragraphs(page);
      expect(got.map((p) => [p.line, p.hugs, p.markLeftOfStart])).toEqual([
        ["דוד כהן הוא המשיב.", "right", true],
        ["Note: see the protocol.", "left", false],
        ["רחל פרידמן היא המבקשת.", "right", true],
      ]);
    });
  });
}

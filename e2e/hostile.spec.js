const { test, expect } = require("./base");
const H = require("./helpers");
const zlib = require("zlib");
const { DOMParser } = require("@xmldom/xmldom");

/* A document from the other side is the realistic attacker (outside review, 12.10): its text reaches the list of
   people, the document on the work screen, the cards, the downloaded file and the restore screen, and its file name
   is shown too. Markup and template syntax in it are text: nothing runs, nothing renders as markup, and the Word
   file that comes back is well formed and holds them as written. Every name is invented. */
const PAYLOADS = [
  '<img src=x onerror="window.__pwned=1">',
  "<script>window.__pwned=2</script>",
  "{{ window.__pwned=3 }}",
  "{{ constructor.constructor('window.__pwned=4')() }}",
  '<a href="javascript:window.__pwned=5">קישור</a>',
  "<b>מודגש</b>",
];
const DOC = [
  `סיכום פגישה עם דנה כהן ${PAYLOADS[0]} בעניין המשמורת.`,
  `${PAYLOADS[1]} דנה כהן אמרה ${PAYLOADS[2]} שהיא מסכימה.`,
  `${PAYLOADS[3]} ו־${PAYLOADS[4]} ${PAYLOADS[5]} נשלחו אל דנה כהן.`,
].join("\n");
const pwned = (page) => page.evaluate(() => window.__pwned);

// the one Word entry a test needs, from the downloaded file (stored or deflated)
function entry(buf, want) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0, n = buf.readUInt16LE(e + 10); i < n; i++) {
    const meth = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    if (buf.slice(p + 46, p + 46 + nl).toString("utf8") === want) {
      const raw = buf.slice(lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28) + cs);
      return (meth === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf8");
    }
    p += 46 + nl + el + cl;
  }
  return null;
}

test("markup and template syntax in a document and its name are text on every screen and in the file", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await H.upload(page, `${PAYLOADS[0]}.docx`, DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  // the model is a stub here: the name goes into the list by hand, and the list shows the sentences it is in
  await page.getByPlaceholder(/שם מלא/).fill("דנה כהן");
  await page.getByRole("button", { name: "הוספה", exact: true }).click();
  expect(await pwned(page), "the list of people, with the sentences each name is in").toBeUndefined();

  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  expect(await pwned(page), "the work screen").toBeUndefined();

  // the document shows each payload as the text it is, and none of it as an element
  const paper = page.locator("[data-paper]");
  for (const p of [PAYLOADS[1], PAYLOADS[2], PAYLOADS[3], PAYLOADS[5]]) await expect(paper).toContainText(p);
  expect(await paper.locator('img[src="x"], script, a[href^="javascript"]').count()).toBe(0);
  await expect(paper).not.toContainText("דנה כהן");

  // the downloaded Word file is well formed and holds the payloads as text
  const dl = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: "הורדת Word" }).click();
  const anyway = page.getByRole("button", { name: "להוריד בכל זאת" });
  if (await anyway.isVisible({ timeout: 1500 }).catch(() => false)) await anyway.click();
  const file = await (await dl).path();
  const xml = entry(require("fs").readFileSync(file), "word/document.xml");
  const errors = [];
  const dom = new DOMParser({ onError: (level, msg) => { if (level !== "warning") errors.push(msg); } }).parseFromString(xml, "application/xml");
  expect(errors, "document.xml parses").toEqual([]);
  const text = Array.from(dom.getElementsByTagName("w:t")).map((t) => t.textContent).join("");
  for (const p of PAYLOADS) expect(text, "the file holds «" + p + "» as text").toContain(p);
  expect(dom.getElementsByTagName("script").length + dom.getElementsByTagName("img").length).toBe(0);
  expect(await pwned(page), "the download").toBeUndefined();

  // an AI answer with the same payloads comes back as text on the restore screen
  const fake = (await page.locator("[data-mark][data-val='דנה כהן']").first().innerText()).trim();
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  await page.getByLabel("תשובת ה-AI").fill(`${fake} ${PAYLOADS.join(" ")} ${fake}`);
  await page.locator("[data-rv-go]").click();
  const out = page.locator("[data-rv-out]");
  await expect(out).toContainText("דנה כהן");
  for (const p of [PAYLOADS[1], PAYLOADS[2], PAYLOADS[3], PAYLOADS[5]]) await expect(out).toContainText(p);
  expect(await out.locator('img[src="x"], script, a[href^="javascript"]').count()).toBe(0);
  expect(await pwned(page), "the restore screen").toBeUndefined();
});

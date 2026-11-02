/* Identifying numbers, and the name a label points to: behaviours no suite held (the mutation hunt of 1.11).

   Each check here was found the same way: a small, likely edit to the engine (a bound moved by one, a separator
   dropped from a pattern, a comparison flipped) broke it, and every suite and the result lock stayed green. A
   broken one means a real number or name reaches the AI, or is no longer asked about. Each section names the
   behaviour it protects; the commit that added it names the edit that proved it blind.
   Every name and number here is invented. */
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the page's own defaults: every detector marked on is deleted unasked, the rest are flagged for a look
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)); FLAG.add("NAME_ANCHORED");
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const numbers = (t) => new C.Engine([], [], OPT, t).detect(t).filter((h) => h.src === "pattern" && h.type !== "DATE");
const show = (hs) => hs.map((h) => h.type + "«" + h.text + "»" + (h.apply ? "" : " asked")).join(", ") || "nothing";
// the value is found whole and deleted without asking
const deleted = (text, value) => {
  const hs = numbers(text);
  ok(hs.some((h) => h.text.trim() === value && h.apply), "«" + text + "»: «" + value + "» deleted — got " + show(hs));
};

console.log("\n— an ID number after its label is deleted from five digits up, not only as nine —");
// an old identity number is often written without its leading zeros
deleted("המנוח, ת\"ז 345671, הותיר צוואה בכתב ידו.", "345671");
deleted("לפי הרישום, ת.ז. 51234 שייכת לאב.", "51234");

console.log("\n— a mobile number with dots between its groups is deleted, as with dashes or spaces —");
deleted("ניתן להשיג את המבקשת בנייד 054.771.2093 בשעות הערב.", "054.771.2093");
deleted("מספר הנייד של האב: 052.4418806.", "052.4418806");

console.log("\n— a passport number of six letters and digits is deleted, not only of seven to nine —");
deleted("לאם דרכון זר מס' K12345, שהונפק בשנת 2019.", "K12345");

console.log("\n— a card number whose check digit matches is deleted unasked; one that does not is asked —");
{
  // 4580 1234 5678 9015 passes the card check (Luhn); 4580 1234 5678 9010 does not
  const good = numbers("החיוב בוצע בכרטיס 4580 1234 5678 9015 ביום החתימה.").filter((h) => h.type === "CREDIT_CARD");
  ok(good.length === 1 && good[0].apply === true, "a card number that passes its check is deleted unasked — got " + show(good));
  const typo = numbers("החיוב בוצע בכרטיס 4580 1234 5678 9010 ביום החתימה.").filter((h) => h.type === "CREDIT_CARD");
  ok(typo.length === 1 && typo[0].apply === false && typo[0].review === true, "one that fails it is asked about, not dropped — got " + show(typo));
}

// a .docx of paragraphs, as slots2_t.js builds it
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const docx = (lines) => mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    lines.map((t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`).join("") + "</w:body></w:document>" },
]);
// with the model off: what discover offers, and what the engine flags as a name read from its context
async function names(lines) {
  const cands = C.discover(await C.readBlocks(docx(lines)));
  const res = await C.redactDocx(docx(lines), [], [], OPT);
  return { cands, flagged: res.flagged.filter((f) => f.label === "שם (לפי הקשר)").map((f) => f.value), complete: res.verification.complete };
}

(async () => {
  console.log("\n— the name below a signature is read past two lines without a letter —");
  {
    // the signature line and a stamp line between «בכבוד רב,» and the signer
    const r = await names(["בקשה למתן צו הגנה", "המבקשת מבקשת צו הגנה נגד המשיב.", "בכבוד רב,", "____________________", "__________", "נועה ברזילי, עו\"ד"]);
    ok(r.flagged.includes("נועה ברזילי") && !r.complete, "the signer is asked about and the bar is not green — flagged «" + r.flagged.join(" | ") + "»");
  }

  console.log("\n— a caption over a short hearing: the parties' names under their roles are still read —");
  {
    // half of the role labels stand over a name (the caption), half over a statement (the hearing): this is not
    // a protocol whose labels stand over speech only, and the caption's names fill the list
    const r = await names(["התובעת:", "נועה ברזילי", "נ ג ד", "הנתבע:", "אורי קרמליץ", "פרוטוקול הדיון",
      "התובעת:", "חוזרת על הבקשה ומבקשת להורות על מזונות זמניים.", "הנתבע:", "מתנגד לבקשה, אין לו הכנסה קבועה."]);
    for (const v of ["נועה ברזילי", "אורי קרמליץ"]) {
      const c = r.cands.find((x) => x.value === v);
      ok(c && c.conf === "high" && r.flagged.includes(v), "«" + v + "» listed as sure and flagged — " + (c ? c.conf : "not offered") + ", flagged «" + r.flagged.join(" | ") + "»");
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();

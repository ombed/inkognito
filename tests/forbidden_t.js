/* An invented name is never a real word of the document, in any of its forms (12.10). The engine forbids every word of
   the document as an invented name, so that a pseudonym is never a real person's name in the same text. It held the
   word as written: «ברקוביץ׳» with its geresh, «וברקוביץ» with its prefix letter. «ברקוביץ» is also a surname in the
   invented pool, so another person in a document with a real «יואב ברקוביץ׳» could be given it: since the secret key
   (v73.13) about once in a hundred keys, which is how the browser test UX #8 caught it. Invented names only. */
const crypto = require("crypto");
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
const forbiddenOf = (text) => new C.Engine([], [], OPT, text).forbidden;

console.log("\n— a word of the document is forbidden in its other forms too —");
{
  const f = forbiddenOf("מר יואב ברקוביץ׳ ענה, והעד וברקוביץ השיב. השופטת נועה קלדרון סיכמה.");
  ok(f.has("ברקוביץ"), "without its geresh («ברקוביץ׳» → «ברקוביץ»)");
  const g = forbiddenOf("העד וברקוביץ השיב.");
  ok(g.has("ברקוביץ"), "without its prefix letter («וברקוביץ» → «ברקוביץ»)");
  ok(!forbiddenOf("הוא אמר כן.").has("מר"), "a short word is not cut: «אמר» does not forbid «מר»");
}

console.log("\n— so no key gives another person that surname —");
{
  const text = "עו״ד רונן אלמליח פתח. מר יואב ברקוביץ׳ ענה. השופטת נועה קלדרון סיכמה.";
  const f = forbiddenOf(text);
  ok(C.POOL.he_s.includes("ברקוביץ"), "(«ברקוביץ» is in the invented surname pool)");
  let hits = 0;
  for (let i = 0; i < 400; i++) {
    C.setAliasKey(crypto.randomBytes(32).toString("hex"));
    for (const v of ["נועה קלדרון", "רונן אלמליח"]) if (/ברקוביץ/.test(C.fakeName(v, null, new Set(), f, new Set()))) hits++;
  }
  C.setAliasKey(null);
  ok(hits === 0, "800 invented names over 400 keys, none «… ברקוביץ»: " + hits);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

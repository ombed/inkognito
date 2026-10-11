/* An invented name is never an everyday word (the hunt of 11.10).

   The pool handed out names that are also words: «דנה» (discussed), «מלמד» (teaches), «פרץ» (broke out), «מירב»
   (most), «יהודית» (Jewish), «מיכל» (a tank), «איתי» (with me), «מרים» (lifts), «בן-דוד» (a cousin), and names a
   prefix letter turns into a word: «מליאת» (מ + «ליאת»), «שרותי» (ש + «רותי»), «מממן» (מ + «ממן»). The AI writes the word
   in its everyday sense, and the restore put the client's real name there, under «הוחזרו»: «השופטת דנה בבקשה» came back
   as «השופטת בארי בבקשה». About one invented name part in six was such a word. The list was measured on a public
   Hebrew news corpus (counts only) and checked by eye. Every name here is invented. */
const xd = require("@xmldom/xmldom");
global.DOMParser = xd.DOMParser; global.XMLSerializer = xd.XMLSerializer;
{
  const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
  for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
    if (!("children" in proto)) Object.defineProperty(proto, "children", { get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
    if (!proto.remove) proto.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
    if (!proto.querySelector) proto.querySelector = function (t) { const l = this.getElementsByTagName(t); return l && l.length ? l[0] : null; };
  }
}
const zlib = require("zlib"), fs = require("fs"), path = require("path");
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
const HERE = __dirname;
const js = fs.readFileSync(path.join(HERE, "app.html"), "utf8").split("<script>")[1].split("</script>")[0]
  .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");', "const inflate=async u8=>global.__inflate(u8);")
  .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");', "const deflate=async u8=>global.__deflate(u8);");
const cut = js.indexOf("/* ══════════════════════════ ממשק ══════════════════════════ */");
const a = js.indexOf("function pseudoRX(p){"), b = js.indexOf("function livePairs(){");
fs.writeFileSync(path.join(HERE, "poolwords-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) + "\nmodule.exports={redactDocx,restoreNames};\n");
const E = require("./poolwords-core.js");
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, doc, base } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const WORDS = ["יהודית", "מיכל", "ממן", "חנה", "מזרחי", "איתי", "פרץ", "דנה", "מרים", "ליאת", "מלמד", "מירב", "עמי", "רותי"];
const lists = ["WORDLIKE", "STOP", "COMMON", "VRB"].map((k) => C[k]).filter(Boolean);
const isWord = (p) => WORDS.includes(p) || lists.some((s) => s.has(p));

console.log("\n— what the pool hands out, for 4,000 invented people of each shape —");
{
  const picked = [], firsts = new Set(), surs = new Set();
  for (let i = 0; i < 4000; i++) {
    const g = i % 2 ? "f" : "m";
    const one = C.fakeName("אדם" + i.toString(36), g, new Set(), new Set(), null);
    const two = C.fakeName("שם" + i.toString(36) + " משפחה" + (i * 7).toString(36), g, new Set(), new Set(), null).split(" ");
    picked.push(one, ...two); firsts.add(two[0]); surs.add(two[two.length - 1]);
  }
  const words = picked.filter((p) => isWord(p) || (/-/.test(p) && p.split("-").some(isWord)));
  ok(words.length === 0, "no invented name, and no part of a double surname, is an everyday word: " + [...new Set(words)].slice(0, 12).join(" "));
  // 61 first names and 55 surnames before the filter, 52 and 46 after; adding names instead would change every
  // person's invented name (the pick is indexed by the pool's length), filtering moves only those whose pick was a word
  ok(firsts.size >= 45 && surs.size >= 40, `and the pool still varies: ${firsts.size} first names, ${surs.size} surnames`);
}

(async () => {
  console.log("\n— the restore of an answer that uses the word in its everyday sense —");
  // a child known by her first name only, approved as a name: her invented name is one word
  const subs = [{ value: "בארי", kind: "NAME", replacement: "" }];
  const body = ["החלטה", "הקטינה בארי תשהה אצל אביה בחגים.", "בארי תחזור לבית אמה בסיום החג."].map((l) => P(R(l))).join("");
  const res = await E.redactDocx(mkzip([...base, { name: "word/document.xml", body: doc(body) }]), subs, [], { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" });
  const pseudo = (res.applied.find((r) => (r.base || r.value) === "בארי") || {}).rep || "";
  ok(pseudo && !isWord(pseudo), "her invented name is not a word: «" + pseudo + "»");
  for (const [answer, want] of [
    [`השופטת דנה בבקשה ודחתה אותה. ${pseudo} תשהה אצל אביה בחגים.`, "השופטת דנה בבקשה ודחתה אותה. בארי תשהה אצל אביה בחגים."],
    [`הממצא מלמד על קשר טוב. ${pseudo} תחזור לבית אמה.`, "הממצא מלמד על קשר טוב. בארי תחזור לבית אמה."],
    [`באותו ערב פרץ ויכוח, ו${pseudo} נשארה בחדרה.`, "באותו ערב פרץ ויכוח, ובארי נשארה בחדרה."],
    [`${pseudo} ישנה אצל בן דוד של האם, והם עשו את מירב המאמצים.`, "בארי ישנה אצל בן דוד של האם, והם עשו את מירב המאמצים."],
    [`בדיון במליאת הכנסת הוזכרו שרותי הרווחה. ${pseudo} לא הוזכרה.`, "בדיון במליאת הכנסת הוזכרו שרותי הרווחה. בארי לא הוזכרה."],
  ]) {
    const r = E.restoreNames(answer, [["בארי", pseudo]]);
    ok(r.text === want, `«${answer.slice(0, 34)}…» → «${r.text}»`);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });

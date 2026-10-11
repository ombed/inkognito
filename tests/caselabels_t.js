/* A label that belongs to someone in the case is given to no one else (the hunt of 11.10).

   In «פלוני א׳» mode the labels were counted per document from א׳, without looking at the labels the case's
   rules already hold: in a case's second document a new person got the label of the first one, «פלוני א׳
   הגיש תגובה לבקשה של פלוני א׳», and two ID numbers both became «[ת"ז א׳]». The AI read two people as one,
   and the restore gave up on both. The count now skips every label a rule holds. Invented names and numbers. */
const fs = require("fs");
const path = require("path");
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const OPT = (mode, styles) => ({ on: ON, flag: new Set(), mode, near: false, body: false, prefixes: "normal", styles: styles || {} });
const ids = []; for (let n = 100000000; ids.length < 3 && n < 100002000; n++) { const s = String(n); if (C.validID(s)) ids.push(s); }
const run = (text, rules, mode, styles) => {
  const eng = new C.Engine(rules, [], OPT(mode, styles), text), out = {};
  // a prefix letter («ונועה») stays with the label («ופלוני ב׳»); the label itself is what is compared
  for (const h of eng.detect(text)) if (h.apply) out[h.base || h.text] = eng.repFor(h).replace(/^[ובלהמכש](?=פלוני)/, "");
  return out;
};
const R = (value, replacement, kind) => ({ value, kind: kind || "NAME", replacement: replacement || "", auto: true });

console.log("\n— people in «פלוני א׳» mode —");
{
  const got = run("עמית רז הגיש תגובה לבקשה של דורית אלמוג.", [R("דורית אלמוג", "פלוני א׳"), R("עמית רז")], "label");
  ok(got["דורית אלמוג"] === "פלוני א׳" && got["עמית רז"] === "פלוני ב׳", "the case's person keeps «פלוני א׳», the new one gets «פלוני ב׳»: " + JSON.stringify(got));
}
{
  const got = run("עמית רז ונועה שגיא השיבו לבקשה של דורית אלמוג ושל יוסי כרמל.", [R("דורית אלמוג", "פלוני א׳"), R("יוסי כרמל", "פלוני ג׳"), R("עמית רז"), R("נועה שגיא")], "label");
  const fresh = [got["עמית רז"], got["נועה שגיא"]].sort();
  ok(JSON.stringify(fresh) === JSON.stringify(["פלוני ב׳", "פלוני ד׳"]), "with א׳ and ג׳ taken, the new two get ב׳ and ד׳: " + JSON.stringify(got));
}
{
  // a person of the case who is not in this document still holds the label
  const got = run("עמית רז הגיש תגובה.", [R("דורית אלמוג", "פלוני א׳"), R("עמית רז")], "label");
  ok(got["עמית רז"] === "פלוני ב׳", "a label of the case is held even when its person is not in this document: " + JSON.stringify(got));
}

console.log("\n— numbers set to «תווית» —");
{
  const got = run(`מספר הזהות של המשיב ${ids[1]}, ושל המבקשת ${ids[0]}.`, [R(ids[0], "[ת\"ז א׳]", "ID")], "real", { "*": "label" });
  ok(got[ids[0]] === "[ת\"ז א׳]" && got[ids[1]] === "[ת\"ז ב׳]", "an ID of the case keeps «[ת\"ז א׳]», a new one gets «[ת\"ז ב׳]»: " + JSON.stringify(got));
}
{
  const got = run("הטלפון של המשיב 054-7712093, ושל המבקשת 052-3345678.", [R("052-3345678", "[טלפון א׳]", "PHONE")], "real", { "*": "label" });
  ok(got["052-3345678"] === "[טלפון א׳]" && got["054-7712093"] === "[טלפון ב׳]", "and the same for a phone: " + JSON.stringify(got));
}

console.log("\n— counterexamples: nothing changes where nothing is taken —");
{
  const got = run("עמית רז, נועה שגיא ודורית אלמוג נכחו.", [R("עמית רז"), R("נועה שגיא"), R("דורית אלמוג")], "label");
  ok(JSON.stringify(Object.values(got).sort()) === JSON.stringify(["פלוני א׳", "פלוני ב׳", "פלוני ג׳"]), "three new people in one document: א׳, ב׳, ג׳: " + JSON.stringify(got));
  const ids2 = run(`מספרי הזהות ${ids[0]} ו-${ids[1]}.`, [], "real", { "*": "label" });
  ok(JSON.stringify(Object.values(ids2).sort()) === JSON.stringify(["[ת\"ז א׳]", "[ת\"ז ב׳]"]), "two new IDs: א׳ and ב׳: " + JSON.stringify(ids2));
  // an invented name that has nothing to do with labels takes none
  const real = run("עמית רז הגיש תגובה.", [R("דורית אלמוג", "מרים הרשקוביץ"), R("עמית רז")], "label");
  ok(real["עמית רז"] === "פלוני א׳", "an invented name held by the case does not move the labels: " + JSON.stringify(real));
}

console.log("\n— the whole path: a case used, its people list, the engine —");
(async () => {
  // the page's own Component class (applyProfile, rulesFromPeo, opts), with a stub DCLogic, as the reproduction ran it
  const xd = require("@xmldom/xmldom");
  global.DOMParser = xd.DOMParser; global.XMLSerializer = xd.XMLSerializer;
  { const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
    for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
      if (!("children" in proto)) Object.defineProperty(proto, "children", { get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
      if (!proto.querySelector) proto.querySelector = function (t) { const l = this.getElementsByTagName(t); return l && l.length ? l[0] : null; };
    } }
  const { mkzip } = require("./mkzip.js");
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const at = src.indexOf("class Component extends DCLogic"), end = src.indexOf("</script>", at);
  global.window = global; global.document = { getElementById: () => null, querySelector: () => null };
  const store = new Map();
  global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (n) => [...store.keys()][n], get length() { return store.size; } };
  class DCLogic { setState(p, cb) { this.state = { ...this.state, ...(typeof p === "function" ? p(this.state) : p) }; if (cb) cb(); } }
  const Component = new Function("DCLogic", "return (" + src.slice(at, end) + ")")(DCLogic);
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const mk = (paras) => mkzip([
    { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
    { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
    { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      `<w:document ${W}><w:body>` + paras.map((t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`).join("") + "</w:body></w:document>" }]);
  const fresh = () => { const p = new Component(); p.state = { ...p.state, E: C, mode: "label", o: { ...p.state.o, numStyle: "blank", dateStyle: "name" }, screen: "entry", res: null, rules: [], allow: [], removed: [], sent: {}, profile: null }; return p; };
  try {
    const p1 = fresh(), doc1 = mk(["הבקשה הוגשה על ידי דורית אלמוג."]);
    p1.setState({ buf: doc1, rules: [p1.mkRule({ value: "דורית אלמוג", auto: true })] });
    p1.state.res = await C.redactDocx(doc1.slice(0), p1.state.rules, [], p1.opts());
    p1.setState({ caseName: "אלמוג נ׳ רז" });
    const saved = p1.profileObj();
    const p2 = fresh();
    p2.applyProfile(saved);
    const rules2 = p2.rulesFromPeo([{ value: "דורית אלמוג", kind: "NAME", auto: true }, { value: "עמית רז", kind: "NAME", auto: true }]);
    const res2 = await C.redactDocx(mk(["עמית רז הגיש תגובה לבקשה של דורית אלמוג."]), rules2, [], p2.opts());
    const text = res2.preview.map((b) => b.text).join(" ");
    ok(/פלוני ב׳ הגיש תגובה לבקשה של פלוני א׳/.test(text), "the case's second document: «" + text + "»");
  } catch (e) { ok(false, "the whole path ran: " + e.message); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();

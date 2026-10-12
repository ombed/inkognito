/* Family members keep a shared surname (the owner's decision of 12.10, «A»; the engineering audit). Until then each
   person's invented name was picked on its own, so «רונית לוי» and «דוד לוי» became two strangers and the AI lost the
   family. Now the same real surname gets the same invented surname in the document and in its case; first names stay
   each person's own, so the full names stay apart, and a lone surname restores one to one. The accepted cost: two
   unrelated people with one common surname share the invented one too. Invented names only. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
const R = (value, replacement) => ({ value, kind: "NAME", replacement: replacement || "", auto: true });
const run = (text, rules) => {
  const e = new C.Engine(rules, [], OPT, text), out = {};
  for (const h of e.detect(text)) if (h.apply) out[h.base || h.text] = e.repFor({ ...h, pre: "" });
  return out;
};
const sur = (n) => String(n || "").trim().split(/\s+/).slice(-1)[0];
const first = (n) => String(n || "").trim().split(/\s+/)[0];

console.log("\n— one family, one invented surname —");
{
  const o = run("רונית לוי הגישה תביעה. דוד לוי השיב. שרה כהן העידה.", [R("רונית לוי"), R("דוד לוי"), R("שרה כהן")]);
  ok(sur(o["רונית לוי"]) === sur(o["דוד לוי"]), `«רונית לוי» and «דוד לוי» share an invented surname: ${o["רונית לוי"]}, ${o["דוד לוי"]}`);
  ok(first(o["רונית לוי"]) !== first(o["דוד לוי"]), "each keeps an invented first name of their own, so the names stay apart");
  ok(sur(o["שרה כהן"]) !== sur(o["רונית לוי"]), "another real surname gets another invented one: " + o["שרה כהן"]);
  const p = run("אלעד בן דוד הגיש. שרה בן דוד השיבה. רחל דוד העידה.", [R("אלעד בן דוד"), R("שרה בן דוד"), R("רחל דוד")]);
  ok(sur(p["אלעד בן דוד"]) === sur(p["שרה בן דוד"]) && p["אלעד בן דוד"].split(" ")[1] === "בן", `a surname with «בן» is shared with its particle: ${p["אלעד בן דוד"]}, ${p["שרה בן דוד"]}`);
  ok(sur(p["רחל דוד"]) !== sur(p["אלעד בן דוד"]), "and «דוד» alone is another surname than «בן דוד»: " + p["רחל דוד"]);
}

console.log("\n— in the case: the next document's family member —");
{
  const o = run("דוד לוי השיב לבקשה.", [R("רונית לוי", "מיכל אוחיון"), R("דוד לוי")]);
  ok(sur(o["דוד לוי"]) === "אוחיון" && first(o["דוד לוי"]) !== "מיכל", "the case gave the family «אוחיון»; the new member gets it too: " + o["דוד לוי"]);
  const f = run("דוד לוי השיב לבקשה, וגם אוחיון העיד.", [R("רונית לוי", "מיכל אוחיון"), R("דוד לוי")]);
  ok(sur(f["דוד לוי"]) !== "אוחיון", "unless that surname is a word of this document (a real «אוחיון» here): " + f["דוד לוי"]);
}

console.log("\n— a person known by the surname alone joins the family —");
{
  const o = run("רונית פרידמן הגישה. פרידמן השיב.", [R("רונית פרידמן"), R("פרידמן")]);
  ok(o["פרידמן"] && sur(o["רונית פרידמן"]) === o["פרידמן"], `«פרידמן» alone gets the family's invented surname: ${o["פרידמן"]} / ${o["רונית פרידמן"]}`);
}

console.log("\n— the restore: a lone surname of the family comes back —");
{
  const pairs = [["רונית לוי", "סבטלנה הרשקוביץ"], ["דוד לוי", "דניאל הרשקוביץ"]];
  const r = C.restoreNames("גב' הרשקוביץ ומר הרשקוביץ הגיעו. משפחת הרשקוביץ ביקשה דחייה, וסבטלנה הרשקוביץ חתמה.", pairs);
  ok(r.text === "גב' לוי ומר לוי הגיעו. משפחת לוי ביקשה דחייה, ורונית לוי חתמה.", "«גב'», «מר» and «משפחת» with the shared surname: " + r.text);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

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
/* The family's invented first names start with different letters (the hunt of 1.11). «י. אלמקייס» and «מ. אלמקייס»
   share the invented surname, and their invented first names could share an initial: the AI wrote «א. אלבז» for both,
   and the paste-back could not tell which. A family whose real initials are the same is left as it is. Invented names
   only. */
console.log("\n— the family's invented first names start with different letters —");
{
  const crypto = require("crypto");
  const fams = [["י. אלמקייס", "מ. אלמקייס", "ד. אלמקייס"], ["רונית לוי", "דוד לוי", "מיכל לוי", "יוסי לוי"], ["אורי זכאי", "נעמה זכאי"]];
  const text = fams.flat().join(" ו") + " חתמו.";
  let bad = 0, shared = 0; const ex = [];
  for (let i = 0; i < 50; i++) {
    const e = new C.Engine(fams.flat().map((v) => R(v)), [], { ...OPT, aliasKey: crypto.createHash("sha256").update("fam-key-" + i).digest("hex") }, text);
    const o = {};
    for (const h of e.detect(text)) if (h.apply) o[h.base || h.text] = e.repFor({ ...h, pre: "" });
    for (const f of fams) {
      const reps = f.map((v) => o[v]);
      if (reps.some((r) => !r)) { bad++; ex.push("missing " + JSON.stringify(o)); continue; }
      if (new Set(reps.map(sur)).size !== 1) shared++;
      const ini = reps.map((r) => first(r)[0]);
      if (new Set(ini).size !== ini.length) { bad++; ex.push(reps.join(", ")); }
    }
  }
  ok(shared === 0, "each family still shares one invented surname: " + shared);
  ok(bad === 0, "150 families over 50 keys, every family's invented first names start with different letters: " + bad + " " + ex.slice(0, 3).join(" | "));
}
/* A surname the AI writes alone comes back (the review of 2.11). A fake of three letters («כהן», «לוי», «חדד») comes back
   alone only after a title, by design, so «25.2 מיליון ללוי» stayed marked; and «לכהן» is also a verb, so it stayed
   unmarked and fake. Over 12 keys of an invented agreement, 2 of the demo summaries hit it. The fake picker now
   prefers names of four letters or more. Every example is invented. */
console.log("\n— a fake surname written alone, with a prefix letter, comes back —");
{
  const crypto = require("crypto");
  const people = ["יונתן גרוסמן", "אורנה אוחיון", "אריאל טלמון", "דנה פלדמן", "נתנאל פרלמן"];
  const text = people.join(", ") + " חתמו על ההסכם.";
  const bad = [];
  for (let i = 0; i < 60; i++) {
    const key = crypto.createHash("sha256").update("lone-sur-" + i).digest("hex");
    const eng = new C.Engine(people.map((v) => ({ value: v, kind: "NAME", replacement: "" })), [], { ...OPT, aliasKey: key }, text);
    const map = {}; for (const h of eng.detect(text)) if (h.apply) map[h.base || h.text] = String(eng.repFor({ ...h, pre: "" }));
    const pairs = Object.entries(C.restorePairs({}, map));
    for (const [real, fake] of Object.entries(map)) {
      const s = fake.split(" ").pop(), rs = real.split(" ").pop();
      for (const sent of ["התשלום ל" + s + " יבוצע במועד.", s + " מחזיק במניות.", "הסכום שישולם ל" + s + " ול" + s + " בלבד."]) {
        const r = C.restoreNames(sent, pairs, [], {});
        if (!r.text.includes(rs) || r.left.length) bad.push(fake + ": «" + sent + "» → «" + r.text + "»");
      }
    }
  }
  C.setAliasKey(null);
  ok(bad.length === 0, "60 keys × 5 people: a lone fake surname, with or without ל, comes back: " + bad.length + " " + bad.slice(0, 3).join(" | "));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

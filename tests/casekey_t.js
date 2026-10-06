/* Saved cases belong to an account (the move to inkognito.co.il, 6.10.2026). The hosted service runs
   index.html for every account, and several accounts can share one computer: a read or write of a
   case key that skips caseKey() would show one account's clients to another, or write into the wrong
   account. So the two case keys appear in index.html only as the argument of caseKey(), or in
   CASE_KEYS, the one list "clear this computer" removes for every account (the keys themselves and
   every key that is one of them followed by ":"). The display keys stay shared: they are never passed
   through caseKey(). e2e/case-store.spec.js checks the behaviour in a browser. */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
// comments may name the keys; only code counts
const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

console.log("\n— every use of a case key goes through caseKey() —");
const def = code.match(/\bcaseKey\(k\)\{[^}]*\}/);
ok(!!def, "index.html defines caseKey(k)");
ok(!!def && /window\.__inkStoreSuffix/.test(def[0]) && /k\+":"\+s/.test(def[0]), "caseKey reads window.__inkStoreSuffix and joins it with a colon: " + (def ? def[0] : "none"));
const list = code.match(/static CASE_KEYS=\[[^\]]*\]/);
const inList = (i) => !!list && i > list.index && i < list.index + list[0].length;
const uses = [...code.matchAll(/"redact-(?:cases|profile-last)"/g)];
ok(uses.length >= 10, "the case keys are found in the code: " + uses.length);
const bare = uses.filter((m) => !/caseKey\($/.test(code.slice(Math.max(0, m.index - 13), m.index)) && !inList(m.index))
  .map((m) => code.slice(Math.max(0, m.index - 50), m.index + 25).replace(/\s+/g, " "));
ok(bare.length === 0, "no case key is used without caseKey(): " + bare.join(" · "));

console.log("\n— clearing the tool from the computer removes the cases of every account —");
ok(!!list && list[0] === 'static CASE_KEYS=["redact-cases","redact-profile-last"]', "CASE_KEYS lists the two case keys: " + (list ? list[0] : "none"));
const forget = code.match(/\bforgetCases\(\)\{[\s\S]*?\n {2}\}/);
ok(!!forget && /K\.some\(c=>k===c\|\|k\.startsWith\(c\+":"\)\)/.test(forget[0]), "forgetCases removes each case key and every key that is it followed by a colon");
const mf = code.match(/modelForget = async \(\) => \{[\s\S]*?\n {2}\};/);
ok(!!mf && mf[0].includes("this.forgetCases();"), "modelForget («מחיקת המודל והקבצים השמורים מהמחשב») calls forgetCases");

console.log("\n— the display keys stay shared —");
for (const k of ["redact-theme", "redact-intro-seen", "redact-tour-seen"]) {
  ok(code.includes('"' + k + '"'), k + " is still used");
  ok(!code.includes('caseKey("' + k + '")'), k + " is not passed through caseKey()");
  ok(!!list && !list[0].includes('"' + k + '"'), k + " is not removed with the cases");
}

console.log("\n— the check itself bites —");
const probe = (s) => [...s.matchAll(/"redact-(?:cases|profile-last)"/g)].some((m) => !/caseKey\($/.test(s.slice(Math.max(0, m.index - 13), m.index)));
ok(probe('localStorage.getItem("redact-cases")') && probe('if(e.key!=="redact-profile-last") return;'), "a direct read and a direct key test are caught");
ok(!probe('localStorage.getItem(this.caseKey("redact-cases"))'), "a read through caseKey passes");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

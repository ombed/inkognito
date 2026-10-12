/* A case file with a password (the owner's decision of 12.10, «A»). page-logic.js locks the exported case with AES-GCM
   under a PBKDF2 key of the password; this checks it as the browser would run it (Node's WebCrypto is the same API):
   the file holds no name, the right password opens it, a wrong one and a changed file do not, and a file built to
   take forever is refused. The import screens are in e2e/lockfile.spec.js. Invented names only. */
const PL = require("../page-logic.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const CASE = { v: 1, name: "לוי נ׳ לוי", rules: [{ value: "שרה לוי", kind: "NAME", replacement: "דנה רום" }], map: { "שרה לוי": "דנה רום" }, allow: [], removed: [], sent: {} };

(async () => {
  console.log("\n— the file holds no name, and opens with its password —");
  const locked = await PL.lockJSON(CASE, "a long password 7");
  const text = JSON.stringify(locked);
  ok(PL.isLocked(locked) && locked.inkognito === "locked" && locked.iter === 600000, "a locked file, PBKDF2 with 600,000 rounds");
  ok(!/לוי|רום|שרה|דנה/.test(text), "no name in it, real or invented");
  ok(JSON.stringify(await PL.unlockJSON(locked, "a long password 7")) === JSON.stringify(CASE), "the right password gives the case back as it was");
  const again = await PL.lockJSON(CASE, "a long password 7");
  ok(again.salt !== locked.salt && again.iv !== locked.iv && again.data !== locked.data, "the same case locked twice is two different files (salt and nonce are new each time)");

  console.log("\n— what does not open —");
  let e1 = null; try { await PL.unlockJSON(locked, "a long password 8"); } catch (e) { e1 = e; }
  ok(!!e1, "a wrong password");
  const bad = { ...locked, data: locked.data.slice(0, -4) + (locked.data.slice(-4) === "AAAA" ? "BBBB" : "AAAA") };
  let e2 = null; try { await PL.unlockJSON(bad, "a long password 7"); } catch (e) { e2 = e; }
  ok(!!e2, "a file changed after it was locked");
  let e3 = null; try { await PL.unlockJSON({ ...locked, iter: 900000000 }, "a long password 7"); } catch (e) { e3 = e; }
  ok(!!e3 && /bounds/.test(e3.message), "a file that asks for 900 million rounds is refused before it starts");
  ok(!PL.isLocked(CASE) && !PL.isLocked({ inkognito: "cases", cases: {} }), "a plain case and a plain cases file are not locked files: they import as before");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });

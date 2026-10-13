/* index.html is linted (outside review, M5). The review injected an undefined name into
   selfCheck and eslint, and every suite, stayed green. selfCheck is in page-component.js since
   13.10.2026, with the rest of the component's logic, and is linted there with the page's globals. */
const fs = require("fs");
const path = require("path");
const { lintPage, blocks } = require("../scripts/lint-page.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "page-component.js"), "utf8");

(async () => {
  const b = blocks(html);
  ok(b.some((x) => x.app) && b.length >= 2, "the app block and the inline scripts are found: " + b.length);
  const clean = (await lintPage(html, comp)).filter((p) => p.severity === 2);
  ok(clean.length === 0, "the page and its logic as they are lint clean: " + JSON.stringify(clean.slice(0, 3)));

  const a = "  selfCheck(verbose){";
  ok(comp.split(a).length === 2, "selfCheck is where the review injected");
  const bad = comp.replace(a, a + "\n    if(false) thisNameDoesNotExistAnywhere();");
  const line = bad.split("\n").findIndex((l) => l.includes("thisNameDoesNotExistAnywhere")) + 1;
  const found = (await lintPage(html, bad)).filter((p) => p.severity === 2);
  ok(found.some((p) => p.rule === "no-undef" && p.file === "page-component.js" && p.line === line),
    `the injected undefined name is an error at page-component.js:${line}: ` + JSON.stringify(found.slice(0, 3)));

  // the head's first inline script, wherever comments above it put it (a fixed line 15 broke on 12.10)
  const inline = html.replace("<script>/*", "<script>undefinedInHead();/*");
  const headLine = html.slice(0, html.indexOf("<script>/*")).split("\n").length;
  ok((await lintPage(inline)).some((p) => p.rule === "no-undef" && p.line === headLine), `an inline head script is linted too (line ${headLine})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();

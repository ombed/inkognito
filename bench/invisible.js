/* A character nobody sees, inside every person of the synthetic corpus (outside review of 18.10, F1 and F4).

   Copied text carries zero-width spaces, BOMs and soft hyphens inside words (WhatsApp exports, apps, Word). For every
   person the tool must replace, the character goes inside the longest word of the name, in every mention of it, so no
   clean mention is left to rescue it; the whole chain runs as in the benchmark (bench/lib.js runDoc: rules, the model
   when it loads, two rounds of redaction). A person counts as leaked when a word of the name is left in the output as a
   person reads it, and was not left in the document as written; and as leaked under a green bar when, on top of that,
   the final check passed and the second scan raised nothing. tests/readers_t.js checks the same property on invented
   text, with every character of the class, on every run of the suite.

   node bench/invisible.js [--no-model] [--json out.json] [--list] */
const fs = require("fs"), os = require("os"), path = require("path");
const E = require("./engine.js");
const { makeBench, loadModel, KEY } = require("./lib.js");

const CHARS = { "zero-width space": "\u200b", "BOM": "\ufeff", "soft hyphen": "\u00ad" };
const args = process.argv.slice(2), arg = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const read = (s) => String(s).replace(/\u0000/g, "");   // the benchmark's output is normalized: hidden characters are \u0000

(async () => {
  const pipe = args.includes("--no-model") ? null : await loadModel();
  const B = makeBench(E);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "invisible-"));
  const run = async (doc, buf) => {
    const f = path.join(tmp, doc.id + ".docx"); fs.writeFileSync(f, Buffer.from(buf));
    const log = console.log; console.log = () => {};
    try { return await B.runDoc(pipe, { ...doc, file: f }); } finally { console.log = log; }
  };
  const leftOf = (res, ent) => ent.canonical.split(/\s+/).filter((w) => w.length >= 3 && B.wordIn(read(res.out), B.norm(w)));
  const tally = {};
  for (const name of Object.keys(CHARS)) tally[name] = { people: 0, leaked: 0, green: 0 };
  for (const doc of KEY.docs) {
    const raw = fs.readFileSync(path.join(__dirname, doc.file));
    const files = await E.unzip(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    const clean = await run(doc, raw);
    for (const ent of doc.entities.filter((x) => x.kind === "NAME" && x.must)) {
      const w = ent.canonical.split(/\s+/).sort((x, y) => y.length - x.length)[0];
      if (w.length < 4) continue;
      const before = new Set(leftOf(clean, ent));
      for (const [name, ch] of Object.entries(CHARS)) {
        const cutAt = w.length >> 1, hidden = w.slice(0, cutAt) + ch + w.slice(cutAt);
        let n = 0;
        const parts = files.map((f) => {
          if (!/\.xml$/.test(f.name)) return f;
          const x = E.TXT.decode(f.data), y = x.split(w).join(hidden);
          if (y === x) return f;
          n += x.split(w).length - 1;
          return { name: f.name, data: new TextEncoder().encode(y) };
        });
        if (!n) continue;   // the name is split across runs of Word in this document: not one string to put it in
        const z = await E.zip(parts), buf = z instanceof Uint8Array ? z : new Uint8Array(await z.arrayBuffer());
        const res = await run(doc, buf), left = leftOf(res, ent).filter((x) => !before.has(x));
        const t = tally[name]; t.people++;
        if (left.length) {
          t.leaked++; if (res.passed && !(res.second || []).length) t.green++;
          if (args.includes("--list")) console.log(`  ${doc.id} ${name}: ${left.join(" ")} (${ent.cat})`);
        }
      }
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`a character nobody sees inside every mention of a person (model ${pipe ? "on" : "off"}; ${KEY.docs.length} documents)`);
  for (const [name, t] of Object.entries(tally)) console.log(`  ${name}: ${t.leaked} of ${t.people} people leaked, ${t.green} of them under a green bar`);
  const out = arg("--json"); if (out) fs.writeFileSync(out, JSON.stringify({ model: !!pipe, tally }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });

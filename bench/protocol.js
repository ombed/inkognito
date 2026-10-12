/* The public Knesset protocol (tests/protocol.txt), keyed blind in two passes (bench/model-eval/gold/protocol.json),
   through the whole chain as the bench runs it: every suggestion accepted, never a merge. The figures the README and
   the home page quote come from here (12.10.2026), so anyone can rerun them:

     npm run bench:protocol              # with the model
     npm run bench:protocol -- --no-model

   People are counted mention by mention: the output is aligned with the original word by word (longest common
   subsequence), and a mention is left if a word of it came through unchanged. A surname particle («בן», «בר»…) that
   an invented name shares is not a word of the person. Places and private bodies are counted by occurrences of their
   forms; public bodies, which must stay, by how many of their forms changed. */
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
const E = require("./engine.js");
const { makeBench, loadModel } = require("./lib.js");
const { mkzip } = require(path.join(ROOT, "tests", "mkzip.js"));
const { NS, P, R, base } = require(path.join(ROOT, "tests", "structure-lib.js"));
const G = require("./model-eval/gold/protocol.json").docs[0];

const PARTICLES = new Set(["בן", "בת", "בר", "אבו", "אל", "דה", "ואן", "לה"]);
const toks = (t) => { const out = []; const re = /\S+/g; let m; while ((m = re.exec(t))) out.push({ w: m[0], s: m.index, e: m.index + m[0].length }); return out; };
function kept(a, b) {
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i].w === b[j].w ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const keep = new Set(); let i = 0, j = 0;
  while (i < n && j < m) { if (a[i].w === b[j].w) { keep.add(i); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  return keep;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const count = (t, s) => (t.match(new RegExp("(?<![\\u05d0-\\u05ea])[ובהלמכש]?" + esc(s) + "(?![\\u05d0-\\u05ea])", "g")) || []).length;

(async () => {
  const text = fs.readFileSync(path.join(ROOT, "tests", "protocol.txt"), "utf8").replace(/\r/g, "");
  if (text !== G.text) throw new Error("tests/protocol.txt is not the text the key was made on");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${NS}><w:body>${text.split("\n").map((l) => P(R(l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")))).join("")}</w:body></w:document>`;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "protocol-")), "protocol.docx");
  fs.writeFileSync(file, Buffer.from(mkzip([...base, { name: "word/document.xml", body: xml }])));
  const noModel = process.argv.includes("--no-model");
  const B = makeBench(E), pipe = noModel ? null : await loadModel();
  const r = await B.runDoc(pipe, { id: "protocol", genre: "protocol", file, entities: [] }, null);
  const out = typeof r.out === "string" ? r.out : (r.out && r.out.text) || "";
  fs.rmSync(path.dirname(file), { recursive: true, force: true });

  const A = toks(G.text), keep = kept(A, toks(out));
  let whole = 0, part = 0; const left = [];
  const people = G.mentions.filter((m) => m.type === "PER");
  for (const m of people) {
    const idx = A.map((t, i) => i).filter((i) => A[i].s < m.e && A[i].e > m.s && !PARTICLES.has(A[i].w));
    const k = idx.filter((i) => keep.has(i)).length;
    if (idx.length && k === idx.length) { whole++; left.push(G.text.slice(m.s, m.e)); } else if (k) { part++; left.push(G.text.slice(m.s, m.e) + " (in part)"); }
  }
  const forms = (type, pub) => [...new Set(G.mentions.filter((m) => m.type === type && (pub === undefined || !!m.public === pub)).map((m) => G.text.slice(m.s, m.e)))];
  const occ = (list, t) => list.reduce((n, s) => n + count(t, s), 0);
  const places = forms("PLACE"), privateBodies = forms("ORG", false), publicBodies = forms("ORG", true);
  console.log(`protocol, ${noModel ? "no model" : "model on"}, every suggestion accepted:`);
  console.log(`  people:          ${whole + part} of ${people.length} mentions left (${whole} whole, ${part} in part)` + (left.length ? ": " + left.join(" · ") : ""));
  console.log(`  places:          ${occ(places, out)} of ${occ(places, G.text)} occurrences left`);
  console.log(`  private bodies:  ${occ(privateBodies, out)} of ${occ(privateBodies, G.text)} occurrences left`);
  console.log(`  public bodies:   ${publicBodies.filter((s) => count(out, s) < count(G.text, s)).length} of ${publicBodies.length} changed (they must stay)`);
})().catch((e) => { console.error(e); process.exit(1); });

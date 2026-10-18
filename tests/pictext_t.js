/* Text a machine reads inside a picture of a Word file (the outside review of 18.10, F3).

   An SVG picture is text: its title, its description and its labels («תרשים של …», «מאת …») went out in the file she
   downloads, byte for byte, and the final check passed. Word keeps every SVG next to a PNG copy and shows the SVG; the
   SVG now goes, with Word's reference to it, and Word shows the PNG, a picture like any other in the document. An SVG
   with no such copy stays, without its title, description, metadata and comments, and the listed names in its text
   are replaced. An EMF picture carries its text as text too: the listed names in it are replaced at the same length,
   so nothing in the file moves, and its description is cleared. GIF, WebP and TIFF pictures lose their comments,
   EXIF, XMP and text tags, as JPEG and PNG already did (tests/imgmeta_t.js). Every name here is invented. */
const zlib = require("zlib");
const L = require("./wordfile-lib.js");
const { docx, P, R, RT, outOf, problems } = L;
const E = L.core("pictext");
const { ok, done } = L.suite();
const enc = (s) => new TextEncoder().encode(s);
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const u16le = (s) => { const a = new Uint8Array(2 * s.length); for (let i = 0; i < s.length; i++) { a[2 * i] = s.charCodeAt(i) & 255; a[2 * i + 1] = s.charCodeAt(i) >> 8; } return a; };
const le32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24], le16 = (v) => [v & 255, v >> 8];
const has = (u, bytes) => Buffer.from(u).includes(Buffer.from(bytes));
const NAME = "שרגא בירנבאום", OTHER = "יחזקאל מנדלבאום";
const SUBS = [{ value: NAME, kind: "NAME", replacement: "דוד לוי" }, { value: OTHER, kind: "NAME", replacement: "משה פרץ" }];

// a 1×1 PNG, valid to its CRCs
function png() {
  const chunk = (type, data) => { const t = enc(type), c = zlib.crc32(Buffer.from(cat(t, data))); return cat(new Uint8Array([...le32(data.length)].reverse()), t, data, new Uint8Array([c >>> 24, (c >> 16) & 255, (c >> 8) & 255, c & 255])); };
  return cat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])),
    chunk("IDAT", new Uint8Array(zlib.deflateSync(Buffer.from([0, 255, 0, 0])))), chunk("IEND", new Uint8Array(0)));
}
const SVG = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><title>תרשים של ${NAME}</title>` +
  `<desc>מאת ${OTHER}</desc><metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>${OTHER}</rdf:Description></rdf:RDF></metadata>` +
  `<!-- נערך בידי ${NAME} --><rect width="200" height="60" fill="#eee"/><text x="10" y="35" aria-label="${NAME}">${OTHER}</text></svg>`;
const BLIP = (embed, ext) => `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="1905000" cy="571500"/><wp:docPr id="1" name="תמונה 1"/>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
  `<pic:nvPicPr><pic:cNvPr id="1" name="תמונה 1"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${embed}" xmlns:r="${RT}">${ext || ""}</a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
  `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="571500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const SVG_EXT = (embed) => `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${embed}"/></a:ext></a:extLst>`;
const imgRel = (id, target) => `<Relationship Id="${id}" Type="${RT}/image" Target="${target}"/>`;
const allBytes = (o) => o.files.map((f) => f.data);
const nowhere = (o, s) => !allBytes(o).some((u) => has(u, enc(s)) || has(u, u16le(s)));

(async () => {
  console.log("\n— an SVG with Word's PNG copy: the SVG goes, the copy stays —");
  {
    const buf = docx({ body: P(R("מצורף תרשים.")) + P(BLIP("rId201", SVG_EXT("rId202"))), rels: [imgRel("rId201", "media/image1.png"), imgRel("rId202", "media/image2.svg")],
      files: [{ name: "word/media/image1.png", body: png() }, { name: "word/media/image2.svg", body: SVG }] });
    const res = await E.redactDocx(buf, SUBS, [], L.optsOf(E)), o = await outOf(E, res);
    ok(!o.names.includes("word/media/image2.svg"), "the SVG is not in the file: " + o.names.filter((n) => n.includes("media")).join(", "));
    ok(o.names.includes("word/media/image1.png") && /r:embed="rId201"/.test(o.text("word/document.xml")), "the PNG copy and its reference stay");
    ok(!/svgBlip|96DAC541/.test(o.text("word/document.xml")) && !/image2\.svg/.test(o.text("word/_rels/document.xml.rels")), "nothing points at the SVG");
    ok(!problems(o).length, "every part is well formed and every relationship has its part: " + problems(o).join("; "));
    ok(nowhere(o, "שרגא") && nowhere(o, "מנדלבאום"), "no name of the picture is anywhere in the file");
  }

  console.log("\n— an SVG without a copy: it stays, without its title, description, metadata and comments —");
  {
    const buf = docx({ body: P(R("מצורף תרשים.")) + P(BLIP("rId203")), rels: [imgRel("rId203", "media/image3.svg")], files: [{ name: "word/media/image3.svg", body: SVG }] });
    const res = await E.redactDocx(buf, SUBS, [], L.optsOf(E)), o = await outOf(E, res);
    const svg = o.files.find((f) => f.name === "word/media/image3.svg"), t = svg ? new TextDecoder().decode(svg.data) : "";
    ok(svg && /<svg\b[\s\S]*<rect\b[\s\S]*<text\b/.test(t), "the picture is still there: " + t.slice(0, 80));
    ok(!/<title|<desc|<metadata|<!--|aria-label/.test(t), "no title, description, metadata, comment or label attribute: " + t);
    ok(!t.includes(OTHER) && t.includes("משה פרץ"), "the listed name in its text is replaced: " + (t.match(/<text[^>]*>[^<]*/) || [""])[0]);
    ok(nowhere(o, "שרגא") && nowhere(o, "מנדלבאום"), "and no name of the picture is anywhere in the file");
    ok(!problems(o).length, "well formed: " + problems(o).join("; "));
  }

  console.log("\n— an EMF picture: listed names replaced at the same length, the description cleared —");
  {
    // EMR_HEADER (88 bytes) and a description; text records, one with the whole name and two with one word each; EMR_EOF
    const desc = u16le("Office\0" + NAME + "\0\0"), descPad = cat(desc, new Uint8Array((4 - desc.length % 4) % 4));
    const text = (s) => { const str = u16le(s), pad = new Uint8Array((4 - str.length % 4) % 4), size = 76 + str.length + pad.length;
      return cat(new Uint8Array([...le32(84), ...le32(size), ...new Array(16).fill(0), ...le32(1), ...new Array(8).fill(0), ...new Array(8).fill(0), ...le32(s.length), ...le32(76), ...le32(0), ...new Array(16).fill(0), ...le32(0)]), str, pad); };
    const recs = [text("הוגש בידי " + NAME), text("שרגא"), text("בירנבאום")], eof = new Uint8Array([...le32(14), ...le32(20), ...le32(0), ...le32(16), ...le32(20)]);
    const total = 88 + descPad.length + recs.reduce((n, r) => n + r.length, 0) + eof.length;
    const head = new Uint8Array([...le32(1), ...le32(88 + descPad.length), ...new Array(32).fill(0), 0x20, 0x45, 0x4D, 0x46, ...le32(0x10000), ...le32(total), ...le32(5), ...le16(1), ...le16(0),
      ...le32(desc.length / 2), ...le32(88), ...le32(0), ...le32(1024), ...le32(768), ...le32(320), ...le32(240)]);
    const emf = cat(head, descPad, ...recs, eof);
    const buf = docx({ body: P(R("מצורף תרשים.")) + P(BLIP("rId204")), rels: [imgRel("rId204", "media/image4.emf")], files: [{ name: "word/media/image4.emf", body: emf }] });
    const res = await E.redactDocx(buf, SUBS, [], L.optsOf(E)), o = await outOf(E, res);
    const out = (o.files.find((f) => f.name === "word/media/image4.emf") || {}).data || new Uint8Array(0);
    ok(out.length === emf.length && out.slice(0, 60).every((b, i) => b === emf[i]), "the same length, the header as it was");
    ok(!has(out, u16le("שרגא")) && !has(out, u16le("בירנבאום")), "the name is gone, whole and word by word");
    ok(has(out, u16le("דוד לוי")) && has(out, u16le("דוד")) && has(out, u16le("לוי")), "and the substitute is there, whole and word by word");
    ok(res.verification.passed, "the final check passes: nothing listed is left");
  }

  console.log("\n— GIF, WebP and TIFF lose their hidden text, the picture stays —");
  {
    const gct = [0, 0, 0, 255, 255, 255];
    const comment = cat(new Uint8Array([0x21, 0xFE, 11]), enc("Ronit Shani"), new Uint8Array([0]));
    const xmp = cat(new Uint8Array([0x21, 0xFF, 11]), enc("XMP DataXMP"), new Uint8Array([9]), enc("Avi Moshe"), new Uint8Array([0]));
    const loop = new Uint8Array([0x21, 0xFF, 11, ...enc("NETSCAPE2.0"), 3, 1, 0, 0, 0]);
    const image = new Uint8Array([0x2C, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0]);
    const gif = cat(enc("GIF89a"), new Uint8Array([1, 0, 1, 0, 0x80, 0, 0, ...gct]), comment, xmp, loop, image, new Uint8Array([0x3B]));
    const chunk = (id, data) => cat(enc(id), new Uint8Array(le32(data.length)), data, new Uint8Array(data.length & 1));
    const vp8x = chunk("VP8X", new Uint8Array([0x0C, 0, 0, 0, 0, 0, 0, 0, 0, 0])), body = chunk("VP8L", new Uint8Array([0x2F, 0, 0, 0, 0x10, 0x07, 0x10]));
    const webpBody = cat(enc("WEBP"), vp8x, body, chunk("EXIF", enc("Exif\0\0Ronit Shani")), chunk("XMP ", enc("<x>Avi Moshe</x>")));
    const webp = cat(enc("RIFF"), new Uint8Array(le32(webpBody.length)), webpBody);
    // IFD0: width, height, description, artist, an EXIF pointer; the EXIF IFD: a user comment
    const strD = enc("Ronit Shani at home\0"), strA = enc("Avi Moshe\0"), strC = enc("ASCII\0\0\0Avi Moshe phone"), ifd0 = 8, n0 = 5, exifIfd = ifd0 + 2 + 12 * n0 + 4;
    const dataAt = exifIfd + 2 + 12 + 4, offD = dataAt, offA = offD + strD.length, offC = offA + strA.length;
    const e = (tag, type, cnt, v) => [...le16(tag), ...le16(type), ...le32(cnt), ...le32(v)];
    const tiff = cat(new Uint8Array([0x49, 0x49, 42, 0, ...le32(ifd0), ...le16(n0), ...e(256, 3, 1, 1), ...e(257, 3, 1, 1), ...e(270, 2, strD.length, offD), ...e(315, 2, strA.length, offA),
      ...e(34665, 4, 1, exifIfd), ...le32(0), ...le16(1), ...e(37510, 7, strC.length, offC), ...le32(0)]), strD, strA, strC);
    const buf = docx({ body: P(R("תמונות.")), files: [{ name: "word/media/image5.gif", body: gif }, { name: "word/media/image6.webp", body: webp }, { name: "word/media/image7.tif", body: tiff }] });
    const res = await E.redactDocx(buf, [], [], L.optsOf(E)), o = await outOf(E, res);
    const get = (n) => (o.files.find((f) => f.name === n) || {}).data || new Uint8Array(0);
    const g = get("word/media/image5.gif"), w = get("word/media/image6.webp"), t = get("word/media/image7.tif");
    ok(!has(g, enc("Ronit")) && !has(g, enc("Avi")) && has(g, enc("NETSCAPE2.0")) && has(g, image) && g[g.length - 1] === 0x3B, "GIF: the comment and the XMP go, the loop and the image stay");
    ok(!has(w, enc("Ronit")) && !has(w, enc("Avi")) && has(w, body) && (w[12 + 8] & 0x0C) === 0 && w.length - 8 === (w[4] | (w[5] << 8) | (w[6] << 16) | (w[7] << 24)), "WebP: EXIF and XMP go, their flags with them, the size adds up");
    ok(!has(t, enc("Ronit")) && !has(t, enc("Avi")) && t.length === tiff.length && t.slice(0, ifd0 + 2 + 24).every((b, i) => b === tiff[i]), "TIFF: the text tags are blank in place, width and height as they were");
  }

  done();
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });

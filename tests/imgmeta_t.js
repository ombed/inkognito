/* Hidden details in the pictures of a Word file (the engineering audit of 12.10). A photo from a phone carries where it
   was taken (GPS), the camera, the date, sometimes a person's name and a second, smaller copy of itself; a screenshot
   saved as PNG can carry text chunks with an author. The tool does not read what a picture shows, but it now removes
   these details without touching the picture: tests that the picture's own data is byte for byte what it was, that
   the photo keeps its rotation, and that a file the cleaner cannot read to its end is left as it was.
   Invented names only. */
const zlib = require("zlib");
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
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { base, doc, P, R } = require("./structure-lib.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const enc = (s) => new TextEncoder().encode(s);
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const has = (u, s) => Buffer.from(u).includes(Buffer.from(typeof s === "string" ? enc(s) : s));
const seg = (marker, body) => cat(new Uint8Array([0xFF, marker, (body.length + 2) >> 8, (body.length + 2) & 255]), body);

// an EXIF block as a phone writes it: IFD0 with Make, Orientation, Artist and a GPS pointer, then the GPS IFD
function exif(orientation, le) {
  const w16 = (v) => le ? [v & 255, v >> 8] : [v >> 8, v & 255];
  const w32 = (v) => le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  const make = enc("PhoneCam\0"), artist = enc("Dana Cohen\0"), gpsTxt = enc("GPS 32.0853N 34.7818E\0");
  const n = 4, ifd0 = 8, after = ifd0 + 2 + 12 * n + 4;
  const offMake = after, offArtist = offMake + make.length, offGps = offArtist + artist.length, offGpsTxt = offGps + 2 + 12 + 4;
  const t = [...(le ? [0x49, 0x49] : [0x4D, 0x4D]), ...w16(42), ...w32(ifd0), ...w16(n),
    ...w16(0x010F), ...w16(2), ...w32(make.length), ...w32(offMake),
    ...w16(0x0112), ...w16(3), ...w32(1), ...w16(orientation), 0, 0,
    ...w16(0x013B), ...w16(2), ...w32(artist.length), ...w32(offArtist),
    ...w16(0x8825), ...w16(4), ...w32(1), ...w32(offGps),
    ...w32(0), ...make, ...artist,
    ...w16(1), ...w16(0x0002), ...w16(2), ...w32(gpsTxt.length), ...w32(offGpsTxt), ...w32(0), ...gpsTxt];
  return cat(enc("Exif\0\0"), new Uint8Array(t));
}
const JFIF = seg(0xE0, new Uint8Array([0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
const ICC = seg(0xE2, cat(enc("ICC_PROFILE\0"), new Uint8Array([1, 1, 9, 9, 9, 9])));
const MPF = seg(0xE2, cat(enc("MPF\0"), new Uint8Array([7, 7, 7, 7])));
const IPTC = seg(0xED, cat(enc("Photoshop 3.0\0"), enc("IPTC: דנה כהן")));
const COM = seg(0xFE, enc("author: דנה כהן"));
const XMP = seg(0xE1, enc("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Dana Cohen</x:xmpmeta>"));
const DQT = seg(0xDB, new Uint8Array(65).fill(1));
const SOF = seg(0xC0, new Uint8Array([8, 0, 1, 0, 1, 1, 1, 0x11, 0]));
const DHT = seg(0xC4, new Uint8Array(29).fill(2));
const SOS = cat(seg(0xDA, new Uint8Array([1, 1, 0, 0, 0x3F, 0])), new Uint8Array([0x12, 0x34, 0xFF, 0x00, 0x56, 0xFF, 0xD3, 0x78]));
const SOI = new Uint8Array([0xFF, 0xD8]), EOI = new Uint8Array([0xFF, 0xD9]);
const TRAIL = cat(SOI, enc("second picture: דנה כהן"), EOI);
const jpeg = (o, le) => cat(SOI, JFIF, seg(0xE1, exif(o, le)), XMP, ICC, MPF, IPTC, COM, DQT, SOF, DHT, SOS, EOI, TRAIL);

console.log("\n— JPEG: the details go, the picture and its rotation stay —");
{
  const out = C.stripJpeg(jpeg(6, true));
  ok(!!out, "a phone photo with details is cleaned");
  if (out) {
    for (const s of ["Dana Cohen", "PhoneCam", "GPS 32.0853N", "IPTC", "author", "xmpmeta", "MPF", "second picture"]) ok(!has(out, s), "gone: " + s);
    ok(!has(out, "דנה כהן"), "no name in Hebrew left anywhere");
    // the picture itself, segment by segment, as it was: JFIF, the colour profile, tables, frame, scan, end
    const expect = cat(SOI, JFIF, ICC, DQT, SOF, DHT, SOS, EOI);
    const rot = out.subarray(2 + JFIF.length, 2 + JFIF.length + 36);
    ok(rot[0] === 0xFF && rot[1] === 0xE1 && C.exifOrientation(rot.subarray(4)) === 6, "the rotation is kept, alone, in a new EXIF right after JFIF");
    const rest = cat(out.subarray(0, 2 + JFIF.length), out.subarray(2 + JFIF.length + 36));
    ok(Buffer.from(rest).equals(Buffer.from(expect)), "everything else is the picture's own bytes, in order (" + rest.length + " = " + expect.length + ")");
  }
  const be = C.stripJpeg(jpeg(8, false));
  ok(be && C.exifOrientation(be.subarray(2 + JFIF.length + 4, 2 + JFIF.length + 36)) === 8, "a big-endian EXIF keeps its rotation too");
  const upright = C.stripJpeg(jpeg(1, true));
  ok(upright && !has(upright, "Exif"), "a photo already upright gets no EXIF at all");
  ok(C.stripJpeg(cat(SOI, JFIF, DQT, SOF, DHT, SOS, EOI)) === null, "a picture with nothing to remove is left as it is (null)");
  const full = jpeg(6, true);
  ok(C.stripJpeg(full.subarray(0, full.length - TRAIL.length - 5)) === null, "a picture cut before its end is left as it is");
  ok(C.stripJpeg(enc("not a picture at all")) === null, "something that is not a JPEG is left as it is");
}

console.log("\n— PNG: the text chunks go, the picture stays —");
const crc = (type, data) => { const b = Buffer.alloc(4); b.writeUInt32BE(C.crc32(cat(enc(type), data))); return new Uint8Array(b); };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); return cat(new Uint8Array(l), enc(type), data, crc(type, data)); };
const SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const IHDR = chunk("IHDR", new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
const GAMA = chunk("gAMA", new Uint8Array([0, 0, 0xB1, 0x8F]));
const IDAT = chunk("IDAT", new Uint8Array(zlib.deflateSync(Buffer.from([0, 255, 0, 0]))));
const IEND = chunk("IEND", new Uint8Array(0));
const png = cat(SIG, IHDR, chunk("tEXt", enc("Author\0Dana Cohen")), chunk("iTXt", enc("Comment\0\0\0\0\0דנה כהן")), chunk("zTXt", cat(enc("Software\0\0"), new Uint8Array(zlib.deflateSync(Buffer.from("PhoneCam"))))),
  chunk("eXIf", exif(6, false)), chunk("tIME", new Uint8Array([7, 234, 10, 12, 9, 30, 0])), GAMA, IDAT, IEND, enc("appended: דנה כהן"));
{
  const out = C.stripPng(png);
  ok(!!out, "a PNG with text chunks is cleaned");
  if (out) {
    ok(Buffer.from(out).equals(Buffer.from(cat(SIG, IHDR, GAMA, IDAT, IEND))), "what is left is the signature, IHDR, gAMA, IDAT and IEND, byte for byte");
    for (const s of ["Dana Cohen", "דנה כהן", "tEXt", "iTXt", "zTXt", "eXIf", "tIME", "appended"]) ok(!has(out, s), "gone: " + s);
  }
  ok(C.stripPng(cat(SIG, IHDR, GAMA, IDAT, IEND)) === null, "a PNG with nothing to remove is left as it is");
  ok(C.stripPng(cat(SIG, IHDR, chunk("tEXt", enc("a\0b")), IDAT)) === null, "a PNG without its end is left as it is");
  ok(C.stripImageMeta("word/media/image9.gif", png) === null, "other kinds of picture are left as they are");
}

console.log("\n— through a whole Word file —");
(async () => {
  const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
  const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
  const files = [...base, { name: "word/document.xml", body: doc(P(R("דנה כהן הגישה את התמונות."))) },
    { name: "word/media/image1.jpeg", body: jpeg(6, true) }, { name: "word/media/image2.png", body: png }];
  const res = await C.redactDocx(mkzip(files), [{ value: "דנה כהן", kind: "NAME", replacement: "" }], [], OPT);
  const ab = await res.blob.arrayBuffer();
  const parts = await C.unzip(ab);
  const pic = (n) => (parts.find((f) => f.name === n) || {}).data;
  ok(res.structural.img === 2, "the report counts two pictures cleaned: " + res.structural.img);
  ok(pic("word/media/image1.jpeg") && !has(pic("word/media/image1.jpeg"), "GPS 32.0853N") && !has(pic("word/media/image1.jpeg"), "Dana Cohen"), "the photo in the file has no place and no name");
  ok(pic("word/media/image1.jpeg") && C.exifOrientation(pic("word/media/image1.jpeg").subarray(2 + JFIF.length + 4)) === 6, "and keeps its rotation");
  ok(pic("word/media/image2.png") && !has(pic("word/media/image2.png"), "Dana Cohen"), "the PNG in the file has no author");
  ok(res.verification && res.verification.passed, "the final check passes: the name is gone from the text and the pictures");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });

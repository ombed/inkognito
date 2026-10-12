const { test, expect } = require("./base");
const H = require("./helpers");

/* A photo cleaned of its hidden details still opens, the right way up (the engineering audit, 12.10). The engine's own
   checks are in tests/imgmeta_t.js; Node cannot decode a picture, so here the browser draws a real JPEG and a real PNG,
   they get what a phone and an editor add (a rotation, a place and a name; a text chunk with an author), the engine
   cleans them, and the browser decodes the result. Invented names only. */
test("a cleaned photo still opens, keeps its rotation, and has no place or name left", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.waitForFunction(() => window.__pib && window.__pib.state().E, null, { timeout: 60000 });
  const r = await page.evaluate(async () => {
    const E = window.__pib.state().E;
    const c = document.createElement("canvas"); c.width = 40; c.height = 20;
    const g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 40, 20); g.fillStyle = "#33c"; g.fillRect(0, 0, 20, 20);
    const blobOf = (type) => new Promise((done) => c.toBlob(done, type, 0.9));
    const bytes = async (b) => new Uint8Array(await b.arrayBuffer());
    const enc = (s) => new TextEncoder().encode(s);
    const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
    const has = (u, s) => { const n = enc(s); outer: for (let i = 0; i + n.length <= u.length; i++) { for (let j = 0; j < n.length; j++) if (u[i + j] !== n[j]) continue outer; return true; } return false; };
    const size = async (u, type) => { const b = await window.createImageBitmap(new Blob([u], { type })); return [b.width, b.height]; };
    // a phone's EXIF: Orientation 6 (turned a quarter), then a place and a name
    const tiff = [0x4D, 0x4D, 0, 0x2A, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0];
    const body = cat(enc("Exif\0\0"), new Uint8Array(tiff), enc("GPS 32.0853N Dana Cohen"));
    const app1 = cat(new Uint8Array([0xFF, 0xE1, (body.length + 2) >> 8, (body.length + 2) & 255]), body);
    const jpg = await bytes(await blobOf("image/jpeg"));
    const phone = cat(jpg.subarray(0, 2), app1, jpg.subarray(2));
    const cleanJ = E.stripImageMeta("word/media/image1.jpeg", phone);
    // a PNG with a text chunk after IHDR
    const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let k = n; for (let j = 0; j < 8; j++) k = k & 1 ? 0xEDB88320 ^ (k >>> 1) : k >>> 1; t[n] = k >>> 0; } return t; })();
    const crc = (u) => { let k = 0xFFFFFFFF; for (const b of u) k = crcT[(k ^ b) & 255] ^ (k >>> 8); return (k ^ 0xFFFFFFFF) >>> 0; };
    const chunk = (type, data) => { const td = cat(enc(type), data), o = new Uint8Array(12 + data.length), v = new DataView(o.buffer); v.setUint32(0, data.length); o.set(td, 4); v.setUint32(8 + data.length, crc(td)); return o; };
    const png = await bytes(await blobOf("image/png"));
    const ihdrEnd = 8 + 12 + new DataView(png.buffer).getUint32(8);
    const edited = cat(png.subarray(0, ihdrEnd), chunk("tEXt", enc("Author\0Dana Cohen")), png.subarray(ihdrEnd));
    const cleanP = E.stripImageMeta("word/media/image2.png", edited);
    return {
      phone: await size(phone, "image/jpeg"), cleanJ: cleanJ ? await size(cleanJ, "image/jpeg") : null,
      jpegPlace: cleanJ ? has(cleanJ, "GPS 32.0853N") : true, jpegName: cleanJ ? has(cleanJ, "Dana Cohen") : true,
      edited: await size(edited, "image/png"), cleanP: cleanP ? await size(cleanP, "image/png") : null, pngName: cleanP ? has(cleanP, "Dana Cohen") : true,
    };
  });
  // the browser turns the phone photo a quarter, as a phone shows it; the cleaned one is turned the same way
  expect(r.phone, "the phone photo as the browser shows it").toEqual([20, 40]);
  expect(r.cleanJ, "the cleaned photo opens, still turned").toEqual([20, 40]);
  expect(r.jpegPlace || r.jpegName, "no place or name left in the photo").toBe(false);
  expect(r.edited).toEqual([40, 20]);
  expect(r.cleanP, "the cleaned PNG opens at its size").toEqual([40, 20]);
  expect(r.pngName, "no author left in the PNG").toBe(false);
});

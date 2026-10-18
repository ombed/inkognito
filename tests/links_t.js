/* Identity carried inside an address, not in words (the hunt of 11.10: «A link's address leaves with the file»).

   A Word file keeps every link's address in a .rels part (one per body, header, footer, footnotes, endnotes and
   comments), every field's path in its field code, and the path a picture came from in its alt text. Only four
   target shapes were cleaned (mailto:, file:, a drive, a share); a field's path was cut at its first space, or
   missed when Word split it over runs; and the final check never decoded %D7%93. So a Facebook profile, a
   WhatsApp number, the client's folder on SharePoint and a path with a user name left with the file, mostly
   under a green bar, while an address Word had auto-linked turned the bar red with nothing on screen to fix.
   The FAQ promises the file's links are cleaned («מנקה ממנו גם ... קישורים»). The other side: a public link (a
   law on nevo, gov.il, a court's site, a company's home page) stays usable unless it carries a detected value.

   Each case is one check, and every one fails on the engine before this change, except the counterexamples
   (public links and ordinary text that must stay as they are) and four marked guards for shapes the old code
   already cleaned, whose code this change rewrote. Every name, handle, number and address here is invented. */
// the page's XML parser and serializer are the browser's: jsdom's here, as in tests/wordfile-lib.js. xmldom writes
// the XML declaration back into its output, and a part the tool rewrites came out with two (11.10); it is kept
// only to check that what the tool wrote parses (badXml)
const xd = require("@xmldom/xmldom");
const { JSDOM } = require("jsdom");
const win = new JSDOM("<!doctype html><html><body></body></html>").window;
global.DOMParser = win.DOMParser; global.XMLSerializer = win.XMLSerializer;
const zlib = require("zlib"), fs = require("fs"), path = require("path");
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
const HERE = __dirname;
const E = require("./core.js");
const { mkzip } = require("./mkzip.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const NAME = "דנה שגיא", REP = "יעל כהן", SUBS = [{ value: NAME, kind: "NAME", replacement: REP }];
const ID = "123456782"; // nine digits with a valid check digit
const enc = encodeURIComponent;
// the page's own defaults (index.html opts()): numbers deleted, dates shifted, every rule as shipped
const ON = new Set(E.PAT.filter((p) => p.on).map((p) => p.n).concat("PLACES"));
const FLAG = new Set(E.PAT.filter((p) => !p.on).map((p) => p.n).concat("NAME_ANCHORED"));
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };

const NS = ['xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"', 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"', 'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"', 'xmlns:v="urn:schemas-microsoft-com:vml"', 'xmlns:o="urn:schemas-microsoft-com:office:office"'].join(" ");
const XD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const RT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const P = (inner) => `<w:p>${inner}</w:p>`;
const R = (t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const rel = (id, target, ext = true, type = "hyperlink") => `<Relationship Id="${id}" Type="${RT}/${type}" Target="${attr(target)}"${ext ? ' TargetMode="External"' : ""}/>`;
const rels = (list) => XD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.join("")}</Relationships>`;
const link = (id, text) => `<w:hyperlink r:id="${id}" w:history="1">${R(text)}</w:hyperlink>`;
const part = (root, body) => XD + `<w:${root} ${NS}>${body}</w:${root}>`;
const fld = (pieces, shown) => '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' + pieces.map((p) => `<w:r><w:instrText xml:space="preserve">${p}</w:instrText></w:r>`).join("") +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' + R(shown) + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
function pkg({ body, docRels = [], parts = [] }) {
  return mkzip([
    { name: "[Content_Types].xml", body: XD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>' },
    { name: "_rels/.rels", body: rels([`<Relationship Id="rId1" Type="${RT}/officeDocument" Target="word/document.xml"/>`]) },
    { name: "word/document.xml", body: XD + `<w:document ${NS}><w:body>${P(R("פרוטוקול הדיון."))}${body}<w:sectPr/></w:body></w:document>` },
    { name: "word/_rels/document.xml.rels", body: rels(docRels) },
    ...parts,
  ]);
}
const TXT = new TextDecoder();
async function run(zip, subs = SUBS, allow = []) {
  const res = await E.redactDocx(zip, subs, allow, OPT);
  const out = Object.fromEntries((await E.unzip(await res.blob.arrayBuffer())).map((f) => [f.name, TXT.decode(f.data)]));
  const copy = res.preview.filter((p) => !E.hiddenPart(p.part)).map((p) => p.text).join("\n");
  return { res, out, copy };
}
// what a reader of the file can recover: %XX decoded (more than once, for an address encoded twice), + and _ as spaces
const dec = (t) => { let s = t; for (let i = 0; i < 3; i++) { const n = s.replace(/(?:%[0-9A-Fa-f]{2})+/g, (m) => { try { return decodeURIComponent(m); } catch (_) { return m; } }); if (n === s) break; s = n; } return s; };
const readable = (t) => { const d = dec(t.replace(/&amp;/g, "&")); return t + "\n" + d + "\n" + d.replace(/[+_]/g, " "); };
const leftIn = (out, s) => Object.keys(out).filter((n) => /\.(xml|rels)$/.test(n) && readable(out[n]).includes(s));
const targetOf = (relsXml, id) => { const m = new RegExp(`<Relationship [^>]*Id="${id}"[^>]*>`).exec(relsXml || ""); const t = m && /Target="([^"]*)"/.exec(m[0]); return t ? t[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&") : null; };
const badXml = (out) => Object.entries(out).filter(([n]) => /\.(xml|rels)$/.test(n)).filter(([, t]) => {
  let bad = false; try { new xd.DOMParser({ onError: (lvl) => { if (lvl !== "warning") bad = true; } }).parseFromString(t, "application/xml"); } catch (_) { bad = true; } return bad; }).map(([n]) => n);
const instrOf = (x) => (x.match(/<w:instrText[^>]*>[^<]*<\/w:instrText>/g) || []).map((s) => s.replace(/<[^>]+>/g, "")).join("").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const nohit = (res) => res.flagged.filter((f) => f.src === "nohit").map((f) => f.value);
// the file is still a file: every part well-formed, the check passes
const sound = (res, out) => res.verification.passed && !badXml(out).length;
const why = (res, out) => JSON.stringify({ leaks: res.verification.leaks, bad: badXml(out) });

(async () => {
  console.log("\n— a social or messaging address behind words: the target leaves as «#» —");
  {
    const SOCIAL = [
      ["a Facebook profile", "https://www.facebook.com/dana.sagi.77", "dana.sagi.77"],
      ["a Facebook profile by number", "https://www.facebook.com/profile.php?id=100012345678901", "100012345678901"],
      ["a mobile Facebook link", "https://m.facebook.com/dana.sagi.76", "dana.sagi.76"],
      ["an fb.me short link", "https://fb.me/dana.sagi.75", "dana.sagi.75"],
      ["a Messenger link", "https://m.me/dana.sagi.74", "dana.sagi.74"],
      ["an Instagram account", "https://www.instagram.com/dana.sagi.73/", "dana.sagi.73"],
      ["a LinkedIn profile", "https://il.linkedin.com/in/dana-sagi-1234", "dana-sagi-1234"],
      ["an X account", "https://x.com/danasagi77", "danasagi77"],
      ["a Twitter account", "https://twitter.com/danasagi78", "danasagi78"],
      ["a TikTok account", "https://www.tiktok.com/@dana.sagi79", "dana.sagi79"],
      ["a TikTok short link", "https://vm.tiktok.com/ZSabc123/", "ZSabc123"],
      ["a Threads account", "https://www.threads.net/@dana.sagi80", "dana.sagi80"],
      ["a YouTube handle", "https://www.youtube.com/@DanaSagi81", "DanaSagi81"],
      ["a YouTube channel", "https://www.youtube.com/channel/UCabcdefghijklmnop123456", "UCabcdefghijklmnop123456"],
      ["a Telegram account", "https://t.me/danasagi82", "danasagi82"],
      ["a WhatsApp number", "https://wa.me/972521234567", "972521234567"],
      ["a WhatsApp send link", "https://api.whatsapp.com/send?phone=972527654321&text=hi", "972527654321"],
      ["a WhatsApp group invite", "https://chat.whatsapp.com/AbCdEfGhIjK123", "AbCdEfGhIjK123"],
      ["a photo copied from Facebook", "https://scontent.ftlv1-1.fna.fbcdn.net/v/t39.30808-6/123456789_987654321_n.jpg", "123456789_987654321"],
    ];
    const body = P(R(`${NAME} הגישה את הצילומים. `) + SOCIAL.map((_, i) => link("rIdS" + i, "קישור " + (i + 1))).join(R(" ")));
    const { res, out } = await run(pkg({ body, docRels: SOCIAL.map(([, url], i) => rel("rIdS" + i, url)) }));
    const relsOut = out["word/_rels/document.xml.rels"], words = SOCIAL.every((_, i) => out["word/document.xml"].includes("קישור " + (i + 1)));
    SOCIAL.forEach(([what, , secret], i) => {
      const t = targetOf(relsOut, "rIdS" + i), left = leftIn(out, secret);
      ok(t === "#" && !left.length && words && sound(res, out), `${what}: the target is «${t}», «${secret}» is in ${left.join(", ") || "no part"}, the words stay: ${words}, ${why(res, out)}`);
    });
  }

  console.log("\n— the same in every part that keeps its own links, and in any kind of external target —");
  for (const [where, name, wrap] of [
    ["a header", "header1.xml", (x) => part("hdr", P(x))],
    ["a footer", "footer1.xml", (x) => part("ftr", P(x))],
    ["a footnote", "footnotes.xml", (x) => part("footnotes", `<w:footnote w:id="1">${P(x)}</w:footnote>`)],
    ["an endnote", "endnotes.xml", (x) => part("endnotes", `<w:endnote w:id="1">${P(x)}</w:endnote>`)],
    ["a comment", "comments.xml", (x) => part("comments", `<w:comment w:id="0" w:author="x">${P(x)}</w:comment>`)],
  ]) {
    const handle = "dana.sagi." + name.length;
    const { res, out } = await run(pkg({ body: P(R(`${NAME} פרסמה.`)), parts: [
      { name: "word/" + name, body: wrap(R("ראו ") + link("rId1", "הפוסט")) },
      { name: "word/_rels/" + name + ".rels", body: rels([rel("rId1", "https://www.instagram.com/" + handle + "/")]) }] }));
    const left = leftIn(out, handle);
    ok(!left.length && sound(res, out), `${where}: the account in its links is in ${left.join(", ") || "no part"}, ${why(res, out)}`);
  }
  {
    const { out } = await run(pkg({ body: P(R(`${NAME} פרסמה.`)), parts: [
      { name: "word/comments.xml", body: part("comments", `<w:comment w:id="0" w:author="x">${P(link("rId1", "x"))}</w:comment>`) },
      { name: "word/_rels/comments.xml.rels", body: rels([rel("rId1", "https://twitter.com/danasagi83")]) }] }));
    ok(!("word/comments.xml.rels" in out) && !("word/_rels/comments.xml.rels" in out), "the comments are removed, and the links part of the comments goes with them");
  }
  {
    // a picture inserted «linked to file», stored relative to the document, and the template the file was made from
    const settingsRels = rels([rel("rId1", "file:///C:\\Users\\dana.sagi9\\AppData\\Roaming\\Microsoft\\Templates\\Normal.dotm", true, "attachedTemplate")]);
    const pic = P('<w:r><w:drawing><wp:inline><wp:docPr id="1" name="x"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:link="rId8"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>');
    const { res, out } = await run(pkg({ body: P(R(`${NAME} צירפה תמונה.`)) + pic, docRels: [rel("rId8", "תמונות/" + enc("הבית של דנה") + ".jpg", true, "image")],
      parts: [{ name: "word/settings.xml", body: part("settings", "<w:attachedTemplate r:id=\"rId1\"/>") }, { name: "word/_rels/settings.xml.rels", body: settingsRels }] }));
    ok(!leftIn(out, "dana.sagi9").length && !leftIn(out, "הבית של").length && sound(res, out), "a linked picture's path and the template's path are gone: " + why(res, out));
    // a links part written with single quotes, as some programs do
    const single = XD + `<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId4' Type='${RT}/hyperlink' Target='https://wa.me/972528889999' TargetMode='External'/></Relationships>`;
    const s2 = await run(mkzip([
      { name: "[Content_Types].xml", body: XD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
      { name: "word/document.xml", body: XD + `<w:document ${NS}><w:body>${P(R(`${NAME} שלחה `) + link("rId4", "הודעה"))}</w:body></w:document>` },
      { name: "word/_rels/document.xml.rels", body: single }]));
    ok(!leftIn(s2.out, "972528889999").length && sound(s2.res, s2.out), "a links part written with single quotes is cleaned too, and stays well-formed");
  }

  console.log("\n— a file on her computer, her firm's storage, a place, a phone: the target leaves as «#» —");
  {
    const LOCAL = [
      ["a relative link to a file, the client's name in it", `נספחים/${NAME.replace(" ", "%20")}%20-%20דוח%20רפואי.pdf`, NAME],
      ["the same, fully encoded", `${enc("נספחים")}/${enc("דוח רפואי של המבקשת")}.pdf`, "דוח רפואי"],
      ["a relative link with no listed name (a folder on her disk)", "נספחים/נספח%20א.pdf", "נספח א"],
      ["a SharePoint folder with the client's name encoded", `https://firm-my.sharepoint.com/personal/adv_firm_co_il/Documents/${enc("לקוחות")}/${enc(NAME)}/${enc("תצהיר")}.docx`, "adv_firm_co_il"],
      ["a SharePoint sharing link", "https://firm-my.sharepoint.com/:w:/g/personal/adv2_firm_co_il/EabcDEF123?e=xyz", "adv2_firm_co_il"],
      ["a OneDrive short link", "https://1drv.ms/w/s!AbcDef123", "AbcDef123"],
      ["a Google Drive file", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing", "1AbCdEfGhIjKlMnOp"],
      ["a Google Docs document", "https://docs.google.com/document/d/1QrStUvWxYz987/edit", "1QrStUvWxYz987"],
      ["a Dropbox file", "https://www.dropbox.com/s/abc123qq/x.pdf?dl=0", "abc123qq"],
      ["a WeTransfer download", "https://we.tl/t-AbCdEf789", "AbCdEf789"],
      ["a map pin", "https://maps.app.goo.gl/AbCdEf456", "AbCdEf456"],
      ["a Google Maps address", `https://www.google.com/maps/place/${enc("רחוב הגפן 12, חיפה")}/@32.791,34.989,17z`, "הגפן"],
      ["a Waze link", "https://waze.com/ul?ll=32.7912,34.9871&navigate=yes", "32.7912"],
      ["a server on the office network", `http://srv-office/clients/${enc("נועה ברק")}/`, "נועה ברק"],
      ["a phone link", "tel:+972521112222", "521112222"],
      ["an SMS link", "sms:0521113333", "0521113333"],
      // guards: shapes the old code cleaned too, whose code this change rewrote
      ["a mailto link (a guard)", "mailto:dana.sagi@example.com", "dana.sagi@"],
      ["a file link with a user name (a guard)", "file:///C:/Users/dana.sagi/Documents/x.docx", "Users/dana.sagi/"],
      ["a drive path (a guard)", "C:\\Users\\dana.sagi2\\Documents\\x.docx", "dana.sagi2"],
      ["a network share (a guard)", "\\\\fileserver\\clients\\אורית לוין\\x.docx", "אורית לוין"],
    ];
    const body = P(R(`${NAME} צירפה את הקבצים. `) + LOCAL.map((_, i) => link("rIdL" + i, "נספח " + (i + 1))).join(R(" ")));
    const { res, out } = await run(pkg({ body, docRels: LOCAL.map(([, url], i) => rel("rIdL" + i, url)) }));
    const relsOut = out["word/_rels/document.xml.rels"];
    LOCAL.forEach(([what, , secret], i) => {
      const t = targetOf(relsOut, "rIdL" + i), left = leftIn(out, secret);
      ok(t === "#" && !left.length && sound(res, out), `${what}: the target is «${t}», «${secret}» is in ${left.join(", ") || "no part"}, ${why(res, out)}`);
    });
    ok(res.structural.rels.length === LOCAL.length, `each cleaned target is counted for «קישורים שנוטרלו»: ${res.structural.rels.length} of ${LOCAL.length}`);
  }
  {
    // the client is named only in the address of a link behind the words «התצהיר המלא»: she is in the document
    const url = `https://firm-my.sharepoint.com/personal/adv_firm_co_il/Documents/${enc(NAME)}/${enc("תצהיר")}.docx`;
    const { res, out } = await run(pkg({ body: P(R("ראו את ") + link("rId3", "התצהיר המלא") + R(".")), docRels: [rel("rId3", url)] }));
    ok(!leftIn(out, NAME).length && !nohit(res).includes(NAME), "a name only in a link's address is gone, and not reported «לא נמצא … לא מופיע במסמך הזה בכלל»: " + JSON.stringify(nohit(res)));
  }

  console.log("\n— an ordinary site: only the detected part goes, the rest of the link stays —");
  {
    const SITE = [
      ["the client's name in the path, encoded", `https://cases.example.org/c/${enc(NAME)}/summary`, [NAME, "דנה", "שגיא"], "https://cases.example.org/c/", "/summary"],
      ["the client's name with + in a search", "https://www.google.com/search?q=דנה+שגיא&hl=iw", [NAME], "https://www.google.com/search?q=", "&hl=iw"],
      ["the client's name with underscores in a file name", `https://files.example.org/docs/${enc("דנה_שגיא")}.pdf`, [NAME, "דנה_שגיא"], "https://files.example.org/docs/", ".pdf"],
      ["the client's name encoded twice", `https://files.example.org/x/${enc(enc(NAME))}.pdf`, [NAME], "https://files.example.org/x/", ".pdf"],
      ["an ID number in the query", `https://portal.example.org/view?tz=${ID}&lang=he`, [ID], "https://portal.example.org/view?tz=", "&lang=he"],
      ["an e-mail in the query, encoded", "https://news.example.org/unsubscribe?email=dana.sagi%40example.com&list=7", ["dana.sagi@example.com"], "https://news.example.org/unsubscribe?email=", "&list=7"],
      ["a mobile number in the query", "https://shop.example.org/order?phone=0529998888&item=4", ["0529998888"], "https://shop.example.org/order?phone=", "&item=4"],
      ["a YouTube video, shared with the sharer's id", "https://youtu.be/abcdEFGhij0?si=XyZ123abc", ["XyZ123abc"], "https://youtu.be/abcdEFGhij0", ""],
      ["a YouTube video, with its channel's name", "https://www.youtube.com/watch?v=abcdEFGhij1&ab_channel=DanaSagi84", ["DanaSagi84"], "https://www.youtube.com/watch?v=abcdEFGhij1", ""],
      ["a redirect wrapped around a profile", "https://www.google.com/url?q=https://www.facebook.com/dana.sagi.94&sa=D", ["dana.sagi.94", "facebook"], "https://www.google.com/url?q=", "&sa=D"],
      ["an Outlook Safe Link, with the recipient's address in it", "https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.gov.il%2Fhe&data=05%7C01%7Cdana.sagi%40firm.example.co.il%7Cabc123%7C0&reserved=0", ["dana.sagi@firm.example.co.il", "dana.sagi"], "https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.gov.il%2Fhe&data=05%7C01%7C", "&reserved=0"],
    ];
    const body = P(R(`${NAME} ת"ז ${ID} הגישה. `) + SITE.map((_, i) => link("rIdW" + i, "מקור " + (i + 1))).join(R(" ")));
    const { res, out } = await run(pkg({ body, docRels: SITE.map(([, url], i) => rel("rIdW" + i, url)) }));
    const relsOut = out["word/_rels/document.xml.rels"];
    SITE.forEach(([what, , gone, head, tail], i) => {
      const t = targetOf(relsOut, "rIdW" + i) || "", still = gone.filter((g) => readable(t).includes(g));
      ok(!still.length && t.startsWith(head) && t.endsWith(tail) && t !== "#" && sound(res, out), `${what}: «${still.join("», «")}» still in the target, or the rest of it lost: «${t}», ${why(res, out)}`);
    });
  }

  console.log("\n— counterexamples: a public link that holds no detected value stays as it is —");
  {
    const PUBLIC = [
      "https://www.gov.il/he",
      "https://www.gov.il/he/departments/legalInfo/family-court-guide",
      "https://www.nevo.co.il/law_html/law00/71907.htm",
      "https://www.nevo.co.il/psika_html/elyon/18047870-N12.htm",
      // nevo's decision files: a court, a year, a month and a case number that looked like a landline in the path
      "https://www.nevo.co.il/psika_html/shalom/SH-19-06-12345-11.htm",
      "https://www.nevo.co.il/psika_html/family/FA-21-04-54321-12.htm",
      "https://www.nevo.co.il/psika_html/shalom/SH-18-02-23456-77.htm",
      "https://www.nevo.co.il/psika_html/mechozi/ME-20-09-04512-88.htm",
      "https://supremedecisions.court.gov.il/Home/Download?path=HebrewVerdicts/20/030/050/e14&fileName=20050030.E14&type=4",
      "https://www.court.gov.il/NGCS.Web.Site/HomePage.aspx",
      "https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawPrimary.aspx?t=lawlaws&st=lawlaws&lawitemid=2000593",
      "https://www.btl.gov.il/benefits/Pages/default.aspx",
      "https://he.wikipedia.org/wiki/" + enc("חוק_הירושה"),
      "https://www.gov.il/BlobFolder/policy/18-2023/he/18-2023.pdf",
      "https://www.example.co.il/news/2024-03-12/item-12-345-67",
      "https://www.example.co.il/",
      "https://www.youtube.com/watch?v=abcdEFGhij2",
      "https://www.facebook.com/",
      "https://www.whatsapp.com/",
    ];
    const body = P(R(`${NAME} הגישה את הבקשה. `) + PUBLIC.map((_, i) => link("rIdP" + i, "מקור " + (i + 1))).join(R(" ")));
    const { res, out } = await run(pkg({ body, docRels: PUBLIC.map((u, i) => rel("rIdP" + i, u)) }));
    const relsOut = out["word/_rels/document.xml.rels"];
    PUBLIC.forEach((u, i) => ok(relsOut.includes(`Target="${attr(u)}"`), `kept byte for byte: ${u} → «${targetOf(relsOut, "rIdP" + i)}»`));
    ok(res.structural.rels.length === 0, "none of them is counted as cleaned: " + JSON.stringify(res.structural.rels));
    ok(res.verification.passed && res.verification.complete, "and the bar is green: " + JSON.stringify([res.verification.leaks, res.verification.remaining, (res.verification.suggest || []).map((x) => x.value)]));
    // typed in the text, the same public addresses reach the AI as they are (a YouTube address in the text is
    // deleted by design, and a date or a plate written inside an address is the text rules' business, not an address's)
    const typed = PUBLIC.filter((u) => !/youtube|2024-03-12/.test(u));
    const { copy } = await run(pkg({ body: typed.map((u) => P(R(attr(`${NAME} צירפה את ${u} לבקשה.`)))).join("") }));
    for (const u of typed) ok(copy.includes(u), "typed in the text, it stays: " + u);
  }

  console.log("\n— an address typed in the text, which Word auto-links: the text and the target go together —");
  for (const [url, secret] of [["https://www.facebook.com/dana.sagi.85", "dana.sagi.85"], ["https://wa.me/972523334444", "972523334444"], ["https://www.instagram.com/dana.sagi.86", "dana.sagi.86"]]) {
    const { res, out, copy } = await run(pkg({ body: P(R(`הפרופיל של ${NAME} `) + link("rId5", url) + R(" צורף.")), docRels: [rel("rId5", url)] }));
    ok(sound(res, out) && !leftIn(out, secret).length && !copy.includes(secret), `${url}: no red bar with nothing to fix, gone from the file and the copied text: ` +
      JSON.stringify({ leaks: res.verification.leaks, left: leftIn(out, secret), copy: copy.includes(secret) }));
  }

  console.log("\n— a field's address: the pieces Word split are read together, a path is read to its closing quote —");
  {
    const cases = [
      ["a mailto split over two runs", fld([' HYPERLINK "mailto:dana', '.sagi@example.com" '], "כתבו לה"), ["sagi@example.com", "dana.sagi"], "כתבו לה"],
      ["the client's name encoded, split over three runs", fld([' HYPERLINK "https://files.example.org/', enc(NAME), '.pdf" '], "הקובץ"), [NAME], "הקובץ"],
      ["a picture path with spaces", fld([' INCLUDEPICTURE "C:\\\\Users\\\\dana sagi\\\\My Pictures\\\\scan.jpg" \\* MERGEFORMATINET '], "תמונה"), ["dana", "sagi", "My Pictures"], "תמונה"],
      ["a picture path split mid-folder", fld([' INCLUDEPICTURE "C:\\\\Users\\\\da', 'na.sagi3\\\\Desktop\\\\scan.jpg" \\d '], "תמונה"), ["na.sagi3", "Desktop"], "תמונה"],
      ["a text included from a share", fld([' INCLUDETEXT "\\\\\\\\fileserver\\\\clients\\\\אורית לוין\\\\letter.docx" '], "המכתב"), ["אורית", "לוין", "fileserver"], "המכתב"],
      ["a link field with no quotes", fld([" HYPERLINK https://wa.me/972525556666 "], "הודעה"), ["972525556666"], "הודעה"],
      ["a linked spreadsheet, its path typed with single backslashes", fld([' LINK Excel.Sheet.12 "C:\\Users\\dana.sagi11\\My Documents\\expenses.xlsx" "Sheet1!R1C1:R3C3" \\a \\f 4 \\h '], "טבלה"), ["dana.sagi11", "Documents"], "טבלה"],
      ["a linked spreadsheet, its path as Word writes it", fld([' LINK Excel.Sheet.12 "C:\\\\Users\\\\dana.sagi12\\\\My Documents\\\\expenses.xlsx" "Sheet1!R1C1:R3C3" \\a \\f 4 \\h '], "טבלה"), ["dana.sagi12", "Documents"], "טבלה"],
      ["a simple field to a profile", `<w:fldSimple w:instr=' HYPERLINK "https://www.facebook.com/dana.sagi.87" '>${R("הפרופיל")}</w:fldSimple>`, ["dana.sagi.87"], "הפרופיל"],
      ["a ScreenTip with an ID number split mid-number", fld([' HYPERLINK "https://www.gov.il/he" \\o "תיק לקוח, מספר זהות 1234', '56782" '], "האתר"), [ID, "56782"], "האתר"],
    ];
    for (const [what, f, gone, shown] of cases) {
      const { res, out } = await run(pkg({ body: P(R(`${NAME} הגישה. `) + f) }));
      const x = out["word/document.xml"], still = gone.filter((g) => readable(x).includes(g));
      ok(!still.length && x.includes(shown) && sound(res, out), `${what}: «${still.join("», «")}» still in the field code «${instrOf(x) || x.slice(x.indexOf("instr"), x.indexOf("instr") + 160)}», or the field's text lost, ${why(res, out)}`);
    }
    const one = (await run(pkg({ body: P(fld([' HYPERLINK "mailto:dana', '.sagi@example.com" '], "כתבו לה")) }))).out["word/document.xml"];
    ok((one.match(/<w:instrText/g) || []).length === 1 && /^\s*HYPERLINK\s+"#"\s*$/.test(instrOf(one)), "the split instruction is one piece again, and its address is «#»: " + JSON.stringify(instrOf(one)));
    // counterexamples: a public address in a field stays as it is
    const gov = (await run(pkg({ body: P(fld([' HYPERLINK "https://www.gov.il/he" \\o "הפרופיל של דנה ', 'שגיא" '], "האתר")) }))).out["word/document.xml"];
    ok(instrOf(gov).includes('HYPERLINK "https://www.gov.il/he"') && !readable(gov).includes(NAME), "a public address in a field stays, and the name in its split ScreenTip goes: " + instrOf(gov));
    const nevo = (await run(pkg({ body: P(fld([' HYPERLINK "https://www.nevo.co.il/law_html/law00/71907.htm" '], "החוק")) }))).out["word/document.xml"];
    ok(instrOf(nevo).includes('"https://www.nevo.co.il/law_html/law00/71907.htm"'), "a law's page in a field stays as it is: " + instrOf(nevo));
  }

  console.log("\n— alt text and titles of pictures and shapes: a path with a user name, an address —");
  {
    const drawing = (docPr, cNvPr = "") => P(`<w:r><w:drawing><wp:inline><wp:extent cx="1" cy="1"/><wp:docPr id="1" ${docPr}/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" ${cNvPr || 'name="image.png"'}/><pic:cNvPicPr/></pic:nvPicPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`);
    const box = (docPr) => P(`<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="3" ${docPr}/><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>${P(R("הערה"))}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice></mc:AlternateContent></w:r>`);
    const vml = (shape, img) => P(`<w:r><w:pict><v:shape id="_x0000_i1025" type="#_x0000_t75" ${shape}><v:imagedata r:id="rId30" ${img}/></v:shape></w:pict></w:r>`);
    for (const [what, body, gone, kept] of [
      ["a picture's alt text: the Windows path it came from", drawing('name="Picture 1" descr="C:\\Users\\dana.sagi\\Desktop\\scan.jpg"'), ["dana.sagi", "Desktop"], 'descr="scan.jpg"'],
      ["the same in the picture's own properties", drawing('name="Picture 1"', 'name="image.png" descr="C:\\Users\\dana.sagi4\\Pictures\\scan.jpg"'), ["dana.sagi4"], 'descr="scan.jpg"'],
      ["a picture's title: a network path", drawing('name="Picture 1" title="\\\\fileserver\\users\\dana.sagi5\\scan.jpg"'), ["dana.sagi5", "fileserver"], 'title="scan.jpg"'],
      ["a picture's alt text: a file address", drawing('name="Picture 1" descr="file:///C:/Users/dana.sagi6/Pictures/scan%20one.jpg"'), ["dana.sagi6"], 'descr="scan'],
      ["a text box's alt text: a Mac path", box('name="Text Box 3" descr="/Users/dana.sagi7/Desktop/note.png"'), ["dana.sagi7"], 'descr="note.png"'],
      ["a picture's alt text: a WhatsApp number", drawing('name="Picture 1" descr="https://wa.me/972526667777"'), ["972526667777"], 'name="Picture 1"'],
      ["a picture's alt text: a SharePoint address with the client's folder", drawing(`name="Picture 1" descr="https://firm-my.sharepoint.com/personal/adv/Documents/${enc(NAME)}/scan.jpg"`), [NAME, "sharepoint"], 'name="Picture 1"'],
      ["an old-style (VML) picture: alt text and title", vml('alt="C:\\Users\\dana.sagi8\\Desktop\\scan.jpg"', 'o:title="C:\\Users\\dana.sagi8\\Desktop\\scan"'), ["dana.sagi8"], 'o:title="scan"'],
    ]) {
      const { res, out } = await run(pkg({ body: P(R(`${NAME} צירפה תמונה.`)) + body, docRels: [rel("rId30", "media/image1.png", false, "image")], parts: [{ name: "word/media/image1.png", body: "PNG" }] }));
      const x = out["word/document.xml"], still = gone.filter((g) => readable(x).includes(g));
      ok(!still.length && x.includes(kept) && sound(res, out), `${what}: «${still.join("», «")}» still in word/document.xml, or «${kept}» lost, ${why(res, out)}`);
    }
    // a counterexample: ordinary alt text is not touched
    const { out } = await run(pkg({ body: drawing('name="תמונה 1" descr="תמונה של בניין בית המשפט" title="scan.jpg"') }));
    ok(out["word/document.xml"].includes('descr="תמונה של בניין בית המשפט"') && out["word/document.xml"].includes('title="scan.jpg"'), "ordinary alt text and a bare file name stay as they are");
  }

  console.log("\n— the final check reads an address the way a browser does —");
  {
    const relsZip = (target, ext = true) => pkg({ body: P(R("טקסט.")), docRels: [rel("rId9", target, ext)] });
    for (const [what, target] of [
      ["percent-encoded", `https://cases.example.org/${enc(NAME)}`],
      ["with + for a space in a query", "https://www.google.com/search?q=דנה+שגיא"],
      ["encoded twice", `https://cases.example.org/${enc(enc(NAME))}`],
      ["encoded, in lower case", `https://cases.example.org/${enc(NAME).toLowerCase()}`],
    ]) {
      const v = await E.verify(relsZip(target), [NAME]);
      ok(!v.passed && v.leaks.some((l) => l.part === "word/_rels/document.xml.rels"), `${what}: the name in a link's address is a leak: ` + JSON.stringify(v.leaks));
    }
    const fieldZip = pkg({ body: P(fld([` HYPERLINK "https://cases.example.org/${enc(NAME)}" `], "x")) });
    ok(!(await E.verify(fieldZip, [NAME])).passed, "in a field's address too");
    // a counterexample: encoded text that holds nothing listed passes
    const clean = await E.verify(pkg({ body: P(R("טקסט.")), docRels: [rel("rId9", "https://www.gov.il/he/a%20b?q=a+b&x=%D7%97%D7%95%D7%A7")] }), [NAME, ID]);
    ok(clean.passed, "a clean file with encoded text in it passes: " + JSON.stringify(clean.leaks));
    // what the tool cannot clean (the name of a part inside the package) turns the bar red, never green
    const inner = pkg({ body: P(R(`${NAME} צירפה תמונה.`)) + P('<w:r><w:drawing><wp:inline><wp:docPr id="1" name="x"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId7"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'),
      docRels: [rel("rId7", `media/${enc(NAME)}.png`, false, "image")], parts: [{ name: `word/media/${NAME}.png`, body: "PNG" }] });
    const { res } = await run(inner);
    ok(!res.verification.passed && res.verification.leaks.some((l) => l.part === "word/_rels/document.xml.rels"), "a part named after the client, which the tool cannot rename, turns the bar red: " + JSON.stringify(res.verification.leaks));
  }

  console.log("\n— the copy path: addresses pasted as text are found —");
  {
    // TikTok, YouTube handles, t.me and Threads are found since 11.10 (tests/forms_t.js); these were not
    const det = (t, subs = []) => new E.Engine(subs, [], OPT, t).detect(t);
    const sp = `https://firm-my.sharepoint.com/personal/adv_firm_co_il/Documents/${enc("לקוחות")}/${enc(NAME)}/x.docx`;
    const PASTED = [
      ["ראו את הסרטון https://youtu.be/abcdEFGhij3?si=XyZ125abc בדיון.", "https://youtu.be/abcdEFGhij3?si=XyZ125abc"],
      ["כתבו לה ב-https://wa.me/972527778888 בערב.", "https://wa.me/972527778888"],
      ["הקישור https://api.whatsapp.com/send?phone=972527779999 נשלח.", "https://api.whatsapp.com/send?phone=972527779999"],
      ["ההזמנה https://chat.whatsapp.com/AbCdEfGhIjK124 נשלחה.", "https://chat.whatsapp.com/AbCdEfGhIjK124"],
      ["הפרופיל fb.me/dana.sagi.92 פעיל.", "fb.me/dana.sagi.92"],
      [`התצהיר נשמר בכתובת ${sp} אתמול.`, sp],
      ["הקובץ ב-https://1drv.ms/w/s!AbcDef124 נשלח.", "https://1drv.ms/w/s!AbcDef124"],
      ["הקובץ ב-https://drive.google.com/file/d/1AbCdEfGhIjKlMnOq/view נשלח.", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOq/view"],
      ["המיקום https://maps.app.goo.gl/AbCdEf457 נשלח.", "https://maps.app.goo.gl/AbCdEf457"],
      ["הקבצים ב-https://we.tl/t-AbCdEf790 עד מחר.", "https://we.tl/t-AbCdEf790"],
    ];
    for (const [text, want] of PASTED) {
      const h = det(text).filter((x) => x.src === "pattern" && /^URL_/.test(x.type));
      ok(h.length === 1 && h[0].text === want && h[0].apply, `«${text.slice(0, 50)}…» — found «${h.map((x) => x.text).join(" | ")}», want «${want}», deleted`);
    }
    const { copy } = await run(pkg({ body: PASTED.map(([t]) => P(R(t))).join("") }), []);
    const still = PASTED.filter(([, w]) => copy.includes(w)).map(([, w]) => w);
    ok(!still.length, "none of them reaches the copied text: " + still.join(" | "));
    // a listed name inside an encoded address on an ordinary site, the only time she is named
    {
      const url = `https://files.example.org/docs/${enc(NAME)}.pdf`;
      const { res, copy: c } = await run(pkg({ body: P(R(`הקובץ נמצא בכתובת ${url} מאתמול.`)) }));
      ok(!readable(c).includes(NAME) && c.includes("https://files.example.org/docs/"), "a listed name inside an encoded address does not reach the AI, and the rest of the address stays: " + c);
      ok(res.applied.some((r) => (r.base || r.value) === NAME) && !nohit(res).includes(NAME), "she is found, and not reported «לא נמצא … לא מופיע במסמך הזה בכלל»: " + JSON.stringify(res.applied.map((r) => [r.value, r.base])));
    }
    {
      const { res, copy: c } = await run(pkg({ body: P(R(`התצהיר נשמר בכתובת ${sp} אתמול.`)) }));
      ok(!readable(c).includes(NAME) && !c.includes("sharepoint") && !nohit(res).includes(NAME), "the client's folder on SharePoint does not reach the AI, and the name inside it is not reported «לא נמצא»: " + c + " " + JSON.stringify(nohit(res)));
    }
    // counterexamples: a per-cent sign in ordinary Hebrew text is not an address
    for (const t of ["הריבית עלתה בשיעור של %50 מההכנסה.", "ההנחה היא 20% מהמחיר.", "שיעור %D7 הוא סימון פנימי בטבלה."]) {
      const { res, copy: c } = await run(pkg({ body: P(R(t)) }), []);
      ok(c.includes(t) && !res.applied.length, "stays as it is: " + t + " → " + c);
    }
  }

  console.log("\n— the list of links Word keeps in the file's properties —");
  {
    const app = `<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><HLinks><vt:vector size="6" baseType="variant"><vt:variant><vt:i4>3473470</vt:i4></vt:variant><vt:variant><vt:i4>0</vt:i4></vt:variant><vt:variant><vt:i4>0</vt:i4></vt:variant><vt:variant><vt:i4>5</vt:i4></vt:variant><vt:variant><vt:lpwstr>https://www.facebook.com/dana.sagi.93</vt:lpwstr></vt:variant><vt:variant><vt:lpwstr></vt:lpwstr></vt:variant></vt:vector></HLinks></Properties>`;
    const { res, out } = await run(pkg({ body: P(R(`${NAME} הגישה.`)), parts: [{ name: "docProps/app.xml", body: app }] }));
    ok(!leftIn(out, "dana.sagi.93").length && sound(res, out), "the copy of the link addresses in docProps/app.xml is emptied");
  }

  console.log("\n— what the review of the first round found (11.10) —");
  {
    const text = P(R(`המבקשת ${NAME} הגישה את הבקשה.`));
    // a link stored on an old-format picture or shape (VML href), in a compat-mode file and in a linked text box's fallback
    const pic = `<w:r><w:pict><v:shape id="Picture 1" type="#_x0000_t75" href="https://www.instagram.com/dana.sagi.88/" style="width:50pt;height:50pt"><v:imagedata o:title=""/></v:shape></w:pict></w:r>`;
    const r1 = await run(pkg({ body: text + P(pic) }));
    ok(!leftIn(r1.out, "dana.sagi.88").length && !badXml(r1.out).length, "a link on an old-format picture is cleaned: " + why(r1.res, r1.out));
    const box = `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="3" name="Text Box 3"><a:hlinkClick r:id="rIdH"/></wp:docPr><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:txbx><w:txbxContent>${P(R("הפרופיל"))}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>` +
      `<mc:Fallback><w:pict><v:shape id="Text Box 3" type="#_x0000_t202" href="https://www.facebook.com/dana.sagi.77" style="position:absolute"><v:textbox><w:txbxContent>${P(R("הפרופיל"))}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`;
    const r2 = await run(pkg({ body: text + P(box), docRels: [rel("rIdH", "https://www.facebook.com/dana.sagi.77")] }));
    ok(!leftIn(r2.out, "dana.sagi.77").length && !badXml(r2.out).length, "a linked text box: the link and its fallback copy are both cleaned: " + why(r2.res, r2.out));
    // a pasted picture keeps the temporary file it came from, with the Windows user name
    const img = `<w:r><w:pict><v:shape id="_x0000_i1026" type="#_x0000_t75" style="width:50pt;height:50pt"><v:imagedata src="file:///C:\\Users\\dana.sagi21\\Desktop\\scan.jpg" o:href="file:///C:\\Users\\dana.sagi22\\AppData\\Local\\Temp\\msohtmlclip1\\01\\clip_image002.png" o:title=""/></v:shape></w:pict></w:r>`;
    const r3 = await run(pkg({ body: text + P(img) }));
    ok(!leftIn(r3.out, "dana.sagi21").length && !leftIn(r3.out, "dana.sagi22").length && /clip_image002\.png/.test(r3.out["word/document.xml"]), "a pasted picture's paths keep only the file's name");
    // a mail merge keeps the full path of the clients' file
    const merge = '<w:mailMerge><w:mainDocumentType w:val="formLetters"/><w:linkToQuery/><w:dataType w:val="native"/>' +
      '<w:connectString w:val="Provider=Microsoft.ACE.OLEDB.12.0;User ID=Admin;Data Source=C:\\Users\\dana.sagi30\\Documents\\clients.xlsx;Mode=Read"/>' +
      '<w:query w:val="SELECT * FROM `C:\\Users\\dana.sagi31\\Documents\\clients.xlsx`.`Sheet1$`"/></w:mailMerge>';
    const r4 = await run(pkg({ body: text, parts: [{ name: "word/settings.xml", body: part("settings", merge) }] }));
    ok(!leftIn(r4.out, "dana.sagi30").length && !leftIn(r4.out, "dana.sagi31").length && !badXml(r4.out).length, "a mail merge's data source and query leave with the file, or keep only the file's name");
    // a HYPERLINK field keeps a binary copy of its address (w:fldData)
    const url = "https://www.facebook.com/dana.sagi.89";
    const b64 = Buffer.concat([Buffer.from([0xd0, 0xc9, 0xea, 0x79, 0xf9, 0xba, 0xce, 0x11]), Buffer.from(url + "\0", "utf16le")]).toString("base64");
    const f = `<w:r><w:fldChar w:fldCharType="begin"><w:fldData xml:space="preserve">${b64}</w:fldData></w:fldChar></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "${url}" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${R("הפרופיל")}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const r5 = await run(pkg({ body: text + P(f) }));
    const data = (r5.out["word/document.xml"].match(/<w:fldData[^>]*>([^<]*)</) || [])[1] || "";
    ok(!Buffer.from(data, "base64").toString("utf16le").includes("dana.sagi.89") && !instrOf(r5.out["word/document.xml"]).includes("dana.sagi.89"), "a link field's binary copy of the address goes with it");
    // an external link written without TargetMode (some tools write it so)
    const r6 = await run(pkg({ body: text + P(link("rIdN", "הפרופיל")), docRels: [rel("rIdN", "https://www.facebook.com/dana.sagi.78", false)] }));
    ok(!leftIn(r6.out, "dana.sagi.78").length && !badXml(r6.out).length, "an address link without TargetMode is cleaned too: " + why(r6.res, r6.out));
    // the listed name in another order, or joined by a dot, or with a direction mark as the only separator, inside an address
    for (const [what, u] of [
      ["surname first", "https://files.example.org/" + enc("שגיא_דנה") + ".pdf"],
      ["surname first, with %20", "https://files.example.org/" + enc("שגיא דנה") + ".pdf"],
      ["joined by a dot", "https://files.example.org/" + enc("דנה.שגיא") + ".pdf"],
      ["a direction mark between the names", "https://www.example.co.il/" + enc("דנה\u200fשגיא")],
    ]) {
      const r = await run(pkg({ body: text + P(link("rIdO", "הקובץ")), docRels: [rel("rIdO", u)] }));
      const rl = r.out["word/_rels/document.xml.rels"];
      ok(!/שגיא|דנה/.test(readable(rl)) && !badXml(r.out).length, `${what}, in a link: «${targetOf(rl, "rIdO")}»`);
      const t = await run(pkg({ body: text + P(R(`המסמך נשמר ב-${u} אתמול.`)) }));
      ok(!/שגיא|דנה/.test(readable(t.copy)), `${what}, typed in the text: «${t.copy.split("\n").pop()}»`);
    }
    // an e-mail with a + tag in a query: the + is part of the address, not a space
    const r7 = await run(pkg({ body: text + P(link("rIdQ", "צור קשר")), docRels: [rel("rIdQ", "https://www.example.co.il/c?email=dana.sagi+court@gmail.com&x=1")] }));
    ok(!leftIn(r7.out, "dana.sagi").length, "an e-mail with a + tag in a query is cleaned: «" + targetOf(r7.out["word/_rels/document.xml.rels"], "rIdQ") + "»");
    // the restore: an invented name written encoded inside an address comes back, encoded the same way
    const pseudoUrl = "https://files.example.org/docs/" + enc(REP) + ".pdf";
    const back = E.restoreNames(`הקובץ בכתובת ${pseudoUrl} מאתמול.`, [[NAME, REP]]);
    ok(back.text.includes("https://files.example.org/docs/" + enc(NAME) + ".pdf"), "an invented name encoded in an address is restored: «" + back.text + "»");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });

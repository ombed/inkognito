/* מנוע ההשחרה — הועבר כמו שהוא. אין כאן DOM. */
let nerSayFn=()=>{};
export const setNerSay=f=>{nerSayFn=f||(()=>{})};
const nerSay=(t,p)=>nerSayFn(t,p);
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;
  for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0}
async function pipe(u8,S,fmt){const s=new Blob([u8]).stream().pipeThrough(new S(fmt));
  return new Uint8Array(await new Response(s).arrayBuffer())}
const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");
const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");

async function unzip(buf){
  const dv=new DataView(buf),N=buf.byteLength;let e=-1;
  for(let i=N-22;i>=Math.max(0,N-66000);i--) if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0) throw new Error("הקובץ לא נראה כמו ‎.docx תקין");
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];
  for(let i=0;i<n;i++){
    if(dv.getUint32(p,true)!==0x02014b50) throw new Error("מבנה הקובץ פגום");
    const meth=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),
      nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),
      lo=dv.getUint32(p+42,true);
    const name=new TextDecoder().decode(new Uint8Array(buf,p+46,nl));
    const lnl=dv.getUint16(lo+26,true),lel=dv.getUint16(lo+28,true);
    const raw=new Uint8Array(buf,lo+30+lnl+lel,cs);
    out.push({name,meth,raw});p+=46+nl+el+cl;
  }
  for(const f of out) f.data = f.meth===0 ? raw2(f.raw) : await inflate(f.raw);
  return out;
}
const raw2=u=>new Uint8Array(u);
async function zip(files){
  const enc=new TextEncoder(),loc=[],cen=[];let off=0;
  for(const f of files){
    const nm=enc.encode(f.name),c=crc32(f.data);
    let body,meth=8;
    try{body=await deflate(f.data); if(body.length>=f.data.length){body=f.data;meth=0}}
    catch(_){body=f.data;meth=0}
    const h=new Uint8Array(30+nm.length),d=new DataView(h.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);
    d.setUint16(8,meth,true);d.setUint32(14,c,true);
    d.setUint32(18,body.length,true);d.setUint32(22,f.data.length,true);
    d.setUint16(26,nm.length,true);h.set(nm,30);
    loc.push(h,body);
    const ch=new Uint8Array(46+nm.length),cd=new DataView(ch.buffer);
    cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);
    cd.setUint16(8,0x800,true);cd.setUint16(10,meth,true);cd.setUint32(16,c,true);
    cd.setUint32(20,body.length,true);cd.setUint32(24,f.data.length,true);
    cd.setUint16(28,nm.length,true);cd.setUint32(42,off,true);ch.set(nm,46);
    cen.push(ch);off+=h.length+body.length;
  }
  const cs=cen.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array(22),ed=new DataView(end.buffer);
  ed.setUint32(0,0x06054b50,true);ed.setUint16(8,files.length,true);
  ed.setUint16(10,files.length,true);ed.setUint32(12,cs,true);ed.setUint32(16,off,true);
  return new Blob([...loc,...cen,end]);
}

/* ══════════════════════════ XML ══════════════════════════ */
const W="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XMLNS="http://www.w3.org/XML/1998/namespace";
const DEC='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const TXT=new TextDecoder(),ENC=new TextEncoder();
function rootTag(s){let i=0;
  while(i<s.length){const j=s.indexOf("<",i); if(j<0)return null;
    if(s[j+1]==="?"||s[j+1]==="!"){i=s.indexOf(">",j)+1;continue}
    let k=j+1,q=null;
    while(k<s.length){const c=s[k];
      if(q){if(c===q)q=null}else if(c==='"'||c==="'")q=c;else if(c===">")return s.slice(j,k+1);
      k++}
    return null}
  return null}
function parseXML(str){const d=new DOMParser().parseFromString(str,"application/xml");
  if(d.querySelector("parsererror")) throw new Error("XML פגום");return d}
function serXML(doc,orig){
  let out=new XMLSerializer().serializeToString(doc);
  const o=rootTag(orig),n=rootTag(out);
  if(o&&n&&!n.endsWith("/>")) out=o+out.slice(n.length);
  return DEC+out;
}
const TEXTPART=/^word\/(glossary\/)?(document\d*\.xml|header\d*\.xml|footer\d*\.xml|footnotes\.xml|endnotes\.xml)$/;
const DROP=["word/comments.xml","word/commentsExtended.xml","word/commentsIds.xml",
  "word/commentsExtensible.xml","word/people.xml","docProps/custom.xml","word/threadedComments.xml"];

/* ══════════════════════════ עברית ══════════════════════════ */
const NM={"\u05f3":"'","\u05f4":'"',"\u2018":"'","\u2019":"'","\u201c":'"',"\u201d":'"',
  "\u05be":"-","\u2010":"-","\u2011":"-","\u2012":"-","\u2013":"-","\u2014":"-",
  "\u00a0":" ","\u2007":" ","\u202f":" "};
/* \u05ea\u05d5\u05d5\u05d9\u05dd \u05e9\u05d4\u05e7\u05d5\u05e8\u05d0 \u05dc\u05d0 \u05e8\u05d5\u05d0\u05d4 (\u05d4\u05e6\u05d9\u05d3 \u05e9\u05dc 11.10): \u05de\u05e7\u05e3 \u05e8\u05da, \u05de\u05e6\u05d8\u05e8\u05e3 \u05de\u05d9\u05dc\u05d9\u05dd, BOM, \u05d5\u05e1\u05d9\u05de\u05e0\u05d9 \u05db\u05d9\u05d5\u05d5\u05df \u2014 \u05d1\u05d9\u05d3\u05d5\u05d3 (LRI/RLI/FSI/PDI),
   \u05d4\u05d8\u05d1\u05e2\u05d4 \u05d5\u05d4\u05d9\u05e4\u05d5\u05da (LRE\u2026RLO), ALM. \u05d9\u05d9\u05e6\u05d5\u05d0 \u05e9\u05dc \u05d5\u05d5\u05d8\u05e1\u05d0\u05e4 \u05d5\u05d8\u05e7\u05e1\u05d8 \u05e9\u05d4\u05d5\u05e2\u05ea\u05e7 \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d5\u05ea \u05e2\u05d5\u05d8\u05e4\u05d9\u05dd \u05d1\u05d4\u05dd \u05e9\u05de\u05d5\u05ea \u05d5\u05de\u05e1\u05e4\u05e8\u05d9\u05dd, \u05d5-Word \u05de\u05db\u05e0\u05d9\u05e1
   \u05de\u05e7\u05e3 \u05e8\u05da \u05d1\u05d0\u05de\u05e6\u05e2 \u05de\u05d9\u05dc\u05d4. \u05e2\u05d3 \u05db\u05d0\u05df \u05e8\u05e7 LRM, RLM \u05d5-ZWSP/ZWNJ/ZWJ \u05d4\u05d9\u05d5 \u05db\u05d0\u05df: \u05e9\u05dd \u05d1\u05e8\u05e9\u05d9\u05de\u05d4 \u05e9\u05d1\u05ea\u05d5\u05db\u05d5 \u05d0\u05d5 \u05e1\u05d1\u05d9\u05d1 \u05de\u05d9\u05dc\u05d5\u05ea\u05d9\u05d5 \u05d0\u05d7\u05d3 \u05de\u05d4\u05d0\u05d7\u05e8\u05d9\u05dd \u05dc\u05d0
   \u05e0\u05de\u05e6\u05d0, \u05d5\u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df \u05d0\u05d5 \u05ea"\u05d6 \u05e9\u05d1\u05ea\u05d5\u05db\u05dd \u05ea\u05d5 \u05db\u05d6\u05d4 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05d1\u05db\u05dc\u05dc \u2014 \u05d3\u05dc\u05d9\u05e4\u05d4 \u05de\u05ea\u05d7\u05ea \u05dc\u05e4\u05e1 \u05d9\u05e8\u05d5\u05e7. detect \u05e8\u05e5 \u05e2\u05dc \u05d4\u05d8\u05e7\u05e1\u05d8 \u05d1\u05dc\u05e2\u05d3\u05d9\u05d4\u05dd (squeeze).
   \u05d4\u05de\u05e7\u05e3 \u05d4\u05e2\u05d1\u05e8\u05d9 (U+05BE) \u05d9\u05e6\u05d0 \u05de\u05d8\u05d5\u05d5\u05d7 \u05d4\u05e0\u05d9\u05e7\u05d5\u05d3: \u05d4\u05d5\u05d0 \u05de\u05e7\u05e3, NM \u05de\u05de\u05d9\u05e8 \u05d0\u05d5\u05ea\u05d5 \u05dc-"-", \u05d5"\u05dc\u05d5\u05d9\u05be\u05d0\u05d1\u05e7\u05e1\u05d9\u05e1" \u05d4\u05d5\u05d0 "\u05dc\u05d5\u05d9-\u05d0\u05d1\u05e7\u05e1\u05d9\u05e1". */
const INVIS=/[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/;
const ZAP=/[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff\u0591-\u05bd\u05bf-\u05c7]/;
function norm(t){let o="";for(const c of t) o+= ZAP.test(c)?"\u0000":(NM[c]||c);return o}
// \u05d4\u05d8\u05e7\u05e1\u05d8 \u05d1\u05dc\u05d9 \u05d4\u05ea\u05d5\u05d5\u05d9\u05dd \u05d4\u05d1\u05dc\u05ea\u05d9 \u05e0\u05e8\u05d0\u05d9\u05dd, \u05d5\u05dc\u05db\u05dc \u05ea\u05d5 \u05d1\u05d5 \u05d4\u05de\u05d9\u05e7\u05d5\u05dd \u05e9\u05dc\u05d5 \u05d1\u05d8\u05e7\u05e1\u05d8 \u05d4\u05de\u05e7\u05d5\u05e8\u05d9 (pos[i]); null \u05db\u05e9\u05d0\u05d9\u05df \u05de\u05d4 \u05dc\u05d4\u05e1\u05d9\u05e8
function squeeze(t){
  if(!INVIS.test(t)) return null;
  let o=""; const pos=[];
  for(let i=0;i<t.length;i++){ if(INVIS.test(t[i]))continue; o+=t[i]; pos.push(i); }
  return {t:o,pos};
}
/* גבול מילה. גרש וגרשיים הם חלק ממילה רק כשהם צמודים לאות משני צדדיהם (עו"ד, ג'ורג') או
   אחרי אות בסוף מילה (ברקוביץ'). מירכאה שפותחת מילה אחרי רווח היא פיסוק: עד כאן ה-" שלפני
   "אלונים" נחשבה חלק מהמילה, ושם במירכאות לא נמצא ולא הוחלף בכלל — דליפה שקטה. אות שימוש אחת
   לפני המירכאה (ש"אלונים", ב"אלונים") היא עדיין פתיחת ציטוט; שתי אותיות לפניה (עו"ד) — ראשי תיבות. */
// אות עברית צמודה לספרה היא גבול בשני הכיוונים: "פרידמן2" (מספר הערת שוליים שהודבק) הוא השם,
// ו"ת"ז034567891" או "ביום14.3.2026" (בלי רווח) הם המספר. אות ליד אות, וספרה ליד ספרה, אינן
// גבול — אחרת מספר של עשר ספרות היה נתפס כת"ז בתשע הראשונות. אות לטינית צמודה חוסמת תמיד.
// אבל אות סופית (ך ם ן ף ץ) חותמת מילה: "פרידמןהגישה" ו"עםרחל" הן שתי מילים שהרווח ביניהן נשמט. בלי זה
// השם המלא לא נמצא, רק השם הפרטי הוחלף, ושם המשפחה האמיתי יצא ליד שם פרטי בדוי, בפס ירוק (הציד של 11.10).
const FIN="\\u05da\\u05dd\\u05df\\u05e3\\u05e5";
const HB="\\u0590-\\u05ff",NW=`(?<![A-Za-z])(?!(?<=[${HB}])(?<![${FIN}])[${HB}])(?!(?<=[0-9])[0-9])(?<![${HB}A-Za-z0-9][${HB}A-Za-z0-9]")(?<![${HB}A-Za-z0-9]')`,NWE=`(?![A-Za-z])(?!(?<=[${HB}])(?<![${FIN}])[${HB}])(?!(?<=[0-9])[0-9])(?!['"][${HB}A-Za-z0-9])`;
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
/* כתיב חסר ומלא של אותה מילה (הציד של 11.10): «קריית ביאליק» היא «קרית ביאליק», «פתח תקוה» היא «פתח תקווה»,
   «זיכרון יעקב» הוא «זכרון יעקב», «נוה» הוא «נווה». האות שבסוגריים יכולה לחסור. בלי זה כלל, "אל תחליפו"
   וזיהוי היישובים הכירו כתיב אחד, והשני יצא כמו שהוא. אות שימוש לפני המילה נשמרת ("בקריית"). אותה
   טבלה בונה את ביטוי היישובים (06-model.js) */
const SPELL=["קרי(י)ת","תקו(ו)ה","ז(י)כרון","נו(ו)ה"].map(p=>{
  const L=[...p.matchAll(/\((.)\)|(.)/gu)].map(m=>m[1]?{c:m[1],opt:true}:{c:m[2],opt:false});
  return {L,key:L.filter(x=>!x.opt).map(x=>x.c).join(""),
    rx:new RegExp("^([בהולמכש]{0,3})("+L.map(x=>x.c+(x.opt?"?":"")).join("")+")$","u")};
});
/* norm שומר אורך וממיר ניקוד ל-\0, ולכן תבנית שמרשה \0 בין אותיות תופסת "רוֹנִית" בלי לשבור את מיפוי
   המיקומים. רווח ומקף שקולים: "לוי-אבקסיס" ו"לוי אבקסיס" הם אותו אדם. המקף העברי הוא מקף כבר ב-norm (NM),
   ולכן "תל־אביב" נתפס בכלל של "תל אביב" בלי טיפול משלו כאן. מפריד הוא רווח או מקף, ו-\0 (סימן בלתי נראה)
   מותר סביבו; ניקוד שהוקלד בערך אינו מחייב ניקוד בטקסט */
const FLEX_SEP="\\u0000*[\\s-][\\s\\u0000-]*";
function flexWord(w){
  w=w.replace(/\u0000/g,"");
  const sp=SPELL.map(x=>[x,x.rx.exec(w)]).find(x=>x[1]);
  const t=sp?[...sp[1][1]].map(c=>({c,opt:false})).concat(sp[0].L):[...w].map(c=>({c,opt:false}));
  return t.map((x,i)=>x.opt?"(?:\\u0000*"+esc(x.c)+")?":(i?"\\u0000*":"")+esc(x.c)).join("");
}
const flex=s=>{
  const out=[];
  for(const p of norm(String(s)).split(/([\s-]+)/)){
    const sep=/^[\s-]+$/.test(p), src=sep?FLEX_SEP:flexWord(p);
    // מילה של סימנים בלתי נראים בלבד, או מפריד שני ברצף: אותו מפריד
    if(!src||(sep&&out[out.length-1]===FLEX_SEP))continue;
    out.push(src);
  }
  return out.join("");
};
const H=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
// ערכים בעברית מלאים בגרשיים (ת"ז, עו"ד) — אטריביוט חייב קידוד חזק יותר
const A=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const SING=["ה","ו","ב","ל","מ","כ","ש"];
const DBL=["וה","ול","וב","ומ","וכ","וש","שה","של","שב","שכ","שמ","כש","מה","לכ","בה"];
// protect: מחרוזות שאסור שווריאנט יתנגש בהן (שמות אחרים, יישובים)
function variants(name,lvl,protect){
  const out=[[name,""]]; if(lvl==="off") return out;
  const p=name.trim().split(/\s+/),head=p[0],tail=p.slice(1);
  if(!/^[\u05d0-\u05ea]/.test(head)) return out;
  const pre = lvl==="safe"?["ה","ו","ל","ב"]:SING.concat(DBL);
  const seen=new Set([name]);
  for(const x of pre){
    const v=[x+head].concat(tail).join(" ");
    if(seen.has(v))continue;
    // "רון" + ש = "שרון" — אדם אחר לגמרי. לא מייצרים התנגשות.
    if(protect&&protect.has(v))continue;
    seen.add(v);out.push([v,x]);
  }
  return out;
}
const MERGE=new Set(["ב","ל","כ","ה"]);
/* ב/ל/כ + ה' הידיעה מתמזגות ("ל+הבית" → "לבית"), אבל רק כשה-ה' היא ה' הידיעה. בשם
   יישוב או בשם של אדם היא חלק מהשם: "ברמת גן" → "ב"+"הרצליה" נתן "ברצליה" (L14 בביקורת
   השנייה), ו"להדס" היה נעשה "לדס". שם מוכר — יישוב, שם פרטי, שם מהמאגר — שומר את ה-ה'. */
function nameWithHe(rep){
  const r=norm(String(rep||"")).trim(), w=r.split(/\s+/)[0];
  return (typeof PLACE_BY!=="undefined"&&!!(PLACE_BY[r]||PLACE_BY[w]))||
    (typeof KNOWN_FIRST!=="undefined"&&KNOWN_FIRST.has(w))||
    (typeof POOL!=="undefined"&&Object.values(POOL).some(a=>a.includes(w)));
}
function addPre(pre,rep){ if(!pre)return rep; if(!rep)return pre;
  if(rep[0]==="ה"&&MERGE.has(pre[pre.length-1])&&!nameWithHe(rep)) return pre+rep.slice(1);
  return pre+rep}
/* תאריך מוזז (Q5 בגרסה 3). תאריך שנמחק הוציא מה-AI "חסר תאריך ההחלטה"; תווית לא
   נותנת לו לחשב פרקי זמן. לכן כל תאריך מלא במסמך זז באותו מספר ימים — ההיסט
   נגזר מהמסמך (30–400 יום) ולכן יציב בין הרצות, המרווחים והסדר נשמרים, וההחזרה
   מחזירה כל תאריך למקורו כמו שם. הפורמט נשמר: אותו מפריד, אותו רוחב שנה. */
/* שנה בשתי ספרות: 20xx עד עשר שנים קדימה, ואחרת 19xx. עד כאן תמיד 20xx, ותאריך לידה מוזז "8.10.95"
   שה-AI כתב "8.10.1995" או "8 באוקטובר 1995" נשאר מוזז בתשובה (ביקורת, 6.10). fakeDate ו-dateParts. */
function fullYear(s){
  const n=+s; if(String(s).length!==2)return n;
  return 2000+n<=new Date().getUTCFullYear()+10?2000+n:1900+n;
}
/* כל כתיב רגיל של תאריך, ומה שצריך כדי לכתוב תאריך מוזז באותו כתיב: "12.3.2026", "12-03-26",
   "2026-03-12", "12 במרץ 2026" (גם ל, בלי אות, פסיק, מרס), ובלי שנה — "12.3", "12 במרץ". עד כאן רק
   תאריך מספרי עם שנה היה תאריך, ו"12 במרץ 2026" או "ביום 12.3" הגיעו ל-AI אמיתיים (הבעלים, 9.10, בדוגמה
   שבדף הבית). תאריך בלי שנה נבדק מול שנה מעוברת, כדי ש-29.2 יהיה תאריך. null: אינו תאריך אמיתי. */
const DATE_MONTHS=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
/* ועוד (הציד של 11.10): "מארס", חודש מקוצר עם גרש או נקודה כמו בלוח של המחשב ("ספט׳", "ספט'", "ספט."; למרץ, מאי,
   יוני ויולי אין קיצור), "12 לחודש מרץ 2026", "12 בחודש מרץ, שנת 2026", רווח אחרי הנקודות ("12. 3. 2026"), וחודש
   ושנה בלי יום ("מרץ 2026", "03/2026"). כל אלה הגיעו ל-AI אמיתיים, אף שהעזרה מבטיחה שכל תאריך זז */
const DATE_ABBR=["ינו","פבר","","אפר","","","","אוג","ספט","אוק","נוב","דצמ"];
const DATE_MON_ALT="ינואר|פברואר|מרץ|מרס|מארס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|(?:ינו|פבר|אפר|אוג|ספט|אוק|נוב|דצמ)['.]";
function dateMonth(tok){
  if(/^(?:מרץ|מרס|מארס)$/.test(tok))return 3;
  const i=DATE_MONTHS.indexOf(tok); if(i>=0)return i+1;
  const a=/^(.+)['.]$/.exec(tok); return a&&a[1]&&DATE_ABBR.includes(a[1])?DATE_ABBR.indexOf(a[1])+1:0;
}
// החודש המוזז נכתב כמו שהמסמך כתב את החודש: מקוצר באותו סימן, ומרץ באותו כתיב
function monthWord(mo,p){
  if(p.ab&&DATE_ABBR[mo-1])return DATE_ABBR[mo-1]+p.ab;
  return mo===3&&p.mar?p.mar:DATE_MONTHS[mo-1];
}
// בלי שנה: שנה רגילה, ושנה מעוברת רק ל-29.2
const dateRefYear=p=>p.m===2&&p.d===29?2024:2025;
function parseDate(s){
  const raw=String(s||""), t=norm(raw).replace(/\u0000/g,"").trim(), lead=x=>x.length===2&&x[0]==="0";
  // הגרש של הקיצור כמו שנכתב (׳ או '), כי norm מאחד אותם
  const style=tok=>({ab:/\.$/.test(tok)?".":/'$/.test(tok)?((/[\u05f3\u2019']/.exec(raw)||["'"])[0]):null,mar:/^(?:מרס|מארס)$/.test(tok)?tok:null});
  let m,p=null;
  if((m=/^(\d{1,2})([./-])( ?)(\d{1,2})(?:\2( ?)(\d{4}|\d{2}))?$/.exec(t))&&(m[6]||(m[2]!=="-"&&!m[3])))
    p={d:+m[1],m:+m[4],y:m[6]?fullYear(m[6]):null,form:"num",sep:m[2],g1:m[3],g2:m[5]||"",y2:!!m[6]&&m[6].length===2,pd:lead(m[1]),pm:lead(m[4])};
  else if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)))
    p={d:+m[3],m:+m[2],y:+m[1],form:"iso",pd:m[3].length===2,pm:m[2].length===2};
  else if((m=new RegExp("^(\\d{1,2})(\\s*)([בל]חודש\\s+|[בל]?-?)("+DATE_MON_ALT+")(?:(,?\\s*(?:ב?שנת\\s+)?)(\\d{4}))?$").exec(t)))
    p={d:+m[1],m:dateMonth(m[4]),y:m[6]?+m[6]:null,form:"words",sp:m[2],conn:m[3],yc:m[5]||"",...style(m[4])};
  else if((m=new RegExp("^("+DATE_MON_ALT+")(,?\\s+(?:ב?שנת\\s+)?)(\\d{4})$").exec(t)))
    p={d:null,m:dateMonth(m[1]),y:+m[3],form:"mwords",yc:m[2],...style(m[1])};
  else if((m=/^(\d{1,2})([./-])(\d{4})$/.exec(t)))
    p={d:null,m:+m[1],y:+m[3],form:"mnum",sep:m[2],pm:lead(m[1])};
  if(!p||p.m<1||p.m>12)return null;
  if(p.d==null)return p;
  if(p.d<1||p.d>31)return null;
  const c=new Date(Date.UTC(p.y??dateRefYear(p),p.m-1,p.d));
  return c.getUTCDate()===p.d&&c.getUTCMonth()===p.m-1?p:null;
}
/* הערך המוזז: יום בימים; חודש ושנה בלי יום בחודשים שלמים, הכי קרוב שאפשר לאותו מספר ימים, כדי שהמרווח
   בין שני חודשים במסמך יישמר בדיוק */
function shiftDate(p,off){
  if(p.d==null){const i=p.y*12+p.m-1+Math.round(off/30.4375); return {d:null,m:i%12+1,y:Math.floor(i/12)}}
  const t=new Date(Date.UTC(p.y??dateRefYear(p),p.m-1,p.d));
  t.setUTCDate(t.getUTCDate()+off);
  return {d:t.getUTCDate(),m:t.getUTCMonth()+1,y:p.y==null?null:t.getUTCFullYear()};
}
function fakeDate(s,offDays){
  const p=parseDate(s);
  if(!p)return null;
  const {d,m:mo,y}=shiftDate(p,offDays|0), z=(n,pad)=>pad&&n<10?"0"+n:String(n);
  if(p.form==="mwords")return monthWord(mo,p)+p.yc+y;
  if(p.form==="mnum")return z(mo,p.pm)+p.sep+y;
  if(p.form==="iso")return `${y}-${z(mo,p.pm)}-${z(d,p.pd)}`;
  if(p.form==="words")return d+p.sp+p.conn+monthWord(mo,p)+(p.y==null?"":p.yc+y);
  const dm=z(d,p.pd)+p.sep+p.g1+z(mo,p.pm);
  return p.y==null?dm:dm+p.sep+p.g2+(p.y2?String(y%100).padStart(2,"0"):String(y));
}
function validID(s){const d=s.replace(/\D/g,"");if(!d||d.length>9)return false;
  if(/^0+$/.test(d)||/^(\d)\1+$/.test(d))return false;
  const p=d.padStart(9,"0");let t=0;
  for(let i=0;i<9;i++){let n=+p[i]*(i%2?2:1);t+=n<10?n:n-9}return t%10===0}
function ibanOK(s){
  const t=s.replace(/\s/g,"").toUpperCase();
  if(!/^IL\d{21}$/.test(t))return false;
  const r=t.slice(4)+t.slice(0,4);
  let m=0; for(const c of r){
    const v=/\d/.test(c)?c:String(c.charCodeAt(0)-55);
    for(const d of v) m=(m*10+ +d)%97;
  }
  return m===1;
}
// כמה ספרות יש במספר שנמצא, וחלוקה שאינה שנה. אחרי תווית כמו «חשבון» או «תיק», ארבע ספרות שהן
// שנה (2025) אינן מספר מזהה
function digitsIn(lo,hi){return s=>{const n=s.replace(/\D/g,"").length;return n>=lo&&n<=hi}}
function notYear(s){const m=/(\d[\d/-]*\d)\s*$/.exec(s);const d=m?m[1]:"";return !/^(19|20)\d\d$/.test(d)&&d.replace(/\D/g,"").length>=3}
function luhn(s){const d=s.replace(/\D/g,"");if(d.length<12||d.length>19)return false;
  let t=0,a=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];
    if(a){n*=2;if(n>9)n-=9}t+=n;a=!a}return t%10===0}
const G_ONE=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
const G_TEN=["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
const G_HUN=["","ק","ר","ש","ת"];
function hord(n){
  if(n<1||n>=500)return "\u200f"+n+"\u200f";
  let r=n,out=G_HUN[Math.floor(r/100)]||""; r%=100;
  if(r===15)out+="טו"; else if(r===16)out+="טז";
  else {out+=G_TEN[Math.floor(r/10)]; out+=G_ONE[r%10];}
  return out.length>1 ? out.slice(0,-1)+'"'+out.slice(-1) : out+"׳";
}
/* ══════════ שמות חלופיים ריאליים ══════════
   הכינוי "פלוני א׳" מעביר את עומס החשיבה למשתמש: הוא עדיין צריך להחליט
   מה לכתוב כדי שהטקסט ייקרא. כאן נבחר שם אמיתי — נשמר המגדר, נשמר מספר
   המילים, ונשמר מוצא השם, כדי שהמשפט יישאר תקין דקדוקית וטבעי לקריאה.
   הבחירה דטרמיניסטית: אותו אדם יקבל את אותו שם גם במסמך הבא באותו תיק,
   גם בלי לטעון פרופיל. */
const POOL={
 he_f:["שירה","נועה","תמר","יעל","מיכל","רחל","אסתר","מרים","דנה","ליאת","אורית","סיגל",
  "איריס","ורד","גלית","מאיה","ענת","הילה","אביגיל","לימור","קרן","אפרת","אורלי","סמדר",
  "מירב","טליה","נעמי","שלומית","יהודית","רבקה","חנה","בתיה","אילנה","זהבה","פנינה",
  "אביבה","גילה","חוה","נורית","רותי","עינת","שירן","מוריה","תהילה","יפעת","הדס","נגה",
  "אלינור","רוני","שקד","עדן","נטלי","אנה","סבטלנה","אירינה","לודמילה","אולגה"],
 he_m:["אורי","יואב","איתי","נדב","רועי","גיא","אסף","ניר","עידו","אלון","יונתן","דור",
  "עמית","ליאור","אייל","ברק","זיו","יובל","ארז","גלעד","חיים","משה","יעקב","יוסף","דוד",
  "שמואל","אברהם","יצחק","מרדכי","נתן","שלמה","אליהו","בנימין","ראובן","שמעון","אשר",
  "דניאל","מיכאל","איתמר","עמרי","יהונתן","רותם","עידן","תומר","אמיר","נועם","אלירן",
  "שלומי","אבנר","מאיר","ציון","יגאל","בועז","אלכס","סרגיי","ולדימיר","דמיטרי"],
 he_s:["כהן","לוי","מזרחי","פרץ","ביטון","דהן","פרידמן","שפירא","אזולאי","אוחיון","גבאי",
  "אמסלם","חדד","עמר","בן-דוד","אשכנזי","טולדנו","סבן","אלמוג","ברקוביץ","רוזנברג",
  "גולדשטיין","וייס","קליין","שטרן","הרשקוביץ","זילברמן","אדלר","פלדמן","ברנשטיין",
  "גרינברג","לנדאו","שגב","ארבל","ברנע","גלעדי","אלבז","סויסה","ממן","אטיאס","בן-חמו",
  "נחמיאס","הראל","רוזן","שמעוני","בר-און","קרמר","וקנין","אבוטבול","מלמד","יעקובי",
  "פישר","קפלן","גורביץ","סלומון","נחום","דורון","אלקבץ","טל-שחר","בן-עמי","רווה"],
 ar_f:["פאטמה","עאישה","מריאם","נור","לילא","סמאח","רנא","הודא","אמל","סועאד","ראניה",
  "דלאל","נאדיה","סאלי","וורוד","הנאא","מנאל","ראידה","עביר","ג'ומאנה","סחר","ריהאם"],
 ar_m:["מוחמד","אחמד","עלי","חסן","חוסיין","מחמוד","ראמי","סמיר","ג'מאל","ח'אלד","יוסוף",
  "איברהים","מוסטפא","נביל","ואאל","זיאד","בילאל","טארק","עאדל","מאהר","פאדי","רמזי"],
 ar_s:["ח'טיב","מנצור","זועבי","סרסור","חמדאן","נאסר","סלימאן","דרוויש","עוואד","טאהא",
  "ג'בארין","אגבאריה","מסארווה","ותד","בדראן","שאהין","קאסם","זידאן","עבד אל-האדי",
  "אבו-ראס","אבו-סאלח","חלאילה","גנאים","עאזם","נסאר","דבור","סעדי","חוסארי"]};
const AR_HINT=new Set(["אבו","אל","עבד","בן-עלי","אבן"]);
/* שמות פרטיים שהם גם מילים. "חיים כהן" הוא אדם, אבל "החיים שלו נהרסו"
   היא מילה, ו"נתן" הוא פועל. חלק כזה של שם לא מוחלף עם אותיות שימוש,
   לא נבחר כשם בדוי, ולא מוחזר מתשובת AI כשהוא עומד לבד. */
const WORDLIKE=new Set(("חיים שלום אור גיל דור ברק שחר אביב עמית נועם טל רון "+
 "יובל גיא ורד שירה שיר מור פנינה מלכה תקווה אמונה שמחה אושר נחת ציון ניר "+
 "אלון ארז רותם עידן אמיר זיו אלמוג רווה הראל ארבל דורון נגה עדן שקד הדס "+
 "תהילה הילה קרן סיגל איריס נורית גילה זהבה חן שי בר לב שדה הר נחל דקל תמר "+
 "רימון אורן מאיר יפה טוב ברכה גאולה דוד דן נתן ברוך יונה רם ניצן עדי אמת "+
 "חסד רחמים צדק אלי יאיר ירון יריב ידיד יקיר יגאל יעל אילן אילה איל צבי "+
 "צביה זאב אריה דב נמר נחמה אורי אסף ידין רועי רוני לירון לירז נועה נעם "+
 "שלמה עמוס אביה אביחי אביטל אבנר אדיר אופיר אורית אלעד אליה אמונה גלית "+
 "דליה דפנה הדר חגי חגית טליה יהלי ליאור לילך מוריה מעיין נטע סתיו ספיר "+
 "עומר עופר עמרי ענבל ענת פז צופיה קשת רז רינה רננה שגב שגיא שחף שלו שני "+
 "תום תמיר").split(/\s+/));
const AR_NAMES=new Set([...POOL.ar_f,...POOL.ar_m,...POOL.ar_s,"מוחמד","אחמד","מחמד",
 "עומאר","סאלח","ג'מיל","נאדר","איאד","ריאד","סועאד","אימאן","ח'ליל","נעים","רימא"]);
const FEM=new Set(POOL.he_f.concat(POOL.ar_f,["שרון","דליה","נירית","מיטל","ליהי","סתיו",
 "שירלי","אורנה","אתי","ציפורה","נאוה","סימה","רוחמה","שושנה","לאה","דבורה","צילה",
 "פרידה","רוזה","קלרה","ויקטוריה","מרינה","ליאורה","תמי","הודיה","אביטל","מעיין",
 "ספיר","שירז","מיטל","אביגייל","רעות","שירלין","ברכה","גאולה","יעלה"]));
const MASC=new Set(POOL.he_m.concat(POOL.ar_m));
function origin(v){
  const w=v.split(/[\s-]+/);
  if(w.some(x=>AR_HINT.has(x)||AR_NAMES.has(x)))return "ar";
  if(/[ח'ג'ת'ד'ז']/.test(v)&&/'/.test(v))return "ar";
  return "he"}
// המגדר נקבע קודם כל לפי מה שכתוב במסמך ("הנתבעת", "גב'"), ורק אחר כך
// לפי השם עצמו. סיומת ה' היא ניחוש אחרון, לא כלל.
// שמות זכר שנגמרים ב-ה': הכלל "ה' בסוף = נקבה" הפך את נריה, משה ויהודה לנשים
const MALE_HE=new Set(["משה","אריה","יהודה","שלמה","עובדיה","נחמיה","זכריה","ירמיה","אליה","אוריה","נריה","עזריה","טוביה","שמריה","ידידיה","יונה","עוזיה","חזקיה","ישעיה","גדליה","שמעיה","מיכה","נתניה","רפאה","אלישע","יהושע","הושע","אלקנה","מנשה","מתתיהו","עמיחי","יחיא","מוסא","עיסא","מוחמד","ג'ומעה","עטיה","עוואד"]);
function gender(v,hint){
  if(hint==="f"||hint==="m")return hint;
  const first=v.trim().split(/\s+/)[0];
  if(FEM.has(first))return "f";
  if(MASC.has(first)||MALE_HE.has(first))return "m";
  // סיומת -יה (נריה, עזריה) היא תאופורית וזכרית; -ית/-את/-ה אחרת נקבית
  if(/יה$/.test(first)&&first.length>=4)return "m";
  // שם בן שלוש אותיות שמסתיים ב-ה ("ליה", "גלה") נקבי כמו שם ארוך ממנו (סבב QA 1, M2); שם
  // זכרי קצר ב-ה ("משה") יושב ברשימות ומוכרע למעלה
  if(/(?:ית|את|ה)$/.test(first)&&first.length>=3)return "f";
  return "m"}
function hash32(s){let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}
  return h>>>0}
/* שם בדוי שהוא גם מילה בטקסט רגיל — לבד, או אחרי אות שימוש — לא נבחר (הציד של 11.10). ה-AI כותב את המילה במובן
   הרגיל שלה, וההחזרה שמה שם את השם האמיתי של הלקוח: «השופטת דנה בבקשה» (דנה, פועל), «מליאת הכנסת», «שרותי בריאות»,
   «לעשות את מירב המאמצים». הרשימה נמדדה בקורפוס חדשות עברי ציבורי (49,700 משפטים, רק ספירות): שם שמופיע כמילה מחוץ
   לכל ישות לפחות 5 פעמים, או אחרי אות שימוש לפחות 10, ואינו שם פי כמה יותר משהוא מילה; ונבדקה בעין. שם משפחה כפול
   שאחד מחלקיו מילה («בן-דוד» הוא בן דוד) לא נבחר גם הוא */
const WORDISH=new Set(["יהודית","מיכל","ממן","חנה","מזרחי","איתי","פרץ","דנה","מרים","ליאת","מלמד","מירב","עמי","רותי"]);
const poolWordy=v=>WORDISH.has(v)||WORDLIKE.has(v)||STOP.has(v)||(typeof COMMON!=="undefined"&&COMMON.has(v))||(typeof VRB!=="undefined"&&VRB.has(v));
/* השם הבדוי באותיות לטיניות (הציד של 11.10): אדם שנכתב גם בלועזית ("קלייר דובואה-לוי (Claire Dubois-Levi)") מקבל את
   האיות הלועזי של אותו שם בדוי ("אנה גולדשטיין (Ana Goldstein)"), כדי שה-AI יקרא אדם אחד. לכל שם במאגר האיות המקובל;
   לכל מילה אחרת (תחליף שהקלידה, תווית) תעתיק לפי האותיות */
const LATIN=Object.fromEntries(("שירה Shira|נועה Noa|תמר Tamar|יעל Yael|מיכל Michal|רחל Rachel|אסתר Esther|מרים Miriam|דנה Dana|ליאת Liat|"+
  "אורית Orit|סיגל Sigal|איריס Iris|ורד Vered|גלית Galit|מאיה Maya|ענת Anat|הילה Hila|אביגיל Avigail|לימור Limor|קרן Keren|אפרת Efrat|"+
  "אורלי Orly|סמדר Smadar|מירב Merav|טליה Talya|נעמי Naomi|שלומית Shlomit|יהודית Yehudit|רבקה Rivka|חנה Hana|בתיה Batya|אילנה Ilana|"+
  "זהבה Zehava|פנינה Pnina|אביבה Aviva|גילה Gila|חוה Hava|נורית Nurit|רותי Ruti|עינת Einat|שירן Shiran|מוריה Moriya|תהילה Tehila|"+
  "יפעת Yifat|הדס Hadas|נגה Noga|אלינור Elinor|רוני Roni|שקד Shaked|עדן Eden|נטלי Natalie|אנה Anna|סבטלנה Svetlana|אירינה Irina|"+
  "לודמילה Ludmila|אולגה Olga|"+
  "אורי Uri|יואב Yoav|איתי Itai|נדב Nadav|רועי Roi|גיא Guy|אסף Asaf|ניר Nir|עידו Ido|אלון Alon|יונתן Yonatan|דור Dor|עמית Amit|"+
  "ליאור Lior|אייל Eyal|ברק Barak|זיו Ziv|יובל Yuval|ארז Erez|גלעד Gilad|חיים Haim|משה Moshe|יעקב Yaakov|יוסף Yosef|דוד David|"+
  "שמואל Shmuel|אברהם Avraham|יצחק Yitzhak|מרדכי Mordechai|נתן Natan|שלמה Shlomo|אליהו Eliyahu|בנימין Binyamin|ראובן Reuven|"+
  "שמעון Shimon|אשר Asher|דניאל Daniel|מיכאל Michael|איתמר Itamar|עמרי Omri|יהונתן Yehonatan|רותם Rotem|עידן Idan|תומר Tomer|"+
  "אמיר Amir|נועם Noam|אלירן Eliran|שלומי Shlomi|אבנר Avner|מאיר Meir|ציון Zion|יגאל Yigal|בועז Boaz|אלכס Alex|סרגיי Sergei|"+
  "ולדימיר Vladimir|דמיטרי Dmitri|"+
  "כהן Cohen|לוי Levi|מזרחי Mizrahi|פרץ Peretz|ביטון Biton|דהן Dahan|פרידמן Friedman|שפירא Shapira|אזולאי Azoulay|אוחיון Ohayon|"+
  "גבאי Gabay|אמסלם Amsalem|חדד Hadad|עמר Amar|בן Ben|אשכנזי Ashkenazi|טולדנו Toledano|סבן Saban|אלמוג Almog|ברקוביץ Berkowitz|"+
  "רוזנברג Rosenberg|גולדשטיין Goldstein|וייס Weiss|קליין Klein|שטרן Stern|הרשקוביץ Hershkowitz|זילברמן Silberman|אדלר Adler|"+
  "פלדמן Feldman|ברנשטיין Bernstein|גרינברג Greenberg|לנדאו Landau|שגב Segev|ארבל Arbel|ברנע Barnea|גלעדי Giladi|אלבז Elbaz|"+
  "סויסה Suissa|ממן Maman|אטיאס Attias|חמו Hamo|נחמיאס Nahmias|הראל Harel|רוזן Rosen|שמעוני Shimoni|בר Bar|און On|קרמר Kramer|"+
  "וקנין Vaknin|אבוטבול Abutbul|מלמד Melamed|יעקובי Yaakobi|פישר Fischer|קפלן Kaplan|גורביץ Gurevich|סלומון Salomon|נחום Nahum|"+
  "דורון Doron|אלקבץ Alkabetz|טל Tal|שחר Shahar|עמי Ami|רווה Raveh|"+
  "פאטמה Fatma|עאישה Aisha|מריאם Mariam|נור Nour|לילא Laila|סמאח Samah|רנא Rana|הודא Huda|אמל Amal|סועאד Suad|ראניה Rania|דלאל Dalal|"+
  "נאדיה Nadia|סאלי Sally|וורוד Wurud|הנאא Hanaa|מנאל Manal|ראידה Raida|עביר Abeer|ג'ומאנה Jumana|סחר Sahar|ריהאם Riham|"+
  "מוחמד Muhammad|אחמד Ahmad|עלי Ali|חסן Hassan|חוסיין Hussein|מחמוד Mahmoud|ראמי Rami|סמיר Samir|ג'מאל Jamal|ח'אלד Khaled|"+
  "יוסוף Yousef|איברהים Ibrahim|מוסטפא Mustafa|נביל Nabil|ואאל Wael|זיאד Ziad|בילאל Bilal|טארק Tarek|עאדל Adel|מאהר Maher|פאדי Fadi|"+
  "רמזי Ramzi|ח'טיב Khatib|מנצור Mansour|זועבי Zoabi|סרסור Sarsour|חמדאן Hamdan|נאסר Nasser|סלימאן Suleiman|דרוויש Darwish|"+
  "עוואד Awad|טאהא Taha|ג'בארין Jabarin|אגבאריה Agbaria|מסארווה Masarwa|ותד Watad|בדראן Badran|שאהין Shahin|קאסם Qasem|זידאן Zidan|"+
  "עבד Abd|אל al|האדי Hadi|אבו Abu|ראס Ras|סאלח Saleh|חלאילה Halaila|גנאים Ghanaim|עאזם Azem|נסאר Nassar|דבור Dabour|סעדי Saadi|"+
  "חוסארי Husari|פלוני Ploni|פלונית Plonit|אלמוני Almoni").split("|").map(p=>p.split(" ")));
// תעתיק לפי האותיות, למילה שאינה במאגר: עיצור בראש המילה, אם קריאה באמצע (ו, י) כתנועה, ו-a בין שני עיצורים
const TR={"א":"a","ב":"v","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"ch","ט":"t","י":"y","כ":"ch","ך":"ch","ל":"l","מ":"m","ם":"m",
  "נ":"n","ן":"n","ס":"s","ע":"a","פ":"f","ף":"f","צ":"tz","ץ":"tz","ק":"k","ר":"r","ש":"sh","ת":"t"},
  TR0={"ב":"b","כ":"k","פ":"p","ו":"v","י":"y"}, TRJ={"ג":"j","ז":"zh","צ":"ch","ח":"kh"};
function translit(w){
  const s=w.replace(/[׳’]/g,"'").replace(/["״]/g,""); let out="", prevC=false;
  for(let i=0;i<s.length;i++){
    const c=s[i], nx=s[i+1];
    if(nx==="'"&&TRJ[c]){out+=TRJ[c];i++;prevC=true;continue}
    if(c==="'")continue;
    if(!TR[c]){out+=c;prevC=false;continue}
    const end=i===s.length-1;
    if(i>0&&(c==="ו"||c==="י")&&nx!==c&&s[i-1]!==c){out+=c==="ו"?"o":"i";prevC=false;continue}
    if(end&&c==="ה"){out+="a";prevC=false;continue}
    if(c==="א"||c==="ע"){out+=i===0?"a":(prevC?"a":"");prevC=false;continue}
    const t=i===0?(TR0[c]||TR[c]):TR[c];
    out+=(prevC?"a":"")+t; prevC=true;
  }
  return out.charAt(0).toUpperCase()+out.slice(1);
}
// אות סידורית של תווית ("פלוני א׳"): האות הלטינית במקומה בא"ב
const HORD_LAT={"א":"A","ב":"B","ג":"C","ד":"D","ה":"E","ו":"F","ז":"G","ח":"H","ט":"I","י":"J","כ":"K","ל":"L","מ":"M","נ":"N","ס":"O","ע":"P","פ":"Q","צ":"R","ק":"S","ר":"T","ש":"U","ת":"V"};
function latinOf(s){
  return String(s||"").replace(/[א-ת][א-ת'׳"״-]*/g,w=>{
    const one=/^([א-ת])['׳]$/.exec(w); if(one)return HORD_LAT[one[1]]||translit(w);
    return w.split("-").map(p=>LATIN[p.replace(/׳/g,"'")]||translit(p)).join("-")})}
function pickFrom(arr,seed,used,forbidden){
  const n=arr.length;
  for(let k=0;k<n;k++){
    const v=arr[(seed+k*7+((seed>>>8)%3))%n];
    if(used.has(v)||forbidden.has(v)||WORDLIKE.has(v))continue;
    if(WORDISH.has(v)||(/-/.test(v)&&v.split("-").some(poolWordy)))continue;
    if(typeof PLACE_BY!=="undefined"&&PLACE_BY[v])continue;
    if(STOP.has(v))continue;
    return v}
  return arr[seed%n]+" "+((seed%89)+11)}
// שם פרטי לבד או שם משפחה לבד — נשמר אותו סוג, אחרת "כהן" הופך ל"יעל"
// והמשפט "מר כהן טען" נשבר.
// סיומות של שם משפחה: מילה בודדת כזאת מקבלת שם משפחה בדוי גם בלי ראיה אחרת
const SUR_SUFFIX=/(?:וביץ|ביץ|ביץ'|סקי|סקה|ברג|בורג|שטיין|שטין|צקי|נסקי|ינסקי|ובסקי|ייב|ייבה|וביץ')$/;
/* גופים. עד כאן גוף שאושר קיבל "[גוף א׳]" — תווית בתוך המשפט, שמכריזה שהוסתר
   משהו ומבלבלת את ה-AI ("חסידי [גוף ב׳]"). ההבחנה, בכללים ולא ברשימה סגורה:

   קבוצה רחבה שאינה מזהה — חסידות, תנועה, מפלגה, זרם, עדה, קהילה — נשארת כמו
   שהיא; אלפי חברים אינם אדם אחד. מוסד ספציפי — מכון, מרפאה, עמותה, בית ספר,
   פנימייה, ישיבה, חברה, קרן, מרכז, גן — מקבל שם בדוי שמשאיר את מילת הסוג, כדי
   שה-AI עדיין יידע שהוא קורא על מכון. גוף בלי אף אחת משתי הראשים עולה לבדיקה. */
const GROUP_HEADS=/^(?:חסידי|חסידות|חסידת|תנועת|מפלגת|זרם|עדת|קהילת|ארגון\s+ה)/u;
const ORG_HEADS=/^(?:עמותת|עמותה|מכון|חברת|חברה|בית\s+ספר|בי"ס|ביה"ס|בית\s+הספר|מרכז|אגודת|אגודה|קרן|מוסד|גן|מעון|פנימיית|פנימייה|ישיבת|ישיבה|קופת\s+חולים|בנק|מרפאת|מרפאה|בית\s+חולים|ביה"ח|מכללת|אוניברסיטת|תיכון|חטיבת|מתנ"ס|בית\s+אבות|מועדון|סניף|קבוצת)(?=\s|$)/u;
const ORG_TAILS=["אורנים","הגפן","שקד","נווה","הרימון","תמר","ארז","הדס","אלון","ברוש","נטע","גלים","אופק","דקל","צבר","הזית","סביון","יובל","עמית","רקפת"];
function orgHead(v){ const m=ORG_HEADS.exec(norm(v).trim()); return m?m[0]:null; }
function fakeOrg(value,used,forbidden){
  const head=orgHead(value);
  const seed=hash32(norm(value).trim());
  const raw=value.trim().split(/\s+/);
  const headWords=head?head.split(/\s+/).length:0;
  const pre=head?raw.slice(0,headWords).join(" "):"";
  for(let k=0;k<ORG_TAILS.length;k++){
    const tail=ORG_TAILS[(seed+k)%ORG_TAILS.length];
    const cand=pre?pre+" "+tail:tail;
    if(used&&used.has(cand))continue;
    if(forbidden&&forbidden.has(norm(tail)))continue;
    return cand;
  }
  return null;
}
function fakeName(value,hint,used,forbidden,firstish){
  const org=origin(value), g=gender(value,hint);
  const parts=value.trim().split(/\s+/);
  const seed=hash32(norm(value).trim());
  const firsts=POOL[org+"_"+(g==="f"?"f":"m")], surs=POOL[org+"_s"];
  if(parts.length===1){
    // מילה אחת: שם פרטי כשהיא שם פרטי מוכר, או כשהמסמך מציג אותה אחרי מילת
    // תפקיד או קרבה ("הקטין עמרי", "התובעת: שלהבת"); אחרת שם משפחה.
    // עד עכשיו רק רשימת ה-POOL נחשבה, וכל שם פרטי שאינו בה קיבל שם משפחה בדוי.
    const w=parts[0], nw=norm(w);
    const knownFirst=FEM.has(w)||MASC.has(w)||MALE_HE.has(w)||(typeof KNOWN_FIRST!=="undefined"&&KNOWN_FIRST.has(w));
    const isFirst=knownFirst||(!SUR_SUFFIX.test(nw)&&((firstish&&firstish.has(nw))||hint==="f"||hint==="m"));
    const out=pickFrom(isFirst?firsts:surs,seed,used,forbidden);
    used.add(out);return out}
  const f=pickFrom(firsts,seed,used,forbidden); used.add(f);
  const s=pickFrom(surs,hash32("s"+norm(value)),used,forbidden); used.add(s);
  // "אלעד בן דוד" → "דניאל בן קפלן": המילית נשארת, כי היא חלק מהמבנה
  // ולא מהזהות. שם משפחה כפול אחר → שם משפחה בדוי אחד, פשוט יותר.
  const PARTS=new Set(["בן","בת","אבו","אל","דה","ואן","בר"]);
  const out=parts.length>2&&PARTS.has(parts[1])?f+" "+parts[1]+" "+s:f+" "+s;
  used.add(out);return out}

/* ══════════ שיבושי תמלול ══════════
   התקלה האמיתית: "נרות מאירות" הוקלד בתמלול כ"נרות מהירות", ולכן
   חיפוש-והחלפה פספס אותו והפרט המזהה יצא החוצה. אחרי ההחלפה סורקים את
   הפלט אחרי מילים שנמצאות במרחק עריכה של תו אחד משם שכבר הוחלף. */
const HOMO=new Set();
[["א","ה"],["א","ע"],["ה","ע"],["א","י"],["כ","ח"],["ק","כ"],["ת","ט"],["ס","ש"],
 ["ב","ו"],["ז","צ"],["ו","י"],["ם","מ"],["ן","נ"],["ך","כ"],["ף","פ"],["ץ","צ"],
 ["ש","ס"],["ד","ת"],["ג","ק"],["ל","ר"],["ל","נ"],["נ","ר"],["מ","נ"],
 ["ב","פ"],["ד","ט"],["ג","כ"]].forEach(([a,b])=>{HOMO.add(a+b);HOMO.add(b+a)});
function near1(a,b){
  const la=a.length,lb=b.length;
  if(Math.abs(la-lb)>1)return null;
  let i=0; while(i<la&&i<lb&&a[i]===b[i])i++;
  if(i===la&&i===lb)return null;
  let j=0; while(i+j<la&&i+j<lb&&a[la-1-j]===b[lb-1-j])j++;
  const ra=la-i-j, rb=lb-i-j;
  if(ra>1||rb>1||ra<0||rb<0)return null;
  if(ra===1&&rb===1)return {k:"sub",p:a[i]+b[i]};
  if(ra!==rb)return {k:"len",p:ra?a[i]:b[i]};
  return null}
// א/ה/ו/י הן אימות קריאה: כתיב מלא מול חסר הוא ההבדל הנפוץ ביותר
// בעברית, ולכן הוספה או השמטה שלהן היא שיבוש סביר. הוספת ש' אינה.
const WEAK=new Set(["א","ה","ו","י"]);
// מילה: אותיות, וסימנים פנימיים רק כשאות אחריהם; גרש בסוף נשאר (ברקוביץ'). מירכאה שסוגרת
// ציטוט ("אלונים") אינה חלק מהמילה — אחרת נוצר ערך נוסף «אלונים"» עם כרטיס משלו.
const WRX=/[\u0590-\u05ff](?:['"\u05f3\u05f4-]?[\u0590-\u05ff])*['\u05f3]?/gu;
function words(t){const o=[];WRX.lastIndex=0;let m;
  while((m=WRX.exec(t)))o.push({w:m[0],s:m.index,e:m.index+m[0].length});return o}
/* למה שני שמות ברשימה עשויים להיות אותו אדם (Q12 בגרסה 2). האותות, כל אחד בשמו:
   כתיב מלא מול חסר או אות דומה במילה אחת ("שלוה"/"שלווה"), מקף מול רווח או
   סדר מילים שונה, שם פרטי לבדו מול השם המלא, שם משפחה לבדו מול השם המלא,
   וחלק מהשם המשולש. מחזיר רשימת סיבות; ריקה כשאין. ההצעה מוצגת, ולעולם
   אינה מתקבלת מעצמה: מיזוג הוא הקשה שלה על הכרטיס. */
function mergeSignals(a,b){
  const A=norm(String(a||"")).trim(), B=norm(String(b||"")).trim();
  if(!A||!B||A===B)return [];
  const aw=A.split(/[\s\-־–]+/).filter(Boolean), bw=B.split(/[\s\-־–]+/).filter(Boolean);
  const out=[];
  const sameW=(x,y)=>{if(x===y)return true;const r=near1(x,y);return !!r&&(r.k==="sub"?HOMO.has(r.p):WEAK.has(r.p))};
  if(aw.length===bw.length&&aw.length>=1){
    if(aw.every((w,k)=>w===bw[k])){ if(A!==B)out.push("מקף מול רווח"); }
    else if(aw.every((w,k)=>sameW(w,bw[k]))&&aw.some((w,k)=>w!==bw[k])&&aw.join("").length>=4)out.push("כתיב מלא מול חסר");
    else if(aw.length>=2&&[...aw].sort().join(" ")===[...bw].sort().join(" "))out.push("אותן מילים בסדר אחר");
  }
  // "גורגן" ו"שגורגן": אחד הוא השני עם אות שימוש לפניו. כשהמודל לא הכריע (או כבוי)
  // זה נשאר הצעה, לא קיפול — "רון" ו"שרון" הם שני אנשים.
  if(aw.length===bw.length){
    const [x,y]=A.length<B.length?[A,B]:[B,A];
    if(y.length===x.length+1&&/^[בלמושהכ]/.test(y)&&y.slice(1)===x&&x.replace(/[\s\-־–]/g,"").length>=3)out.push("אות שימוש?");
  }
  const [s,l]=aw.length<bw.length?[aw,bw]:[bw,aw];
  if(s.length<l.length&&s.every(w=>w.length>=3)){
    if(s.length===1&&l[0]===s[0])out.push("שם פרטי לבדו");
    else if(s.length===1&&l[l.length-1]===s[0])out.push("שם משפחה לבדו");
    else if(s.every(w=>l.includes(w)))out.push("חלק מהשם המלא");
  }
  return out;
}
function findNear(blocks,targets,banned){
  // הסף הקודם דרש חמש אותיות לשם בן מילה אחת, וכך חסם בדיוק את המקרה
  // שממנו התחלנו: "שלוה" מול "שלווה". ארבע אותיות זה שם.
  /* 120 שמות לכל היותר, בשביל הזמן. מה שמעבר נאמר בתוצאה (read, of) ולא נחתך בשקט (ביקורת L12):
     המנוע מדווח שהבדיקה הזאת לא הסתיימה, כמו שכבה שנשברה */
  const all=targets.filter(t=>t.norm.length>=4), tg=all.slice(0,120);
  if(!tg.length)return [];
  const byK={}; for(const t of tg)(byK[t.words]=byK[t.words]||[]).push(t);
  const out=[],seen=new Set();
  const docTok=new Set();
  for(const blk of blocks)for(const w of (norm(blk.text).match(WRX)||[]))docTok.add(w);
  for(const blk of blocks){
    const n=norm(blk.text), tk=words(n);
    if(!tk.length)continue;
    for(const k of Object.keys(byK)){
      const K=+k; if(tk.length<K)continue;
      const list=byK[k];
      for(let i=0;i+K<=tk.length;i++){
        let cand=tk[i].w;
        for(let z=1;z<K;z++)cand+=" "+tk[i+z].w;
        const bare=cand.replace(/^[בהולמכש]/,"");
        for(const t of list){
          if(cand===t.norm||bare===t.norm)continue;
          // חילוף של אות שימוש בלבד אינו שיבוש: "בחיים" מול "שחיים" הוא אותו "חיים"
          // עם ב במקום ש, ו"בגיל" הוא "גיל" עם ב. בשני המקרים זו מילה (בחיים לא
          // ראיתי, בגיל 8), והצעה כאן משחיתה את המשפט אם היא מתקבלת.
          if(PFX.has(cand[0])&&PFX.has(t.norm[0])&&cand.slice(1)===t.norm.slice(1))continue;
          if(PFX.has(cand[0])&&cand.slice(1)===t.norm)continue;
          const r=near1(cand,t.norm)||near1(bare,t.norm);
          if(!r)continue;
          const s=tk[i].s,e=tk[i+K-1].e, raw=blk.text.slice(s,e);
          const nraw=norm(raw).trim();
          if(banned.has(nraw)||STOP.has(nraw))continue;
          // "אולי" רחוק תו אחד מ"אורלי" אבל הוא מילה, לא שיבוש של שם
          if(!cand.split(" ").every(w=>nameish(w,docTok)))continue;
          if(t.words===1&&t.norm.length<=4&&
             !(r.k==="sub"?HOMO.has(r.p):WEAK.has(r.p)))continue;
          const key=nraw+"|"+t.value;
          if(seen.has(key))continue; seen.add(key);
          const homo=r.k==="sub"&&HOMO.has(r.p);
          out.push({value:raw,label:"כתיב דומה",part:partName(blk.part),
            ctx:ctxHTML(blk.text,s,e),review:true,src:"near",
            near:{target:t.value,rep:t.rep,kind:t.kind},
            conf:homo?"high":"medium",
            why:`נכתב כמעט כמו «${t.value}» שכבר הוחלף`+
              (homo?` — אותיות מתחלפות בתמלול (${r.p[0]}↔${r.p[1]})`:
                    (r.k==="sub"?` — תו אחד שונה (${r.p[0]}↔${r.p[1]})`:" — תו אחד חסר או עודף"))});
          break}}}}
  const res=out.sort((a,b)=>(a.conf==="high"?0:1)-(b.conf==="high"?0:1));
  res.read=tg.length; res.of=all.length;
  return res}

/* ══════════ שמות בגוף הטקסט ══════════
   העוגנים המבניים ("עו״ד", "בפני", "ת״ז") חיים בפתיח של כתב טענות.
   מסמך שנולד מתמלול הוא נרטיב, ואין בו כמעט אף אחד מהם — ושם בדיוק
   יושבים השמות שהיא עלולה לשכוח. בעברית אין אותיות גדולות, ולכן
   הרמז החזק ביותר הוא מה שעומד לפני פועל שאדם עושה. */
const VRB=new Set(("אמר אמרה אמרו טען טענה טענו מסר מסרה מסרו ציין ציינה ציינו "+
 "הוסיף הוסיפה הוסיפו סיפר סיפרה סיפרו השיב השיבה השיבו ענה ענתה ענו העיד העידה "+
 "הצהיר הצהירה המליץ המליצה המליצו דיווח דיווחה דיווחו סירב סירבה סירבו ביקש ביקשה "+
 "ביקשו אישר אישרה אישרו הכחיש הכחישה חתם חתמה חתמו פנה פנתה פנו כתב כתבה שלח שלחה "+
 "הודיע הודיעה נכח נכחה נכחו הגיע הגיעה הגיעו הסביר הסבירה הבהיר הבהירה התנגד התנגדה "+
 "הסכים הסכימה הודה הודתה הגיש הגישה הגישו צירף צירפה העביר העבירה קיבל קיבלה "+
 "הופיע הופיעה הופיעו נשאל נשאלה עזב עזבה חזר חזרה התקשר התקשרה החליט החליטה "+
 "קבע קבעה הורה הורתה ראה ראתה שמע שמעה ידע ידעה נהג נהגה הכיר הכירה סיכם סיכמה "+
 "אומר אומרת טוען טוענת מוסר מוסרת מספר מספרת מבקש מבקשת מציין מציינת").split(" "));
const ATTR=new Set(("לדברי לטענת מפי בנוכחות לבקשת בהשתתפות באוזני "+
 "בהנחיית בליווי בהובלת מייצג מייצגת").split(" "));
/* מי שהמסמך עוסק בו לא תמיד מדבר בו — מדברים עליו. הוא מופיע בשייכות
   ובמילות יחס: "במקרה של X", "בשביל X", "אמא של X". זו לרוב הקטגוריה הכי
   רגישה במסמך, והיא בדיוק זו שאין לה אף פועל אמירה. */
const PREP=new Set(("בשביל עבור בזכות בעניין לגבי כלפי אצל אודות בנוגע "+
 "מטופל המטופלת").split(" "));
const KIN=new Set(("אמא אבא אמו אביו אמה אביה הורי הורים הורה בן בת בנו בתו "+
 "אח אחות אחיו אחותו משפחת משפחה ילדו ילדה טובתו טובתה מקרה עניינו עניינה "+
 "גיסתנו דודה דוד סבתא סבא אשתו בעלה גרושתו בת-זוגו").split(" "));
const CARE=new Set(("תמיכה תמיכת טיפול טיפולה ליווי עזרה סיוע מעקב קשר "+
 "פגישה מפגש דאגה אחריות השמה").split(" "));
// מילות מילוי שעומדות לבדן בשורה בתמלול, ונראות בדיוק כמו שורת דובר
const FILLER=new Set(("טוב בסדר כן לא נכון בטח אוקיי אוקי רגע שנייה יודעת יודע מבינה מבין "+
 "בדיוק ברור מצוין יופי אה אהה אמ בטוח נו הנה אז ואז כאילו ממש לגמרי בכלל הכול הכל "+
 "תודה סליחה שלום ביי מה איך למה מתי איפה מי כמה אולי בטוחה מסכימה מסכים").split(" "));
const REL=new Set(["שהוא","שהיא","שהם","שהן","אשר"]);
const ROLE2=("עובדת סוציאלית|עובד סוציאלי|מנהלת בית הספר|מנהל בית הספר|"+
 "מנהלת המחלקה|מנהל המחלקה|יועצת חינוכית|קצינת מבחן|קצין מבחן|"+
 "פקידת סעד|פקיד סעד|אחראית משמרת").split("|");
const ROLE1=("מנהלת מנהל מטפלת מטפל רופאה רופא פסיכולוגית פסיכולוג פסיכיאטר "+
 "מורה גננת מפקחת מפקח אחות מדריכה מדריך יועצת יועץ שכנה שכן מזכירה מזכיר "+
 "חוקרת חוקר שוטרת שוטר קצינה קצין מאבטח נהגת נהג סייעת מרצה בלשית בלש "+
 "אפוטרופסית אפוטרופוס מגשרת מגשר").split(" ");
// מילים שכיחות שעלולות לעמוד לפני פועל ולהיראות כמו שם
const COMMON=new Set(("ילד ילדה ילדים ילדות אם אב אמא אבא הורה הורים בן בת בנים בנות "+
 "אח אחות אחים משפחה איש אישה אנשים גבר נער נערה תינוק תינוקת סבא סבתא דוד דודה "+
 "עד עדה עדים מטופל מטופלת לקוח לקוחה תלמיד תלמידה צוות ועדה גורם גורמים מוסד "+
 "מפגש פגישה דיון ישיבה שיחה טלפון מכתב מסמך מסמכים דוח דוחות תיק תיקים "+
 "בקשה תגובה החלטה פסק צו הודעה תלונה תביעה טענה טענות ראיה ראיות עדות "+
 "מצב מקרה עניין נושא דבר דברים זמן שעה יום ימים שבוע חודש שנה שנים "+
 "מקום בית בתים דירה חדר רחוב עיר כפר שכונה עבודה כסף סכום תשלום חוב "+
 "אמת שקר צדק חוק דין משפט זכות חובה סעיף פרק נספח מזונות משמורת הסדרי "+
 "בעל בעלה אשתו גרושה גרוש בת-זוג בן-זוג קטין קטינה רווחה חינוך בריאות "+
 "מרכז מעון פנימייה מחלקה יחידה שירות שירותים אגף סניף מרפאה מוקד "+
 "משיב משיבה מבקש מבקשת תובע תובעת נתבע נתבעת נאשם נאשמת מערער מערערת "+
 "עורר עוררת מצהיר מצהירה כוח באת בא צד צדדים מותב ערכאה מבקשים משיבים "+
 "סוציאלית סוציאלי חינוכית חינוכי משפטית משפטי רפואית רפואי "+
 "ארכה דחייה ערעור פשרה סעד הוצאות אגרה עיכוב הליך הליכים בורר גישור "+
 "סיום סיכום תחילה התחלה המשך מהלך מעמד נוכחות נסיבות שלב שלבים מועד "+
 "מסגרת עקבות רקע הקשר אופן פועל סמוך תום ראשית סופו אחרית עצם רגע "+
 "זאת אלה אלו הכל הכול חלק רוב מיעוט אחד אחת שני שתי שלוש ארבע "+
 "עבר הווה עתיד בוקר צהריים ערב לילה שבת ראשון שלישי רביעי חמישי "+
 "אולי כאילו ממש בדיוק באמת אפילו בכלל לגמרי בערך כמעט מאוד מאד ממילא "+
 "לפעמים תמיד אחרי לפני בתוך מתוך בגלל למרות בזמן כאשר אשר כדי בין "+
 "שלנו שלהם שלכם שלהן אותם אותנו אותה אותו אותן עצמו עצמה עצמנו עצמם "+
 "הרבה מעט יותר פחות כמו אבל ולכן לכן אולם אכן כמובן בהחלט בוודאי בטח "+
 "נכון גדול קטן חדש ישן אחרון כללי מיוחד חשוב קשה ברור פשוט מסוים שונה "+
 "כלומר למשל בנוסף יחד לבד שוב כבר עדיין פתאום מיד מהר קודם אחרת סתם "+
 "כולם כולנו כולם אנחנו אתם אתן הייתי היינו יהיה תהיה להיות עושה עושים "+
 "צריך צריכה צריכים רוצה רוצים יכול יכולה יכולים חושב חושבת אומרים "+
 "שניים שתיים שלושה שלוש ארבעה ארבע חמישה חמש שישה שש שבעה שבע "+
 "שמונה תשעה תשע עשרה עשרים שלושים ארבעים חמישים מאה אלף מיליון "+
 "שכלית שכלי נפשית נפשי פיזית פיזי מוגבלות מוגבלויות התפתחותי "+
 "שרות רכז רכזת מרכז מנחה מנחת מפקח מפקחת סמנכל מנכל יור ציר צירה "+
 "מקצועית מקצועי כלכלית כלכלי ארצית ארצי אזורית מחוזית ראשית בכירה בכיר "+
 "לנו לכם להם לכן לנו אלינו אליכם אליהם עלינו עליכם עליהם איתנו איתכם "+
 "קשר ישיבה ישיבת מכון עמותה עמותת ארגון איגוד לשכה לשכת אגודה "+
 "נפלאה נפלא מצוינת מצוין טובה נהדרת נהדר מדהים מדהימה נוספת נוסף "+
 "אחרת ראשונה אחרונה מרצה מלווה אחראית אחראי עצמאית עצמאי "+
 "איזו איזה ממנה ממנו מהם מהן אליה אליו בהם בהן כזה כזו כאלה "+
 "שלא שלו שלה שלי שהם שהן שזה שזו שיש שאין שאני שאתה שהוא שהיא "+
 "שכל שרק שעוד שכבר שגם שאם שאת שאנחנו שאפשר שצריך שיהיה שהיה "+
 "ולא ואם וגם וכן ומה וזה וכל ואת ואני ואנחנו לכן ממה במה כמה למה "+
 "מזה בזה לזה מכל בכל לכל ככה כשה כדי מאז ומאז ולכן ואז ואילו "+
 "אב אם בן בת אח אחות עד עדה ילד ילדה נער נערה גיל שם כתובת טלפון").split(/\s+/));
function tokall(t){const o=[];WRX.lastIndex=0;let m;
  while((m=WRX.exec(t)))o.push({w:m[0],s:m.index,e:m.index+m[0].length});return o}
function stems(w){
  const o=[w];
  if(PFX.has(w[0]))o.push(w.slice(1));
  if(PFX.has(w[0])&&PFX.has(w[1]))o.push(w.slice(2));
  return o}
function nameish(w,docTok){
  if(w.length<3||w.length>14)return false;
  if(PLACE_BY[w]||AMBIG.has(w))return false;
  if(ROLE1.includes(w))return false;
  // "שהילדה" הוא ש+ה+ילדה. בלי קילוף אותיות השימוש כל מילה מיודעת
  // בטקסט נראית כמו שם.
  for(const st of stems(w)){
    // שם פרטי שהוא גם מילה ("שלום", "חיים") יושב ב-WORDLIKE בדיוק בשביל זה, אבל
    // "שלום" יושב גם ב-STOP בגלל "בית משפט השלום", ו-STOP ניצח: "שלום אמר לי" לא
    // הוצע מעולם, לא כהחלפה ולא כהצעה. שם כזה לפני פועל דיבור עולה לבדיקה.
    // ההחלטה: מאשרים-קודם, לא מוחקים בשקט.
    if(st.length>=2&&COMMON.has(st)&&!WORDLIKE.has(st))return false;
    if(st.length<3)continue;
    if((STOP.has(st)||VRB.has(st)||ATTR.has(st))&&!WORDLIKE.has(st))return false;
    if(PREP.has(st)||KIN.has(st)||CARE.has(st)||REL.has(st))return false;
    if(st!==w&&docTok.has("ה"+st))return false}
  if(w[0]==="ה"){const r=w.slice(1);
    if(r.length>=3&&docTok.has(r))return false;
    if(r.length<4)return false}
  if(docTok.has("ה"+w))return false;
  return true}
/* "אסתר להידחות" (דוגמה בדויה, v35): כששם המשפחה אינו מופיע במשפט, המילה שאחרי
   השם הפרטי — שם פועל — נדבקה אליו כשם משפחה. אי אפשר היה להשאיר את "אסתר"
   ולוותר על "להידחות", ובהחלפה מילה חשובה משפטית נבלעה בכינוי.
   מילה שאחרי שם שהיא שם פועל בצורתה (להי־, להת־, לה־ + שורש) או פועל/מילה
   נפוצה מהרשימות אינה מצטרפת לשם; שם משפחה שמתחיל ב-ל' (לביא, לוי, לנדאו)
   מוגן דרך רשימות השמות וסיומות שם המשפחה. */
function verbTail(w){
  const x=norm(String(w||"")).trim(); if(!x)return false;
  if(KNOWN_FIRST.has(x)||(typeof SUR_SUFFIX!=="undefined"&&SUR_SUFFIX.test(x)))return false;
  if(VRB.has(x)||COMMON.has(x))return true;
  return /^לה[א-ת]{3,}$/.test(x);
}
function bodyNames(blocks,known){
  const kn=new Set(), knFull=new Set(); for(const k of known){const n=norm(k).trim();
    kn.add(n); knFull.add(n); for(const p of n.split(/\s+/))if(p.length>=3)kn.add(p)}
  const docTok=new Set();
  const toks=[];
  for(const b of blocks){const n=norm(b.text),t=tokall(n);
    for(const x of t)docTok.add(x.w);
    toks.push({b,n,t})}
  const sc=new Map();
  const bump=(key,pts,why,b,s,e,strong)=>{
    const g=sc.get(key)||{n:0,pts:0,why:new Set(),ctx:"",part:"",strong:false};
    g.n++; g.pts+=pts; if(why)g.why.add(why); if(strong)g.strong=true;
    if(!g.ctx&&b){g.ctx=ctxHTML(b.text,s,e);g.part=partName(b.part)}
    sc.set(key,g)};
  for(const {b,n,t} of toks){
    for(let i=0;i<t.length;i++){
      for(const len of [2,1]){
        if(i+len>t.length)continue;
        const raw=t.slice(i,i+len);
        // "המכתב אבד. אגבאריה" — שתי מילים משני משפטים אינן שם אחד,
        // ו"מזרחי וכהן" הם שני אנשים ברשימה, לא שם מלא.
        // "מהוועד אמר", "מהמשרד ביקשו": מילה בודדת שנפתחת ב-מ+ה היא "מן ה-", צירוף
        // יחס ולא שם. רק כאן, במועמד בודד לפני פועל דיבור: ב-nameish הכלל הזה
        // הפיל גם את "מהירות", שסורק השיבושים צריך בתור כמעט-התאמה של "מאירות".
        if(len===1&&/^מה[א-ת]{2,}$/.test(raw[0].w)&&!KNOWN_FIRST.has(raw[0].w))continue;
        if(len>1){
          const gap=n.slice(raw[0].e,raw[1].s);
          if(/[.!?;:,()\n]/.test(gap))continue;
          if(PFX.has(raw[1].w[0])&&docTok.has(raw[1].w.slice(1)))continue;
          // "איוונוב ואינו מהווה" — מילת שלילה, מילת יחס או פועל אחרי ו' החיבור
          // אינם חלק מהשם. הצעה כזאת אושרה, ואז שם המשפחה לבדו נחשב משותף
          // לשני ערכים ולא הוחלף.
          // "משכך עמרי": מילת קישור בראש אינה חלק מהשם
          if(LEAD.has(raw[0].w))continue;
          const w2=raw[1].w.replace(/^ו/,"");
          if(/^אינ[והםן]$/.test(w2)||STOP.has(w2)||COMMON.has(w2)||VRB.has(w2)||TRAIL.has(w2))continue;
          if(verbTail(w2))continue;
          // צירוף שאחת ממילותיו היא ערך שכבר ברשימה אינו אדם חדש: "אסתר" שברשימה
          // אינה הופכת ל"אסתר להידחות" בהצעות, אחרי שכבר הוחלט מה "אסתר".
          if(raw.some(x=>knFull.has(x.w)||knFull.has(x.w.replace(/^[בהולמכש]/,""))))continue;
        }
        // "מזרחי וכהן" — "וכהן" הוא אותו אדם כמו "כהן", לא מועמד נפרד
        const wds=raw.map(x=>
          PFX.has(x.w[0])&&docTok.has(x.w.slice(1))?x.w.slice(1):x.w);
        if(!wds.every(w=>nameish(w,docTok)))continue;
        // "הצעה שאינה", "וערכית אינו": מילת שלילה אינה חלק משם
        if(wds.some(w=>/^[בהולמכש]?(?:אינ[הוםן]|איני|אין|לא|בלי|ללא)$/.test(w)))continue;
        // "שפגשתי אומר": נטיית עבר בגוף ראשון היא פועל. רק ־תי/־נו, ורק מאורך שש:
        // "אביתן" הוא שם משפחה שנגמר ב־תן, ו"אביטן" נשאר צמוד אליו במלכודת הזוגות.
        if(wds.some(w=>/(?:תי|נו)$/.test(w)&&w.length>=6))continue;
        // צירוף של שתי מילים שאחת מהן בצורת רבים או תואר ("שינוי משמעותי",
        // "מאפיינים כלליים", "רמה מקצועית גבוהה") אינו שם של אדם. שם בודד לא נפסל כאן,
        // כדי לא לפסול שמות נשים שנגמרים ב-ה או ב-ית.
        if(wds.length>1&&wds.some(w=>/(?:ים|יים|ית|יות)$/.test(w)&&!KNOWN_FIRST.has(w)))continue;
        // "פלוני מהוועד": הכינוי המשפטי אינו אדם, גם לפני פועל
        if(wds.some(w=>NER_DROP.has(w)))continue;
        // אותיות בודדות מופרדות ברווח ("נ ג ד") אינן שם
        if(wds.every(w=>w.replace(/['"׳״]/g,"").length<=1))continue;
        const cand=wds.join(" ");
        if(kn.has(cand))continue;
        const s=raw[0].s,e=raw[len-1].e;
        let pts=0,strong=false;
        // בין "עובדת סוציאלית," ל"אוניברסיטת בן גוריון" יש פסיק — אלה שני
        // פריטים ברשימה, לא תפקיד ואחריו שם. כל בדיקת סמיכות חייבת רצף.
        const cln=(x,y)=>x&&y&&!/[,.;:()\[\]\n]/.test(n.slice(x.e,y.s));
        const nxt=cln(raw[len-1],t[i+len])&&t[i+len].w;
        const prv=cln(t[i-1],raw[0])&&i>0&&t[i-1].w;
        const prv2=prv&&cln(t[i-2],t[i-1])&&i>1&&t[i-2].w;
        // תואר בראש המועמד ("עו\"ד יערה") אינו שם, וגוף ציבורי ("לביטוח לאומי",
        // "המוסד לביטוח לאומי" עם המילה שלפניו) אינו פרט מזהה. שניהם הוצעו ואושרו,
        // והראשון גם דחק את החלפת שם המשפחה של "יערה ליפשיץ" בגלל "שם משותף".
        if(TITLE_RX.test(cand+" ")||[cand,prv&&prv+" "+cand,prv2&&prv&&prv2+" "+prv+" "+cand].filter(Boolean).some(x=>PUBLIC_ORG.test(x)||PUBLIC_ORG.test(x.replace(/^[בהולמכש]/,""))))continue;
        const hit=(p,w)=>{pts+=p;strong=true;return w};
        let why="";
        if(nxt&&VRB.has(nxt))why=hit(3,`עומד לפני «${nxt}»`);
        else if(prv&&ATTR.has(prv))why=hit(3,`בא אחרי «${prv}»`);
        else if(prv&&ROLE1.includes(prv))why=hit(3,`בא אחרי תפקיד «${prv}»`);
        else if(prv2&&ROLE2.some(r=>r===prv2+" "+prv))why=hit(3,`בא אחרי תפקיד «${prv2} ${prv}»`);
        // מדברים עליו, לא הוא מדבר
        else if(prv==="של"&&prv2&&KIN.has(prv2))why=hit(3,`בא אחרי «${prv2} של»`);
        else if(prv&&PREP.has(prv))why=hit(3,`בא אחרי «${prv}»`);
        else if(prv==="עם"&&len===2&&!wds.some(x=>docTok.has("ה"+x)))
          why=hit(3,"בא אחרי «עם»");
        // "אמא אומנת שלא תישבר, שהוא יישאר" — פסוקית זיקה מציגה אדם
        // כשהיא פותחת פסוקית או באה אחרי תואר, לא כשהיא תלויה במילה שכיחה.
        else if(t[i+len]&&REL.has(t[i+len].w)&&!wds.some(x=>VRB.has(x))&&
                !(prv&&COMMON.has(prv))&&
                /,/.test(n.slice(raw[len-1].e,t[i+len].s)))
          why=hit(3,`ואחריו «, ${t[i+len].w}» — תיאור של אדם`);
        else if(prv==="של"&&wds[0]!==raw[0].w)why=hit(2,"בא אחרי «של»");
        if(!why){
          for(let z=1;z<=2;z++){const b=t[i-z];
            if(b&&CARE.has(b.w)&&!/[,.;:\n]/.test(n.slice(b.e,raw[0].s))){
              why=hit(2,`בהקשר של «${b.w}»`);break}}
        }
        // אות שימוש בלי ה' הידיעה: "ולשליו", "במישל" — דפוס של שם פרטי,
        // כי שם עצם מיודע היה מופיע גם כ"השליו" איפשהו במסמך
        const st0=raw[0].w, stem=st0.slice(1);
        if(PFX.has(st0[0])&&st0.length>=4&&st0[1]!=="ה"&&
           !docTok.has("ה"+stem)&&nameish(stem,docTok)&&
           (docTok.has(stem)||[...PFX].some(q=>q!==st0[0]&&docTok.has(q+stem)))){
          pts+=2; if(!why)why="מופיע עם אות שימוש ובלי ה' הידיעה";
        }
        // סמיכות לשם מוכר היא רמז חלש: ברשימת מוזמנים מופרדת בפסיקים
        // היא מסמנת כל מילת תפקיד. לבדה היא לא מספיקה.
        if(prv&&(kn.has(prv)||kn.has(prv.replace(/^ו/,""))))pts+=1;
        if(nxt&&(kn.has(nxt)||kn.has(nxt.replace(/^ו/,""))))pts+=1;
        if(!pts)continue;
        bump(cand,pts,why||"מופיע ליד שם שכבר ידוע",b,s,e,strong);
        break}}}
  /* הסולם שמחליט אם מועמד מוצע בכלל. כל מופע מקבל נקודות לפי כוח הראיה:
     3 — הקשר שכמעט רק שם של אדם מקבל: לפני פועל דיבור, אחרי תואר, תפקיד, "X של"
         של קרבה, מילת יחס של אדם, "עם" לפני שתי מילים, או לפני פסוקית זיקה אחרי פסיק;
     2 — הקשר חלש יותר: אחרי "של" עם אות שימוש, מילת טיפול עד שתי מילים לפניו,
         או אות שימוש בלי ה' הידיעה בשום מקום במסמך;
     1 — סמיכות לשם שכבר ידוע, לכל צד בנפרד.
     חזרה מוסיפה: שני מופעים +1, שלושה ומעלה +2. מועמד מוצע רק אם לפחות מופע אחד
     שלו קיבל ראיה של הקשר (strong: ה-3 וה-2 שדרך hit, לא אות השימוש ולא הסמיכות),
     והסכום הכולל הוא 3 ומעלה. כלומר: ראיה של 3 מספיקה במופע אחד; ראיה של 2 צריכה
     חזרה או ראיה נוספת ("ליווי אלמוגית" פעם אחת לא מוצע, פעמיים כן); אות שימוש
     וסמיכות לשם ידוע לבדן אינן מציעות לעולם. */
  const out=[];
  for(const [value,g] of sc){
    if(!g.strong)continue;
    const total=g.pts+(g.n>=3?2:g.n>=2?1:0);
    if(total<3)continue;
    if(PUBLIC_ORG.test(value)||PUBLIC_ORG.test(value.replace(/^[בהולמכש]/,"")))continue;
    out.push({value,score:total,count:g.n,why:[...g.why].slice(0,2).join(" · "),
      ctx:g.ctx,part:g.part})}
  // "אזולאי" הוצע כי הוא חוזר, אבל במסמך כתוב "סיגלית אזולאי" — עדיף
  // להציע את השם המלא, אחרת השם הפרטי יישאר בטקסט.
  for(const o of out){
    if(o.value.includes(" "))continue;
    for(const {n,t} of toks){
      const i=t.findIndex((x,j)=>j>0&&x.w===o.value);
      if(i<1)continue;
      const p=t[i-1].w;
      // "המכתב אבד. אגבאריה אישרה" — שתי מילים משני משפטים אינן שם אחד
      if(/[.!?;:\n]/.test(n.slice(t[i-1].e,t[i].s)))continue;
      if(p[0]==="ה"||p.length<3||!nameish(p,docTok))continue;
      if(ROLE1.includes(p)||VRB.has(p)||kn.has(p)||NER_DROP.has(p))continue;
      // "מהוועד" לבדו לא היה מועמד טוב, ו"פלוני מהוועד" אינו שם מלא: ההרחבה
      // לשם מלא לא מצילה מילה עם אות שימוש שהמסמך מכיר גם בלעדיה
      if(PFX.has(o.value[0])&&docTok.has(o.value.slice(1)))continue;
      o.value=p+" "+o.value; o.full=true; break}}
  const dedup=new Map();
  for(const o of out){const ex=dedup.get(o.value);
    if(!ex||o.score>ex.score)dedup.set(o.value,o)}
  const out2=[...dedup.values()];
  const full=out2.filter(x=>x.value.includes(" "))
    .flatMap(x=>x.value.split(" "));
  return out2.filter(x=>x.value.includes(" ")||!full.includes(x.value))
    .sort((a,b)=>b.score-a.score||b.count-a.count)}

/* ══════════ מאפייני היישובים שבמפת המרחקים ══════════

   יישוב מוחלף ביישוב, וממקום אחר: המפה שומרת על המרחקים בין היישובים שבמסמך.
   עד כאן היא שמרה רק על המרחקים, ולכן עיר חרדית יכלה להפוך לקיבוץ, וכפר
   ערבי לעיר יהודית חילונית — ומי שקורא את המסמך המושחר מבין אותו לא נכון.

   ההחלטה (Q11 בגרסה 2): מאפיינים לפני מרחק. תיוג גס ואובייקטיבי בלבד, לפי חמישה
   צירים, בסדר הזה:

     סוג      עיר | מועצה מקומית | מועצה אזורית | מושב | קיבוץ | יישוב קהילתי
     אוכלוסייה  יהודי | ערבי | דרוזי | בדואי | מעורב
     דת       חילוני | מסורתי | דתי | חרדי | מעורב | לא ידוע
     גודל     גדול (מאה אלף ומעלה) | בינוני (עשרים עד מאה אלף) | קטן
     אזור     צפון | חיפה | מרכז | תל אביב | ירושלים | דרום | יהודה ושומרון

   "מעורב" ו"לא ידוע" הם ערכים מפורשים, לא ברירת מחדל. הטבלה נכתבה כטיוטה
   לבדיקה; docs/atlas-tags-he.md נבנה ממנה (scripts/build-atlas-doc.js)
   וזה המקום לקרוא ולתקן. tests/atlas_t.js מוודא שכל יישוב במפה מתויג, שכל
   ערך מהמילון, ושהמסמך לבדיקה מעודכן. */
const ATLAS_KEYS=["סוג","אוכלוסייה","דת","גודל","אזור"];
const ATLAS_VOCAB={
  "סוג":["עיר","מועצה מקומית","מועצה אזורית","מושב","קיבוץ","יישוב קהילתי"],
  "אוכלוסייה":["יהודי","ערבי","דרוזי","בדואי","מעורב"],
  "דת":["חילוני","מסורתי","דתי","חרדי","מעורב","לא ידוע"],
  "גודל":["גדול","בינוני","קטן"],
  "אזור":["צפון","חיפה","מרכז","תל אביב","ירושלים","דרום","יהודה ושומרון"]};
const ATLAS_TAGS={
"ירושלים":"עיר|מעורב|מעורב|גדול|ירושלים",
"תל אביב":"עיר|יהודי|חילוני|גדול|תל אביב",
"חיפה":"עיר|מעורב|חילוני|גדול|חיפה",
"ראשון לציון":"עיר|יהודי|חילוני|גדול|מרכז",
"פתח תקווה":"עיר|יהודי|מעורב|גדול|מרכז",
"אשדוד":"עיר|יהודי|מעורב|גדול|דרום",
"נתניה":"עיר|יהודי|מעורב|גדול|מרכז",
"באר שבע":"עיר|יהודי|חילוני|גדול|דרום",
"בני ברק":"עיר|יהודי|חרדי|גדול|תל אביב",
"חולון":"עיר|יהודי|חילוני|גדול|תל אביב",
"רמת גן":"עיר|יהודי|חילוני|גדול|תל אביב",
"אשקלון":"עיר|יהודי|מסורתי|גדול|דרום",
"רחובות":"עיר|יהודי|מעורב|גדול|מרכז",
"בת ים":"עיר|יהודי|חילוני|גדול|תל אביב",
"בית שמש":"עיר|יהודי|חרדי|גדול|ירושלים",
"כפר סבא":"עיר|יהודי|חילוני|גדול|מרכז",
"הרצליה":"עיר|יהודי|חילוני|גדול|תל אביב",
"חדרה":"עיר|יהודי|מעורב|גדול|חיפה",
"מודיעין":"עיר|יהודי|מעורב|גדול|מרכז",
"נצרת":"עיר|ערבי|מעורב|בינוני|צפון",
"לוד":"עיר|מעורב|מעורב|בינוני|מרכז",
"רמלה":"עיר|מעורב|מעורב|בינוני|מרכז",
"רעננה":"עיר|יהודי|חילוני|בינוני|מרכז",
"רהט":"עיר|בדואי|מסורתי|בינוני|דרום",
"הוד השרון":"עיר|יהודי|חילוני|בינוני|מרכז",
"גבעתיים":"עיר|יהודי|חילוני|בינוני|תל אביב",
"קרית אתא":"עיר|יהודי|מסורתי|בינוני|חיפה",
"נהריה":"עיר|יהודי|חילוני|בינוני|צפון",
"קרית גת":"עיר|יהודי|מסורתי|בינוני|דרום",
"אום אל-פחם":"עיר|ערבי|מסורתי|בינוני|חיפה",
"עפולה":"עיר|יהודי|מסורתי|בינוני|צפון",
"אילת":"עיר|יהודי|חילוני|בינוני|דרום",
"טבריה":"עיר|יהודי|מסורתי|בינוני|צפון",
"עכו":"עיר|מעורב|מסורתי|בינוני|צפון",
"אלעד":"עיר|יהודי|חרדי|בינוני|מרכז",
"רמת השרון":"עיר|יהודי|חילוני|בינוני|תל אביב",
"כרמיאל":"עיר|יהודי|חילוני|בינוני|צפון",
"טירה":"עיר|ערבי|מסורתי|בינוני|מרכז",
"יבנה":"עיר|יהודי|מסורתי|בינוני|מרכז",
"טייבה":"עיר|ערבי|מסורתי|בינוני|מרכז",
"קרית ביאליק":"עיר|יהודי|חילוני|בינוני|חיפה",
"קרית אונו":"עיר|יהודי|חילוני|בינוני|תל אביב",
"נס ציונה":"עיר|יהודי|חילוני|בינוני|מרכז",
"מעלה אדומים":"עיר|יהודי|מעורב|בינוני|יהודה ושומרון",
"ראש העין":"עיר|יהודי|מסורתי|בינוני|מרכז",
"אור יהודה":"עיר|יהודי|מסורתי|בינוני|תל אביב",
"צפת":"עיר|יהודי|דתי|בינוני|צפון",
"דימונה":"עיר|יהודי|מסורתי|בינוני|דרום",
"טמרה":"עיר|ערבי|מסורתי|בינוני|צפון",
"סח'נין":"עיר|ערבי|מסורתי|בינוני|צפון",
"קרית מוצקין":"עיר|יהודי|חילוני|בינוני|חיפה",
"קרית ים":"עיר|יהודי|חילוני|בינוני|חיפה",
"יהוד":"עיר|יהודי|מסורתי|בינוני|מרכז",
"נתיבות":"עיר|יהודי|דתי|בינוני|דרום",
"בית שאן":"עיר|יהודי|מסורתי|קטן|צפון",
"אריאל":"עיר|יהודי|חילוני|קטן|יהודה ושומרון",
"מגדל העמק":"עיר|יהודי|מסורתי|בינוני|צפון",
"שפרעם":"עיר|ערבי|מעורב|בינוני|צפון",
"אופקים":"עיר|יהודי|מסורתי|בינוני|דרום",
"קרית שמונה":"עיר|יהודי|מסורתי|בינוני|צפון",
"כפר יונה":"עיר|יהודי|חילוני|בינוני|מרכז",
"גבעת שמואל":"עיר|יהודי|דתי|בינוני|מרכז",
"ירוחם":"מועצה מקומית|יהודי|מסורתי|קטן|דרום",
"שדרות":"עיר|יהודי|מסורתי|בינוני|דרום",
"זכרון יעקב":"מועצה מקומית|יהודי|חילוני|בינוני|חיפה",
"בנימינה":"מועצה מקומית|יהודי|חילוני|קטן|חיפה",
"פרדס חנה":"מועצה מקומית|יהודי|חילוני|בינוני|חיפה",
"קצרין":"מועצה מקומית|יהודי|מעורב|קטן|צפון",
"מצפה רמון":"מועצה מקומית|יהודי|מעורב|קטן|דרום",
"ערד":"עיר|יהודי|מעורב|בינוני|דרום",
"מעלות":"עיר|מעורב|מסורתי|בינוני|צפון",
"בית דגן":"מועצה מקומית|יהודי|מסורתי|קטן|מרכז",
"אזור":"מועצה מקומית|יהודי|חילוני|קטן|תל אביב",
"גני תקווה":"מועצה מקומית|יהודי|חילוני|בינוני|מרכז",
"כוכב יאיר":"מועצה מקומית|יהודי|חילוני|קטן|מרכז",
"שוהם":"מועצה מקומית|יהודי|חילוני|בינוני|מרכז",
"להבים":"מועצה מקומית|יהודי|חילוני|קטן|דרום",
"עומר":"מועצה מקומית|יהודי|חילוני|קטן|דרום",
"מיתר":"מועצה מקומית|יהודי|חילוני|קטן|דרום",
"כפר קאסם":"עיר|ערבי|מסורתי|בינוני|מרכז",
"ג'לג'וליה":"מועצה מקומית|ערבי|מסורתי|קטן|מרכז",
"קלנסווה":"עיר|ערבי|מסורתי|בינוני|מרכז",
"באקה אל-גרביה":"עיר|ערבי|מסורתי|בינוני|חיפה",
"דאלית אל-כרמל":"מועצה מקומית|דרוזי|מסורתי|קטן|חיפה",
"עוספיא":"מועצה מקומית|דרוזי|מסורתי|קטן|חיפה",
"יקנעם":"עיר|יהודי|חילוני|בינוני|צפון",
"נשר":"עיר|יהודי|חילוני|בינוני|חיפה",
"טירת כרמל":"עיר|יהודי|מסורתי|בינוני|חיפה",
"אור עקיבא":"עיר|יהודי|מסורתי|קטן|חיפה",
"חריש":"עיר|יהודי|מעורב|בינוני|חיפה",
"אפרת":"מועצה מקומית|יהודי|דתי|קטן|יהודה ושומרון",
"גבעת זאב":"מועצה מקומית|יהודי|מעורב|קטן|יהודה ושומרון",
"קרני שומרון":"מועצה מקומית|יהודי|מעורב|קטן|יהודה ושומרון",
"אלפי מנשה":"מועצה מקומית|יהודי|חילוני|קטן|יהודה ושומרון",
"בית אל":"מועצה מקומית|יהודי|דתי|קטן|יהודה ושומרון",
"כפר תבור":"מועצה מקומית|יהודי|חילוני|קטן|צפון",
"מג'אר":"מועצה מקומית|דרוזי|מסורתי|בינוני|צפון",
"ירכא":"מועצה מקומית|דרוזי|מסורתי|קטן|צפון",
"כפר ורדים":"מועצה מקומית|יהודי|חילוני|קטן|צפון",
"קרית טבעון":"מועצה מקומית|יהודי|חילוני|קטן|חיפה",
"עתלית":"יישוב קהילתי|יהודי|חילוני|קטן|חיפה",
"כפר יאסיף":"מועצה מקומית|ערבי|מעורב|קטן|צפון",
"אבו סנאן":"מועצה מקומית|מעורב|מסורתי|קטן|צפון",
"מזכרת בתיה":"מועצה מקומית|יהודי|חילוני|קטן|מרכז",
"גדרה":"מועצה מקומית|יהודי|מסורתי|בינוני|מרכז",
"קרית מלאכי":"עיר|יהודי|מסורתי|בינוני|דרום",
"גן יבנה":"מועצה מקומית|יהודי|חילוני|בינוני|מרכז",
"באר יעקב":"עיר|יהודי|מסורתי|בינוני|מרכז",
"בית ג'ן":"מועצה מקומית|דרוזי|מסורתי|קטן|צפון",
"דבוריה":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"כפר כנא":"מועצה מקומית|ערבי|מסורתי|בינוני|צפון",
"אכסאל":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"רכסים":"מועצה מקומית|יהודי|חרדי|קטן|חיפה",
"כפר קרע":"מועצה מקומית|ערבי|מסורתי|קטן|חיפה",
"ערערה":"מועצה מקומית|ערבי|מסורתי|בינוני|חיפה",
"כאבול":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"דיר אל-אסד":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"מג'ד אל-כרום":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"נחף":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"ראמה":"מועצה מקומית|מעורב|מסורתי|קטן|צפון",
"עראבה":"עיר|ערבי|מסורתי|בינוני|צפון",
"דיר חנא":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"מעיליא":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"פקיעין":"מועצה מקומית|דרוזי|מסורתי|קטן|צפון",
"חורפיש":"מועצה מקומית|דרוזי|מסורתי|קטן|צפון",
"ראש פינה":"מועצה מקומית|יהודי|חילוני|קטן|צפון",
"חצור הגלילית":"מועצה מקומית|יהודי|מסורתי|קטן|צפון",
"יסוד המעלה":"מועצה מקומית|יהודי|חילוני|קטן|צפון",
"מטולה":"מועצה מקומית|יהודי|חילוני|קטן|צפון",
"שלומי":"מועצה מקומית|יהודי|מסורתי|קטן|צפון",
"בועיינה":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"כפר מנדא":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"עילבון":"מועצה מקומית|ערבי|מסורתי|קטן|צפון",
"תמרה":"עיר|ערבי|מסורתי|בינוני|צפון",
"מבשרת ציון":"מועצה מקומית|יהודי|מעורב|בינוני|ירושלים",
"בית חורון":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון",
"צור הדסה":"יישוב קהילתי|יהודי|מעורב|קטן|ירושלים",
"קרית ענבים":"קיבוץ|יהודי|חילוני|קטן|ירושלים",
"אבן יהודה":"מועצה מקומית|יהודי|חילוני|קטן|מרכז",
"תל מונד":"מועצה מקומית|יהודי|חילוני|קטן|מרכז",
"קדימה":"מועצה מקומית|יהודי|חילוני|בינוני|מרכז",
"צורן":"מועצה מקומית|יהודי|חילוני|קטן|מרכז",
"פרדסיה":"מועצה מקומית|יהודי|חילוני|קטן|מרכז",
"בית יצחק":"מושב|יהודי|חילוני|קטן|מרכז",
"עמק חפר":"מועצה אזורית|יהודי|חילוני|בינוני|מרכז",
"כפר ויתקין":"מושב|יהודי|חילוני|קטן|מרכז",
"נהלל":"מושב|יהודי|חילוני|קטן|צפון",
"רמת ישי":"מועצה מקומית|יהודי|חילוני|קטן|צפון",
"מגידו":"קיבוץ|יהודי|חילוני|קטן|צפון",
"עין השופט":"קיבוץ|יהודי|חילוני|קטן|צפון",
"דליה":"קיבוץ|יהודי|חילוני|קטן|חיפה",
"כפר גלעדי":"קיבוץ|יהודי|חילוני|קטן|צפון",
"דן":"קיבוץ|יהודי|חילוני|קטן|צפון",
"חולתה":"קיבוץ|יהודי|חילוני|קטן|צפון",
"עמיעד":"קיבוץ|יהודי|חילוני|קטן|צפון",
"כורזים":"יישוב קהילתי|יהודי|חילוני|קטן|צפון",
"כנרת":"מושב|יהודי|חילוני|קטן|צפון",
"דגניה":"קיבוץ|יהודי|חילוני|קטן|צפון",
"אשדות יעקב":"קיבוץ|יהודי|חילוני|קטן|צפון",
"גשר":"קיבוץ|יהודי|חילוני|קטן|צפון",
"מעלה גלבוע":"קיבוץ|יהודי|דתי|קטן|צפון",
"בית אלפא":"קיבוץ|יהודי|חילוני|קטן|צפון",
"שדה אליהו":"קיבוץ|יהודי|דתי|קטן|צפון",
"טירת צבי":"קיבוץ|יהודי|דתי|קטן|צפון",
"נאות הכיכר":"מושב|יהודי|חילוני|קטן|דרום",
"עין גדי":"קיבוץ|יהודי|חילוני|קטן|דרום",
"ערוער":"מועצה מקומית|בדואי|מסורתי|קטן|דרום",
"כסייפה":"מועצה מקומית|בדואי|מסורתי|בינוני|דרום",
"תל שבע":"מועצה מקומית|בדואי|מסורתי|בינוני|דרום",
"שגב שלום":"מועצה מקומית|בדואי|מסורתי|קטן|דרום",
"חורה":"מועצה מקומית|בדואי|מסורתי|בינוני|דרום",
"לקיה":"מועצה מקומית|בדואי|מסורתי|קטן|דרום",
"משאבי שדה":"קיבוץ|יהודי|חילוני|קטן|דרום",
"שדה בוקר":"קיבוץ|יהודי|חילוני|קטן|דרום",
"רביבים":"קיבוץ|יהודי|חילוני|קטן|דרום",
"צאלים":"קיבוץ|יהודי|חילוני|קטן|דרום",
"אשלים":"יישוב קהילתי|יהודי|חילוני|קטן|דרום",
"יטבתה":"קיבוץ|יהודי|חילוני|קטן|דרום",
"קטורה":"קיבוץ|יהודי|חילוני|קטן|דרום",
"פארן":"מושב|יהודי|חילוני|קטן|דרום",
"חצבה":"מושב|יהודי|חילוני|קטן|דרום",
"עין יהב":"מושב|יהודי|חילוני|קטן|דרום",
"ניצנה":"יישוב קהילתי|יהודי|חילוני|קטן|דרום",
"אבשלום":"מושב|יהודי|חילוני|קטן|דרום",
"מגן":"קיבוץ|יהודי|חילוני|קטן|דרום",
"נירים":"קיבוץ|יהודי|חילוני|קטן|דרום",
"כפר עזה":"קיבוץ|יהודי|חילוני|קטן|דרום",
"ניר עם":"קיבוץ|יהודי|חילוני|קטן|דרום",
"יד מרדכי":"קיבוץ|יהודי|חילוני|קטן|דרום",
"ניצן":"מושב|יהודי|דתי|קטן|דרום",
"בית חנן":"מושב|יהודי|חילוני|קטן|מרכז",
"רינתיה":"מושב|יהודי|דתי|קטן|מרכז",
"נחלים":"מושב|יהודי|דתי|קטן|מרכז",
"כפר סירקין":"מושב|יהודי|חילוני|קטן|מרכז",
"גבעת חן":"מושב|יהודי|חילוני|קטן|מרכז",
"בית ברל":"יישוב קהילתי|יהודי|חילוני|קטן|מרכז",
"צופית":"מושב|יהודי|חילוני|קטן|מרכז",
"נירית":"יישוב קהילתי|יהודי|חילוני|קטן|מרכז",
"אלקנה":"מועצה מקומית|יהודי|דתי|קטן|יהודה ושומרון",
"עמנואל":"מועצה מקומית|יהודי|חרדי|קטן|יהודה ושומרון",
"קרית ארבע":"מועצה מקומית|יהודי|דתי|קטן|יהודה ושומרון",
"כרמל":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון",
"מעון":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון",
"תקוע":"יישוב קהילתי|יהודי|מעורב|קטן|יהודה ושומרון",
"כפר אדומים":"יישוב קהילתי|יהודי|מעורב|קטן|יהודה ושומרון",
"ענתות":"יישוב קהילתי|יהודי|חילוני|קטן|יהודה ושומרון",
"כוכב השחר":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון",
"שילה":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון",
"עלי":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון",
"ברקן":"יישוב קהילתי|יהודי|חילוני|קטן|יהודה ושומרון",
"יקיר":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון",
"פדואל":"יישוב קהילתי|יהודי|דתי|קטן|יהודה ושומרון"};
/* מאפייני יישוב כאובייקט; יישוב בלי שורה בטבלה מקבל "לא ידוע" בכל ציר. נקרא פעם אחת לכל יישוב ונשמר:
   מסך היישובים משווה כל יישוב במסמך לכל יישוב באטלס, ופירוק השורה מחדש בכל השוואה לקח יותר משנייה
   (המעבר מצעד 2 לצעד 3 בסיור, 8.10). האובייקט קפוא: מי שקורא לכאן רק קורא. */
const ATLAS_SEEN=new Map();
function atlasTags(name){
  let o=ATLAS_SEEN.get(name);
  if(o)return o;
  const raw=ATLAS_TAGS[name]; o={};
  const parts=raw?raw.split("|"):[];
  ATLAS_KEYS.forEach((k,i)=>{o[k]=parts[i]||"לא ידוע";});
  Object.freeze(o); ATLAS_SEEN.set(name,o);
  return o;
}
// כפרי מול עירוני: מושב, קיבוץ ויישוב קהילתי דומים זה לזה יותר מלעיר
const ATLAS_RURAL=new Set(["מושב","קיבוץ","יישוב קהילתי","מועצה אזורית"]);
/* מחיר אי-ההתאמה בין שני יישובים, ביחידות של קילומטר, כדי שיתחבר לציון
   המרחק. אוכלוסייה שונה היא הפער שאסור לגשר עליו: עיר ערבית לא הופכת לעיר
   יהודית ולהפך, בשום מרחק. אחריה דת, ואז עירוני מול כפרי, ואז גודל. */
function atlasPenalty(a,b){
  const ta=atlasTags(a), tb=atlasTags(b);
  if(ta["אוכלוסייה"]!==tb["אוכלוסייה"])return Infinity;
  let p=0;
  if(ta["דת"]!==tb["דת"])p+=60;
  if(ATLAS_RURAL.has(ta["סוג"])!==ATLAS_RURAL.has(tb["סוג"]))p+=60;
  else if(ta["סוג"]!==tb["סוג"])p+=15;
  if(ta["גודל"]!==tb["גודל"])p+=30;
  return p;
}
// מה שונה בין המקור לתחליף, בשמות הצירים — למסך היישובים
function atlasDiff(a,b){
  const ta=atlasTags(a), tb=atlasTags(b);
  return ATLAS_KEYS.filter(k=>k!=="אזור"&&ta[k]!==tb[k]);
}
/* ══════════ שכבת זיהוי: מודל עברי מקומי ══════════
   המודל מחליט על מה לשאול, לעולם לא מה להחליף. ההחלפה נשארת
   דטרמיניסטית ומבוססת על מה שהיא אישרה, וכך רף הכלי לא נקבע
   לפי דיוק של מודל.
   הפלט הגולמי דורש תיקון: המודל מקצץ תו בסוף כשיש אות שימוש
   בהתחלה ("במיש" במקום "במישל"), מחזיר תארים כישות נפרדת,
   ומסמן גם מוסדות ציבוריים שאין טעם להשחיר. */
/* \u05d1\u05d9\u05e7\u05d5\u05e8\u05ea QA (ISSUE-002): \u05d2\u05e8\u05e9 \u05d1\u05e1\u05d5\u05e3 \u05e9\u05dd \u05de\u05e9\u05e4\u05d7\u05d4 \u05d4\u05d5\u05d0 \u05d7\u05dc\u05e7 \u05de\u05d4\u05de\u05d9\u05dc\u05d4 \u2014 "\u05d1\u05e8\u05e7\u05d5\u05d1\u05d9\u05e5\u05f3", "\u05d0\u05d1\u05e8\u05de\u05d5\u05d1\u05d9\u05e5\u05f3",
   "\u05d2\u05f3\u05d5\u05e8\u05d2\u05f3". \u05d4\u05e7\u05d9\u05e6\u05d5\u05e5 \u05d4\u05d9\u05e9\u05df \u05d4\u05d5\u05e8\u05d9\u05d3 \u05d0\u05d5\u05ea\u05d5 \u05e2\u05dd \u05d4\u05e4\u05d9\u05e1\u05d5\u05e7, \u05d4\u05e9\u05dd \u05e0\u05e9\u05de\u05e8 \u05d1\u05dc\u05d9 \u05d2\u05e8\u05e9, \u05dc\u05d0 \u05d4\u05ea\u05d0\u05d9\u05dd \u05dc\u05de\u05e1\u05de\u05da,
   \u05d5\u05e0\u05e9\u05d0\u05e8 \u05d1\u05e4\u05dc\u05d8. \u05de\u05e1\u05d9\u05e8\u05d9\u05dd \u05e4\u05d9\u05e1\u05d5\u05e7 \u05de\u05d4\u05d6\u05e0\u05d1 \u05ea\u05d5-\u05ea\u05d5, \u05d5\u05e2\u05d5\u05e6\u05e8\u05d9\u05dd \u05e2\u05dc \u05d2\u05e8\u05e9 \u05e9\u05e6\u05de\u05d5\u05d3 \u05dc\u05d0\u05d5\u05ea \u05e2\u05d1\u05e8\u05d9\u05ea. */
const trimEdges=s=>{
  let v=(s||"").replace(/^[\s,.;:()\[\]"'\u05f3\u05f4\u2019-]+/,"");
  for(;;){
    if(!/[\s,.;:()\[\]"'\u05f3\u05f4\u2019-]$/.test(v))break;
    const ch=v[v.length-1];
    if(/['\u05f3\u2019]/.test(ch)&&/[\u05d0-\u05ea]/.test(v[v.length-2]||""))break;
    v=v.slice(0,-1);
  }
  return v.trim();
};
const PUBLIC_ORG=/^(?:בי?ת ה?משפט|שרת? ה|לשכת ה|בתי המשפט|משרד ה|ה?כנסת|ועד[תה]\s|הוועד[הת]|המוסד לביטוח|ביטוח לאומי|הביטוח הלאומי|משטרת ישראל|צה"ל|היועץ המשפטי?|היועצת המשפטית|הפרקליט|המפכ"ל|נציב|הממונה על|פרקליטות|רשות ה|המשרד ל|בנק ישראל|מס הכנסה)/u;
const NER_DROP=new Set(["מרח","מרח'","רח'","רחוב","שד'","ת.ז","ת\"ז","נ'","עמ'","סע'","בע\"מ","הנ\"ל",
  // הכינויים המשפטיים אינם אנשים; המודל מציע אותם כשם
  "פלוני","פלונית","אלמוני","אלמונית","פלונים"]);
// מילות יחס וזמן שהמודל גורר לסוף של מקום או גוף ("הפרדס בעקבות")
const TRAIL=new Set(["לרבות","למעט","כולל","בימי","ביום","בשעות","בשעה","בעקבות","לאחר","לפני","אחרי","בגלל","למרות","כדי","עם","אל","על","של","ליד","מול","בין",
  "תחת","בתוך","מתוך","לכיוון","בשעה","ביום","היום","אתמול","מחר","כאשר","אם","כי","אבל","או","גם","רק","עוד",
  "כבר","שם","כאן","פה","בדרך","בזמן","במשך","בסוף","בתחילת","באמצע","סמוך","קרוב","רחוק"]);
const NER_HEADS=new Set(["עמותת","עמותה","מעון","מרפאת","מכון","קרן","מרכז","אגודת","חברת","לשכת","משרד","פנימיית","ישיבת","רחוב","שדרות","שכונת","סמטת","דרך","כיכר","ככר","מעלה","משעול","כפר","קרית","גני","נווה","מבוא"]);
const NER_KIND={PER:"NAME",ORG:"ORG",GPE:"PLACE",LOC:"PLACE",FAC:"PLACE"};
// זיהוי בלבד, לא ייצור: כאן מותר שיהיו שמות שכיחים שלא נרצה להמציא
const KNOWN_FIRST=new Set([...FEM,...MASC,...WORDLIKE,...POOL.he_f,...POOL.he_m,
 ...POOL.ar_f,...POOL.ar_m,"יוסי","מישל","בתיה","איתי","רמי","גלית","דלית","טלי","צפרא",
 "אתי","זיוה","ניצה","חנה","שלוה","שלווה","עדינה","הלל","דודו","אלמז","סמאח","מיה",
 "נעמה","אורית","שלומית","דליה","אריה","מרדכי","יחיאל","קארין","שמעון","יעקב","אורלי"]);
// חלוקה לקטעים: BERT מוגבל ל-512 טוקנים, וצריך לשמור היסטים מדויקים
// כדי לתקן גבולות אחר כך. שני כשלים אורבים כאן, ושניהם שקטים: קטע
// ארוך מדי נחתך ע"י המודל ומאבד את הזנב, וקטע קצר מדי מכפיל את מספר
// ההרצות — פסקה לכל קטע היא מאות הרצות למסמך ארוך, דקות של המתנה.
// לכן אורזים משפטים ופסקאות יחד עד המגבלה, וחותכים בכוח רק מה שבאמת
// ארוך מדי. הפריסה נעשית על הטקסט המקורי, כך שההיסטים נשארים נכונים.
function nerChunks(text,limit=800){
  const units=[];
  const hard=(s,e)=>{
    const OV=60; let i=s;
    while(i<e){
      let end=Math.min(i+limit,e);
      if(end<e){const sp=text.lastIndexOf(" ",end); if(sp>i+limit*0.5)end=sp}
      units.push([i,end,true]);
      if(end>=e)break;
      i=Math.max(end-OV,i+1);
      while(i<e&&text[i]!==" ")i++;
      i++;
    }
  };
  let cur=0;
  for(const para of text.split("\n")){
    let base=text.indexOf(para,cur);
    if(base<0)base=cur;          // לא אמור לקרות; לא נותנים להיסט להישבר
    cur=base+para.length+1;
    if(!para.trim())continue;
    let p=0;
    for(const part of para.split(/(?<=[.!?])\s+/)){
      if(!part.trim())continue;
      const i=para.indexOf(part,p); if(i<0)continue;
      const s=base+i,e=s+part.length; p=i+part.length;
      if(e-s>limit)hard(s,e); else units.push([s,e,false]);
    }
  }
  const out=[]; let ws=null,we=null;
  for(const [s,e,isHard] of units){
    if(isHard){
      if(ws!==null){out.push({t:text.slice(ws,we),off:ws});ws=null}
      out.push({t:text.slice(s,e),off:s}); continue;
    }
    if(ws===null){ws=s;we=e;continue}
    if(e-ws<=limit){we=e;continue}
    out.push({t:text.slice(ws,we),off:ws}); ws=s; we=e;
  }
  if(ws!==null)out.push({t:text.slice(ws,we),off:ws});
  return out}
function nerClean(ents,text,opt){
  // 0.7 נקבע בהרגשה. הסריקה (bench/sweep.md) על 30 מסמכים: 0.6 נותן דליפה אחת פחות
  // מ-0.7 בלי הצעה עודפת נוספת; 0.3–0.5 כמו 0.6; 0.9 מכפיל את הדליפות.
  const min=(opt&&opt.min)||0.6;
  const tok=new Set((norm(text).match(WRX)||[]));
  const seen=new Map();
  for(const e of ents){
    if(!NER_KIND[e.type]||e.score<min)continue;
    // ── תיקון הקיצוץ: מרחיבים כל קצה עד גבול מילה בטקסט המקורי ──
    // גבול מילה הוא אות או ניקוד. ״ ו-־ יושבים בטווח העברי, ובלי ההבחנה "״מיכל ברנע״" נקרא
    // כמילה שנחתכה ו-מ קולפה, ו"המורה־מיכל" נבלע לתוך השם (שכבה 1ב, אותו סוג כמו המירכאות
    // ב-v41). סימן בתוך מילה נכלל רק בצורה שהעברית כותבת אותו: גרשיים לפני האות האחרונה
    // של ראשי תיבות (צה״ל, עו"ד), וגרש אחרי ג, ז, צ או ת (ג׳ורג׳). "ב״חיפה״" הוא ציטוט.
    const LET=/[֑-ֽֿ-ׇא-ת]/, isL=k=>k>=0&&k<text.length&&LET.test(text[k]);
    const inner=k=>{const c=text[k];
      if(c==='"'||c==='״')return isL(k-1)&&isL(k+1)&&!isL(k+2);
      if(c==="'"||c==='׳')return /[גזצץת]/.test(text[k-1]||"");
      return false};
    let s=e.s,en=e.e;
    while(s>0&&(isL(s-1)||(inner(s-1)&&isL(s-2))))s--;
    const endWas=en;
    while(en<text.length&&(isL(en)||(inner(en)&&isL(en-1))))en++;
    // המודל מקצץ בסוף בדיוק כשהוא בלע אות שימוש בהתחלה. ההארכה בסוף
    // היא לכן העדות הטובה ביותר לכך שהאות הראשונה אינה חלק מהשם.
    const wasCut=en>endWas;
    let v=trimEdges(text.slice(s,en));
    if(!v||v.length<2)continue;
    // ── קילוף אות שימוש ──
    // "המוסד לביטוח לאומי": הקילוף לפי ראש מוסד ("מוסד") הפך גוף ציבורי לגוף
    // פרטי לכאורה. הצורה שלפני הקילוף נשמרת ונבדקת גם היא מול הגופים הציבוריים.
    const v0=v;
    const w=v.split(/\s+/), f=norm(w[0]);
    if(PFX.has(f[0])&&f.length>=4){
      const stem=f.slice(1);
      const elsewhere=tok.has(stem)||[...PFX].some(q=>q!==f[0]&&tok.has(q+stem));
      // "לכוכב יאיר" מופיע פעם אחת ו"כוכב יאיר" לא — אבל מאגר היישובים
      // יודע שזה יישוב, וזו עדות טובה יותר מספירת הופעות
      const bare=[stem,...w.slice(1)].join(" ");
      const known=!!PLACE_BY[norm(bare)]||KNOWN_FIRST.has(stem);
      // "בעמותת שביל הלב", "ברחוב הארזים": כשהגזע הוא ראש של גוף או של מקום,
      // האות הראשונה היא אות שימוש גם בלי שהגזע מופיע במקום אחר.
      // "בבית ספר אורט", "לחסידות נורבין": גם ראש של מוסד או של קבוצה הוא עדות.
      // "בקריית אתא" (L14 בביקורת השנייה): יישוב שמילתו הראשונה היא ראש של שם יישוב —
      // קריית, כפר, גבעת, רמת, נווה… — מקבל את אות השימוש כאות שימוש גם כשהכתיב אינו
      // במאגר; אחרת ה-ב' נכנסה לערך והוחלפה יחד עם השם ("מתגוררת תקוע")
      const SETTLE=/^(?:קריית|קרית|כפר|גבעת|רמת|נווה|נוה|מעלה|מצפה|גני|שדה|שדות|תל|ראש|מגדל|עין|אבן|נחלת|בית)$/;
      const headPeel=NER_HEADS.has(stem)||
        (NER_KIND[e.type]==="PLACE"&&w.length>1&&SETTLE.test(stem))||
        (typeof ORG_HEADS!=="undefined"&&ORG_HEADS.test(norm(bare)))||
        (typeof GROUP_HEADS!=="undefined"&&GROUP_HEADS.test(norm(bare)));
      if(wasCut||elsewhere||known||headPeel){
        w[0]=w[0].slice(w[0].length-f.length+1); v=trimEdges(w.join(" "));
      }
      // שתי אותיות שימוש ("ולמיכל", "כשחיפה", "ובאלונים"): הקילוף של אות אחת השאיר את
      // השנייה בערך. זוגות שהעברית כותבת בלבד, ואותן עדויות על הגזע שאחרי שתיהן (שכבה 4).
      else if(f.length>=5&&/^(?:ו[בהלמכ]|כש|מה|לכ)/.test(f)){
        const stem2=f.slice(2), bare2=[stem2,...w.slice(1)].join(" ");
        const ev2=tok.has(stem2)||!!PLACE_BY[norm(bare2)]||KNOWN_FIRST.has(stem2)||NER_HEADS.has(stem2)||
          (typeof ORG_HEADS!=="undefined"&&ORG_HEADS.test(norm(bare2)));
        if(ev2){ w[0]=w[0].slice(w[0].length-f.length+2); v=trimEdges(w.join(" ")); }
      }
    }
    // פיסוק של סוף משפט אינו חלק משם. אם נשאר כזה בתוך המקטע, שומרים את
    // החלק שאחרי הפיסוק האחרון: שם שהמודל הדביק לו את סוף המשפט הקודם.
    if(/[.!?:;\n]/.test(v)){const parts=v.split(/[.!?:;\n]+/).map(x=>trimEdges(x)).filter(Boolean); v=parts.length?parts[parts.length-1]:"";}
    // מילה בודדת שהיא מילת עצירה, מילה נפוצה או פועל אינה שם: "אני", "השופט",
    // "לבד". בתמלול "אני" מסומן כשם שוב ושוב, וכל משפט בגוף ראשון נהרס.
    // תואר בתחילת המקטע אינו חלק מהשם: "עו\"ד יערה" הוא "יערה". בלי זה המקטע
    // המודבק מאושר כשם שני לצד "יערה ליפשיץ", ושם המשפחה לבדו נחשב משותף ולא מוחלף.
    if(v)v=trimEdges(v.replace(TITLE_RX,""));
    // "כאמור עמרי", "משכך עמרי": מילת קישור בראש המקטע אינה חלק מהשם
    if(v){let ws=v.split(/\s+/); while(ws.length>1&&LEAD.has(norm(ws[0])))ws.shift(); v=ws.join(" ");}
    if(v&&!/\s/.test(v)&&(STOP.has(v)||COMMON.has(v)||VRB.has(v)||STOP.has(norm(v))||COMMON.has(norm(v))))continue;
    // "שדוברת רוסית": אות שימוש על פועל או מילה נפוצה בראש המקטע אינה שם
    if(v){const fw=norm(v.split(/\s+/)[0]), st=fw.slice(1);
      if(fw.length>=4&&PFX.has(fw[0])&&(VRB.has(st)||COMMON.has(st)))continue;
      // ש + בינוני או תואר ("שדוברת", "שגרים", "שעובדות"): מילת זיקה, לא שם — אלא אם הגזע הוא שם ("שרות")
      if(fw.length>=5&&fw[0]==="ש"&&/(?:ת|ות|ים)$/.test(st)&&!KNOWN_FIRST.has(st)&&!FEM.has(st)&&!MASC.has(st))continue;}
    // "אפוטרופא לדין", "משה אפטרופא": מילת תפקיד בכל צורה אינה שם, לבדה או בקצה
    if(v&&v.split(/\s+/).every(w=>ROLEWORD.test(norm(w))))continue;
    if(v){let ws=v.split(/\s+/); while(ws.length>1&&ROLEWORD.test(norm(ws[ws.length-1])))ws.pop(); while(ws.length>1&&ROLEWORD.test(norm(ws[0])))ws.shift(); v=ws.join(" ");}
    // המודל נדבק לימין: "אסתר להידחות" חזר כישות אחת. שם פועל או פועל בקצה
    // המקטע אינם חלק מהשם, כמו בשכבת גוף הטקסט (verbTail).
    if(v&&typeof verbTail==="function"){let ws=v.split(/\s+/); while(ws.length>1&&verbTail(ws[ws.length-1]))ws.pop(); v=ws.join(" ");}
    if(!v||v.length<2||NER_DROP.has(v)||NER_DROP.has(norm(v)))continue;
    // "33" הוצע כשם גוף והוחלף. ערך בלי אות עברית אחת אינו שם של גוף או אדם.
    if(!/[֐-׿]/.test(v))continue;
    // "נ ג ד" מכותרת התיק חזר מהמודל כשם אדם
    {const vw=norm(v).split(/\s+/); if(vw.length>1&&vw.every(x=>x.replace(/['"׳״]/g,"").length<=1))continue;}
    let kind=NER_KIND[e.type];
    // "שחר - שירותי חברה רווחה משפחה" סומן כאדם. שם עם מקף מפריד או
    // חמש מילים ומעלה הוא גוף, ושם בדוי של אדם שם היה מבלבל.
    if(kind==="NAME"&&(/\s[-\u2013]\s/.test(v)||v.split(/\s+/).length>4))kind="ORG";
    // ראש של גוף (עמותת, מעון, מרפאת…) באמצע המקטע: מה שלפניו הודבק מהמשפט,
    // "משרד עמותת שביל הלב". חותכים לפני הראש, אחרת הכלל תופס רק את הצורה המודבקת.
    if(kind==="ORG"){const m=/(?:^|\s)(עמותת|עמותה|מעון|מרפאת|מכון|קרן|מרכז|אגודת|חברת|בית ספר|בי"ס|ביה"ס|גן ילדים|פנימיית|ישיבת)\s/u.exec(v); if(m&&m.index>0)v=v.slice(m.index+1);}
    // גוף לפי כללי ראש, בלי רשימה סגורה: קבוצה רחבה (חסידות, תנועה, מפלגה, זרם,
    // עדה, קהילה) אינה מזהה ואינה מוצעת; מוסד עם מילת סוג מוצע כרגיל; גוף בלי
    // אף אחד מהראשים — "נורבין" לבדו — עולה לבדיקה ולא נכנס לרשימה מעצמו.
    let orgReview=false;
    if(kind==="ORG"){
      const nv=norm(v).trim();
      if(typeof GROUP_HEADS!=="undefined"&&GROUP_HEADS.test(nv))continue;
      if(typeof ORG_HEADS!=="undefined"&&!ORG_HEADS.test(nv))orgReview=true;
    }
    // גם כשהמודל תפס רק קטע: "הרווחה" מתוך "משרד הרווחה". בודקים את הקטע עם
    // עד שתי המילים שלפניו בטקסט המקורי, אחרת גוף ציבורי מוצע ומושחר.
    if(kind!=="NAME"){const back=text.slice(Math.max(0,s-40),s).split(/\s+/).filter(Boolean).slice(-2); const strip1=x=>x.replace(/^[בהולמכש]/,""); const c2=norm([...back,v].join(" ")), c1=norm([...back.slice(-1),v].join(" ")); if([c2,strip1(c2),c1,strip1(c1)].some(x=>PUBLIC_ORG.test(x)))continue;}
    // בית משפט ומשרד ממשלתי אינם פרט מזהה, ואין טעם להציע אותם
    if(kind!=="NAME"&&PUBLIC_ORG.test(norm(v).replace(/^[\u05d1\u05d4\u05d5\u05dc\u05de\u05db\u05e9]/,"")))continue;
    if(kind!=="NAME"&&PUBLIC_ORG.test(norm(v)))continue;
    if(kind!=="NAME"&&(PUBLIC_ORG.test(norm(v0))||PUBLIC_ORG.test(norm(v0).replace(/^[בהולמכש]/,""))))continue;
    // "הפרדס בעקבות": המודל גרר את מילת היחס הבאה לתוך מקום. מילת יחס או פועל
    // בסוף גוף או מקום אינם חלק מהשם. רק מהסוף, ורק אחרי בדיקת הגופים
    // הציבוריים — חיתוך מההתחלה הפך את "משרד הרווחה" ל"הרווחה" והציע אותו.
    if(kind!=="NAME"){const ws=v.split(/\s+/); while(ws.length>1&&(TRAIL.has(norm(ws[ws.length-1]))||VRB.has(norm(ws[ws.length-1]))))ws.pop(); v=ws.join(" ");}
    const key=kind+"|"+norm(v);
    const g=seen.get(key)||{value:v,kind,score:0,n:0,s,e:en,review:orgReview,cut:false};
    g.n++; g.score=Math.max(g.score,e.score); if(wasCut)g.cut=true; seen.set(key,g);
  }
  // "רונית אזולאי" מכסה את "אזולאי" — לא מציעים את שניהם
  const all=[...seen.values()].sort((a,b)=>b.value.length-a.value.length);
  const keep=[];
  for(const x of all){
    const inside=keep.some(y=>y.kind===x.kind&&y.value!==x.value&&
      new RegExp(NW+esc(norm(x.value))+NWE,"u").test(norm(y.value)));
    if(!inside)keep.push(x);
  }
  return keep.sort((a,b)=>b.n-a.n||b.score-a.score)}

const STREET="(?:רחוב|רח'|(?<![א-ת]{2})רח(?:\\.|(?=\\s))|שדרות|שד'|סמטת|סמטה|דרך|שכונת|כיכר|ככר|מעלה|נחל|משעול)";
const D_DAY="(?:0?[1-9]|[12][0-9]|3[01])", D_MON="(?:0?[1-9]|1[0-2])",
  D_MONTH="(?:"+DATE_MON_ALT+")",
  // "רף ה-4.1 מיליון", "ה-2.5 חדרים": מספר עם יחידה אחריו אינו תאריך (49,700 משפטי iahlt, 9.10).
  // מילה שלמה, בכל נטייה שכתובה כאן: כתחילית, "שנ" תפס גם "שנקבע" ו"שניתנה", "שקל" את "שקלה" ו"מטר" את "מטרתו",
  // והתאריך שלפניהם דלף (ביקורת 11.10); ו"מיליון" לא תפס את "מיליוני". ש"ח גם בלי גרשיים ("2000 שח").
  // לא "חדר" ביחיד: אחרי מספר עשרוני חדרים נספרים ברבים ("3.5 חדרים"), ו"עד ה-12.3 חדר הנאשם לדירה" הוא תאריך
  D_UNIT='(?:מיליון|מיליונים|מיליוני|מיליארד|מיליארדים|מיליארדי|אלף|אלפים|אלפי|אחוז|אחוזים|אחוזי|חדרים|חדרי|ש"ח|ש\'\'ח|שח|₪|\\$|דולר|דולרים|יורו|שקל|שקלים|'+
    'ק"ג|ק"מ|מ"ר|ס"מ|מ"מ|מ"ג|מ"ל|מטר|מטרים|נקודה|נקודות|ליטר|ליטרים|גרם|גרמים|קילו|קילוגרם|קילוגרמים|קילומטר|קילומטרים|טון|טונות|דונם|דונמים|מעלות|פעמים)(?![א-ת])',
  /* אחרי שנה רק מטבע אומר שהמספר הוא סכום ("ביוני 2000 ש"ח"). יחידה אחרת היא פועל או ספירה: "במרץ 2026 חדר הנאשם
     לדירה", "ביולי 2025 פעמים רבות", "במרץ 2026 אלפי שקלים הועברו". עד כאן השנה לא נמצאה, והשנה האמיתית נשארה ליד
     יום שזז: אותו יום יצא כשני תאריכים בהפרש של שנה (ביקורת 11.10). לא "שקל" ביחיד, שהוא גם פועל */
  D_CUR='(?:ש"ח|ש\'\'ח|שח|₪|\\$|דולר|דולרים|יורו|שקלים)(?![א-ת])',
  /* יחידת זמן ("ה-3.5 ימים", "ה-2.5 שבועות", "ה-1.5 חודשי שכר", הציד של 11.10) רק אחרי חצי: כמות של זמן נכתבת כמעט
     תמיד x.5, ו"עד ה-12.3 ימים ספורים לפני הדיון" או "מה-1.9 שעות הביקור יורחבו" הם תאריך (ביקורת 11.10). ובצורת
     הספירה בלבד: לא "שבוע" ו"חודש" ביחיד ("עד ה-12.3 שבוע לפני"), לא זוגי ("שבועיים", שכבר אומר כמה), ולא "יום"
     ו"שעה" ("עד ה-12.3 שעה 12:00") */
  D_TIME="(?:ימים|ימי|שבועות|חודשים|חודשי|שנים|שנות|שנה|שעות|דקות|לילות)(?![א-ת])",
  // חודש ושנה במספרים ("03/2026")
  D_MY="(?:0?[1-9]|1[0-2])[./-](?:19|20)\\d{2}";
/* מספר של סעיף, תקנה או נספח בשלוש רמות ("סעיף 5.2.10", "תקנה 12.4.21") נראה כמו תאריך עם שנה בשתי ספרות, והוזז:
   "סעיף 5.9.10" בהסכם, וה-AI ציטט סעיפים שאינם בו (הציד של 11.10). מספר מיד אחרי מילת סעיף אינו תאריך, וגם לא
   מספר ברשימה שהפריט שלפניו בה באותה צורה ("בסעיפים 7.1.12 ו-7.1.13"). פריט בצורה אחרת לפניו הוא סוף הרשימה:
   "כאמור בסעיף 4 עד 31.12.26 ישלם" ו"נספח 3 – 12.3.26 – מכתב" הם תאריך (ביקורת 11.10). lv: מספר הרמות של המספר
   שאחרי. הרשימה עד 60 פריטים, והמבט לאחור רץ רק במקום שמתחיל בו מספר בצורת תאריך: בלי גבול, ובכל מקום בטקסט,
   שורה ארוכה של מספרים קצרים האטה את הזיהוי בריבוע (28 שניות על 28 אלף תווים) */
const D_CL_ITEM="\\d{1,3}(?:[./]\\d{1,3})*[א-ת]?(?:\\([א-ת0-9]{1,3}\\))*", D_CL_SEP="\\s*(?:,|ו|או|עד|ועד|-)-?\\s*";
/* אחרי מילה ברבים ("בסעיפים 4 ו-5.2.10", "בתקנות 3 ו-12.4.21") רשימה שמחוברת ב-ו או בפסיק ממשיכה בכל צורה: עד כאן
   פריט בצורה אחרת סיים אותה, ו"5.2.10" זז לתאריך שאינו בהסכם. אחרי מילה ביחיד נשארת אותה צורה, ו"עד" מסיים את
   הרשימה: "כאמור בסעיף 4.1.2 עד 31.12.26 ישלם" הוא תאריך, אלא כשהמספר שאחריו פותח באותו סעיף (clauseRange). שנה
   בארבע ספרות היא תמיד תאריך (ביקורת שנייה, 11.10) */
const D_CL_HEAD=w=>"(?<![א-ת])[ובלמהשכ]{0,3}"+w+"(?:\\s+(?:קטן|קטנים|משנה))?\\s*(?:מס'\\s*|מספר\\s*)?",
  D_CL_ONE="(?:סעיף|סע'|ס'|ס\"ק|תקנה|תקנת|תק'|פרק|נספח|פסקה|פסקת|פריט|גרסה|גרסת|גירסה|גירסת)",
  D_CL_MANY="(?:סעיפים|תקנות|פרקים|נספחים|פסקאות|פריטים)",
  D_CL_LIST="(?:"+D_CL_ITEM+D_CL_SEP+"){0,59}",
  D_CL_LAST=lv=>"\\d{1,3}(?:[./]\\d{1,3}){"+(lv-1)+"}[א-ת]?(?:\\([א-ת0-9]{1,3}\\))*";
const D_CLAUSE=lv=>"(?:"+D_CL_HEAD(D_CL_ONE)+"(?:"+D_CL_LIST+D_CL_LAST(lv)+"\\s*(?:,|ו|או|-)-?\\s*)?|"+
  D_CL_HEAD(D_CL_MANY)+"(?:"+D_CL_LIST+"(?:"+D_CL_LAST(lv)+D_CL_SEP+"|"+D_CL_ITEM+"\\s*(?:,|ו|או)-?\\s*))?)";
const D_UNTIL_END=new RegExp("(?:"+D_CL_HEAD(D_CL_ONE)+"|"+D_CL_HEAD(D_CL_MANY)+")"+D_CL_LIST+
  "(\\d{1,3})(?:[./]\\d{1,3})*[א-ת]?(?:\\([א-ת0-9]{1,3}\\))*\\s*ו?עד-?\\s*$","u");
// "בסעיף 4.1.2 עד 4.1.15" הוא טווח של סעיפים: המספר שאחרי "עד" פותח באותו סעיף שלפניו (pre: הטקסט שלפני v)
function clauseRange(pre,v){ const m=D_UNTIL_END.exec(pre); return !!m&&/^\d{1,3}[./]/.test(v)&&+v.split(/[./]/)[0]===+m[1]; }
// תאריך במספרים עם שנה בשתי ספרות שהוא סוף טווח של סעיפים (validator של DATE; n ו-i: הטקסט ומקום ההתאמה)
const notClauseRange=(v,n,i)=>!(n!=null&&/^\d{1,3}[./]\d{1,3}[./]\d{2}$/.test(v)&&clauseRange(n.slice(Math.max(0,i-120),i),v));
const D_CLAUSE_END={2:new RegExp(D_CLAUSE(2)+"$","u"),3:new RegExp(D_CLAUSE(3)+"$","u")},
  D_UNIT_AT=new RegExp("^\\s*(?:%|"+D_UNIT+")","u"), D_TIME_AT=new RegExp("^\\s*"+D_TIME,"u"),
  D_VERB_AT=/^\s*(?:גרם|שקל)(?![א-ת])/u, D_CUR_AT=new RegExp("^\\s*"+D_CUR,"u");
/* תאריך במספרים, באותו מפריד פעמיים ("1.2.2026/3.2.2026" הם שניים). שנה בארבע ספרות לעולם אינה מספר סעיף, והיא
   תאריך גם כשנקודה וספרה אחריה: סימן הערת שוליים אחרי הנקודה של המשפט ("ביום 12.3.2026.3", ביקורת 11.10). שנה
   בשתי ספרות: לא חלק ממספר ארוך יותר ("1.2.10.3") */
const D_NUM4=sep=>`(?<![0-9]${sep})\\d{1,2}${sep}\\s?\\d{1,2}${sep}\\s?\\d{4}`,
  D_NUM2=sep=>`(?<![0-9]${sep})\\d{1,2}${sep}\\d{1,2}${sep}\\d{2}(?!${sep}[0-9])`;
/* ערך של תאריך שנמצא, במקום אחר בטקסט (n מנורמל): מספר סעיף, כמות עם יחידה, או חלק ממספר ארוך יותר ("1.2.10.3")
   אינם התאריך. מעבר האחידות לא מחליף שם, והבדיקה האחרונה לא קוראת לזה תאריך שנשאר: עד כאן "ביום 12.3" הזיז
   גם את "סעיף 12.3" שבאותו מסמך. אותם כללים כמו בזיהוי: שנה בארבע ספרות היא תמיד תאריך, ויחידת זמן רק אחרי חצי.
   המעבר והבדיקה קוראים את הטקסט עם התווים הבלתי נראים (\0 ב-norm), ולכן הם יוצאים מההקשר כאן */
function notDateAt(n,s,e){
  const v=n.slice(s,e).replace(/\u0000/g,""), pre=n.slice(Math.max(0,s-120),s).replace(/\u0000/g,""), post=n.slice(e,e+24).replace(/\u0000/g,"");
  if(/[0-9][./]$/.test(pre))return true;
  // חודש ושנה במילים לפני מטבע הם חודש וסכום ("לחודש יוני 2000 ש"ח"), כמו בזיהוי, גם כשיוני 2000 תאריך במקום אחר
  if(/^[^0-9].*[0-9]{4}$/.test(v)&&D_CUR_AT.test(post))return true;
  if(/[0-9]{4}$/.test(v))return false;
  if(/^[./][0-9]/.test(post))return true;
  const lv=/^\d{1,2}[./]\d{1,2}$/.test(v)?2:/^\d{1,2}[./]\d{1,2}[./]\d{2}$/.test(v)?3:0;
  // "גרם" ו"שקל" הם גם פועל: "ב-12.3 גרם הנאשם נזק" הוא תאריך, "החזיק 12.3 גרם" כמות (ביקורת שנייה, 11.10)
  const unit=D_UNIT_AT.test(post)&&!(D_VERB_AT.test(post)&&/(?:^|[^א-ת])ו?[במל]-?$/.test(pre));
  if(lv===2&&(unit||/\.5$/.test(v)&&D_TIME_AT.test(post)))return true;
  return !!lv&&(D_CLAUSE_END[lv].test(pre)||clauseRange(pre,v));
}
// פועל של מגורים לפני כתובת בלי מילת רחוב (ADDRESS_LABELED), ומה שבא אחריו ואינו רחוב
const RES_VERB="גר|גרה|גרים|גרות|גרו|מתגורר|מתגוררת|מתגוררים|מתגוררות|התגורר|התגוררה|התגוררו|המתגורר|המתגוררת|המתגוררים|"+
  "המתגוררות|מקום\\s+מגורי(?:ו|ה|הם|הן)";
const NOT_STREET=new Set(["קומה","קומת","דירה","דירת","בניין","בנין","בית","חדר","חדרים","כיתה","מספר","אזור","מושב","קיבוץ",
  "יישוב","ישוב","כפר","עיר","שכונה","מקום","מגדל","מבנה","אגף","קרוון","מרתף","יחידה","יחידת","שנת","גיל","מעון","פנימייה","משק","נחלה","נחלת",
  "פנימיה","מוסד","הוסטל","בסיס","מחנה","אותה","אותו","אותם","אותן","זה","זו","חו\"ל","חוץ"]);
// הכתובת אחרי פועל של מגורים אינה יישוב ("גרה בחיפה 3", "בתל אביב 3") ואינה קומה, דירה או בניין
function addrOK(v,n,i){
  const t=String(v||""); if(!new RegExp(`^ו?(?:${RES_VERB})\\s`,"u").test(t))return true;
  const m=/\sב-?([א-ת"'-]+)(?:\s+([א-ת"'-]+))?/u.exec(t); if(!m)return false;
  if(NOT_STREET.has(m[1]))return false;
  return !(PLACE_BY[m[1]]||(m[2]&&PLACE_BY[m[1]+" "+m[2]]))}
/* מספר תיק בכל סוג תיק (הציד של 11.10): עד כאן רק עשרה סוגים, ואף לא אחד מסוגי התיקים של בית המשפט
   לענייני משפחה מלבד תמ"ש ועמ"ש. ראשי התיבות נשארים (הם אומרים ל-AI איזה הליך זה), המספר נמחק. */
const COURT='תלה"מ|תמ"ש|עמ"ש|רמ"ש|בע"מ|ה"ט|י"ס|ת"ע|תה"ס|ת"א|תא"מ|תא"ק|ת"ק|ת"פ|תפ"ח|ת"צ|ע"א|ע"פ|רע"א|רע"פ|בר"ע|ע"מ|ה"פ|בג"ץ|בג"צ|עת"מ|עע"ם|ע"ע|ס"ע|ב"ל|בש"א|בש"פ|פש"ר|חדל"פ|עש"א';
const PAT=[
 ["EMAIL",'כתובת דוא"ל',`(?<![\\w.%+])[\\w%+][\\w.%+-]*@[\\w.-]+\\.[A-Za-z\u05d0-\u05ea]{2,}`,0,null,0,1],
 // תאריך מלא. עד כאן תאריכים לא זוהו בכלל (רק תאריך לידה אחרי "יליד"), והמשתמשת ביקשה
 // שתאריכים ומספרי תיק יושמטו מאליהם. תאריך מושמט כברירת מחדל, ובכל כרטיס אפשר
 // להשאיר אותו. גיל ("בת 9") אינו תאריך ואינו נתפס כאן.
 // ועוד כל כתיב רגיל אחר (9.10, parseDate): במקפים, שנה קודם, במילים, ובלי שנה. יום וחודש במספרים
 // בלי שנה נראים כמו "סעיף 12.3" או "2.5 מיליון", ולכן הם תאריך רק אחרי מילה שמבשרת תאריך; שם של
 // חודש הוא ראיה מספיקה בעצמו.
 // ועוד (11.10): אותו מפריד פעמיים, רווח אחרי המפריד כשהשנה בארבע ספרות, לא מספר סעיף ולא חלק ממספר ארוך;
 // "לחודש"/"בחודש" ו"שנת" במילים, ולא שבר של מספר עשרוני ("מדד של 4.8 בחודש ינואר", 49,700 משפטי iahlt);
 // חודש ושנה במילים (לא אחרי יום, גם לא יום שאינו תקין: "32 במרץ 2026"), ובמספרים
 // רק אחרי "חודש" או "תאריך"; ויחידה אחרי יום וחודש רק אחרי ה- ומה-, כי "תאריך: 12.3 שעה 10:00" הוא תאריך.
 // מספר אחרי שם של חודש אינו שנה כשמטבע או יחידה אחריו ("ביוני 2000 ש"ח", "בנובמבר 1950 ₪"), וגם לא כשטאב או
 // מעבר שורה ביניהם (טבלה של חודש וסכום): עד כאן החודש זז, והסכום השתנה כשההזזה עברה שנה (ביקורת 11.10).
 // סימני כיוון ומקף רך יוצאים לפני הזיהוי (squeeze, v73.6), והמקף העברי הוא "-" ב-norm: אין כאן \0.
 // בדיקה מוקדמת של צורת הערך ((?=…)) לפני כל מבט לאחור יקר, כדי שלא ירוץ בכל מקום בטקסט. רשימה של חודש ושנה
 // במספרים: עד 120 פריטים אחרי המילה (עשר שנים של תלושים); בלי גבול, רשימה ארוכה הייתה ריבועית (ביקורת 11.10)
 ["DATE","תאריך",`${NW}(?:${D_NUM4("\\.")}|${D_NUM4("/")}|\\d{1,2}\\.\\d{1,2}/\\d{4}|\\d{1,2}/\\d{1,2}\\.\\d{4})${NWE}|`+
   `${NW}(?=\\d{1,2}[./]\\d{1,2}[./]\\d{2}(?![0-9]))(?<!${D_CLAUSE(3)})(?:${D_NUM2("\\.")}|${D_NUM2("/")}|\\d{1,2}\\.\\d{1,2}/\\d{2}|\\d{1,2}/\\d{1,2}\\.\\d{2})${NWE}|`+
   `${NW}${D_DAY}-${D_MON}-\\d{4}${NWE}|${NW}(?=\\d{1,2}-\\d{1,2}-\\d{2}(?![0-9]))(?<!${D_CLAUSE(3)})${D_DAY}-${D_MON}-\\d{2}${NWE}|`+
   `${NW}\\d{4}-${D_MON}-${D_DAY}${NWE}|${NW}(?<![0-9][.,])${D_DAY}\\s+(?:[בל]חודש\\s+|[בל]?-?)${D_MONTH}(?:,? +(?:ב?שנת\\s+)?\\d{4}(?![0-9])(?!\\s*${D_CUR}))?(?![א-ת0-9])|`+
   `(?=[א-ת])(?<!(?:^|[^0-9.,/:])[0-9]{1,2}\\s+(?:[בל]חודש\\s+|[בל]?-?))(?<=(?:^|[^א-ת])[ובלמהשכ]{0,3}-?)${D_MONTH},? +(?:ב?שנת\\s+)?(?:19|20)\\d{2}(?![0-9])(?!\\s*${D_CUR})|`+
   `(?=${D_MY})(?<=(?:(?<![א-ת])[ובלמה]{0,2}(?:חודש|חודשים|תאריך)[:\\s]*|(?<![א-ת])ו?(?:ה|מה)-\\s*)(?:${D_MY}\\s*(?:,|ו|עד|ועד|-|או)-?\\s*){0,120})${D_MY}(?![0-9]|[./][0-9])|`+
   `(?=[0-9])(?<=(?<![א-ת])ו?(?:ביום|מיום|ליום|בתאריך|מתאריך|לתאריך|תאריך)[:\\s]*)${D_DAY}[./]${D_MON}(?![0-9%]|[./-][0-9])|`+
   `(?=[0-9])(?<=(?<![א-ת])ו?(?:ה|מה)-[:\\s]*)${D_DAY}[./]${D_MON}(?![0-9%]|[./-][0-9]|\\s*${D_UNIT}|(?<=\\.5)\\s*${D_TIME})`,0,notClauseRange,5,1,1],
 // כל חלוקה של אותן ספרות (0547-712093, 054-771-20-93), קידומת בסוגריים ((03) 6123456) ורווחים סביב מקף (הציד של 11.10)
 ["PHONE_MOBILE","טלפון נייד",`${NW}(?:\\(0?5\\d\\)\\s?|(?:\\+?972[-\\s]?|0)5\\d)(?:[-\\s.]?\\d){7}${NWE}`,0,null,3,1],
 ["PHONE_LAND","טלפון קווי",`${NW}(?:\\(0?(?:[2-4689]|7\\d)\\)\\s?|(?:\\+?972[-\\s]?|0)(?:[2-4689]|7\\d)(?:\\s?-\\s?|[\\s.])?)\\d(?:[-\\s.]?\\d){6}${NWE}`,0,null,4,1],
 // מספר בחו"ל, בכל חלוקה: +33 6 12 34 56 78, +1 (212) 555-0147, 0044…
 ["PHONE_INTL","טלפון",`(?<![\\w+])(?:\\+|00)(?!972)[1-9]\\d{0,2}(?:[\\s.-]?\\(?\\d{1,4}\\)?){2,6}(?![\\d])`,0,digitsIn(8,15),1,1,1],
 ["PHONE_TOLL","מספר חיוג","(?:\\*\\d{3,5}|1[-\\s]?[38]00[-\\s]?\\d{3}[-\\s]?\\d{3})",0,null,3,1],
 ["FAX","פקס","(?:פקס|פקסימיליה)[:\\s]*(\\+?\\(?\\d[\\d\\-\\s()]{7,14}\\d)",1,null,3,1],
 ["ISRAELI_ID","תעודת זהות",`${NW}\\d{9}${NWE}`,0,validID,1,1],
 // ספרת הביקורת אחרי מקף, או שלוש קבוצות של שלוש. בלי תווית רק כשספרת הביקורת מתאימה (strict): אחרת זה סתם מספר
 ["ISRAELI_ID_SEP","תעודת זהות",`${NW}(?:\\d{8}-\\d|\\d{3}[-\\s]\\d{3}[-\\s]\\d{3})${NWE}`,0,validID,1,1,1],
 ["ISRAELI_ID_LABELED","תעודת זהות",`(?:ת\\.?\\s?ז\\.?|ת"ז|מ\\.?\\s?ז\\.?|תעודת\\s+זהות|מספר\\s+זהות|ח\\.?\\s?פ\\.?|ח"פ|ע"ר)(?:\\s*(?:מס'?|מספר))?[:\\s.]*(\\d(?:[-\\s]?\\d){4,8})(?![\\d])`,1,null,0,1],
 // מספר ביטוח סוציאלי אמריקאי של צד בחו"ל
 ["SSN","תעודת זהות",`(?:ביטוח\\s+(?:ה)?סוציאלי|SSN|social\\s+security)[^\\d\\n]{0,15}?(\\d{3}-\\d{2}-\\d{4})(?![\\d])`,1,null,0,1],
 ["CREDIT_CARD","כרטיס אשראי",`${NW}(?:\\d[ -]?){12,19}${NWE}`,0,luhn,1,1],
 ["IBAN","IBAN","\\bIL\\d{2}(?:\\s?\\d){19}\\b",0,ibanOK,1,1],
 ["PLATE","מספר רכב",`${NW}(?:\\d{2}-\\d{3}-\\d{2}|\\d{3}-\\d{2}-\\d{3})${NWE}`,0,null,2,1],
 ["PLATE_LABELED","מספר רכב",`(?:רכב|מכונית|רישוי|לוחית)[^\\d\\n]{0,15}?(\\d{2}[-\\s.]?\\d{3}[-\\s.]?\\d{2}|\\d{3}[-\\s.]?\\d{2}[-\\s.]?\\d{3})(?![\\d])`,1,null,2,1],
 ["ADDRESS_STREET","כתובת",`${STREET}\\s+[\u0590-\u05ff"'-]+(?:\\s+[\u0590-\u05ff"'-]+){0,3}\\s+\\d{1,4}(?:\\s?[\u05d0-\u05ea](?![\u0590-\u05ff]))?(?:\\s*[/\\\\]\\s*\\d{1,3}\\s?[\u05d0-\u05ea]?)?`,0,null,2,1],
 /* כתובת בלי מילת רחוב (הציד של 11.10): אחרי תווית, גם ארוכה ("מען למכתבים:", "כתובת מגורים:", "כתובת המבקשת:"), או אחרי
    פועל של מגורים ("המבקשת מתגוררת בהנרקיס 9 בחיפה"). לא יישוב, קומה, דירה או בניין, ולא מספר שאחריו זמן או כמות ("גרה
    בחיפה 12 שנים", "בדירה 4 חדרים"): addrOK */
 ["ADDRESS_LABELED","כתובת",`(?:(?:כתובת|מען|מקום\\s+(?:ה)?מגורים|מגורים)(?:\\s+[א-ת"'-]+){0,3}\\s*:\\s*|(?<![א-ת])ו?(?:${RES_VERB})\\s+ב-?)`+
   `([א-ת"'-]+(?:\\s+[א-ת"'-]+){0,2}\\s+\\d{1,4}[א-ת]?(?:\\s*[/\\\\]\\s*\\d{1,3})?)(?![\\d])(?![.,]\\d|\\s*(?:${D_TIME}|שנה|חודש|שבוע|יום|${D_UNIT}|%|קומות|דקות))`,1,addrOK,2,1,1],
 ["FARM","כתובת",`(?<![א-ת]{2})(?:משק|נחלה)\\s+(?:מס'?\\s*)?(\\d{1,4})(?![\\d])`,1,null,2,1],
 ["PARCEL","כתובת",`(?:גוש|חלק(?:ה|ות)|תת[-\\s]?חלק(?:ה|ות))\\s*(?:מס'?\\s*)?(\\d{1,6}(?:[-–]\\d{1,6})?)(?![\\d.,]\\d|\\s*(?:${D_UNIT}|%))`,1,null,2,1],
 ["DOB","תאריך לידה","(?:יליד(?:ת|י)?|ת\\.?\\s?לידה|תאריך\\s+לידה)[:\\s-]*(\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4})",1,null,2,1],
 // גם וואטסאפ (wa.me, api., chat.), youtu.be, fb.me, m.me, טלגרם וכל תת-דומיין (הציד של 11.10): עד כאן יצאו כמו שהם
 ["URL_PERSONAL","קישור אישי","(?<![\\w.@/])(?:https?://)?(?:[a-z0-9-]{1,20}\\.)?(?:www\\.)?(?:(?:facebook|fb|linkedin|instagram|twitter|x|tiktok|threads|youtube|snapchat|messenger|whatsapp)\\.(?:com|net)|youtu\\.be|instagr\\.am|lnkd\\.in|fb\\.me|m\\.me|wa\\.me|t\\.me|telegram\\.(?:me|dog))/[^\\s\"'<>)\\]]+",0,null,2,1],
 // תיקייה בענן של המשרד (SharePoint, OneDrive, Drive, Dropbox, WeTransfer) ומיקום במפה: שם הלקוח, המייל של עורכת הדין
 // או הכתובת של הבית יושבים בתוך הכתובת, מקודדים (הציד של 11.10)
 ["URL_PRIVATE","קישור אישי","(?<![\\w.@/])(?:https?://)?(?:[a-z0-9-]{1,40}\\.)*(?:(?:sharepoint\\.com|onedrive\\.live\\.com|1drv\\.ms|drive\\.google\\.com|docs\\.google\\.com|dropbox\\.com|box\\.com|wetransfer\\.com|we\\.tl|maps\\.app\\.goo\\.gl|maps\\.apple\\.com|waze\\.com|maps\\.google\\.(?:com|co\\.il))/[^\\s\"'<>)\\]]+|(?:google\\.(?:com|co\\.il)|goo\\.gl)/maps[/?@][^\\s\"'<>)\\]]*)",0,null,2,1],
 ["HANDLE","קישור אישי","(?<![\\w.@/])@[A-Za-z0-9_](?:[A-Za-z0-9_.]{1,28}[A-Za-z0-9_])(?![\\w@])",0,null,2,1],
 ["ZIPCODE","מיקוד","(?:מיקוד|ת\\.?ד\\.?)[:\\s.]*(\\d{5,7})",1,null,3,1],
 ["POBOX","מיקוד","(?<![א-ת])ת\\.?\\s?ד\\.?[:\\s.]*(\\d{1,6})(?![\\d])",1,null,3,1],
 ["ZIP_BARE","מיקוד",`${NW}\\d{7}${NWE}`,0,null,4,0],
 // נמחק כברירת מחדל, כמו שההגדרות ודף העזרה אומרים (עד כאן רק סומן, וסוגי התיקים של משפחה לא סומנו בכלל)
 ["CASE_NUMBER","מספר תיק",`(?:${COURT})\\s*(?:\\([^)\\n]{1,12}\\)\\s*)?(\\d{1,7}(?:[-/]\\d{1,4}){1,2})(?![\\d])`,1,null,3,1],
 ["CASE_BARE","מספר תיק",`${NW}\\d{3,6}-(?:0[1-9]|1[0-2])-\\d{2}${NWE}`,0,null,3,1],
 ["CASE_FILE","מספר תיק",`(?<![א-ת]{2})תיק(?:\\s+(?:הוצל"פ|ה?הוצאה\\s+לפועל))?(?:\\s*(?:מס'?|מספר))?[:\\s.]*(\\d{4,9}(?:[-/]\\d{1,4}){0,2}|\\d{1,3}(?:[-/]\\d{1,4}){1,2})(?![\\d])`,1,notYear,3,1,1],
 ["BANK_ACCOUNT","חשבון בנק","(?:חשבון|ח-ן)\\s*(?:מס'?|מספר)?[:\\s]*(\\d{2,3}[-/]\\d{3}[-/]\\d{4,9})",1,null,3,1],
 // החשבון לבד, עם לוכסן או מקף, אחרי «מספר חשבון» או «חשבון בנק»; לא שנה אחרי «דין וחשבון»
 ["BANK_ACCOUNT_SHORT","חשבון בנק","(?<!דין\\s?ו)(?:חשבון(?:\\s+(?:ה)?בנק)?|ח-ן|ח\\.ן|ח\"ן)(?:\\s*(?:מס'?|מספר))?[:\\s.]*(\\d(?:[-/]?\\d){3,12})(?![\\d/-])",1,notYear,3,1,1],
 ["LAWYER_LIC","מספר רישיון עו\"ד","(?:מ\\.?\\s?ר\\.?|מספר\\s+רישיון|רישיון\\s+מס'?)[:\\s]*(\\d{4,7})",1,null,2,1],
 ["NOTARY","מספר נוטריון","(?:נוטריון|רישיון\\s+נוטריון)[^\\d]{0,12}(\\d{3,7})",1,null,3,1],
 // גם «דרכון מס'», «דרכון אוקראיני מספר»: עד שתי מילים בין התווית למספר
 ["PASSPORT","דרכון","(?:דרכון|passport)(?:\\s+[א-ת\"'׳]{2,}){0,2}?(?:\\s*(?:מס'?|מספר|no\\.?))?[:\\s.#]*([A-Z0-9]{6,9})(?![A-Za-z0-9])",1,null,3,1],
 ["IP","כתובת IP","\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b",0,null,3,0],
].map(([n,l,r,g,v,p,on,strict])=>({n,l,rx:new RegExp(r,"gu"),g,v,p,on:!!on,strict:!!strict}));

const WHYP={DATE:"מבנה של תאריך — מוזז כברירת מחדל באותו מספר ימים לכל המסמך; אפשר למחוק או להשאיר בכרטיס",
 ISRAELI_ID:"תשע ספרות שעוברות בדיקת ספרת ביקורת",
 ISRAELI_ID_LABELED:"מספר שמופיע אחרי תווית זהות",CREDIT_CARD:"רצף ספרות שעובר בדיקת ספרת ביקורת",
 EMAIL:'מבנה של כתובת דוא"ל',PHONE_MOBILE:"מבנה של מספר נייד ישראלי",
 PHONE_LAND:"מבנה של מספר קווי ישראלי",PHONE_TOLL:"מספר חיוג מיוחד",
 FAX:"מספר שמופיע אחרי המילה פקס",IBAN:"מבנה של IBAN עם ספרות ביקורת תקינות",PLATE:"מבנה של מספר רישוי",
 ADDRESS_STREET:"מילת רחוב ואחריה שם ומספר בית",DOB:"תאריך שמופיע אחרי ציון לידה",
 ZIPCODE:"מספר שמופיע אחרי מיקוד",ZIP_BARE:"שבע ספרות בודדות — ייתכן מיקוד",
 CASE_NUMBER:"מבנה של מספר תיק",BANK_ACCOUNT:"מבנה של מספר חשבון",
 PASSPORT:"מזהה שמופיע אחרי המילה דרכון",
 IP:"מבנה של כתובת IP",URL_PERSONAL:"קישור לרשת חברתית"};

/* ── שמות לפי עוגן ── */
const TITLES=`עו"ד|עוה"ד|ד"ר|דר'|פרופ'|רו"ח|הרב|ח"כ|מר|גב'|גברת|כב'\\s*השופט(?:ת)?|השופט(?:ת)?|רשמ(?:ת)?|המצהיר(?:ה)?|העד(?:ה)?|ב"כ|מטעם`;
/* הקטין/הקטינה הופיעו ב-ROLEWORD, שהוא שער דחייה, אבל לא כאן, שזו רשימת
   העוגנים. לכן ל"בעניין הקטין ניב" לא היה עוגן בכלל, וזו הקטגוריה הגרועה
   ביותר בריצה הדטרמיניסטית: אפס מתוך שבע. "האם" ו"האב" נשארו בחוץ במכוון —
   "האם" היא גם מילת שאלה, ו"האם הגישה בקשה" ייראה בדיוק כמו שם.

   אות סופית אוכלת את הסיומת: שורש שנגמר במ"ם או בנו"ן סופית אינו יכול לשאת
   סיומת אופציונלית, כי בנטייה האות הופכת לצורתה האמצעית. «הנאשם» ואחריו «ת»
   אופציונלית לעולם אינו תופס את «הנאשמת», שכתובה במ"ם אמצעית, ואותו דבר
   לגבי «הקטין» וסיומות הנקבה והרבים. שתי הסיומות היו קוד מת: «הנאשמת» מעולם
   לא שימשה עוגן מאז שנכתבה הרשימה, וגם התוספת של «הקטין» לא כללה בפועל את
   צורת הנקבה — שלוש מתוך חמש ההחמצות שנשארו בקטגוריה. לכן הנטיות נכתבות
   במלואן, הארוכה לפני הקצרה. שאר הרשימה נגמרת בע', ש', ב', ר' או ח' ולכן
   תקינה, ו-tests/regex_t.js שומר על זה. */
const ROLES="התובע(?:ת)?|הנתבע(?:ת)?|המבקש(?:ת)?|המשיב(?:ה)?|הנאשמת|הנאשם|המערער(?:ת)?|המנוח(?:ה)?|הקטינה|הקטינים|הקטינות|הקטין";
// צד ברבים: "התובעים:" ואחריו רשימה ממוספרת של שמות, או עד שני שמות באותה שורה (הציד של 11.10)
const ROLES_PL="התובעים|התובעות|הנתבעים|הנתבעות|המבקשים|המבקשות|המשיבים|המשיבות|המערערים|המערערות";
// הזנב של תפקיד מורכב, המילה שבאה אחרי מילת תפקיד טיפולית ואינה שם: "מדריך נוער",
// "אחות ראשית", "פסיכולוגית קלינית", "מטפלת משפחתית". רשימה קטנה ומכוונת.
const CARE_TAIL=new Set(["נוער","ילדים","משפחה","משפחות","קהילה","שיקום","חינוך","בית","גן","כיתה",
  "ראשי","ראשית","בכיר","בכירה","קליני","קלינית","חינוכי","חינוכית","רפואי","רפואית","טיפולי","טיפולית",
  "תורן","תורנית","אישי","אישית","משפחתי","משפחתית","זוגי","זוגית","מקצועי","מקצועית","אחראי","אחראית"]);
const STOP=new Set(("בית המשפט משפט הדין דין המחוזי השלום העליון לענייני משפחה עבודה תעבורה "+
 "המדינה ישראל מדינת משרד המשרד החברה חברת בעמ העמותה הבנק בנק הצדדים הצד הסכם ההסכם "+
 "החוזה החוק התקנות כאמור לעיל להלן התביעה ההגנה הבקשה התגובה התצהיר הדיון מטעם באמצעות "+
 "לפי כפי אשר וכן ועוד וגם אצל בעניין בנוגע התובע הנתבע התובעת הנתבעת המבקש המשיב כבוד כב "+
 "הוועדה המחלקה הרשות העירייה המועצה ועדת מס הכנסה הביטוח הלאומי שלום רחוב דרך תעודת זהות "+
 "את של על עם אל כי גם אך או אם כל לא זה זו הוא היא הם הן אני אתה אנו יש אין היה הייתה האמת אמת בזאת בזה כאן שם שלי שלו שלה השופט השופטת הרשם הרשמת המותב כב הכבוד "+"מספר תאריך יום חודש שנה הדוח טען טענה הודיע הודיעה אמר אמרה מסר מסרה ציין ציינה "+
 "עוד עוהד דר פרופ רוח הרב מר גב גברת השופט השופטת הנוטריון נוטריון המצהיר המצהירה")
 .split(" ").concat(['בע"מ','הנ"ל']));
const NWD="[\u05d0-\u05ea][\u05d0-\u05ea'\"\u05f3\u05f4-]{1,14}";
const PART="בן|בת|בר|אבו|אל|דה|ואן|לה";
const NME=`${NWD}(?:\\s+(?:${PART})(?![\u05d0-\u05ea-]))?(?:\\s+${NWD})?`;
/* \u05e9\u05dd \u05e9\u05dc \u05d0\u05d3\u05dd \u05d1\u05d0\u05d5\u05ea\u05d9\u05d5\u05ea \u05dc\u05d8\u05d9\u05e0\u05d9\u05d5\u05ea (\u05d4\u05e6\u05d9\u05d3 \u05e9\u05dc 11.10): \u05de\u05d9\u05dc\u05d4 \u05e9\u05e0\u05e4\u05ea\u05d7\u05ea \u05d1\u05d0\u05d5\u05ea \u05d2\u05d3\u05d5\u05dc\u05d4, \u05d2\u05dd \u05e2\u05dd \u05de\u05e7\u05e3 \u05d5\u05d0\u05d5\u05ea\u05d9\u05d5\u05ea \u05de\u05d5\u05d8\u05e2\u05de\u05d5\u05ea ("Dubois-Levi", "L\u00e9a"),
   \u05d5\u05de\u05d9\u05dc\u05d5\u05ea \u05d7\u05d9\u05d1\u05d5\u05e8 \u05e7\u05d8\u05e0\u05d5\u05ea \u05d1\u05ea\u05d5\u05da \u05e9\u05dd ("de", "van", "bin"). LATN: \u05e9\u05ea\u05d9\u05d9\u05dd \u05e2\u05d3 \u05d0\u05e8\u05d1\u05e2 \u05de\u05d9\u05dc\u05d9\u05dd; LATN1: \u05d2\u05dd \u05de\u05d9\u05dc\u05d4 \u05d0\u05d7\u05ea (\u05e9\u05dd \u05de\u05e9\u05e4\u05d7\u05d4 \u05d0\u05d7\u05e8\u05d9 \u05ea\u05d5\u05d0\u05e8) */
const LAT_W="[A-Z\u00c0-\u00d6\u00d8-\u00de][A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff'\u2019]*(?:-[A-Z\u00c0-\u00d6\u00d8-\u00dea-z\u00df-\u00f6\u00f8-\u00ff][A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff'\u2019]*)*",
  LAT_P="(?:de|da|del|della|di|du|des|van|von|der|den|la|le|el|al|bin|ben|ibn|y|e|ter|op)",
  LATN=`${LAT_W}(?:\\s+(?:${LAT_P}\\s+){0,2}${LAT_W}){1,3}`, LATN1=`${LAT_W}(?:\\s+(?:${LAT_P}\\s+){0,2}${LAT_W}){0,3}`;
// \u05ea\u05d5\u05d0\u05e8 \u05dc\u05d5\u05e2\u05d6\u05d9 \u05dc\u05e4\u05e0\u05d9 \u05d4\u05e9\u05dd ("Mr. John Smith", "Me Pierre Martin"): \u05e0\u05e9\u05d0\u05e8 \u05d1\u05d8\u05e7\u05e1\u05d8, \u05d5\u05d0\u05d9\u05e0\u05d5 \u05d4\u05e9\u05dd
const LAT_TITLE="(?:(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Adv|Atty|Esq|Mme|Mlle|Me|Herr|Frau|Sr|Sra|Sig|Sir|Lady|Rabbi|Rev)\\.?\\s+)?";
// \u05de\u05d9\u05dc\u05d9\u05dd \u05e9\u05d0\u05d5\u05de\u05e8\u05d5\u05ea \u05e9\u05de\u05d4 \u05e9\u05d1\u05d0 \u05d0\u05d7\u05e8\u05d9 \u05d4\u05ea\u05d5\u05d5\u05d9\u05ea \u05d4\u05d5\u05d0 \u05d2\u05d5\u05e3 \u05d0\u05d5 \u05d3\u05d1\u05e8, \u05dc\u05d0 \u05d0\u05d3\u05dd ("\u05d4\u05ea\u05d5\u05d1\u05e2\u05ea: Microsoft Israel Ltd")
const LAT_NOT=/^(?:mr|mrs|ms|miss|mx|dr|prof|adv|atty|esq|mme|mlle|herr|frau|sir|lady|rabbi|rev|ltd|inc|llc|llp|lp|corp|corporation|company|co|gmbh|sa|ag|bv|nv|plc|pty|bank|group|holdings?|university|college|school|hospital|court|supreme|district|ministry|department|office|state|states|republic|kingdom|united|street|road|avenue|center|centre|international|global|services|solutions|technologies|systems|partners|associates|foundation|association|society|insurance|microsoft|google|apple|amazon|meta|facebook|whatsapp|instagram|gmail|outlook|word|excel|pdf|zoom|teams|tel|aviv|jerusalem|haifa|israel|hague|convention|the|of|and|for)$/i;
const latinOK=c=>{const ws=c.split(/[\s-]+/); return !ws.some(w=>LAT_NOT.test(w))&&!ws.every(w=>w.length>1&&w===w.toUpperCase()&&ws.length===1)};
// התאום הלועזי בסוגריים, אחרי השם העברי או לפניו (Engine.twins)
const LAT_AFTER=new RegExp(`^\\s*[(\\[]\\s*(${LATN1})\\s*[)\\]]`,"u"), LAT_BEFORE=new RegExp(`(${LATN1})\\s*[(\\[]\\s*$`,"u");
const BD="(?<![\\u0590-\\u05ff])";
// מילות פתיחה של משפט שהמודל מדביק לשם שאחריהן
const LEAD=new Set(["כאמור","משכך","יוזכר","יצוין","יודגש","לדבריו","לדבריה","לדבריהם","בנוסף","ולכן","לכן","אולם","ואולם","אך","גם","כי","כאשר","שכן","לפיכך","בהתאם","עוד","כן","אכן","ואכן","אמנם","כלומר","דהיינו","למשל","ואילו","אבל","או"]);
// מילות תפקיד שהמודל מסמן כשם: אפוטרופוס בכל כתיב, סניגור, מומחה…
// גם הצדדים ברבים: "התובעים:" הוצע כדובר בשם «התובעים» (הציד של 11.10)
const ROLEWORD=/^(?:ה)?(?:יועץ|יועצת|פרקליט(?:ה)?|תובע(?:ת)?|סניגור(?:ית)?|ממונה|נציב(?:ה)?|מפקח(?:ת)?|רכז(?:ת)?|אפו?טרופ(?:א|וס|סית|וסים|ה)|האפו?טרופ(?:א|וס|סית)|סניגור(?:ית)?|מומח(?:ה|ית)|פסיכולוג(?:ית)?|עו"?ס|קטין|קטינה|הקטין|הקטינה|המבקש(?:ת)?|המשיב(?:ה)?|התובע(?:ת)?|הנתבע(?:ת)?|האם|האב|ההורים|ההורה|תובעים|תובעות|נתבעים|נתבעות|מבקשים|מבקשות|משיבים|משיבות|מערערים|מערערות|קטינים|קטינות)$/u;
// תוויות של טופס וכתב טענות שנפתחות בנקודתיים ואינן דוברים: "מועד אחרון לתגובה:"
// גם מילות התווית של שדה שם ושל דוא"ל מודפס: "שם פרטי:" הוצע כאדם בשם «פרטי» (הציד של 11.10)
const FORMLABEL=new Set(["מועד","תאריך","שעה","מקום","נושא","עניין","בעניין","הערות","הערה","החלטה","החלטת","תגובה","לתגובה","סימוכין","מספר","מס'","שם","כתובת","טלפון","פקס","דוא\"ל","מייל","נספח","נספחים","סעיף","עמוד","המצאת","אחרון","ראשון","לכבוד","אל","מאת","תיק","בפני","לפני","הנדון","סיכום","המלצה","המלצות","מטרה","רקע","דיון","תוצאה","מסקנות","מסקנה","נוכחים","משתתפים","סדר","יום","פרוטוקול","שאלה","תשובה","ש","ת",
  "פרטי","משפחה","נעורים","נשלח","עותק","העתק","העתקים"]);
// מה שבא בשדה של שם במקום שם: "לא ידוע", "לא רשום", "חסוי", "נפטר", "כנ"ל", "טרם נקבע" (הביקורת של 11.10)
const NOT_NAME=new Set(["ידוע","ידועה","רשום","רשומה","חסוי","חסויה","נפטר","נפטרה","כנ\"ל","טרם","נקבע","נקבעה",
  // ועוד מה שבא בשדה או בחתימה במקום שם: "יעודכן", "אנונימי", "ייקבע בהגרלה", "ובהערכה רבה", "ותודה מראש" (ביקורת שנייה)
  "יעודכן","תעודכן","אנונימי","אנונימית","ייקבע","יקבע","תיקבע","בהערכה","ובהערכה","תודה","ותודה","מצורף","מצורפת",
  // ומה שבא אחרי השם בשורה של צד: "שירה ולדמן ילידת 1985", "דנה וולפסון תושבת חיפה"
  "יליד","ילידת","תושב","תושבת"]);
/* מה שבא בשורה של צד או אחרי חותמת במקום שם (ביקורת שנייה, 11.10): מקצוע, מצב משפחתי או אישי, עמדה בדיון, ותווית
   ביומן. "המבקשת:" מעל "מהנדסת תוכנה", "הנתבעת:" מעל "מודה ומתחרטת" ו"חוג כדורגל:" אחרי חותמת נראו כשם לכל בדיקה,
   כי אין כאן מילון. בלי מילים שהן גם שם משפחה רגיל ("נגר", "קבלן", "אמן"); ושם מוכר תמיד גובר (slotWords) */
const NOT_PERSON=new Set(("מהנדס מהנדסת מכונאי מכונאית חייל חיילת סטודנט סטודנטית עובד עובדת מנהל מנהלת נהג נהגת אחות "+
  "מורה גננת רופא רופאה פקיד פקידה טכנאי טכנאית חשמלאי חשמלאית אינסטלטור מתכנת מתכנתת מעצב מעצבת יועץ יועצת סוכן סוכנת "+
  "שוטר שוטרת מאבטח מאבטחת מלצר מלצרית קופאי קופאית מוכר מוכרת שליח שליחה עצמאי עצמאית שכיר שכירה מובטל מובטלת "+
  "פנסיונר פנסיונרית גמלאי גמלאית מתמחה רוקח רוקחת מאמן מאמנת עיתונאי עיתונאית חקלאי חקלאית מנקה ניקיון סייעת "+
  "נשוי נשואה גרוש גרושה רווק רווקה אלמן אלמנה פרוד פרודה נכה אזרח אזרחית צעיר צעירה טרייה טרי בשנית "+
  "מודה מכחיש מכחישה מסכים מסכימה מתנגד מתנגדת טוען טוענת חוזר חוזרת מצטער מצטערת לחלוטין בתשובה "+
  "חוג כדורגל כדורסל אימון משחק תור משמרת חופשה מחלה משטרה חג שיעור מבחן בחינה שכנים שכן שכנה בבניין "+
  "צה\"ל בסדיר במילואים חוץ רכב תוכנה חשבונות ביטוח משאית מוסך בתפקיד בתורנות למקור").split(" "));
/* קרוב משפחה בכינוי שייכות אינו חלק משם: "התובעת: נגה ובתה", "לכבוד נגה ומשפחתה", "מאת: נגה וילדיה" נקראו כשם אחד,
   והקרוב נמחק עם השם. לא צורה שהיא גם שם פרטי מוכר ("בני", "אמה"): KNOWN_FIRST גובר (ביקורת עצמית, 11.10) */
const KIN_OF=new Set(("בעלה בעלי אשתו אשתי ילדיה ילדיו ילדיהם ילדיהן ילדי ילדינו בנה בנו בנם בתה בתו בתם בתי משפחתה משפחתו "+
  "משפחתם משפחתי הוריה הוריו הוריהם הורי אמו אביה אביו אבי אחיה אחיו אחותה אחותו אחיותיה אחיותיו נכדיה נכדיו "+
  "חמותה חמותו חמיה חמיו גיסה גיסו גיסתה גיסתו נכדתה נכדתו נכדה נכדו בת-זוגו בן-זוגה זוגתו").split(" "));
const kin=w=>{const b=w.replace(/^ו-?/,""); return KIN_OF.has(b)&&!KNOWN_FIRST.has(b)};
function anchorOK(c){
  const ws=c.split(/\s+/);
  if(ws.some(w=>VRB.has(w)||COMMON.has(w)||STOP.has(w)||FORMLABEL.has(w)||NOT_NAME.has(w)||TRAIL.has(w)||ROLEWORD.test(w)||TITLE_RX.test(w+" ")||kin(w)))return false;
  // "הצעה שאינה", "וערכית אינו": מילת שלילה אינה חלק משם, גם עם אות שימוש
  if(ws.some(w=>/^[בהולמכש]?(?:אינ[הוםן]|איני|אין|לא|בלי|ללא)$/.test(w)))return false;
  // "להשיג", "לקטין": ל+פועל או ל+מילת תפקיד
  // ה" הידיעה אינה אות שימוש לעניין זה: "שכונת הפרדס" ו"רחוב הארזים" הם מקומות
  if(ws.some(w=>w.length>=4&&PFX.has(w[0])&&w[0]!=="ה"&&(VRB.has(w.slice(1))||COMMON.has(w.slice(1))||ROLEWORD.test(w.slice(1)))))return false;
  if(ws.length===1&&ws[0].length<3)return false;
  // "נ ג ד" בכותרת התיק: אותיות בודדות מופרדות ברווח אינן שם
  if(ws.length>1&&ws.every(w=>w.replace(/['"׳״]/g,"").length<=1))return false;
  // "הח"מ", "לה ישירות", "מי מההורים": החתום-מטה אינו שם, ומילה בת שתי אותיות שאינה
  // חלק של שם (בן, בת, אבו, אל, דה, בר) היא כינוי או מילת שאלה
  if(ws.some(w=>/^הח["״]מ$/.test(w)||(w.replace(/['"׳״-]/g,"").length<=2&&!["בן","בת","אבו","אל","דה","בר","ון","דל"].includes(w))))return false;
  return true}
/* ייצוא של וואטסאפ פותח כל הודעה בחותמת זמן לפני השולח (הציד של 11.10): "[12.3.2026, 21:15] נגה …:" באייפון,
   "12.3.2026, 21:15 - נגה …:" באנדרואיד, "[3/12/26, 9:15:03 PM] …" באנגלית. עוגן הדוברים דרש שם בראש הפסקה, ולכן
   בייצוא שלם אף שולח לא נמצא: אפס מתוך שישה בארבע השיחות של הבנצ'מרק. סימן כיוון לפני החותמת ואחריה הוא \0 אחרי norm */
// גם השעה לפני התאריך, כפי שוואטסאפ ווב מעתיק: "[21:15, 12.3.2026] נגה …:" (הביקורת של 11.10)
const STAMP_DATE="\\d{1,2}[./]\\d{1,2}[./](?:\\d{4}|\\d{2})", STAMP_TIME="\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s?[AaPp]\\.?[Mm]\\.?)?";
const CHAT_STAMP=`\\u0000*\\[?(?:${STAMP_DATE},?\\s+${STAMP_TIME}|${STAMP_TIME},?\\s+${STAMP_DATE})\\]?\\s*(?:-\\s*)?\\u0000*`;
const STAMP_RX=new RegExp(`^(?:${CHAT_STAMP})`,"u");
/* שדה של שם בכל כתיב רגיל של טופס (הציד של 11.10): "שם פרטי:", "שם משפחה:", "שם האב:", "שם הקטין/ה:",
   "שם פרטי ושם משפחה:", "שם בן/בת הזוג:", "שם נעורים:". עד כאן רק "שם:", "שם מלא:" ושם המצהיר, העד או הצד,
   ומ"שם פרטי:" עוגן הדוברים הציע אדם בשם «פרטי» */
const FIELD_NAME="שם\\s+(?:מלא|פרטי(?:\\s+ו(?:שם\\s+)?משפחה)?|משפחה|המשפחה|נעורים|קודם|האב|האם|הצד|"+
  "ה(?:קטינה|קטין|ילדה|ילד|מבקשת|מבקש|משיבה|משיב|תובעת|תובע|נתבעת|נתבע|מצהירה|מצהיר|עדה|עד)(?:\\s*[/(]\\s*[הת]\\s*\\)?)?|"+
  "ב[ןת]\\s*(?:/\\s*ב[ןת]\\s+)?(?:ה)?זוג)|שם";
/* שדה של שם בכל ניסוח, כמחלקה אחת (הביקורת של 11.10): "שם" ועוד מילה עד שלוש לפני הנקודתיים ("שם בעל החשבון:",
   "שם המוטב:", "שם העובד/ת:", "שם ההורה:"). זה עוגן חלש (slotOK), ושם של דבר ("שם בית הספר:", "שם הבנק:") אינו
   שדה של אדם */
const THING="(?:ה)?(?:בית|בי\"ס|ביה\"ס|חברה|חברת|בנק|סניף|קובץ|משתמש|רחוב|יישוב|ישוב|עיר|כפר|שכונה|מוסד|גן|קורס|תוכנית|תכנית|"+
  "עמותה|ארגון|מקום|אתר|מסמך|קופה|קופת|תיק|פרויקט|מוצר|ספר|חשבון|משרד|רשות|ועדה|מחלקה|יחידה|מרכז|מעון|מסגרת|מדינה|ארץ|"+
  "חוג|כיתה|רכב|קבוצה|אירוע|הסכם|חוזה|נכס|טופס|תפקיד|מקצוע|עסק|ערוץ|דף|תרופה|מחלה|בדיקה|הליך|תביעה|בקשה|"+
  // ושמות של דברים שקראו את הערך שאחריהם כשם ("שם הדגם: טויוטה קורולה", "שם השיר", ביקורת שנייה)
  "דגם|שיר|פוליסה|בניין|מבנה|מותג|סרט|אלבום|להקה|תוכנה|אפליקציה|מסעדה|מלון|ספינה|כלב|חתול|חיה)";
// שדה של מי שהוא אדם או חברה ("שם הקבלן: א.ב. בנייה", "שם הספק: אלקטרה"): מילה אחת בו אינה שם
const FIELD_ORG=/שם\s+ה?(?:ספק|קבלן|מעסיק|מעביד|יצרן|משווק|מבטח|מוכר|קונה|משכיר|נותן|לקוח|זוכה|מפעיל)(?![א-ת])/u;
const FIELD_W=`[א-ת"']+(?:\\s*[/(]\\s*[הת]\\s*\\)?)?`;
const FIELD_ANY=`שם\\s+(?!${THING}(?![א-ת"']))${FIELD_W}(?:\\s+${FIELD_W}){0,2}`;
// אות ראשונה אחת או שתיים ונקודה או גרש לפני שם המשפחה ("עו"ד ש. ולדמן", "התובעת: נ.ש. טרכטנגוט", הציד של 11.10):
// שם המשפחה, מילה אחת, הוא השם, והאותיות נשארות בטקסט. גרש בלי רווח אחריו הוא חלק מהשם ("ג'ני"). שתי קבוצות: אחת נתפסת
const NMI=`(?:[א-ת](?:\\.\\s?|'\\s)(?:[א-ת](?:\\.\\s?|'\\s))?(${NWD})|(${NME}))`;
/* מה שבא אחרי שם בשורת דוא"ל: סוף, פסיק, כתובת, תואר ("עו"ד"), מקף ותפקיד, ו' של נמען נוסף אחרי רווח, או התווית
   הבאה אחרי טאב או מעבר שורה רך ("נשלח:"). ו' בלי רווח לפניה היא אות בתוך שם המשפחה: "טרכטנגוט עו"ד" נחתך
   ל«טרכטנג» (הביקורת של 11.10) */
const MAIL_LBL="(?:מאת|אל|עותק|העתק|העתקים|From|FROM|To|TO|Cc|CC|cc|Bcc|BCC|bcc)";
const MAIL_END=`(?=\\s*(?:$|[,;<\\[("'A-Za-z])|\\s+ו|\\s+(?:${TITLES})(?![א-ת])|\\s+[-–]\\s|\\s+[א-ת"']+\\s*:)`;
// אחרי שם הנמען: סוף השורה, פסיק, סוגריים (ת"ז), מקף ("- באמצעות דואר רשום"), כתובת ("מרחוב …"), תואר, או נמען נוסף
const ADDR_END=`(?=\\s*(?:$|[,;(])|\\s+[-–]\\s|\\s+ו|\\s+מ?(?:רחוב|רח'|שד')|\\s+(?:${TITLES})(?![א-ת]))`;
// "לכבוד פסח, קיבלו הילדים": אחרי פסיק בשורה של הנמען באה כתובת, תואר, ת"ז או מספר, לא המשך של משפט
const ADDR_REST=/^\s*,\s*(?:$|רח(?:וב|')|מרח|שד(?:רות|')|ת\.?\s?ד|ת"ד|ת\.?\s?ז|ת"ז|ע"י|ב"כ|עו"ד|ד"ר|גב'|מר\s|[\d(]|[א-ת"']+\s+\d)/u;
// חתימה: גם "ולראייה" ביו"ד כפולה ו"באנו/באו הצדדים על החתום" (הביקורת של 11.10)
const SIGN_OLD="(?:בכבוד\\s+רב(?!\\s+ובברכה)|ולראי?יה\\s+(?:באתי|באנו|באו(?:\\s+הצדדים)?)\\s+על\\s+החתום|חתימה)";
/* מילה רגילה בנטייה (הביקורת של 11.10): סמיכות של מילה נפוצה בראש ("שיחת" של שיחה, "בקשת"), ותואר או רבים שלה
   אחריה ("חודשי" של חודש, "אישיים", "חלקית"). רשימת המילים הנפוצות אינה מכירה את הנטיות, ו"שכר חודשי" נראה כשם */
const FINAL={"כ":"ך","מ":"ם","נ":"ן","פ":"ף","צ":"ץ"};
function wordForm(w,first){
  if(/ת$/.test(w)&&COMMON.has(w.slice(0,-1)+"ה"))return true;
  if(first)return false;
  const m=/^(.{2,}?)(?:יים|יות|ית|י)$/.exec(w); if(!m)return false;
  const s=m[1];
  return COMMON.has(s)||COMMON.has(s.slice(0,-1)+(FINAL[s.slice(-1)]||s.slice(-1)))||(/ת$/.test(s)&&COMMON.has(s.slice(0,-1)+"ה"))}
// שם פעולה: כותרת של רישום ביומן או נושא של בקשה ("איסוף", "ביקור", "העברה", "תזכורת", "פירוק"), לא אדם
const VNOUN=/^(?:[א-ת]י[א-ת]ו[א-ת](?:ים|ין)?|ה[א-ת]{2,3}(?:ה|ות)|ת[א-ת]{2}ו[א-ת]ת?)$/;
const knownName=w=>KNOWN_FIRST.has(w)||POOL.he_s.includes(w)||POOL.ar_s.includes(w)||POOL.he_f.includes(w)||POOL.he_m.includes(w)||
  POOL.ar_f.includes(w)||POOL.ar_m.includes(w)||SUR_SUFFIX.test(w);
/* מועמד בחריץ חלש או בשכן של תווית (הביקורת של 11.10): כל מילה נראית כשם — לא מילת מילוי של דיבור ("תודה",
   "מסכים"), לא מה שבא במקום שם ("חסוי"), לא שם פעולה, לא מילה רגילה או נטייה שלה ("שכר חודשי"), לא רבים ("פרטים
   אישיים"). מילה בודדת רק כשהיא שם מוכר, או כשהתווית או אות ראשונה לפניה אומרות שבאה מילה אחת (one) */
function slotWords(c,one){
  const ws=c.split(/\s+/);
  if(ws.length===1&&!one&&!knownName(ws[0]))return false;
  // אחרי שם פרטי מוכר בא שם משפחה, גם כשהוא נגמר כמו רבים או נראה כשם פעולה או כנטייה ("אורי נסים", "דנה מימון",
  // "נגה שלבי"): מה שנפסל שם הוא רק מילה רגילה, מילת מילוי או פועל (ביקורת שנייה, 11.10)
  const fn=ws.length>1&&KNOWN_FIRST.has(ws[0]);
  return ws.every((w,i)=>{
    if(knownName(w))return true;
    const w0=w.replace(/^ו/,"");
    if(FILLER.has(w)||FILLER.has(w0)||NOT_NAME.has(w)||NOT_NAME.has(w0)||kin(w))return false;
    if(fn&&i>0)return !STOP.has(w)&&!COMMON.has(w)&&!VRB.has(w)&&!NOT_PERSON.has(w)&&w.length>=2;
    // מקצוע, מצב, עמדה או תווית ביומן; בינוני של התפעל ("מתחרטת", "מתנגד"); שותפות ("כהן ושות'"); וסמיכות של שם
    // פעולה ("החלפת משמרת", "העברת כספים")
    if(NOT_PERSON.has(w)||NOT_PERSON.has(w0)||/^ו?מת[א-ת]{3,}$/.test(w)||/^ו?שות'?$/.test(w)||/^ה[א-ת]{3}ת$/.test(w))return false;
    if(VNOUN.test(w)||wordForm(w,i===0)||/(?:ים|ות)$/.test(w))return false;
    return w.length<3?i>0&&!STOP.has(w)&&!COMMON.has(w):nameish(w,new Set())})}
// אחרי "ר'" (ראו) או אות של סעיף בא מסמך או נושא, לא שם משפחה: "ר' תצהיר האם", "א. פירוק השיתוף" (הביקורת של 11.10)
const DOC_WORD=new Set(["תצהיר","תצהירה","תצהירו","כתב","חוות","פרוטוקול","מוצג","נספח","סעיף","עמוד","שורה","פסקה","תקנה",
  "החלטה","פסק","בקשה","תגובה","סיכומים","מסמך","מכתב","דוח","דו\"ח","חוק","הסכם","טופס","אישור","תעודה","קבלה","חשבונית",
  "מצורף","מצורפת","מצ\"ב","לעיל","להלן"]);
// נושא של בקשה שנפתח בשם פעולה שהתבנית אינה תופסת ("בעניין: קיום צוואה", ביקורת שנייה)
const MATTER_W=new Set(["קיום","מינוי","פינוי","ביטול","שינוי","גירושין","מזונות","משמורת","הסדרי","הסדר","צו","פירוק","אישור","תיקון","הארכת","עיכוב"]);
// גבול מילה לפני התואר: "מר" בתוך "אמר" סימן את המילה שאחריו כשם
const ANCH=[["title",`${BD}(?:${TITLES})[,\\s]+${NMI}`,"מופיע אחרי תואר"],
 ["hcm",`אני\\s+הח"מ[,\\s]+(${NME})`,'מופיע אחרי "אני הח"מ" בתצהיר'],
 ["warned",`(${NME})[,\\s]+(?=לאחר\\s+שהוזהרת)`,"מופיע לפני נוסח האזהרה בתצהיר"],
 ["repby",`(?:מיוצג(?:ת)?\\s+ע"?י|באמצעות\\s+ב"כ|ע"י\\s+ב"כ)[,\\s]+(?:(?:${TITLES})[,\\s]+)?(${NME})`,"מופיע אחרי ציון ייצוג"],
 ["deliver",`(?:מען|כתובת)\\s+להמצאת\\s+כתבי\\s+בי[- ]?דין[:\\s]*(${NME})`,"מופיע במען להמצאה"],
 ["sworn",`(?:אני\\s+הח"מ|אני\\s+הנני|אני\\s+החתומ(?:ה)?\\s+מטה)\\s*,?\\s*(${NME})`,
   "מופיע בפתיח התצהיר"],
 // כותרת של מכתב או של דוא"ל מודפס: "מאת: נגה טרכטנגוט", "אל: …", "עותק: …", גם From/To/Cc (הציד והביקורת של
 // 11.10). שורה שנפתחת בתווית; "לכבוד החג קיבלו" ו"הגיעו לכבוד בר המצווה" הם פרוזה.
 // הנוסח המוצע להסבר, ממתין לאישור הבעלים: 'מופיע אחרי "מאת:" או "אל:"'
 ["mail",`^[\\s\\u0000]*${MAIL_LBL}\\s*:\\s*["']?(?:(?:${TITLES})[,\\s]+)?${NMI}${MAIL_END}`,
   "התגלה אוטומטית מההקשר"],
 // ועוד נמען באותה שורה, אחרי פסיק, נקודה-פסיק, ו, או תווית נוספת אחרי מעבר שורה רך ("מאת: … אל: …"), רק
 // בשורה שנפתחת בתווית כזו. הנוסח המוצע להסבר, ממתין לאישור הבעלים: 'מופיע אחרי "מאת:" או "אל:"'
 ["mail",`(?:[,;]|\\sו-?|\\s${MAIL_LBL}\\s*:)\\s*["']?(?:(?:${TITLES})[,\\s]+)?${NMI}${MAIL_END}`,
   "התגלה אוטומטית מההקשר",new RegExp(`^[\\s\\u0000]*${MAIL_LBL}\\s*:`,"u")],
 // הנמען של מכתב: "לכבוד נגה טרכטנגוט", ובשורה שאחרי "לכבוד" שעומדת לבדה.
 // הנוסח המוצע להסבר, ממתין לאישור הבעלים: 'מופיע אחרי "לכבוד"'
 ["addressee",`^[\\s\\u0000]*לכבוד\\s*[:,]?\\s*(?:(?:${TITLES})[,\\s]+)?${NMI}${ADDR_END}`,
   "התגלה אוטומטית מההקשר"],
 // נמען נוסף באותה שורה, אחרי ו או "ו/או" ("לכבוד נגה טרכטנגוט ו/או אליאב פרוינדליך"), רק בשורה של "לכבוד".
 // הנוסח המוצע להסבר, ממתין לאישור הבעלים: 'מופיע אחרי "לכבוד"'
 ["addressee",`\\sו(?:\\/או\\s+|-)?(?:(?:${TITLES})[,\\s]+)?${NMI}${ADDR_END}`,
   "התגלה אוטומטית מההקשר",/^[\s\u0000]*לכבוד/u],
 // "בעניין: נגה טרכטנגוט" בכותרת של בקשה, ובשורה שאחרי "בעניין:" שעומדת לבדה
 // וגם כשהייצוג או ת"ז באים אחרי השם ("בעניין: שירה ולדמן ע"י ב"כ עו"ד …", ביקורת שנייה)
 ["matter",`^[\\s\\u0000]*בעניין\\s*:\\s*(?:(?:${TITLES})[,\\s]+)?${NMI}(?=\\s*(?:$|[,;(])|\\s+(?:ע"י|באמצעות|ת\\.?\\s?ז|ת"ז)(?![א-ת]))`,"מופיע בכותרת תיק"],
 ["idfield",`(?:מס'?\\s*זהות|מספר\\s+זהות|ת\\.?ז\\.?)\\s*:?[^\\n]{0,40}?\\b(${NME})\\s*$`,
   'מופיע בשורת זהות'],
 // "הציג בפני הצעה שאינה סופית": בפרוזה "בפני" הוא מילת יחס, לא פתיח של תצהיר.
 // רק תואר אחריו ("נחתם בפני עו\"ד X") הופך אותו לעוגן.
 ["before",`${BD}(?:בפני|אישר(?:ה)?\\s+בפני|נחתם\\s+בפני|הופיע(?:ה)?\\s+בפני)\\s+(?:${TITLES})[,\\s]+(${NME})`,
   'מופיע אחרי "בפני"'],
 ["signed",`${SIGN_OLD}\\s*[,:\\-–]?\\s*${NMI}`,
   "מופיע באזור החתימה"],
 // "בברכה, נגה טרכטנגוט", "בכבוד רב ובברכה, …", "בכבוד, …": רק בראש שורה, כי "בברכה" באה גם בפרוזה (הביקורת של 11.10)
 ["signed",`^[\\s\\u0000]*(?:בברכה|בכבוד(?:\\s+רב)?\\s+ובברכה)\\s*[,:\\-–]?\\s*${NMI}`,"מופיע באזור החתימה"],
 ["signed",`^[\\s\\u0000]*בכבוד\\s*,\\s*${NMI}`,"מופיע באזור החתימה"],
 // מילת תפקיד לפני שם. עם נקודתיים זו כותרת ("התובעת: רונית לוי") — כמעט ודאי,
 // ולכן ביטחון גבוה ומילוי אוטומטי. בלי נקודתיים, בגוף הטקסט ("התובעת רונית לוי"),
 // זה אות אמיתי אבל חלש יותר: "התובעת הגישה בקשה" נראה אותו דבר. לכן ביטחון בינוני,
 // כלומר הצעה שהמשתמשת מאשרת, לא מילוי אוטומטי.
 ["role",`(?:${ROLES})\\s*[:\\-–]\\s*${NMI}`,"מופיע אחרי תפקיד ונקודתיים"],
 // צד ברבים רק בראש שורה: "הסכסוך בין התובעים - שהינם אחים -" הוא פרוזה (הביקורת של 11.10)
 ["role",`^[\\s\\u0000]*(?:${ROLES_PL})\\s*[:\\-–]\\s*(?:\\(?\\d{1,2}[.)]\\s*)?${NMI}(?:\\s*(?:[,;]|ו-?)\\s*(?:\\(?\\d{1,2}[.)]\\s*)?${NMI})?`,"מופיע אחרי תפקיד ונקודתיים",null,{plural:true}],
 // שדה של שם אחרי התפקיד: "שם התובעת: …" הוא של עוגן התפקיד, שממלא את הרשימה (ביקורת שנייה, 11.10)
 // ערך במירכאות ("שם המבקשת: "נגה טרכטנגוט"") הוא אותו שם, כמו בשורת דוא"ל (הביקורת של 11.10)
 ["field",`(?:${FIELD_NAME})\\s*:\\s*["']?${NMI}`,
   'מופיע אחרי שדה "שם:"'],
 // כל שדה אחר של שם ("שם בעל החשבון:", "שם המוטב:"), כמחלקה: חלש, ואחרי השדות המפורשים שלמעלה
 ["fieldx",`(?:^|[\\s\\u0000(,;])(?:${FIELD_ANY})\\s*:\\s*["']?${NMI}`,'מופיע אחרי שדה "שם:"'],
 ["rolep",`(?:${ROLES})\\s+(${NME})`,"מופיע אחרי מילת תפקיד בגוף הטקסט"],
 // מילות תפקיד של הטיפול והחינוך: "למורה ולנטינה", "הגננת רינה", "העו"ס שירן".
 // בתסקיר ובראיון מוקלט אלה לפעמים העוגנים היחידים לשם פרטי זר בלי שם משפחה, ובלעדיהם
 // שם כזה עובר שוב ושוב בלי שום שכבה דטרמיניסטית שתעצור אותו. אות
 // שימוש לפני מילת התפקיד נבלעת ("למורה", "והגננת"). אותו מפתח כמו rolep, ולכן
 // אותו ביטחון בינוני ואותם מסננים: הצעה לאישור, לא מילוי אוטומטי.
 ["carep",`${BD}(?:[בהולמכש]|וה|ול|ש)?(?:מורה|גננת|מטפלת|מטפל|מדריכה|מדריך|מנהלת|מנהל|פסיכולוגית|פסיכולוג|רופאה|רופא|אחות|קלינאית|עו"ס|עובדת\\s+סוציאלית|עובד\\s+סוציאלי)\\s+(?:של[ךכםןנהוי]?,?\\s+)?(${NME})`,
   "מופיע אחרי מילת תפקיד טיפולית או חינוכית"],
 // "אז שמי ולנטינה", "קוראים לי דנה": מי שמציג את עצמו בשם. בראיון מוקלט זה
 // לפעמים המקום היחיד שבו שם המראיינת נאמר, ובלי המודל הוא עובר בלי עוגן.
 ["self",`${BD}(?:שמי|קוראים לי|השם שלי)\\s+(${NME})`,"מציג את עצמו בשם"],
 // "גמישות בהחלפת זמני": ה-ת בסוף מילה ואחריה מילה שמתחילה ב-ז נראו כמו "ת ז". התווית
 // חייבת להיות מילה שלמה, והשם חייב להיגמר בגבול מילה.
 ["bid",`(${NME})(?![\u05d0-\u05ea])\\s*,?\\s*(?=(?<![\u05d0-\u05ea])(?:ת\\.?\\s?ז\\.?|ת"ז|תעודת\\s+זהות|ח\\.?\\s?פ\\.?)(?![\u05d0-\u05ea]))`,'מופיע מיד לפני ת"ז'],
 ["btw",`בין\\s+(${NME})\\s+(?:לבין|ל)`,'מופיע במבנה "בין X לבין Y"'],
 // תור דיבור בתמלול: פסקה שנפתחת בשם ואחריו נקודתיים. "דליה לב שדה: תודה רבה".
 // זה העוגן היחיד שיש לתמלול, ובלי המודל אין לו כמעט שום דבר אחר. תואר
 // לפני השם ("היו\"ר אורלי לוי") נבלע; "מוזמנים:" בלי טקסט אחריו לא נתפס.
 // חותמת של ייצוא שיחה לפני השם נבלעת גם היא (CHAT_STAMP), וכך גם סמל אחרי שם של איש קשר ("נגה 🌸:")
 ["speaker",`^(?:${CHAT_STAMP})?(?:(?:${TITLES}|היו"ר|היו״ר|יו"ר|יו״ר|השר|השרה)\\s+)?(${NWD}(?:\\s+${NWD}){0,2})(?:\\s*[\\p{Extended_Pictographic}\\uFE0F\\u0000]+)?\\s*:\\s`,"פותח תור דיבור בתמלול"],
 ["vs",`(${NME})\\s+נ'\\s+(${NME})`,"מופיע בכותרת תיק"],
 // שורה ברשימת עדים: "1. נגה טרכטנגוט", "(2) ד"ר אליאב פרוינדליך", "- …", או שורה חשופה כשהמספור של Word
 // אינו בטקסט. רק אחרי כותרת של רשימה (labelOf), לעולם לא בשורה לבדה.
 // הנוסח המוצע להסבר, ממתין לאישור הבעלים: 'מופיע ברשימת עדים'
 ["listitem",`^\\s*(?:\\(?\\d{1,2}[.)]|[א-ט][.)]|[-•·*])?\\s*(?:(?:${TITLES})[,\\s]+)?${NMI}`,"התגלה אוטומטית מההקשר"]]
 // gate: עוגן שרץ רק כשהטקסט כולו מתאים לו (עוד נמען, רק בשורה של "אל:"); o: plural — צד ברבים
 .map(([k,r,w,gate,o])=>({k,rx:new RegExp(r,"gu"),w,gate,...(o||{})}));
/* אותם עוגנים לשם באותיות לטיניות (הציד של 11.10): "התובעת: Claire Dubois-Levi", "עו"ד Pierre Martin", "שם המבקש: Marc
   Dubois", "מאת: …", "לכבוד …", "בכבוד רב, …". עד כאן עבר כל כלל, ותיק להחזרת ילד לפי אמנת האג יצא בלי שום שם ברשימה */
const LAT_ANCH=[
 ["role",`(?:${ROLES})\\s*[:\\-–]\\s*${LAT_TITLE}(${LATN1})`],
 ["title",`${BD}(?:${TITLES})[,\\s]+${LAT_TITLE}(${LATN1})`],
 ["field",`(?:${FIELD_NAME})\\s*:\\s*["']?${LAT_TITLE}(${LATN1})`],
 ["mail",`^[\\s\\u0000]*${MAIL_LBL}\\s*:\\s*["']?${LAT_TITLE}(${LATN})`],
 ["addressee",`^[\\s\\u0000]*לכבוד\\s*[:,]?\\s*(?:(?:${TITLES})[,\\s]+)?${LAT_TITLE}(${LATN1})`],
 ["signed",`${SIGN_OLD}\\s*[,:\\-–]?\\s*${LAT_TITLE}(${LATN})`],
].map(([k,r])=>({k,rx:new RegExp(r,"gu"),w:(ANCH.find(a=>a.k===k)||{}).w}));
// עוגנים חלשים: מה שאחרי התווית אינו תמיד אדם ("לכבוד בית המשפט", "מאת: מזכירות בית המשפט"), ולכן slotOK
const WEAK_ANCH=new Set(["mail","addressee","matter","listitem","fieldx"]);
/* עוגן חלש מקבל שם רק כשהוא פותח את מה שאחרי התווית כמו שהוא: מה שהניקוי קיצץ ממנו ("ראש העירייה",
   "מזכירות בית המשפט") אינו שם, וגם לא גוף ציבורי, גוף עם מילת סוג, מילת תפקיד או צירוף סמיכות של תפקיד
   ("פקידת הסעד", "נציג המוסד"). "עיריית חיפה" הוא גוף: ORG_RX אינו תופס אותו, כי \b אינו גבול אחרי אות עברית */
// גם בעל משרה לפני מה שהוא מופקד עליו: "רשם המקרקעין", "רואה החשבון", "שמאי המקרקעין", "שופט התורן" (הביקורת של 11.10)
const SLOT_HEAD=new Set(["ראש","נציג","נציגת","נציגות","סגן","סגנית","ממלא","ממלאת","פקיד","פקידת","מזכירות","לשכת","מחלקת","הנהלת","צוות","יחידת","אגף","מדור",
  "עיריית","עירית","מועצת","מועצה","רשות","משטרת","תחנת","נציבות","הסתדרות","ועדת","קופת","סניף","שות'",
  "רשם","רשמת","שמאי","שמאית","רואה","רואת","שופט","שופטת","נוטריון","כונס","כונסת","מפרק","מפרקת","בורר","בוררת",
  "עורך","עורכת","מתווך","מתווכת","חשב","חשבת","גזבר","גזברית","מבקר","מבקרת","סוכן","סוכנת","מנכ\"ל","מנכ\"לית","יו\"ר",
  // ועוד בעלי משרה, פנייה וגופים ("לכבוד קצינת המבחן", "דיירי הבניין", "אדוני הנכבד", "סוכנות הרכב", ביקורת שנייה)
  "קצין","קצינת","דיירי","דייר","דיירת","אדוני","גבירתי","הנכבד","הנכבדה","סוכנות","מושב","קיבוץ","אגודה","אגודת","שותפות",
  "עמותת","קרן","ועד","חברי","עובדי","תושבי",
  // דרגות במשטרה ובצבא ("רס"ר בתפקיד")
  "רס\"ר","רס\"ל","רס\"ב","רס\"מ","סמ\"ר","סמל","רב\"ט","טוראי","סג\"ם","סרן","רס\"ן","סא\"ל","אל\"מ","פקד","רפ\"ק","נצ\"מ","ניצב","מפקח","מפקחת"]);
function slotOK(raw,c){
  if(raw.trim().split(/\s+/).join(" ")!==c)return false;
  if(PUBLIC_ORG.test(c)||ORG_HEADS.test(c))return false;
  const ws=c.split(/\s+/);
  if(ws.some(w=>SLOT_HEAD.has(w)||ROLE1.includes(w)))return false;
  // "החג", "הגננת של הילדה": מילה מיודעת בראש אינה שם, אלא אם היא שם מוכר ("הדס", "הראל")
  if(ws[0][0]==="ה"&&!KNOWN_FIRST.has(ws[0])&&!POOL.he_s.includes(ws[0]))return false;
  // "הסעד", "המוסד": מילה רגילה עם ה' הידיעה אחרי המילה הראשונה היא צירוף סמיכות, לא שם משפחה
  return !ws.slice(1).some(w=>w[0]==="ה"&&(COMMON.has(w.slice(1))||STOP.has(w)||STOP.has(w.slice(1))))}
/* תווית שעומדת לבדה בפסקה או בתא, והשם שלה בשכן (הציד של 11.10). העוגנים ראו פסקה אחת בכל פעם, ולכן
   "התובעת:" בתא אחד והשם בתא שלידו, "בכבוד רב," והשם בשורה הבאה, "לכבוד" מעל הנמען ורשימת עדים לא נמצאו
   בלי המודל. מחזיר את מה שקורא השכן צריך (anchored, labelNext): lead — התווית כפי שהעוגן מכיר אותה, שנקראת
   לפני טקסט השכן; keys — העוגנים שרצים עליו; list — כותרת של רשימה, וכל שורה שלה היא שכן. כל קריאה של שכן
   חלשה (anchored). בתא, גבול התא הוא הנקודתיים: "התובעת" לבדה בתא היא תווית; בפסקה רק עם נקודתיים,
   כי "התובעת" לבדה בשורה באה בכותרת אחרי השם, לא לפניו. */
const LBL_ROLE=new RegExp(`^(${ROLES})\\s*([:\\-–])?$`,"u"), LBL_FIELD=new RegExp(`^(${FIELD_NAME})\\s*(:)?$`,"u"),
  LBL_FIELDX=new RegExp(`^(${FIELD_ANY})\\s*(:)?$`,"u"),
  LBL_SIGN=/^(?:בכבוד(?:\s+רב)?(?:\s+ובברכה)?|בברכה|ולראי?יה\s+(?:באתי|באנו|באו(?:\s+הצדדים)?)\s+על\s+החתום|חתימה)\s*[,.:-]?$/u,
  LBL_PARTIES=new RegExp(`^(?:${ROLES_PL}|הקטינים|הקטינות)\\s*([:\\-–])?$`,"u"),
  // "עדי" לבדה היא גם שם פרטי: "עדי טרכטנגוט" בשורה משלה הוא אדם, "עדי התביעה" כותרת
  LBL_LIST=/^(?:רשימת\s+)?(?:העדים|עדים|עדי(?=\s+ה))(?:\s+(?:מטעם\s+)?[א-ת"']+){0,2}\s*:?$/u;
function labelOf(text,inCell){
  const t=norm(String(text||"")).replace(/\u0000/g,"").trim();
  if(!t||t.length>40)return null;
  let m;
  // צדדים ברבים: רשימה, וכל שורה בה היא צד כמו "התובעת: …" (as)
  if((m=LBL_PARTIES.exec(t))&&(m[1]||inCell))return {lead:"",keys:["listitem"],list:true,as:"role",why:ANCH.find(a=>a.k==="role").w};
  if((m=LBL_ROLE.exec(t))&&(m[2]||inCell))return {lead:m[1]+": ",keys:["role"]};
  if(/^בעניין\s*:$/u.test(t)||(inCell&&t==="בעניין"))return {lead:"בעניין: ",keys:["matter"]};
  if((m=LBL_FIELD.exec(t))&&(m[2]||inCell))return {lead:m[1]+": ",keys:["field"]};
  if((m=LBL_FIELDX.exec(t))&&(m[2]||inCell))return {lead:m[1]+": ",keys:["fieldx"]};
  if((m=new RegExp(`^(${MAIL_LBL})\\s*:$`,"u").exec(t)))return {lead:m[1]+": ",keys:["mail"]};
  if(/^לכבוד\s*[:,]?$/u.test(t))return {lead:"לכבוד ",keys:["addressee"]};
  if(LBL_SIGN.test(t))return {lead:"בכבוד רב, ",keys:["signed"]};
  if(LBL_LIST.test(t))return {lead:"",keys:["listitem"],list:true};
  return null}
const PFX=new Set(["מ","ב","ל","ו","ה","ש","כ"]);
// סימני מגדר חייבים גבול מילה: בלי זה "תמר" מכיל "מר" והשם נקרא כזכר.
const GF=new RegExp(BD+"(?:גב'|גברת|השופטת|הרשמת|המצהירה|העדה|התובעת|הנתבעת|המבקשת|"+
  "המשיבה|הנאשמת|המערערת|המנוחה|הקטינה|ילידת|אשתו|גרושתו|בתו|אמו|הגב')"+NWE,"u");
const GM=new RegExp(BD+"(?:מר|השופט|הרשם|המצהיר|העד|התובע|הנתבע|המבקש|המשיב|הנאשם|"+
  "המערער|המנוח|הקטין|יליד|בעלה|גרושה|בנו|אביו)"+NWE,"u");
function cleanName(raw){
  let w=raw.trim().split(/\s+/);
  // "כהן" ו"שגב" הם שמות משפחה, לא כ+הן ו-ש+גב: בלי החריג "דוד כהן:" נחתך ל"דוד"
  const bad=x=>{const c=x.replace(/['"-]/g,"");
    return STOP.has(c)||(c.length>2&&PFX.has(c[0])&&STOP.has(c.slice(1))&&!POOL.he_s.includes(c)&&!POOL.ar_s.includes(c))};
  while(w.length&&bad(w[w.length-1]))w.pop();
  while(w.length&&bad(w[0]))w.shift();
  if(!w.length||w.length>3)return null;
  for(const x of w) if(bad(x)||x.replace(/['"-]/g,"").length<2)return null;
  return w.join(" ");
}
// לפני המועמד אות ראשונה ("נ. ", "נ.ש. ") או תואר: אז מילה אחת, שם המשפחה, היא שם שלם
const BEFORE_INI=/(?:^|[^א-ת])[א-ת](?:\.\s?|'\s)(?:[א-ת](?:\.\s?|'\s))?$/u, BEFORE_TITLE=new RegExp(`(?:${TITLES})[,\\s]+$`,"u");
/* השכן של תווית הוא שם רק כשהשורה בנויה כשם (הביקורת של 11.10): אחריו סוף השורה, פסיק, ת"ז, ע"י, כתובת,
   סוגריים, מקף, תואר או ו' של אדם נוסף. שורה שממשיכה במילים אחרות, או נגמרת בנקודה, היא דיבור: "המבקשת:"
   ומתחתיה "מסכימה להסדר השהות המוצע." מילא את הרשימה בכינוי, וכך יצא ל-AI */
// וגם שנת לידה או גיל אחרי השם ("שירה ולדמן ילידת 1985", ביקורת שנייה)
const NEAR_END=new RegExp(`^(?:\\s*["']?\\s*$|\\s*[,;(<\\[]|\\s+[-–]\\s|\\s+(?:ת\\.?\\s?ז|ת"ז|ע"י|באמצעות|מ?(?:רחוב|רח'|שד'))|\\s+ו|\\s+(?:${TITLES})(?![א-ת])|\\s+(?:יליד|ילידת|בן|בת)\\s+\\d)`,"u");
// זוג רק בעוגנים של חריץ: צד, נמען, שולח, נושא, רשימה, חתימה
const COUPLE_ANCH=new Set(["role","mail","addressee","matter","listitem","signed"]);
/* זוג עם שם משפחה משותף ("נגה ואליאב טרכטנגוט"): שני אנשים, לא שם אחד משובש שמילא את הרשימה ושלח את שם
   המשפחה האמיתי ליד שמות בדויים (הביקורת של 11.10). הראשון בשמו הפרטי, השני עם שם המשפחה שאחריו. "שירה ולדמן"
   נשאר אדם אחד: שם משפחה שנפתח ב-ו, ואין אחריו עוד מילה של שם */
/* (ביקורת שנייה, 11.10) שם משפחה שנפתח ב-ו ואחריו עוד מילה פוצל: "התובע: אורי וקנין נגד חברת הביטוח" מילא את הרשימה
   ב«קנין נגד», והשם הפרטי נשאר. זוג רק כשהמילה שאחריו נראית כשם ומסיימת את השם (NEAR_END: סוף, פסיק, ת"ז, סוגריים,
   מקף, תואר), ולא יישוב עם אות שימוש ("מחיפה") או תואר של פנייה ("היקרה"). שני החצאים מוצעים ואינם ממלאים את הרשימה
   (pair): גם כשזה אדם אחד ("אורי וקנין כהן"), כל המילים מוחלפות, ושם המשפחה אינו נשאר ליד כינוי */
function coupleOf(n,c,s,e,a,ctx){
  const w=c.split(" "); if(w.length!==2||!/^ו-?[א-ת]/.test(w[1]))return null;
  const b=w[1].replace(/^ו-?/,""), nx=/^\s+([א-ת][א-ת'"-]{1,14})(?![א-ת'"-])/u.exec(n.slice(e));
  const many=a.plural||(ctx&&ctx.list);
  const sur=nx&&cleanName(nx[1])===nx[1]&&anchorOK(nx[1])&&nx[1][0]!=="ו"&&slotWords(nx[1],true)&&
    !/^ה(?:יקר|יקרה|יקרים|יקרות|נכבד|נכבדה|נכבדים|מכובד|מכובדת|מכובדים)$/.test(nx[1])&&
    !(PFX.has(nx[1][0])&&PLACE_BY[nx[1].slice(1)])&&NEAR_END.test(n.slice(e+nx[0].length).replace(/\u0000/g,""))?nx[1]:null;
  // בלי שם משפחה אחריו: רק בצד ברבים, כשהשני שם פרטי מוכר ("המבקשים: נגה ואליאב")
  if(!sur&&!(many&&knownName(b)))return null;
  if(b.length<2||!anchorOK(b))return null;
  const sb=s+c.length-b.length, eb=sur?e+nx[0].length:e;
  return [{c:w[0],s,e:s+w[0].length,raw:w[0],pair:true},{c:sur?b+" "+sur:b,s:sb,e:eb,raw:sur?b+" "+sur:b,pair:true}]}
/* ctx: תווית שעומדת לבדה בשכן (labelOf). הטקסט נקרא כאילו התווית עומדת לפניו, רק בעוגנים שלה, והמיקומים
   חוזרים לטקסט עצמו. בלי ctx, שורת רשימה אינה עוגן. ממצא של שכן נושא near, ו-only כשהשורה היא השם בלבד */
function anchored(text,ctx){
  const lead=ctx?ctx.lead:"", L=lead.length;
  const n=norm(lead+text),out=[],seen=new Set();
  for(const a of ANCH){
    if(ctx?!ctx.keys.includes(a.k):a.k==="listitem")continue;
    if(a.gate&&!a.gate.test(n))continue;
    // ההקשר של שכן הוא שורה אחרת, ולכן כל קריאה של שכן חלשה: slotOK ומילים של שם (הביקורת של 11.10)
    const weak=WEAK_ANCH.has(a.k)||!!ctx||!!a.plural;
    a.rx.lastIndex=0;let m;
    while((m=a.rx.exec(n))){
      const stamped=a.k==="speaker"&&STAMP_RX.test(m[0]);
      for(let g=1;g<m.length;g++){
        if(!m[g])continue;
        // גרשיים בסוף מילה הם מירכאה שנסגרת, לא חלק מהשם: 'מאת: "נגה טרכטנגוט" <…>'
        let raw=m[g].replace(/"+$/,"");
        let c=cleanName(raw); if(!c)continue;
        // "פלוני", "פלונית", "אלמוני" הם מציין-מקום של בית המשפט, לא שם. "פלוני בדיון"
        // נתפס כאן כשם ואז הוחלף, וההחלפה מחקה את המילה שנועדה להסתיר.
        if(["פלוני","פלונית","אלמוני","אלמונית"].includes(c.split(" ")[0]))continue;
        // העוגן הפרוזאי בלבד: מילת תפקיד באה גם לפני פועל ("התובעת הגישה בקשה").
        // מסננים פעלים ומילים נפוצות; לא nameish, שדוחה שמות כמו הדס.
        // בכתב טענות השמות מעטים ומילות התפקיד רבות: "הח"מ סבורה", "הקטין ביקש", "בפני מי
        // מההורים". פועל, מילה נפוצה או מילת תפקיד בתוך המועמד פוסלים אותו, בכל העוגנים.
        if(a.k!=="speaker"&&!anchorOK(c)){
          // "הקטינה אגם פעמיים": התבנית בולעת את המילה שאחרי השם, המועמד
          // הדו-מילתי נדחה, ואיתו נופל גם השם עצמו. מנסים שוב את המילה
          // הראשונה לבדה. רק בעוגני התפקיד, שבהם מילת התפקיד כבר קבעה
          // שמה שבא אחריה הוא שם. לא בצד ברבים: "המערערים: יורשי המנוח" אינו «יורשי»
          const w1=((a.k==="role"&&!a.plural)||a.k==="rolep"||a.k==="carep")?c.split(" "):[];
          if(w1.length<2||!anchorOK(w1[0]))continue;
          c=w1[0];
        }
        // "המבקשת הביאה", "המשיבה המציאה", "המבקש להעברת מדורו": אחרי מילת תפקיד בגוף
        // הטקסט בא בדרך כלל פועל, לא שם. מילה יחידה שנפתחת ב-ה' ואינה שם פרטי מוכר
        // נדחית; שמות כמו הדס, הילה והלל נמצאים ברשימות ולכן עוברים.
        if(a.k==="rolep"||a.k==="carep"){const cw=c.split(/\s+/);
          if(cw.length===1&&c[0]==="ה"&&!KNOWN_FIRST.has(c))continue;
          if(cw.length>1&&cw.every(x=>x[0]==="ה"||PFX.has(x[0])))continue;}
        // מילת תפקיד טיפולית באה גם לפני תואר ("פסיכולוגית קלינית", "מדריך נוער"),
        // לפני פועל ("המנהל סיכמנו") ולפני מילת יחס ("למורה שלך"). המילה הראשונה
        // אחריה חייבת להיראות כשם פרטי: מוכרת מהרשימות, או שאינה מילה, פועל, תואר
        // או שייכות. ארבע הצעות עודפות על הקורפוס נולדו בלי הבדיקה הזאת.
        // "הפסיכולוג שלו, ברקוביץ": מילת השייכות אחרי התפקיד אינה חלק מהשם —
        // מקלפים אותה ובודקים את מה שאחריה, במקום להציע "שלו ברקוביץ"
        if(a.k==="carep"){const cw0=c.split(/\s+/); if(cw0.length>1&&/^של[ךכםןנהוי]?$/.test(norm(cw0[0])))c=cw0.slice(1).join(" ");}
        if(a.k==="carep"||a.k==="self"){const f=norm(c.split(/\s+/)[0]);
          // "קוראים לי עכשיו", "המורה שלה עכשיו": תואר-פועל או מילת עצירה אחרי העוגן אינם שם
          if(STOP.has(f)||COMMON.has(f)||VRB.has(f)||/^(?:עכשיו|היום|כאן|פה|שם|גם|רק|כבר|אחרת|ככה|כך|תמיד|אולי|לפעמים)$/.test(f))continue;
          if(!KNOWN_FIRST.has(f)){
            if(/^של[ךכםןנהוי]?$/.test(f)||/(?:נו|תי|ית|יים|יות)$/.test(f))continue;
            // "מדריך נוער", "אחות ראשית", "מטפלת משפחתית": הזנב של תפקיד מורכב, לא שם
            if(CARE_TAIL.has(f))continue;
            if(!nameish(f,new Set()))continue;
          }}
        // תור דיבור: "מועד אחרון לתגובה:" ו"בעניין הקטין:" הם תוויות, לא דוברים
        // מילה נפוצה שהיא גם שם פרטי מוכר ("דוד" — גם דוד של הילד) אינה פוסלת דובר בן שתיים-שלוש
        // מילים: "דוד כהן:" פעמיים הוא אדם, ובלי המודל הוא נשמט מהרשימה. דובר של מילה אחת נשאר זהיר.
        const csp=c.split(/\s+/), firstName=w=>POOL.he_m.includes(w)||POOL.he_f.includes(w)||POOL.ar_m.includes(w)||POOL.ar_f.includes(w)||FEM.has(w)||MASC.has(w);
        if(a.k==="speaker"&&csp.some(w=>FORMLABEL.has(w)||STOP.has(w)||(COMMON.has(w)&&!(csp.length>1&&firstName(w)))||VRB.has(w)||ROLEWORD.test(w)||
          (NOT_PERSON.has(w)&&!knownName(w))))continue;
        // "סיכמנו:" ו"הבנתי:" הם פועל בגוף ראשון לפני נקודתיים, לא דובר. רק מילה
        // בודדת: "אברה ברהנו:" הוא דובר, ו"ברהנו" נגמר ב-נו כמו פועל.
        // המילה הראשונה נבדקת גם כשאחריה שם משפחה: "אמרנו כהן:" פותח בפועל.
        if(a.k==="speaker"){const f0=norm(c.split(/\s+/)[0]); if(/(?:נו|תי)$/.test(f0)&&!KNOWN_FIRST.has(f0)&&(!/\s/.test(c)||f0.length>3))continue;}
        /* אחרי חותמת של שיחה בא גם רישום ביומן, "12.3.2026, 16:00 - איסוף: …", ושם התווית חוזרת ומילאה את הרשימה
           (הביקורת של 11.10). דובר שהניקוי קיצץ ("מספר לא ידוע") אינו שם; מילה רגילה או נטייה שלה ("שיחת וידאו")
           אינה שם; ומילה אחת שאינה שם מוכר אינה שם כשהיא קצרה, מיודעת או שם פעולה ("איסוף", "העברה", "תזכורת") */
        if(stamped){
          if(raw.trim().split(/\s+/).join(" ")!==c)continue;
          const sw=c.split(/\s+/);
          if(sw.some((w,i)=>!knownName(w)&&(NOT_NAME.has(w)||wordForm(w,i===0))))continue;
          if(sw.length===1&&!knownName(c)&&(c.length<3||c[0]==="ה"||VNOUN.test(c)))continue;
          // וכל מילה שלו נבדקת כמו בחריץ: שם פעולה, מילת מילוי, נטייה או רבים ("איסוף מהגן", "העברה בנקאית", "צעקות
          // בטלפון") אינם שולח (ביקורת שנייה, 11.10)
          if(!slotWords(c,true))continue;
        }
        let s=m.index+m[0].indexOf(m[g]); const o=m[g].indexOf(c); if(o>0)s+=o;
        let e=s+c.length;
        if(s<L)continue;
        // בשכן של תווית השם פותח את השורה: "התובעת:" ואחריה "המשרד להגנת הסביבה" אינה «להגנת»
        if(ctx&&o>0)continue;
        /* שם פרטי שנעצר לפני מילה שנפתחת ב-ו (MAIL_END, ADDR_END, NEAR_END, או המילה הראשונה של מועמד שנפסל): אדם נוסף
           רק כשאחרי ו' בא שם פרטי מוכר. אחרת זה שם המשפחה שלו, שנפתח ב-ו ("לכבוד שירה ולדמן היקרה", "מאת: אורי וקנין
           מנהל חשבונות"): עד כאן נשאל השם הפרטי לבדו, ואחרי האישור שם המשפחה האמיתי נשאר ליד שם בדוי (ביקורת שנייה,
           11.10). מילה שנראית כשם נקראת עם השם; מילה רגילה ("ומשפחתה") משאירה אותו כמו שהוא */
        {const vm=/^[\s\u0000]+(ו-?([א-ת][א-ת'"-]+))(?![א-ת'"-])/u.exec(n.slice(e));
         if(vm&&!/\s/.test(c)&&!KNOWN_FIRST.has(vm[2])){
           const c2=c+" "+vm[1];
           if(anchorOK(c2)&&slotWords(c2,true)){c=c2; raw=c2; e+=vm[0].length;}
         }}
        const parts=(COUPLE_ANCH.has(a.k)&&coupleOf(n,c,s,e,a,ctx))||[{c,s,e,raw}];
        for(const p of parts){
          const k=p.s+":"+p.e; if(seen.has(k))continue;
          // נמען או שולח נוסף אחרי ו' אינו מתחיל בתוך שם שכבר נמצא: ה-ו של "ולדמן" אינה "ו" של אדם נוסף ("מאת: שירה
          // ולדמן מחיפה" הציע את «לדמן מחיפה», ביקורת שנייה)
          if(a.gate&&out.some(o=>o.s<p.e-L&&p.s-L<o.e))continue;
          seen.add(k);
          const rest=n.slice(p.e).replace(/\u0000/g,"");
          const viaIni=BEFORE_INI.test(n.slice(Math.max(0,p.s-6),p.s)), viaTitle=BEFORE_TITLE.test(n.slice(Math.max(0,p.s-16),p.s));
          // "ר' תצהיר האם", "ר' ההחלטה", "א. פירוק השיתוף": אחרי "ראו" או אות של סעיף בא מסמך או נושא, לא שם משפחה
          if(viaIni&&!knownName(p.c)&&(p.c[0]==="ה"||DOC_WORD.has(p.c)||VNOUN.test(p.c)))continue;
          if(weak){
            if(!slotOK(p.raw,p.c))continue;
            // מילה אחת בחריץ חלש רק כשהיא שם מוכר, או אחרי אות ראשונה או תואר, או בשדה של שם. שדה של מי שהוא אדם או
            // חברה ("שם הקבלן: א.ב. בנייה", "שם הספק: אלקטרה") אינו נותן מילה אחת שאינה שם (ביקורת שנייה)
            const org=FIELD_ORG.test(n.slice(Math.max(0,p.s-40),p.s));
            if(org&&!/\s/.test(p.c)&&!knownName(p.c))continue;
            const one=p.pair||viaIni||viaTitle||(ctx?ctx.keys.some(x=>x==="field"||x==="fieldx"):a.k==="fieldx");
            if(!slotWords(p.c,one))continue;
            // "בעניין: פירוק שיתוף", "בעניין: יישוב סכסוך", "בעניין: קיום צוואה": נושא הבקשה נפתח בשם פעולה
            const f=p.c.split(" ")[0]; if(a.k==="matter"&&(VNOUN.test(f)||MATTER_W.has(f))&&!knownName(f))continue;
          }
          // וגם מקצוע או משרה אחרי השם מסיימים אותו ("דנה וייס מנהלת הלשכה" מתחת ל"לכבוד", ביקורת שנייה)
          const w1=(/^\s+([א-ת"']+)/u.exec(rest)||[])[1];
          if(ctx&&!NEAR_END.test(rest)&&!(w1&&(NOT_PERSON.has(w1)||SLOT_HEAD.has(w1))))continue;
          if(a.k==="addressee"&&!ctx&&/^\s*,/.test(rest)){
            const w1=rest.replace(/^\s*,\s*/,"").split(/[\s,]+/)[0]||"";
            if(!ADDR_REST.test(rest)&&!PLACE_BY[w1]&&!ROLE1.includes(w1))continue;
          }
          let role=null;
          if(a.k==="role"||a.k==="rolep"){
            const rm=/(התובע(?:ת)?|הנתבע(?:ת)?|המבקש(?:ת)?|המשיב(?:ה)?|הנאשמת|הנאשם|המערער(?:ת)?|המנוח(?:ה)?)/.exec(m[0]);
            if(rm)role=rm[1];
          }
          // המסמך עצמו מעיד על המגדר טוב יותר מכל ניחוש לפי השם
          const ctx0=n.slice(Math.max(0,m.index-26),p.s+p.c.length+26);
          const gh=GF.test(ctx0)?"f":GM.test(ctx0)?"m":null;
          const h={s:p.s-L,e:p.e-L,type:"NAME_ANCHORED",label:"שם (לפי הקשר)",text:text.slice(p.s-L,p.e-L),
            why:(ctx&&ctx.why)||a.w,anchor:(ctx&&ctx.as)||a.k,src:"pattern",prio:2,conf:"medium",role,g:gh};
          /* שכן של תווית ממלא את הרשימה רק כשהשורה היא השם בלבד, ורק עם ראיה של שם: מילה שהיא שם מוכר (known), או אותו
             שם במקום אחר במסמך (discover). "המבקשת:" מעל "מהנדסת תוכנה" או "עובדת ניקיון" מילאה את הרשימה (ביקורת שנייה) */
          if(ctx){h.near=true; h.only=!rest.trim(); h.known=p.c.split(/\s+/).some(knownName);
            // שורה ממוספרת ברשימת צדדים ("1. נגה טרכטנגוט" מתחת ל"התובעים:") היא ראיה של כותרת תיק
            h.numbered=!!ctx.list&&/^[\s\u0000]*\(?\d{1,2}[.)]/.test(n.slice(L));}
          /* "הנתבע - מתנגד נחרצות" בפרוטוקול: באותה שורה, מה שנפתח במילת מילוי, בפועל, בבינוני של פועל או בשם פעולה
             נשאר הצעה ואינו ממלא את הרשימה. לא שם משפחה שנגמר כמו רבים ("נסים", "מרגליות") או נראה כשם פעולה
             ("מימון"): אחרי שם פרטי מוכר הוא שם משפחה (ביקורת שנייה) */
          else if(a.k==="role"){const f0=p.c.split(/\s+/)[0];
            if(!KNOWN_FIRST.has(f0)&&!knownName(f0)&&(FILLER.has(f0)||VRB.has(f0)||NOT_NAME.has(f0)||VNOUN.test(f0)||
              /^מת[א-ת]{3,}$/.test(f0)||wordForm(f0,true)))h.unsure=true;}
          // חצי של זוג אינו ממלא את הרשימה מעצמו (coupleOf), וגם לא שולח אחרי חותמת שאף מילה שלו אינה שם מוכר
          if(p.pair)h.pair=true;
          // שולח אחרי חותמת ממלא את הרשימה רק כשאחת המילים שלו היא שם מוכר: תווית ביומן נראית אותו דבר (ביקורת שנייה)
          if(stamped&&!p.c.split(/\s+/).some(knownName))h.weakSpk=true;
          out.push(h);
        }
      }}}
  // שם באותיות לטיניות אחרי אותן תוויות (LAT_ANCH); בשכן של תווית, רק כשהשורה נגמרת אחריו
  for(const a of LAT_ANCH){
    if(ctx&&!ctx.keys.includes(a.k))continue;
    a.rx.lastIndex=0;let m;
    while((m=a.rx.exec(n))){
      const c=m[1].replace(/\s+/g," ").trim(); if(!latinOK(c))continue;
      const s=m.index+m[0].lastIndexOf(m[1]), e=s+m[1].length; if(s<L)continue;
      const k=s+":"+e; if(seen.has(k))continue; seen.add(k);
      const rest=n.slice(e).replace(/\u0000/g,"");
      if(ctx&&!NEAR_END.test(rest))continue;
      const rm=a.k==="role"&&/(התובע(?:ת)?|הנתבע(?:ת)?|המבקש(?:ת)?|המשיב(?:ה)?|הנאשמת|הנאשם|המערער(?:ת)?|המנוח(?:ה)?)/.exec(m[0]);
      // המגדר מהתווית ומהמסמך, כמו בשם עברי ("הקטינה: Léa Dubois" מקבלת שם בדוי של אישה)
      const c0=n.slice(Math.max(0,m.index-26),e+26), gh=GF.test(c0)?"f":GM.test(c0)?"m":null;
      const h={s:s-L,e:e-L,type:"NAME_ANCHORED",label:"שם (לפי הקשר)",text:text.slice(s-L,e-L),why:(ctx&&ctx.why)||a.w,
        anchor:(ctx&&ctx.as)||a.k,src:"pattern",prio:2,conf:"medium",role:rm?rm[1]:null,g:gh,latin:true};
      if(ctx){h.near=true; h.only=!rest.trim(); h.known=false;}
      out.push(h);
    }}
  return out}
// העוגנים קוראים את מה שהקורא רואה: בלי סימני כיוון ותווים בלתי נראים (squeeze), והמיקומים חוזרים לטקסט עצמו
function anchoredSeen(text,ctx){
  const t=String(text||""), q=squeeze(t); if(!q)return anchored(t,ctx);
  return anchored(q.t,ctx).map(h=>({...h,s:q.pos[h.s],e:q.pos[h.e-1]+1}))}

const PLACES=[["ירושלים",31.78,35.22],["תל אביב",32.08,34.78],["חיפה",32.82,34.99],["ראשון לציון",31.97,34.8],["פתח תקווה",32.09,34.89],["אשדוד",31.8,34.65],["נתניה",32.33,34.86],["באר שבע",31.25,34.79],["בני ברק",32.08,34.83],["חולון",32.02,34.77],["רמת גן",32.07,34.82],["אשקלון",31.67,34.57],["רחובות",31.89,34.81],["בת ים",32.02,34.75],["בית שמש",31.75,34.99],["כפר סבא",32.18,34.91],["הרצליה",32.16,34.84],["חדרה",32.44,34.92],["מודיעין",31.9,35.01],["נצרת",32.7,35.3],["לוד",31.95,34.89],["רמלה",31.93,34.87],["רעננה",32.18,34.87],["רהט",31.39,34.75],["הוד השרון",32.15,34.89],["גבעתיים",32.07,34.81],["קרית אתא",32.81,35.11],["נהריה",33.01,35.09],["קרית גת",31.61,34.77],["אום אל-פחם",32.52,35.15],["עפולה",32.61,35.29],["אילת",29.56,34.95],["טבריה",32.79,35.53],["עכו",32.93,35.08],["אלעד",32.05,34.95],["רמת השרון",32.15,34.84],["כרמיאל",32.92,35.3],["טירה",32.23,34.95],["יבנה",31.88,34.74],["טייבה",32.27,35.01],["קרית ביאליק",32.83,35.08],["קרית אונו",32.06,34.86],["נס ציונה",31.93,34.8],["מעלה אדומים",31.77,35.3],["ראש העין",32.09,34.95],["אור יהודה",32.03,34.85],["צפת",32.96,35.5],["דימונה",31.07,35.03],["טמרה",32.85,35.2],["סח'נין",32.86,35.3],["קרית מוצקין",32.84,35.08],["קרית ים",32.85,35.07],["יהוד",32.03,34.89],["נתיבות",31.42,34.59],["בית שאן",32.5,35.5],["אריאל",32.1,35.17],["מגדל העמק",32.67,35.24],["שפרעם",32.81,35.17],["אופקים",31.31,34.62],["קרית שמונה",33.21,35.57],["כפר יונה",32.32,34.93],["גבעת שמואל",32.07,34.85],["ירוחם",30.99,34.93],["שדרות",31.52,34.6],["זכרון יעקב",32.57,34.95],["בנימינה",32.51,34.95],["פרדס חנה",32.47,34.98],["קצרין",32.99,35.69],["מצפה רמון",30.61,34.8],["ערד",31.26,35.21],["מעלות",33.02,35.28],["בית דגן",32.0,34.83],["אזור",32.02,34.81],["גני תקווה",32.06,34.87],["כוכב יאיר",32.22,35.0],["שוהם",31.99,34.95],["להבים",31.37,34.82],["עומר",31.27,34.85],["מיתר",31.32,34.93],["כפר קאסם",32.11,34.98],["ג'לג'וליה",32.15,34.95],["קלנסווה",32.28,34.98],["באקה אל-גרביה",32.42,35.04],["דאלית אל-כרמל",32.7,35.05],["עוספיא",32.71,35.07],["יקנעם",32.66,35.11],["נשר",32.77,35.04],["טירת כרמל",32.76,34.97],["אור עקיבא",32.51,34.92],["חריש",32.46,35.05],["אפרת",31.65,35.15],["גבעת זאב",31.86,35.17],["קרני שומרון",32.17,35.1],["אלפי מנשה",32.17,35.02],["בית אל",31.94,35.22],["כפר תבור",32.69,35.42],["מג'אר",32.89,35.41],["ירכא",32.95,35.2],["כפר ורדים",33.0,35.28],["קרית טבעון",32.72,35.13],["עתלית",32.69,34.94],["כפר יאסיף",32.95,35.16],["אבו סנאן",32.95,35.17],["מזכרת בתיה",31.85,34.84],["גדרה",31.81,34.78],["קרית מלאכי",31.73,34.75],["גן יבנה",31.79,34.71],["באר יעקב",31.94,34.83],["בית ג'ן",32.96,35.38],["דבוריה",32.7,35.36],["כפר כנא",32.75,35.34],["אכסאל",32.68,35.33],["רכסים",32.74,35.1],["כפר קרע",32.51,35.05],["ערערה",32.49,35.09],["כאבול",32.87,35.19],["דיר אל-אסד",32.93,35.27],["מג'ד אל-כרום",32.92,35.25],["נחף",32.93,35.31],["ראמה",32.94,35.36],["עראבה",32.85,35.34],["דיר חנא",32.86,35.36],["מעיליא",33.02,35.26],["פקיעין",32.98,35.33],["חורפיש",33.02,35.34],["ראש פינה",32.97,35.54],["חצור הגלילית",32.98,35.54],["יסוד המעלה",33.06,35.6],["מטולה",33.28,35.58],["שלומי",33.07,35.14],["בועיינה",32.83,35.32],["כפר מנדא",32.81,35.26],["עילבון",32.83,35.39],["תמרה",32.85,35.2],["מבשרת ציון",31.8,35.15],["בית חורון",31.87,35.13],["צור הדסה",31.72,35.09],["קרית ענבים",31.81,35.12],["אבן יהודה",32.27,34.88],["תל מונד",32.25,34.92],["קדימה",32.28,34.91],["צורן",32.26,34.91],["פרדסיה",32.31,34.9],["בית יצחק",32.34,34.87],["עמק חפר",32.38,34.9],["כפר ויתקין",32.38,34.87],["נהלל",32.69,35.2],["רמת ישי",32.7,35.17],["מגידו",32.58,35.18],["עין השופט",32.6,35.1],["דליה",32.59,35.06],["כפר גלעדי",33.24,35.57],["דן",33.24,35.65],["חולתה",33.05,35.61],["עמיעד",32.93,35.51],["כורזים",32.91,35.56],["כנרת",32.72,35.57],["דגניה",32.71,35.58],["אשדות יעקב",32.65,35.58],["גשר",32.63,35.55],["מעלה גלבוע",32.48,35.42],["בית אלפא",32.52,35.43],["שדה אליהו",32.44,35.51],["טירת צבי",32.42,35.53],["נאות הכיכר",31.02,35.39],["עין גדי",31.46,35.39],["ערוער",31.15,34.98],["כסייפה",31.24,35.01],["תל שבע",31.25,34.85],["שגב שלום",31.19,34.84],["חורה",31.3,34.94],["לקיה",31.32,34.86],["משאבי שדה",31.02,34.79],["שדה בוקר",30.87,34.79],["רביבים",31.04,34.72],["צאלים",31.2,34.53],["אשלים",31.02,34.7],["יטבתה",29.88,35.06],["קטורה",29.97,35.07],["פארן",30.36,35.15],["חצבה",30.77,35.25],["עין יהב",30.65,35.24],["ניצנה",30.87,34.42],["אבשלום",31.23,34.3],["מגן",31.3,34.44],["נירים",31.34,34.39],["כפר עזה",31.48,34.53],["ניר עם",31.51,34.55],["יד מרדכי",31.59,34.55],["ניצן",31.72,34.61],["בית חנן",31.9,34.76],["רינתיה",32.02,34.94],["נחלים",32.05,34.92],["כפר סירקין",32.08,34.91],["גבעת חן",32.19,34.9],["בית ברל",32.2,34.92],["צופית",32.2,34.9],["נירית",32.13,35.0],["אלקנה",32.11,35.0],["עמנואל",32.16,35.13],["קרית ארבע",31.53,35.11],["כרמל",31.42,35.14],["מעון",31.4,35.1],["תקוע",31.65,35.24],["כפר אדומים",31.82,35.33],["ענתות",31.82,35.29],["כוכב השחר",31.97,35.34],["שילה",32.05,35.29],["עלי",32.06,35.29],["ברקן",32.11,35.11],["יקיר",32.13,35.11],["פדואל",32.05,35.05]].map(([n,a,o])=>({n,a,o}));
const PLACE_BY={}; PLACES.forEach(p=>PLACE_BY[p.n]=p);
// שמות יישוב שהם גם מילים עבריות רגילות — "באזור תל אביב" אינו העיר אזור
/* יישובים ששמם אינו רק שם יישוב.

   הקריטריון, ורק הוא: המילה מופיעה בעברית רגילה כמשהו אחר — מילה נפוצה, פועל,
   או שם פרטי שכיח. "אזור" הוא גם שטח, "גשר" הוא גם מבנה, "אריאל" הוא גם שם.

   הרשימה נוקתה מארבעה-עשר ערכים שאינם עומדים בקריטריון והיו פשוט שמות ערים:
   לוד, ערד, מטולה, עתלית, מגידו, ענתות, כורזים, דבוריה, עילבון, פרדסיה, דגניה,
   ראמה, טמרה, נחף. הן הופיעו כאן בטעות, ובגללן העיר לוד הוצגה למשתמשת עם
   ההערה "גם מילה רגילה" — שאינה נכונה, ושהיא הבחינה בה מיד. שם קצר ממילא
   נשמר לבדיקה בזכות מבחן האורך ב-findPlaces, ולכן לא צריך אותם כאן.

   בספק — משאירים. הנזק בהשארה הוא שיישוב לא נכנס למפת המרחקים; הנזק בהסרה הוא
   מילה רגילה שמוחלפת בשם עיר בתוך משפט. */
const AMBIG=new Set(["דן","מגן","כרמל","עלי","שילה","דליה","כנרת","ניצן",
  "גשר","מעון","תמרה","אשלים","טירה",
  "אזור","רחובות","מעלות","שדרות","אריאל","עומר","מיתר","ירוחם","נירית","אורן",
  "יבנה","גדרה","חורה","נשר","ברקן","יקיר","כפר","ראש","עמק",
  "צורן","קדימה","חריש","אפרת"]);
/* יישובים ששמם גם מילה, נטייה, צירוף או שם פרטי, אבל לא דו-משמעיים כמו AMBIG (הציד של 11.10). «אני חוששת
   לשלומי» יצא «אני חוששת לראש העין» בבקשה לצו הגנה, «ההליך תקוע» יצא «ההליך ניצנה», «ישנה בחדרה» יצא
   «ישנה במודיעין», ו«המבקשת ערערה» יצא שם של יישוב. כאן היישוב מוחלף מעצמו רק בהקשר של מקום (placeCtx);
   בלי הקשר הוא שאלה, כמו AMBIG, ואינו נבחר כתחליף. מילה בעברית רגילה: תקוע (נתקע), אופקים, רעננה (טרייה),
   מודיעין, חדרה (החדר שלה), ערערה (הגישה ערעור), נתיבות, נחלים, רכסים, להבים; צירוף שגור בפסיקה: "היה
   לראש פינה", "לא נעלם מעין השופט". שם פרטי: לידו "עברה ל" ו"העיר" אינם הקשר של מקום ("המשמורת עברה
   לאלעד", "העיר שלומי כי"). שלומי הוא גם שם וגם מילה ("חוששת לשלומי"), ולכן both: כחלק של שם מהרשימה הוא
   מוחלף רק כשעומד לבד (08-docx.js). מילים נדירות (רביבים, נירים, חצבה) נשארו בחוץ: במסמך משפטי הן כמעט תמיד
   היישוב. כל שם כאן מופיע ב-tests/towns_t.js עם משפט שמראה שהוא מילה */
const TOWNWORD=new Map([["תקוע","word"],["אופקים","word"],["רעננה","word"],["מודיעין","word"],["חדרה","word"],
  ["ערערה","word"],["נתיבות","word"],["נחלים","word"],["רכסים","word"],["להבים","word"],["ראש פינה","word"],["עין השופט","word"],
  ["שלומי","both"],["שוהם","name"],["אילת","name"],["אלעד","name"],["עמנואל","name"],["אלקנה","name"],
  ["אבשלום","name"],["עמיעד","name"],["צופית","name"]]);
/* תחליף ליישוב.

   ליישוב לא היה מחולל תחליפים בכלל. שם היה מקבל «מיכל ברנע», אבל יישוב קיבל
   «[יישוב א׳]» — תווית בתוך המשפט, שגם שוברת את הקריאה וגם מכריזה שכאן הוסתר
   משהו. המקור היחיד לשם יישוב אמיתי היה מסך היישובים, ומה שהוא לא הציע נפל
   לתווית: יישוב מהמאגר בלי קואורדינטות, מקום שנגזר ממילת מוסד, וכל שם ברשימת
   הדו-משמעיים. השער החדש במסך היישובים הרחיב בדיוק את הקבוצה הזאת, ולכן
   המחולל הוא חלק מאותו תיקון ולא תוספת.

   מסך היישובים עדיין קודם כשהוא רלוונטי, כי הוא שומר על המרחקים בין היישובים.
   זה הרשת מתחתיו. הבחירה נגזרת מ-hash של השם המקורי, ולכן היא יציבה בין
   הרצות; יישוב שמופיע במסמך עצמו לא ייבחר כתחליף, ולא ייבחר שם דו-משמעי. */
/* מקום לפי סוגו (Q11 בגרסה 2): "שכונת הפרדס" מקבלת שם של שכונה, "רחוב הארזים" שם של
   רחוב, "מושב X" שם של מושב, "קיבוץ X" שם של קיבוץ, "כפר X" זנב של כפר.
   מילת הסוג עצמה נשארת בטקסט (היא לא חלק מהערך), ולכן התחליף הוא רק השם.
   מה שאין לו מאגר משלו נופל למאגר היישובים הכללי — לעולם לא לתווית. */
const NEIGHBORHOODS=["רמות","גבעת שאול","נווה שאנן","הדר","קרית משה","נאות אפקה","רמת אביב",
  "גבעת מרדכי","קרית היובל","נווה יעקב","רמת אשכול","נאות שקמה","נווה עוז","קרית שרת",
  "גבעת התמרים","נווה שלום","רמת הנשיא","גני אביב","נווה זאב","קרית מנחם","שכונת הפועלים",
  "נאות גנים","רמת ורבר","נווה עמל","גבעת רם","קרית חיים","נאות רחל","רמת חן"].map(n=>n.replace(/^שכונת\s+/,""));
const STREETS=["הרצל","ויצמן","ז'בוטינסקי","בן גוריון","רוטשילד","הנשיא","האלון","הזית","התמר",
  "הדקל","הברוש","האורנים","השקד","הרימון","ביאליק","סוקולוב","אחד העם","הפלמ\"ח","הנרקיס",
  "הכלנית","הרקפת","החרוב","השיטה","הבנים","העצמאות","הגליל","הכרמל","הירדן","הנגב","השרון"];
const PLACE_KIND_HEADS=[
  [/(?:^|[^֐-׿])(?:[בהולמכש]|ו[בהלמכ]|כש)?שכונ(?:ת|ה)\s*$/u,"שכונה"],
  [/(?:^|[^֐-׿])(?:[בהולמכש]|ו[בהלמכ]|כש)?(?:רחוב|רח'|שדרות|שד'|סמטת|סמטה|דרך)\s*$/u,"רחוב"],
  [/(?:^|[^֐-׿])(?:[בהולמכש]|ו[בהלמכ]|כש)?מושב\s*$/u,"מושב"],
  [/(?:^|[^֐-׿])(?:[בהולמכש]|ו[בהלמכ]|כש)?קיבוץ\s*$/u,"קיבוץ"],
  [/(?:^|[^֐-׿])(?:[בהולמכש]|ו[בהלמכ]|כש)?כפר\s*$/u,"כפר"],
];
// מילת הסוג שלפני מקום בטקסט (מנורמל), או null כשאין
function placeKind(text,s){
  const back=String(text||"").slice(Math.max(0,s-20),s);
  for(const [rx,k] of PLACE_KIND_HEADS) if(rx.test(back))return k;
  return null;
}
/* תחליף ליישוב אינו שם דו-משמעי, מילה, שם פרטי או צירוף: ההחזרה הייתה הופכת את המילה בתשובת ה-AI ליישוב
   האמיתי — «ערערה» ("המבקשת ערערה"), «קדימה», «פתח תקווה». בכל מאגר: לפי סוג ("מושב" נתן נחלים וצופית, "קיבוץ"
   נתן עין השופט ומגן), הכללי, ומפת המרחקים (הביקורת של 11.10) */
const placeSubOK=n=>!!n&&!AMBIG.has(n)&&!placeCond(n);
function placePool(kind,value){
  const gaz=(typeof GAZ!=="undefined"&&Array.isArray(GAZ))?GAZ:[];
  const all=PLACES.map(p=>p.n).concat(gaz);
  const tagged=t=>(typeof ATLAS_TAGS!=="undefined")?PLACES.map(p=>p.n).filter(n=>(ATLAS_TAGS[n]||"").split("|")[0]===t):[];
  if(kind==="שכונה")return NEIGHBORHOODS.filter(placeSubOK);
  if(kind==="רחוב")return STREETS.filter(placeSubOK);
  if(kind==="מושב"){const p=tagged("מושב").filter(placeSubOK); if(p.length>=8)return p;}
  if(kind==="קיבוץ"){const p=tagged("קיבוץ").filter(placeSubOK); if(p.length>=8)return p;}
  if(kind==="כפר"){const p=all.filter(n=>/^כפר\s+\S/.test(n)).map(n=>n.replace(/^כפר\s+/,"")).filter(placeSubOK); if(p.length>=8)return p;}
  // "שמות אקראיים" (Q7 בגרסה 3): רק יישובים מתויגים, ולעולם לא המאגר הלא-מתויג —
  // ירושלים הפכה ל"משמר הנגב" ומודיעין ל"אמונים" כי המאגר הגדול אינו יודע מה הם.
  // יישוב מתויג מקבל יישוב מאותו אופי (אוכלוסייה, דת, עירוני/כפרי); הגודל רשאי לזוז.
  const base=PLACES.map(p=>p.n).filter(n=>n&&n.length>=3&&placeSubOK(n));
  let v=norm(String(value||"")).trim();
  // שם של כמה חלקים מוחלף כולו (הציד של 11.10), ואופיו הוא של העיר שבראשו: «מודיעין-מכבים-רעות» כמו «מודיעין»
  if(v&&typeof ATLAS_TAGS!=="undefined"&&!ATLAS_TAGS[v]){const h=v.split(/\s*-\s*/)[0]; if(h!==v&&ATLAS_TAGS[h])v=h;}
  if(v&&typeof ATLAS_TAGS!=="undefined"&&ATLAS_TAGS[v]&&typeof atlasPenalty==="function"){
    // הקרובים ביותר באופי: לפחות שישה, כדי שיהיה מבחר, ובלי אוכלוסייה שונה לעולם
    const scored=base.filter(n=>n!==v).map(n=>[n,atlasPenalty(v,n)]).filter(x=>x[1]!==Infinity).sort((a,b)=>a[1]-b[1]);
    if(scored.length){const cap=scored[Math.min(5,scored.length-1)][1]; return scored.filter(x=>x[1]<=cap).map(x=>x[0]);}
  }
  return base;
}
function fakePlace(value,used,forbidden,kind){
  const pool=placePool(kind||null,value);
  if(!pool.length)return null;
  const free=n=>{
    if(used&&used.has(n))return false;
    if(!forbidden)return true;
    // גם מילה בודדת מתוך שם דו-מילתי נחשבת: "בית שמש" נפסל אם "שמש" במסמך;
    // וגם צורה עם אות שימוש: "לחיפה" במסמך פוסל את חיפה כתחליף לירושלים
    for(const w of norm(n).split(/\s+/)){
      if(!w)continue;
      if(forbidden.has(w))return false;
      for(const p of "בלמוהשכ") if(forbidden.has(p+w))return false;
    }
    return true;
  };
  const start=hash32(norm(String(value||"")).trim())%pool.length;
  for(let k=0;k<pool.length;k++){
    const cand=pool[(start+k)%pool.length];
    if(free(cand))return cand;
  }
  // המאגר של הסוג נגמר (או שכל שמותיו במסמך): נופלים למאגר הכללי, לא לתווית
  return kind?fakePlace(value,used,forbidden,null):null;
}

/* שם יישוב בכל כתיב רגיל (הציד של 11.10). עד כאן השמות נתפסו רק כפי שנכתבו ברשימה, ולכן «בתל-אביב»,
   «בבאר-שבע», «בתל־אביב» (מקף עברי), «בקריית ביאליק», «בפתח תקוה», «בזיכרון יעקב» ו«באום אל פחם» יצאו כמו
   שהם, ומסך היישובים היה ריק. בין מילות השם רווח, מקף ומקף עברי שקולים; כתיב חסר ומלא לפי SPELL
   (02-hebrew.js); כתיבים אחרים של יישוב מסוים ב-PLACE_ALT. כל כתיב חוזר לשם שברשימה (placeKey), וכך לכולם
   אותו תחליף. שם במקף בלבד שחלק בו קצר ("אלי-עד", "טל-אל") נתפס רק במקף: ברווח הוא צירוף רגיל
   ("הגיע אלי עד הבית") */
// י או ו כפולה מכוסה בקיפול (placeDbl): «נהרייה», «הרצלייה», «כסיפה» ו«דליית» אינם כאן
const PLACE_ALT={"יקנעם":["יוקנעם"],"יקנעם עילית":["יוקנעם עילית"],
  "סח'נין":["סחנין","סכנין"],"עוספיא":["עספיא"],"מג'אר":["מגאר"],
  "דאלית אל-כרמל":["דלית אל-כרמל"],"טירת כרמל":["טירת הכרמל"],"נוף הגליל":["נצרת עילית"]};
// מפריד: רווח, מקף (המקף העברי הוא מקף כבר ב-norm) או לוכסן בין חלקי שם אחד ("תל אביב/יפו" השאיר את «יפו»),
// ו-\0 של ניקוד סביבו, כמו FLEX_SEP
const PLACE_SEP="\\u0000*[ \\t/-][ \\t\\u0000/-]*";
const placeWords=s=>norm(String(s||"")).replace(/\u0000/g,"").trim().split(/[ \t]*[-/][ \t]*|[ \t]+/).filter(Boolean);
const placeFold=w=>{for(const sp of SPELL){const m=sp.rx.exec(w); if(m&&!m[1])return sp} return null};
/* י או ו כפולה באמצע מילה היא כתיב מלא של אותה אות (הביקורת של 11.10): «נתנייה», «ירושליים», «טייבה»,
   «ג'לג'ולייה», «דייר חנא». רק הכפלה: י או ו בודדת לא נוספת ולא נשמטת, ולכן «חלון» אינו «חולון». המפתח
   מכווץ את הכפולה, והביטוי מרשה אותה בכל י ו-ו באמצע מילה — רק ביישוב שהשכבה מחליפה מעצמה: הכפולה של שם
   דו-משמעי או של מילה היא שם אחר («איילת» אינה «אילת», «דלייה»), והוא נשאל בכל מקרה */
const placeDbl=w=>w.replace(/(?<=.)([יו])\1(?=.)/g,"$1");
const placeWordRx=(w,fold)=>{if(!fold)return esc(w); const c=[...placeDbl(w)]; return c.map((x,i)=>i>0&&i<c.length-1&&/[יו]/.test(x)?x+x+"?":esc(x)).join("")};
function placeKey(s){return placeWords(s).map(w=>{const sp=placeFold(w); return sp?sp.key:placeDbl(w)}).join(" ")}
// השם כרצף של [מפריד, מילה] בביטוי; לפני המילה הראשונה אין מפריד
function placeParts(name,fold){
  const v=norm(name).trim(), w=placeWords(v);
  const strict=!/\s/.test(v)&&w.length===2&&w.some(x=>x.replace(/['"]/g,"").length<4);
  return w.map((x,i)=>{const sp=placeFold(x);
    return [i?(strict?"\\u0000*-\\u0000*":PLACE_SEP):"",sp?sp.L.map(l=>esc(l.c)+(l.opt?"?":"")).join(""):placeWordRx(x,fold)]});
}
/* הביטוי נבנה כעץ של מילים: ראש משותף ("בית", "כפר", "גבעת") והמפריד שאחריו נבדקים פעם אחת ולא פעם לכל
   שם. כרשימה שטוחה של מאות שמות עם מפריד גמיש, סריקת המאגר הייתה איטית פי חמישה-עשר. המשך ארוך נבדק לפני
   סוף השם ("תל אביב - יפו" לפני "תל אביב"), ומילה ארוכה לפני מילה שהיא תחילתה ("ביתר" לפני "בית") */
function placeTrie(list){
  const root={kids:new Map()};
  for(const parts of list){let node=root;
    for(const [sep,w] of parts){const k=sep+"\u0001"+w; if(!node.kids.has(k))node.kids.set(k,{sep,w,kids:new Map(),end:false}); node=node.kids.get(k);}
    node.end=true;}
  const emit=node=>{
    const alts=[...node.kids.values()].sort((a,b)=>b.w.length-a.w.length)
      .map(c=>c.sep+c.w+(c.kids.size?(c.end?"(?:"+emit(c)+")?":emit(c)):""));
    return alts.length===1?alts[0]:"(?:"+alts.join("|")+")";
  };
  return emit(root);
}
// מילון כתיב → שם, והביטוי שתופס את כולם, עם אות שימוש לפניו. skip: כתיבים שכבר ברשימה אחרת
function placeIndex(names,skip){
  const keys=new Map(), list=[];
  for(const n of names) for(const sf of [n,...(PLACE_ALT[n]||[])]){
    const k=placeKey(sf); if(keys.has(k)||(skip&&skip.has(k)))continue;
    keys.set(k,n); list.push(placeParts(sf,!AMBIG.has(n)&&!TOWNWORD.has(n)));
  }
  return {keys,rx:new RegExp("(?<![\\u0590-\\u05ff])(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?("+
    placeTrie(list)+")(?![\\u0590-\\u05ff])","gu")};
}
const PLACE_IX=placeIndex(PLACES.map(p=>p.n),null);
const PLACE_RX=PLACE_IX.rx;
const VENUE=[
 ["בית\\s+(?:ה)?ספר|ביה\"ס|בי\"ס|תיכון|חטיבת\\s+ביניים|אולפנת|ישיבת|גן\\s+ילדים","מוסד חינוך"],
 ["אוניברסיטת|מכללת|המכללה\\s+ל","מוסד אקדמי"],
 ["סופר|סופרמרקט|מרכול|מכולת|קניון|מרכז\\s+מסחרי","עסק"],
 ["בית\\s+(?:ה)?חולים|ביה\"ח|מרפאת|קופת\\s+חולים|מכון","מוסד רפואי"],
 ["מלון|בית\\s+מלון|מסעדת|בית\\s+קפה|פאב","עסק"],
 ["בנק|סניף|חברת|קבוצת|עמותת","גוף"],
 ["מתנ\"ס|מרכז\\s+קהילתי|בית\\s+כנסת|בית\\s+אבות|מועדון","מוסד"],
 ["מושב|קיבוץ|כפר|שכונת|היישוב|המושב|הקיבוץ|העיירה|אזור\\s+התעשייה","יישוב"],
 ["תחנת\\s+משטרת|משטרת|לשכת","גוף"],
].map(([a,l])=>({rx:new RegExp(`(?:${a})\\s+(${NME})`,"gu"),l}));
const PLACE_HEAD=new Set(PLACES.filter(p=>p.n.includes(" ")).map(p=>p.n.split(" ")[0]));
// "סופר יוחננוף באשדוד" — שם העסק נגמר לפני שם היישוב
function trimPlace(v){
  // יישוב בסוף, בכל כתיב ועם אות השימוש שלו, הוא המקום של המוסד ולא שמו. בלי זה "בית הספר נמצא בתל-אביב"
  // בולע את היישוב לתוך שם המוסד ("נמצא בתל-אביב"), שעולה רק לבדיקה, והיישוב אינו מוחלף (הציד של 11.10)
  {const n=norm(v), all=placeScan(n), z=all[all.length-1]; if(z&&!n.slice(z.e).trim())v=v.slice(0,z.i).trim();}
  if(!v)return "";
  const w=v.split(/\s+/);
  while(w.length>1){
    const last=w[w.length-1], bare=last.replace(/^[בהולמכש]/,"");
    // ראש של שם יישוב בכל כתיב: "נמצא בקריית" שהמילה הבאה נחתכה ממנו הוא "נמצא"
    if(PLACE_BY[last]||PLACE_BY[bare]||PLACE_HEAD.has(placeKey(bare))||PLACE_HEAD.has(placeKey(last))||
       (w.length>2&&PLACE_BY[w.slice(-2).join(" ")])||
       // "שכונת הפרדס בעקבות קריאה": מילת יחס או פועל אחרי השם אינם חלק ממנו
       TRAIL.has(last)||VRB.has(last)) w.pop();
    else break;
  }
  return w.join(" ");
}

/* כל היישובים בטקסט המנורמל, מהרשימה עם הקואורדינטות ומהמאגר (07-gazetteer.js), בלי חפיפות: שם ארוך גובר
   על שם שבתוכו. «מודיעין-מכבים-רעות» הפך ל«מעלה אדומים-מכבים-רעות» כי רק «מודיעין» הוחלף, והזנב שנשאר
   עדיין אמר איזו עיר זו (הציד של 11.10); ומסך היישובים הציע את «מודיעין» לבד. מהמאגר רק שמות של שתי מילים
   ומעלה (שם במקף הוא כזה): הזנב הארוך של שמות בני מילה אחת הוא ברובו מילים רגילות ("קדימה", "לשם", "חבר",
   "גבעות"), ועל ארבעה מסמכים אמיתיים נתן שנים-עשר סימונים מיותרים ואפס תפיסות (docs/measurements.md).
   שם מהמאגר שהוא חלק משם של גוף ציבורי ("משרד הרווחה") אינו מקום. name הוא השם שברשימה, בכל כתיב */
function placeScan(n){
  const out=[];
  const run=(ix,mappable)=>{
    ix.rx.lastIndex=0; let m;
    while((m=ix.rx.exec(n))){
      const name=ix.keys.get(placeKey(m[1])), e=m.index+m[0].length, s=e-m[1].length;
      if(!name)continue;
      if(!mappable){const back=n.slice(Math.max(0,m.index-30),m.index).split(/\s+/).filter(Boolean).slice(-2); const full=m[0].trim(); const c2=[...back,full].join(" "), c1=[...back.slice(-1),full].join(" ");
        if([c2,c1].some(x=>PUBLIC_ORG.test(x)||PUBLIC_ORG.test(x.replace(/^[בהולמכש]/,""))))continue;}
      out.push({s,e,i:m.index,pre:m[0].slice(0,s-m.index),name,mappable});
    }};
  run(PLACE_IX,true);
  if(typeof GAZ_IX!=="undefined")run(GAZ_IX,false);
  out.sort((a,b)=>a.s-b.s||(b.e-b.s)-(a.e-a.s));
  const keep=[]; let end=-1;
  for(const x of out) if(x.s>=end){x.k=keep.length; keep.push(x); end=x.e}
  return keep;
}
/* הקשר של מקום סביב יישוב מ-TOWNWORD (הציד של 11.10), בטקסט המנורמל ובאותה שורה. כל אחד מאלה מספיק:
   ב- אחרי פועל של מגורים ("גרה באופקים", "מתגוררת עם ילדיה בשלומי"), אחרי בית, דירה, קנייה או נישואים ("הדירה
   ברעננה", "רכשו דירה במודיעין"), אחרי מקום, לימודים, מפגש או אירוע ("הקטינים לומדים באלעד", "יתקיימו
   במודיעין") ואחרי עבודה ("עובד ברעננה"); ל-/מ- אחרי פועל של מעבר, נסיעה או חזרה, לא ליד שם פרטי ("עברו
   לרעננה", "חזרה לנתיבות"), ו"עזבה את רעננה"; מילת יישוב לפניו ("תושבת שלומי", "ילידת חדרה", "בעיר רעננה",
   "מושב נחלים"); כתובת ("ברחוב הנרקיס 9 ברעננה", "הנרקיס 9, רעננה", "הנרקיס 9 רעננה" בסוף המשפט, מיקוד אחריו,
   "כתובת:"); בית משפט או מוסד לפני ב- ("בבית המשפט לענייני משפחה ברעננה"), בית משפט בלי ב- ("בית משפט השלום
   חדרה") ושורת התיק ("(משפחה חדרה)"); כותרת של צד ("המבקשת, מאילת,"); אזור ("באזור רעננה", "מצפון לרעננה",
   "בכניסה לרעננה"); או יישוב אחר צמוד ("מחיפה לרעננה", "בין רעננה לכפר סבא"). "אני חוששת לשלומי", "ההליך
   תקוע" ו"נקודת מבט רעננה" אינם אף אחד מהם.
   בין הפועל ליישוב עד שלוש מילים, ולא מילה שפותחת ב-ו משפט חדש: "גרה אצל אמה וישנה בחדרה" הוא החדר שלה.
   חדרה (החדר שלה) ומודיעין (יחידה) הם גם מקום מסוג אחר: אחרי תנועה, ישיבה, לימודים וקרבה «חדרה» אינה הקשר
   ("עברה לחדרה", "התיישבה בחדרה", "סמוך לחדרה"), ואחרי עבודה ומעבר גם «מודיעין» ("הועבר למודיעין", "עובד
   במודיעין"); אחרי בית, קנייה ומגורים שניהם היישוב. «של» אחרי השם ("לחדרה של הקטינה"), או שם ברבים ואחריו
   מילה ברבים ("אופקים חדשים", "להבים חדים"), עושים ממנו מילה בכל הקשר (הביקורת של 11.10) */
const CTX_GAP="(?:[\\s,]+(?:ו(?:ילדיה|ילדיו|ילדיהם|בעלה|אשתו|הקטינים|הקטינות|הקטינה|הקטין|הילדים|הילדה|הילד|בנה|בנו|בתה|בתו|הוריה|הוריו|אמה|אמו|אביה|אביו)|(?!ו)[^\\s.;:!?]+))";
const ctxVerb=(w,gap)=>new RegExp("(?:^|[^א-ת])[וש]?(?:כש)?(?:"+w+")"+CTX_GAP+"{0,"+gap+"}[\\s,]*$","u");
const CTX_RES=ctxVerb("גר|גרה|גרים|גרות|גרנו|גרתי|גרו|לגור|מתגורר|מתגוררת|מתגוררים|מתגוררות|התגורר|התגוררה|התגוררו|התגוררנו|התגוררתי|להתגורר|נולד|נולדה|נולדו|נולדתי|גדל|גדלה|גדלו|גדלתי|מגורים|מגוריה|מגוריו|מגוריהם|מגוריהן|מגוריי|מגורינו|מגורי",3);
const CTX_HOME=ctxVerb("ה?בית(?!\\s+(?:ה?משפט|ה?דין|ה?ספר|ה?חולים|ה?כנסת|ה?מרקחת|ה?קפה|ה?מלון|ה?אבות|ה?לחם|ה?ילדים))|ה?דירה|ה?דירת|דירתם|דירתה|דירתו|דירתנו|דירתי|ביתם|ביתה|ביתו|ביתנו|ביתי|ה?נכס|ה?מגרש|ה?וילה|רכש|רכשה|רכשו|רכשנו|לרכוש|קנה|קנתה|קנו|קנינו|לקנות|שכר|שכרה|שכרו|שכרנו|לשכור|מכר|מכרה|מכרו|מכרנו|נישאו|התחתנו",3);
const CTX_STAY=ctxVerb("נמצא|נמצאת|נמצאים|נמצאות|ממוקם|ממוקמת|ממוקמים|ממוקמות|שוכן|שוכנת|שוכנים|התיישב|התיישבה|התיישבו|לומד|לומדת|לומדים|לומדות|למד|למדה|למדו|למדתי|ללמוד|משובץ|משובצת|משובצים|נפגש|נפגשה|נפגשו|נפגשנו|ייפגשו|יתקיים|תתקיים|יתקיימו|התקיים|התקיימה|התקיימו|נערך|נערכה|נערכו|ייערך|ייערכו",3);
const CTX_WORK=ctxVerb("עובד|עובדת|עובדים|עובדות|עבד|עבדה|עבדו|עבדתי|עבדנו|לעבוד|מועסק|מועסקת|מועסקים|הועסק|הועסקה|הועסקו|שירת|שירתה|שירתו|משרת|משרתת",3);
const CTX_RELOC=ctxVerb("נסע|נסעה|נסעו|נסענו|נסעתי|לנסוע|נוסע|נוסעת|נוסעים|נוסעות|עקר|עקרה|עקרו|עקרנו|לעקור|העתיק|העתיקה|העתיקו",2);
const CTX_GO=ctxVerb("עבר|עברה|עברו|עברנו|עברתי|לעבור|עובר|עוברת|עוברים|עוברות|הגיע|הגיעה|הגיעו|הגענו|הגעתי|להגיע|מגיע|מגיעה|מגיעים|מגיעות|חזר|חזרה|חזרו|חזרנו|חזרתי|לחזור|חוזר|חוזרת|חוזרים|חוזרות|יצא|יצאה|יצאו|יצאנו|יצאתי|לצאת|ברח|ברחה|ברחו",2);
const CTX_LEFT=/(?:^|[^א-ת])[וש]?(?:עזב|עזבה|עזבו|עזבנו|עזבתי|לעזוב|עוזב|עוזבת|עוזבים|עוזבות)\s+את\s*$/u;
const CTX_NOUN=/(?:^|[^א-ת])[והשבלמכ]{0,3}(?:עיריית|יישוב|היישוב|הישוב|מושב|המושב|קיבוץ|הקיבוץ|עיירה|העיירה|תושב|תושבת|תושבי|תושבים|תושבות|יליד|ילידת|ילידי|ילידות|מועצת|מועצה\s+(?:ה)?(?:מקומית|אזורית)|המועצה\s+ה(?:מקומית|אזורית)|משטרת|(?:[בלמ]|מה)ה?עיר)\s*$/u;
// «הליך היישוב», «ניסיון היישוב»: יישוב הסכסוך, לא יישוב
const CTX_SETTLE=/(?:^|[^א-ת])(?:הליך|הליכי|ניסיון|ניסיונות|תהליך|הסדר|מאמץ|מאמצי|שיחות|הצעת|הצעות|דרכי|אפשרות|סיכויי)\s+ה?יי?שוב\s*$/u;
const CTX_CITY=/(?:^|[^א-ת])ו?ה?עיר\s*$/u;
/* כתובת: מילת רחוב, שם ומספר בית; או מילה ומספר קטן ופסיק ("הנרקיס 9, רעננה"), לא "סעיף 9," או "בסעיף 4,"
   ולא שנה; או תווית. בלי פסיק — "הנרקיס 9 רעננה" — רק כשהשם סוגר את המשפט או את השורה (CTX_ADDR_END) */
const ADDR_NOT="(?![בהולמכש]{0,2}(?:סעיף|סעיפים|סע'|ס'|תקנה|תקנות|פרק|פרקים|פסקה|פסקאות|עמוד|עמודים|עמ'|קומה|שורה|שורות|שלב|כיתה|בת|בן|גיל|מס'|מספר|נספח|נספחים|שנת|יום|ימים|שעה|גוש|חלקה|תיק|חדר)\\s)";
const CTX_ADDR=new RegExp("(?:(?:^|[^א-ת])[בהולמכש]{0,2}(?:רחוב|רח'|רח\\.?|שדרות|שד'|סמטת|דרך|שכונת|ככר|כיכר)\\s+[^\\n.;:!?]{1,30}?\\s\\d{1,4}[א-ת]?(?:\\s*[/\\\\]\\s*\\d{1,3}[א-ת]?)?\\s*,?|(?:^|[^א-ת])"+ADDR_NOT+"[א-ת\"']{2,}\\s\\d{1,3}[א-ת]?(?:\\s*[/\\\\]\\s*\\d{1,3}[א-ת]?)?\\s*,|(?:^|[^א-ת])(?:עיר|יישוב|ישוב|כתובת|מען|מקום\\s+(?:ה)?(?:מגורים|לידה))\\s*:)\\s*$","u");
const CTX_ADDR_END=new RegExp("(?:^|[^א-ת])"+ADDR_NOT+"[א-ת\"']{2,}\\s\\d{1,3}[א-ת]?(?:\\s*[/\\\\]\\s*\\d{1,3}[א-ת]?)?\\s+$","u");
const COURTS="(?:בית\\s+ה?משפט|ביהמ\"ש|בימ\"ש|בית\\s+ה?דין|ביה\"ד|בי\"ד|ה?הוצאה\\s+לפועל|הוצל\"פ|לשכת\\s+ה?רווחה|המחלקה\\s+לשירותים\\s+חברתיים|מחלקת\\s+ה?רווחה|תחנת\\s+ה?משטרה|סניף)";
const COURT_OF="(?:\\s+(?:ה?שלום|ה?מחוזי|ה?רבני|ה?אזורי|ה?שרעי|ה?מנהלי|ה?עליון|לנוער|לעבודה|לענייני\\s+משפחה|לעניני\\s+משפחה|לתביעות\\s+קטנות|לתעבורה))*";
const CTX_COURT=new RegExp("(?:"+COURTS+"|בית\\s+ה?ספר|ביה\"ס|בי\"ס|בית\\s+ה?חולים|ביה\"ח|קופת\\s+חולים(?:\\s+[א-ת]+)?|מרפאת)"+COURT_OF+"(?:\\s+[\"'][^\"'\\n]{1,30}[\"'])?\\s*$","u");
// בית המשפט ושמו צמודים, בלי ב- ("בית משפט השלום חדרה"), ושורת התיק ("תמ"ש 1234-05-24 (משפחה חדרה)")
const CTX_BENCH=new RegExp(COURTS+COURT_OF+"\\s*$","u");
const CTX_CITE=/\((?:שלום|משפחה|מחוזי|עבודה|נוער|תעבורה|עליון)\s*$/u;
const CTX_AREA=/(?:^|[^א-ת])ו?(?:באזור|בסביבת|בסביבות|בצפון|בדרום|במזרח|במערב|בפאתי|במבואות)\s*$/u;
const CTX_CLOSE=/(?:^|[^א-ת])ו?בקרבת\s*$/u;
const CTX_DIR=/(?:^|[^א-ת])ו?(?:מצפון|מדרום|ממזרח|ממערב|צפונית|דרומית|מזרחית|מערבית)\s*$/u;
const CTX_NEAR=/(?:^|[^א-ת])ו?(?:בסמוך|סמוך)\s*$/u;
const CTX_GATE=/(?:^|[^א-ת])ו?ה?(?:בכניסה|ביציאה|כניסה|יציאה|הכניסה|היציאה)\s*$/u;
// שמות שהם גם מקום מסוג אחר, ושמות שהם פועל או תואר שבא אחרי שם עצם ("בבית המשפט המחוזי ערערה המבקשת")
const ROOM=new Set(["חדרה"]), UNIT=new Set(["חדרה","מודיעין"]), PREDICATE=new Set(["ערערה","תקוע"]);
// «מאופקים» (מתאפקים) יכול לעמוד לבד בין פסיקים, ולכן אינו כותרת של צד
const APPO_NOT=new Set(["אופקים"]);
function placeCtx(n,x,all){
  const nm=x.name, kind=TOWNWORD.get(nm), person=kind==="name"||kind==="both";
  // חיפוש לאחור עד 90 תווים, ובתוכם עד תחילת השורה: lastIndexOf על כל השורה היה ריבועי בשורה ארוכה
  const w90=n.slice(Math.max(0,x.i-90),x.i), before=w90.slice(w90.lastIndexOf("\n")+1);
  const after=n.slice(x.e,x.e+60).split("\n")[0];
  const loc=/[בלמ]$/.test(x.pre)?x.pre.slice(-1):"";
  // "חדרה של הקטינה", "אופקים חדשים": שם עצם, לא יישוב
  if(/^\s+של(?![א-ת])/.test(after))return false;
  if(kind==="word"&&/(?:ים|ות)$/.test(nm)&&/^\s+ה?[א-ת]{2,}(?:ים|ות)(?![א-ת])/.test(after))return false;
  if(loc==="ב"&&(CTX_RES.test(before)||CTX_COURT.test(before)||CTX_HOME.test(before)))return true;
  if(loc==="ב"&&!ROOM.has(nm)&&CTX_STAY.test(before))return true;
  if(loc==="ב"&&!UNIT.has(nm)&&CTX_WORK.test(before))return true;
  if((loc==="ל"||loc==="מ")&&!person&&(CTX_RELOC.test(before)||(!ROOM.has(nm)&&CTX_GO.test(before))))return true;
  if(!x.pre&&!person&&!UNIT.has(nm)&&CTX_LEFT.test(before))return true;
  if(!x.pre&&CTX_NOUN.test(before)&&!CTX_SETTLE.test(before))return true;
  if(!x.pre&&((!person&&CTX_CITY.test(before))||CTX_AREA.test(before)||(!person&&CTX_CLOSE.test(before))))return true;
  if(!x.pre&&!person&&!PREDICATE.has(nm)&&CTX_BENCH.test(before))return true;
  if(!x.pre&&CTX_CITE.test(before)&&/^\s*\)/.test(after))return true;
  if(loc==="ל"&&(CTX_DIR.test(before)||(!person&&!ROOM.has(nm)&&CTX_NEAR.test(before))))return true;
  if((loc==="ל"||loc==="מ")&&!ROOM.has(nm)&&CTX_GATE.test(before))return true;
  // כותרת של צד: "המבקשת, מאילת, הגישה", "…, ת"ז 012345678, מרעננה"
  if(loc==="מ"&&/,\s*$/.test(before)&&/^[ \t]*(?:,|$)/.test(after)&&!APPO_NOT.has(nm))return true;
  if((!x.pre||loc==="ב")&&CTX_ADDR.test(before))return true;
  if(!x.pre&&CTX_ADDR_END.test(before)&&/^[ \t]*(?:[,.;]|$|\d{5,7}(?!\d))/.test(after))return true;
  // מיקוד אחריו, ולא מספר תיק או סכום ("שילמה אילת 12345 ש"ח")
  if(/^\s*,?\s*\d{5,7}(?![\d/-])(?!\s*(?:ש"ח|שקל|שקלים|₪|דולר|אירו|יורו|%))/.test(after))return true;
  // יישוב אחר צמוד, ברשימה או בטווח: רווח ואות שימוש מחברת, או מקף ולוכסן. שם פרטי צריך אות של מקום (ב, ל,
  // מ): "בחיפה ואלעד נשאר בבית" הוא אלעד
  const k=x.k, solid=y=>!!y&&!AMBIG.has(y.name)&&!TOWNWORD.has(y.name);
  const join=person?/[לבמ]/:/[לבו]/;
  const joined=(gap,pre)=>/^[ \t]*[\/-][ \t]*$/.test(gap)||(/^[ \t]+$/.test(gap)&&join.test(pre));
  const p=all[k-1], q=all[k+1];
  if(solid(p)&&joined(n.slice(p.e,x.i),x.pre))return true;
  if(solid(q)&&joined(n.slice(x.e,q.i),person?x.pre:q.pre))return true;
  return false;
}
/* צירוף שגור שנכתב כמו יישוב (הביקורת של 11.10, עדשה 8): «פותח פתח תקווה לשיקום הקשר», «יש בהחלטה פתח תקווה»,
   «זיכרון יעקב מהאירוע מעורפל», «הבית היה נווה שלום לילדים». הכתיבים החדשים (תקוה, זיכרון, נוה) הוסיפו את
   הצירופים האלה לכתיב החסר, והכתיב המלא נתפס גם קודם. בלי אות של מקום (ב, ל, מ) ובמסגרת של הצירוף — פועל של
   פתיחה או נתינה לפני «פתח תקווה», היה או שימש לפני «נווה שלום», "מה-", "מן" או "על" אחרי «זכרון יעקב» — השם
   הוא הצירוף ונשאל; בכל מקום אחר הוא היישוב */
const IDIOM={
  "פתח תקווה":b=>/(?:^|[^א-ת])ו?(?:פותח|פותחת|פותחים|פותחות|פתח|פתחה|פתחו|פתחנו|לפתוח|נפתח|נפתחה|נפתחו|ייפתח|תיפתח|פתיחת|יש|אין|מהווה|מהוות|היווה|היוותה|נותן|נותנת|נותנים|נתן|נתנה|נתנו|לתת|מעניק|מעניקה|העניק|העניקה)(?:\s+[^\s.;:!?]+){0,2}\s+$/u.test(b),
  "נווה שלום":(b,a,pre)=>pre==="כ"||/(?:^|[^א-ת])ו?(?:היה|היתה|הייתה|היו|יהיה|תהיה|יהיו|להיות|מהווה|מהוות|היווה|היוותה|שימש|שימשה|שימשו|משמש|משמשת)(?:\s+[^\s.;:!?]+)?\s+$/u.test(b),
  "זכרון יעקב":(b,a)=>/^\s+(?:מה(?!ווה|וות)[א-ת]{2,}|מן|על)(?![א-ת])/u.test(a),
};
/* ההכרעה של השכבה על מופע אחד: היישוב מוחלף מעצמו. findPlaces מחליף לפיה, מסך היישובים מציע לפיה, והאימות
   (08-docx.js) מחפש לפיה את מה שנשאר: שם קצר ושם דו-משמעי נשאלים תמיד, מילה רק בלי הקשר של מקום, צירוף רק
   במסגרת שלו */
function placeSure(n,x,all){
  const nm=x.name;
  if(nm.length<=3||AMBIG.has(nm))return false;
  if(TOWNWORD.has(nm))return placeCtx(n,x,all);
  const id=IDIOM[nm];
  if(id&&!/[בלמ]/.test(x.pre)){
    const w=n.slice(Math.max(0,x.i-90),x.i), b=w.slice(w.lastIndexOf("\n")+1), a=n.slice(x.e,x.e+60).split("\n")[0];
    if(id(b,a,x.pre))return false;
  }
  return true;
}
// יישוב שמוחלף רק במופע שהטקסט מראה שהוא מקום: מילה (TOWNWORD) או צירוף שגור (IDIOM)
const placeCond=nm=>TOWNWORD.has(nm)||!!IDIOM[nm];
// השכבה מחליפה את היישוב מעצמה, בלי לשאול: לא שם קצר, לא דו-משמעי ולא מ-TOWNWORD (ראו risky למטה). חלק של
// שם מהרשימה שהוא יישוב כזה נשאר לה; יישוב שהיא רק שואלת עליו עובר למעבר של חלקי השם (08-docx.js, regPart)
const placeOwn=nm=>!!PLACE_BY[nm]&&!(nm.length<=3||AMBIG.has(nm)||TOWNWORD.has(nm));
function findPlaces(text){
  const n=norm(text),out=[],seen=new Set();
  const docTokP=new Set(n.match(WRX)||[]);
  const all=placeScan(n);
  for(const x of all){
    const nm=x.name, k=x.s+":"+x.e; seen.add(k);
    // שם קצר, שם דו-משמעי, ושם שהוא גם מילה בלי הקשר של מקום: לבדיקה, לא להחלפה
    const risky=!placeSure(n,x,all);
    out.push({s:x.s,e:x.e,type:"PLACE_CITY",label:"יישוב",text:text.slice(x.s,x.e),
      why:(x.mappable?"שם יישוב מוכר":"שם יישוב מהמאגר")+(risky?" — אבל המילה דו-משמעית, אשרו ידנית":""),
      apply:!risky,src:"pattern",prio:2,conf:risky?"medium":"high",
      // הבסיס הוא השם שברשימה: «קריית ביאליק» ו«קרית ביאליק» מקבלים אותו תחליף
      review:risky,place:nm,base:nm});
  }
  for(const v of VENUE){
    v.rx.lastIndex=0; let g;
    while((g=v.rx.exec(n))){
      let c=cleanName(g[1]); if(!c)continue;
      c=trimPlace(c); if(!c)continue;
      // "בית הספר לרבות בימי": מה שאחרי מילת המקום, אחרי קיצוץ הזנב, חייב להיראות כשם
      if(!anchorOK(c))continue;
      // "בית הספר שהינו ממלכתי", "בצד הצפוני", "רמה מקצועית": תואר אחרי מילת מוסד אינו
      // שמו. סיומת תואר במילה בודדת, או מילה שהטקסט עצמו משתמש בה עם ה' הידיעה, נפסלת.
      {const cw=c.split(/\s+/);
       if(cw.length===1&&/(?:ית|י)$/.test(norm(c)))continue;
       if(cw.some(x=>docTokP.has("ה"+norm(x))))continue;}
      const raw=g[1];
      let s=g.index+g[0].indexOf(raw); const o=raw.indexOf(c); if(o>0)s+=o;
      const e=s+c.length, k=s+":"+e; if(seen.has(k))continue; seen.add(k);
      // "לשכת הרווחה": מילת המקום עם השם הם גוף ציבורי, ואין מה לסמן לבדיקה
      if(PUBLIC_ORG.test(norm(g[0]))||PUBLIC_ORG.test(norm(g[0]).replace(/^[בהולמכש]/,"")))continue;
      out.push({s,e,type:"PLACE_VENUE",label:v.l,text:text.slice(s,e),
        why:"מופיע אחרי מילה שמציינת מקום",apply:false,src:"pattern",
        prio:2,conf:"medium",review:true,kind:placeKind(n,s)});
    }
  }
  return out;
}

/* היישובים שמסך היישובים רשאי להציע להחלפה ששומרת על מרחקים.

   המסך הזה אינו מסמן לבדיקה: מה שמאושר בו נכתב ככלל החלפה גורף על כל מופע
   במסמך, כולל צורות עם אות שימוש. לכן יישוב ששמו גם מילה עברית רגילה אינו
   מוצע כאן. אחרת עלול להיות מוצע להחליף את «אזור», ו«באזור התעשייה» היה הופך
   ל«בעילבון התעשייה».

   אותה רשימת AMBIG שכבר משמשת את findPlaces, כדי שלא יהיו שתי דעות בשני
   מקומות. מה שנופל כאן אינו אובד: findPlaces מעלה אותו במסך הבדיקה, מסומן
   לבדיקה ועם ההקשר לצדו, ושם אפשר להחליט עליו לפי מה שכתוב במסמך.

   אורך השם אינו קריטריון כאן, בניגוד ל-findPlaces: «צפת» ו«עכו» חד-משמעיים,
   ומי שמאשרת אותם במסך הזה יודעת על מה היא מסתכלת.

   ומאותה סיבה יישוב מ-TOWNWORD שמופיע ולו פעם אחת בלי הקשר של מקום אינו מוצע כאן: הכלל הגורף היה מחליף
   גם את «נקודת מבט רעננה» שבמסמך שבו גם «גרה ברעננה» (הציד של 11.10). */
function townWords(n,all){
  const out=new Set();
  for(const x of all) if(placeCond(x.name)&&!placeSure(n,x,all)) out.add(x.name);
  return out;
}
// מסך היישובים קורא את מה ש-detect קורא: בלי תווים בלתי נראים (squeeze). אחרת סימן כיוון בין «גרה ב» ל«רעננה»
// הפריד כאן בין ה-ב לשם: הזיהוי החליף את היישוב, והמסך הציע אותו כמילה
const seenText=t=>{const s=String(t||""), q=squeeze(s); return q?q.t:s};
function geoNames(text){
  const n=norm(seenText(text)), out=[], seen=new Set(), all=placeScan(n), word=townWords(n,all);
  for(const x of all){
    const nm=x.name;
    if(!x.mappable||seen.has(nm)||AMBIG.has(nm)||word.has(nm))continue;
    seen.add(nm); out.push(nm);
  }
  return out;
}

/* כל היישובים שנמצאו במסמך, ולא רק אלה שאפשר למפות תוך שמירת מרחקים.

   geoNames מחזיר בכוונה רק את מה שנכנס למפת המרחקים: יישוב מתוך 200 הערים עם
   קואורדינטות, שאינו דו-משמעי. זה נכון למפה, והיה שגוי למסך: על מסמך שהיישובים
   בו הם מהמאגר הגדול, או ששמם גם מילה רגילה, המסך הראה "לא נמצאו יישובים"
   בזמן שהזיהוי דווקא מצא אותם. היא ראתה מקומות בכלי, ומסך מקומות ריק.

   כאן מוחזר הכול, עם שתי תכונות שהמסך צריך כדי להחליט מה להציע: האם היישוב
   ניתן למיפוי (יש לו קואורדינטות), והאם שמו גם מילה עברית רגילה — כולל יישוב
   מ-TOWNWORD שמופיע בלי הקשר של מקום. הסריקה היא של findPlaces (placeScan), ולכן
   השם הוא השם שברשימה בכל כתיב, ושם ארוך אינו מוצע גם כחלק שלו. */
function placesFound(text){
  const n=norm(seenText(text)), out=[], seen=new Set(), all=placeScan(n), word=townWords(n,all);
  for(const x of all){
    const nm=x.name; if(seen.has(nm))continue;
    seen.add(nm); out.push({name:nm, mappable:x.mappable, ambiguous:AMBIG.has(nm)||word.has(nm)});
  }
  return out;
}

/* ── מיפוי יישובים תוך שמירה על מרחקים ── */
const R2=Math.PI/180;
function hav(a1,o1,a2,o2){
  const dA=(a2-a1)*R2, dO=(o2-o1)*R2;
  const x=Math.sin(dA/2)**2+Math.cos(a1*R2)*Math.cos(a2*R2)*Math.sin(dO/2)**2;
  return 6371*2*Math.asin(Math.sqrt(x));
}
/* H4 בביקורת השנייה: המפה חסמה כיעד רק את היישובים שנכנסו אליה. "רחובות" שנמצאה
   במסמך אבל נשארה בחוץ (שם דו-משמעי, שורה נפרדת) הוצעה כשם הבדוי של נתניה, ואז
   שני יישובים אמיתיים הפכו לאחד, וההחלפה של רחובות עצמה נשרשרה. avoid הוא כל
   מה שנמצא במסמך; forbidden — מילות המסמך, כמו ב-fakePlace: יישוב שאחת ממילותיו
   כבר בטקסט (גם עם אות שימוש) אינו יעד. */
function geoMap(names,variant,avoid,forbidden,prev){
  const orig=names.map(n=>PLACE_BY[n]).filter(Boolean);
  if(orig.length<2)return null;
  const cA=orig.reduce((s,p)=>s+p.a,0)/orig.length;
  const cO=orig.reduce((s,p)=>s+p.o,0)/orig.length;
  const cosC=Math.cos(cA*R2);
  const offs=orig.map(p=>({x:(p.o-cO)*cosC,y:p.a-cA}));
  const block=new Set(names);
  for(const n of avoid||[]) block.add(n);
  // תחליף אינו מילה, שם דו-משמעי או צירוף (placeSubOK): «ערערה» או «קדימה» בתשובת ה-AI חזרו ליישוב האמיתי
  for(const p of PLACES) if(!placeSubOK(p.n)) block.add(p.n);
  if(forbidden&&forbidden.size) for(const p of PLACES){
    if(block.has(p.n))continue;
    for(const w of norm(p.n).split(/\s+/)){
      if(!w)continue;
      let hit=forbidden.has(w);
      if(!hit) for(const pre of "בלמוהשכ") if(forbidden.has(pre+w)){hit=true;break}
      if(hit){block.add(p.n);break}
    }
  }
  const res=[];
  for(const anc of PLACES){
    for(let ang=0;ang<360;ang+=30){
      for(const mir of [1,-1]){
        const r=ang*R2, cs=Math.cos(r), sn=Math.sin(r);
        const used=new Set(block), pick=[]; let bad=false, pen=0;
        for(const off of offs){
          const x=off.x*mir, y=off.y;
          const rx=x*cs-y*sn, ry=x*sn+y*cs;
          const tA=anc.a+ry, tO=anc.o+rx/Math.cos(anc.a*R2);
          // מאפיינים לפני מרחק (Q11 בגרסה 2): הציון הוא מרחק ועוד מחיר אי-ההתאמה,
          // כך שעיר חרדית רחוקה יותר עדיפה על קיבוץ קרוב. אוכלוסייה שונה
          // פסולה בכל מרחק. הסף רחב מ-20 ק"מ של פעם, כי התאמה מלאה נדירה.
          let best=null,bs=1e9,bp=0;
          const from=orig[pick.length].n;
          for(const p of PLACES){
            if(used.has(p.n))continue;
            const pen=(typeof atlasPenalty==="function")?atlasPenalty(from,p.n):0;
            if(pen===Infinity)continue;
            // המרחק צפון-דרום לבדו אינו גדול מהמרחק האמיתי: יישוב שגם הוא לא יעבור את הטוב ביותר עד
            // כאן אינו נמדד. אותה תוצאה, בלי רוב חישובי המרחק (המעבר לצעד 3 בסיור, 8.10)
            if(pen+Math.abs(p.a-tA)*111.19>=bs)continue;
            const d=hav(p.a,p.o,tA,tO), sc=d+pen;
            if(sc<bs){bs=sc;best=p;bp=pen}
          }
          if(!best||bs>110){bad=true;break}
          used.add(best.n); pick.push(best); pen+=bp;
        }
        if(bad)continue;
        let err=0,c=0;
        for(let i=0;i<orig.length;i++)for(let j=i+1;j<orig.length;j++){
          const d0=hav(orig[i].a,orig[i].o,orig[j].a,orig[j].o);
          const d1=hav(pick[i].a,pick[i].o,pick[j].a,pick[j].o);
          err+=Math.abs(d0-d1); c++;
        }
        // הדירוג: שגיאת המרחקים ועוד מחיר אי-ההתאמה הממוצע, שוב ביחידות ק"מ
        res.push({map:orig.map((o,i)=>({from:o.n,to:pick[i].n})),
                  err:c?err/c:0, pen:orig.length?pen/orig.length:0, anchor:anc.n});
      }
    }
  }
  if(!res.length)return null;
  res.sort((a,b)=>(a.err+a.pen)-(b.err+b.pen));
  const uniq=[],seen=new Set();
  for(const r of res){
    const k=r.map.map(x=>x.to).join("|");
    if(seen.has(k))continue; seen.add(k); uniq.push(r);
    if(uniq.length>40)break;
  }
  const v0=(variant||0)%uniq.length;
  if(!prev)return uniq[v0];
  /* "קבוצה אחרת" (prev: התחליף הנוכחי של כל יישוב שהיא לא הקלידה): מכאן והלאה בדירוג, הקבוצה הראשונה שמחליפה את כולם,
     ואם אין כזו, זו שמחליפה הכי הרבה. הקבוצות הקרובות בדירוג נבדלות לפעמים רק ביישוב אחד: מאז שתחליף אינו מילה
     (v73.8), לנתניה נשארה אשדוד בשש הקבוצות הראשונות, והכפתור לא החליף אותה. variant: מקומה בדירוג, להמשך */
  const want=Object.keys(prev).length;
  let best=null,bc=-1;
  for(let k=0;k<uniq.length;k++){
    const i=(v0+k)%uniq.length, c=uniq[i].map.filter(m=>prev[m.from]!==undefined&&prev[m.from]!==m.to).length;
    if(c>bc){bc=c;best={...uniq[i],variant:i}}
    if(c>=want)break;
  }
  return best;
}

/* ══════════════════════════ מנוע ══════════════════════════ */
// more: שמות שתווית בפסקה או בתא שלידו מעידה עליהם (labelNext), כבר במיקומים של הטקסט הזה
function findPatterns(text,on,flag,more){
  const n=norm(text),hits=[];
  if(on.has("NAME_ANCHORED")||flag.has("NAME_ANCHORED"))
    // העוגן הפרוזאי (rolep) מזין רק את ההצעות ב-discover, לא את ההשחרה: ניחוש
    // שגוי שם עולה הקשה אחת; כאן הוא היה דוחק החלפה אמיתית מאותם תווים.
    for(const h of anchored(text).concat(more||[])){if(h.anchor==="rolep")continue;h.apply=on.has("NAME_ANCHORED");hits.push(h)}
  if(on.has("PLACES")||flag.has("PLACES"))
    for(const h of findPlaces(text)){
      if(!on.has("PLACES"))h.apply=false;
      if(h.type==="PLACE_VENUE")h.apply=false;   // שם מוסד תמיד לאישור
      hits.push(h)}
  for(const p of PAT){
    if(!on.has(p.n)&&!flag.has(p.n))continue;
    p.rx.lastIndex=0;let m;
    while((m=p.rx.exec(n))){
      if(m[0]==="")({},p.rx.lastIndex++);
      // ספרת ביקורת שאינה מתאימה אינה ראיה שזה איננו מזהה — היא ראיה שהוא הוקלד
      // לא נכון, או שהוא לא ישראלי. עד כאן מספר כזה נעלם לגמרי: לא הוחלף, לא סומן,
      // לא הופיע ברשימה, ולכן הגיע ל-AI כמו שהוא בלי שום סימן. תשע ספרות שנראות
      // כמו ת"ז הן החשד הכי מובהק שיש, ולכן הן עולות לבדיקה במקום להימחק.
      const bad=!!(p.v&&!p.v(m[0],n,m.index));
      if(bad&&p.strict)continue;
      const g=p.g, s=g? m.index+m[0].indexOf(m[g]) : m.index, e=s+(g?m[g].length:m[0].length);
      if(g&&!m[g])continue; if(e<=s)continue;
      hits.push({s,e,type:p.n,label:p.l,text:text.slice(s,e),apply:bad?false:on.has(p.n),
        why:(WHYP[p.n]||"התאמה לדפוס מוכר")+(bad?" — אבל ספרת הביקורת אינה מתאימה. ייתכן שיבוש הקלדה, ולכן זה עולה לבדיקה":""),
        src:"pattern",prio:p.p,review:bad||undefined,
        conf:bad?"medium":(p.on?"high":"medium")});
    }}
  /* כתובת רחוב שנמחקה השאירה אחריה "מ," (מ"מרחוב") ואת המיקוד שאחרי העיר
     (v35). אות שימוש שדבוקה לכתובת שייכת למשפט, לא לכתובת: במחיקה היא
     הולכת איתה, בתווית היא נשארת לפניה. מספר של 5–7 ספרות בהמשך אותה שורה, אחרי
     הכתובת ולכל היותר שלוש מילים (העיר), הוא מיקוד ונמחק איתה. */
  for(const h of hits.slice()){
    if(h.type!=="ADDRESS_STREET")continue;
    if(h.s>0&&/[במלה]/.test(n[h.s-1])&&(h.s<2||!/[֐-׿]/.test(n[h.s-2]))){
      h.base=h.text; h.pre=n[h.s-1]; h.s--; h.text=text.slice(h.s,h.e);
    }
    const tail=n.slice(h.e,h.e+60);
    const z=/^[,\s]*(?:[א-ת][א-ת"'-]*\s+){0,3}(\d{5,7})(?![\d-])/.exec(tail);
    if(z){
      const zs=h.e+z.index+z[0].lastIndexOf(z[1]), ze=zs+z[1].length;
      if(!hits.some(x=>x.s<ze&&zs<x.e))
        hits.push({s:zs,e:ze,type:"ZIPCODE",label:"מיקוד",text:text.slice(zs,ze),apply:h.apply,
          why:"מספר מיקוד בהמשך הכתובת",src:"pattern",prio:3,conf:"high"});
    }
  }
  return hits}

const KINDS=[["NAME","שם"],["ORG","גוף"],["ID",'ת"ז'],["PHONE","טלפון"],["ADDRESS","כתובת"],["PLACE","מקום"],["OTHER","אחר"]];
const KINDLBL=Object.fromEntries(KINDS);
const CANON={PLACE_CITY:["PLACE","יישוב"],PLACE_VENUE:["PLACE","מקום"],PLACE:["PLACE","מקום"],OTHER:["OTHER","פרט"],ORG:["ORG","גוף"],ID:["ID",'ת"ז'],ISRAELI_ID:["ID",'ת"ז'],ISRAELI_ID_LABELED:["ID",'ת"ז'],
 PHONE:["PHONE","טלפון"],PHONE_MOBILE:["PHONE","טלפון"],PHONE_LAND:["PHONE","טלפון"],
 PHONE_TOLL:["PHONE","טלפון"],FAX:["PHONE","פקס"],EMAIL:["EMAIL",'דוא"ל'],
 ADDRESS:["ADDRESS","כתובת"],ADDRESS_STREET:["ADDRESS","כתובת"],
 NAME:["NAME","שם"],NAME_ANCHORED:["NAME","שם"]};
function ckey(t,x){const f=(CANON[t]||[t])[0],v=norm(x).trim();
  if(f==="ID")return "ID|"+v.replace(/\D/g,"");
  if(f==="PHONE")return "PHONE|"+v.replace(/\D/g,"").slice(-9);
  if(f==="EMAIL")return "EMAIL|"+v.toLowerCase();
  return f+"|"+v}

function resolve(hits){
  const rk={list:0,pattern:1};
  hits.sort((a,b)=>a.s-b.s||rk[a.src]-rk[b.src]||(a.prio??5)-(b.prio??5)||(b.e-b.s)-(a.e-a.s));
  const out=[];let last=-1;
  for(const h of hits){ if(h.s>=last){out.push(h);last=h.e} }
  return out}

// אזורי גיל: מספר קטן אחרי בן/בת/גיל או לפני שנה/שנים. בתוך אזור כזה שום דפוס
// מספרי אינו נתפס, גם כשמספרים מושמטים כברירת מחדל. הבטחה שניתנה בכתב ללקוחה.
function ageZones(n){
  const z=[]; let m;
  const a=/(?<![א-ת])(?:בן|בת|בני|בנות|גיל|בגיל|כבן|כבת)\s+(\d{1,3})(?![\d])/gu;
  while((m=a.exec(n))){const s=m.index+m[0].lastIndexOf(m[1]);z.push([s,s+m[1].length])}
  const b=/(?<![\d])(\d{1,3})\s+(?:שנה|שנים|שנתיים|וחצי)(?![א-ת])/gu;
  while((m=b.exec(n)))z.push([m.index,m.index+m[1].length]);
  return z}
/* כתובת מקודדת (הציד של 11.10): "%D7%93%D7%A0%D7%94" הוא "דנה" לכל דפדפן, ולכלים כאן הוא היה תווים
   לטיניים. שם מהרשימה בתוך כתובת כזאת לא נמצא, דווח "לא מופיע במסמך", ויצא עם הקובץ. פענוח עד שלוש
   פעמים (כתובת שקודדה פעמיים), עם מפה מכל תו בפענוח אל הטווח שלו במקור, כדי שההחלפה תיכתב במקומו. */
function pctDecode(s){
  let d="";const map=[];
  for(let i=0;i<s.length;){
    if(s[i]!=="%"||!/^%[0-9A-Fa-f]{2}/.test(s.slice(i,i+3))){d+=s[i];map.push([i,i+1]);i++;continue}
    const bytes=[];let j=i;
    while(/^%[0-9A-Fa-f]{2}/.test(s.slice(j,j+3))){bytes.push(parseInt(s.slice(j+1,j+3),16));j+=3}
    for(let k=0;k<bytes.length;){
      const b0=bytes[k], n=b0<0x80?1:(b0>>5)===6?2:(b0>>4)===14?3:(b0>>3)===30?4:0;
      let cp=n===1?b0:-1;
      if(n>1&&k+n<=bytes.length){cp=b0&(0xff>>(n+1));
        for(let q=1;q<n;q++){const c=bytes[k+q];if((c&0xC0)!==0x80){cp=-1;break}cp=(cp<<6)|(c&0x3F)}
        if(cp<[0,0,0x80,0x800,0x10000][n]||cp>0x10FFFF||(cp>=0xD800&&cp<=0xDFFF))cp=-1}
      const a=i+k*3;
      // רצף שאינו UTF-8 תקין נשאר כמו שהוא
      if(cp<0){for(let q=0;q<3;q++){d+=s[a+q];map.push([a+q,a+q+1])}k++;continue}
      const ch=String.fromCodePoint(cp);
      for(let q=0;q<ch.length;q++){d+=ch[q];map.push([a,a+n*3])}
      k+=n}
    i=j}
  return {d,map}}
function pctDecodeAll(s){
  let cur={d:s,map:Array.from({length:s.length},(_,i)=>[i,i+1])};
  for(let r=0;r<3&&/%[0-9A-Fa-f]{2}/.test(cur.d);r++){
    const nx=pctDecode(cur.d); if(nx.d===cur.d)break;
    nx.map=nx.map.map(([a,b])=>[cur.map[a][0],cur.map[b-1][1]]); cur=nx}
  return cur}
// אותו פענוח בלי מפה, לטקסט ארוך (הבדיקה האחרונה קוראת כך חלק שלם)
function pctPlain(s){
  for(let r=0;r<3&&/%[0-9A-Fa-f]{2}/.test(s);r++){
    const n=s.replace(/(?:%[0-9A-Fa-f]{2})+/g,m=>{try{return decodeURIComponent(m)}catch(_){return pctDecode(m).d}});
    if(n===s)break; s=n}
  return s}
// הכללים שרצים על כתובת: מספרים מזהים, דוא"ל, כתובת רחוב וקישור אישי. לא תאריך, לא מספר רכב ולא מספר תיק,
// שכתובת ציבורית מלאה בהם ("/2024-03-12/", "18-2023"), ולא יישוב ("he.wikipedia.org/wiki/חיפה")
const ADDR_PAT=new Set(["EMAIL","PHONE_MOBILE","PHONE_LAND","ISRAELI_ID","ISRAELI_ID_SEP","ISRAELI_ID_LABELED","IBAN",
  "URL_PERSONAL","URL_PRIVATE","ADDRESS_STREET","ADDRESS_LABELED","PASSPORT","SSN","BANK_ACCOUNT","BANK_ACCOUNT_SHORT","LAWYER_LIC"]);
/* היסט התאריכים של מסמך (הציד של 11.10). תאריך שזז בדיוק אל תאריך אחר שבמסמך ("1.2.2026" אל "1.10.2026", כשגם
   הוא שם) יוצא כערך אמיתי, וכך גם תאריך מלא שמכיל חודש ושנה של המסמך ("12 במרץ 2026" מכיל את "מרץ 2026"). חודש
   ושנה זזים בחודשים שלמים, ולכן ברשימה של חודשים כמעט כל הזזה נוחתת על חודש אחר שלה.
   ההיסט נשאר בטווח שהבעלים בחר, 30 עד 400 יום (ביקורת 11.10): עד כאן הוא עלה עד שלא נשארה התנגשות, שמונה שנים
   לרשימה של 96 חודשים, וכל גיל ומועד שה-AI מחשב יצא שגוי בשנים; והחיפוש בנה מחרוזות לכל היסט, 15 שניות על 1,000
   תאריכים. בתוך הטווח נבחר הראשון, מההיסט של המסמך והלאה, שאין בו התנגשות, ואם אין כזה, זה עם הכי מעט. מה שנשאר
   אינו דליפה: הבדיקה האחרונה סופרת כמה פעמים כל תאריך נכתב כבדוי (verify). nd: הטקסט המנורמל */
function dateOffFor(nd){
  const base=30+(typeof hash32==="function"?hash32(nd):0)%371;
  const P=nd&&PAT.find(p=>p.n==="DATE"); if(!P)return base;
  // מה שהזיהוי רואה: בלי התווים הבלתי נראים (detect/squeeze)
  const DAY=864e5, full=new Set(), dm=new Set(), my=new Set(), dms=new Map();
  P.rx.lastIndex=0;
  for(const m of nd.replace(/\u0000/g,"").matchAll(P.rx)){
    const p=parseDate(m[0]); if(!p)continue;
    if(p.d==null)my.add(p.y*12+p.m-1);
    else if(p.y==null){dm.add(p.m*32+p.d); dms.set(p.m*32+p.d,Date.UTC(dateRefYear(p),p.m-1,p.d)/DAY)}
    else full.add(Date.UTC(p.y,p.m-1,p.d)/DAY);
  }
  if(!full.size&&!dm.size&&!my.size)return base;
  const cal=new Map(), at=k=>{let v=cal.get(k); if(!v){const t=new Date(k*DAY); v=[t.getUTCDate(),t.getUTCMonth()+1,t.getUTCFullYear()]; cal.set(k,v)} return v};
  const fulls=[...full], dmv=[...dms.values()], myv=[...my];
  // כמה ערכים מוזזים הם ערך אמיתי, או מכילים אחד; עוצר כשכבר אין סיכוי לשפר את הטוב ביותר
  const clash=(off,cap)=>{
    let c=0; const k=Math.round(off/30.4375);
    for(const v of myv) if(my.has(v+k)&&++c>=cap)return c;
    for(const v of dmv){const [d,mo]=at(v+off); if(dm.has(mo*32+d)&&++c>=cap)return c}
    for(const v of fulls){const g=v+off, [d,mo,y]=at(g); if((full.has(g)||dm.has(mo*32+d)||my.has(y*12+mo-1))&&++c>=cap)return c}
    return c;
  };
  let best=base, bc=Infinity;
  for(let i=0;i<371;i++){
    const off=30+(base-30+i)%371, c=clash(off,bc);
    if(!c)return off;
    if(c<bc){bc=c;best=off}
  }
  return best;
}
/* מילה שהיא גם מילה רגילה, לא רק שם: שם פרטי שהוא מילה, מילה שכיחה, מילת עצירה או פועל — או
   מילה שהטקסט עצמו כותב עם ה' הידיעה ("הכהן"). toks: המילים של הטקסט. בדיקה אחת לצורה עם אות
   שימוש של שם קצר כאן, ולחלק של שם שעומד לבד בתשובת AI (restoreNames). */
function wordish(x,toks){
  return WORDLIKE.has(x)||COMMON.has(x)||STOP.has(x)||VRB.has(x)||(!!toks&&toks.has("ה"+x))}
class Engine{
  constructor(subs,allow,opt,docText){
    subs=subs.map(x=>({...x}));
    this.opt=opt; this.subs=subs;
    // שם בדוי שכבר מופיע במסמך האמיתי הוא מלכודת: אי אפשר יהיה להחזיר
    // אותו, והוא ייראה כאילו הוא שייך למישהו. אוספים את כל מילות המסמך
    // ואוסרים עליהן.
    this.forbidden=new Set();
    if(docText)for(const w of (norm(docText).match(WRX)||[]))this.forbidden.add(w);
    this.gmap={}; for(const s of subs) if(s.g)this.gmap[s.value]=s.g;
    // מה המסמך אומר על מילה בודדת: אחרי "הקטין", "האם", "מר", "התובעת:" היא שם
    // פרטי, והמילה שלפניה מסגירה גם מגדר. זה מכריע שם פרטי מול שם משפחה בשם
    // בדוי, ותוקן כאן אחרי שמסמך אמיתי החליף "עמרי" בשם משפחה ו"נריה" בשם אישה.
    this.firstish=new Set();
    if(docText){
      const FCTX=/(?<![\u0590-\u05ff])(הקטינה|הילדה|הבת|האחות|האם|הסבתא|הדודה|גב'|הגב'|גברת|התובעת|הנתבעת|המבקשת|המשיבה|המנוחה|הפעוטה|התינוקת|הנערה|הקטין|הילד|הבן|האח|האב|הסבא|הדוד|מר|התובע|הנתבע|המבקש|המשיב|המנוח|הפעוט|התינוק|הנער)\s*:?\s+([\u05d0-\u05ea][\u05d0-\u05ea'"\u05f3\u05f4-]{1,14})(?![\u0590-\u05ff])/gu;
      const FEMCTX=new Set(["הקטינה","הילדה","הבת","האחות","האם","הסבתא","הדודה","גב'","הגב'","גברת","התובעת","הנתבעת","המבקשת","המשיבה","המנוחה","הפעוטה","התינוקת","הנערה"]);
      const nt=norm(docText); let m;
      while((m=FCTX.exec(nt))){ const w=m[2]; if(STOP.has(w)||COMMON.has(w)||VRB.has(w))continue; this.firstish.add(w);
        // השם הפרטי של שם מלא נקבע גם הוא מההקשר: "הקטינה ליה לוי" (סבב QA 1, M2). קודם רק ערך
        // בן מילה אחת קיבל אותו, וכל ילדה ששמה לא ברשימות קיבלה כינוי של בן
        for(const s of subs) if(s.kind==="NAME"&&!this.gmap[s.value]&&norm(s.value).trim().split(/\s+/)[0]===w) this.gmap[s.value]=FEMCTX.has(m[1])?"f":"m"; }
    }
    this.used=new Set();
    // פרופיל שכופה "יעל רוזן" על מישהי, כשיעל רוזן אמיתית מופיעה במסמך
    // הזה — שתי נשים היו מתמזגות לשם אחד. עדיף לשבור עקביות פעם אחת
    // ולומר את זה, מאשר לערבב שני אנשים.
    this.collided=[];
    const nd=docText?norm(docText):"";
    // היסט התאריכים: אחד לכל המסמך, נגזר ממנו ולכן זהה בכל ריצה חוזרת, ובלי תאריך מוזז שהוא תאריך אמיתי במסמך
    this.dateOff=dateOffFor(nd);
    // כינוי שהוצמד לכלל אחרי ריצה (pinned, ראו pinReps בממשק) תקף רק כשהסגנון הוא
    // "שם"; בתווית, ███ או ריק הוא נופל, כדי שהחלפת מצב במסך הבדיקה עדיין תעבוד.
    for(const s of subs) if(s.pinned&&s.replacement&&this.styleFor({type:s.kind,style:s.style})!=="name") s.replacement="";
    // תחליף שכבר נקבע — ביד או שהוצמד — שמור: הבחירה האוטומטית לאחרים מדלגת
    // עליו ועל כל מילה בו, אחרת "מרים" שהוקלדה למישהי יכולה להיבחר גם למישהו אחר.
    for(const s of subs){
      if(!s.replacement)continue;
      const nr=norm(s.replacement).trim();
      this.used.add(nr); for(const w of nr.split(/\s+/)) if(w) this.used.add(w);
    }
    for(const s of subs){
      if(!s.replacement||!nd)continue;
      if(new RegExp(NW+flex(s.replacement)+NWE,"u").test(nd)){
        // התחליף שנבחר כבר מופיע במסמך כמילה אמיתית. עד כאן זה נמחק בשקט והתחליף
        // הוחלף בשם אחר בלי לומר. עכשיו הבחירה עומדת, והכרטיס מזהיר.
        this.collided.push({value:s.value,rep:s.replacement});
      }
    }
    this.rules=[];const seen=new Set();
    const protect=new Set(subs.map(x=>x.value));
    if(typeof PLACE_BY!=="undefined")Object.keys(PLACE_BY).forEach(n=>protect.add(n));
    for(const s of subs){
      // גם מקום שאישרה מקבל צורות עם אות שימוש: "במבוא חורון" הוא "מבוא חורון".
      // בלי זה יישוב שאינו במאגר מאושר, לא נמצא, ומדווח "לא מופיע במסמך".
      const lvl=(s.kind==="NAME"||s.kind==="ORG"||s.kind==="PLACE")?(opt.prefixes||"normal"):"off";
      // שם קצר בן מילה אחת ("רון", "גל") — הצורות עם אות שימוש דומות מדי למילים
      // אחרות, אז הן דורשות אישור. אבל רק כשהשם באמת גם מילה: במסמך שבו שם בן
      // שלוש אותיות חוזר פעמים רבות, צורות כמו "לגלי" ו"שגלי" סומנו לבדיקה במקום
      // להיות מוחלפות, והשם נשאר בטקסט עד שהמשתמש/ת מטפל/ת בכל אחת מהן.
      const nv=norm(s.value).trim();
      // שם קצר שאושר (Q3 בגרסה 3): הצורות עם אות שימוש מוחלפות, חוץ מצורה שהיא
      // בעצמה מילה עברית — "לשי" ו"שרן" מוחלפים, "ושם" (ו+שם) נשאר לבדיקה. עד כאן כל
      // צורה של שם בן שתיים-שלוש אותיות חיכתה לאישור, וצורות כמו "ושי", "לרן",
      // "שרן" היה צריך להוסיף ביד, אחת-אחת, ו"לשי" עדיין יכול היה לצאת גלוי.
      const shortSingle = s.kind==="NAME" && nv.split(/\s+/).length===1 && nv.length<=3;
      const isWord=x=>wordish(x,this.forbidden);
      // יישוב שהוא גם מילה או צירוף, שחזר מהתיק (cond, applyProfile בדף): מוחלף רק במופע שהטקסט מראה שהוא מקום,
      // באותו תחליף; במופע אחר שכבת היישובים שואלת. כלל גורף החליף את «אני חוששת לשלומי» במסמך הבא (הביקורת של 11.10)
      const cond=s.kind==="PLACE"&&!!s.cond&&typeof placeCond==="function"&&placeCond(nv);
      for(const [v,pre] of variants(s.value,lvl,protect)){
        if(seen.has(v))continue; seen.add(v);
        this.rules.push({rx:new RegExp(NW+flex(v)+NWE,"gu"),base:s.value,
          kind:s.kind,rep:s.replacement,style:s.style||null,pre,auto:s.auto,cond,soft:!!pre&&shortSingle&&isWord(norm(v).trim())});
      }
      // "עמותת שביל הלב" אושרה: גם "שביל הלב" לבדו הוא אותו גוף, כמו שם משפחה
      // לבדו אצל אדם. אחרת המופע הראשון מוחלף והשני נשאר בטקסט.
      if(s.kind==="ORG"){
        const hm=/^(עמותת|עמותה|מעון|מרפאת|מכון|קרן|מרכז|אגודת|חברת|בית ספר|בי"ס|ביה"ס|גן ילדים|פנימיית|ישיבת)\s+(.+)$/u.exec(s.value.trim());
        const rest=hm&&hm[2].trim();
        if(rest&&(rest.split(/\s+/).length>=2||rest.length>=5)&&!protect.has(rest))
          for(const [v,pre] of variants(rest,lvl,protect)){
            if(seen.has(v))continue; seen.add(v);
            this.rules.push({rx:new RegExp(NW+flex(v)+NWE,"gu"),base:s.value,kind:s.kind,rep:s.replacement,style:s.style||null,pre,auto:s.auto,soft:false});
          }
      }
    }
    this.rules.sort((a,b)=>b.rx.source.length-a.rx.source.length);
    // הרשימה הלבנה חייבת לתפוס גם צורות עם אות שימוש ("בתל אביב"),
    // אחרת "אל תחליפו" נכשל בשקט על כל מילה עם ב/ל/מ/ה לפניה.
    // אותן אותיות שימוש שהכללים עצמם מכירים (SING ו-DBL ב-02-hebrew.js), ולא רשימה נפרדת:
    // הרשימה שעמדה כאן הכירה 15 מתוך 22 הצורות, ו"שבחיפה" הוחלף גם אחרי "אל תחליפו" (ביקורת H8)
    const ALLOW_PRE="(?:"+[...DBL,...SING].join("|")+")?";
    this.allow=(allow||[]).map(a=>new RegExp(
      "(?<![\\u0590-\\u05ff])"+ALLOW_PRE+
      flex(a)+NWE,"gu"));
    // הצורה המנורמלת של כל ערך מותר, באותו סדר, בשביל השער שב-detect
    this.allowN=(allow||[]).map(a=>norm(a).trim());
    this.cnt={};this.map={};
    // "גולדשמיט" ו"תמר גולדשמיט" הם אותו אדם — אותו כינוי, לא שניים.
    const named=subs.filter(x=>x.kind==="NAME")
      .sort((a,b)=>b.value.length-a.value.length);
    this.alias={};
    for(const short of named){
      if(short.replacement)continue;
      const toks=short.value.trim().split(/\s+/);
      if(toks.length!==1)continue;
      const full=named.find(f=>f!==short&&f.value.split(/\s+/).length>1&&
        f.value.split(/\s+/).slice(-1)[0]===toks[0]);
      if(full)this.alias[short.value]=full.value;
    }
    // "שלוה ליבוביץ" ו"שלווה ליבוביץ": עד כאן מוזגו מעצמם כשכל מילה במרחק
    // אות-קריאה. ההחלטה שלה (Q12 בגרסה 2): מיזוג לעולם אינו אוטומטי — מסך השמות מציע
    // אותו (mergeSignals) והיא מקישה. מה שאושר מגיע כאן כ-sameAs על הכלל.
    for(const s of subs){
      if(!s.sameAs||s.sameAs===s.value)continue;
      if(subs.some(f=>f.value===s.sameAs))this.alias[s.value]=s.sameAs;
    }
    // שרשרת (א→ב, ב→ג) נפתרת עד הסוף, בלי מעגלים
    for(const k of Object.keys(this.alias)){
      let t=this.alias[k], n=0; const seen=new Set([k]);
      while(this.alias[t]&&!seen.has(t)&&n++<20){seen.add(t);t=this.alias[t];}
      this.alias[k]=t;
    }
    for(const s of subs) if(s.replacement) this.map[ckey(s.kind,s.value)]??=s.replacement;
  }
  blocked(s,e,zones){return zones.some(([a,b])=>a<=s&&e<=b)}
  // תווים בלתי נראים (squeeze): הזיהוי רץ על מה שהקורא רואה, והמיקומים חוזרים לטקסט המקורי. ההחלפה מכסה את
  // התווים שבתוך הערך; סימני כיוון שלפניו ואחריו נשארים מחוצה לה, כדי שזוגות הבידוד יישארו שלמים.
  // addr: הטקסט הוא כתובת מפוענחת. שם בה מחובר ב-_ או ב-+ ("דנה_שגיא.pdf", "?q=דנה+שגיא"), ורק כללי הכתובת רצים.
  // more: שמות שתווית בשכן מעידה עליהם (labelNext), במיקומים של הטקסט המקורי; עוברים לטקסט שהקורא רואה
  detect(text,addr,more){
    const q=squeeze(text);
    if(!q) return this.detectSeen(text,addr,more&&more.map(h=>({...h})));
    // כמה תווים נראים יש לפני המקום x בטקסט המקורי: זה המקום שלו בטקסט שבלי התווים
    const seen=x=>{let lo=0,hi=q.pos.length; while(lo<hi){const m=(lo+hi)>>1; if(q.pos[m]<x)lo=m+1; else hi=m} return lo};
    const m2=(more||[]).map(h=>{const s=seen(h.s),e=seen(h.e); return {...h,s,e,text:q.t.slice(s,e)}}).filter(h=>h.e>h.s);
    const hits=this.detectSeen(q.t,addr,m2);
    for(const h of hits){ h.s=q.pos[h.s]; h.e=q.pos[h.e-1]+1; h.text=text.slice(h.s,h.e); }
    return hits;
  }
  detectSeen(text,addr,more){
    const n=norm(text),zones=[];
    const AGE=ageZones(n);
    // רשימת ההיתר תופסת גם צורות עם אות שימוש, ו-ש היא אות שימוש: "אל תחליפו" על
    // "רון" היה חוסם גם את "שרון", שני אנשים. אם המילה המלאה עם האות היא בעצמה
    // ערך ברשימה, זה אינו "ש+רון" אלא "שרון", והאזור לא נפתח.
    const listed=this._listed||(this._listed=new Set(this.subs.map(s=>norm(s.value).trim()).filter(Boolean)));
    this.allow.forEach((rx,i)=>{rx.lastIndex=0;let m;
      const own=(this.allowN||[])[i]||"";
      while((m=rx.exec(n))){
        const tok=m[0].trim();
        // רק כשההרחבה נחתה על ערך אחר ברשימה; "שרון" שהותרה בעצמה נשארת מותרת.
        // גם כשלפני הערך האחר עומדת אות שימוש: "ושרון" הוא ו+שרון, לא וש+רון
        if(tok!==own&&(listed.has(tok)||SING.some(p=>tok.startsWith(p)&&tok.slice(1)!==own&&listed.has(tok.slice(1)))))continue;
        zones.push([m.index,m.index+m[0].length])}});
    const hits=[], nl=addr?n.replace(/[_+]/g," "):n;
    let scan=null;
    const placeHere=(s,e)=>{ if(!scan)scan=placeScan(n); const x=scan.find(y=>y.s<e&&s<y.e); return !x||placeSure(n,x,scan); };
    for(const r of this.rules){r.rx.lastIndex=0;let m;
      while((m=r.rx.exec(nl))){
        const s=m.index,e=s+m[0].length;
        if(r.cond&&!placeHere(s,e))continue;
        /* ערך שברשימה מוחלף גם בתוך קטע ארוך יותר שהותר (v35): "לא שם"
           על קטע ארוך שהמודל הדביק ("אסתר גבאי ברזילי", דוגמה בדויה) כתב את כל הקטע
           לרשימת ההיתר, ומאז "אסתר" שברשימה נשארה גלויה בתוכו. אזור היתר
           חוסם כלל מהרשימה רק כשהוא הערך המותר עצמו, או צורתו עם אות שימוש —
           כלומר כשהאזור והפגיעה חופפים בדיוק. דפוסים (מספרים, כתובות) נשארים
           חסומים בהכלה, כמו קודם. */
        if(zones.some(([a,b])=>a===s&&b===e))continue;
        // "טל:" בראש שורת פרטי קשר הוא תווית טלפון, לא האדם ששמו טל: "טל: 04-…",
        // "טל: פקס:". תור דיבור ("טל: אני מסכימה") נשאר שם.
        if(/^(?:טל|פקס|נייד|טלפון)$/.test(m[0].trim())&&/^\s*:\s*(?:$|[\d+*(]|פקס|נייד|טל)/.test(n.slice(e,e+8)))continue;
        // שם בן מילה אחת ("שר", "גיל") שאחריו מילה שעושה ממנו תואר ציבורי:
        // "שר הרווחה" הוא התפקיד, לא האדם ששמו שר. בודקים את ההתאמה עם המילה הבאה.
        if(r.base.trim().split(" ").length===1){const nx=n.slice(e,e+30).trim().split(" ")[0]||""; const t2=(m[0]+" "+nx).trim(); if(PUBLIC_ORG.test(t2)||PUBLIC_ORG.test(t2.replace(/^[בהולמכש]/,"")))continue;}
        hits.push({s,e,type:r.kind,label:KINDLBL[r.kind]||r.kind,text:text.slice(s,e),
          apply:!r.soft,src:"list",prio:0,base:r.base,rep:r.rep,pre:r.pre,
          style:r.style||null,
          // "שכונת X", "מושב X": מילת הסוג שלפני המקום קובעת מאיזה סוג יהיה התחליף
          kind:(r.kind==="PLACE"&&typeof placeKind==="function")?placeKind(n,s):null,
          why:r.auto?"התגלה אוטומטית מההקשר":(r.pre?`מהרשימה שהגדרתם, עם אות השימוש "${r.pre}" שנשמרה`:"מהרשימה שהגדרתם"),
          review:!!r.pre,conf:"high"});
      }}
    const on=addr?(this._addrOn||(this._addrOn=new Set([...this.opt.on].filter(k=>ADDR_PAT.has(k))))):this.opt.on;
    for(const h of findPatterns(text,on,addr?new Set():this.opt.flag,addr?null:more)){
      if(this.blocked(h.s,h.e,zones))continue;
      // בכתובת, הקישור האישי שהוא הכתובת עצמה כבר נשפט לפי השרת שלה, והוא היה מסתיר את מה שבתוכה
      if(addr&&/^URL_/.test(h.type)&&/^[\s("'<[]*$/.test(text.slice(0,h.s)))continue;
      // בכתובת, טלפון קווי נלקח רק מהפרמטרים (אחרי "?"), לא מהנתיב: שם "04-54321-12" הוא חלק משם הקובץ של פסק דין בנבו
      // («FA-21-04-54321-12.htm»), והקישור הציבורי נשבר (הסקירה של 11.10). מספר שכבר הוחלף במסמך יוצא מהכתובת בכל מקום בה
      if(addr&&h.type==="PHONE_LAND"){ const qi=text.indexOf("?"); if(qi<0||h.s<qi) continue; }
      // וכך גם כתובת שהוקלדה בטקסט: מתחילת המילה (http, www) ועד "?" שלה, "04-54321-12" הוא שם קובץ ולא טלפון
      if(!addr&&h.type==="PHONE_LAND"){ let a=h.s; while(a>0&&!/\s/.test(text[a-1]))a--;
        if(/^(?:https?:\/\/|www\.)/i.test(text.slice(a))&&!text.slice(a,h.s).includes("?")) continue; }
      // "אל תחליפו" על יישוב חל על כל כתיב שלו: «נהרייה» הוא «נהריה» (PLACE_ALT, הציד של 11.10)
      if(h.place&&(this.allowN||[]).includes(norm(h.place).trim()))continue;
      // גיל אינו מזהה, וההבטחה הייתה "הכול חוץ מגילאים": "בת 9", "בן 12", "גיל 7",
      // "3 שנים" — מספר בהקשר של גיל נשאר גם כשמספרים מושמטים. צר ומבוסס הקשר בלבד.
      if(this.blocked(h.s,h.e,AGE))continue;
      h.review=h.conf!=="high"; h.base=h.base||h.text; hits.push(h);
    }
    if(!addr&&/%[0-9A-Fa-f]{2}/.test(text))for(const h of this.encoded(text))hits.push(h);
    const res=resolve(hits);
    return addr?res:this.twins(text,res)}
  /* שם של אדם באותיות לטיניות בסוגריים, צמוד לשם שלו בעברית ("קלייר דובואה-לוי (Claire Dubois-Levi)", או בסדר ההפוך):
     אותו אדם. הוא מוחלף באיות הלועזי של אותו שם בדוי ("אנה גולדשטיין (Ana Goldstein)"), נבדק בבדיקה האחרונה ונכנס למפה
     של ההחזרה כזוג משלו. עד כאן יצא כמו שהוא, תחת פס ירוק (הציד של 11.10) */
  twins(text,hits){
    const out=hits.slice(); let changed=false;
    for(const h of hits){
      if((CANON[h.type]||[h.type])[0]!=="NAME"||!(h.apply||h.review)||h.twinOf)continue;
      for(const [m,at] of [[LAT_AFTER.exec(text.slice(h.e)),h.e],[LAT_BEFORE.exec(text.slice(0,h.s)),0]]){
        if(!m||!latinOK(m[1]))continue;
        const s=at+m.index+m[0].indexOf(m[1]), e=s+m[1].length;
        // הצעה בלבד על אותו מקום ("הנתבע: Marc Dubois" מעוגן התפקיד) מפנה את מקומה לתאום של האדם שברשימה
        const over=out.filter(x=>x.s<e&&s<x.e);
        if(over.some(x=>x.apply||(CANON[x.type]||[x.type])[0]!=="NAME"))continue;
        for(const x of over)out.splice(out.indexOf(x),1);
        out.push({s,e,type:h.type,label:h.label,text:text.slice(s,e),apply:h.apply,review:h.review,why:h.why,src:h.src,
          prio:h.prio,conf:h.conf,twinOf:h,latin:true});
        changed=true;
      }
    }
    return changed?out.sort((a,b)=>a.s-b.s):hits}
  /* כתובת מקודדת בטקסט (הציד של 11.10): כל מילה שיש בה %XX מפוענחת, כללי הכתובת רצים על הפענוח,
     והפגיעה חוזרת אל המקום שלה בטקסט, עם הערך המפוענח. אחוז בטקסט רגיל ("בשיעור של %50") אינו כתובת:
     רק מילה שנראית כמו כתובת או נתיב, או שהפענוח שלה נותן אות עברית או @ */
  encoded(text){
    const out=[],rx=/\S+/g;let m;
    while((m=rx.exec(text))){
      const tok=m[0]; if(!/%[0-9A-Fa-f]{2}/.test(tok))continue;
      const dd=pctDecodeAll(tok);
      if(dd.d===tok||(!/[א-ת@]/.test(dd.d)&&!/[/\\:]/.test(tok)))continue;
      for(const h of this.detect(dd.d,true)){
        const a=dd.map[h.s][0],b=dd.map[h.e-1][1],raw=tok.slice(a,b);
        if(raw===h.text)continue;
        out.push({...h,s:m.index+a,e:m.index+b,text:raw,dtext:h.text,enc:true})}}
    return out}
  /* מה נכנס במקום ערך: name (שם או יישוב בדוי), label (פלוני א׳ / [ת"ז א׳]),
     black (███), או blank — הערך נמחק נקי מהטקסט.

     עד כאן הבחירה הייתה גלובלית, ומספר מזהה תמיד קיבל תווית. המשתמשת ביקשה שמספרים
     ותאריכים פשוט ייעלמו, ושאדם מסוים (למשל "נחום המזכיר") ייעלם גם הוא. הסדר:
     סגנון שנקבע על הכלל עצמו, ואם אין — ברירת המחדל לפי סוג מתוך האפשרויות
     (opt.styles, עם "*" לכל מה שאינו שם, גוף או מקום), ואם אין — המצב הגלובלי. */
  styleFor(h){
    if(h.style) return h.style;
    const fam=(CANON[h.type]||[h.type])[0];
    const st=this.opt.styles||{};
    const d=st[fam]||((fam==="NAME"||fam==="ORG"||fam==="PLACE")?null:st["*"]);
    if(d) return d;
    return this.opt.mode==="block"?"black":this.opt.mode==="label"?"label":"name";
  }
  repFor(h){
    // התאום הלועזי: האיות הלועזי של השם הבדוי של בן הזוג העברי שלו (twins)
    if(h.twinOf) return addPre(h.pre||"",latinOf(this.repFor({...h.twinOf,pre:""})));
    const pre=h.pre||"";
    const style=this.styleFor(h);
    // מחיקה: גם אות השימוש הולכת, ומי שמדביק את הטקסט למקומו (applyReps) סוגר את הרווח
    if(style==="blank") return "";
    if(style==="black") return addPre(pre,"███");
    // המפתח לפי הערך הבסיסי, לא לפי הטקסט שנתפס — אחרת
    // "מאורי בן-שחר" מקבל כינוי אחר מ"אורי בן-שחר".
    const canonical=(h.base&&this.alias[h.base])||h.base||h.text;
    const k=ckey(h.type==="NAME_ANCHORED"?"NAME":h.type,canonical);
    let base=h.rep||this.map[k];
    if(!base){
      const [fam,lab]=CANON[h.type]||[h.type,h.label];
      // תווית שכבר שייכת למישהו — כלל עם תחליף, למשל מהמסמך הקודם בתיק — אינה ניתנת שוב: «פלוני א׳ הגיש תגובה
      // לבקשה של פלוני א׳», ו«[ת"ז א׳]» לשני מספרים, וההחזרה ויתרה על שניהם (הציד של 11.10). הספירה מדלגת עליה
      const lbl=m=>fam==="NAME"?"פלוני "+hord(m):`[${lab} ${hord(m)}]`;
      let n=this.cnt[fam]||0; do n++; while(this.used.has(norm(lbl(n)).trim())); this.cnt[fam]=n;
      const real=style==="name";
      if(fam==="NAME"&&real)
        base=fakeName(canonical,this.gmap[canonical]||h.g,this.used,this.forbidden,this.firstish);
      // יישוב מקבל שם יישוב אמיתי, כמו ששם מקבל שם. מסך היישובים קודם כשהוא
      // מציע משהו, כי הוא שומר על המרחקים; זה מה שקורה לכל השאר, כולל מה שנגזר
      // ממילת יישוב ("מושב X", "שכונת Y"). מוסד רפואי, עסק או מוסד חינוך נשאר
      // תווית: שם יישוב במקומו היה משקר על סוג המקום.
      // תאריך מלא במצב "שם" הוא תאריך מוזז — אותו היסט לכל המסמך
      else if(fam==="DATE"&&real&&typeof fakeDate==="function")
        base=fakeDate(canonical,this.dateOff)||`[${lab} ${hord(n)}]`;
      // מקום מהרשימה (סוג PLACE) מקבל שם לפי סוגו — שכונה, רחוב, מושב — ולא תווית (Q11 בגרסה 2)
      else if(real&&typeof fakePlace==="function"&&
              (h.type==="PLACE"||h.type==="PLACE_CITY"||(h.type==="PLACE_VENUE"&&h.label==="יישוב")))
        base=fakePlace(canonical,this.used,this.forbidden,h.kind)||`[${lab} ${hord(n)}]`;
      // גוף שאושר מקבל שם בדוי שמשאיר את מילת הסוג ("מכון אורנים"), לא "[גוף א׳]"
      else if(fam==="ORG"&&real&&typeof fakeOrg==="function")
        base=fakeOrg(canonical,this.used,this.forbidden)||`[${lab} ${hord(n)}]`;
      else base = fam==="NAME" ? "פלוני "+hord(n) : `[${lab} ${hord(n)}]`;
    }
    this.map[k]??=base;
    /* "זה אותו אחד כמו" מצורה קצרה (v35): "שרן" שמוזג ל"רן אלון" קיבל את
       הכינוי המלא "דניאל אשכנזי" בכל מופע, ובלי ה-ש', וכל המסמך "קיבל שמות
       משפחה". צורה בת מילה אחת שממוזגת לשם מלא מקבלת את החלק המקביל בכינוי —
       שם פרטי לשם פרטי, שם משפחה לשם משפחה — ואות שימוש שדבוקה לצורה נשארת. */
    let out=base;
    if(h.base&&this.alias[h.base]&&style==="name"&&(CANON[h.type]||[h.type])[0]==="NAME"){
      const ct=norm(canonical).trim().split(/\s+/), rt=String(base||"").trim().split(/\s+/);
      if(ct.length>1&&rt.length>1){
        let bw=norm(h.base).trim(), xp="";
        if(!/\s/.test(bw)&&bw!==ct[0]&&bw!==ct[ct.length-1]&&PFX.has(bw[0])&&(ct.includes(bw.slice(1)))){xp=bw[0];bw=bw.slice(1);}
        if(!/\s/.test(bw)){
          if(bw===ct[0])out=xp+rt[0];
          else if(bw===ct[ct.length-1])out=xp+rt[rt.length-1];
        }
      }
    }
    // שם שנכתב באותיות לטיניות מקבל את השם הבדוי באותיות לטיניות ("התובעת: Claire Dubois" ← "התובעת: Ana Goldstein")
    if(style==="name"&&/^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(canonical)&&!/[א-ת]/.test(canonical))out=latinOf(out);
    return addPre(pre,out)}
}

/* ══════════ מאגר יישובים ══════════
   1116 שמות יישובים מרשימת הלמ"ס (data.gov.il), בלי אלה שכבר ב-PLACES עם
   קואורדינטות. נבנה ב-scripts/build-gazetteer.js; לא לערוך ביד. הרשימה מלאה, אבל
   findPlaces (06-model.js) משתמש רק בשמות בני שתי מילים ומעלה; שם בן מילה אחת
   מכאן לא נתפס כלל, ושם במקף ("מודיעין-מכבים-רעות") הוא שם של כמה מילים. הנימוק
   והכלל המלא — שם. */
const GAZ=["אבו ג'ווייעד","אבו גוש","אבו סריחאן","אבו עבדון","אבו עמאר","אבו עמרה","אבו קורינאת","אבו קרינאת","אבו רובייעה","אבו רוקייק","אבו תלול","אבטין","אבטליון","אביאל","אביבים","אביגדור","אביגיל","אביה","אביחיל","אביטל","אביעזר","אבירים","אבן מנחם","אבן ספיר","אבן שמואל","אבני איתן","אבני חפץ","אדורה","אדוריים","אדירים","אדמית","אדרת","אובנת","אודים","אודם","אוהד","אום אל-קוטוף","אום בטין","אומן","אומץ","אור הגנוז","אור הנר","אורה","אורות","אורטל","אורים","אורנים","אורנית","אושה","אחווה","אחוזם","אחוזת ברק","אחיה","אחיהוד","אחיטוב","אחיסמך","אחיעזר","אטרש","איבי הנחל","איבים","אייל","איילת השחר","אילון","אילות","אילניה","אירוס","איתמר","איתן","איתנים","אל סייד","אל-עזי","אל-עריאן","אל-רום","אלומה","אלומות","אלון","אלון הגליל","אלון מורה","אלון שבות","אלוני אבא","אלוני הבשן","אלוני יצחק","אלונים","אלי-עד","אליאב","אליכין","אליפז","אליפלט","אליקים","אלישיב","אלישמע","אלמגור","אלמוג","אלעזר","אלקוש","אמונים","אמירים","אמנון","אמציה","אניעם","אסד","אסיף","אספר","אעבלין","אעצם","אפיניש","אפיק","אפיקים","אפק","ארבל","ארגמן","ארז","ארסוף","אשבול","אשבל","אשחר","אשכולות","אשל הנשיא","אשרת","אשתאול","אתגר","באר אורה","באר גנים","באר טוביה","באר מילכה","בארות יצחק","בארותיים","בארי","בוסתן הגליל","בועיינה-נוג'ידאת","בוקעאתא","בורגתה","בחן","בטחה","ביצרון","ביר אל-מכסור","ביר הדאג'","ביריה","בית אורן","בית אלעזרי","בית אריה","בית גוברין","בית גמליאל","בית הגדי","בית הלוי","בית הלל","בית העמק","בית הערבה","בית השיטה","בית זיד","בית זית","בית זרע","בית חוגלה","בית חירות","בית חלקיה","בית חנניה","בית חשמונאי","בית יהושע","בית יוסף","בית ינאי","בית יצחק-שער חפר","בית יתיר","בית לחם הגלילית","בית מאיר","בית נחמיה","בית ניר","בית נקופה","בית עובד","בית עוזיאל","בית עזרא","בית עריף","בית צבי","בית קמה","בית קשת","בית רבן","בית רימון","בית שערים","בית שקמה","ביתן אהרן","ביתר עילית","בלפוריה","בן זכאי","בן עמי","בן שמן","בני דקלים","בני דרום","בני דרור","בני יהודה","בני נצרים","בני עטרות","בני עי\"ש","בני ציון","בני ראם","בניה","בנימינה-גבעת עדה","בסמ\"ה","בסמת טבעון","בענה","בצרה","בצת","בקוע","בקעות","בר גיורא","בר יוחאי","בר כוכבא","ברוכין","ברור חיל","ברוש","ברוש הבקעה","ברכה","ברכיה","ברעם","ברק","ברקאי","ברקת","בת הדר","בת חן","בת חפר","בת עין","בת שלמה","בתרון","ג'דיידה-מכר","ג'ולס","ג'נאביב","ג'סר א-זרקא","ג'ש","ג'ת","גאולי תימן","גאולים","גאליה","גבולות","גבים","גבע","גבע בנימין","גבע כרמל","גבעולים","גבעון החדשה","גבעות","גבעות בר","גבעות הרואה","גבעות עדן","גבעת אבני","גבעת אלה","גבעת ברנר","גבעת השלושה","גבעת ח\"ן","גבעת חיים","גבעת יואב","גבעת יערים","גבעת ישעיהו","גבעת כ\"ח","גבעת ניל\"י","גבעת עוז","גבעת שמש","גבעת שפירא","גבעתי","גברעם","גבת","גדות","גדיש","גדעונה","גודר","גונן","גורן","גורנות הגליל","גזית","גזר","גיאה","גיבתון","גיזו","גילון","גילת","גינוסר","גיניגר","גינתון","גיתה","גיתית","גלאון","גלגל","גליל ים","גלעד","גמזו","גן הדרום","גן השומרון","גן חיים","גן יאשיה","גן נר","גן שורק","גן שלמה","גן שמואל","גנות","גנות הדר","גני הדר","גני טל","גני יוחנן","גני מודיעין","גני עם","גנים","געש","געתון","גפן","גרופית","גשור","גשר הזיו","גת","גת רימון","דבורה","דביר","דברת","דגניה א'","דגניה ב'","דוב\"ב","דולב","דור","דורות","דחי","דייר אל-אסד","דייר חנא","דייר ראפאת","דישון","דלתון","דמיידה","דפנה","דקל","דריג'את","האון","הבונים","הגושרים","הדר עם","הודיה","הודיות","הוואשלה","הוזייל","הושעיה","הזורע","הזורעים","החותרים","היוגב","הילה","המעפיל","הסוללים","העוגן","הר אדר","הר בזק","הר גילה","הר עמשא","הראל","הרדוף","הררית","ורד יריחו","ורדון","זבארגה","זבדיאל","זוהר","זיקים","זיתן","זכריה","זמר","זמרת","זנוח","זרועה","זרזיר","זרחיה","ח'ואלד","חבצלת השרון","חבר","חברון","חגור","חגי","חגלה","חד-נס","חדיד","חוג'ייראת","חולדה","חולית","חומש","חוסן","חוסנייה","חופית","חוקוק","חורשים","חזון","חיבת ציון","חיננית","חירות","חלוץ","חלץ","חמאם","חמד","חמדיה","חמדת","חמרה","חניאל","חניתה","חנתון","חספין","חפץ חיים","חפצי-בה","חצב","חצור-אשדוד","חצרים","חרב לאת","חרוצים","חרמש","חרשה","חרשים","חשמונאים","טובא-זנגריה","טורעאן","טירת יהודה","טל מנשה","טל שחר","טל-אל","טללים","טלמון","טנא","טפחות","יאנוח-ג'ת","יבול","יבנאל","יגור","יגל","יד בנימין","יד השמונה","יד חנה","יד נתן","יד רמב\"ם","ידידה","יהוד-מונוסון","יהל","יובל","יובלים","יודפת","יונדב","יונתן","יושיביה","יזרעאל","יחיעם","ייט\"ב","יכיני","ינוב","ינון","יסודות","יסעור","יעד","יעל","יעף","יערה","יפיע","יפית","יפעת","יפתח","יצהר","יציץ","יקום","יקנעם עילית","יראון","ירדנה","ירחיב","ירקונה","ישע","ישעי","ישרש","יתד","כאוכב אבו אל-היג'א","כברי","כדורי","כדים","כדיתה","כוכב יאיר-צור יגאל","כוכב יעקב","כוכב מיכאל","כחל","כחלה","כיסופים","כישור","כליל","כלנית","כמאנה","כמהין","כמון","כנות","כנף","כנפי שחר","כסיפה","כסלון","כסרא-סמיע","כעביה-טבאש-חג'אג'רה","כפר אביב","כפר אוריה","כפר אחים","כפר ביאליק","כפר ביל\"ו","כפר בלום","כפר בן נון","כפר ברא","כפר ברוך","כפר גדעון","כפר גלים","כפר גליקסון","כפר דניאל","כפר האורנים","כפר החורש","כפר המכבי","כפר הנגיד","כפר הנוער הדתי","כפר הנשיא","כפר הס","כפר הרא\"ה","כפר הרי\"ף","כפר ורבורג","כפר זוהרים","כפר זיתים","כפר חב\"ד","כפר חושן","כפר חיטים","כפר חיים","כפר חנניה","כפר חסידים א'","כפר חסידים ב'","כפר חרוב","כפר טרומן","כפר ידידיה","כפר יהושע","כפר יחזקאל","כפר יעבץ","כפר כמא","כפר מונש","כפר מימון","כפר מל\"ל","כפר מנחם","כפר מסריק","כפר מצר","כפר מרדכי","כפר נטר","כפר סאלד","כפר סילבר","כפר עבודה","כפר עציון","כפר פינס","כפר קיש","כפר ראש הנקרה","כפר רוזנואלד","כפר רופין","כפר רות","כפר שמאי","כפר שמואל","כפר שמריהו","כפר תפוח","כרכום","כרם ביבנה","כרם בן זמרה","כרם בן שמן","כרם מהר\"ל","כרם רעים","כרם שלום","כרמי יוסף","כרמי עוז","כרמי צור","כרמי קטיף","כרמיה","כרמים","לבון","לביא","לבנים","להב","להבות הבשן","להבות חביבה","לוזית","לוחמי הגיטאות","לוטם","לוטן","לח\"י","לימן","לכיש","לפיד","לפידות","לשם","מאור","מאיר שפיה","מבוא ביתר","מבוא דותן","מבוא חורון","מבוא חמה","מבוא מודיעים","מבואות ים","מבואות יריחו","מבועים","מבטחים","מבקיעים","מג'דל שמס","מגאר","מגדים","מגדל","מגדל עוז","מגדלים","מגל","מגן שאול","מגרון","מגשימים","מדרך עוז","מדרשת בן גוריון","מדרשת רופין","מודיעין עילית","מודיעין-מכבים-רעות","מולדת","מוצא עילית","מוקייבלה","מורן","מורשת","מזור","מזרע","מזרעה","מחולה","מחנה הילה","מחנה טלי","מחנה יהודית","מחנה יוכבד","מחנה יפה","מחנה יתיר","מחנה מרים","מחנה תל נוף","מחניים","מחסיה","מטע","מי עמי","מיטב","מיטל","מייסר","מיצר","מירב","מירון","מישר","מכורה","מכחול","מכמורת","מכמנים","מלאה","מלאכי השלום","מלילות","מלכיה","מנוחה","מנוף","מנות","מנחמיה","מנרה","מנשית זבדה","מסד","מסדה","מסילות","מסילת ציון","מסלול","מסעדה","מסעודין אל-עזאזמה","מעברות","מעגלים","מעגן","מעגן מיכאל","מעוז","מעוז חיים","מעונה","מעין ברוך","מעין צבי","מעלה אפרים","מעלה גמלא","מעלה החמישה","מעלה לבונה","מעלה מכמש","מעלה עירון","מעלה עמוס","מעלות-תרשיחא","מענית","מעש","מפלסים","מצובה","מצוקי ארץ","מצליח","מצפה","מצפה אבי\"ב","מצפה אילן","מצפה זיף","מצפה יריחו","מצפה נטופה","מצפה שלם","מצר","מקווה ישראל","מרגליות","מרום גולן","מרחב עם","מרחביה","מרכז שפירא","משגב דב","משגב עם","משהד","משואה","משואות יצחק","משכיות","משמר איילון","משמר דוד","משמר הירדן","משמר הנגב","משמר העמק","משמר השבעה","משמר השרון","משמר יהודה","משמרות","משמרת","משען","מתן","מתת","מתתיהו","נאות גולן","נאות מרדכי","נאות סמדר","נאעורה","נבטים","נגבה","נגוהות","נהורה","נוב","נוגה","נוה צוף","נווה","נווה אבות","נווה אור","נווה אטי\"ב","נווה אילן","נווה איתן","נווה גדיד","נווה דניאל","נווה זוהר","נווה זיו","נווה חריף","נווה ים","נווה ימין","נווה ירק","נווה מבטח","נווה מיכאל","נווה שלום","נועם","נוף איילון","נוף הגליל","נופי פרת","נופים","נופית","נופך","נוקדים","נורדיה","נורית","נזר שומרון","נחושה","נחל עוז","נחלה","נחליאל","נחם","נחשולים","נחשון","נחשונים","נטועה","נטור","נטע","נטעים","נטף","ניין","ניל\"י","ניצן ב'","ניצני סיני","ניצני עוז","ניצנים","ניר אליהו","ניר בנים","ניר גלים","ניר דוד","ניר ח\"ן","ניר יפה","ניר יצחק","ניר ישראל","ניר משה","ניר עוז","ניר עציון","ניר עקיבא","ניר צבי","נמרוד","נס הרים","נס עמים","נעורים","נעלה","נעמ\"ה","נען","נערן","נצאצרה","נצר חזני","נצר סרני","נריה","נתיב הגדוד","נתיב הל\"ה","נתיב העשרה","נתיב השיירה","סאג'ור","סאסא","סביון","סגולה","סואעד","סואעד (כמאנה)","סולם","סוסיה","סופה","סחלב","סייד","סלמה","סלעית","סמר","סנסנה","סעד","סעוה","סער","ספיר","סתריה","ע'ג'ר","עבדון","עברון","עגור","עדי","עדי עד","עדנים","עוזה","עוזייר","עולש","עופר","עופרה","עוצם","עוקבי","עזוז","עזר","עזריאל","עזריה","עזריקם","עטאוונה","עטרת","עיבל","עידן","עיילבון","עיינות","עילוט","עין איילה","עין אל-אסד","עין גב","עין דור","עין הבשור","עין הוד","עין החורש","עין המפרץ","עין הנצי\"ב","עין העמק","עין השלושה","עין ורד","עין זיוון","עין חוד","עין חצבה","עין חרוד","עין ייט\"ב","עין יעקב","עין כרם-בי\"ס חקלאי","עין כרמל","עין מאהל","עין נקובא","עין עירון","עין צורים","עין קנייא","עין ראפה","עין שמר","עין שריד","עין תמר","עינת","עיר אובות","עלומים","עלי זהב","עלמה","עלמון","עמוקה","עמיחי","עמינדב","עמיעוז","עמיקם","עמיר","עמקה","ענב","עספיא","עצמון שגב","עראמשה","ערב אל נעים","ערוגות","ערערה-בנגב","עשהאל","עשרת","עתניאל","פדויים","פדיה","פוריה - כפר עבודה","פוריה - נווה עובד","פוריה עילית","פוריידיס","פורת","פטיש","פלך","פלמחים","פני חבר","פני קדם","פסגות","פסוטה","פעמי תש\"ז","פצאל","פקיעין חדשה","פרדס חנה-כרכור","פרוד","פרזון","פרי גן","פרשים","פתחיה","צביה","צבעון","צובה","צוחר","צופיה","צופים","צופר","צוקי ים","צוקים","צור יצחק","צור משה","צור נתן","צוריאל","צורית","ציפורי","צלפון","צנדלה","צפריה","צפרירים","צרופה","צרעה","קבועה","קבוצת יבנה","קדומים","קדימה-צורן","קדם ערבה","קדמה","קדמת צבי","קדר","קדרון","קדרים","קודייראת א-צאנע","קוואעין","קוממיות","קורנית","קיסריה","קלחים","קליה","קלע","קציר","קצר א-סר","קרית יערים","קרית נטפים","קרית עקרון","קרית שלמה","קרן יער","קשת","ראס אל-עין","ראס עלי","ראש צורים","רבבה","רבדים","רביד","רגבה","רגבים","רווחה","רוויה","רוח מדבר","רוחמה","רומאנה","רומת הייב","רועי","רותם","רחוב","רחלים","ריחאניה","ריחן","ריינה","רימונים","רם-און","רמות","רמות השבים","רמות מאיר","רמות מנשה","רמות נפתלי","רמת דוד","רמת הכובש","רמת הנשיא טראמפ","רמת השופט","רמת יוחנן","רמת מגשימים","רמת צבי","רמת רזיאל","רמת רחל","רנן","רעים","רקפת","רשפון","רשפים","רתמים","שא-נור","שאר ישוב","שבות רחל","שבי דרום","שבי ציון","שבי שומרון","שבלי - אום אל-גנם","שגב-שלום","שדה אילן","שדה אליעזר","שדה דוד","שדה ורבורג","שדה יואב","שדה יעקב","שדה יצחק","שדה משה","שדה נחום","שדה נחמיה","שדה ניצן","שדה עוזיהו","שדה צבי","שדות ים","שדות מיכה","שדי אברהם","שדי חמד","שדי תרומות","שדמה","שדמות דבורה","שדמות מחולה","שואבה","שובה","שובל","שומרה","שומריה","שוקדה","שורש","שורשים","שושנת העמקים","שזור","שחר","שחרות","שחרית","שיבולים","שיזף","שיטים","שייח' דנון","שילת","שירה","שכניה","שלווה","שלווה במדבר","שלוחות","שלומית","שמיר","שמעה","שמרת","שמשית","שני","שניר","שעב","שעל","שעלבים","שער אפרים","שער הגולן","שער העמקים","שער מנשה","שער שומרון","שפיים","שפיר","שפר","שקד","שקף","שרונה","שריגים","שריד","שרשרת","שתולה","שתולים","תאשור","תדהר","תובל","תומר","תושיה","תימורים","תירוש","תל אביב - יפו","תל יוסף","תל יצחק","תל עדשים","תל ציון","תל קציר","תל תאומים","תלם","תלמי אליהו","תלמי אלעזר","תלמי ביל\"ו","תלמי יוסף","תלמי יחיאל","תלמי יפה","תלמים","תמרת","תנובות","תעוז","תפרח","תקומה","תראבין א-צאנע","תרום"];
// רק שמות של שתי מילים ומעלה (שם במקף הוא כזה), בכל כתיב, ובלי שם שכבר ב-PLACES בכתיב אחר (06-model.js)
const GAZ_IX=placeIndex(GAZ.filter(n=>/[\s-]/.test(n)),PLACE_IX.keys);
const GAZ_RX=GAZ_IX.rx;
/* ══════════════════════════ DOCX ══════════════════════════ */
/* טאב, מעבר שורה ומקף שאינו נשבר הם אלמנטים ולא תווים. בלי מפריד, "רחל<טאב/>פרידמן"
   נקרא "רחלפרידמן": השם לא נמצא, והבדיקה שאחרי ההחלפה לא ראתה אותו (שכבה 1ב בתוכנית
   האיכות). הם נספרים כתו אחד, רק בתוך ריצה — w:tab בתוך w:tabs הוא הגדרת עצירה.
   טאב מיקום (ptab) הוא מה ש-Word כותב בכותרת בשלושה חלקים: בלעדיו "רחל פרידמן⇥בקשה" נקרא כמילה
   אחת, רק השם הפרטי הוחלף, ושם המשפחה האמיתי יצא ל-AI בפס ירוק (הציד של 11.10). מקף רך הוא מקום
   שבו מותר לשבור מילה ולא תו: אורכו אפס, והוא יוצא עם ערך שהוחלף. */
const SEP={tab:" ",ptab:" ",br:" ",cr:" ",noBreakHyphen:"-",softHyphen:""};
// סימן של הערת שוליים או הערת סיום: בגוף הטקסט, ובראש ההערה עצמה
const NOTEREF={footnoteReference:"footnoteReference",endnoteReference:"endnoteReference",footnoteRef:"footnoteReference",endnoteRef:"endnoteReference"};
function ownText(p,out){
  for(const c of p.children){
    if(c.localName==="p")continue;
    if(c.localName==="t"||c.localName==="delText")out.push(c);
    else if(p.localName==="r"&&SEP.hasOwnProperty(c.localName))out.push({sep:SEP[c.localName],el:c});
    else if(p.localName==="r"&&c.namespaceURI===W&&NOTEREF.hasOwnProperty(c.localName))out.push({note:c});
    ownText(c,out)}}
const MC="http://schemas.openxmlformats.org/markup-compatibility/2006";
// הענף של mc:AlternateContent שהאלמנט יושב בו — mc:Choice או mc:Fallback הקרוב — או null
function altBranch(el){
  for(let n=el&&el.parentNode;n&&n.nodeType===1;n=n.parentNode)
    if(n.namespaceURI===MC&&(n.localName==="Choice"||n.localName==="Fallback"))return n;
  return null}
const kidW=(el,n)=>{if(el)for(const c of el.children)if(c.localName===n&&c.namespaceURI===W)return c;return null};
const valW=el=>el?el.getAttribute("w:val"):null;
/* מה ש-Word כותב בעצמו ואינו שומר כטקסט: המספר של סעיף ממוספר (numbering.xml) וסימן של הערת שוליים.
   בלעדיהם הטקסט שהועתק ל-AI היה בלי מספרי הסעיפים — "כאמור בסעיף 2" הצביע על כלום — וההערות הגיעו
   בסוף בלי עוגן (הציד של 11.10). הם נוספים לתצוגה ולטקסט שמועתק, כמו ש-Word מציג אותם, ואינם נכנסים
   לטקסט שהזיהוי קורא ולא לקובץ: את הקובץ Word ממספר בעצמו. */
function lvlOf(l){
  const n=x=>kidW(l,x)?+valW(kidW(l,x)):null, lg=kidW(l,"isLgl");
  return {start:n("start")||0,fmt:valW(kidW(l,"numFmt"))||"decimal",text:valW(kidW(l,"lvlText")),restart:n("lvlRestart"),
    lgl:!!lg&&!/^(?:0|false|off)$/.test(valW(lg)||""),suff:valW(kidW(l,"suff"))||"tab",style:valW(kidW(l,"pStyle"))}}
function numModel(numDoc,styDoc){
  const M={abs:{},num:{},sty:{}};
  if(styDoc)for(const s of Array.from(styDoc.getElementsByTagNameNS(W,"style"))){
    const id=s.getAttribute("w:styleId"), np=kidW(kidW(s,"pPr"),"numPr");
    if(id)M.sty[id]={basedOn:valW(kidW(s,"basedOn")),numId:np&&kidW(np,"numId")?valW(kidW(np,"numId")):null,ilvl:np&&kidW(np,"ilvl")?+valW(kidW(np,"ilvl")):null}}
  if(numDoc){
    for(const a of Array.from(numDoc.getElementsByTagNameNS(W,"abstractNum"))){
      const lv={};for(const l of a.children)if(l.localName==="lvl")lv[+l.getAttribute("w:ilvl")]=lvlOf(l);
      M.abs[a.getAttribute("w:abstractNumId")]={lv,link:valW(kidW(a,"numStyleLink"))}}
    for(const n of Array.from(numDoc.getElementsByTagNameNS(W,"num"))){
      const over={};
      for(const o of n.children)if(o.localName==="lvlOverride"){const so=kidW(o,"startOverride"),l=kidW(o,"lvl");
        over[+o.getAttribute("w:ilvl")]={start:so?+valW(so):null,lvl:l?lvlOf(l):null}}
      M.num[n.getAttribute("w:numId")]={abs:valW(kidW(n,"abstractNumId")),over}}}
  return M}
const ROMAN=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
function fmtNum(v,f){
  if(f==="none")return "";
  if(v<1||f==="decimal")return String(v);
  if(f==="decimalZero")return (v<10?"0":"")+v;
  if(f==="upperRoman"||f==="lowerRoman"){let r="",x=v;for(const [n,s] of ROMAN)while(x>=n){r+=s;x-=n}return f==="lowerRoman"?r.toLowerCase():r}
  if(f==="upperLetter"||f==="lowerLetter"){const s="ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(v-1)%26].repeat(Math.floor((v-1)/26)+1);return f==="lowerLetter"?s.toLowerCase():s}
  // אותיות כמספרים (א, ב … י, יא, טו, טז), ואותיות לפי הסדר (א … ת)
  if(f==="hebrew1"){let r="",x=v;while(x>=400){r+="ת";x-=400}r+=G_HUN[Math.floor(x/100)];x%=100;
    return r+(x===15?"טו":x===16?"טז":G_TEN[Math.floor(x/10)]+G_ONE[x%10])}
  if(f==="hebrew2"){const a="אבגדהוזחטיכלמנסעפצקרשת";return a[(v-1)%22].repeat(Math.floor((v-1)/22)+1)}
  return String(v)}
// המספר של פסקה ממוספרת, לפי numPr שלה או של הסגנון שלה; counters: מצב המונים לאורך החלק
function numLead(p,M,counters){
  const br=altBranch(p); if(br&&br.localName==="Fallback")return "";
  const pPr=kidW(p,"pPr"), np=kidW(pPr,"numPr"), sid=valW(kidW(pPr,"pStyle"));
  let numId=np&&kidW(np,"numId")?valW(kidW(np,"numId")):null, ilvl=np&&kidW(np,"ilvl")?+valW(kidW(np,"ilvl")):null;
  if(numId==null)for(let s=sid,k=0;s&&k<12;k++){const y=M.sty[s];if(!y)break;if(y.numId!=null){numId=y.numId;if(ilvl==null)ilvl=y.ilvl;break}s=y.basedOn}
  const n=numId!=null&&numId!=="0"&&M.num[numId]; if(!n)return "";
  let a=M.abs[n.abs];
  // רשימה שמוגדרת בסגנון רשימה (numStyleLink) לוקחת את ההגדרה ממנו
  for(let k=0;a&&a.link&&k<3;k++){const y=M.sty[a.link],n2=y&&y.numId!=null&&M.num[y.numId],a2=n2&&M.abs[n2.abs];if(!a2||a2===a)break;a=a2}
  if(!a)return "";
  if(ilvl==null){ilvl=0;if(sid)for(const [i,l] of Object.entries(a.lv))if(l.style===sid){ilvl=+i;break}}
  const lvl=i=>(n.over[i]&&n.over[i].lvl)||a.lv[i], start=i=>n.over[i]&&n.over[i].start!=null?n.over[i].start:lvl(i)?lvl(i).start:0;
  const L=lvl(ilvl); if(!L)return "";
  let c=counters.get(a); if(!c)counters.set(a,c=[]);
  // רשימה שמתחילה מחדש (startOverride) מאפסת את הרמות שלה בפעם הראשונה שהיא מופיעה
  if(!counters.has(numId)){counters.set(numId,1);for(const i of Object.keys(n.over))c[+i]=undefined}
  c[ilvl]=c[ilvl]===undefined?start(ilvl):c[ilvl]+1;
  for(let i=ilvl+1;i<9;i++){const l=lvl(i);if(!l||l.restart==null||(l.restart!==0&&ilvl+1<=l.restart))c[i]=undefined}
  const gap=L.suff==="nothing"?"":" ";
  if(L.fmt==="bullet"){const b=String(L.text||"").trim();return (!b||/[\uE000-\uF8FF]/.test(b)?"•":b)+gap}
  const lab=String(L.text||"").replace(/%([1-9])/g,(m,k)=>{const i=+k-1;return fmtNum(c[i]===undefined?start(i):c[i],L.lgl?"decimal":(lvl(i)||L).fmt)});
  return lab.trim()?lab+gap:""}
// מספרי ההערות לפי סדר ההפניות בגוף המסמך, לא לפי המזהה; הערה בסימן משלה אינה לוקחת מספר
function noteMap(docDoc,setDoc){
  const out={footnoteReference:{},endnoteReference:{}};
  if(!docDoc)return out;
  const body=docDoc.getElementsByTagNameNS(W,"body")[0], sect=body&&Array.from(body.children).filter(c=>c.localName==="sectPr").pop();
  const pr=n=>kidW(sect,n)||(setDoc&&setDoc.getElementsByTagNameNS(W,n)[0])||null;
  const cfg={footnoteReference:pr("footnotePr"),endnoteReference:pr("endnotePr")}, k={footnoteReference:0,endnoteReference:0};
  // ברירת המחדל של Word: הערות שוליים 1, 2, 3; הערות סיום i, ii, iii
  const fmt={footnoteReference:valW(kidW(cfg.footnoteReference,"numFmt"))||"decimal",endnoteReference:valW(kidW(cfg.endnoteReference,"numFmt"))||"lowerRoman"};
  const st=x=>+(valW(kidW(cfg[x],"numStart"))||1);
  for(const el of Array.from(docDoc.getElementsByTagName("*"))){
    const ln=el.localName; if(el.namespaceURI!==W||(ln!=="footnoteReference"&&ln!=="endnoteReference"))continue;
    const br=altBranch(el); if(br&&br.localName==="Fallback")continue;
    if(/^(?:1|true|on)$/.test(el.getAttribute("w:customMarkFollows")||""))continue;
    const id=el.getAttribute("w:id"); if(out[ln].hasOwnProperty(id))continue;
    out[ln][id]=fmtNum(st(ln)+k[ln]++,fmt[ln])}
  return out}
function noteMark(el,notes){
  const ln=el.localName, kind=NOTEREF[ln];
  let id=el.getAttribute("w:id");
  if(ln==="footnoteRef"||ln==="endnoteRef"){const tag=ln==="footnoteRef"?"footnote":"endnote";
    let n=el.parentNode;while(n&&n.nodeType===1&&n.localName!==tag)n=n.parentNode;
    id=n&&n.nodeType===1?n.getAttribute("w:id"):null}
  return id!=null&&notes[kind].hasOwnProperty(id)?"["+notes[kind][id]+"]":""}
// הקשר של החבילה כולה למספרים: ההגדרות מ-numbering.xml ו-styles.xml, ומספרי ההערות מ-document.xml
function wordCtx(docOf){
  return {num:numModel(docOf("word/numbering.xml"),docOf("word/styles.xml")),notes:noteMap(docOf("word/document.xml"),docOf("word/settings.xml"))}}
// הטקסט כפי שהוא מוצג ומועתק: המספר בראש הפסקה וסימני ההערות במקומם, ומיקום בטקסט שהזיהוי קרא ← מיקום בו
function shown(blk){
  const lead=blk.lead||"", ins=(blk.ins||[]).slice().sort((a,b)=>a.at-b.at);
  if(!lead&&!ins.length)return {text:blk.text,at:p=>p};
  let text=lead,last=0;
  for(const x of ins){text+=blk.text.slice(last,x.at)+x.t;last=x.at}
  text+=blk.text.slice(last);
  // end: סוף של סימון (לא כולל) אינו זז בגלל סימן שנוסף בדיוק אחריו
  return {text,at:(p,end)=>p+lead.length+ins.reduce((n,x)=>(end?x.at<p:x.at<=p)?n+x.t.length:n,0)}}
const DML="http://schemas.openxmlformats.org/drawingml/2006/main";
// טקסט חלופי של תמונה אינו חלק מגוף הטקסט: לא נסרק לשמות חדשים ולא מוצג כפסקה
const notProse=p=>p.includes("טקסט חלופי")||p.includes("קוד שדה")||p.includes("הגדרות עיצוב");
/* ומה שאינו מועתק ל-AI: גם רכיבים מהירים (glossary), ש-Word אינו מציג בעמוד — שם יושב טקסט מציין המקום
   של פקדי התוכן ("לחץ או הקש כאן להזנת טקסט."), והוא הגיע לטקסט שהועתק (הציד של 11.10). הם עדיין
   נקראים, מוחלפים ונסרקים לשמות כמו קודם. */
const hiddenPart=p=>notProse(p)||p.includes("glossary/")||p.includes("רכיבים מהירים");
const VML="urn:schemas-microsoft-com:vml", O_NS="urn:schemas-microsoft-com:office:office";
/* התא של פסקה בטבלה: הטבלה, מספר השורה בה, השורה והטור, כולל תאים ריקים. כותרת של כתב טענות ערוכה לא פעם
   כטבלה, "התובעת:" בתא אחד והשם בתא שלידו, וכך גם טופס, וטבלת ילדים ששורת הכותרת שלה "שם הקטין"; העוגנים ראו
   פסקה אחת בכל פעם (הציד של 11.10, labelNext). פסקה בתיבת טקסט שבתוך תא אינה חלק מהשורה. */
function cellOf(p,part,T){
  const isW=(n,ln)=>n&&n.nodeType===1&&n.localName===ln&&n.namespaceURI===W;
  const up=(n,ln)=>{let x=n.parentNode; while(x&&!isW(x,ln))x=x.parentNode; return x};
  for(let n=p.parentNode;n&&n.nodeType===1;n=n.parentNode){
    if(n.localName==="txbxContent")return null;
    if(!isW(n,"tc"))continue;
    const tr=up(n,"tr"); if(!tr)return null;
    let r=T.rows.get(tr);
    if(!r){
      const tbl=up(tr,"tbl");
      let t=tbl&&T.tbls.get(tbl);
      if(tbl&&!t){t={id:part+"#t"+(T.tbls.size+1),trs:Array.from(tbl.getElementsByTagNameNS(W,"tr")).filter(x=>up(x,"tbl")===tbl)}; T.tbls.set(tbl,t)}
      r={id:part+"#"+(T.rows.size+1),cells:Array.from(tr.getElementsByTagNameNS(W,"tc")).filter(c=>up(c,"tr")===tr),
        tbl:t?t.id:null,r:t?t.trs.indexOf(tr):0};
      T.rows.set(tr,r);
    }
    // n: מספר התאים בשורה, גם הריקים — טבלה של טור אחד אינה שורת כותרות (הביקורת של 11.10)
    return {row:r.id,col:r.cells.indexOf(n),tbl:r.tbl,r:r.r,n:r.cells.length};
  }
  return null}
function flatten(doc,part,ctx){
  const out=[], T={rows:new Map(),tbls:new Map()};
  // SmartArt וגרפים כותבים פסקאות DrawingML (a:p), לא פסקאות Word
  const dml=/\/(diagrams|charts)\//.test(part);
  const counters=new Map();
  for(const p of doc.getElementsByTagNameNS(dml?DML:W,"p")){
    const els=[];ownText(p,els);
    let pos=0;const spans=[],ins=[];let txt="";
    for(const el of els){
      if(el.note){const t=ctx&&noteMark(el.note,ctx.notes);if(t)ins.push({at:pos,t});continue}
      if(el.sep!==undefined){spans.push({el:el.el,s:pos,e:pos+el.sep.length,sep:true});txt+=el.sep;pos+=el.sep.length;continue}
      const t=el.textContent||"";if(!t)continue;
      spans.push({el,s:pos,e:pos+t.length,attr:null});txt+=t;pos+=t.length}
    // גם פסקה ממוספרת ריקה לוקחת מספר, ולכן המונה מתקדם לפני הבדיקה אם יש בה טקסט
    const lead=ctx&&!dml&&!part.includes("glossary/")?numLead(p,ctx.num,counters):"";
    if(txt.trim()){const b={text:txt,spans,part,node:p};if(lead)b.lead=lead;if(ins.length)b.ins=ins;
      const cell=dml?null:cellOf(p,part,T); if(cell)b.cell=cell; out.push(b)}
  }
  // כל האלמנטים פעם אחת: שלוש הלולאות שלמטה עוברות על אותה רשימה
  const all=Array.from(doc.getElementsByTagName("*"));
  // תוויות בגרף: שם קטגוריה או סדרה במטמון המחרוזות
  // (גרף מורחב, chartEx, כותב את אותן תוויות כ-pt בתוך lvl)
  if(dml)for(const el of all){
    const p1=el.parentNode, ln=el.localName;
    const label=(ln==="v"&&p1&&p1.localName==="pt"&&p1.parentNode&&p1.parentNode.localName==="strCache")||
                (ln==="pt"&&p1&&p1.localName==="lvl");
    if(!label)continue;
    const t=el.textContent||"";if(t.trim())out.push({text:t,spans:[{el,s:0,e:t.length,attr:null}],part});
  }
  for(const el of all){
    const ln=el.localName;
    if(ln==="docPr"||ln==="cNvPr"){
      for(const a of ["descr","name","title"]){const v=el.getAttribute(a);
        if(v&&v.trim())out.push({text:v,spans:[{el,s:0,e:v.length,attr:a}],
          part:part+" (טקסט חלופי)"})}}
    // טקסט חלופי של טבלה: בודק הנגישות של Word מבקש אותו, ולכן הוא מתמלא (ביקורת H10)
    else if((ln==="tblCaption"||ln==="tblDescription")&&el.namespaceURI===W){
      const v=el.getAttribute("w:val");
      if(v&&v.trim())out.push({text:v,spans:[{el,s:0,e:v.length,attr:"w:val"}],part:part+" (טקסט חלופי)"})}
    // קוד שדה: HYPERLINK, REF, DOCPROPERTY. אינו טקסט שהיא רואה, אבל הוא יוצא עם הקובץ (H10)
    else if(ln==="instrText"&&el.namespaceURI===W){
      // רק קוד שיש בו עברית: PAGE, TOC ו-REF _Ref123 הם עשרות בלוקים ריקים מתוכן בכל מסמך
      const t=el.textContent||"";
      if(HEB_LETTER.test(t))out.push({text:t,spans:[{el,s:0,e:t.length,attr:null}],part:part+" (קוד שדה)"})}
    else if(ln==="fldSimple"&&el.namespaceURI===W){
      const v=el.getAttribute("w:instr");
      if(v&&HEB_LETTER.test(v))out.push({text:v,spans:[{el,s:0,e:v.length,attr:"w:instr"}],part:part+" (קוד שדה)"})}
    /* WordArt ישן (VML), בעיקר בקובץ .doc שהומר: הטקסט הוא מאפיין, לא ריצה, והוא נראה בעמוד
       כמו כל טקסט אחר — ולכן הוא בלוק רגיל שנסרק (שאר H10) */
    else if(ln==="textpath"&&el.namespaceURI===VML){
      const v=el.getAttribute("string");
      if(v&&v.trim())out.push({text:v,spans:[{el,s:0,e:v.length,attr:"string"}],part,label:true})}
    /* טקסט של מספור ("סעיף %1") ושם של סגנון: רק כשיש בהם עברית. אינם טקסט שהיא קוראת
       כמשפט, ולכן לא נסרקים לשמות חדשים, אבל שם מהרשימה מוחלף בהם (שאר H10) */
    else if((ln==="lvlText"||(ln==="name"||ln==="aliases")&&el.parentNode&&el.parentNode.localName==="style")&&el.namespaceURI===W){
      const v=el.getAttribute("w:val");
      if(v&&HEB_LETTER.test(v))out.push({text:v,spans:[{el,s:0,e:v.length,attr:"w:val"}],part:part+" (הגדרות עיצוב)"})}}
  /* עוד טקסט שאדם כותב ושנשמר כמאפיין ולא כריצה (הציד של 11.10): תמונה, צורה וקו חתימה בפורמט הישן
     (VML) — טקסט חלופי, כותרת והחותם המוצע; ScreenTip של קישור; שדה טופס — ברירת מחדל, עזרה ושורת
     מצב; הבחירות ברשימה נפתחת; ושם ותיאור של רכיב מהיר. אף שכבה לא קראה אותם: שם מהרשימה נשאר בקובץ
     והפס נצבע אדום בלי דבר לתקן במסך, ושם שלא ברשימה עבר בירוק. הם נקראים כמו טקסט חלופי וקוד שדה:
     מוחלפים, ואינם מועתקים ל-AI. בתמונה, שם פרטי ושם משפחה מוצעים לה (pair), כמו בטקסט חלופי. */
  const att=(el,a,v,sfx,pair)=>{if(v&&v.trim())out.push({text:v,spans:[{el,s:0,e:v.length,attr:a}],part:part+sfx,pair:!!pair})};
  for(const el of all){
    const ln=el.localName, ns=el.namespaceURI, up=el.parentNode;
    if(ns===VML||ns===O_NS){
      for(const a of Array.from(el.attributes))
        if(/^(?:alt|title|suggestedsigner2?|suggestedsigneremail|signinginstructions)$/.test(a.localName)&&(!a.namespaceURI||a.namespaceURI===O_NS))att(el,a.name,a.value," (טקסט חלופי)",true)}
    // ScreenTip של קישור על תמונה או צורה
    else if(ns===DML&&(ln==="hlinkClick"||ln==="hlinkHover"))att(el,"tooltip",el.getAttribute("tooltip")," (קוד שדה)");
    else if(ns===W){
      if(ln==="hyperlink")att(el,"w:tooltip",el.getAttribute("w:tooltip")," (קוד שדה)");
      else if((ln==="default"&&up&&up.localName==="textInput")||((ln==="helpText"||ln==="statusText")&&up&&up.localName==="ffData")||ln==="listEntry")
        att(el,"w:val",valW(el)," (קוד שדה)");
      else if(ln==="listItem"){att(el,"w:displayText",el.getAttribute("w:displayText")," (קוד שדה)");att(el,"w:value",el.getAttribute("w:value")," (קוד שדה)")}
      // רשימה נפתחת: הערך שנבחר בה אחרון (w:lastValue) — אחרת שם מהרשימה השאיר פס אדום בלי מה לתקן (הסקירה של 11.10)
      else if(ln==="dropDownList"||ln==="comboBox")att(el,"w:lastValue",el.getAttribute("w:lastValue")," (קוד שדה)");
      else if((ln==="name"||ln==="description")&&up&&up.localName==="docPartPr"&&HEB_LETTER.test(valW(el)||""))att(el,"w:val",valW(el)," (הגדרות עיצוב)")}}
  /* תיבת טקסט נכתבת פעמיים: הצורה (mc:Choice) וחלופה לתוכנות ישנות (mc:Fallback), ו-Word מציג רק את
     הראשונה. בלוק בחלופה שזהה לבלוק בצורה הוא אותו טקסט: הוא מקבל את אותן החלפות, ואינו מוצג, מועתק או
     נקרא שוב — הוא הגיע ל-AI פעמיים (הציד של 11.10). חלופה שכתוב בה דבר אחר נקראת כרגיל. */
  const twins=new Map(), nodeOf=b=>b.node||(b.spans[0]&&b.spans[0].el), kind=b=>(b.spans[0]&&b.spans[0].attr)||"";
  for(const b of out){const br=altBranch(nodeOf(b));if(br&&br.localName==="Choice"){const k=br.parentNode;if(!twins.has(k))twins.set(k,[]);twins.get(k).push(b)}}
  for(const b of out){
    const br=altBranch(nodeOf(b)); if(!br||br.localName!=="Fallback")continue;
    const l=twins.get(br.parentNode)||[];
    let i=l.findIndex(x=>x.text===b.text&&kind(x)===kind(b)); if(i<0)i=l.findIndex(x=>x.text===b.text);
    // WordArt: בצורה פסקה, בחלופה כיתוב של VML. הפסקה נבדקת מעכשיו כמו כיתוב
    if(i>=0){b.dupOf=l[i];if(b.label)l[i].label=true;l.splice(i,1)}}
  return out}
/* וכך גם SmartArt: הטקסט כתוב במודל הנתונים (dataN.xml) ושוב בציור המוכן שלו (drawingN.xml). בלוק של
   אחד מהם שזהה לבלוק של השני באותו תרשים הוא אותו טקסט — הראשון מבין השניים נקרא, השני מקבל את
   ההחלפות שלו. blocks: כל הבלוקים של החבילה, לפי הסדר. */
function twinParts(blocks){
  const open=new Map();
  for(const b of blocks){
    const m=/^word\/diagrams\/(data|drawing)(\d*)\.xml$/.exec(b.part); if(!m||b.dupOf)continue;
    const l=open.get(m[2]+"|"+(m[1]==="data"?"drawing":"data")+"|"+b.text);
    if(l&&l.length){b.dupOf=l.shift();continue}
    const k=m[2]+"|"+m[1]+"|"+b.text; if(!open.has(k))open.set(k,[]); open.get(k).push(b)}
  return blocks}
const HEB_LETTER=/[א-ת]/;
/* ── כתובות (הציד של 11.10) ──
   זהות יושבת גם בכתובת ולא רק במילים: יעד של קישור בכל חלק .rels (גוף, כותרות, הערות שוליים, הערות),
   כתובת בקוד שדה, והנתיב שממנו הגיעה תמונה. נוקו רק ארבע צורות (mailto:, file:, כונן, שיתוף רשת), ופרופיל
   בפייסבוק, מספר וואטסאפ, התיקייה של הלקוח ב-SharePoint ונתיב עם שם המשתמש יצאו עם הקובץ, רובם תחת פס
   ירוק, והשאלות הנפוצות מבטיחות שהקישורים מנוקים. הכלל: כתובת שאינה של האינטרנט (קובץ במחשב שלה, mailto:,
   tel:), אחסון פרטי, מפה, רשת חברתית או שירות הודעות עם נתיב — "#". כל כתובת אחרת מפוענחת ונקראת כמו
   טקסט, ומה שזוהה בה מוחלף במקומו; קישור ציבורי (נבו, gov.il, בית משפט) שלא זוהה בו דבר נשאר כמו שהוא. */
const SOCIAL_HOST=/(?:^|\.)(?:facebook\.com|fb\.com|fb\.me|m\.me|messenger\.com|fbcdn\.net|instagram\.com|instagr\.am|cdninstagram\.com|threads\.net|threads\.com|linkedin\.com|lnkd\.in|twitter\.com|x\.com|tiktok\.com|snapchat\.com|t\.me|telegram\.me|telegram\.dog|wa\.me|whatsapp\.com)$/;
const PRIVATE_HOST=/(?:^|\.)(?:sharepoint\.com|onedrive\.live\.com|onedrive\.com|1drv\.ms|drive\.google\.com|docs\.google\.com|dropbox\.com|dropboxusercontent\.com|box\.com|wetransfer\.com|we\.tl|icloud\.com|maps\.app\.goo\.gl|maps\.apple\.com|waze\.com)$/;
const YT_HOST=/(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/;
// מה שנראה כמו כתובת גם בלי הקשר: סכמה מוכרת, כונן, שיתוף רשת, www.
const ADDR_START=/^(?:(?:https?|ftp|file|mailto|tel|sms|callto|skype|whatsapp|tg|viber|onenote|ms-[a-z]+):|[A-Za-z][A-Za-z0-9+.-]*:\/\/|[A-Za-z]:[\\/]|\\\\|www\.)/i;
function dropParams(raw,names){
  const q=raw.indexOf("?"); if(q<0)return raw;
  const h=raw.indexOf("#",q), end=h<0?raw.length:h;
  const kept=raw.slice(q+1,end).split("&").filter(p=>p&&!names.includes(p.split("=")[0].toLowerCase()));
  return raw.slice(0,q)+(kept.length?"?"+kept.join("&"):"")+raw.slice(end)}
// מה הכתובת, בלי לקרוא אותה: null הוא "#"; אחרת הכתובת, אולי בלי פרמטר מזהה
function hostRule(raw){
  const t=String(raw||"").trim();
  if(!t||t[0]==="#")return raw;
  // כונן, שיתוף רשת, נתיב יחסי (קובץ במחשב שלה) וכל סכמה שאינה אינטרנט (mailto:, file:, tel:, sms:)
  if(/^[A-Za-z]:[\\/]/.test(t)||/^\\\\/.test(t))return null;
  const sm=/^([A-Za-z][A-Za-z0-9+.-]*):/.exec(t);
  if(sm?!/^(?:https?|ftp)$/i.test(sm[1]):!/^(?:\/\/|www\.)/i.test(t))return null;
  const u=/^(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\/([^/?#]*)|^(www\.[^/?#]*)/i.exec(t)||[""];
  const hp=(u[1]||u[2]||"").toLowerCase();
  // שם משתמש לפני השרת ("dana@host") הוא כניסה של אדם
  if(hp.includes("@"))return null;
  const host=hp.replace(/:\d+$/,"").replace(/\.$/,""), rest=t.slice(u[0].length), path=rest.split(/[?#]/)[0];
  // שרת ברשת המשרד: בלי נקודה, כתובת IP או סיומת פנימית
  if(!host.includes(".")||/^[\d.]+$/.test(host)||/\.(?:local|lan|internal|corp|intranet|home)$/.test(host))return null;
  if(PRIVATE_HOST.test(host)||/^maps\.google\./.test(host)||(/(?:^|\.)(?:google\.[a-z.]+|goo\.gl)$/.test(host)&&/^\/maps(?:[/?@]|$)/.test(path)))return null;
  if(SOCIAL_HOST.test(host))return /[^/]/.test(path)||/[?#]./.test(rest)?null:raw;
  if(YT_HOST.test(host)){
    if(/^\/(?:@|channel\/|c\/|user\/)/.test(path))return null;
    // הסרטון נשאר; מזהה השיתוף (si) ושם הערוץ (ab_channel) הולכים
    return dropParams(raw,["si","ab_channel"])}
  return raw}
/* כתובת של האינטרנט נקראת כמו טקסט: מפוענחת, כללי הכתובת וכל ערך שהוחלף במסמך רצים עליה, וכל פגיעה מוחלפת
   במקומה, מקודדת. פגיעה בשם השרת, או ערך שהבדיקה האחרונה הייתה מוצאת גם אחרי ההחלפה — "#". */
/* בכתובת שם מחובר גם בנקודה בין אותיות ("דנה.שגיא.pdf"), ותו בלתי נראה יכול להיות המפריד היחיד ("%E2%80%8F"
   במקום רווח): כל אלה נקראים כרווח (הסקירה של 11.10) */
const ADDR_JOIN=/[_+]|(?<=[א-ת])\.(?=[א-ת])/g;
function addrCtx(eng,applied,secrets,sweep){
  const lit=new Map();
  for(const r of applied)for(const v of [r.base||r.value,r.value]){
    const k=norm(String(v||"")).trim(); if(k.length>=2&&!lit.has(k))lit.set(k,String(r.baseRep||r.rep||""))}
  /* חלקי השם לבד, כמו שהמעבר על הטקסט מחליף אותם: משרדים קוראים לתיקייה ולקובץ בשם המשפחה קודם ("שגיא_דנה.pdf"),
     ושם הפוך לא נמצא בכתובת. חלק שהוא גם מילה נשאר לטקסט, שם הוא מוחלף רק לבד ולבדיקה */
  for(const [p,inf] of Object.entries(sweep||{})){const k=norm(p).trim(); if(inf&&!inf.wordy&&k.length>=2&&inf.rep&&!lit.has(k))lit.set(k,String(inf.rep))}
  // והשם המלא בסדר הפוך, עם הכינוי בסדר הפוך: גם כשחלק מהשם הוא גם מילה ("שגיא"), צמד החלקים הוא האדם
  for(const r of applied){
    if(!/^NAME/.test(r.type||""))continue;
    const w=norm(String(r.base||r.value||"")).trim().split(/\s+/), rw=String(r.baseRep||r.rep||"").trim().split(/\s+/);
    if(w.length<2||rw.length<2)continue;
    const rev=[w[w.length-1],...w.slice(0,-1)].join(" "), rrev=[rw[rw.length-1],...rw.slice(0,-1)].join(" ");
    if(!lit.has(rev))lit.set(rev,rrev)}
  const lits=[...lit].sort((a,b)=>b[0].length-a[0].length).map(([k,rp])=>[new RegExp(NW+flex(k)+NWE,"gu"),rp]);
  const sec=[...new Set(secrets.concat([...lit.keys()]).map(s=>norm(String(s||"")).trim()).filter(s=>s.length>=2))].map(secretTest);
  const names=new Set();
  // ב-query, + הוא רווח
  const view=d=>{const q=d.indexOf("?");return q<0?d:d.slice(0,q)+d.slice(q).replace(/\+/g," ")};
  // ds: אותה כתובת בכמה קריאות באותו אורך — עם "+" כרווח ב-query, וכמו שהיא, כי "+" במייל הוא חלק ממנו
  const hitsIn=(...ds)=>{
    const hs=[];
    for(const d of ds)for(const h of eng.detect(d,true))if(h.apply){
      // כתובת שעטופה בתוך query ("google.com/url?q=…&sa=D") נגמרת ב-& הבא
      const amp=/^URL_/.test(h.type)?d.indexOf("&",h.s):-1;
      hs.push([h.s,amp>h.s&&amp<h.e?amp:h.e,eng.repFor(h)]);if(h.src==="list")names.add(norm(h.base).trim())}
    const n=norm(ds[0]);
    for(const x of [n,n.replace(ADDR_JOIN," "),n.replace(ADDR_JOIN," ").replace(/\u0000/g," ")])for(const [rx,rp] of lits){rx.lastIndex=0;let m;while((m=rx.exec(x)))hs.push([m.index,m.index+m[0].length,rp])}
    hs.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
    const out=[];let last=-1;for(const h of hs)if(h[0]>=last){out.push(h);last=h[1]}
    return out};
  const leaks=d=>{const n=norm(d),nl=n.replace(ADDR_JOIN," "),n0=nl.replace(/\u0000/g," ");return sec.some(has=>has(n)||has(nl)||has(n0))};
  // שם מהרשימה בכתובת — גם בכתובת שכולה הפכה ל-"#" — נמצא במסמך, ואינו "לא מופיע במסמך"
  const seen=raw=>{for(const h of eng.detect(view(pctDecodeAll(String(raw)).d),true))if(h.src==="list")names.add(norm(h.base).trim())};
  const clean=raw=>{
    const c=hostRule(raw);
    if(c==null){seen(raw);return null}
    if(!c.trim()||c.trim()[0]==="#")return c;
    const dd=pctDecodeAll(c), d=view(dd.d), hs=hitsIn(d,dd.d);
    if(!hs.length)return leaks(d)?null:c;
    const lead=d.length-d.trimStart().length;
    const host=lead+(/^(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\/[^/?#]*|^www\.[^/?#]*/i.exec(d.trimStart())||[""])[0].length;
    if(hs.some(h=>h[0]<host))return null;
    let out=c;
    for(let i=hs.length-1;i>=0;i--){const [s,e,rp]=hs[i];out=out.slice(0,dd.map[s][0])+encodeURIComponent(rp)+out.slice(dd.map[e-1][1])}
    const r2=pctDecodeAll(out).d, d2=view(r2);
    return leaks(d2)||leaks(r2)||hitsIn(d2,r2).length?null:out};
  return {clean,seen,names}}
const xunesc=s=>s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi,(m,h,d,nm)=>h?String.fromCodePoint(parseInt(h,16)):d?String.fromCodePoint(+d):{amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[nm.toLowerCase()]);
/* יעד של כל קשר חיצוני בחלק .rels, מכל סוג (קישור, תמונה מקושרת, תבנית מצורפת), וכל יעד שנראה כמו מייל או
   נתיב גם כשאינו מסומן חיצוני. קשר פנימי (חלק בתוך החבילה) לא נוגעים בו */
function scrubRels(s,clean,found){
  return s.replace(/<(?:[\w.-]+:)?Relationship\b(?:[^>"']|"[^"]*"|'[^']*')*>/g,tag=>{
    const tm=/\bTarget=(?:"([^"]*)"|'([^']*)')/.exec(tag); if(!tm)return tag;
    const raw=xunesc(tm[1]!=null?tm[1]:tm[2]);
    // כתובת אינטרנט מלאה היא חיצונית גם כשהקשר לא מסומן כך (קובץ שכלי אחר כתב, הסקירה של 11.10); יעד פנימי הוא יחסי
    if(!/\bTargetMode=["']External["']/.test(tag)&&!/^(?:mailto:|file:|https?:|[A-Za-z]:\\|\\\\)/i.test(raw))return tag;
    const c=clean(raw);
    if(c===raw)return tag;
    found.push(raw);
    return tag.slice(0,tm.index)+'Target="'+XESC(c==null?"#":c)+'"'+tag.slice(tm.index+tm[0].length)})}
/* קוד שדה ש-Word פיצל לכמה ריצות ("mailto:dana" ואחריו ".sagi@…"): כל חתיכה נבדקה לבד, ומה שאחרי הפיצול
   יצא עם הקובץ (הציד של 11.10). החתיכות מתאחדות לראשונה. שדה שבתוך ההוראה שלו יש שדה אחר נשאר כמו שהוא */
function joinFields(doc){
  const stack=[];let n=0;
  for(const el of Array.from(doc.getElementsByTagNameNS(W,"*"))){
    const ln=el.localName;
    if(ln==="fldChar"){
      const t=el.getAttributeNS(W,"fldCharType")||el.getAttribute("w:fldCharType");
      if(t==="begin"){const top=stack[stack.length-1];if(top&&!top.sep)top.nested=true;stack.push({inst:[],sep:false})}
      else if(t==="separate"){if(stack.length)stack[stack.length-1].sep=true}
      else if(t==="end"){
        const f=stack.pop();
        if(!f||f.nested||f.inst.length<2)continue;
        const [h,...rest]=f.inst;
        h.textContent=f.inst.map(x=>x.textContent||"").join("");h.setAttributeNS(XMLNS,"xml:space","preserve");
        for(const x of rest){const r=x.parentNode;x.parentNode.removeChild(x);
          if(r&&r.localName==="r"&&r.parentNode&&Array.from(r.children).every(c=>c.localName==="rPr"))r.parentNode.removeChild(r)}
        n++}}
    else if(ln==="instrText"&&stack.length&&!stack[stack.length-1].sep)stack[stack.length-1].inst.push(el)}
  return n}
/* הכתובת בקוד שדה: הארגומנט הראשון של HYPERLINK, INCLUDEPICTURE ו-INCLUDETEXT, וכל ארגומנט שנראה כמו כתובת.
   נקראת עד המרכאה שסוגרת אותה: נתיב עם רווח ("My Pictures") נחתך ברווח, והשאר יצא */
const FIELD_ARG=/"((?:[^"\\]|\\.)*)"?|(\\[^\s"\\]*)|([^\s"]+)/g;
const SW_ARG=/^\\[olct*#@fs]$/i;
function fieldAddrs(instr,clean,found){
  let type="",first=true,swArg=false,changed=false;
  const out=String(instr).replace(FIELD_ARG,(m,q,sw,word)=>{
    if(sw!=null){swArg=SW_ARG.test(sw);return m}
    const v=q!=null?q.replace(/\\(.)/g,"$1"):word;
    if(!type){type=v.toUpperCase();return m}
    const pos=!swArg;swArg=false;
    // נתיב שהוקלד ביד בלוכסן אחד ("C:\Users") נבדק גם כמו שהוא
    const isAddr=(pos&&first&&/^(?:HYPERLINK|INCLUDEPICTURE|INCLUDETEXT)$/.test(type))||ADDR_START.test(v.trim())||ADDR_START.test((q??word).trim());
    if(pos)first=false;
    if(!isAddr)return m;
    const c=clean(v);
    if(c===v)return m;
    found.push(v);changed=true;
    return '"'+(c==null?"#":c).replace(/[\\"]/g,"\\$&")+'"'});
  return changed?out:instr}
function scrubFields(doc,clean,found){
  let n=0;
  const all=Array.from(doc.getElementsByTagNameNS(W,"*"));
  for(let i=0;i<all.length;i++){
    const el=all[i]; if(el.localName!=="instrText")continue;
    const t=el.textContent||"",o=fieldAddrs(t,clean,found);
    if(o!==t){el.textContent=o;el.setAttributeNS(XMLNS,"xml:space","preserve");n++;
      // עותק בינארי של הכתובת שבשדה (w:fldData, ב-base64, בתחילת השדה) הולך איתה: אחרת קוד השדה נוקה, והפרופיל
      // נשאר בקובץ בתוך הנתונים, והפס היה ירוק (הסקירה של 11.10)
      for(let k=i-1;k>=0;k--){const b=all[k];
        if(b.localName==="fldChar"&&(b.getAttributeNS(W,"fldCharType")||b.getAttribute("w:fldCharType"))==="begin"){
          for(const fd of Array.from(b.getElementsByTagNameNS(W,"fldData")))fd.parentNode.removeChild(fd);break}}}}
  for(const el of Array.from(doc.getElementsByTagNameNS(W,"fldSimple"))){
    const v=el.getAttribute("w:instr")||"",o=fieldAddrs(v,clean,found);
    if(o!==v){el.setAttribute("w:instr",o);n++}}
  /* קישור על תמונה או צורה ישנה (VML) יושב על האלמנט עצמו (href): בקובץ במצב תאימות, ובגיבוי (mc:Fallback) של
     תיבת טקסט מקושרת. הקשר המקביל נוקה, וזה נשאר בקובץ, והפס היה ירוק (הסקירה של 11.10) */
  for(const el of Array.from(doc.getElementsByTagNameNS(VML,"*"))){
    const v=el.getAttribute("href"); if(!v)continue;
    const c=clean(v); if(c===v)continue;
    found.push(v); el.setAttribute("href",c==null?"#":c); n++}
  return n}
/* הנתיב שממנו הגיעה תמונה, בטקסט החלופי או בכותרת שלה ("C:\Users\dana.sagi\Desktop\scan.jpg"), נושא את שם
   המשתמש במחשב ואת התיקיות (הציד של 11.10). נשאר שם הקובץ בלבד, ושאר הטקסט החלופי נסרק כרגיל */
const LOCAL_PATH=/(?:file:\/{2,3})?(?:(?<![A-Za-z0-9])[A-Za-z]:[\\/]|\\\\(?=[^\\\s])|(?<![\w.:/])\/(?:Users|home)\/)[^"<>|\r\n]*/g;
function scrubPaths(doc){
  let n=0;
  const fix=(v,set)=>{if(!v)return;LOCAL_PATH.lastIndex=0;if(!LOCAL_PATH.test(v))return;
    LOCAL_PATH.lastIndex=0;set(v.replace(LOCAL_PATH,p=>p.split(/[\\/]/).pop()));n++};
  for(const el of Array.from(doc.getElementsByTagName("*"))){
    const ln=el.localName;
    if(ln==="docPr"||ln==="cNvPr"){for(const a of ["descr","title","name"])fix(el.getAttribute(a),v=>el.setAttribute(a,v))}
    // תמונה ישנה (VML): טקסט חלופי, והכותרת של התמונה עצמה; ותמונה שהודבקה שומרת את הקובץ הזמני שממנו באה
    // (o:href, src: "file:///C:\Users\…\AppData\Local\Temp\…"), עם שם המשתמש (הסקירה של 11.10)
    else if(el.namespaceURI===VML){
      fix(el.getAttribute("alt"),v=>el.setAttribute("alt",v));
      fix(el.getAttribute("src"),v=>el.setAttribute("src",v));
      if(el.hasAttributeNS&&el.hasAttributeNS(O_NS,"title"))fix(el.getAttributeNS(O_NS,"title"),v=>el.setAttributeNS(O_NS,"o:title",v));
      if(el.hasAttributeNS&&el.hasAttributeNS(O_NS,"href"))fix(el.getAttributeNS(O_NS,"href"),v=>el.setAttributeNS(O_NS,"o:href",v))}
    // מיזוג דואר (settings.xml): מקור הנתונים והשאילתה שומרים את הנתיב המלא של קובץ הלקוחות, עם שם המשתמש
    else if(el.namespaceURI===W&&(ln==="connectString"||ln==="query"))fix(el.getAttributeNS(W,"val"),v=>el.setAttributeNS(W,"w:val",v))}
  return n}
/* נתון שהיא אינה רואה ואינה יכולה לסמן — משתני מסמך (docVars), וכותרת ותגית של פקד תוכן —
   אינו נסרק אלא מוסר. מערכות לניהול מסמכים שומרות שם את שם הלקוח ומספר התיק; כל עוד הערך
   הוחלף רק כשהיה ברשימה, שם שישב רק שם לא הוצע על ידי אף שכבה, נשאר בקובץ, והפס היה ירוק
   (ביקורת C2). הסרה אינה פוגעת במסמך: שלושתם רשות ב-OOXML.
   ועוד שלושה מאותו סוג (הציד של 11.10): קישור של פקד תוכן לנתונים (dataBinding) — הנתונים עצמם,
   customXml ומאפייני הקובץ, יוצאים או מתרוקנים, ופקד שנשאר קשור היה מחליף את הכינוי בריק כשהקובץ
   נפתח; הרשאת עריכה לאדם בשמו או בכתובת שלו (permStart w:ed); ומיזוג דואר, ששומר את הנתיב לקובץ
   הנתונים שלה ואת השאילתה שבחרה את הלקוח. */
const W15="http://schemas.microsoft.com/office/word/2012/wordml";
function stripHidden(doc){
  let n=0;const perm=new Set(), cut=el=>{el.parentNode.removeChild(el);n++};
  for(const el of Array.from(doc.getElementsByTagName("*"))){
    if(!el.parentNode)continue;
    const ln=el.localName, w=el.namespaceURI===W;
    if(w&&(ln==="docVars"||ln==="mailMerge"||((ln==="alias"||ln==="tag")&&el.parentNode.localName==="sdtPr")))cut(el);
    else if(ln==="dataBinding"&&(w||el.namespaceURI===W15))cut(el);
    else if(w&&ln==="permStart"&&el.getAttribute("w:ed")){perm.add(el.getAttribute("w:id"));cut(el)}}
  if(perm.size)for(const el of Array.from(doc.getElementsByTagNameNS(W,"permEnd")))if(el.parentNode&&perm.has(el.getAttribute("w:id")))cut(el);
  return n}
/* קורא אחד לטקסט של המסמך. שכבות ההצעה בממשק (המודל, הכותרת, הדוברים) והחלפת הערכים
   קראו את הקובץ כל אחת בדרכה, והראשונה לא ראתה הגדרות, SmartArt וגרפים שהשנייה ניקתה:
   שם שישב רק בתווית של גרף לא הוצע על ידי אף שכבה (ביקורת C2). מה שנחשב חלק עם טקסט
   מוכרע כאן פעם אחת. */
const isTextPart=n=>TEXTPART.test(n)||EXTRAPART.test(n);
// depth: מסמך Word שיובא בתוך מסמך (altChunk) נקרא באותו קורא, עד שתי רמות
async function readBlocks(buf,depth){
  const files=await unzip(buf); let blocks=[];
  await inlineChunks(files,depth||0);
  for(const f of files){
    if(!isTextPart(f.name))continue;
    const d=parseXML(TXT.decode(f.data));
    acceptTracked(d);
    if(TEXTPART.test(f.name))joinFields(d);
    stripHidden(d);scrubPaths(d);
    blocks=blocks.concat(flatten(d,f.name));}
  return twinParts(blocks).filter(b=>!b.dupOf)}
/* קטע מיובא (w:altChunk): מערכת שמפיקה מסמכים מכניסה פרק שלם כקובץ HTML, MHT, RTF, טקסט או Word,
   ו-Word מציג אותו כגוף הטקסט עד שמישהו שומר את המסמך מחדש. אף שכבה לא קראה אותו: שם, ת"ז וטלפון
   נשארו בקובץ, לא הוצגו ולא הועתקו, והפס היה ירוק (הציד של 11.10). הטקסט שלו נכתב כאן כפסקאות רגילות
   במקום שבו Word מציג אותו, והחלק עצמו יוצא מהקובץ: כך כל שכבה קוראת אותו, והוא מוחלף כמו כל טקסט.
   העיצוב שלו אינו נשמר. חלק שאי אפשר לקרוא יוצא בלי הטקסט שלו — עדיף על פרק שנשלח כמו שהוא.
   מחזיר את שמות החלקים שהוצאו. */
const R_NS="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
async function inlineChunks(files,depth){
  const gone=[];
  for(const f of files){
    if(!TEXTPART.test(f.name))continue;
    const s=TXT.decode(f.data); if(!s.includes("altChunk"))continue;
    const d=parseXML(s), els=Array.from(d.getElementsByTagNameNS(W,"altChunk")); if(!els.length)continue;
    const rf=files.find(x=>x.name===f.name.replace(/[^/]+$/,m=>"_rels/"+m+".rels")), rels=rf?[...TXT.decode(rf.data).matchAll(/<Relationship\b[^>]*>/g)].map(m=>m[0]):[];
    for(const el of els){
      const id=el.getAttributeNS(R_NS,"id")||el.getAttribute("r:id")||"";
      const rel=rels.find(x=>(/\bId="([^"]*)"/.exec(x)||[])[1]===id);
      let tg=rel&&!/TargetMode="External"/.test(rel)&&(/\bTarget="([^"]*)"/.exec(rel)||[])[1];
      if(tg)try{tg=decodeURIComponent(tg)}catch(_){/* כמו שהוא */}
      const name=tg?partPath(f.name,tg):null, cf=name&&files.find(x=>x.name===name);
      let lines=null; try{if(cf)lines=await chunkLines(cf.data,depth)}catch(_){lines=null}
      const up=el.parentNode;
      for(const t of lines||[]){
        const p=d.createElementNS(W,"w:p"),r=d.createElementNS(W,"w:r"),wt=d.createElementNS(W,"w:t");
        wt.setAttributeNS(XMLNS,"xml:space","preserve");wt.textContent=t.replace(XML_BAD,"");
        r.appendChild(wt);p.appendChild(r);up.insertBefore(p,el)}
      up.removeChild(el);
      // תא, תיבת טקסט או גוף שנשארו בלי פסקה מקבלים פסקה ריקה: Word אינו פותח אותם בלעדיה
      if(!Array.from(up.children).some(c=>c.localName==="p")){const last=up.children[up.children.length-1];
        up.insertBefore(d.createElementNS(W,"w:p"),last&&last.localName==="sectPr"?last:null)}
      if(name&&!gone.includes(name))gone.push(name)}
    f.data=ENC.encode(serXML(d,s))}
  return gone}
function partPath(from,tg){
  if(tg.startsWith("/"))return tg.slice(1);
  const out=from.split("/").slice(0,-1);
  for(const x of tg.split("/")){if(x==="..")out.pop();else if(x&&x!==".")out.push(x)}
  return out.join("/")}
// הטקסט של קטע מיובא, שורה לכל פסקה; null כשאי אפשר לקרוא אותו
async function chunkLines(u8,depth){
  if(u8[0]===0x50&&u8[1]===0x4b){
    if(depth>=2)return null;
    const bl=await readBlocks(u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength),depth+1);
    return bl.filter(b=>!hiddenPart(b.part)).map(b=>b.text)}
  const head=TXT.decode(u8.subarray(0,600));
  if(/^\s*\{\\rtf/.test(head))return rtfLines(u8);
  if(/^\s*MIME-Version:|^Content-Type:\s*multipart\//im.test(head))return mhtLines(u8);
  const t=textOf(u8);
  /* WordprocessingML כ-XML (Flat OPC, או מסמך גולמי): רק הטקסט שבתוך w:t ו-a:t, פסקה לשורה — לא התגיות, ולא נתונים
     בינאריים שבחבילה. וכל סימון אחר הוא HTML, לא רק html/body/p: קטע כמו <strong>, <span> או <ul><li> נכנס למסמך
     כטקסט, עם התגיות, ושם שבתוך תגית לא הוצע (הסקירה של 11.10) */
  if(/^\s*(?:<\?xml|<pkg:package|<w:document|<w:wordDocument)/i.test(t)&&/<(?:w|a):t[\s>]/.test(t)){
    const out=[];
    for(const para of t.split(/<\/(?:w|a):p>/)){
      const line=htmlLines([...para.matchAll(/<(?:w|a):t(?:\s[^>]*)?>([^<]*)<\/(?:w|a):t>/g)].map(m=>m[1]).join("")).join(" ");
      if(line)out.push(line)}
    return out}
  if(/<\/?[a-z][\w:.-]*[\s/>]/i.test(t))return htmlLines(t);
  if(/[\u0000-\u0008\u000E-\u001A]/.test(t.slice(0,4000)))return null;
  return t.split(/\r\n?|\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean)}
function textOf(u8){
  if(u8[0]===0xFF&&u8[1]===0xFE)return new TextDecoder("utf-16le").decode(u8.subarray(2));
  if(u8[0]===0xFE&&u8[1]===0xFF)return new TextDecoder("utf-16be").decode(u8.subarray(2));
  try{return new TextDecoder("utf-8",{fatal:true}).decode(u8)}catch(_){/* קידוד אחר */}
  try{return new TextDecoder("windows-1255").decode(u8)}catch(_){return TXT.decode(u8)}}
const ENT={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",ndash:"–",mdash:"—",lsquo:"‘",rsquo:"’",ldquo:"“",rdquo:"”",
  hellip:"…",shy:"",lrm:"\u200E",rlm:"\u200F",zwj:"",zwnj:"",bull:"•",middot:"·",laquo:"«",raquo:"»",times:"×"};
const fromCode=n=>{try{return String.fromCodePoint(n)}catch(_){return ""}};
function htmlLines(t){
  return t.replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|head|title|xml)\b[\s\S]*?<\/\1\s*>/gi,"")
    .replace(/<br\b[^>]*>/gi,"\n")
    .replace(/<\/?(?:p|div|li|tr|td|th|h[1-6]|table|tbody|thead|tfoot|ul|ol|dl|dd|dt|blockquote|section|article|header|footer|pre|hr|caption|center|address|body|html)\b[^>]*>/gi,"\n")
    .replace(/<[^>]*>/g,"")
    .replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g,(m,e)=>e[0]==="#"?fromCode(/^#x/i.test(e)?parseInt(e.slice(2),16):+e.slice(1)):ENT.hasOwnProperty(e.toLowerCase())?ENT[e.toLowerCase()]:m)
    .split("\n").map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean)}
// MHT: החלק הראשון שהוא HTML, בקידוד שלו (quoted-printable או base64)
function mhtLines(u8){
  const raw=TXT.decode(u8), b=(/boundary="?([^";\r\n]+)"?/i.exec(raw)||[])[1];
  for(const part of b?raw.split("--"+b):[raw]){
    const k=part.search(/\r?\n\r?\n/); if(k<0)continue;
    const head=part.slice(0,k), body=part.slice(k).replace(/^\r?\n\r?\n/,"");
    if(!/content-type:\s*text\/html/i.test(head))continue;
    const cs=(/charset="?([^";\s]+)/i.exec(head)||[])[1]||"utf-8", enc=(/content-transfer-encoding:\s*([\w-]+)/i.exec(head)||[])[1]||"";
    let bytes=null;
    if(/quoted-printable/i.test(enc)){const q=body.replace(/=\r?\n/g,"");bytes=[];
      for(let i=0;i<q.length;i++){if(q[i]==="="&&/^[0-9A-Fa-f]{2}$/.test(q.slice(i+1,i+3))){bytes.push(parseInt(q.slice(i+1,i+3),16));i+=2}else bytes.push(q.charCodeAt(i)&255)}}
    else if(/base64/i.test(enc))bytes=Array.from(globalThis.atob(body.replace(/[^A-Za-z0-9+/=]/g,"")),c=>c.charCodeAt(0));
    if(!bytes)return htmlLines(body);
    let dec;try{dec=new TextDecoder(cs)}catch(_){dec=TXT}
    return htmlLines(dec.decode(new Uint8Array(bytes)))}
  return null}
/* RTF: הטקסט בלבד. עברית כתובה בבייטים של דף הקוד (\'e0, ansicpg1255) או כ-\uN עם תו חלופי שמדלגים
   עליו; קבוצה שאינה טקסט (טבלת גופנים, צבעים, תמונה, \*) מדולגת; \par, \line, \cell — שורה חדשה. */
const RTF_SKIP=new Set(["fonttbl","colortbl","stylesheet","info","pict","object","listtable","listoverridetable","rsidtbl","generator",
  "xmlnstbl","themedata","colorschememapping","datastore","latentstyles","pgdsctbl","filetbl","revtbl","fldinst","header","headerl",
  "headerr","headerf","footer","footerl","footerr","footerf","footnote","annotation","atnauthor","nonshppict","shppict"]);
function rtfLines(u8){
  let s="";for(let i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);
  let dec;try{dec=new TextDecoder("windows-"+((/\\ansicpg(\d+)/.exec(s)||[])[1]||"1252"))}catch(_){dec=new TextDecoder("windows-1252")}
  const lines=[],ucs=[];let line="",bytes=[],depth=0,skip=0,uc=1,drop=0;
  const flush=()=>{if(bytes.length){line+=dec.decode(new Uint8Array(bytes));bytes=[]}};
  const put=t=>{if(!skip){flush();line+=t}};
  for(let i=0;i<s.length;){
    const c=s[i];
    if(c==="{"){depth++;ucs.push(uc);i++;const m=/^\\(\*|[a-z]+)/.exec(s.slice(i,i+32));if(!skip&&m&&(m[1]==="*"||RTF_SKIP.has(m[1])))skip=depth;continue}
    if(c==="}"){flush();if(skip===depth)skip=0;depth--;uc=ucs.length?ucs.pop():1;i++;continue}
    if(c==="\\"){
      const n=s[i+1];
      if(n==="'"){const b=parseInt(s.slice(i+2,i+4),16);i+=4;if(drop){drop--;continue}if(!skip&&!isNaN(b))bytes.push(b);continue}
      if(n==="\\"||n==="{"||n==="}"){i+=2;if(drop){drop--;continue}if(!skip)bytes.push(n.charCodeAt(0));continue}
      if(n==="~"){i+=2;put(" ");continue}
      if(n==="_"){i+=2;put("-");continue}
      const m=/^([a-z]+)(-?\d+)? ?/.exec(s.slice(i+1,i+48));
      if(!m){i+=2;continue}
      i+=1+m[0].length;
      const w=m[1],arg=m[2]==null?null:+m[2];
      if(/^(?:par|line|row|cell|sect|page)$/.test(w)){if(!skip){flush();lines.push(line);line=""}}
      else if(w==="tab")put(" ");
      else if(w==="u"&&arg!=null){put(String.fromCharCode(arg<0?arg+65536:arg));drop=uc}
      else if(w==="uc"&&arg!=null)uc=arg;
      else{const q={emdash:"—",endash:"–",lquote:"‘",rquote:"’",ldblquote:"“",rdblquote:"”",bullet:"•"}[w];if(q)put(q)}
      continue}
    i++;
    if(c==="\r"||c==="\n")continue;
    if(drop){drop--;continue}
    if(!skip)bytes.push(c.charCodeAt(0)&255)}
  flush();if(line)lines.push(line);
  return lines.map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean)}
// תו ש-XML אינו יכול לשמור (U+000B, תווי בקרה) אינו נכתב לקובץ: קובץ כזה אינו נפתח, גם לא בכלי עצמו
const XML_BAD=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
function setSpan(sp,v){
  v=String(v).replace(XML_BAD,"");
  if(sp.attr)sp.el.setAttribute(sp.attr,v);
  else{sp.el.textContent=v; if(v!==v.trim())sp.el.setAttributeNS(XMLNS,"xml:space","preserve")}}
function applyReps(blk,reps){
  if(!reps.length)return 0;
  reps.sort((a,b)=>a[0]-b[0]);
  const cl=[];let last=-1;
  for(const r of reps) if(r[0]>=last){cl.push(r);last=r[1]}
  for(let i=cl.length-1;i>=0;i--){
    const [s,e,nw]=cl[i];
    const touched=blk.spans.filter(sp=>sp.s<e&&sp.e>s);
    const w0=touched.findIndex(sp=>!sp.sep);
    if(w0<0)continue;
    touched.forEach((sp,ix)=>{
      // טאב או מעבר שורה בתוך הערך יוצאים איתו: הכינוי כתוב ברצף אחד
      if(sp.sep){ if(sp.el.parentNode)sp.el.parentNode.removeChild(sp.el); return; }
      const t=sp.attr?sp.el.getAttribute(sp.attr):sp.el.textContent;
      const ls=Math.max(s,sp.s)-sp.s, le=Math.min(e,sp.e)-sp.s;
      setSpan(sp, ix===w0 ? t.slice(0,ls)+nw+t.slice(le) : t.slice(0,ls)+t.slice(le));
    });}
  return cl.length}
/* קבלת השינויים היא "קבל הכול" של Word, ובלי מי שערך (הציד של 11.10). עד כאן נקלטו שישה אלמנטים
   בלבד: הסימנים שבתחילת קטע שהועבר ובסופו, תא שנוסף והפרדת תאים שמרו את שם העורך (שם לועזי עבר בפס
   ירוק, ושם עברי מהרשימה צבע אותו באדום בלי דבר לתקן); וסעיף שנמחק או הועבר במעקב השאיר אחריו פסקה
   ריקה עם מספר, כך שכל מספר סעיף אחריו בקובץ שלה היה גדול באחד מאשר במסמך המאושר. סימן פסקה שנמחק מחבר
   את הפסקה לזו שאחריה, כמו ב-Word; שורה שנמחקה יוצאת, וטבלה שלא נשארה בה שורה יוצאת איתה. */
const REV_MARK=/^(?:move(?:From|To)Range(?:Start|End)|customXml(?:Ins|Del|MoveFrom|MoveTo)Range(?:Start|End)|cell(?:Ins|Del|Merge)|tblGridChange)$/;
const BLOCK_MARK=new Set(["bookmarkStart","bookmarkEnd","commentRangeStart","commentRangeEnd","permStart","permEnd","proofErr"]);
function acceptTracked(doc){
  let ins=0,del=0,go=true;
  const wAll=()=>Array.from(doc.getElementsByTagName("*")).filter(e=>e.namespaceURI===W);
  // סימן הפסקה (w:pPr/w:rPr) ושורת טבלה (w:trPr) שנוספו או נמחקו: נרשמים לפני שהסימון יורד
  const goneP=[],goneTr=[];
  for(const el of wAll()){
    const ln=el.localName, up=el.parentNode;
    if(!up||!/^(?:ins|del|moveFrom|moveTo)$/.test(ln))continue;
    const gone=ln==="del"||ln==="moveFrom";
    if(up.localName==="rPr"&&up.parentNode&&up.parentNode.localName==="pPr"){const p=up.parentNode.parentNode;if(gone&&p&&p.localName==="p")goneP.push(p)}
    else if(up.localName==="trPr"){if(gone)goneTr.push(up.parentNode)}
    else continue;
    up.removeChild(el);gone?del++:ins++}
  while(go){go=false;
    for(const el of Array.from(doc.getElementsByTagName("*"))){
      const ln=el.localName;
      if((ln==="del"||ln==="moveFrom")&&el.namespaceURI===W){el.remove();del++;go=true;break}
      if((ln==="ins"||ln==="moveTo")&&el.namespaceURI===W){
        const p=el.parentNode;while(el.firstChild)p.insertBefore(el.firstChild,el);
        el.remove();ins++;go=true;break}}}
  for(const el of Array.from(doc.getElementsByTagNameNS(W,"delText")))el.remove();
  for(const el of Array.from(doc.getElementsByTagNameNS(W,"delInstrText")))el.remove();
  /* שינוי עיצוב במעקב (rPrChange, pPrChange וכו') שומר את העיצוב הקודם ואת שם מי שעשה
     אותו. קבלת השינוי היא מחיקת הרשומה; בלעדיה שם הכותב נשאר בקובץ (שכבה 1ב). */
  for(const el of wAll()){
    if(!el.parentNode)continue;
    if(/PrChange$|^numberingChange$/.test(el.localName)){el.parentNode.removeChild(el);del++}
    else if(REV_MARK.test(el.localName))el.parentNode.removeChild(el)}
  for(const tr of goneTr){const t=tr.parentNode;if(!t)continue;t.removeChild(tr);
    if(t.parentNode&&!Array.from(t.children).some(c=>c.localName==="tr"))t.parentNode.removeChild(t)}
  for(const p of goneP)if(p.parentNode)joinNext(p);
  return [ins,del]}
// פסקה שסימן הסוף שלה נמחק: התוכן שנשאר בה עובר לפסקה שאחריה. סוף של פרק, ופסקה אחרונה בתא או במסמך, נשארים
function joinNext(p){
  const pPr=kidW(p,"pPr");
  if(kidW(pPr,"sectPr"))return;
  let nx=p.nextSibling;while(nx&&(nx.nodeType!==1||BLOCK_MARK.has(nx.localName)))nx=nx.nextSibling;
  if(!nx||nx.localName==="sectPr")return;
  if(nx.localName==="p"&&nx.namespaceURI===W){
    const at=kidW(nx,"pPr")?kidW(nx,"pPr").nextSibling:nx.firstChild;
    for(const c of Array.from(p.childNodes))if(c!==pPr)nx.insertBefore(c,at);
    p.parentNode.removeChild(p);return}
  // לפני טבלה: פסקה שלא נשאר בה דבר יוצאת, ופסקה עם תוכן נשארת
  if(!Array.from(p.getElementsByTagName("*")).some(e=>e.localName==="r"&&Array.from(e.children).some(c=>c.localName!=="rPr")))p.parentNode.removeChild(p)}
/* חלקים שאינם גוף המסמך ובכל זאת נושאים טקסט שיוצא עם הקובץ (שכבה 1ב): משתני מסמך
   בהגדרות, צורות SmartArt, ותוויות וכותרות של גרפים. הספרייה המוטמעת של גרף
   (word/embeddings) אינה נקראת כאן; היא מדווחת כערוץ שלא נותח. לרכיבים המהירים (glossary) יש הגדרות,
   סגנונות ומספור משלהם, ובהם אותם משתני מסמך ושמות (הציד של 11.10). */
const EXTRAPART=/^word\/((?:glossary\/)?(?:settings|numbering|styles(?:WithEffects)?)\.xml|diagrams\/(data|drawing)\d*\.xml|charts\/chart(?:Ex)?\d*\.xml)$/;
/* שם סימנייה נשמר בקובץ ונראה בחלון "סימניות" של Word — וסימנייה נקראת לעתים על שם
   אדם ("רחל_פרידמן"). סימנייה עם אות עברית מקבלת שם ניטרלי, וכל הפניה אליה (קישור
   פנימי, שדה REF או PAGEREF) עוברת איתה, כך שההפניות ממשיכות לעבוד. */
function renameBookmarks(docsXml){
  const map=new Map();let n=0;
  for(const d of docsXml)for(const el of Array.from(d.getElementsByTagNameNS(W,"bookmarkStart"))){
    const v=el.getAttribute("w:name")||"";
    if(!/[א-ת]/.test(v))continue;
    if(!map.has(v))map.set(v,"_pib"+(++n));
    el.setAttribute("w:name",map.get(v));
  }
  if(!map.size)return 0;
  const swap=t=>{let o=t;for(const [a,b] of map)o=o.split(a).join(b);return o};
  for(const d of docsXml)for(const el of Array.from(d.getElementsByTagName("*"))){
    if(el.localName==="hyperlink"&&el.getAttribute("w:anchor"))el.setAttribute("w:anchor",swap(el.getAttribute("w:anchor")));
    else if(el.localName==="fldSimple"&&el.getAttribute("w:instr"))el.setAttribute("w:instr",swap(el.getAttribute("w:instr")));
    else if(el.localName==="instrText")el.textContent=swap(el.textContent||"");
  }
  return map.size}
function stripComments(doc){
  let n=0;const t=["commentRangeStart","commentRangeEnd","commentReference","annotationRef"];
  for(const el of Array.from(doc.getElementsByTagName("*")))
    if(t.includes(el.localName)){el.remove();n++}
  for(const r of Array.from(doc.getElementsByTagNameNS(W,"r")))
    if(!r.children.length||Array.from(r.children).every(c=>c.localName==="rPr"))r.remove();
  return n}
function stripRsid(doc){let n=0;
  for(const el of doc.getElementsByTagName("*")){
    for(const a of Array.from(el.attributes))
      if(/rsid/i.test(a.name)){el.removeAttributeNode(a);n++}}
  for(const el of Array.from(doc.getElementsByTagName("*")))
    if(/^rsids?$/.test(el.localName)){el.remove();n++}
  return n}

/* המעבר האחרון. חלק XML שהצינור אינו קורא — טבלת גופנים, ערכת נושא, חלק של תוכנה אחרת,
   חלק שעוד לא ראינו — ובו ערך מהרשימה, נכשל באימות, והיא לא יכלה לעשות דבר: הערך אינו
   במסמך שהיא רואה (שאר H10, כמשפחה ולא ערוץ אחרי ערוץ). כאן כל ערך מהרשימה שנשאר בחלק כזה
   מוחלף בכינוי שלו, ובלי כינוי ב"[הוסר]". מה שנשאר גם אחרי זה — שם שמפוצל בין תגיות, או
   בתוך קובץ מוטמע — האימות עדיין תופס, וזה נכון: שם הוא לא יכול לנקות. */
const XESC=v=>String(v).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;").split("'").join("&apos;");
// dateOut: לכל תאריך שהוחלף כאן, התאריך הבדוי שנכתב במקומו (הבדיקה האחרונה סופרת אותם, verify)
function residuePass(files,walked,subs,applied,dateOut){
  const repOf=new Map(), dateKey=new Set();
  const put=(v,r,d)=>{for(const k of [String(v||"").trim(),norm(String(v||"")).trim()]) if(k.length>=2&&!repOf.has(k)){repOf.set(k,r); if(d)dateKey.add(k)}};
  for(const r of applied)put(r.base||r.value,r.baseRep||r.rep||"",(CANON[r.type]||[r.type])[0]==="DATE");
  for(const s of subs)put(s.value,s.replacement||"[הוסר]",s.kind==="DATE");
  const vals=[...repOf.keys()].sort((a,b)=>b.length-a.length);
  const done=[];
  for(const f of files){
    if(walked.has(f.name)||!f.name.endsWith(".xml")||f.name==="[Content_Types].xml"||f.name==="docProps/core.xml"||f.name==="docProps/app.xml")continue;
    const o=TXT.decode(f.data); let s=o;
    for(const v of vals){
      const r=XESC(repOf.get(v)), d=dateOut&&dateKey.has(v);
      for(const form of new Set([v,XESC(v)]))
        s=s.replace(new RegExp("(?<![א-ת])"+esc(form)+"(?![א-ת])","gu"),()=>{if(d)dateOut.push(repOf.get(v)); return r});
    }
    if(s!==o){f.data=ENC.encode(s);done.push(f.name)}
  }
  return done}

// התאריך המלא הראשון שכתוב בטקסט, כ-YYYY-MM-DD, או null
function isoDateIn(s){
  const t=String(s||"").trim();
  for(const c of [t,...(t.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[בל]?-?[א-ת]+,?\s+\d{4}/g)||[])]){
    const p=parseDate(c); if(p&&p.y!=null)return p.y+"-"+String(p.m).padStart(2,"0")+"-"+String(p.d).padStart(2,"0")}
  return null}
async function redactDocx(buf,subs,allow,opt){
  const files=await unzip(buf);
  const rep={ins:0,del:0,cm:0,rsid:0,hidden:0,dropped:[],meta:[],rels:[],sweep:0};
  // קטע מיובא נכתב כפסקאות לפני הכול, והחלק שלו יוצא מהקובץ כמו כל חלק שהוסר
  const chunks=await inlineChunks(files,0);
  let keep=files.filter(f=>{
    // התמונה הממוזערת היא צילום של העמוד הראשון, עם כל מה שכתוב בו (ביקורת H10)
    if(DROP.includes(f.name)||/(?:^|\/)customxml\//i.test(f.name)||f.name.startsWith("docProps/thumbnail.")||chunks.includes(f.name)){rep.dropped.push(f.name);return false}
    return true});
  // הקישורים של חלק שהוסר (ההערות) הולכים איתו: בלעדיו נשארו בקובץ, יתומים (הציד של 11.10)
  {const gone=new Set(rep.dropped.map(n=>n.replace(/([^/]*)$/,"_rels/$1.rels")));keep=keep.filter(f=>!gone.has(f.name))}
  for(const f of keep){
    if(f.name.endsWith(".rels")||f.name==="[Content_Types].xml"){
      let s=TXT.decode(f.data);
      for(const d of rep.dropped){
        const b=d.split("/").pop().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        s=s.replace(new RegExp(`<Relationship[^>]*Target="[^"]*${b}"[^>]*/>`,"g"),"")
           .replace(new RegExp(`<Override[^>]*PartName="/${d.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"[^>]*/>`,"g"),"")}
      f.data=ENC.encode(s)}
    if(f.name==="docProps/core.xml"||f.name==="docProps/app.xml"){
      const o=TXT.decode(f.data),d=parseXML(o);
      for(const el of d.getElementsByTagName("*")){
        // HLinks: העתק של כתובות הקישורים, שהיא אינה רואה (הציד של 11.10)
        if(["creator","lastModifiedBy","title","subject","description","keywords",
            "category","Company","Manager","LastAuthor","Template","TitlesOfParts",
            "HeadingPairs","Application","HLinks"].includes(el.localName)){
          if(el.textContent.trim())rep.meta.push(el.localName+"="+el.textContent.trim());
          el.textContent="";while(el.firstChild)el.removeChild(el.firstChild)}
        if(el.localName==="revision")el.textContent="1";
        if(["created","modified"].includes(el.localName))el.textContent="1970-01-01T00:00:00Z";
        if(["totaltime","lastprinted","hyperlinkbase","identifier","contentstatus"]
            .includes(el.localName.toLowerCase())){
          if(el.textContent.trim())rep.meta.push(el.localName+"="+el.textContent.trim());
          el.textContent=""}}
      f.data=ENC.encode(serXML(d,o))}
  }
  const docs=[];
  for(const f of keep){
    if(!isTextPart(f.name))continue;
    const main=TEXTPART.test(f.name);
    const o=TXT.decode(f.data),d=parseXML(o);
    // שינוי במעקב נשמר גם בסגנונות ובהגדרות המספור, עם שם מי שעשה אותו
    {const [i,dl]=acceptTracked(d);rep.ins+=i;rep.del+=dl;}
    if(main){rep.cm+=stripComments(d);rep.rsid+=stripRsid(d);}
    rep.hidden+=stripHidden(d);
    // כתובת בקוד שדה: כבר כאן מה שיוצא כולו (מייל, נתיב, רשת חברתית); כתובת אינטרנט נקראת אחרי ההחלפה
    if(main){joinFields(d);scrubFields(d,hostRule,rep.rels)}
    scrubPaths(d);
    docs.push({f,doc:d,orig:o});
  }
  rep.bookmarks=renameBookmarks(docs.map(x=>x.doc));
  /* בורר תאריך (פקד תוכן) שומר את התאריך גם כנתון, w:fullDate, ו-Word פותח עליו את לוח השנה: התאריך
     המוזז הוצג, והאמיתי נשאר מאחוריו (הציד של 11.10). אחרי ההחלפה הנתון הוא מה שמוצג — התאריך המוזז,
     או כלום כשהתאריך נמחק. תאריך שלא השתנה נשאר כמו שהוא. */
  const wText=el=>Array.from(el.getElementsByTagNameNS(W,"t")).map(t=>t.textContent).join("");
  const picks=[];
  for(const dd of docs)for(const el of Array.from(dd.doc.getElementsByTagNameNS(W,"date"))){
    const sdt=el.parentNode&&el.parentNode.parentNode, c=kidW(sdt,"sdtContent");
    if(c&&el.getAttribute("w:fullDate"))picks.push({el,c,was:wText(c)})}
  // dateFakes: כל תאריך בדוי שנכתב, כמה פעמים שנכתב, לבדיקה האחרונה (verify)
  const applied=[],flagged=[],secrets=[],dateSecrets=[],dateFakes=[],placeSecrets=[];
  // יישוב שחזר מהתיק ומוחלף רק במופע שהוא מקום (cond, 07-engine.js): נבדק כמו יישוב ששכבת היישובים החליפה
  const condV=new Set(subs.filter(s=>s.cond&&s.kind==="PLACE"&&placeCond(norm(s.value).trim())).map(s=>norm(s.value).trim()));
  let blocks=[];
  for(const dd of docs) blocks=blocks.concat(flatten(dd.doc,dd.f.name));
  twinParts(blocks);
  const eng=new Engine(subs,allow,opt,blocks.map(b=>b.text).join("\n"));
  // ה-XML משתנה במקום, ולכן flatten אחרי ההחלפה מחזיר את הטקסט המושחר.
  // בלי צילום מראש, סורק הגוף מציע לה בחזרה את השמות הבדויים שהמצאנו.
  const ORIG=blocks.filter(b=>!b.dupOf).map(b=>({part:b.part,text:b.text,label:!!b.label,pair:!!b.pair}));
  // שם שתווית בתא או בפסקה שלידו מעידה עליו נבדק כמו שם שאחרי תווית באותה שורה (labelNext)
  const nextTo=new Map();
  for(const {i,h} of labelNext(blocks)){const l=nextTo.get(blocks[i])||[]; l.push(h); nextTo.set(blocks[i],l)}
  for(const blk of blocks){
    // החלופה של תיבת טקסט מקבלת בדיוק את ההחלפות של הצורה, ואינה נספרת שוב
    if(blk.dupOf){if(blk.dupOf.reps)applyReps(blk,blk.dupOf.reps.map(r=>r.slice()));continue}
    const hits=eng.detect(blk.text,false,nextTo.get(blk));if(!hits.length)continue;
    const reps=[];
    for(const h of hits){
      // ערך שנמצא בתוך כתובת מקודדת נרשם מפוענח, כמו שהיא קוראת אותו. type: הסוג נשמר עם התיק (currentKinds
      // בדף), כדי שתאריך, יישוב או גוף מתיק שנפתח לא יחזרו כאדם (הציד של 11.10)
      const rec={value:h.dtext||h.text,label:h.label,part:partName(blk.part),why:h.why,
        ctx:ctxHTML(blk.text,h.s,h.e),review:!!h.review,src:h.src,base:h.base||undefined,type:h.type};
      // הכינוי הבסיסי נרשם לפי הערך שברשימה, לא לפי הטקסט שנתפס: "לנרות מאירות"
      // אינו מפתח, ובלעדיו ההחזרה קיבלה "לגפן" ככינוי ואיבדה את "בגפן".
      // בתוך כתובת הכינוי נכתב מקודד, והכתובת נשארת כתובת
      if(h.apply){const nw0=eng.repFor(h), nw=h.enc&&nw0?encodeURIComponent(nw0):nw0;rec.rep=nw;
        const fam=(CANON[h.type]||[h.type])[0];
        rec.baseRep=eng.map[ckey(fam,h.base||h.text)]||eng.map[ckey(h.type,h.text)]||nw0;
        let s=h.s,e=h.e;
        // השמטה: הערך נמחק נקי. רווח אחד סמוך נבלע איתו, כדי ש"נסע ל-X ביום" לא
        // יישאר עם שני רווחים, ומה שנשאר נקרא כאילו הערך לא היה שם מעולם.
        if(nw===""){ rec.deleted=true; rec.rep="";
          if(blk.text[e]===" "&&(s===0||blk.text[s-1]===" "||/[\s(]/.test(blk.text[s-1]||" ")))e++;
          else if(blk.text[s-1]===" ")s--; }
        reps.push([s,e,nw]);applied.push(rec);
        // יישוב שהוא גם מילה או צירוף (placeCond) הוחלף רק במופע שהטקסט מראה שהוא מקום, והמופע שנשאל נשאר בכוונה.
        // האימות מחפש אותו רק במופע כזה: בחיפוש רגיל «נקודת מבט רעננה» נספרה דליפה של «גרה ברעננה», והפס האדום
        // חסם מסמך תקין
        if(h.src==="pattern"&&h.type==="PLACE_CITY"&&placeCond(h.place))placeSecrets.push(h.place);
        else if(h.src==="list"&&condV.has(norm(h.base||"").trim()))placeSecrets.push(norm(h.base).trim());
        else{
          // תאריך נבדק בסוף רק במקום שבו הוא תאריך (notDateAt), ולכן הוא ברשימה משלו
          const sec=(CANON[h.type]||[h.type])[0]==="DATE"?dateSecrets:secrets;
          sec.push(h.text);
          if(h.dtext)sec.push(h.dtext);
          if(h.base)sec.push(h.base);
          if(sec===dateSecrets&&nw)dateFakes.push(nw)}}
      else flagged.push(rec)}
    // מיקום המחיקות בטקסט החדש, לסימון במסך הבדיקה: הערך איננו, אבל היא צריכה לראות
    // שהיה שם משהו ולוכל לבטל. כל החלפה שלפני נקודה מזיזה אותה בהפרש האורכים.
    {const srt=reps.slice().sort((a,b)=>a[0]-b[0]); let shift=0; const dels=[];
     for(const [s,e,nw] of srt){ if(nw==="")dels.push({s:s-shift, val:blk.text.slice(s,e).trim()}); shift+=(e-s)-nw.length; }
     if(dels.length)blk.dels=dels;}
    blk.reps=reps.map(r=>r.slice());
    applyReps(blk,reps)}
  // מעבר אחידות: כל ערך שהוחלף (ארבע אותיות ומעלה) נסרק שוב בכל חלקי המסמך,
  // כדי שמופע שאף שכבה לא סימנה יקבל אותו תחליף ולא יישאר בטקסט.
  const sweep={};
  for(const r of applied){
    const v=norm(r.value).trim(), rp=r.baseRep||r.rep;
    // יישוב שהוא גם מילה או צירוף הוחלף רק במופע שהטקסט מראה שהוא מקום; במופע אחר זו המילה ("גרה ברעננה"
    // ו"נקודת מבט רעננה", הציד של 11.10). findPlaces כבר שקל כל מופע, והמעבר לא דורס את השאלה שהוא שאל
    if(r.label==="יישוב"&&r.src==="pattern"&&placeCond(norm(r.base||r.value).trim()))continue;
    if(r.src==="list"&&condV.has(norm(r.base||r.value).trim()))continue;
    // אם התחליף מכיל את הערך ("דוד" → "דוד א׳"), סריקה חוזרת
    // תתפוס את התחליף עצמו ותכפיל אותו.
    // תאריך שנמצא מוחלף גם במקום אחר, אבל לא כשהוא שם מספר סעיף או כמות ("סעיף 12.3", "3.5 ימים"; notDateAt)
    if(v.length>=4&&!(v in sweep)&&rp&&!norm(rp).includes(v))sweep[v]={rep:rp,of:null,date:r.label==="תאריך"||r.label==="DATE"};
  }
  // "החלפתי את תמר גולדשמיט, ובטקסט נשאר גולדשמיט לבד" — זו הדליפה
  // הכי שקטה שיש, כי חיפוש-והחלפה על השם המלא לא נוגע בו. כאן כל חלק
  // של שם שהוחלף נסרק בנפרד, ורק כשהוא חד-משמעי: שם משפחה שמשותף
  // לשני אנשים במסמך לא מוחלף אלא מסומן לבדיקה.
  const partOf=new Map();
  const docTokAll=new Set();
  for(const b of ORIG)for(const w of (norm(b.text).match(WRX)||[]))docTokAll.add(w);
  // "בחיים" הוא המילה, לא הבן אדם. חלק של שם שהוא גם מילה, או שמופיע
  // במסמך עם ה' הידיעה, מוחלף רק כשהוא עומד לבד — בלי אותיות שימוש —
  // ומסומן לבדיקה.
  // שלוש אותיות לבדן אינן הופכות חלק של שם למילה: "סבג" ו"דהן" אינם מילים,
  // ובלי אות שימוש הם דולפים ("וסבג" נשאר בטקסט). מילה של ממש נתפסת ברשימות
  // ובצורת ה' הידיעה שבמסמך; שתי אותיות נשארות זהירות.
  const wordy=p=>WORDLIKE.has(p)||COMMON.has(p)||docTokAll.has("ה"+p)||p.length<=2;
  /* חלק של שם שהוא גם יישוב, ששכבת היישובים רק שואלת עליו (placeOwn): «אלעד» מתוך «אלעד כהן» יצא לבד, ואפילו
     הפס אמר שהשמות הוחלפו (הציד של 11.10). שם פרטי שהוא יישוב (TOWNWORD מסוג name) הוא האדם בכל צורה; כל יישוב
     אחר — מילה, שם דו-משמעי, שם קצר, ושלומי — רק כשעומד לבד, ולבדיקה */
  const partWordy=p=>TOWNWORD.get(p)==="name"?false:(wordy(p)||!!PLACE_BY[p]||AMBIG.has(p));
  // "רחוב הארזים 12" הוחלף, ו"ההסעות מהארזים" נשאר בטקסט: שם הרחוב לבדו הוא
  // אותו מקום. כל כתובת, רחוב או שכונה שהוחלפו תורמים את המילים שאחרי סוג
  // הרחוב, ובלי המספר; כשהשם הוא גם מילה, רק כשעומד לבד ולבדיקה. חמש
  // מ-16 הדליפות בקורפוס היו בדיוק זה.
  const STREET_HEAD=/^(?:רחוב|רח'|שדרות|שד'|סמטת|סמטה|דרך|שכונת|כיכר|ככר|מעלה|נחל|משעול)\s+(.+?)(?:\s+\d.*)?$/u;
  for(const r of applied){
    const rp=r.baseRep||r.rep; if(!rp||rp==="███")continue;
    // הערך שנתפס עשוי לשאת אות שימוש ("ברחוב הגפן"); הבסיס של הכלל נקי ממנה
    const src=norm(r.base||r.value).trim();
    const m=STREET_HEAD.exec(src)||STREET_HEAD.exec(src.replace(/^[בהולמכש]/,"")); if(!m)continue;
    const nm=m[1].trim();
    if(nm.length<3||(nm in sweep)||STOP.has(nm)||PLACE_BY[nm]||norm(rp).includes(nm))continue;
    sweep[nm]={rep:rp,of:r.value,wordy:wordy(nm),place:true};
  }
  const regPart=(value,rp,label)=>{
    if(!rp||rp==="███")return;
    if(label&&!label.startsWith("שם"))return;
    const vw=norm(value).trim().split(/\s+/), rw=norm(rp).trim().split(/\s+/);
    const real=opt.mode==="real";
    const add=(p,to)=>{
      // שתי אותיות ("כץ", "נץ") הן שם משפחה של ממש; הן נכנסות למעבר, ובגלל wordy
      // מוחלפות רק כשעומדות לבד ולבדיקה. הסריקה: 2 כמו 3, 4 מוסיף שש דליפות.
      if(!p||p.length<2||STOP.has(p)||placeOwn(p))return;
      if(p in sweep||!to||norm(to).includes(p))return;
      const g=partOf.get(p)||{to:new Set(),of:new Set(),wordy:partWordy(p)};
      g.to.add(to); g.of.add(value); partOf.set(p,g)};
    /* שם משפחה כפול במקף ("לוי-אבקסיס", גם במקף עברי): כל חצי לבד הוא אותו אדם — «לדברי אבקסיס», «גם לוי
       אמרה» — ושניהם דלפו (הציד של 11.10). כל חצי מקבל את החצי שלו מהבדוי כשגם הוא כפול, ואחרת את כולו */
    const dbl=(w,rs)=>{
      const hv=w.split("-").filter(Boolean); if(hv.length<2)return;
      const rh=real?String(rs).split("-").filter(Boolean):[];
      hv.forEach((h,i)=>add(h,real?(rh.length===hv.length?rh[i]:rs):rp));
    };
    if(vw.length<2){ dbl(vw[0],real?rw[rw.length-1]:rp); return; }
    // השם הפרטי לבד: במצב real (שם בדוי) הוא מקבל את השם הפרטי של הבדוי, ובמצבים
    // האחרים (תווית, השחרה) את התחליף כולו, כי אין בו שם פרטי נפרד
    add(vw[0],real?rw[0]:rp);
    // שם המשפחה כולו ("לב שדה", "בן דוד") והמילה האחרונה לבד
    const sur=vw.slice(1).join(" "), rsur=real?rw.slice(1).join(" "):rp;
    add(sur,rsur);
    if(vw.length>2)add(vw[vw.length-1],real?rw[rw.length-1]:rp);
    dbl(vw[vw.length-1],real?rw[rw.length-1]:rp);
  };
  // החלקים נגזרים מהערך שברשימה, לא מהצורה שנתפסה: "למרים לוין" תרם "למרים" כחלק
  for(const r of applied) regPart(r.base||r.value,r.baseRep||r.rep,r.label);
  // גם שמות מהפרופיל שלא הופיעו במלואם במסמך הזה: סיכום פגישה מזכיר
  // "גולדשמיט" לבד, בלי "תמר גולדשמיט" בשום מקום, וזה עדיין אותה אישה.
  for(const s of subs) if(s.kind==="NAME")
    regPart(s.value,s.replacement||eng.map[ckey("NAME",s.value)],null);
  const partAmbig=[];
  for(const [p,g] of partOf){
    if(g.to.size>1){partAmbig.push({p,of:[...g.of]});continue}
    sweep[p]={rep:[...g.to][0],of:[...g.of][0],wordy:g.wordy};
  }
  let blocks2=[];for(const dd of docs)blocks2=blocks2.concat(flatten(dd.doc,dd.f.name));
  twinParts(blocks2);
  /* כינוי שכבר נכתב אינו טקסט של המסמך, והסריקה לא נוגעת בו (סבב QA 1, M1). כינוי שהיא הקלידה
     ושהוא שם של אדם אמיתי אחר במסמך הוחלף שוב, בכינוי של האדם האחר — שרשרת — וכך גם כינוי
     שמכיל שם משפחה אמיתי של מישהו אחר */
  const pseudoWritten=[...new Set(applied.map(r=>norm(String(r.rep||"")).trim()).filter(w=>w.length>=2))];
  // הבדיקה המהירה רופפת כמו התבנית שאחריה (flex): "בן עמיאל" ברווח הוא "בן-עמיאל" שברשימה, וניקוד בין
  // האותיות אינו מפריד. בבדיקה המדויקת שם המשפחה של שולח בשיחה נשאר בטקסט (הציד של 11.10)
  const loose=s=>s.replace(/\u0000/g,"").replace(/[\s-]+/g," ");
  for(const blk of blocks2){
    if(blk.dupOf){if(blk.dupOf.reps)applyReps(blk,blk.dupOf.reps.map(r=>r.slice()));continue}
    // nl: בלי התווים שהקורא לא רואה (ניקוד, מקף רך, סימני כיוון). הסינון המהיר רץ עליו: על n, חלק של שם
    // שבתוכו תו כזה נפסל לפני שהביטוי (flex, שמדלג עליהם) הספיק לראות אותו, והחלק דלף (הציד של 11.10)
    const n=norm(blk.text),nl=loose(n),reps=[];
    const zones=[];
    for(const rx0 of eng.allow){rx0.lastIndex=0;let z;
      while((z=rx0.exec(n)))zones.push([z.index,z.index+z[0].length])}
    for(const w of pseudoWritten){let i=n.indexOf(w);
      while(i>=0){zones.push([i,i+w.length]);i=n.indexOf(w,i+1)}}
    for(const [o,inf] of Object.entries(sweep)){
      if(!nl.includes(loose(o)))continue;
      const nw=inf.rep;
      // חלק של שם מופיע בעברית עם אות שימוש ("לגולדשמיט"), ולכן
      // הסריקה חייבת לקלוט אותה ולהחזיר אותה לתחליף.
      const rx=inf.of&&!inf.wordy
        ? new RegExp(NW+"([בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+flex(o)+NWE,"gu")
        : new RegExp(NW+"()"+flex(o)+NWE,"gu");
      let m;
      while((m=rx.exec(n))){
        const s=m.index,e=s+m[0].length;
        if(zones.some(([a,b])=>a<=s&&e<=b))continue;
        if(inf.date&&notDateAt(n,s,e))continue;
        const out=inf.of?addPre(m[1]||"",nw):nw;
        reps.push([s,e,out]); if(inf.date)dateFakes.push(out);
        applied.push({value:blk.text.slice(s,e),type:inf.place?"PLACE":"NAME",
          label:inf.of?(inf.place?"מקום (חלק)":"שם (חלק)"):"הופעה נוספת",part:partName(blk.part),
          why:inf.of?(inf.place
                ?(inf.wordy?`שם הרחוב מתוך «${inf.of}» — אבל גם מילה. הוחלף רק כשעומד לבד; ודאו שזה המקום`
                           :`שם הרחוב מתוך «${inf.of}» שכבר הוחלף, ומופיע כאן לבד`)
                :inf.wordy
                ?`חלק מהשם «${inf.of}» — אבל גם מילה. הוחלף רק כשעומד לבד; ודאו שזה האדם`
                :`חלק מהשם «${inf.of}» שכבר הוחלף, ומופיע כאן לבד`)
                    :"אותו ערך זוהה במקום אחר במסמך, אז הוחלף גם כאן",
          // חלק חד-משמעי של שם מהרשימה (שלוש אותיות ומעלה, לא מילה) מוחלף בלי
          // לבקש אישור (Q5 בגרסה 5): השם המלא ברשימה הוא ההחלטה שלה על האדם הזה.
          // חלק קצר, או שהוא גם מילה, נשאר לבדיקה — שם גרות ההחלפות השגויות.
          ctx:ctxHTML(blk.text,s,e),review:!!inf.of&&!!inf.wordy,rep:out,baseRep:nw,base:o,of:inf.of||undefined,src:"sweep"})}}
    blk.reps=reps.map(r=>r.slice());
    rep.sweep+=applyReps(blk,reps)}
  for(const c of eng.collided){
    flagged.push({value:c.rep,label:"שם בדוי שגם מופיע במסמך",part:"המסמך",review:true,src:"collide",collideOf:c.value,
      why:`«${c.value}» הוחלף ב«${c.rep}» כפי שבחרתם, אבל «${c.rep}» הוא גם אדם אמיתי במסמך הזה, `+
          `ושני האנשים ייראו כאחד. אפשר לבחור תחליף אחר בכרטיס של «${c.value}», או להוסיף לרשימה את האדם האמיתי בשם «${c.rep}»`,
      ctx:""});
  }
  for(const pa of partAmbig){
    const hit=blocks2.find(b=>new RegExp(NW+esc(pa.p)+NWE,"u").test(norm(b.text)));
    if(!hit)continue;
    const nb=norm(hit.text), mm=new RegExp(NW+esc(pa.p)+NWE,"u").exec(nb);
    flagged.push({value:pa.p,label:"שם משותף",part:partName(hit.part),
      why:`מופיע לבד, ומשותף ליותר מאדם אחד (${pa.of.join(", ")}) — לא הוחלף אוטומטית`,
      ctx:ctxHTML(hit.text,mm.index,mm.index+pa.p.length),review:true,src:"partAmbig"});
  }
  /* כתובות (הציד של 11.10): יעד של כל קשר בכל חלק .rels, וכתובת אינטרנט בקוד שדה, נקראים אחרי ההחלפה,
     עם הכינויים שכבר נבחרו ומול אותם ערכים שהבדיקה האחרונה מחפשת */
  const vsec=secrets.concat(subs.flatMap(s=>s.kind==="NAME"?variants(s.value,opt.prefixes||"normal").map(v=>v[0]):[s.value]));
  const ac=addrCtx(eng,applied,vsec.concat(dateSecrets),sweep);
  /* כתובת מקודדת שהוקלדה בטקסט עצמו — לא בקישור — עוברת את אותו ניקוי: שם הפוך או מחובר בנקודה ("שגיא_דנה.pdf",
     "דנה.שגיא") לא נמצא בה, והגיע ל-AI (הסקירה של 11.10). הטקסט כבר אחרי ההחלפות, אז מה שנשאר בה הוא מה שהן פספסו */
  {let blocks3=[];for(const dd of docs)blocks3=blocks3.concat(flatten(dd.doc,dd.f.name));
   for(const blk of blocks3){
     if(!/%[0-9A-Fa-f]{2}/.test(blk.text))continue;
     // הכתובת יכולה להיות דבוקה לאות שימוש ומקף ("נשמר ב-https://…"): מחפשים את תחילתה בתוך הטקסט
     const reps=[],rx=/(?:https?:\/\/|www\.|file:)[^\s"<>]+|(?<![A-Za-z0-9])[A-Za-z]:\\[^\s"<>|]+|\\\\[^\s"<>|]+/gi;let m;
     while((m=rx.exec(blk.text))){
       const tok=m[0].replace(/[.,;:!?)\]»"']+$/,"");
       if(!/%[0-9A-Fa-f]{2}/.test(tok))continue;
       const c=ac.clean(tok); if(c===tok)continue;
       reps.push([m.index,m.index+tok.length,c==null?"#":c]); rep.rels.push(tok)}
     if(reps.length)applyReps(blk,reps)}}
  for(const dd of docs)if(TEXTPART.test(dd.f.name))scrubFields(dd.doc,ac.clean,rep.rels);
  for(const f of keep)if(f.name.endsWith(".rels")){const s=TXT.decode(f.data),o=scrubRels(s,ac.clean,rep.rels);if(o!==s)f.data=ENC.encode(o)}
  for(const x of picks){
    const now=wText(x.c); if(now===x.was)continue;
    const iso=isoDateIn(now), full=x.el.getAttribute("w:fullDate");
    if(iso)x.el.setAttribute("w:fullDate",iso+full.slice(10)); else x.el.removeAttribute("w:fullDate")}
  for(const dd of docs) dd.f.data=ENC.encode(serXML(dd.doc,dd.orig));
  rep.residue=residuePass(keep,new Set(docs.map(d=>d.f.name)),subs,applied,dateFakes);
  /* מי שערך: w:author ו-w:initials שנשארו בחלק כלשהו — גם בחלק שהכלי אינו קורא, כמו הסגנונות של רכיבים
     מהירים — מתרוקנים. קבלת השינויים מוחקת את הרשומות עצמן; זו הרשת שמתחתיה (הציד של 11.10). */
  for(const f of keep){
    if(!f.name.endsWith(".xml"))continue;
    const o=TXT.decode(f.data), s=o.replace(/(\s[\w.-]+:(?:author|initials))="[^"]*"/g,'$1=""');
    if(s!==o)f.data=ENC.encode(s)}

  // התצוגה המקדימה: סימון כל תחליף על הטקסט שאחרי ההחלפה. תחליף שעומד ליותר
  // מערך אחד, או שהופיע כבר במקור, מסומן כדו-משמעי.
  const origAll=blocks.map(b=>b.text).join("\n");
  const repVals={};
  for(const r of applied){ if(!r.rep)continue;
    (repVals[r.rep]=repVals[r.rep]||new Set()).add(r.value); }
  const ambiguous=new Set(Object.keys(repVals).filter(rp=>
    repVals[rp].size>1 || origAll.includes(rp)));
  const ids={};applied.forEach((r,i)=>{if(r.rep&&!(r.rep in ids))ids[r.rep]=i});
  const preview=[];
  // התצוגה והטקסט שמועתק כוללים את מה ש-Word מוסיף בעצמו: מספרי סעיפים וסימני הערות
  const ctx=wordCtx(n=>{const x=docs.find(d=>d.f.name===n);return x?x.doc:null});
  let blocks3=[];for(const dd of docs)blocks3=blocks3.concat(flatten(dd.doc,dd.f.name,ctx));
  twinParts(blocks3);
  // שאלה של שכבת היישובים על מילה שהמעבר החליף כחלק של שם מהרשימה ("אלעד" מתוך «אלעד כהן»): כשלא נשאר ממנה
  // מופע, אין על מה להחליט, ואישור שלה היה הופך את האדם ליישוב בריצה הבאה
  {const fin=norm(blocks3.map(b=>b.text).join("\n"));
   for(let i=flagged.length-1;i>=0;i--){
     const f=flagged[i], v=norm(String(f.value||"")).trim(), sw=sweep[v];
     if(f.src!=="pattern"||f.type!=="PLACE_CITY"||!sw||!sw.of||sw.place)continue;
     if(!new RegExp(NW+"(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+flex(v)+NWE,"u").test(fin))flagged.splice(i,1);
   }}
  // פריט שנשאר לבדיקה אינו מסומן במסמך, ולכן הוא נראה בדיוק כמו טקסט שאיש לא נגע בו.
  // על מספר זה קטלני: מספר שנשאר בטקסט נקרא "הכלי פספס אותו", בעוד שבפועל הוא נמצא,
  // הוחלט שלא להחליף אותו אוטומטית, והוא מחכה להחלטה. סימון בצבע אזהרה אומר את זה.
  // "לא נמצא" ו"התנגשות פרופיל" אינם מוטבעים בטקסט ולכן אינם מסומנים.
  const flagVals=[...new Set(flagged.filter(r=>r.src!=="nohit"&&r.src!=="collide"&&r.value)
    .map(r=>String(r.value)).filter(v=>v.length>=2))];
  // המחיקות נרשמו על הבלוקים המקוריים; blocks3 הוא אותם בלוקים אחרי ההחלפה, באותו סדר
  const delsByIdx=blocks.map(b=>b.dels||[]);
  let bi3=-1;
  for(const blk of blocks3){
    bi3++;
    if(blk.dupOf)continue;
    const marks=[];
    for(const d of delsByIdx[bi3]||[]) marks.push({s:d.s,e:d.s,del:true,val:d.val});
    for(const [rp,id] of Object.entries(ids)){
      if(!rp||!blk.text.includes(rp))continue;
      let i=0;while((i=blk.text.indexOf(rp,i))>=0){marks.push({s:i,e:i+rp.length,id,amb:ambiguous.has(rp)});i+=rp.length}}
    for(const fv of flagVals){
      if(!blk.text.includes(fv))continue;
      let i=0;while((i=blk.text.indexOf(fv,i))>=0){marks.push({s:i,e:i+fv.length,flag:true,val:fv});i+=fv.length}}
    // החלפה גוברת על סימון לבדיקה כשהשניים חופפים
    marks.sort((a,b)=>a.s-b.s||(a.flag?1:0)-(b.flag?1:0));
    const kp=[];let last=-1;for(const m of marks)if(m.s>=last){kp.push(m);last=m.e}
    const sh=shown(blk);
    preview.push({part:partName(blk.part),text:sh.text,marks:sh.text===blk.text?kp:kp.map(m=>({...m,s:sh.at(m.s,false),e:m.del?sh.at(m.s,false):sh.at(m.e,true)}))});}

  // סריקת שיבושים על הפלט, לא על המקור: כל מה שדומה לשם שהוחלף ובכל זאת
  // שרד את ההחלפה — הוא בדיוק מה שהיה יוצא החוצה בלי שאף אחד ישים לב.
  let near=[], nearOf=null;
  if(opt.near!==false){
    const tset=new Map();
    for(const r of applied){
      const base=r.base||r.value; if(!base)continue;
      if(r.label==="הופעה נוספת")continue;
      if(!["שם","יישוב","מקום","מוסד חינוך","מוסד אקדמי","מוסד רפואי","עסק","גוף","מוסד","כתובת","פרט"]
         .includes(r.label)&&!r.label.startsWith("שם")&&!r.label.startsWith("גוף"))continue;
      const nv=norm(base).trim();
      if(!tset.has(nv))tset.set(nv,{value:base,norm:nv,words:nv.split(/\s+/).length,
        rep:r.baseRep||r.rep,kind:"NAME"});
    }
    for(const [p,g] of partOf){
      if(g.to.size!==1||tset.has(p))continue;
      tset.set(p,{value:p,norm:p,words:1,rep:[...g.to][0],kind:"NAME"});
    }
    for(const s of subs){
      const nv=norm(s.value).trim();
      if(!tset.has(nv))tset.set(nv,{value:s.value,norm:nv,words:nv.split(/\s+/).length,
        rep:s.replacement||eng.map[ckey(s.kind,s.value)]||"",kind:s.kind});
    }
    const banned=new Set();
    for(const r of applied){if(r.rep){const nr=norm(r.rep).trim();banned.add(nr);
      for(const w of nr.split(/\s+/))banned.add(w)}}
    for(const t of tset.values())banned.add(t.norm);
    for(const a of (allow||[]))banned.add(norm(a).trim());
    let blocksN=[];for(const dd of docs)blocksN=blocksN.concat(flatten(dd.doc,dd.f.name));
    twinParts(blocksN);
    const targets=[...tset.values()];
    near=findNear(blocksN.filter(b=>!b.dupOf&&!notProse(b.part)),targets,banned);
    nearOf=near.of>near.read?{read:near.read,of:near.of}:null;
    for(const nm of near)flagged.push(nm);
  }

  // שם מהרשימה שלא נמצא אפילו פעם אחת: או שהוא לא במסמך הזה, או שהוא
  // כתוב אחרת. שתיקה כאן משאירה אותה בטוחה שטופל.
  // גם ממצא שסומן לבדיקה הוא הופעה: שם קצר שמופיע רק עם אות שימוש ("והדס") מסומן
  // ולא מוחלף, וקודם דווח במקביל גם כ"לא מופיע במסמך הזה בכלל" — שתי אמירות סותרות
  // על אותו שם.
  const hitBases=new Set(applied.map(r=>norm(r.base||r.value).trim()));
  for(const r of flagged) if(r.src==="list"&&r.base) hitBases.add(norm(r.base).trim());
  // שם בתוך כתובת — יעד של קישור, או כתובת שהוסרה מהטקסט כולה (SharePoint) — הוא במסמך (הציד של 11.10)
  for(const r of applied) if(/%[0-9A-Fa-f]{2}|:\/\/|^www\./i.test(r.value)) ac.seen(r.value);
  for(const b of ac.names) hitBases.add(b);
  // יישוב מהתיק שכל מופעיו כאן נשאלו (cond): הוא במסמך, ולא "לא נמצא"
  for(const r of flagged) if(r.src==="pattern"&&r.base&&condV.has(norm(r.base).trim())) hitBases.add(norm(r.base).trim());
  const nearTargets=new Set(near.map(x=>norm(x.near.target).trim()));
  for(const s of subs){
    if(s.kind!=="NAME"&&s.kind!=="ORG"&&s.kind!=="PLACE")continue;
    const nv=norm(s.value).trim();
    if(hitBases.has(nv)||eng.alias[s.value])continue;
    const nearHit=near.find(x=>norm(x.near.target).trim()===nv);
    flagged.push({value:s.value,label:"לא נמצא",part:"המסמך",review:true,src:"nohit",ctx:"",
      why:nearHit?`לא מופיע במסמך בכתיב הזה, אבל נמצא «${nearHit.value}» — ראו למעלה`
                 :"לא מופיע במסמך הזה בכלל. אם זה שם מהתיק — בסדר; אם ציפיתם שיימצא, בדקו כתיב"});
  }
  const blob=await zip(keep);
  const outBuf=await blob.arrayBuffer();
  // שם שלא נמצא אינו דליפה — הוא מוצג ב«לבדיקה» אבל לא צובע את הבר
  const remaining=[...new Set(flagged.filter(r=>r.src!=="near"&&r.src!=="nohit").map(r=>r.value))];
  const dsubs=new Set(subs.filter(s=>s.kind==="DATE").map(s=>s.value));
  const ver=await verify(outBuf,vsec.filter(v=>!dsubs.has(v)&&!condV.has(norm(v).trim())),dateSecrets.concat([...dsubs]),dateFakes,
    placeSecrets.concat([...condV]));
  ver.hadList=subs.length>0;
  ver.remaining=remaining;
  ver.near=near;
  // הרשת האחרונה: שם שהיא לא רשמה, שיושב בגוף הטקסט ולא נגענו בו.
  // לא מחליפים אותו מאחורי גבה — שואלים.
  /* שכבה שנשברה אינה שכבה שלא מצאה כלום (ביקורת M25). סריקה שזרקה השאירה רשימה ריקה,
     והפס נעשה ירוק. עכשיו התוצאה אומרת איזו שכבה לא הסתיימה, והמסך מציג את זה. */
  const incomplete=[];
  if(nearOf){incomplete.push("near");ver.nearOf=nearOf}
  let suggest=[];
  try{
    if(opt.body===false)throw {skip:1};
    const known=[...subs.map(s=>s.value),...(allow||[]),
      ...applied.map(r=>r.base||r.value),...applied.map(r=>r.baseRep||r.rep)];
    suggest=bodyNames(ORIG.filter(b=>!notProse(b.part)),known)
      .filter(x=>!near.some(nm=>norm(nm.value).trim()===norm(x.value).trim()));
    // בלי תקרה: ההצעות נחתכו בשתים-עשרה, והשם השלושה-עשר שלא ברשימה לא הוצע ונשאר בקובץ (ביקורת L12).
  }catch(e){if(!e||!e.skip){console.warn("סריקת גוף הטקסט נכשלה",e);incomplete.push("body")}}
  ver.suggest=suggest;
  /* תווית בגרף או בתרשים עומדת לבדה, בלי משפט סביבה, ולכן סריקת הגוף — ששוקלת הקשר — אינה
     יכולה להציע אותה, וגם המודל כבוי לפעמים. תווית קצרה שכל מילה בה נראית כמו שם מוצעת
     להחלטה שלה, והפס אינו ירוק עד שהחליטה (ביקורת C2). */
  try{
    const knownN=new Set([...subs.map(s=>s.value),...(allow||[]),...applied.map(r=>r.base||r.value),
      ...suggest.map(x=>x.value)].map(v=>norm(v).trim()));
    const docTok=new Set(norm(ORIG.map(b=>b.text).join(" ")).split(/\s+/));
    const looksName=w=>KNOWN_FIRST.has(w)||POOL.he_s.includes(w)||POOL.ar_s.includes(w)||nameish(w,docTok);
    for(const b of ORIG){
      if(!b.label&&!/\/(?:charts|diagrams)\//.test(b.part))continue;
      const t=trimEdges(norm(b.text)).trim(), w=t.split(/\s+/).filter(Boolean);
      if(!t||w.length>3||knownN.has(t)||!w.every(looksName))continue;
      // מילה בודדת מוצעת רק כשהיא שם פרטי או שם משפחה מוכר: "הכנסות" ו"ינואר" הן תוויות רגילות
      if(w.length===1&&!(KNOWN_FIRST.has(t)||POOL.he_s.includes(t)||POOL.ar_s.includes(t)))continue;
      knownN.add(t);
      suggest.push({value:t,score:0,count:1,why:b.label?"כיתוב מעוצב (WordArt) שנראה כמו שם":"תווית בגרף או בתרשים שנראית כמו שם",ctx:ctxHTML(b.text,0,b.text.length),part:partName(b.part)});
    }
    /* טקסט חלופי של תמונה ("רחל פרידמן בפגישה במרכז הקשר") הוא משפט בלי הקשר של דיבור, וסריקת
       הגוף אינה קוראת אותו. בלי המודל שם שישב רק שם לא הוצע לאף שכבה, ועם המודל רק בחלק מהמקרים
       (נמצא במסמכי המבנה של הבנצ'מרק, ביקורת M20). שם פרטי מוכר ואחריו מילה שנראית כמו שם מוצעים. */
    for(const b of ORIG){
      if(!b.part.includes("טקסט חלופי")&&!b.pair)continue;
      const raw=String(b.text).split(/\s+/).map(x=>trimEdges(x)).filter(Boolean);
      for(let i=0;i+1<raw.length;i++){
        const a=norm(raw[i]).trim(), c=norm(raw[i+1]).trim();
        if(!(KNOWN_FIRST.has(a)||POOL.he_f.includes(a)||POOL.he_m.includes(a)||POOL.ar_f.includes(a)||POOL.ar_m.includes(a)))continue;
        if(!(POOL.he_s.includes(c)||POOL.ar_s.includes(c)||nameish(c,docTok)))continue;
        const t=raw[i]+" "+raw[i+1], tn=norm(t).trim();
        if(knownN.has(tn))continue;
        knownN.add(tn);
        suggest.push({value:t,score:0,count:1,why:"שם בטקסט החלופי של תמונה",ctx:ctxHTML(b.text,0,b.text.length),part:partName(b.part)});
      }
    }
  }catch(e){console.warn("סריקת התוויות נכשלה",e);incomplete.push("labels")}
  ver.incomplete=incomplete;
  // ירוק רק כשאין דליפות, אין ממצאים פתוחים, ואין ערוץ שלא נותח
  ver.complete=ver.passed&&!remaining.length&&!ver.embedded.length&&
    !near.length&&!suggest.length&&!incomplete.length;
  return {blob,applied,flagged,preview,structural:rep,verification:ver,map:eng.map};
}
const PARTN={"document.xml":"גוף המסמך","footnotes.xml":"הערות שוליים","endnotes.xml":"הערות סיום"};
function partName(p){
  const base=p.split(" (")[0].split("/").pop();
  const ex=p.includes("טקסט חלופי")?" · טקסט חלופי":p.includes("קוד שדה")?" · קוד שדה":p.includes("הגדרות עיצוב")?" · הגדרות עיצוב":"";
  // לפני גוף המסמך: הרכיבים המהירים יושבים ב-word/glossary/document.xml, ונקראו "גוף המסמך"
  if(p.includes("glossary"))return "רכיבים מהירים"+ex;
  if(PARTN[base])return PARTN[base]+ex;
  if(base.startsWith("header"))return "כותרת עליונה"+ex;
  if(base.startsWith("footer"))return "כותרת תחתונה"+ex;
  if(p.includes("glossary"))return "רכיבים מהירים"+ex;
  if(p.includes("/diagrams/"))return "תרשים SmartArt"+ex;
  if(p.includes("/charts/"))return "גרף"+ex;
  if(base==="settings.xml")return "הגדרות המסמך"+ex;
  if(base==="numbering.xml")return "מספור"+ex;
  if(base.startsWith("styles"))return "סגנונות"+ex;
  return base+ex}
function ctxHTML(t,s,e,w=55){
  const a=Math.max(0,s-w),b=Math.min(t.length,e+w);
  return {pre:(a>0?"…":"")+t.slice(a,s), hit:t.slice(s,e), post:t.slice(e,b)+(b<t.length?"…":"")}}

/* המשפטים שערך מופיע בהם, לכל היותר max מהם.

   מסך "מי בתיק" ומסך היישובים מבקשים החלטה על מילה בלי להראות אותה במסמך.
   כש«אזור» מופיע ברשימת המקומות, אי אפשר לדעת אם זו העיירה
   שליד חולון או המילה הרגילה, כשאף דבר במסך לא בא מהמסמך. מסך הבדיקה כבר
   שומר בדיוק את ההקשר הזה ומציג אותו; כאן הוא נבנה גם לשני המסכים שלפניו.

   אותו גבול מילה ואותה אות שימוש ככללי ההחלפה, כדי שמה שנראה בדוגמה יהיה מה
   שיוחלף בפועל. ההדגשה כוללת את אות השימוש ("באזור"), שזו הצורה שבמסמך. */
function examplesOf(blocks,value,max=3){
  const v=norm(String(value||"")).trim();
  if(v.length<2)return [];
  const rx=new RegExp(NW+"(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+flex(v)+NWE,"gu");
  const out=[];
  for(const b of blocks||[]){
    const t=b&&typeof b.text==="string"?b.text:typeof b==="string"?b:"";
    if(!t)continue;
    const n=norm(t);
    rx.lastIndex=0; let m;
    while((m=rx.exec(n))){
      if(m[0].length)out.push(ctxHTML(t,m.index,m.index+m[0].length));
      else rx.lastIndex++;
      if(out.length>=max)return out;
    }
  }
  return out;
}

// מספר או תאריך נבדקים בגבולות ספרות: "1.3.2026" אינו דולף בתוך התאריך המוזז "11.3.2026"
function secretTest(nv){
  if(!(/^\d/.test(nv)||/\d$/.test(nv)))return nt=>nt.includes(nv);
  const rx=new RegExp((/^\d/.test(nv)?"(?<!\\d)":"")+esc(nv)+(/\d$/.test(nv)?"(?!\\d)":""),"u");
  return nt=>rx.test(nt)}
/* dates: הערכים האמיתיים של תאריכים, ו-fakes: כל תאריך בדוי שנכתב, כמה פעמים שנכתב. תאריך נחשב שנשאר רק במקום
   שבו הוא תאריך: "12.3" של "ביום 12.3" אינו דולף ב"סעיף 12.3" או ב"3.5 ימים" (notDateAt), שהם מספר סעיף וכמות
   ונשארים כמו שהם (הציד של 11.10). תאריך נקרא על הטקסט בלי התגיות ועל ערכי התכונות, לא על ה-XML כמו שהוא: שם
   ריצה של Word בין "סעיף" למספר הסתירה את מילת הסעיף, והסעיף שנשאר נקרא תאריך שדלף (ביקורת 11.10). ותאריך דולף
   רק כשהוא מופיע יותר פעמים משנכתב בתוך תאריכים בדויים: במסמך צפוף, ההיסט לא תמיד מוצא מקום פנוי (dateOffFor),
   ותאריך בדוי שהוא גם תאריך אמיתי של המסמך אינו התאריך האמיתי שנשאר */
/* placeSecrets: יישובים שהם גם מילה או צירוף (placeCond) שהוחלפו במופע שהוא מקום. מופע שלהם הוא דליפה רק
   כשהשכבה הייתה מחליפה אותו בעצמה בטקסט הקריא (placeSure, אותו מבחן של findPlaces); המופע שנשאל ("נקודת מבט
   רעננה", "פותח פתח תקווה") אינו דליפה */
const XUN=s=>s.replace(/&(quot|apos|lt|gt|amp);/g,(m,k)=>({quot:'"',apos:"'",lt:"<",gt:">",amp:"&"})[k]);
async function verify(buf,secrets,dates,fakes,placeSecrets){
  const files=await unzip(buf);
  const uniq2=a=>[...new Set((a||[]).filter(s=>s&&s.trim().length>=2))].map(s=>[s,norm(s)]);
  const sec=uniq2(secrets).map(([o,nv])=>[o,nv,secretTest(nv)]), dsec=uniq2(dates).map(([o,nv])=>[o,nv.replace(/\u0000/g,"")]);
  const dateRX=nv=>new RegExp((/^\d/.test(nv)?"(?<!\\d)":"")+esc(nv)+(/\d$/.test(nv)?"(?!\\d)":""),"gu");
  const dateHits=(t,nv)=>{let c=0; for(const m of t.matchAll(dateRX(nv)))if(!notDateAt(t,m.index,m.index+m[0].length))c++; return c};
  const ps=new Set((placeSecrets||[]).map(s=>norm(s).trim()).filter(Boolean));
  const leaks=[],emb=[],dateIn=new Map();let n=0;
  for(const f of files){n++;
    if(/^word\/(embeddings|media)\//.test(f.name))emb.push(f.name);
    for(const enc of ["utf-8","utf-16le"]){
      let t;try{t=new TextDecoder(enc).decode(f.data)}catch(_){continue}
      let dv=t;
      /* הבדיקה קראה רק את ה-XML כמו שהוא, ושם שמפוצל בין ריצות, מופרד בטאב או כתוב
         עם קו תחתון ("רחל_פרידמן") לא נראה לה כלל (שכבה 1ב). קוראים גם את הטקסט בלי
         תגיות, כשטאב, טאב מיקום ומעבר שורה הם רווח וקו תחתון הוא רווח. */
      let read=t;
      if(/\.(xml|rels)$/.test(f.name)&&enc==="utf-8"){
        const raw=t;
        read=XUN(t.replace(/<\/(?:w|a):p>/g,"\n").replace(/<w:(?:tab|ptab|br|cr)\b[^>]*\/>/g," ").replace(/<w:noBreakHyphen\b[^>]*\/>/g,"-").replace(/<[^>]+>/g,""));
        // ומה שאינו טקסט ואינו תגית: ערכי תכונות והערות XML
        dv=read+"\n"+[...t.matchAll(/=(?:"([^"]*)"|'([^']*)')|<!--([\s\S]*?)-->/g)].map(m=>m[1]??m[2]??m[3]).join("\n");
        // + הוא רווח בכתובת ("?q=דנה+שגיא"), כמו קו תחתון
        t+="\n"+read+"\n"+t.replace(/[_+]/g," ");
        // וגם כמו שדפדפן קורא כתובת: "%D7%93" הוא "ד". שם מקודד ביעד של קישור עבר את הבדיקה (הציד של 11.10)
        if(/%[0-9A-Fa-f]{2}/.test(raw)){const d=pctPlain(raw);t+="\n"+d+"\n"+d.replace(/[+_]/g," ")}
      }
      const nt=norm(t), nd=norm(dv).replace(/\u0000/g,"");
      for(const [o,nv,has] of sec){
        if(!nv)continue;
        if(has(nt))leaks.push({value:o,part:f.name});
      }
      for(const [o,nv] of dsec){
        if(!nv)continue;
        const c=dateHits(nd,nv); if(!c)continue;
        const d=dateIn.get(o)||{n:0,parts:[]}; d.n+=c; d.parts.push(f.name); dateIn.set(o,d);
      }
      if(ps.size&&[...ps].some(p=>nt.includes(p.split(" ")[0]))){
        const nr=norm(seenText(read.replace(/_/g," "))), all=placeScan(nr);
        for(const x of all) if(ps.has(x.name)&&placeSure(nr,x,all)) leaks.push({value:x.name,part:f.name});
      }
    }}
  // התאריכים הבדויים בשורות נפרדות: אין בהם מילת סעיף או יחידה, ולכן כל אחד נקרא בהקשר של עצמו
  const wrote=(fakes||[]).map(x=>norm(String(x||"")).replace(/\u0000/g,"")).join("\n");
  for(const [o,nv] of dsec){
    const d=dateIn.get(o); if(!d)continue;
    if(d.n>dateHits(wrote,nv))for(const p of d.parts)leaks.push({value:o,part:p});
  }
  const uniq=[],seen=new Set();
  for(const l of leaks){const k=l.part+"|"+l.value;if(!seen.has(k)){seen.add(k);uniq.push(l)}}
  return {passed:!uniq.length,leaks:uniq,parts:n,embedded:emb}}

/* השם שבשכן של תווית שעומדת לבדה (labelOf, הציד של 11.10). בטבלה: הפסקה הבאה באותו תא, ואם אין — התא שליד
   התווית באותה שורה, אחריה כשהשורה נפתחת בתווית ולפניה כשהיא נגמרת בתווית ("נגה טרכטנגוט | התובעת:"). תא ריק
   אחרי תווית הוא שדה ריק, לא רמז לשורה הבאה. מחוץ לטבלה: הפסקה הבאה באותו חלק. אחרי כותרת של רשימה: כל שורה
   שלה, ממוספרת או קצרה (המספור של Word אינו בטקסט). מה שהעוגנים כבר מצאו בשכן עצמו אינו נספר פעמיים.
   כל תוצאה: {i: מקום הבלוק, h: הממצא בתוכו}. */
const LIST_LINE=/^(?:\(?\d{1,2}[.)]|[א-ט][.)]|[-•·*])\s*[א-ת]/u;
// תא שנראה כתווית או ככותרת של טור: תווית של שם, נקודתיים בסוף, או רק מילים של טופס ("מספר זהות", "ת.ז.", "תפקיד")
const HEAD_WORDS=new Set(["ת.ז","ת.ז.","ת\"ז","תז","לידה","זהות","גיל","תפקיד","קרבה","מין","עיסוק","מקצוע","נייד","דרכון","משפחתי"]);
function labelLike(t){
  const x=norm(String(t||"")).replace(/\u0000/g,"").trim();
  if(!x||/\d/.test(x))return false;
  if(labelOf(x,true)||/:$/.test(x))return true;
  return x.split(/\s+/).every(w=>{const b=w.replace(/[.'"]+$/,"");
    return FORMLABEL.has(w)||HEAD_WORDS.has(w)||HEAD_WORDS.has(b)||COMMON.has(b)||STOP.has(b)||(b.length>3&&PFX.has(b[0])&&(COMMON.has(b.slice(1))||STOP.has(b.slice(1))))})}
function labelNext(blocks){
  const out=[], rows=new Map(), grid=new Map(), last=new Map(), txt=b=>String(b.text||"");
  const labs=blocks.map(b=>hiddenPart(b.part||"")?null:labelOf(txt(b),!!b.cell));
  blocks.forEach((b,i)=>{
    if(!b.cell)return;
    const r=rows.get(b.cell.row)||[]; r.push(i); rows.set(b.cell.row,r);
    const g=b.cell.tbl+"|"+b.cell.r+"|"+b.cell.col; if(!grid.has(g))grid.set(g,i);
    last.set(b.cell.tbl,Math.max(last.get(b.cell.tbl)||0,b.cell.r));
  });
  const at=(c,r,col)=>grid.get(c.tbl+"|"+r+"|"+col);
  // שורת חתימה ("__________") או קו בין התווית לשם אינה השכן: מדלגים על עד שתי שורות בלי אות
  const after=i=>{let j=i+1; while(j<blocks.length&&j<=i+3&&blocks[j].part===blocks[i].part&&!/[א-ת]/.test(txt(blocks[j])))j++; return j};
  const asRole=l=>l&&(l.keys.includes("role")||l.as==="role");
  // הממצאים בשכן j של התווית i, על הטקסט שהקורא רואה (anchoredSeen): סימן כיוון בראש השורה חסם כל קריאה של שכן.
  // מה שהעוגנים כבר מצאו בשכן לבדם אינו נספר פעמיים
  const memo=new Map();
  const read=(j,i)=>{
    const k=i+":"+j; if(memo.has(k))return memo.get(k);
    let r=[];
    if(j<blocks.length&&!labs[j]&&!hiddenPart(blocks[j].part||"")){
      const own=new Set(anchoredSeen(txt(blocks[j])).map(h=>h.s+":"+h.e));
      r=anchoredSeen(txt(blocks[j]),labs[i]).filter(h=>!own.has(h.s+":"+h.e));
    }
    memo.set(k,r); return r};
  /* פרוטוקול (הביקורת של 11.10): אותה תווית של צד לבדה כמה פעמים, ומתחתיה כל פעם משהו אחר, ורוב מה שמתחת לתוויות
     האלה אינו נקרא כשם — אלה דברים שנאמרו בדיון. בחלק כזה תווית של צד אינה קוראת את השכן שלה, גם כשתשובה קצרה
     נראית כשם. רשימה של תיקים, שבה כל "התובעת:" עומדת מעל שם, נקראת כרגיל */
  const turns=new Map(), named=new Map();
  labs.forEach((l,i)=>{
    if(!asRole(l))return;
    const p=blocks[i].part, j=after(i), nb=blocks[j], same=!!nb&&nb.part===p;
    const k=p+"\u0001"+norm(txt(blocks[i])).replace(/[^א-ת]/g,"");
    const t=turns.get(k)||new Set(); t.add(same?norm(txt(nb)).replace(/\u0000/g,"").trim():""); turns.set(k,t);
    const c=named.get(p)||{n:0,yes:0}; c.n++; if(same&&read(j,i).length)c.yes++; named.set(p,c)});
  const talk=new Set([...turns].filter(([,t])=>t.size>=2).map(([k])=>k.split("\u0001")[0])
    .filter(p=>{const c=named.get(p); return c.yes*2<c.n}));
  const field=l=>l.keys.some(x=>x==="field"||x==="fieldx");
  for(let i=0;i<blocks.length;i++){
    const lab=labs[i], b=blocks[i], ni=after(i), nb=blocks[ni]; if(!lab)continue;
    if(asRole(lab)&&talk.has(b.part))continue;
    const next=[];
    if(lab.list){
      for(let j=i+1;j<blocks.length&&next.length<40;j++){
        const t=norm(txt(blocks[j])).replace(/\u0000/g,"").trim();
        // "נ ג ד" סוגר את רשימת הצד הראשון
        if(blocks[j].part!==b.part||labs[j]||/^-?\s*(?:נ\s+ג\s+ד|נגד)\s*-?$/u.test(t)||!(LIST_LINE.test(t)||(t.split(/\s+/).length<=4&&!/[.:;]$/.test(t))))break;
        next.push(j);
      }
    }else if(b.cell&&!(nb&&nb.cell&&nb.cell.row===b.cell.row&&nb.cell.col===b.cell.col)){
      const row=rows.get(b.cell.row), others=row.filter(k=>blocks[k].cell.col!==b.cell.col), below=at(b.cell,b.cell.r+1,b.cell.col);
      if(b.cell.n===1){
        // טבלה של טור אחד ("שם:" ומתחתיו השם, ת"ז, עיר): רק התא שמתחת לתווית, לא הטור כולו (הביקורת של 11.10)
        if(below!==undefined&&!labelLike(txt(blocks[below])))next.push(below);
      }else if(b.cell.tbl&&below!==undefined&&!labelLike(txt(blocks[below]))&&others.every(k=>labelLike(txt(blocks[k])))){
        // שורת כותרות ("שם העד | תפקיד", "שם הקטין | ת.ז."): התווית היא כותרת של טור, והשמות מתחתיה, לא בתא שלידה.
        // הטור נעצר בתא הראשון שאינו שם: מתחת ל"נספח | שם | עמוד" באים מסמכים (הביקורת של 11.10)
        // טבלה עם תוויות של שורות בטור הראשון ("עיסוק", "הכנסה"): מה שמתחת לכותרת של צד הוא הערך של השורה, לא שם, ושם
        // בטבלה כזו נקרא מתווית השורה שלו ("שם"). "התובעת | הנתבע" מעל "עיסוק" מילא את הרשימה במקצועות (ביקורת שנייה)
        // טבלה כזו פותחת בפינה שאינה תווית של צד (ריקה, "פרט"): כשבפינה "התובעת", הטור הראשון הוא של צד, ושמו אינו תווית
        const c0=Math.min(...rows.get(blocks[below].cell.row).map(k=>blocks[k].cell.col)), k0=at(b.cell,b.cell.r+1,c0), kc=at(b.cell,b.cell.r,c0);
        if(c0!==b.cell.col&&k0!==undefined&&k0!==below&&/[א-ת]/.test(txt(blocks[k0]))&&!(kc!==undefined&&asRole(labs[kc])))continue;
        for(let r=b.cell.r+1;r<=Math.min(last.get(b.cell.tbl),b.cell.r+40);r++){
          const k=at(b.cell,r,b.cell.col); if(k===undefined)continue;
          if(labelLike(txt(blocks[k])))break;
          const hs=read(k,i); if(!hs.length)break;
          for(const h of hs)out.push({i:k,h});
          if(!field(lab))break;
        }
        continue;
      }else{
        const at1=c=>row.find(k=>blocks[k].cell.col===c), cols=row.map(k=>blocks[k].cell.col);
        const dir=labs[at1(Math.min(...cols))]?1:labs[at1(Math.max(...cols))]?-1:1;
        const k=at1(b.cell.col+dir); if(k!==undefined)next.push(k);
      }
    }else if(nb&&nb.part===b.part)next.push(ni);
    for(const j of next) for(const h of read(j,i)) out.push({i:j,h});
  }
  return out}
function discover(blocks){
  const found={};
  // יש תמלולים שמסמנים דובר בשורה משל עצמה, בלי נקודתיים: פסקה שכולה שם ואחריה
  // פסקאות הדיבור. עוגן הדוברים דורש נקודתיים, ולכן על תמלולים כאלה
  // discover החזיר אפס מועמדים. פסקה קצרה בלי פיסוק בסוף, שאחריה פסקה של ממש, היא דובר.
  const extra=[];
  for(let bi=0;bi<blocks.length;bi++){
    const rawLine=(blocks[bi].text||"").trim();
    const t=trimEdges(rawLine), w=t.split(/\s+/).filter(Boolean);
    const nxt=blocks[bi+1]&&trimEdges(blocks[bi+1].text||"");
    // הפיסוק נבדק על השורה הגולמית: trimEdges מסיר נקודה בסוף, ואז "לא." נראה
    // כמו "לא" — שורה בת מילה אחת בלי פיסוק, כלומר שורת דובר. על תמלול של שיחה
    // זה נותן הצעות כמו "וואי", "אההה", "תגידי", "לא.".
    if(!t||w.length>3||t.length>25||/[.,?!:;…]$/.test(rawLine))continue;
    if(!nxt||nxt.split(/\s+/).length<4)continue;
    const c=cleanName(t); if(!c||!anchorOK(c))continue;
    // שם חשוף הוא לפחות שלוש אותיות במילה, אינו מילת עצירה או מילה נפוצה או
    // פועל, ואינו קריאה: אות שחוזרת שלוש פעמים ("אההה", "וואי") אינה שם.
    if(!c.split(/\s+/).every(x=>x.length>=3))continue;
    if(c.split(/\s+/).some(x=>{const n=norm(x); return STOP.has(n)||COMMON.has(n)||VRB.has(n)||/(.)\1\1/.test(n);}))continue;
    // תמלול מלא בשורות קצרות שאינן שמות: "הבנתי", "טוב", "יודעת". הן נראות בדיוק
    // כמו שורת דובר, ושתיים מהן אף חזרו ולכן קיבלו ביטחון גבוה ומילוי אוטומטי.
    if(c.split(/\s+/).some(x=>FILLER.has(norm(x))||/(?:תי|נו)$/.test(norm(x))))continue;
    // תווית דובר היא שם חשוף: בלי פיסוק בתוכה, בלי רבים ובלי שייכות.
    // "תראי, עקרונים", "לטפל בפצעים", "הפצעים נקרות", "מניסיון שלך" נראו כמו שורת דובר.
    if(/[,;:"'()׳״]/.test(t))continue;
    // "בית המשפט הנכבד" מתחת ל"לכבוד" הוצע כאדם בשם «הנכבד»: שורה שהניקוי קיצץ ממנה מילה שאינה תואר
    // אינה שורה שכולה שם (הציד של 11.10)
    {const kept=c.split(/\s+/); if(w.some(x=>!kept.includes(x)&&!TITLE_RX.test(x+" ")))continue;}
    // "נגה ואליאב טרכטנגוט" הם זוג, לא דובר אחד: העוגנים מציעים אותם כשני אנשים (הביקורת של 11.10)
    {const cw=c.split(/\s+/); if(cw.length===3&&/^ו-?[א-ת]{2}/.test(cw[1]))continue;}
    if(c.split(/\s+/).some(x=>/(?:ים|ות|יים|יות)$/.test(norm(x))&&!KNOWN_FIRST.has(norm(x))))continue;
    if(c.split(/\s+/).some(x=>/^של[ךכםןנהוי]?$/.test(norm(x))))continue;
    const s0=blocks[bi].text.indexOf(c); if(s0<0)continue;
    extra.push({b:blocks[bi],h:{text:c,s:s0,e:s0+c.length,why:"פסקה שכולה שם, ואחריה דיבור",anchor:"speakerline",g:null,role:null}});
  }
  for(const {b,h} of extra){
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    // בניגוד לתור דיבור עם נקודתיים, שורה בודדת היא רמז חלש: היא נשארת הצעה
    // בהקשה אחת ולעולם לא מתמלאת מעצמה, גם כשהיא חוזרת.
    r.count++;r.why.add(h.why);r.spk=(r.spk||0)+1;
    if(!r.ctx)r.ctx=ctxHTML(b.text,h.s,h.e);
  }
  // כותרת של תיק: שורת "נגד" ("נ ג ד") באותו חלק, או פרטים של צד בשורה שמתחת לשם
  const plain=b=>norm(String(b.text||"")).replace(/\u0000/g,"").trim(), at=new Map(blocks.map((b,i)=>[b,i]));
  const vsParts=new Set(blocks.filter(b=>/^-?\s*(?:נ\s+ג\s+ד|נגד)\s*-?$/u.test(plain(b))).map(b=>b.part));
  const DETAIL=/^(?:באמצעות|ע"י|ת\.?\s?ז|ת"ז|מ?רח(?:וב|')|ב"כ|עו"ד)/u, DETAIL_IN=/(?:^|[\s(])(?:באמצעות|ע"י|ב"כ|ת\.?\s?ז\.?|ת"ז)(?=[\s.:,]|$)/u;
  // וגם טבלה שיש בה פרטים של צד ("ע"י ב"כ", ת"ז) באחד התאים
  const tblOf=b=>b.cell&&b.cell.tbl!=null?b.part+"|"+b.cell.tbl:null, capTbl=new Set();
  for(const b of blocks){const t=tblOf(b); if(t&&DETAIL_IN.test(plain(b)))capTbl.add(t)}
  const caption=b=>{if(vsParts.has(b.part)||capTbl.has(tblOf(b)))return true;
    const nb=blocks[at.get(b)+1]; return !!nb&&nb.part===b.part&&DETAIL.test(plain(nb))};
  // שם מוכר מתחת לתווית של צד מעיד על הצדדים שלידו: באותה טבלה, או עד שש שורות ממנו
  const knownTbl=new Set(), knownAt=[];
  const take=(b,h)=>{
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    r.count++;r.why.add(h.why);
    if(h.role&&!r.role)r.role=h.role;
    if(h.g==="f")r.gf++; if(h.g==="m")r.gm++;
    // שם בשכן של תווית ממלא את הרשימה רק כשהשורה היא השם בלבד ("נגה טרכטנגוט, ת.ז. …" מוצע), ומה שבא אחרי תפקיד
    // באותה שורה ואינו נראה כשם ("הנתבע - מתנגד נחרצות", unsure) מוצע ואינו ממלא אותה (הביקורת של 11.10)
    // ושכן ממלא אותה רק עם ראיה של שם: מילה של שם מוכר (known), כותרת של תיק (שורת "נגד" באותו חלק, רשימת צדדים
    // ממוספרת, או פרטי צד בשורה שמתחת: "באמצעות", ת"ז, "ע"י"), או אותו שם במקום אחר במסמך (למטה). חצי של זוג לעולם
    // לא (pair): "מהנדסת תוכנה" מתחת ל"המבקשת:" ו«קנין נגד» מ"אורי וקנין נגד" מילאו את הרשימה (ביקורת שנייה)
    const nearOK=!h.near||(h.only&&(h.known||h.numbered||caption(b)));
    if(!h.pair&&(h.anchor==="bid"||(h.anchor==="role"&&nearOK&&!h.unsure)))r.conf="high";
    else if(!h.pair&&h.anchor==="role"&&h.near&&h.only&&!h.unsure)(r.nearAt||(r.nearAt=new Set())).add(b);
    if(!h.pair&&h.anchor==="role"&&h.near&&h.only&&h.known&&!h.unsure){const t=tblOf(b); if(t)knownTbl.add(t); else knownAt.push(b)}
    // דובר שחוזר, או דובר בשם מלא, הוא אדם בוודאות. דובר יחיד במילה אחת נשאר
    // הצעה: "שאלה:" או "הערה:" נראים אותו דבר עד שחוזרים.
    // דובר הוא מי שחוזר: "מועד אחרון לתגובה:" הוא תווית של טופס, גם כשיש בה שתי מילים.
    // שתי מילים בפעם אחת היו "גבוה" ומולאו אוטומטית; עכשיו רק חזרה מעלה את הביטחון.
    // אחרי חותמת של שיחה, מילה אחת שאינה שם מוכר נשארת הצעה גם כשחוזרת (weakSpk): כך נראית גם תווית ביומן
    if(h.anchor==="speaker"){r.spk=(r.spk||0)+1; if(r.spk>=2&&!h.weakSpk)r.conf="high";}
    if(!r.ctx)r.ctx=ctxHTML(b.text,h.s,h.e)};
  for(const b of blocks) for(const h of anchoredSeen(b.text))take(b,h);
  // שם שתווית בתא או בפסקה שלידו מעידה עליו: "התובעת:" בתא אחד והשם בתא שלידו מילא את הרשימה כמו בשורה אחת
  for(const {i,h} of labelNext(blocks))take(blocks[i],h);
  // שם בשכן של תווית בלי מילה של שם מוכר ממלא את הרשימה כשצד לידו נקרא בשם מוכר, או כשהוא כתוב גם במקום אחר
  // במסמך, מחוץ לשכן
  const nearKnown=b=>knownTbl.has(tblOf(b))||(!tblOf(b)&&knownAt.some(k=>k!==b&&k.part===b.part&&Math.abs(at.get(k)-at.get(b))<=6));
  for(const [v,r] of Object.entries(found)){
    if(r.conf==="high"||!r.nearAt)continue;
    if([...r.nearAt].some(nearKnown)){r.conf="high";continue}
    const rx=new RegExp(NW+flex(norm(v).trim())+NWE,"u");
    if(blocks.some(b=>!r.nearAt.has(b)&&rx.test(norm(String(b.text||"")))))r.conf="high"}
  // "מאורי בן-שחר" הוא "אורי בן-שחר" עם אות שימוש — לא מועמד נפרד
  // אין איחוד אוטומטי לפי האות הראשונה: "שרון לוי" אינו "רון לוי"
  // עם אות שימוש, ומיזוג שגוי נותן לשני אנשים אותו כינוי.
  // צורות עם אות שימוש נתפסות ממילא דרך מנגנון הווריאנטים,
  // ואם באמת מדובר באותו אדם — יש בורר "זה אותו אחד" בממשק.
  const keys=Object.keys(found);
  return keys.map(value=>{
    const r=found[value];
    const toks=value.split(/\s+/);
    // שם משפחה לבד — מסומן ככינוי של השם המלא
    const full=toks.length===1?keys.find(x=>x!==value&&
      x.split(/\s+/).length>1&&x.split(/\s+/).slice(-1)[0]===toks[0]):null;
    return {value,count:r.count,conf:r.conf,why:[...r.why].join(" · "),
            ctx:r.ctx,aliasOf:full||null,role:r.role,speaker:!!r.spk,
            g:r.gf>r.gm?"f":r.gm>r.gf?"m":null};
  }).sort((a,b)=>(a.conf==="high"?0:1)-(b.conf==="high"?0:1)||b.count-a.count)}


const NER_CACHE="transformers-cache";
let nerEnv=function(){
  const local=location.protocol==="file:";
  return {local,
    canCache:!local&&typeof caches!=="undefined"&&!!window.isSecureContext,
    canRun:!local};
};
let nerCached=async function(){
  try{
    if(!nerEnv().canCache)return false;
    const c=await caches.open(NER_CACHE);
    const k=await c.keys();
    // רק עותק של המודל הנוכחי נחשב: עותק ישן (dictabert-ner מ-Hugging Face) נמחק בטעינה הבאה
    return k.some(r=>r.url===MODEL_URL(NER_SPEC.weights.file));
  }catch(_){return false}
};
async function nerPersist(){
  try{
    if(!navigator.storage||!navigator.storage.persist)return null;
    if(await navigator.storage.persisted())return true;
    return await navigator.storage.persist();
  }catch(_){return null}
}
/* ── טעינת המודל בדפדפן ──
   המודל רץ אצלה במחשב. שום דבר לא נשלח לשום מקום — לא המסמך, לא הטקסט.
   מה שכן עובר ברשת הוא הורדת המודל עצמו, פעם אחת. */
/* שרשרת האספקה (ביקורת H14, M4). שתי הספריות שרואות את המסמך נטענו מ-CDN ב-import() חשוף,
   ש-Subresource Integrity אינו יכול לכסות, ועובד השירות שמר אותן קודם. עכשיו:
   - transformers.js, והטוען של ספריית ההרצה (mjs), יושבים באתר עצמו, תחת vendor/, בשם שנושא
     את הגרסה. tests/vendor_t.js מוודא שהם הקבצים של החבילה בגרסה הזאת בדיוק.
   - קובץ ה-WebAssembly של ספריית ההרצה (27MB) נשאר ב-CDN, בכתובת נעולת-גרסה, ונבדק: מורידים
     אותו כאן, משווים SHA-256 לערך הנעול, ומוסרים לספרייה את הבייטים שנבדקו. קובץ שהשתנה —
     הטעינה נכשלת, בקול.
   - המודל נעול לגרסה (commit) ולא ל-main, וקובץ המשקולות נבדק מול ה-SHA-256 שלו פעם אחת.
   מדיניות אבטחת התוכן (CSP) ב-index.html מגבילה לאן העמוד יכול לפנות. */
const NER_LIB="./vendor/transformers-4.2.0.min.js";
const ORT_V="1.24.0-dev.20251116-b39e144322";
const ORT_CDN="https://cdn.jsdelivr.net/npm/onnxruntime-web@"+ORT_V+"/dist/";
const ORT_WASM={"ort-wasm-simd-threaded.asyncify":"ijj2sXOzrwSfS0ib7b4dolPO7XoXIPls3vYD8oNrZlw=",
  "ort-wasm-simd-threaded":"v3jjoRtGXpqh51bCDtQG3dbP8trXwt8NCNhytDbVTio="};
/* המודל, במקום אחד (בדיקת המודלים, ספטמבר 2026): DictaBERT-parse, ראש הישויות
   בלבד, מיוצא ל-ONNX ב-8 ביט. היחיד מבין תשעה מודלים שלא פתח אף דליפה חדשה בקורפוס ובסט פרטי
   של מסמכים אמיתיים (התוצאות לא מפורסמות), וקורא טוב יותר בכל ארבעת הקבצים הציבוריים. הוא יושב באתר עצמו, models/<id>/, ולא
   ב-Hugging Face: העמוד לא פונה לשום אתר אחר כדי לטעון אותו. GitHub אינו מחזיק קובץ מעל
   100MB, ולכן המשקולות בארבעה חלקים (scripts/model-parts.js); nerJoinParts מחבר אותם, והקובץ
   המחובר נבדק מול ה-SHA-256 שלמטה, כמו קודם. הקרדיט והרישיון: models/<id>/NOTICE.md. */
const NER_SPEC={
  id:"dictabert-parse-ner-37f4d6f",
  source:"dicta-il/dictabert-parse@37f4d6fd556766f15e955fe5bd0f16942b46853e",
  weights:{file:"onnx/model_quantized.onnx",bytes:184983343,
    sha256:"71e519f3151eb78b73bfcaf02538cbdca1f69593235186b7b246b208c62e70ca",
    parts:["onnx/model_quantized.onnx.part1","onnx/model_quantized.onnx.part2",
      "onnx/model_quantized.onnx.part3","onnx/model_quantized.onnx.part4"]}
};
// כתובת מלאה ליד הדף; בלי כתובת בסיס (about:blank בבדיקות jsdom) — הנתיב היחסי
const NER_BASE=()=>{ try{ return new URL("./models/",location.href).href; }catch(_){ return "./models/"; } };
const MODEL_URL=file=>NER_BASE()+NER_SPEC.id+"/"+file;
const NER_OK_KEY="redact-model-verified";
let NERP=null,NERSTATE="off";
async function sha256(buf,enc){
  const d=new Uint8Array(await crypto.subtle.digest("SHA-256",buf));
  if(enc==="hex")return [...d].map(b=>b.toString(16).padStart(2,"0")).join("");
  return globalThis.btoa(String.fromCharCode(...d));
}
// ספריית ההרצה: הטוען מהאתר, ה-WebAssembly מה-CDN אחרי בדיקה. בלי wasmPaths.wasm,
// transformers.js אינו מוריד את הקובץ בעצמו ומשתמש ב-wasmBinary שמסרנו.
async function nerRuntime(t){
  const safari=/^((?!chrome|android).)*safari/i.test((typeof navigator!=="undefined"&&navigator.userAgent)||"");
  const v=safari?"ort-wasm-simd-threaded":"ort-wasm-simd-threaded.asyncify";
  const f=RAW_FETCH||window.fetch.bind(window);
  const res=await f(ORT_CDN+v+".wasm");
  if(!res.ok)throw new Error("לא הצלחתי להוריד את ספריית ההרצה ("+res.status+")");
  const buf=await res.arrayBuffer();
  if(await sha256(buf)!==ORT_WASM[v])throw new Error("ספריית ההרצה שהורדה אינה הקובץ הנעול. המודל לא נטען.");
  const o=t.env.backends.onnx;
  o.wasm.wasmPaths={mjs:new URL("./vendor/ort-"+ORT_V+"/"+v+".mjs",location.href).href};
  o.wasm.wasmBinary=buf;
}
// כל מה שבמטמון המודל ואינו של המודל הנוכחי נמחק: המודל הקודם (dictabert-ner מ-Hugging Face,
// 185MB) ועותקים של גרסאות אחרות (ביקורת M2: דבר לא פינה את המטמון הזה, והוא נשאר אחרי כל שינוי)
async function nerMigrateCache(){
  if(!nerEnv().canCache)return 0;
  const c=await caches.open(NER_CACHE), mine=MODEL_URL(""); let dropped=0;
  for(const req of await c.keys())
    if(!req.url.startsWith(mine)){ await c.delete(req); dropped++; }
  return dropped;
}
// קובץ המשקולות, מחובר מחלקיו. transformers.js מבקש קובץ אחד; העמוד מוריד את החלקים בזה אחר
// זה ומגיש אותם כזרם אחד, עם האורך הכולל (לפס ההתקדמות ולבדיקה). חלק שלא ירד — שגיאה בקול.
function nerIsWeights(url){
  try{ return new URL(url,location.href).href.split("?")[0]===MODEL_URL(NER_SPEC.weights.file); }catch(_){ return false; }
}
function nerJoinParts(){
  const f=RAW_FETCH||window.fetch.bind(window), parts=NER_SPEC.weights.parts.map(MODEL_URL);
  let i=-1, reader=null;
  const next=async()=>{
    i++; if(i>=parts.length)return false;
    const r=await f(parts[i]);
    if(!r.ok||!r.body)throw new Error("חלק "+(i+1)+" של קובץ המודל לא ירד ("+r.status+")");
    reader=r.body.getReader(); return true;
  };
  const body=new globalThis.ReadableStream({async pull(ctl){
    try{
      for(;;){
        if(!reader&&!(await next())){ctl.close();return}
        const {done,value}=await reader.read();
        if(!done){ctl.enqueue(value);return}
        reader=null;
      }
    }catch(e){ctl.error(e)}
  }});
  return new Response(body,{status:200,statusText:"OK",
    headers:{"Content-Type":"application/octet-stream","Content-Length":String(NER_SPEC.weights.bytes)}});
}
// המשקולות נבדקות פעם אחת מול ה-SHA-256 הנעול (185MB, שנייה או שתיים), והבדיקה נזכרת לפי
// גודל העותק השמור. עותק שאינו תואם נמחק, והטעינה נכשלת בקול.
async function nerVerifyWeights(){
  if(!nerEnv().canCache)return "no-cache";
  const c=await caches.open(NER_CACHE), url=MODEL_URL(NER_SPEC.weights.file);
  const r=await c.match(url); if(!r)return "not-cached";
  const tag=NER_SPEC.id+":"+(r.headers.get("content-length")||"");
  try{ if(localStorage.getItem(NER_OK_KEY)===tag)return "known"; }catch(_){}
  const h=await sha256(await r.arrayBuffer(),"hex");
  if(h!==NER_SPEC.weights.sha256){ await c.delete(url); try{localStorage.removeItem(NER_OK_KEY)}catch(_){}
    throw new Error("קובץ המודל שהורד אינו הקובץ הנעול. הוא נמחק מהמחשב; המודל לא נטען."); }
  try{ localStorage.setItem(NER_OK_KEY,tag); }catch(_){}
  return "verified";
}
// "מחיקת המודל מהמחשב" בהגדרות: הדרך היחידה לפנות אותו הייתה כלי המפתחים (ביקורת M2)
async function nerForget(){
  NERP=null; NERSTATE="off";
  try{ localStorage.removeItem(NER_OK_KEY); }catch(_){}
  if(typeof caches!=="undefined") return caches.delete(NER_CACHE);
  return false;
}
/* tokenizer.json של DictaBERT מכיל \" — escape חוקי במנוע ה-regex של
   Rust, ולא חוקי ב-JavaScript תחת דגל u. בלי זה הטוקנייזר לא נבנה בכלל.

   ניסיון ראשון היה לעטוף את RegExp, אבל מודול מה-CDN לא בהכרח פותר את
   השם דרך המשתנה הגלובלי שלנו. לכן מתקנים את הנתון עצמו: את קובץ
   הטוקנייזר, גם בדרך מהרשת וגם עותק ששמור כבר במטמון. */
// הבנאי המקורי, לפני שאנחנו עוטפים אותו — אחרת בדיקת התקינות למטה
// תשאל בנאי סלחן ותקבל תמיד "תקין", ושום תבנית לא תתוקן.
const RX_NATIVE=RegExp;
const RX_OK=/[\^$\\.*+?()\[\]{}|\/dDsSwWbBnrtvfxucpPk0-9]/;
const rxClean=p=>String(p).replace(/\\(.)/gu,(m,c)=>RX_OK.test(c)?m:c);
function rxBad(p){ try{new RX_NATIVE(p,"u");return false}catch(_){return true} }
/* \w ו-\W בתבנית של טוקנייזר: בספריית ה-tokenizers של Rust, שבה אומן המודל, \w כולל אותיות
   עבריות; ב-RegExp של JavaScript, גם עם הדגל u, רק ASCII. תבנית החלוקה של DictaBERT נגמרת
   ב-\w+|\p{P}|[^\w\s]+, ולכן אצלנו מילה עברית נפלה לענף האחרון יחד עם הפיסוק שאחריה: "שלישי."
   הייתה חתיכה אחת, והנקודה הגיעה למודל כ-##., ושם כפול עם מקף ("מלכה-אזולאי") הגיע כמילה אחת.
   בבדיקת המודלים רק 6 מ-50 משפטים יצאו כמו בפייתון (AutoTokenizer). כותבים את
   \w ואת \W כמחלקות היוניקוד שהן מייצגות שם — אותיות, סימנים, ספרות, מחברים — בתוך מחלקת
   תווים ומחוצה לה; 50 מ-50. \W בתוך מחלקה אינו ניתן לכתיבה כך, ותבנית כזאת נשארת כמו שהיא. */
const RX_W="\\p{L}\\p{M}\\p{Nd}\\p{Pc}";
function rxUnicodeW(p){
  let out="",inClass=false;
  for(let i=0;i<p.length;i++){
    const c=p[i];
    if(c==="\\"&&i+1<p.length){
      const n=p[i+1];
      if(n==="w")out+=inClass?RX_W:"["+RX_W+"]";
      else if(n==="W"){ if(inClass)return p; out+="[^"+RX_W+"]"; }
      else out+=c+n;
      i++; continue;
    }
    if(c==="["&&!inClass)inClass=true;
    else if(c==="]"&&inClass)inClass=false;
    out+=c;
  }
  return out;
}
// מתקנים כל תבנית שלא נבנית, וכותבים \w כפי שהמודל הכיר אותו
function fixTokJSON(txt){
  let j=null,repaired=false;
  try{j=JSON.parse(txt)}
  catch(e){
    // "תו מיותר אחרי סוף ה-JSON" — קורה כשנשמר גוף עם כותרות אורך
    // שלא תואמות לו. חותכים לסוגר האחרון ומנסים שוב.
    const k=txt.lastIndexOf("}");
    if(k>0){try{j=JSON.parse(txt.slice(0,k+1));repaired=true}catch(_){}}
    if(!j){console.warn("tokenizer.json לא ניתן לפענוח:",e.message);return txt}
    console.warn("tokenizer.json הכיל זנב מיותר —",txt.length-(k+1),"תווים נחתכו");
  }
  let n=0;
  (function walk(o){
    if(!o||typeof o!=="object")return;
    for(const k of Object.keys(o)){
      const v=o[k];
      if(typeof v==="string"){
        if(k==="Regex"||k==="pattern"){
          let f=v;
          if(rxBad(f)){ const c=rxClean(f); if(!rxBad(c))f=c; }
          const u=rxUnicodeW(f);
          if(u!==f&&!rxBad(u))f=u;
          if(f!==v){o[k]=f;n++}
        }
      } else walk(v);
    }
  })(j);
  if(n)console.log(`תוקנו ${n} תבניות בטוקנייזר`);
  if(!n&&!repaired)return txt;
  const out=JSON.stringify(j);
  // לא מחזירים משהו שלא נבדק — עדיף הקובץ המקורי מקובץ שבור
  try{JSON.parse(out)}catch(_){console.warn("התיקון יצא פגום, מחזירים מקור");return txt}
  return out;
}
// תשובה שנבנית מטקסט JSON מתוקן: לוו ה-fetch ולעותק שנכתב למטמון. (nerFixCached, שתיקנה עותק
// שמור במקום, לא נקראה מאף מקום והוסרה: ביקורת L8; nerPrepTokenizer עושה את זה)
let jsonRes=body=>new Response(body,{status:200,statusText:"OK",
  headers:{"Content-Type":"application/json"}});
const TOK_URL=()=>MODEL_URL("tokenizer.json");
let RAW_FETCH=null;
let FETCH_HOOKED=false;
function nerHookFetch(){
  if(FETCH_HOOKED)return; FETCH_HOOKED=true;
  const orig=window.fetch.bind(window);
  RAW_FETCH=orig;
  window.fetch=async function(input,init){
    const url=typeof input==="string"?input:(input&&input.url)||"";
    // קובץ המשקולות אינו קיים באתר כקובץ אחד: מחברים את חלקיו
    if(nerIsWeights(url))return nerJoinParts();
    const res=await orig(input,init);
    try{
      if(!/tokenizer\.json(\?|$)/.test(url)||!res.ok)return res;
      const txt=await res.clone().text();
      const fixed=fixTokJSON(txt);
      if(fixed===txt)return res;
      return jsonRes(fixed);
    }catch(e){console.warn("וו ה-fetch נכשל",e);return res}
  };
}
// שכבת גיבוי: אם בכל זאת נבנית תבנית שבורה, לא ליפול עליה
function nerFixRegExp(){
  if(window.__nerRx)return; window.__nerRx=1;
  const Orig=RegExp;
  const P=function(p,f){
    try{return new Orig(p,f)}
    catch(err){
      if(!(err instanceof SyntaxError)||typeof p!=="string")throw err;
      return new Orig(rxClean(p),f);
    }
  };
  P.prototype=Orig.prototype; Object.setPrototypeOf(P,Orig);
  window.RegExp=P; globalThis.RegExp=P;
}
// העטיפה של RegExp מותקנת כאן, בזמן הערכת המודול. המודול נטען ב-import דינמי
// מתוך componentDidMount, כלומר אחרי ש-#dc-root כבר מחובר. מי שקורא את RegExp
// הגלובלי לפני שה-import הסתיים רואה את המקורי, לא את העטוף.
// זה לא מזיק בפועל, ונבדק: סקריפט האתחול ב-index.html לא בונה אף תבנית,
// support.js בונה שתיים פשוטות לפירוק התבנית, ושלוש התבניות שנבנות כאן לפני
// השורה הזו (GF, GM, PLACE_RX) תקינות תחת הדגל u — אחרת המודול לא היה נטען.
// בדיקת הדפדפן ב-e2e/flow.spec.js ממתינה ל-window.__nerRx לפני שהיא שואלת.
nerFixRegExp();
export async function nerPrepTokenizer(report){
  const say=m=>{console.log("טוקנייזר: "+m); if(report)report(m)};
  const url=TOK_URL();
  const out={url,steps:[]};
  const step=(k,v)=>{out.steps.push(k+": "+v); say(k+": "+v)};
  if(!nerEnv().canCache){step("סביבה","אין מטמון — מדלגים");return out}
  const c=await caches.open(NER_CACHE);
  // עותק שמור שנקרא כ-JSON תקין משמש כמו שהוא: 2.9MB פחות בכל ביקור, והשניות
  // הראשונות של כל סשן בקו איטי. רק עותק פגום נמחק ומוריד מחדש.
  const prior=await c.match(url);
  if(prior){
    try{ const pt=await prior.text(); JSON.parse(pt); step("במטמון","עותק תקין — בלי הורדה"); out.ok=true; out.cached=true; return out; }
    catch(_){ step("במטמון","עותק פגום — מוריד מחדש"); }
  }
  let dropped=0;
  for(const k of await c.keys())
    if(/tokenizer\.json/.test(k.url)){await c.delete(k);dropped++}
  step("עותקים ישנים שנמחקו",dropped);
  const f=RAW_FETCH||window.fetch.bind(window);
  const res=await f(url,{cache:"reload"});
  step("הורדה",res.status+" "+(res.ok?"תקין":"נכשל"));
  if(!res.ok)throw new Error("לא הצלחתי להוריד את קובץ הטוקנייזר ("+res.status+")");
  const txt=await res.text();
  step("אורך",txt.length+" תווים");
  // האם המקור בכלל תקין, ואם לא — איפה בדיוק
  try{JSON.parse(txt);step("המקור","JSON תקין")}
  catch(e){
    const m=/position (\d+)/.exec(e.message);
    const p=m?+m[1]:-1;
    step("המקור פגום",e.message.slice(0,60));
    if(p>=0)step("סביבת התקלה",JSON.stringify(txt.slice(Math.max(0,p-40),p+40)));
  }
  const fixed=fixTokJSON(txt);
  step("אחרי תיקון",fixed.length+" תווים"+(fixed===txt?" (ללא שינוי)":""));
  try{JSON.parse(fixed);step("התוצאה","JSON תקין")}
  catch(e){throw new Error("התיקון לא הצליח: "+e.message.slice(0,60))}
  await c.put(url,jsonRes(fixed));
  const back=await c.match(url);
  if(!back)throw new Error("הכתיבה למטמון נכשלה");
  const bt=await back.text();
  step("קריאה חוזרת",bt.length+" תווים");
  try{JSON.parse(bt);step("במטמון","JSON תקין ✓")}
  catch(e){
    await c.delete(url);
    throw new Error("מה שנשמר במטמון פגום: "+e.message.slice(0,60));
  }
  out.ok=true;
  return out;
}
let nerLoad=async function(){
  if(NERP)return NERP;
  if(nerEnv().local)throw new Error("מקובץ מקומי אי אפשר לטעון את המודל");
  NERSTATE="loading";
  NERP=(async()=>{
    // בלי זה הדפדפן רשאי למחוק את המודל כשהמקום נגמר, והוא יירד שוב. בלי לחכות לתשובה: Firefox
    // שואל את המשתמש בחלון קופץ ולא עונה עד שהוא בוחר, ומי שלא בחר חיכה למודל לנצח (בדיקה ב-Firefox, 10.10)
    nerPersist();
    nerHookFetch();
    try{ const dropped=await nerMigrateCache(); if(dropped)console.log("מודל: "+dropped+" קבצים של מודל קודם נמחקו מהמטמון"); }
    catch(e){ console.warn('ניקוי המטמון נכשל',e); }
    try{ await nerPrepTokenizer(); }
    catch(e){ console.warn('הכנת הטוקנייזר נכשלה',e); }
    const t=await import(/* webpackIgnore: true */ NER_LIB);
    // המודל נטען מהאתר עצמו, models/<id>/: "מרוחק" מבחינת transformers.js, באותו מקור מבחינתנו
    t.env.allowLocalModels=false;
    t.env.allowRemoteModels=true;
    t.env.remoteHost=NER_BASE();
    t.env.remotePathTemplate="{model}/";
    t.env.useBrowserCache=true;
    await nerRuntime(t);
    const seen={};
    const pipe=await t.pipeline("token-classification",NER_SPEC.id,{
      dtype:"q8",
      progress_callback:p=>{
        if(p.status==="progress"&&p.file){
          // לפי בייטים, לא ממוצע של קבצים: הקבצים הקטנים נגמרים מיד וממוצע
          // כזה קפץ ל-76% ואז זחל דרך קובץ המשקולות היחיד (130MB)
          seen[p.file]={loaded:p.loaded||0,total:p.total||0,pct:p.progress||0};
          const v=Object.values(seen), tot=v.reduce((a,b)=>a+b.total,0);
          const pct=tot?100*v.reduce((a,b)=>a+b.loaded,0)/tot:v.reduce((a,b)=>a+b.pct,0)/v.length;
          const mb=x=>(x/1048576).toFixed(0);
          // "פעם אחת בלבד" הבטיח יותר מדי (ביקורת UX #6): הורדה שנקטעה מתחילה מאפס. מה שנכון:
          // אחרי הורדה שלמה המודל נשמר ולא יורד שוב.
          nerSay(tot?`מוריד את מודל הזיהוי: ${mb(v.reduce((a,b)=>a+b.loaded,0))} מתוך ${mb(tot)} MB · אחרי שיסתיים הוא נשמר במחשב`:`מוריד את מודל הזיהוי… ${Math.round(pct)}%`,pct);
        } else if(p.status==="ready")nerSay("המודל מוכן.",null);
      }});
    const w=await nerVerifyWeights();
    if(w==="verified")console.log("מודל: קובץ המשקולות נבדק מול הגרסה הנעולה");
    NERSTATE="ready";
    return pipe;
  })().catch(e=>{NERP=null;NERSTATE="error";throw e});
  return NERP;
};
// הורדה שנתקעה (UX #6): "לנסות שוב" צריך טעינה חדשה, לא את ההבטחה התקועה.
// הבקשה הישנה ממשיכה ברקע עד שהדפדפן מוותר; אם היא תסתיים, המטמון שלה ישמש.
function nerReset(){
  if(NERSTATE==="ready")return false;
  NERP=null; NERSTATE="off"; return true;
}
/* transformers.js לא בהכרח מחזיר היסטי מיקום ולא בהכרח מאחד תת-מילים,
   בניגוד לגרסה בפייתון. אם נסמוך על זה נקבל אפס תוצאות בלי שום שגיאה —
   וזה בדיוק סוג הכשל השקט שהכלי הזה לא יכול להרשות לעצמו.
   לכן: אם יש היסטים משתמשים בהם, ואם אין מיישרים את הטוקנים לטקסט לבד.

   היישור נעשה על עותק מנורמל של הטקסט, כמו שהטוקנייזר רואה אותו: בלי ניקוד וסימני הטעמה
   (NFD, בלי סימנים מצטרפים) ובאותיות קטנות, עם מפה חזרה למקום בטקסט המקורי. בלי זה "מיקה"
   של "מִיקָה" לא נמצאה במקומה אלא בהופעה מאוחרת יותר ("ומיקה תתחיל"), היישור קפץ לשם, וכל
   טוקן שביניהם לא מוקם: בקורפוס שאר הקטע כולו, וכל מה שהמודל מצא בו אבד (בדיקת המודלים).
   ואם בכל זאת טוקן נמצא רק רחוק קדימה — מעבר ליותר מילים משמספר הטוקנים שלא מוקמו רצוף לפניו,
   ועוד שתיים — הוא נשאר בלי מקום, והיישור לא זז. */
function nerNorm(text){
  let s=""; const map=[];
  for(let k=0;k<text.length;){
    const ch=String.fromCodePoint(text.codePointAt(k));
    for(const x of ch.normalize("NFD")){
      if(/\p{M}/u.test(x))continue;
      for(const y of x.toLowerCase()){ s+=y; map.push(k); }
    }
    k+=ch.length;
  }
  return {s,map};
}
const nerWordsIn=g=>(g.match(/[\p{L}\p{N}]+/gu)||[]).length;
function nerAlign(text,toks,off){
  const {s:ns,map}=nerNorm(text);
  let pos=0,pending=0;
  for(const t of toks){
    if(t.start!=null&&t.end!=null){t._s=off+t.start;t._e=off+t.end;continue}
    const w=nerNorm(String(t.word||t.token||t.text||"").replace(/^##/,"").trim()).s;
    if(!w){t._s=null;continue}
    const i=ns.indexOf(w,pos);
    if(i<0||nerWordsIn(ns.slice(pos,i))>pending+2){t._s=null;pending++;continue}
    let e=map[i+w.length-1]+1;
    while(e<text.length&&/\p{M}/u.test(text[e]))e++;   // הניקוד שאחרי האות האחרונה שייך למילה
    t._s=off+map[i]; t._e=off+e; pos=i+w.length; pending=0;
  }
}
function nerGroup(toks){
  const out=[]; let cur=null;
  for(const t of toks){
    if(t._s==null){cur=null;continue}
    // סימן פיסוק אינו חלק משם, גם כשהמודל מדביק לו תווית I-. "הילדה. מיקה"
    // ו"השופטת: הורוביץ" נולדו מכאן: הנקודה קיבלה I-PER והשרשרת נמשכה.
    const wtxt=String(t.word||t.token||t.text||"").replace(/^##/,"");
    // מקף צמוד בתוך שם ("בן-רביב", "אבו-סרחאן") שייך לשם; הקבוצה נמשכת
    // מעבר לו, ומקף שנשאר בסוף נחתך ב-trimEdges.
    if(/^[-־–]$/.test(wtxt)&&cur&&t._s<=cur.e){cur.e=t._e;continue}
    if(!/[֐-׿\w]/u.test(wtxt)){cur=null;continue}
    const raw=String(t.entity_group||t.entity||"");
    const type=raw.replace(/^[BI]-/,"");
    // המודל מתייג רק את תת-המילה הראשונה של כל מילה, וההמשכים ("##אן", "##טה")
    // חוזרים כ-O. תת-מילה שממשיכה את המילה של הישות הנוכחית שייכת לה בכל
    // מקרה: בלי זה "דסטה טספאיי" נשבר ל"דס" ול"טס", ההרחבה לגבול המילה מחזירה
    // שתי מילים נפרדות, והשם המלא לא מגיע לרשימה. זה היה הכשל השכיח ביותר
    // בגבולות המקטעים (94 מ-329 מופעים בקורפוס), לא פיסוק ולא קצה קטע.
    const sub=/^##/.test(String(t.word||t.token||t.text||""));
    if(sub&&cur&&t._s<=cur.e){cur.e=Math.max(cur.e,t._e);continue}
    if(!type||type==="O"){cur=null;continue}
    // תת-מילה ממשיכה את הישות; תווית B פותחת חדשה
    const cont=cur&&cur.type===type&&!/^B-/.test(raw)&&t._s<=cur.e+1;
    if(cont){cur.e=t._e;cur.score=Math.min(cur.score,+t.score)}
    else{cur={type,score:+t.score,s:t._s,e:t._e};out.push(cur)}
  }
  return out;
}
// הפלט הגולמי של הריצה האחרונה, לדוח הדליפה: מה המודל חשב על מקטע שפוספס
let NER_LAST=[];
function nerLast(){return NER_LAST}
/* אות שימוש או שם אחר? (Q4 בגרסה 3) "שגורגן" הוצע לצד "גורגן" וקיבל שם בדוי משלו.
   מקפלים צורה כזאת לשם הבסיס רק כשהמודל עצמו אומר שהאות אינה חלק מהמילה:
   הטוקנייזר שלו מפצל את האות לבדה ("ש" + "##גורגן"), בעוד "שרון" הוא יחידה אחת.
   עדות נוספת: קיצוץ בקצה המקטע (המודל בלע אות שימוש), ומיקום — תור דיבור או
   תואר לפני הצורה אומרים "שם" ומונעים קיפול. רשימות השמות רק חוסמות: הימצאות
   בהן אומרת "שם", היעדרות אינה אומרת דבר. כשאין הכרעה — הצעה, לא קיפול. */
function tokPieces(pipe,word){
  const tk=pipe&&pipe.tokenizer; if(!tk)return null;
  try{
    if(typeof tk.tokenize==="function")return tk.tokenize(word);
    if(typeof tk._encode_text==="function"){const r=tk._encode_text(word); if(Array.isArray(r))return r;}
    if(typeof tk.encode==="function"&&tk.model&&typeof tk.model.convert_ids_to_tokens==="function"){
      const ids=tk.encode(word,null,{add_special_tokens:false}); return tk.model.convert_ids_to_tokens(ids);}
  }catch(_){}
  return null;
}
function namePosition(text,surface){
  const n=norm(text), s=esc(norm(surface));
  // תור דיבור: בראש שורה, אולי אחרי חותמת זמן בסוגריים; או אחרי תואר
  if(new RegExp("(?:^|\\n)\\s*(?:\\[[^\\]\\n]*\\]\\s*)?"+s+"\\s*:","u").test(n))return true;
  if(new RegExp("(?:^|\\s)"+TITLE_RX.source.replace(/^\^/,"")+s+"(?![\\u0590-\\u05ff])","u").test(n))return true;
  return false;
}
function listedName(v){
  const x=norm(v).trim();
  return (typeof KNOWN_FIRST!=="undefined"&&KNOWN_FIRST.has(x))||(typeof FEM!=="undefined"&&FEM.has(x))||
    (typeof MASC!=="undefined"&&MASC.has(x))||(typeof POOL!=="undefined"&&(POOL.he_s||[]).includes(x))||
    (typeof PLACE_BY!=="undefined"&&!!PLACE_BY[x]);
}
async function foldEvidence(pipe,out,text){
  const names=out.filter(o=>o.kind==="NAME");
  const byNorm=new Map(names.map(o=>[norm(o.value).trim(),o]));
  for(const o of names){
    const v=norm(o.value).trim();
    if(/\s/.test(v)||v.length<4||!/^[בלמושהכ]/.test(v))continue;
    const stem=v.slice(1); const base=byNorm.get(stem); if(!base)continue;
    o.prefixOf=base.value;
    let fold="unknown", why=[];
    const pieces=tokPieces(pipe,o.value);
    if(pieces&&pieces.length){
      const first=String(pieces[0]).replace(/^[▁#]+/,"");
      if(pieces.length>=2&&first===v[0]){fold="yes";why.push("tokenizer:split");}
      else {fold="no";why.push("tokenizer:whole");}
    }
    if(o.cut){ if(fold!=="no")fold="yes"; why.push("cut"); }
    if(namePosition(text,o.value)){fold="no";why.push("position");}
    if(listedName(o.value)){fold="no";why.push("listed");}
    o.fold=fold; o.foldWhy=why.join(",");
  }
}
async function nerRun(blocks,onProgress){
  const pipe=await nerLoad();
  const text=blocks.map(b=>b.text).join("\n");
  const parts=nerChunks(text);
  const ents=[]; let raw=0,withOff=0,failed=0;
  for(let i=0;i<parts.length;i++){
    const {t,off}=parts[i];
    let res;
    try{res=await pipe(t,{ignore_labels:[]})}
    catch(e){console.warn("קטע נכשל",e);failed++;continue}
    if(!Array.isArray(res))res=res?[res]:[];
    if(!raw&&res.length)console.log("מבנה חיזוי גולמי:",JSON.stringify(res[0]));
    raw+=res.length;
    withOff+=res.filter(r=>r.start!=null).length;
    nerAlign(t,res,off);
    for(const g of nerGroup(res))ents.push({type:g.type,score:g.score,s:g.s,e:g.e});
    if(onProgress&&(i%8===0||i===parts.length-1)){
      onProgress((i+1)/parts.length*100);
      await new Promise(r=>setTimeout(r,0));
    }
  }
  /* קטע שנכשל דולג בשקט, וחלק מהמסמך לא נקרא בידי המודל בלי שדבר במסך אמר זאת (ביקורת M25,
     אותה משפחה). מודל שלא קרא אף קטע נכשל, כדי שהמסך יציג כישלון ולא רשימה ריקה; מודל שקרא
     חלק מוסר כמה קטעים לא נקראו, והמסך אומר זאת. */
  if(parts.length&&failed===parts.length)throw new Error("המודל לא הצליח לקרוא אף קטע מהמסמך");
  NER_LAST=ents.map(e=>({type:e.type,score:e.score,s:e.s,e:e.e}));
  const out=nerClean(ents,text);
  out.chunks=parts.length; out.failedChunks=failed;
  await foldEvidence(pipe,out,text);
  const chars=parts.reduce((a,p)=>a+p.t.length,0);
  console.log(`זיהוי: ${parts.length} קטעים (${chars}/${text.length} תווים) · `+
    `${raw} חיזויים גולמיים · ${withOff} עם היסט מהצינור · `+
    `${ents.length} ישויות · ${out.length} אחרי סינון`);
  if(!raw)console.log("⚠ המודל לא החזיר שום חיזוי — בדקו את מבנה הפלט למעלה");
  else if(!ents.length)console.log("⚠ חיזויים התקבלו אך לא הצליחו להתיישר לטקסט");
  return out;
}

const TITLE_RX=/^(?:עו"ד|עוה"ד|עו״ד|ד"ר|ד״ר|דר'|פרופ'|פרופ׳|פרופסור|מר|גב'|גב׳|גברת|הגב'|הגברת|הרב|הרבנית|השופט|השופטת|כב'|כבוד|ח"כ|ח״כ|חבר הכנסת|חברת הכנסת|סא"ל|רס"ן|אל"מ|משפחת|בני הזוג|הזוג|הקטין|הקטינה|המנוח|המנוחה|התובע|התובעת|הנתבע|הנתבעת|המבקש|המבקשת|המשיב|המשיבה|העד|העדה)\s+/u;
const ORG_RX=/^(?:עמותת|עמותה|מכון|חברת|חברה|בית ספר|בי"ס|ביה"ס|בית הספר|מרכז|אגודת|אגודה|קרן|מוסד|גן|מעון|פנימיית|פנימייה|ישיבת|ישיבה|קופת חולים|בנק|עיריית|מועצה|מועצת|משרד|לשכת|מרפאת|מרפאה|בית חולים|ביה"ח|מכללת|אוניברסיטת|תיכון|חטיבת)\b|\bבע"מ$/u;
// "נרות מאירות" בלי "עמותת" לפניו: שתי מילים ברבים, אף אחת אינה שם —
// זה גוף, לא אדם. שם בדוי של אדם במקום עמותה היה מבלבל את ה-AI.
function likelyOrg(v){
  const w=norm(v).split(/\s+/); if(w.length<2)return false;
  const isName=x=>FEM.has(x)||MASC.has(x)||POOL.he_s.includes(x)||AR_NAMES.has(x)||
    POOL.ar_s.includes(x)||/^(?:בן|בת|אבו|אל)-?/.test(x);
  if(w.some(isName))return false;
  return w.some(x=>/(?:ות|ים)$/.test(x)&&x.length>=4)||w.every(x=>COMMON.has(x));
}
function cleanEntry(raw){
  let v=trimEdges(raw).replace(/\s*\([^)]*\)\s*$/,"").trim(), note="";
  let m;while((m=TITLE_RX.exec(v))){v=v.slice(m[0].length).trim();note=`בלי «${m[0].trim()}»`}
  let kind="NAME";
  if(ORG_RX.test(v))kind="ORG";
  else if(likelyOrg(v)){kind="ORG";note="נראה כגוף — אם זה אדם, בחרו «אדם» ברשימת הסוג"}
  return {v:trimEdges(v),note,kind};
}

/* אותיות השימוש שה-AI מדביק לפני כינוי, בסדר שהעברית מרשה: ו, אחריה ש/כש/מש/לכש, אחריהן
   ב/ל/כ/מ, ובסוף ה — "ושלאביבה", "לכשאביבה", "ומהאביבה". עד כאן נקראו רק אות אחת, ו+אות,
   כש, מה ולכ, ו"שלאביבה ביטון" לא חזר (בדיקה בכלי החי, 6.10). "לכ" נשאר מהרשימה ההיא. */
const PRE_SEQ=(()=>{
  const o=new Set(["לכ"]);
  for(const w of ["","ו"])for(const s of ["","ש","כש","מש","לכש"])for(const p of ["","ב","ל","כ","מ"])
    for(const h of ["","ה"])if(w+s+p+h)o.add(w+s+p+h);
  return [...o].sort((a,b)=>b.length-a.length);
})();
// אחרי ב/ל/כ ה' הידיעה נבלעת ("בגפן" ל"הגפן"): כל רצף שמסתיים באחת מהן, ו"כש" מהרשימה הקודמת
const PRE_MERGED=PRE_SEQ.filter(x=>/[בלכ]$/.test(x)).concat("כש");
/* גוף התבנית של כינוי, בלי הגבולות: כל צורה של גרש וגרשיים, כל רצף של רווח או מקף בין המילים, וניקוד
   אחרי כל אות. בלי הניקוד, שם שה-AI ניקד בחלקו ("אֲבִיבָה ביטון") לא נתפס כשם מלא, ורק שם המשפחה חזר:
   אדם שאינו קיים (ביקורת, 6.10). הניקוד והטעמים בלבד, לא המקף, הפסק והנקודתיים שבאותו טווח. */
const NIKUD="[\\u0591-\\u05bd\\u05bf\\u05c1\\u05c2\\u05c4\\u05c5\\u05c7]*";
function pseudoPat(p){
  return [...p].map(c=>/['\u05f3\u2019]/.test(c)?"['\u05f3\u2019]"
    :/["\u05f4\u201d]/.test(c)?'["\u05f4\u201d]'
    :/[-\u05be\u2013\s]/.test(c)?"[-\\u05be\\u2013\\s]+"
    :/[\u05d0-\u05ea]/.test(c)?c+NIKUD:esc(c)).join("");
}
/* תווית כפי שה-AI כותב אותה: "פלוני ב׳" בלשון נקבה ("פלונית ב׳") ובלי הגרש ("פלוני ב"), והמספר
   של תווית בסוגריים בלי הגרש ("[ת"ז א]"). עד כאן חזרה רק התווית כפי שיצאה, ו"פלונית ב׳" נשארה
   בתשובה (בדיקה בכלי החי, 6.10). בלי גרש, אות שאחריה מקף או ספרה אינה מספר של תווית ("פלוני
   ב-2020"). תווית בסוגריים חוזרת גם בלי הסוגריים ("ת"ז א׳"), שה-AI מוריד בטקסט רגיל — אבל רק עם
   הגרש, כדי שמילה ואות ("מקום א") לא ייתפסו (ביקורת, 6.10). כינוי שאינו תווית: null. */
function labelPat(p){
  const MK="['\"\u05f3\u05f4\u2019\u201d]";
  const m=new RegExp("^(.+?)[\\s\u00a0]+((?:[\u05d0-\u05ea]"+MK+"?){1,3})(\\]?)$","u").exec(String(p).trim());
  if(!m||!new RegExp(MK).test(m[2]))return null;
  const head=m[1]==="פלוני"&&!m[3]?"פלונית?":/^\[/.test(m[1])&&m[3]?pseudoPat(m[1]):null;
  if(!head)return null;
  const ls=[...m[2].replace(new RegExp(MK,"g"),"")], SEP="[-\\u05be\\u2013\\s]+";
  const pat=head+SEP+
    ls.map((c,i)=>c+(i<ls.length-1?MK+"?":"(?:"+MK+"|(?![-\u05be0-9]))")).join("")+(m[3]?"\\]":"");
  if(!m[3])return pat;
  const bare=pseudoPat(m[1].slice(1))+SEP+ls.map((c,i)=>c+(i<ls.length-1?MK+"?":MK)).join("")+"(?!\\])";
  return "(?:"+pat+"|"+bare+")";
}
function pseudoRX(p){
  const pat=labelPat(p)||pseudoPat(p);
  /* גבול המילה הוא אות או ניקוד, לא כל הטווח העברי: ״ ו-׳ ו-־ (מקף) יושבים בטווח,
     ולכן כינוי בגרשיים ("״מיכל ברנע״") או אחרי מקף ("ל־מיכל") לא הוחזר — אותו סוג
     של באג כמו השם במירכאות ב-v41 (שכבה 1ב). אות שימוש יכולה לבוא עם מקף, והמקף
     נשאר איתה. */
  const L="\u0591-\u05bd\u05bf-\u05c7\u05d0-\u05ea", PRE="(?:"+PRE_SEQ.join("|")+")";
  /* בצד שבו הכינוי מסתיים בספרה או באות לטינית, גם ספרה ואות לטינית הן חלק מהמילה: תאריך
     מוזז "19.7.2020" שחזר שכתב גם את פנים "119.7.20201", ומספר זהות את פנים מספר ארוך ממנו
     (ביקורת, חשד שאומת). בצד של אות עברית ספרה נשארת גבול: "ברנע2" הוא שם עם הערת שוליים. */
  const an=c=>(c>="0"&&c<="9")||(c>="A"&&c<="Z")||(c>="a"&&c<="z");
  const LB=L+(an(p[0])?"0-9A-Za-z":""), LA=L+(an(p[p.length-1])?"0-9A-Za-z":"");
  // כינוי שמתחיל ב-ה ("הגפן") נכתב במסמך בלי ה אחרי ב/ל/כ ("בגפן", "לגפן"):
  // כך addPre כותב אותו, וכך ה-AI מעתיק אותו. הקבוצה השנייה תופסת את הצורה הזאת.
  if(p[0]==="ה"&&p.length>2)
    return new RegExp("(?<!["+LB+"])(?:("+PRE+"[-\u05be]?)?ה|((?:"+PRE_MERGED.join("|")+")[-\u05be]?))"+
      pat.slice(esc("ה").length)+"(?!["+LA+"])","gu");
  return new RegExp("(?<!["+LB+"])("+PRE+"[-\u05be]?)?"+pat+
    "(?!["+LA+"])","gu");
}
/* תאריך מוזז כפי שה-AI כותב אותו בעצמו: "16/11/2026", "16-11-2026", "16.11.26", "2026-11-16",
   "16 בנובמבר 2026", עם אפס לפני ספרה בודדת או בלעדיו. עד כאן חזר רק הכתיב שיצא מהכלי, ו-AI
   שכתב את התאריך אחרת קיבל בחזרה את התאריך המוזז (בדיקה בכלי החי, 6.10). שמות החודשים כאן רק
   לקריאה: התאריך האמיתי חוזר כפי שהמסמך כתב אותו, כמו שם. */
/* ועוד (הציד של 11.10): "לחודש"/"בחודש" ו"שנת", חודש מקוצר ("אוק׳"), "מארס", רווח אחרי המפריד, שם החודש באנגלית
   ("April 26, 2026"), וחודש ושנה בלי יום ("אפריל 2026", "04/2026") — לא בתוך תאריך מלא ("27 באפריל 2026"). תאריך
   שהוא סוף של טווח שמתחיל ביום לבד ("4-5.7.2027") אינו מוחזר: "4-22.12.2026" חצי בדוי וחצי אמיתי, תאריך שלא היה.
   הוא נשאר ברשימה של מה שלא הוחזר (leftOver) */
const MONTHS_HE=["ינואר","פברואר","מר[ץס]|מארס","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const MONTHS_EN=["jan(?:uary)?","feb(?:ruary)?","mar(?:ch)?","apr(?:il)?","may","june?","july?","aug(?:ust)?","sep(?:t(?:ember)?)?","oct(?:ober)?","nov(?:ember)?","dec(?:ember)?"];
const monRX=m=>"(?:"+MONTHS_HE[m-1]+(DATE_ABBR[m-1]?"|"+DATE_ABBR[m-1]+"['\u05f3\u2019.]":"")+")";
const NOT_RANGE_END="(?<!(?:^|[^0-9./])[0-9]{1,2}[\\s\u00a0]?[-\u2013\u2014\u05be][\\s\u00a0]?)";
// כל כתיב ש-parseDate קורא, גם תאריך במילים ותאריך בלי שנה (9.10). y: null — יום וחודש בלבד; d: null — חודש ושנה
function dateParts(s){
  const p=parseDate(s);
  return p?{d:p.d,m:p.m,y:p.y}:null;
}
const sameDay=(a,b)=>!!a&&!!b&&a.d===b.d&&a.m===b.m&&a.y===b.y;
// o.anyYear: אותו יום וחודש בכל שנה; o.range: גם סוף של טווח (לרשימה של מה שנשאר, לא להחזרה)
function dateRX(f,o){
  o=o||{};
  const z=n=>n<10?"0?"+n:String(n), M=z(f.m), S="[\\s\u00a0]";
  const Y=o.anyYear?"[0-9]{4}":String(f.y), YY=o.anyYear?"[0-9]{2}":String(f.y%100).padStart(2,"0");
  const B="0-9A-Za-z\u0591-\u05bd\u05bf-\u05c7\u05d0-\u05ea", MON=monRX(f.m), EN="(?:"+MONTHS_EN[f.m-1]+")\\.?";
  const CONN="(?:[בל]חודש"+S+"+|[בל]?[-\u05be]?)", YC=",?"+S+"+(?:ב?שנת"+S+"+)?";
  let body;
  if(f.d==null)
    body="(?<![0-9]"+S+"*(?:[בל]חודש"+S+"+|[בל][-\u05be]?)?)(?:"+MON+YC+Y+"|"+EN+",?"+S+"+"+Y+")|(?<![0-9][./-]"+S+"?)"+M+"[./-]"+Y;
  /* יום וחודש בלי שנה חוזרים רק בלי שנה: "27.4" ו"27 באפריל", לא "27/4/2026" ולא "27 באפריל 2026",
     שבהם ה-AI הוסיף שנה משלו */
  else if(f.y==null&&!o.anyYear)
    body=z(f.d)+"[./]"+M+"(?![./-]?[0-9])|"+z(f.d)+S+"+"+CONN+MON+"(?!"+YC+"[0-9])";
  else{
    const D=z(f.d);
    body=D+"(?<sep>[./-])"+S+"?"+M+"\\k<sep>"+S+"?(?:"+Y+"|"+YY+")|"+Y+"-"+M+"-"+D+"|"+D+S+"+"+CONN+MON+YC+Y+"|"+
      EN+S+"*"+D+"(?:st|nd|rd|th)?,?"+S+"+"+Y+"|"+D+"(?:st|nd|rd|th)?"+S+"+(?:of"+S+"+)?"+EN+",?"+S+"+"+Y;
  }
  return new RegExp((o.range?"":NOT_RANGE_END)+"(?<!["+B+"])(?<pre>(?:"+PRE_SEQ.join("|")+")[-\u05be]?)?(?:"+body+")(?!["+B+"])","giu");
}
/* כינוי של תאריך בכתיב שיצא: לא מתוך תאריך ארוך יותר ("27.4" של "27.4.2026", "אפריל 2026" של "27 באפריל 2026"),
   ולא כסוף של טווח. עד כאן "ביום 27.4.2026" חזר כ"ביום 12.3.2026": יום אמיתי עם שנה שה-AI המציא */
function dateGuard(p,rx){
  const f=dateParts(p);
  if(!f)return rx;
  const pre=NOT_RANGE_END+"(?<![0-9][./-])"+(f.d==null?"(?<![0-9][\\s\u00a0]*(?:[בל]חודש[\\s\u00a0]+|[בל][-\u05be]?)?)":"");
  return new RegExp(pre+rx.source+"(?![./][0-9])",rx.flags);
}
/* חלקי השם של אדם, כזוגות [חלק בדוי, חלק אמיתי]: השם הפרטי, שם המשפחה כולו ("בן פלדמן"), והמילה
   האחרונה בשם של שלוש מילים — כמו החלקים שהמעבר על המסמך מחליף. לכינוי שאינו שם של אדם — תווית,
   תאריך, מספר, יישוב, שכונה, רחוב או גוף — אין חלקים. עד כאן "ראשון" של "ראשון לציון" חזר לבדו
   ("ביום ראשון"), וכך "פלוני" של "פלוני א׳" כשם פרטי. */
function nameParts(pseudo,real){
  const pw=String(pseudo||"").trim().split(/\s+/), rw=String(real||"").trim().split(/\s+/);
  const np=norm(pw.join(" ")), nr=norm(rw.join(" "));
  if(pw.length<2||rw.length<2||!np.split(" ").every(w=>/^[\u05d0-\u05ea][\u05d0-\u05ea'-]*$/.test(w)))return [];
  if(/^(?:פלוני|פלונית|אלמוני|אלמונית)$/.test(np.split(" ")[0]))return [];
  const place=x=>!!(PLACE_BY[x]||NEIGHBORHOODS.includes(x)||STREETS.includes(x)||(typeof GAZ!=="undefined"&&GAZ.includes(x)));
  if(place(np)||place(nr)||orgHead(np)||orgHead(nr))return [];
  const out=[[pw[0],rw[0]],[pw.slice(1).join(" "),rw.slice(1).join(" ")]];
  if(pw.length>2)out.push([pw[pw.length-1],rw[rw.length-1]]);
  return out;
}
// התארים שאחריהם בא שם, בכל צורות הגרש והגרשיים, ואות שימוש לפניהם ("ולמר")
const TITLE_BEFORE="(?:"+PRE_SEQ.join("|")+")?(?:מר|גב['\u05f3\u2019]|הגב['\u05f3\u2019]|עו[\"\u05f4\u201d]ד|עוה[\"\u05f4\u201d]ד|"+
  "ד[\"\u05f4\u201d]ר|השופטת|השופט|כב['\u05f3\u2019])";
/* חלק של שם שעומד לבד. אחרי תואר — חלק של שתי אותיות ומעלה; בלי תואר — שלוש ומעלה, ומי שקורא
   לכאן בודק שאינו מילה רגילה. לפני חלק של ארבע אותיות ומעלה כל רצף של אותיות שימוש בלי ה' (שם אינו
   מיודע); לפני חלק של שלוש רק ו, ש וכש: "לכהן" ו"מכהן" הם פעלים, "בלוי" שם תואר. null: אין כלל כזה. */
function partRX(k,title){
  const L="\u0591-\u05bd\u05bf-\u05c7\u05d0-\u05ea", pat=pseudoPat(k), n=norm(k).replace(/[^\u05d0-\u05ea]/g,"").length;
  if(title)return n>=2?new RegExp("(?<=(?<!["+L+"])"+TITLE_BEFORE+"[\\s\u00a0]+)()"+pat+"(?!["+L+"])","gu"):null;
  if(n<3)return null;
  const pre=n>=4?PRE_SEQ.filter(x=>!x.endsWith("ה")):["וכש","וש","כש","ו","ש"];
  return new RegExp("(?<!["+L+"])((?:"+pre.join("|")+")[-\u05be]?)?"+pat+"(?!["+L+"])","gu");
}
/* צורות של כינוי שה-AI כותב אחרת (הציד של 11.10): "סרגי לוי" במקום "סרגיי לוי", "חווה" במקום "חוה", "סווטלנה" במקום
   "סבטלנה", "איל" במקום "אייל", "וולדימיר" במקום "ולדימיר", גרש בסוף ("ברקוביץ'"), באנגלית ("Sergei Levi") וראשי תיבות
   ("ס. לוי", "סרגיי ל."). עד כאן חזר רק שם המשפחה, ליד השם הפרטי הבדוי: "סרגי אלמגור", אדם שאינו קיים, תחת "הוחזרו".
   כל צורה היא שם שלם, שתי המילים, כדי שמילה רגילה ("שיירה") לא תחזור לבדה כאדם; צורה שהיא מילה או שם מוכר אחר אינה
   נוצרת */

function wordForms(w){
  const out=new Set(), add=v=>{if(v!==w&&v.length>=2)out.add(v)};
  // יוד או וו כפולות ↔ אחת, ואחת ↔ כפולה (לא האות הראשונה)
  add(w.replace(/יי/,"י")); add(w.replace(/(?<=.)וו/,"ו"));
  for(let i=1;i<w.length;i++)if((w[i]==="י"||w[i]==="ו")&&w[i-1]!==w[i]&&w[i+1]!==w[i])add(w.slice(0,i+1)+w[i]+w.slice(i+1));
  // ב ↔ וו באמצע שם (סבטלנה/סווטלנה), ו ↔ וו בראשו (ולדימיר/וולדימיר)
  for(let i=1;i<w.length-1;i++)if(w[i]==="ב")add(w.slice(0,i)+"וו"+w.slice(i+1));
  add(w.replace(/(?<=.)וו(?=.)/,"ב")); if(/^ו[^ו]/.test(w))add("ו"+w); if(/^וו/.test(w))add(w.slice(1));
  // גרש בסוף שם משפחה לועזי
  if(/[ץצגזש]$/.test(w))add(w+"'"); if(/'$/.test(w))add(w.slice(0,-1));
  /* הכללים רק מכפילים, מחסירים או מחליפים אות שכבר בשם: "איל" הוא "אייל" בכתיב אחר, לא שם אחר ("דנה" לא תהיה "דינה").
     מה שנפסל הוא צורה שהיא מילה ("ניר" ← "נייר") */
  return [...out].filter(v=>!COMMON.has(v)&&!STOP.has(v)&&!(typeof VRB!=="undefined"&&VRB.has(v)));
}
// הזוגות ועוד הצורות של כל אדם בשתי מילים; צורה מסומנת (שלישי), ואינה נותנת חלקים לבד (restoreNames)
function restoreForms(pairs){
  const out=pairs.map(p=>[p[0],p[1]]), have=new Set(pairs.map(p=>p[1]));
  const add=(r,f)=>{if(f&&!have.has(f)){have.add(f);out.push([r,f,1])}};
  for(const [real,fake] of pairs){
    if(!real||!fake||fake==="███")continue;
    const fw=String(fake).trim().split(/\s+/), rw=String(real).trim().split(/\s+/);
    if(fw.length!==2||rw.length<2||!nameParts(fake,real).length)continue;
    for(let i=0;i<2;i++)for(const v of wordForms(fw[i]))add(real,i?fw[0]+" "+v:v+" "+fw[1]);
    // באנגלית: האיות הלועזי של שם מהמאגר (LATIN), לא תעתיק מנוחש
    if(fw.every(w=>w.split("-").every(p=>LATIN[p.replace(/׳/g,"'")])))add(real,latinOf(fake));
    // ראשי תיבות: של השם הפרטי לפני שם המשפחה, ושל שם המשפחה אחרי השם הפרטי
    out.push([rw[0][0]+". "+rw.slice(1).join(" "),fw[0][0]+". "+fw[1],1]);
    out.push([rw.slice(0,-1).join(" ")+" "+rw[rw.length-1][0]+".",fw[0]+" "+fw[1][0]+".",1]);
  }
  return out;
}
// מרחק עריכה, לשם פרטי בדוי שה-AI שיבש (restoreNames)
function lev(a,b){
  const d=Array.from({length:a.length+1},(_,i)=>[i]);
  for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length]}
// זוגות [שם אמיתי, כינוי]. מחזיר טקסט, כמה הוחזרו, ומה לא נמצא —
// כינוי שלא נמצא הוא לא בהכרח תקלה, אבל כדאי לדעת עליו.
function restoreNames(txt,pairs){
  // כל צורה של כל אדם (restoreForms). "מה לא נמצא" נשאר של הזוגות עצמם
  const own=new Set(pairs.map(p=>p[1])); pairs=restoreForms(pairs);
  const seen=new Map(), conflict=new Set();
  for(const [real,pseudo] of pairs){
    if(!real||!pseudo||pseudo==="███")continue;
    // אותו יום בשני כתיבים ("12 במרץ 2026", "12 במרס 2026") הוא ערך אחד, לא כינוי של שניים: עד כאן לא הוחזר
    // כלל, ונרשם "שייך ליותר מאדם אחד"
    if(seen.has(pseudo)){if(seen.get(pseudo)!==real&&!sameDay(dateParts(seen.get(pseudo)),dateParts(real)))conflict.add(pseudo)}
    else seen.set(pseudo,real);
  }
  for(const k of conflict)seen.delete(k);
  /* חלק של שם לבד: "מיכל ברנע" → ה-AI כותב "ברנע", "גב' ברנע" או "מיכל". רק חלק של אדם אחד
     במיפוי; חלק של שניים, של כינוי ששני אנשים חולקים, או מילה של כינוי שאינו אדם — לא נוחש. עד
     כאן רק שם של שתי מילים בדיוק וחלק של ארבע אותיות ומעלה: "מר כהן", "רחל תעדכן", "בני הזוג
     כהן" ושני החלקים של "יפעת בן פלדמן" נשארו בדויים (בדיקה בכלי החי, 6.10).
     reals: כל החלקים האמיתיים של כל חלק של אדם, גם של חלק שלא יוחזר, בשביל מה שנשאר בתשובה (leftOver) */
  const partial=new Map(), bad=new Set(), reals=new Map();
  for(const [real,pseudo,form] of pairs){
    // צורה (restoreForms) חוזרת רק כשם שלם: אין לה חלקים לבד
    if(!real||!pseudo||pseudo==="███"||form)continue;
    const ps=nameParts(pseudo,real);
    for(const [k,v] of ps){if(!reals.has(k))reals.set(k,new Set()); reals.get(k).add(v)}
    if(conflict.has(pseudo)||!ps.length){
      for(const w of String(pseudo).trim().split(/\s+/))bad.add(w);
      for(const [k] of ps)bad.add(k);
      continue;
    }
    for(const [k,v] of ps){if(seen.has(k)||(partial.has(k)&&partial.get(k)!==v))bad.add(k);else partial.set(k,v)}
  }
  for(const k of bad)partial.delete(k);
  const longFirst=m=>[...m.entries()].sort((a,b)=>b[0].length-a[0].length);
  /* כל החזרה היא קטע של הטקסט שהודבק, וקטע שכבר נלקח לא נלקח שוב. עד כאן כל כינוי הוחלף
     בטקסט שכבר השתנה: חלק של שם נמצא בתוך שם אמיתי שחזר רגע קודם, ושם המשפחה לבד הוחלף
     בתוך שם מלא שלא נתפס ("שלאביבה ביטון" חזר כ"שלאביבה שרעבי", אדם שאינו קיים — בדיקה
     בכלי החי, 6.10). */
  const took=[], held=[];
  const free=(s,e,also)=>![took,also||[]].some(l=>l.some(t=>t[0]<e&&s<t[1]));
  const run=(rx,to,also)=>{
    let hit=0;
    for(const m of txt.matchAll(rx)){
      const s=m.index,e=s+m[0].length;
      if(!free(s,e,also))continue;
      took.push([s,e,to(m)]);hit++;
    }
    return hit;
  };
  const back=real=>m=>(m[1]||(typeof m[2]==="string"?m[2]:"")||"")+real;
  const hits=new Map();
  for(const [pseudo,real] of longFirst(seen))hits.set(pseudo,run(dateGuard(pseudo,pseudoRX(pseudo)),back(real)));
  /* כינוי מקודד בתוך כתובת — כמו שהכלי עצמו כותב שם בקישור ("…/%D7%99%D7%A2%D7%9C%20%D7%9B%D7%94%D7%9F.pdf") — חוזר
     לשם האמיתי, מקודד באותה צורה ובאותו מפריד (%20, +, _, -). עד כאן נשאר הכינוי, ולא נרשם כמה שנשאר (הסקירה של 11.10) */
  const hexI=e=>e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/%([0-9A-F]{2})/g,(m,h)=>"%(?:"+h+"|"+h.toLowerCase()+")");
  for(const [pseudo,real] of longFirst(seen)){
    if(!/[\u05d0-\u05ea]/.test(pseudo))continue;
    for(const sp of ["%20","+","_","-"]){
      const e=encodeURIComponent(pseudo).replace(/%20/g,sp), er=encodeURIComponent(real).replace(/%20/g,sp);
      hits.set(pseudo,(hits.get(pseudo)||0)+run(new RegExp(hexI(e),"g"),()=>er))}}
  // תאריך מוזז בכתיב אחר של ה-AI. יום בדוי ששני ימים אמיתיים יצאו בו (שני מסמכים בתיק, שתי הזזות)
  // חוזר רק בכתיב שיצא, כי אין לדעת לאיזה מהם התכוון
  const days=[...seen].map(([p,r])=>({p,r,f:dateParts(p),t:dateParts(r)})).filter(x=>x.f&&x.t);
  const lone=days.filter(x=>!days.some(y=>sameDay(y.f,x.f)&&!sameDay(y.t,x.t)));
  for(const x of lone)hits.set(x.p,hits.get(x.p)+run(dateRX(x.f),m=>(m.groups.pre||"")+x.r));
  let n=0;const missing=[];
  for(const [pseudo] of longFirst(seen)){const h=hits.get(pseudo); if(h)n+=h; else if(own.has(pseudo))missing.push(pseudo)}
  /* שם פרטי בדוי שה-AI שיבש, צמוד לשם המשפחה הבדוי שלו ("סרגאי לוי", "וסרגי לוי"): האדם כולו חוזר, לא שם המשפחה האמיתי
     ליד שם פרטי בדוי, אדם שאינו קיים. רק כשהמילה שלפני אינה שם מוכר אחר (אז זה אדם אחר באותה משפחה, "יעל לוי") ומרחק
     העריכה ממנה קטן */
  for(const [pseudo,real] of seen){
    const fw=pseudo.split(/\s+/), rw=String(real).split(/\s+/);
    if(!own.has(pseudo)||fw.length!==2||rw.length<2||!nameParts(pseudo,real).length)continue;
    const f=norm(fw[0]).trim(), rx=new RegExp("(?<![א-ת])([א-ת'׳]{2,})[\\s ]+"+pseudoPat(fw[1])+"(?![א-ת])","gu");
    for(const m of txt.matchAll(rx)){
      const s=m.index,e=s+m[0].length; if(!free(s,e))continue;
      const w=norm(m[1]).replace(/['׳]/g,"").trim(), near=x=>x!==f&&!KNOWN_FIRST.has(x)&&lev(x,f)<=(f.length>4?2:1);
      const pre=PFX.has(w[0])&&!near(w)&&near(w.slice(1))?m[1][0]:"";
      if(!pre&&!near(w))continue;
      took.push([s,e,pre+real]); n++;
    }
  }
  // שם מלא שנמצא בטקסט ולא נלקח — דבוק לאותיות שאינן אותיות שימוש, או עם סיומת — שומר על החלקים שלו
  for(const [,pseudo] of pairs){
    const p=typeof pseudo==="string"?pseudo.trim():"";
    if(/\s/.test(p))for(const m of txt.matchAll(new RegExp(pseudoPat(p),"gu")))held.push([m.index,m.index+m[0].length,p]);
  }
  /* חלק לבד: קודם אחרי תואר ("מר כהן"), ואחר כך בלי תואר — רק כשאינו מילה רגילה, ברשימות או בתשובה
     הזאת עצמה ("הכהן", גם אחרי אות שימוש: "והכהן"); אותה בדיקה שהמנוע עושה לשם קצר עם אות שימוש */
  const toks=new Set(), parts=longFirst(partial);
  for(const w of norm(txt).match(WRX)||[]){toks.add(w);const h=/^[וכלבמש]{1,3}(ה.+)$/.exec(w);if(h)toks.add(h[1])}
  for(const [k,v] of parts){const rx=partRX(k,true); if(rx)n+=run(rx,back(v),held)}
  for(const [k,v] of parts){const rx=partRX(k,false); if(rx&&!wordish(norm(k).trim(),toks))n+=run(rx,back(v),held)}
  let out="",at=0;
  for(const [s,e,t] of took.sort((a,b)=>a[0]-b[0])){out+=txt.slice(at,s)+t;at=e}
  const left=leftOver(txt,took,{conflict,held,bad,reals,seen,partial,toks,dates:lone});
  return {text:out+txt.slice(at),count:n,missing,conflict:[...conflict],left};
}
/* מה שנשאר בתשובה מהפרטים הבדויים שהכלי נתן ולא הוחזר, כדי שמסך ההחזרה יסמן אותו ויאמר מה לתקן ביד
   (החזרת שמות, 7.10.2026): כינוי של יותר מאדם אחד; שם מלא דבוק לאותיות שאינן אותיות שימוש ("אלירן כהןים");
   וחלק של שם שלא חוזר לבדו, כי הוא משותף לכמה אנשים או קצר משלוש אותיות (שחוזר רק אחרי תואר). מילה שהיא
   גם מילה רגילה (wordish) אינה נספרת, כמו שהיא אינה מוחזרת לבדה: "לאור האמור" אינו "אור" שנשאר; וכך מילה
   של כינוי שאינו אדם ("ראשון" של "ראשון לציון"). תאריך בדוי של שני ימים אמיתיים בכתיב
   אחר (restoreNames) אינו נספר: אין לדעת לאיזה מהם. כל פריט: הכינוי, הערך האמיתי (null כשהוא של יותר
   מאדם אחד) והמקומות שלו בטקסט שחוזר, לפי הסדר שבו הוא מופיע. tests/t.js
   ותאריך בדוי שנשאר (הציד של 11.10): בלי השנה שיצאה איתו ("4 ביולי" של "4.7.2027"), עם שנה שה-AI הוסיף ליום וחודש,
   או כסוף של טווח ("4-5.7.2027"). הוא אינו מוחזר, כי אין ודאות שזה הוא; עד כאן גם לא נאמר, והמסך כתב שלא נשאר דבר.
   tests/dateforms_t.js */
function leftOver(txt,took,{conflict,held,bad,reals,seen,partial,toks,dates}){
  const marked=[], left=[];
  const hit=(s,e)=>took.some(t=>t[0]<e&&s<t[1])||marked.some(t=>t[0]<e&&s<t[1]);
  const add=(fake,real,s,e,from)=>{
    if(hit(from,e))return;
    marked.push([s,e]);
    let it=left.find(x=>x.fake===fake);
    if(!it)left.push(it={fake,real,at:[]});
    it.at.push([s,e]);
  };
  // אותיות השימוש שלפני הכינוי אינן חלק ממנו: הן לא מסומנות
  const each=(p,real)=>{for(const m of txt.matchAll(pseudoRX(p))){
    const pre=(m[1]||"").length+(typeof m[2]==="string"?m[2].length:0);
    add(p,real,m.index+pre,m.index+m[0].length,m.index);
  }};
  for(const p of conflict)each(p,null);
  for(const [s,e,p] of held)add(p,seen.has(p)?seen.get(p):null,s,e,s);
  // חלק קצר (שתיים-שלוש אותיות) חוזר רק אחרי תואר או עם חלק מאותיות השימוש: במקום שלא חזר הוא נשאר
  const short=[...partial.keys()].filter(k=>norm(k).replace(/[^א-ת]/g,"").length<4);
  for(const k of [...bad,...short]){
    const rs=reals.get(k);
    if(!rs||seen.has(k)||wordish(norm(k).trim(),toks))continue;
    each(k,rs.size===1?[...rs][0]:null);
  }
  for(const x of dates||[]){
    if(x.f.d==null)continue;
    const other=x.f.y==null?dateRX(x.f,{anyYear:true,range:true}):dateRX({d:x.f.d,m:x.f.m,y:null},{range:true});
    for(const rx of [dateRX(x.f,{range:true}),other])for(const m of txt.matchAll(rx)){
      const pre=((m.groups&&m.groups.pre)||"").length;
      add(x.p,x.r,m.index+pre,m.index+m[0].length,m.index);
    }
  }
  // המקומות בטקסט שחוזר: כל החזרה שלפני הפריט מזיזה אותו בהפרש האורכים (פריט לעולם אינו בתוך החזרה)
  const shift=p=>took.reduce((d,[s,e,t])=>e<=p?d+t.length-(e-s):d,0);
  for(const it of left)it.at=it.at.sort((a,b)=>a[0]-b[0]).map(([s,e])=>[s+shift(s),e+shift(s)]);
  return left.sort((a,b)=>a.at[0][0]-b.at[0][0]);
}
/* זוגות ההחזרה במסך ההחזרה: המסמך שבעבודה קודם, והתיק משלים שמות ממסמכים קודמים.
   תווית ("פלוני א׳", "[ת"ז א׳]") נספרת מחדש בכל מסמך, ולכן אותה תווית יכולה להיות של
   אדם אחד בתיק ושל אחר במסמך הזה. אם שתיהן נכנסו, הכינוי נחשב "של שני אנשים" ואף אחד
   לא הוחזר (ביקורת, חשד שאומת). כינוי שהמסמך הזה כבר נתן אינו נלקח מהתיק. */
function restorePairs(caseMap,docMap){
  const out={...(docMap||{})};
  const taken=new Set(Object.values(out).map(v=>norm(String(v)).trim()));
  for(const [real,fake] of Object.entries(caseMap||{})){
    if(real in out||!fake||taken.has(norm(String(fake)).trim()))continue;
    out[real]=fake;
  }
  return out;
}


export {nerLast, hiddenPart, nerForget, VRB, COMMON, KNOWN_FIRST, NW, NWE, crc32, unzip, zip, parseXML, serXML, TEXTPART, TXT, ENC, norm, esc, flex, H, A,
  variants, validID, ibanOK, luhn, hord, POOL, WORDLIKE, FEM, MASC, fakeName, near1, HOMO, WEAK,
  findNear, mergeSignals, fakeDate, parseDate, foldEvidence, tokPieces, namePosition, nerReset, nameish, bodyNames, nerChunks, nerClean, PAT, WHYP, KINDS, KINDLBL, CANON, ckey,
  resolve, Engine, flatten, acceptTracked, stripComments, redactDocx, partName, ctxHTML, verify,
  discover, PLACES, PLACE_BY, geoMap, geoNames, placesFound, examplesOf, findPlaces, fakePlace,
  atlasTags, atlasDiff, atlasPenalty, placeKind, nerEnv, nerCached, nerPersist, nerLoad, nerRun,
  TITLE_RX, ORG_RX, likelyOrg, cleanEntry, trimEdges, pseudoRX, restoreNames, restorePairs, STOP, gender, origin, readBlocks, isTextPart};

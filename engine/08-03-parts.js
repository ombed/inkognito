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
/* קובץ מוטמע (החלטת הבעלים, 12.10, «A», הנוסח אושר; הביקורת ההנדסית): גיליון או מסמך שהודבק כאובייקט נשאר עד כאן בקובץ
   שיצא כמו שהוא, עם השמות שבו, וגם תמונת התצוגה שלו (EMF) מראה אותם. עכשיו כל אובייקט מוטמע (w:object, או w:pict שיש
   בו o:OLEObject) מוחלף במקומו בשורה «[כאן היה קובץ מוטמע, והוא הוסר]», וכל מה שתחת word/embeddings יוצא מהקובץ, עם תמונת
   התצוגה שלו כשאין לה שימוש אחר. גרף שהנתונים שלו בגיליון מוטמע שומר את מה שהוא מציג, בלי הקישור לגיליון (c:externalData),
   אחרת Word היה מתלונן על קישור לחלק שאיננו. מחזיר את החלקים שיוצאים ואת מספר הקבצים המוטמעים. tests/embedded_t.js */
const OBJ_NOTE="[כאן היה קובץ מוטמע, והוא הוסר]";
function dropObjects(files){
  const gone=new Set(), media=new Map();
  for(const f of files){
    if(!TEXTPART.test(f.name))continue;
    const s=TXT.decode(f.data); if(!/<w:object\b|OLEObject/.test(s))continue;
    const d=parseXML(s);
    const els=[...Array.from(d.getElementsByTagNameNS(W,"object")),
      ...Array.from(d.getElementsByTagNameNS(W,"pict")).filter(p=>p.getElementsByTagNameNS(O_NS,"OLEObject").length)];
    if(!els.length)continue;
    const rf=files.find(x=>x.name===f.name.replace(/[^/]+$/,m=>"_rels/"+m+".rels")), rels=rf?[...TXT.decode(rf.data).matchAll(/<Relationship\b[^>]*>/g)].map(m=>m[0]):[];
    for(const el of els){
      if(!el.parentNode)continue;
      // כל מזהה קישור בתוך האובייקט: הקובץ עצמו (o:OLEObject) ותמונת התצוגה (v:imagedata)
      const ids=new Set();
      for(const x of [el,...Array.from(el.getElementsByTagName("*"))]) for(const a of Array.from(x.attributes||[])) if(a.namespaceURI===R_NS||/^r:/.test(a.name)) ids.add(a.value);
      for(const id of ids){
        const rel=rels.find(x=>(/\bId="([^"]*)"/.exec(x)||[])[1]===id);
        let tg=rel&&!/TargetMode="External"/.test(rel)&&(/\bTarget="([^"]*)"/.exec(rel)||[])[1];
        if(!tg)continue; try{tg=decodeURIComponent(tg)}catch(_){/* כמו שהוא */}
        const name=partPath(f.name,tg);
        if(/^word\/embeddings\//.test(name))gone.add(name); else if(/^word\/media\//.test(name))media.set(name,(media.get(name)||0)+1);
      }
      const wt=d.createElementNS(W,"w:t"); wt.setAttributeNS(XMLNS,"xml:space","preserve"); wt.textContent=OBJ_NOTE;
      if(el.parentNode.localName==="r"&&el.parentNode.namespaceURI===W) el.parentNode.replaceChild(wt,el);
      else { const r=d.createElementNS(W,"w:r"); r.appendChild(wt); el.parentNode.replaceChild(r,el); }
    }
    f.data=ENC.encode(serXML(d,s));
  }
  // מה שתחת word/embeddings יוצא כולו, גם בלי אובייקט שמצביע עליו (גיליון של גרף)
  for(const f of files) if(/^word\/embeddings\//.test(f.name))gone.add(f.name);
  // תמונת תצוגה יוצאת רק כשאף אחד כבר לא משתמש בה (previewStillUsed)
  for(const [name,n] of media) if(!previewStillUsed(files,name,n))gone.add(name);
  // גרף שהגיליון שלו יוצא: בלי הקישור אליו
  if([...gone].some(n=>/^word\/embeddings\//.test(n)))
    for(const f of files) if(/^word\/charts\/[^/]+\.xml$/.test(f.name)){
      const s=TXT.decode(f.data), t=s.replace(/<c:externalData\b[^>]*\/>|<c:externalData\b[\s\S]*?<\/c:externalData>/g,"");
      if(t!==s)f.data=ENC.encode(t);
    }
  return {gone:[...gone], files:[...gone].filter(n=>/^word\/embeddings\//.test(n)).length};
}
/* תמונת תצוגה של אובייקט שהוסר נשארת כשעוד משתמשים בה: קישור נוסף אליה מעבר ל-n של האובייקטים, או אותו מזהה קישור
   שעוד כתוב בחלק אחרי שהאובייקטים יצאו ממנו. Word נותן לפעמים לתמונה בגוף הטקסט ולתמונת התצוגה של אובייקט מזהה
   אחד; נספרו רק הקישורים, התמונה יצאה, וההפניה אליה נשארה בטקסט (בדיקה חוזרת של 1.11, F3). tests/embedded_t.js */
function previewStillUsed(files,name,n){
  const b=name.split("/").pop(), relFiles=files.filter(x=>x.name.endsWith(".rels"));
  const refs=relFiles.reduce((k,x)=>k+(TXT.decode(x.data).split('/'+b+'"').length-1)+(TXT.decode(x.data).split('"'+b+'"').length-1),0);
  return refs>n||relFiles.some(rf=>relIdsTo(rf,name).some(id=>relIdWritten(files,rf.name,id)));
}
// המזהים בקובץ הקישורים rf שמובילים לחלק name
function relIdsTo(rf,name){
  const from=rf.name.replace(/_rels\/([^/]*)\.rels$/,"$1"), ids=[];
  for(const m of TXT.decode(rf.data).matchAll(/<Relationship\b[^>]*>/g)){
    let tg=(/\bTarget="([^"]*)"/.exec(m[0])||[])[1]; const id=(/\bId="([^"]*)"/.exec(m[0])||[])[1];
    if(!tg||!id||/TargetMode="External"/.test(m[0]))continue;
    try{tg=decodeURIComponent(tg)}catch(_){/* כמו שהוא */}
    if(partPath(from,tg)===name)ids.push(id);
  }
  return ids;
}
// האם המזהה id עוד כתוב כערך של תכונה בחלק שקובץ הקישורים relsName שייך לו
function relIdWritten(files,relsName,id){
  const src=files.find(x=>x.name===relsName.replace(/_rels\/([^/]*)\.rels$/,"$1"));
  return !!src&&new RegExp(`=["']${esc(id)}["']`).test(TXT.decode(src.data));
}
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

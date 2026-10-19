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
/* שגיאה בקונסול, בלי ההודעה שלה: הסוג והמקום בקוד בלבד. הודעה של שגיאה שנזרקה תוך כדי קריאת המסמך יכולה להכיל קטע
   ממנו, והקונסול אינו המקום שלו (הביקורת החיצונית של 18.10, F10). tests/console_t.js */
function errNote(e){
  if(!e||typeof e!=="object")return typeof e;
  // ההודעה יכולה להיות בכמה שורות: היא יוצאת כולה, ונשארות רק שורות של מקום בקוד («at …», «שם@קובץ:שורה:עמודה»)
  const at=String(e.stack||"").split(String(e.message||"\u0000")).join("").split("\n")
    .filter(l=>/^\s*at\s/.test(l)||/@\S+:\d+:\d+\s*$/.test(l)).slice(0,3).map(l=>l.trim()).join(" | ");
  return (e.name||"Error")+(at?" @ "+at:"");
}
// dateOut: לכל תאריך שהוחלף כאן, התאריך הבדוי שנכתב במקומו (הבדיקה האחרונה סופרת אותם, verify)
function residuePass(files,walked,subs,applied,dateOut){
  const repOf=new Map(), dateKey=new Set();
  const put=(v,r,d)=>{for(const k of [String(v||"").trim(),norm(String(v||"")).trim()]) if(k.length>=2&&!repOf.has(k)){repOf.set(k,r); if(d)dateKey.add(k)}};
  for(const r of applied)put(r.base||r.value,r.baseRep||r.rep||"",(CANON[r.type]||[r.type])[0]==="DATE");
  for(const s of subs)put(s.value,s.replacement||"[הוסר]",s.kind==="DATE");
  const vals=[...repOf.keys()].sort((a,b)=>b.length-a.length);
  const done=[];
  // EMF: הערכים, וגם כל מילה של שם בן כמה מילים, כי תוכנה כותבת לפעמים כל מילה בפקודה משלה (emfNames)
  const emfPairs=[];
  for(const v of vals){
    const r=String(repOf.get(v)); emfPairs.push([v,r,dateKey.has(v)]);
    const vw=v.split(/\s+/), rw=r.split(/\s+/);
    if(!dateKey.has(v)&&vw.length>1&&vw.length===rw.length)vw.forEach((w,i)=>{ if(w.length>=3&&!COMMON.has(norm(w)))emfPairs.push([w,rw[i],false]) });
  }
  for(const f of files){
    if(/\.emf$/i.test(f.name)){ const c=emfNames(f.data,emfPairs,dateOut); if(c){f.data=c;done.push(f.name)} continue; }
    // SVG הוא XML: הטקסט שבו מוחלף כמו בכל חלק שלא נקרא (dropSvgCopies)
    if(walked.has(f.name)||!(f.name.endsWith(".xml")||/\.svg$/i.test(f.name))||f.name==="[Content_Types].xml"||f.name==="docProps/core.xml"||f.name==="docProps/app.xml")continue;
    const o=TXT.decode(f.data); let s=o;
    for(const v of vals){
      const r=XESC(repOf.get(v)), d=dateOut&&dateKey.has(v);
      for(const form of new Set([v,XESC(v)]))
        s=s.replace(new RegExp("(?<![א-ת])"+esc(form)+"(?![א-ת])","gu"),()=>{if(d)dateOut.push(repOf.get(v)); return r});
    }
    if(s!==o){f.data=ENC.encode(s);done.push(f.name)}
  }
  return done}

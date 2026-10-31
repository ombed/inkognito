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
/* הבלוקים של חלק אחד בחבילה, לפי הסדר: הפסקאות, תוויות של גרף, טקסט חלופי וקוד שדה, טקסט שנשמר כמאפיין,
   ובסוף הבלוקים בחלופה של תיבת טקסט שזהים לבלוק בצורה עצמה */
function flatten(doc,part,ctx){
  const out=[];
  // SmartArt וגרפים כותבים פסקאות DrawingML (a:p), לא פסקאות Word
  const dml=/\/(diagrams|charts)\//.test(part);
  paragraphBlocks(doc,part,ctx,dml,out);
  // כל האלמנטים פעם אחת: השלבים שלמטה עוברים על אותה רשימה
  const all=Array.from(doc.getElementsByTagName("*"));
  if(dml)chartLabelBlocks(all,part,out);
  textOutsideParagraphs(all,part,out);
  propertyTextBlocks(all,part,out);
  markFallbackTwins(out);
  return out}
// הטקסט של פסקה אחת, החלקים שלו (spans) וסימני ההערות שמוצגים בתוכה (ins)
function paragraphText(p,ctx){
  const els=[];ownText(p,els);
  let pos=0;const spans=[],ins=[];let txt="";
  for(const el of els){
    if(el.note){const t=ctx&&noteMark(el.note,ctx.notes);if(t)ins.push({at:pos,t});continue}
    if(el.sep!==undefined){spans.push({el:el.el,s:pos,e:pos+el.sep.length,sep:true});txt+=el.sep;pos+=el.sep.length;continue}
    const t=el.textContent||"";if(!t)continue;
    spans.push({el,s:pos,e:pos+t.length,attr:null});txt+=t;pos+=t.length}
  return {txt,spans,ins}}
// בלוק לכל פסקה שיש בה טקסט, עם המספר שלה ותא הטבלה שלה
function paragraphBlocks(doc,part,ctx,dml,out){
  const T={rows:new Map(),tbls:new Map()}, counters=new Map();
  for(const p of doc.getElementsByTagNameNS(dml?DML:W,"p")){
    const {txt,spans,ins}=paragraphText(p,ctx);
    // גם פסקה ממוספרת ריקה לוקחת מספר, ולכן המונה מתקדם לפני הבדיקה אם יש בה טקסט
    const lead=ctx&&!dml&&!part.includes("glossary/")?numLead(p,ctx.num,counters):"";
    if(txt.trim()){const b={text:txt,spans,part,node:p};if(lead)b.lead=lead;if(ins.length)b.ins=ins;
      const cell=dml?null:cellOf(p,part,T); if(cell)b.cell=cell; out.push(b)}
  }}
// תוויות בגרף: שם קטגוריה או סדרה במטמון המחרוזות
// (גרף מורחב, chartEx, כותב את אותן תוויות כ-pt בתוך lvl)
function chartLabelBlocks(all,part,out){
  for(const el of all){
    const p1=el.parentNode, ln=el.localName;
    const label=(ln==="v"&&p1&&p1.localName==="pt"&&p1.parentNode&&p1.parentNode.localName==="strCache")||
                (ln==="pt"&&p1&&p1.localName==="lvl");
    if(!label)continue;
    const t=el.textContent||"";if(t.trim())out.push({text:t,spans:[{el,s:0,e:t.length,attr:null}],part});
  }}
// הטקסט החלופי, השם והכותרת של תמונה או צורה (docPr, cNvPr)
function pictureAltBlocks(el,part,out){
  for(const a of ["descr","name","title"]){const v=el.getAttribute(a);
    if(v&&v.trim())out.push({text:v,spans:[{el,s:0,e:v.length,attr:a}],
      part:part+" (טקסט חלופי)"})}}
// טקסט שנמצא מחוץ לפסקאות: טקסט חלופי של תמונה וטבלה, קוד שדה, WordArt ישן, וטקסט של מספור ושם של סגנון
function textOutsideParagraphs(all,part,out){
  for(const el of all){
    const ln=el.localName;
    if(ln==="docPr"||ln==="cNvPr")pictureAltBlocks(el,part,out);
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
      if(v&&HEB_LETTER.test(v))out.push({text:v,spans:[{el,s:0,e:v.length,attr:"w:val"}],part:part+" (הגדרות עיצוב)"})}}}
/* עוד טקסט שאדם כותב ושנשמר כמאפיין ולא כריצה (הציד של 11.10): תמונה, צורה וקו חתימה בפורמט הישן
   (VML) — טקסט חלופי, כותרת והחותם המוצע; ScreenTip של קישור; שדה טופס — ברירת מחדל, עזרה ושורת
   מצב; הבחירות ברשימה נפתחת; ושם ותיאור של רכיב מהיר. אף שכבה לא קראה אותם: שם מהרשימה נשאר בקובץ
   והפס נצבע אדום בלי דבר לתקן במסך, ושם שלא ברשימה עבר בירוק. הם נקראים כמו טקסט חלופי וקוד שדה:
   מוחלפים, ואינם מועתקים ל-AI. בתמונה, שם פרטי ושם משפחה מוצעים לה (pair), כמו בטקסט חלופי. */
function propertyTextBlocks(all,part,out){
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
      else if((ln==="name"||ln==="description")&&up&&up.localName==="docPartPr"&&HEB_LETTER.test(valW(el)||""))att(el,"w:val",valW(el)," (הגדרות עיצוב)")}}}
/* תיבת טקסט נכתבת פעמיים: הצורה (mc:Choice) וחלופה לתוכנות ישנות (mc:Fallback), ו-Word מציג רק את
   הראשונה. בלוק בחלופה שזהה לבלוק בצורה הוא אותו טקסט: הוא מקבל את אותן החלפות, ואינו מוצג, מועתק או
   נקרא שוב — הוא הגיע ל-AI פעמיים (הציד של 11.10). חלופה שכתוב בה דבר אחר נקראת כרגיל. */
function markFallbackTwins(out){
  const twins=new Map(), nodeOf=b=>b.node||(b.spans[0]&&b.spans[0].el), kind=b=>(b.spans[0]&&b.spans[0].attr)||"";
  for(const b of out){const br=altBranch(nodeOf(b));if(br&&br.localName==="Choice"){const k=br.parentNode;if(!twins.has(k))twins.set(k,[]);twins.get(k).push(b)}}
  for(const b of out){
    const br=altBranch(nodeOf(b)); if(!br||br.localName!=="Fallback")continue;
    const l=twins.get(br.parentNode)||[];
    let i=l.findIndex(x=>x.text===b.text&&kind(x)===kind(b)); if(i<0)i=l.findIndex(x=>x.text===b.text);
    // WordArt: בצורה פסקה, בחלופה כיתוב של VML. הפסקה נבדקת מעכשיו כמו כיתוב
    if(i>=0){b.dupOf=l[i];if(b.label)l[i].label=true;l.splice(i,1)}}}
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

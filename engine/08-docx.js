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
function flatten(doc,part,ctx){
  const out=[];
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
    if(txt.trim()){const b={text:txt,spans,part,node:p};if(lead)b.lead=lead;if(ins.length)b.ins=ins;out.push(b)}
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
function residuePass(files,walked,subs,applied){
  const repOf=new Map();
  const put=(v,r)=>{for(const k of [String(v||"").trim(),norm(String(v||"")).trim()]) if(k.length>=2&&!repOf.has(k))repOf.set(k,r)};
  for(const r of applied)put(r.base||r.value,r.baseRep||r.rep||"");
  for(const s of subs)put(s.value,s.replacement||"[הוסר]");
  const vals=[...repOf.keys()].sort((a,b)=>b.length-a.length);
  const done=[];
  for(const f of files){
    if(walked.has(f.name)||!f.name.endsWith(".xml")||f.name==="[Content_Types].xml"||f.name==="docProps/core.xml"||f.name==="docProps/app.xml")continue;
    const o=TXT.decode(f.data); let s=o;
    for(const v of vals){
      const r=XESC(repOf.get(v));
      for(const form of new Set([v,XESC(v)]))
        s=s.replace(new RegExp("(?<![א-ת])"+esc(form)+"(?![א-ת])","gu"),()=>r);
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
  const applied=[],flagged=[],secrets=[];
  let blocks=[];
  for(const dd of docs) blocks=blocks.concat(flatten(dd.doc,dd.f.name));
  twinParts(blocks);
  const eng=new Engine(subs,allow,opt,blocks.map(b=>b.text).join("\n"));
  // ה-XML משתנה במקום, ולכן flatten אחרי ההחלפה מחזיר את הטקסט המושחר.
  // בלי צילום מראש, סורק הגוף מציע לה בחזרה את השמות הבדויים שהמצאנו.
  const ORIG=blocks.filter(b=>!b.dupOf).map(b=>({part:b.part,text:b.text,label:!!b.label,pair:!!b.pair}));
  for(const blk of blocks){
    // החלופה של תיבת טקסט מקבלת בדיוק את ההחלפות של הצורה, ואינה נספרת שוב
    if(blk.dupOf){if(blk.dupOf.reps)applyReps(blk,blk.dupOf.reps.map(r=>r.slice()));continue}
    const hits=eng.detect(blk.text);if(!hits.length)continue;
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
        reps.push([s,e,nw]);applied.push(rec);secrets.push(h.text);
        if(h.dtext)secrets.push(h.dtext);
        if(h.base)secrets.push(h.base)}
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
    // אם התחליף מכיל את הערך ("דוד" → "דוד א׳"), סריקה חוזרת
    // תתפוס את התחליף עצמו ותכפיל אותו.
    if(v.length>=4&&!(v in sweep)&&rp&&!norm(rp).includes(v))sweep[v]={rep:rp,of:null};
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
      if(!p||p.length<2||STOP.has(p)||PLACE_BY[p]||AMBIG.has(p))return;
      if(p in sweep||!to||norm(to).includes(p))return;
      const g=partOf.get(p)||{to:new Set(),of:new Set(),wordy:wordy(p)};
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
  for(const blk of blocks2){
    if(blk.dupOf){if(blk.dupOf.reps)applyReps(blk,blk.dupOf.reps.map(r=>r.slice()));continue}
    // n0: בלי התווים שהקורא לא רואה (ניקוד, מקף רך, סימני כיוון). הסינון המהיר רץ עליו: על n, חלק של שם
    // שבתוכו תו כזה נפסל לפני שהביטוי (flex, שמדלג עליהם) הספיק לראות אותו, והחלק דלף (הציד של 11.10)
    const n=norm(blk.text),n0=n.replace(/\u0000/g,""),reps=[];
    const zones=[];
    for(const rx0 of eng.allow){rx0.lastIndex=0;let z;
      while((z=rx0.exec(n)))zones.push([z.index,z.index+z[0].length])}
    for(const w of pseudoWritten){let i=n.indexOf(w);
      while(i>=0){zones.push([i,i+w.length]);i=n.indexOf(w,i+1)}}
    for(const [o,inf] of Object.entries(sweep)){
      if(!n0.includes(o))continue;
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
        const out=inf.of?addPre(m[1]||"",nw):nw;
        reps.push([s,e,out]);
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
  const ac=addrCtx(eng,applied,vsec,sweep);
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
  rep.residue=residuePass(keep,new Set(docs.map(d=>d.f.name)),subs,applied);
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
  const ver=await verify(outBuf,vsec);
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
async function verify(buf,secrets){
  const files=await unzip(buf);
  const sec=[...new Set(secrets.filter(s=>s&&s.trim().length>=2))].map(s=>[s,norm(s)]).map(([o,nv])=>[o,nv,secretTest(nv)]);
  const leaks=[],emb=[];let n=0;
  for(const f of files){n++;
    if(/^word\/(embeddings|media)\//.test(f.name))emb.push(f.name);
    for(const enc of ["utf-8","utf-16le"]){
      let t;try{t=new TextDecoder(enc).decode(f.data)}catch(_){continue}
      /* הבדיקה קראה רק את ה-XML כמו שהוא, ושם שמפוצל בין ריצות, מופרד בטאב או כתוב
         עם קו תחתון ("רחל_פרידמן") לא נראה לה כלל (שכבה 1ב). קוראים גם את הטקסט בלי
         תגיות, כשטאב, טאב מיקום ומעבר שורה הם רווח וקו תחתון הוא רווח. */
      if(/\.(xml|rels)$/.test(f.name)&&enc==="utf-8"){
        const raw=t;
        // + הוא רווח בכתובת ("?q=דנה+שגיא"), כמו קו תחתון
        t+="\n"+t.replace(/<\/(?:w|a):p>/g,"\n").replace(/<w:(?:tab|ptab|br|cr)\b[^>]*\/>/g," ").replace(/<w:noBreakHyphen\b[^>]*\/>/g,"-").replace(/<[^>]+>/g,"")+"\n"+t.replace(/[_+]/g," ");
        // וגם כמו שדפדפן קורא כתובת: "%D7%93" הוא "ד". שם מקודד ביעד של קישור עבר את הבדיקה (הציד של 11.10)
        if(/%[0-9A-Fa-f]{2}/.test(raw)){const d=pctPlain(raw);t+="\n"+d+"\n"+d.replace(/[+_]/g," ")}
      }
      const nt=norm(t);
      for(const [o,nv,has] of sec){
        if(!nv)continue;
        if(has(nt))leaks.push({value:o,part:f.name});
      }
    }}
  const uniq=[],seen=new Set();
  for(const l of leaks){const k=l.part+"|"+l.value;if(!seen.has(k)){seen.add(k);uniq.push(l)}}
  return {passed:!uniq.length,leaks:uniq,parts:n,embedded:emb}}

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
  for(const b of blocks) for(const h of anchored(b.text)){
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    r.count++;r.why.add(h.why);
    if(h.role&&!r.role)r.role=h.role;
    if(h.g==="f")r.gf++; if(h.g==="m")r.gm++;
    if(h.anchor==="bid"||h.anchor==="role")r.conf="high";
    // דובר שחוזר, או דובר בשם מלא, הוא אדם בוודאות. דובר יחיד במילה אחת נשאר
    // הצעה: "שאלה:" או "הערה:" נראים אותו דבר עד שחוזרים.
    // דובר הוא מי שחוזר: "מועד אחרון לתגובה:" הוא תווית של טופס, גם כשיש בה שתי מילים.
    // שתי מילים בפעם אחת היו "גבוה" ומולאו אוטומטית; עכשיו רק חזרה מעלה את הביטחון.
    if(h.anchor==="speaker"){r.spk=(r.spk||0)+1; if(r.spk>=2)r.conf="high";}
    if(!r.ctx)r.ctx=ctxHTML(b.text,h.s,h.e)}
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
// האתר המאוחסן (scripts/build-hosted.js) מגיש את קובץ ה-WebAssembly בעצמו, בלי CDN, בחלקים
// מתחת לתקרת הקובץ של Cloudflare (25MiB): window.__resources.ort={base, parts:{<שם>:<חלקים>}}.
// הבתים המחוברים נבדקים מול אותו SHA-256 בדיוק; בלי ההגדרה הזאת — ה-CDN, כמו תמיד.
async function nerRuntimeBytes(f,v){
  const r=typeof window!=="undefined"&&window.__resources&&window.__resources.ort;
  const n=(r&&r.parts&&r.parts[v])||1;
  const urls=r?Array.from({length:n},(_,i)=>r.base+v+".wasm"+(n>1?".part"+(i+1):"")):[ORT_CDN+v+".wasm"];
  const bufs=[];
  for(const u of urls){
    const res=await f(u);
    if(!res.ok)throw new Error("לא הצלחתי להוריד את ספריית ההרצה ("+res.status+")");
    bufs.push(new Uint8Array(await res.arrayBuffer()));
  }
  if(bufs.length===1)return bufs[0].buffer;
  const out=new Uint8Array(bufs.reduce((s,b)=>s+b.length,0)); let o=0;
  for(const b of bufs){ out.set(b,o); o+=b.length; }
  return out.buffer;
}
async function nerRuntime(t){
  const safari=/^((?!chrome|android).)*safari/i.test((typeof navigator!=="undefined"&&navigator.userAgent)||"");
  const v=safari?"ort-wasm-simd-threaded":"ort-wasm-simd-threaded.asyncify";
  const f=RAW_FETCH||window.fetch.bind(window);
  const buf=await nerRuntimeBytes(f,v);
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
const MONTHS_HE=["ינואר","פברואר","מר[ץס]","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
// כל כתיב ש-parseDate קורא, גם תאריך במילים ותאריך בלי שנה (9.10). y: null — יום וחודש בלבד
function dateParts(s){
  const p=parseDate(s);
  return p?{d:p.d,m:p.m,y:p.y}:null;
}
const sameDay=(a,b)=>!!a&&!!b&&a.d===b.d&&a.m===b.m&&a.y===b.y;
function dateRX(f){
  const z=n=>n<10?"0?"+n:String(n), D=z(f.d), M=z(f.m);
  const Y=f.y==null?"":String(f.y), YY=f.y==null?"":String(f.y%100).padStart(2,"0");
  const B="0-9A-Za-z\u0591-\u05bd\u05bf-\u05c7\u05d0-\u05ea";
  /* יום וחודש בלי שנה חוזרים רק בלי שנה: "27.4" ו"27 באפריל", לא "27/4/2026" ולא "27 באפריל 2026",
     שבהם ה-AI הוסיף שנה משלו */
  const body=f.y==null?D+"[./]"+M+"(?![./-]?[0-9])|"+D+"\\s+[בל]?[-\u05be]?"+MONTHS_HE[f.m-1]+"(?!,?\\s+[0-9])":
    D+"(?<sep>[./-])"+M+"\\k<sep>(?:"+Y+"|"+YY+")|"+Y+"-"+M+"-"+D+"|"+
    D+"\\s+[בל]?"+MONTHS_HE[f.m-1]+",?\\s+"+Y;
  return new RegExp("(?<!["+B+"])(?<pre>(?:"+PRE_SEQ.join("|")+")[-\u05be]?)?(?:"+body+")(?!["+B+"])","gu");
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
// זוגות [שם אמיתי, כינוי]. מחזיר טקסט, כמה הוחזרו, ומה לא נמצא —
// כינוי שלא נמצא הוא לא בהכרח תקלה, אבל כדאי לדעת עליו.
function restoreNames(txt,pairs){
  const seen=new Map(), conflict=new Set();
  for(const [real,pseudo] of pairs){
    if(!real||!pseudo||pseudo==="███")continue;
    if(seen.has(pseudo)&&seen.get(pseudo)!==real)conflict.add(pseudo);
    else seen.set(pseudo,real);
  }
  for(const k of conflict)seen.delete(k);
  /* חלק של שם לבד: "מיכל ברנע" → ה-AI כותב "ברנע", "גב' ברנע" או "מיכל". רק חלק של אדם אחד
     במיפוי; חלק של שניים, של כינוי ששני אנשים חולקים, או מילה של כינוי שאינו אדם — לא נוחש. עד
     כאן רק שם של שתי מילים בדיוק וחלק של ארבע אותיות ומעלה: "מר כהן", "רחל תעדכן", "בני הזוג
     כהן" ושני החלקים של "יפעת בן פלדמן" נשארו בדויים (בדיקה בכלי החי, 6.10).
     reals: כל החלקים האמיתיים של כל חלק של אדם, גם של חלק שלא יוחזר, בשביל מה שנשאר בתשובה (leftOver) */
  const partial=new Map(), bad=new Set(), reals=new Map();
  for(const [real,pseudo] of pairs){
    if(!real||!pseudo||pseudo==="███")continue;
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
  for(const [pseudo,real] of longFirst(seen))hits.set(pseudo,run(pseudoRX(pseudo),back(real)));
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
  for(const x of days)if(!days.some(y=>sameDay(y.f,x.f)&&!sameDay(y.t,x.t)))
    hits.set(x.p,hits.get(x.p)+run(dateRX(x.f),m=>(m.groups.pre||"")+x.r));
  let n=0;const missing=[];
  for(const [pseudo] of longFirst(seen)){const h=hits.get(pseudo); if(h)n+=h; else missing.push(pseudo)}
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
  const left=leftOver(txt,took,{conflict,held,bad,reals,seen,partial,toks});
  return {text:out+txt.slice(at),count:n,missing,conflict:[...conflict],left};
}
/* מה שנשאר בתשובה מהפרטים הבדויים שהכלי נתן ולא הוחזר, כדי שמסך ההחזרה יסמן אותו ויאמר מה לתקן ביד
   (החזרת שמות, 7.10.2026): כינוי של יותר מאדם אחד; שם מלא דבוק לאותיות שאינן אותיות שימוש ("אלירן כהןים");
   וחלק של שם שלא חוזר לבדו, כי הוא משותף לכמה אנשים או קצר משלוש אותיות (שחוזר רק אחרי תואר). מילה שהיא
   גם מילה רגילה (wordish) אינה נספרת, כמו שהיא אינה מוחזרת לבדה: "לאור האמור" אינו "אור" שנשאר; וכך מילה
   של כינוי שאינו אדם ("ראשון" של "ראשון לציון"). תאריך בדוי של שני ימים אמיתיים בכתיב
   אחר (restoreNames) אינו נספר: אין לדעת לאיזה מהם. כל פריט: הכינוי, הערך האמיתי (null כשהוא של יותר
   מאדם אחד) והמקומות שלו בטקסט שחוזר, לפי הסדר שבו הוא מופיע. tests/t.js */
function leftOver(txt,took,{conflict,held,bad,reals,seen,partial,toks}){
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

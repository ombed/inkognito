/* ══════════════════════════ מנוע ══════════════════════════ */
// more: שמות שתווית בפסקה או בתא שלידו מעידה עליהם (labelNext), כבר במיקומים של הטקסט הזה
function findPatterns(text,on,flag,more){
  const n=norm(text),hits=[];
  if(on.has("NAME_ANCHORED")||flag.has("NAME_ANCHORED"))
    // העוגן הפרוזאי (rolep) מזין רק את ההצעות ב-discover, לא את ההשחרה: ניחוש
    // שגוי שם עולה הקשה אחת; כאן הוא היה דוחק החלפה אמיתית מאותם תווים.
    // שם לפי הקשר שמוצע לבדיקה ואין בו מילה שאינה נפוצה («ילכו», «נקלע», «משהו») אינו מוצע (worthAsking, 05-bodynames.js)
    for(const h of anchored(text).concat(more||[])){if(h.anchor==="rolep")continue;h.apply=on.has("NAME_ANCHORED");if(!h.apply&&!worthAsking(h.text))continue;hits.push(h)}
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
/* בשבועות שלמים (החלטת הבעלים, 12.10): «ביום שני, 12.3» נשאר יום שני גם אחרי ההזזה. היסט של ימים בודדים שם את
   התאריך ביום אחר בשבוע, הטקסט עוד אמר «יום שני», וה־AI חישב לפי יום שגוי (הביקורת מבחוץ, 12.10). 35 עד 399
   יום, בתוך הטווח של 30 עד 400; עדיין מסמך מסמך, לא תיק שלם. tests/dateforms_t.js */
const WEEKS0=5, WEEKS=53;
function dateOffBase(nd){ return 7*(WEEKS0+(typeof hash32==="function"?hash32(nd):0)%WEEKS); }
function dateOffFor(nd){
  const base=dateOffBase(nd);
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
  for(let i=0;i<WEEKS;i++){
    const off=7*(WEEKS0+(base/7-WEEKS0+i)%WEEKS), c=clash(off,bc);
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
/* שם המשפחה של שם אמיתי, כמפתח: כל מה שאחרי השם הפרטי («לוי», «בן דוד», «כהן-לוי»). מילה אחת לבדה היא שם משפחה רק
   כשהיא לא שם פרטי מוכר. ושם בדוי מפורק לראש (השם הפרטי, ומילית אם יש: «דניאל בן») ולשם המשפחה. (sameSurname) */
const SUR_PARTS=new Set(["בן","בת","אבו","אל","דה","ואן","בר"]);
function surKeyOf(real){
  const w=norm(String(real||"")).replace(/\u0000/g,"").trim().split(/\s+/).filter(Boolean);
  if(w.length>=2)return w.slice(1).join(" ");
  return w.length===1&&!KNOWN_FIRST.has(w[0])?w[0]:null;
}
function splitFake(fake){
  const w=String(fake||"").trim().split(/\s+/).filter(Boolean);
  if(!w.length)return null;
  if(w.length===1)return {head:[],sur:(POOL.he_s.includes(w[0])||POOL.ar_s.includes(w[0]))?w[0]:null};
  const h=w.length>2&&SUR_PARTS.has(w[1])?2:1;
  return {head:w.slice(0,h),sur:w.slice(h).join(" ")};
}
class Engine{
  constructor(subs,allow,opt,docText){
    subs=subs.map(x=>({...x}));
    this.opt=opt; this.subs=subs;
    // ציטוטים של תיקים אחרים שנשארים כמו שהם (07-cite.js): redactDocx קובע אותם אחרי מעבר שמוצא מה יוחלף מחוץ להם
    this.citeKeys=null;
    // המפתח הסודי של השמות הבדויים, מהדפדפן של החשבון (setAliasKey). רק אפשרויות שמציינות אותו משנות אותו
    // (null מנקה): מנוע שנבנה בלי השדה לא יחזיר בשקט את הגזירה הציבורית, שכל אחד יכול לחשב
    if(typeof setAliasKey==="function"&&opt&&Object.prototype.hasOwnProperty.call(opt,"aliasKey")) setAliasKey(opt.aliasKey);
    // שם בדוי שכבר מופיע במסמך האמיתי הוא מלכודת: אי אפשר יהיה להחזיר
    // אותו, והוא ייראה כאילו הוא שייך למישהו. אוספים את כל מילות המסמך
    // ואוסרים עליהן.
    this.forbidden=new Set();
    /* וגם המילה בלי גרש בסופה («ברקוביץ׳» ← «ברקוביץ») ובלי אות שימוש בתחילתה («וברקוביץ» ← «ברקוביץ»): שם בדוי שהוא
       מילה אמיתית של המסמך בצורה אחרת הוא אותה מלכודת (12.10: «ברקוביץ», שם משפחה בדוי מהמאגר, נבחר לאדם אחר במסמך שבו
       «יואב ברקוביץ׳» אמיתי; בבדיקת הדפדפן של v73.13, אחד למאה מפתחות). tests/forbidden_t.js */
    if(docText)for(const w of (norm(docText).match(WRX)||[])){
      this.forbidden.add(w);
      const bare=w.replace(/['"]+$/,"");
      if(bare!==w&&bare.length>1)this.forbidden.add(bare);
      if(bare.length>=4&&PFX.has(bare[0]))this.forbidden.add(bare.slice(1));
    }
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
    // שם משפחה אמיתי ← שם המשפחה הבדוי שלו (sameSurname). מהתיק קודם: כל אדם עם תחליף, כדי שבן משפחה במסמך הבא יקבל
    // את שם המשפחה הבדוי שהמשפחה כבר קיבלה
    this.surOf=new Map();
    for(const s of subs){
      if((s.kind||"NAME")!=="NAME"||!s.replacement)continue;
      const k=surKeyOf(s.value), sp=splitFake(s.replacement);
      if(k&&sp&&sp.sur&&!this.surOf.has(k)) this.surOf.set(k,sp.sur);
    }
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
    // מה שבתוך ציטוט של תיק אחר שנשאר — שם, מספר — אינו מוחלף שם (07-cite.js)
    if(!addr&&this.citeKeys&&this.citeKeys.size){ const ks=citeSpansIn(n,this.citeKeys);
      if(ks.length)for(let i=hits.length-1;i>=0;i--)if(ks.some(([a,b])=>hits[i].s<b&&a<hits[i].e))hits.splice(i,1); }
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
  /* בני משפחה (החלטת הבעלים, 12.10, «A»; הביקורת ההנדסית): אותו שם משפחה אמיתי מקבל אותו שם משפחה בדוי, במסמך ובתיק,
     וה-AI רואה משפחה: «רונית לוי», «דוד לוי» ← «מיכל כהן», «יואב כהן». השם הפרטי נשאר של כל אחד, ולכן השם המלא נשאר
     ייחודי, ושם המשפחה לבדו חוזר בהחזרה אחד לאחד. המחיר, שהבעלים קיבלו: שני זרים עם אותו שם משפחה שכיח חולקים גם את
     הבדוי. שם משפחה בדוי מהתיק שהוא מילה במסמך הזה (forbidden) לא נלקח, ונבחר אחר. tests/surname_t.js */
  sameSurname(real,fake){
    const k=surKeyOf(real), sp=splitFake(fake);
    if(!k||!sp||!sp.sur)return fake;
    const had=this.surOf.get(k);
    if(had&&had!==sp.sur&&!norm(had).split(/\s+/).some(w=>this.forbidden.has(w))){
      const out=sp.head.concat(had).join(" ");
      this.used.add(norm(out).trim());
      return out;
    }
    if(!had)this.surOf.set(k,sp.sur);
    return fake;
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
        base=this.sameSurname(canonical,fakeName(canonical,this.gmap[canonical]||h.g,this.used,this.forbidden,this.firstish));
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


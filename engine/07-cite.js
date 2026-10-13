/* ══════════════════════════ ציטוטים ══════════════════════════ */
/* ציטוט של תיק אחר נשאר כמו שהוא (החלטת הבעלים, 13.10): «ע"א 1234/90 כהן נ' לוי, פ"ד מה(2) 233». השמות והמספר
   שבו אינם של התיק הזה, וה-AI צריך אותם כדי לקרוא את פסק הדין; עד כאן הכלי החליף את כולם. לא נשאר, ומוחלף כמו קודם:
   (1) התיק עצמו ותיקי הערכאות שלו: מספר שמופיע בכותרת, לפני «פסק-דין» / «החלטה» / «גזר-דין»;
   (2) מספר בלי צדדים: ברוב המקרים זה הליך של התיק הזה («המערער הורשע בעבר בת"פ 12345-06-15», דוגמה בדויה);
   (3) ציטוט שאחד הצדדים בו הוא שם של התיק הזה — שם מהרשימה שמופיע גם מחוץ לציטוטים: הליך קודם בין אותם צדדים
       מוביל לתיק. מילה כללית של שם חברה («פיתוח», «השקעות», «בע"מ») או של גוף ציבורי אינה קושרת ציטוט לתיק.
   ההחלטה לפי מקום, לא לפי ערך: מה שבתוך ציטוט שנשאר אינו מוחלף שם, ואותו שם מחוץ לציטוט מוחלף. הבדיקה העיוורת
   השנייה (פסקי דין פומביים, notes/blind-test-2/CITATIONS.md): על חצי הפיתוח נשארות 88% ממילות הציטוט, ואף מילה
   שצריך להחליף אינה בתוך ציטוט שנשאר. tests/cite_t.js */
const CITE_NUM="\\d{1,7}(?:[-/]\\d{1,4}){1,2}";
// אות השימוש שלפני הסוג אינה חלק מהציטוט: «בע"א …» ו«וע"א …» הם אותו ציטוט, ואותו מפתח
const CITE_HEAD=new RegExp(`(?<![א-ת"'])((?:[ובלמכשה]{1,3}-?)?)(?:${COURT})\\s*(?:\\([^)\\n]{1,25}\\)\\s*)?(${CITE_NUM}(?:\\s*(?:,|ו-?)\\s*${CITE_NUM})*)`,"gu");
// נגד: «נ'», «נ׳» (אחרי norm: נ'), «נגד»
const CITE_VS=/\s(?:נ'|נגד)\s/u;
// סוף הצד השני: פסיק, נקודה-פסיק, סוגריים, נקודה בסוף משפט, שורה חדשה, או מראה מקום (פ"ד, תק-על, פורסם בנבו…)
const CITE_END=/[,;(\[\n]|\.(?=\s|$)|\s(?:פ"ד|פד"י|תק-|תקדין|דינים|פורסם|נבו)/u;
// מילים שאינן קושרות ציטוט לתיק: כלליות של שמות חברות, גופים ציבוריים, תארים
const CITE_GENERIC=/^(?:בע"מ|חברת|חברה|החברה|חב'|ואח'?|ושות'?|פיתוח|השקעות|נכסים|החזקות|אחזקות|ייזום|יזמות|בניה|בנייה|ובניה|ובנין|הנדסה|שירותים|סחר|תעשיות|תעשייה|מערכות|טכנולוגיות|ניהול|לניהול|פרויקטים|נדל"ן|ביטוח|לביטוח|מימון|שיווק|יבוא|ייבוא|יצוא|מרכז|קבוצת|ישראל|בישראל|הלאומית|הישראלית|מדינת|היועץ|המשפטי|לממשלה|השר|שר|שרת|משרד|רשות|הרשות|עיריית|מועצה|המועצה|מנהל|פקיד|שומה|המוסד|לאומי|ועדה|הוועדה|הועדה|המקומית|המחוזית|לתכנון|ולבניה|פרקליט|פרקליטות|המדינה|משטרת|בנק|עו"ד|רו"ח|ד"ר|מר|גב'|פלוני|פלונית|אלמוני|אלמונית)$/u;
const CITE_INVIS=/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u00ad\u0000]/g;
const citeKey=s=>norm(s).replace(CITE_INVIS,"").replace(/\s+/g," ").trim();
// מילים מבחינות של ערך, כמו שהן (בלי המילים הכלליות, גם כשלפניהן אות שימוש: «ולאומי», «בבע"מ»)
const CITE_PFX=/^[ובלמכשה]/u;
function citeWords(s){
  return (norm(s).replace(CITE_INVIS,"").match(/[א-ת][א-ת"'׳״]*[א-ת']|[א-ת]{2,}/gu)||[])
    .filter(w=>w.length>=2&&!CITE_GENERIC.test(w)&&!(CITE_PFX.test(w)&&w.length>3&&CITE_GENERIC.test(w.slice(1))));
}
// אותה מילה, או אותה מילה אחרי אות שימוש אחת, בשני הכיוונים («מזרחי» ו«ומזרחי»)
const citeSame=(w,set)=>set.has(w)||(CITE_PFX.test(w)&&w.length>3&&set.has(w.slice(1)))||[...set].some(x=>CITE_PFX.test(x)&&x.length>3&&x.slice(1)===w);
// כל ציטוט מועמד בטקסט (אחרי norm): המקום, המספרים, אם יש בו צדדים, ומילות הצדדים
function citeSpans(n){
  const out=[]; CITE_HEAD.lastIndex=0; let m;
  while((m=CITE_HEAD.exec(n))){
    const s=m.index+m[1].length, after=m.index+m[0].length, nums=m[2].match(new RegExp(CITE_NUM,"g"))||[];
    const rest=n.slice(after,after+400), vs=CITE_VS.exec(rest);
    const A=vs?rest.slice(0,vs.index):"";
    if(!vs||A.includes("\n")||A.trim().split(/\s+/).length>12){out.push({s,e:after,nums,parties:false,words:[]});continue}
    const bAt=vs.index+vs[0].length, tail=rest.slice(bAt), end=tail.search(CITE_END);
    const B=end<0?tail.slice(0,80):tail.slice(0,end);
    if(!B.trim()||B.trim().split(/\s+/).length>12){out.push({s,e:after,nums,parties:false,words:[]});continue}
    out.push({s,e:after+bAt+B.replace(/\s+$/,"").length,nums,parties:true,words:citeWords(A+" "+B)});
  }
  return out;
}
/* הציטוטים שנשארים במסמך, כמפתחות (citeKey של טקסט הציטוט). text: כל המסמך; mine: הערכים שיוחלפו מחוץ לציטוטים
   (שמות, יישובים, מספרים — redactDocx מוצא אותם במעבר בלי ההגנה); replace: מפתחות שהיא ביקשה להחליף בכל זאת.
   ציטוט שיש בו ערך כזה, או מילה מבחינה שלו, אינו נשאר: אחרת הערך היה נשאר בקובץ בתוך הציטוט, והבדיקה האחרונה
   הייתה מוצאת אותו שם */
function citeKept(text,mine,replace){
  const n=norm(String(text||""));
  // הכותרת: עד השורה שהיא רק הכותרת של ההחלטה; בלעדיה, אלף וחמש מאות התווים הראשונים
  let head=-1, at=0;
  for(const l of n.split("\n")){ if(/^\s*(?:פסק[- ]?דין|החלטה|גזר[- ]?דין|הכרעת[- ]?דין)\s*:?\s*$/u.test(l)){head=at+l.length;break} at+=l.length+1; }
  if(head<0)head=Math.min(n.length,1500);
  const own=new Set(n.slice(0,head).match(new RegExp(CITE_NUM,"g"))||[]);
  const vals=[...new Set([...(mine||[])].map(v=>norm(String(v)).replace(CITE_INVIS,"").trim()).filter(v=>v.length>=2))];
  const words=new Set(); for(const v of vals)for(const w of citeWords(v))words.add(w);
  const keys=new Set();
  for(const sp of citeSpans(n)){
    if(!sp.parties||sp.s<head||sp.nums.some(x=>own.has(x))||sp.words.some(w=>citeSame(w,words)))continue;
    const k=citeKey(n.slice(sp.s,sp.e));
    if(vals.some(v=>k.includes(v))||(replace&&replace.has(k)))continue;
    keys.add(k);
  }
  return keys;
}
/* לרשימת השמות, לפני שאושרה: הציטוטים שנשארים, כששמות התיק הם המועמדים שמופיעים גם מחוץ לציטוטים. מועמד שמופיע רק
   בתוך ציטוט שנשאר (citeOnly) הוא צד לתיק אחר, ואינו נכנס לרשימה. מועמד שמופיע רק בתוך ציטוט שאינו נשאר — הצד שכנגד
   בהליך קודם של אותם צדדים — נשאר ברשימה, ומוחלף */
function citeListKeys(text,values){
  const n=norm(String(text||"")), spans=citeSpans(n).filter(x=>x.parties), outside=[];
  for(const v0 of values||[]){
    const v=norm(String(v0||"")).trim(); if(v.length<2)continue;
    for(let i=n.indexOf(v);i>=0;i=n.indexOf(v,i+1)) if(!spans.some(sp=>sp.s<=i&&i<sp.e)){outside.push(v);break}
  }
  return citeKept(text,outside,null);
}
// המקומות של הציטוטים שנשארים בטקסט אחד (אחרי norm)
function citeSpansIn(n,keys){
  if(!keys||!keys.size)return [];
  return citeSpans(n).filter(sp=>sp.parties&&keys.has(citeKey(n.slice(sp.s,sp.e)))).map(sp=>[sp.s,sp.e]);
}
// ערך שכל המופעים שלו בטקסטים הם בתוך ציטוטים שנשארים: שם של צד לתיק אחר, לא של התיק הזה
function citeOnly(value,texts,keys){
  const v=norm(String(value||"")).trim(); if(!v||!keys||!keys.size)return false;
  let seen=false;
  for(const t of texts){ const n=norm(String(t||"")); let i=n.indexOf(v); if(i<0)continue;
    const ks=citeSpansIn(n,keys);
    while(i>=0){ seen=true; if(!ks.some(([a,b])=>a<=i&&i+v.length<=b))return false; i=n.indexOf(v,i+1); } }
  return seen;
}

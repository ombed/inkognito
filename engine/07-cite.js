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
const CITE_GENERIC=/^(?:בע"מ|חברת|חברה|החברה|חב'|ואח'?|ושות'?|פיתוח|השקעות|נכסים|החזקות|אחזקות|ייזום|יזמות|בניה|בנייה|ובניה|ובנין|הנדסה|שירותים|סחר|תעשיות|תעשייה|מערכות|טכנולוגיות|ניהול|לניהול|פרויקטים|נדל"ן|ביטוח|לביטוח|מימון|שיווק|יבוא|ייבוא|יצוא|מרכז|קבוצת|ישראל|בישראל|הלאומית|הישראלית|מדינת|היועץ|המשפטי|לממשלה|השר|שר|שרת|משרד|רשות|הרשות|עיריית|מועצה|המועצה|מועצת|מנהל|פקיד|שומה|המוסד|לאומי|ועדה|הוועדה|הועדה|ועדת|ועד|המקומית|המחוזית|מחוז|לתכנון|ולבניה|פרקליט|פרקליטות|המדינה|משטרת|בנק|מע"מ|מס|הכנסה|מקרקעי|מקרקעין|הביטחון|הפנים|האוצר|החינוך|הבריאות|הרווחה|המשפטים|התחבורה|ממשלת|הממשלה|צה"ל|מפקד|המפקד|פיקוד|רשם|הרשם|יו"ר|ראש|העירייה|יהודה|שומרון|והשומרון|איו"ש|חברון|שכם|רמאללה|ג'נין|טולכרם|קלקיליה|יריחו|עו"ד|רו"ח|ד"ר|מר|גב'|פלוני|פלונית|אלמוני|אלמונית)$/u;
// מילה שאינה קושרת ציטוט לתיק: כללית (למעלה), מילת יחס או מילה נפוצה, שם פרטי לבדו, או יישוב (שמות גופים ציבוריים)
const citeDull=w=>CITE_GENERIC.test(w)||(typeof STOP!=="undefined"&&STOP.has(w))||(typeof COMMON!=="undefined"&&COMMON.has(w))||
  (typeof KNOWN_FIRST!=="undefined"&&KNOWN_FIRST.has(w))||(typeof PLACE_BY!=="undefined"&&!!PLACE_BY[w]);
const CITE_INVIS=/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u00ad\u0000]/g;
const citeKey=s=>norm(s).replace(CITE_INVIS,"").replace(/\s+/g," ").trim();
// מילים מבחינות של ערך, כמו שהן (בלי המילים הכלליות, גם כשלפניהן אות שימוש: «ולאומי», «בבע"מ»)
const CITE_PFX=/^[ובלמכשה]/u;
function citeWords(s){
  return (norm(s).replace(CITE_INVIS,"").match(/[א-ת][א-ת"'׳״]*[א-ת']|[א-ת]{2,}/gu)||[])
    .filter(w=>w.length>=2&&!citeDull(w)&&!(CITE_PFX.test(w)&&w.length>3&&citeDull(w.slice(1))));
}
// אותה מילה, או אותה מילה אחרי אות שימוש אחת, בשני הכיוונים («מזרחי» ו«ומזרחי»)
const citeSame=(w,set)=>set.has(w)||(CITE_PFX.test(w)&&w.length>3&&set.has(w.slice(1)))||[...set].some(x=>CITE_PFX.test(x)&&x.length>3&&x.slice(1)===w);
/* הצדדים הפרטיים של התיק כפי שהכותרת מונה אותם: השורות שאחרי מילת תפקיד (המערער, המשיבה, העותרים, התובע…) עד עורכי
   הדין, ההרכב או הכותרת. שופט ועורך דין אינם צד («ברק» שבהרכב אינו חוסם את «ע"א … ברק נ' …»), וגוף ציבורי לפי המילה
   שבראשו (מדינת ישראל, עיריית X, מנהל מע"מ, מועצת התכנון) אינו קושר דבר: PUBLIC_ORG אינו מכיר רבים מהם */
const CITE_ROLE=/^\s*ה(?:מערער|משיב|עותר|מבקש|נאשם|מאשים|נתבע|תובע)\S*/u;
const CITE_STOPLINE=/^\s*(?:בשם|לפני|כבוד|פסק[- ]?דין|החלטה|גזר[- ]?דין|ערעור|ערעורים|עתירה|בקשת|בקשה|תאריך|ניתן|ניתנה|בית המשפט|בבית המשפט|בית הדין|בבית הדין)/u;
const CITE_PUBHEAD=/^(?:מדינת ישראל|המדינה|היועץ|היועמ"ש|שר\s|שרת\s|השר|משרד|רשות|הרשות|עיריית|העירייה|ראש\s|מועצת|מועצה|המועצה|ועדת|הועדה|הוועדה|ועדה|ועד\s|הועד\s|מנהל|המנהל|מינהל|המינהל|מנהלת|פקיד|פרקליט|משטרת|המשטרה|המוסד|בית המשפט|בית הדין|הכנסת|ממשלת|הממשלה|מפקד|המפקד|אלוף|צבא|צה"ל|קצין|קמ"ט|לשכת|רשם|הרשם|נציב|הנציב|מבקר|הממונה|ממונה|האפוטרופוס הכללי|הקדש|ההקדש|הווקף|וקף)/u;
function citeParties(head){
  const out=new Set(); let on=false, pub=false, next=false;
  for(const raw of String(head||"").split("\n")){
    const l=raw.trim(); if(!l)continue;
    if(CITE_STOPLINE.test(l)){on=false;continue}
    // צד חדש: מה שאחרי מילת התפקיד (באותה שורה או בשורה הבאה), או אחרי מספר ברשימה. שורה אחרת ממשיכה את הצד שמעליה
    // (תא בטבלת הכותרת שנשבר לשתי שורות), ואם הוא גוף ציבורי, גם היא
    let v=l, fresh=next;
    if(CITE_ROLE.test(l)){on=true; const c=l.indexOf(":"); v=c>=0?l.slice(c+1).trim():""; fresh=true; next=!v;}
    else next=false;
    if(!on)continue;
    if(/^\d{1,2}[.)]/u.test(v)){fresh=true; v=v.replace(/^\d{1,2}[.)]\s*/u,"").trim();}
    if(!v||v.length===1||/^(?:נגד|נ\s*ג\s*ד|ו?אח'?)$/u.test(v))continue;
    if(fresh)pub=CITE_PUBHEAD.test(v)||CITE_PUBHEAD.test(v.replace(/^[ובהלמכש]/u,""));
    if(pub)continue;
    for(const w of citeWords(v))out.add(w);
  }
  return out;
}
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
  /* וגם הצדדים כפי שהכותרת מונה אותם: ציטוט של הליך קודם בין הצדדים נשאר עד כאן כשהכלי פספס את הצד במקום אחר,
     והמספר שלו דלף יחד איתו (החצי השמור של הבדיקה העיוורת השנייה: 17 → 19 מופעים של מספר התיק עצמו, 13.10) */
  const words=citeParties(n.slice(0,head)); for(const v of vals)for(const w of citeWords(v))words.add(w);
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

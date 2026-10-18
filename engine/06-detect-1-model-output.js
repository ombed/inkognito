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
  const tok=new Set(wordsOf(norm(text)));
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
    // סוג תיק לפני מספר תיק («ת"א 48213-05-25») אינו מקום ואינו גוף: המודל קרא את «ת"א» כתל אביב, והכותרת יצאה
    // «חולון 48213-05-25» (הביקורת החיצונית של 18.10, F6). ראשי התיבות נשארים, והמספר נמחק (CASE_NUMBER)
    if(COURT_SET.has(norm(v).replace(/[״]/g,'"'))&&/^\s*(?:\([^)\n]{1,12}\)\s*)?\d/.test(text.slice(en)))continue;
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
      // סיומת של חברה («… בע"מ», «… Ltd», «… ושות'») ודאית כמו מילת סוג לפני השם. עד כאן חברה כזאת עלתה רק כהצעה, וכל
      // החברות שהיו צד בפסקי הדין של הבדיקה העיוורת השנייה נשארו בטקסט כשהרשימה אושרה כמו שהוצעה (13.10)
      if(typeof ORG_HEADS!=="undefined"&&!ORG_HEADS.test(nv)&&!ORG_TAIL.test(nv))orgReview=true;
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


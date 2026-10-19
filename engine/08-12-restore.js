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
    :/[-\u05be\u2013\s]/.test(c)?"[-\\u05be\\u2013\\s\\u200b-\\u200f\\u2060\\u00ad]+"
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
  // יום או שנה במילים, ותאריך בלוח העברי (03-dates.js): ה-AI כותב תאריך כזה בספרות, או במילים בכתיב אחר, ואת העברי בלי ב
  // או בלי ה' של האלפים. בלי זה התאריך המוזז נשאר בתשובה (הביקורת החיצונית של 18.10, F2)
  if(!o.anyYear){
    if(f.d==null)body+="|(?<![0-9]"+S+"*)"+MON+YC+yearWordsRX(f.y);
    else if(f.y==null)body+="|"+dayWordsRX(f.d)+S+"+"+CONN+MON+"(?!"+YC+"(?:[0-9]|אלף))";
    else body+="|"+dayWordsRX(f.d)+S+"+"+CONN+MON+YC+"(?:"+Y+"|"+yearWordsRX(f.y)+")|"+z(f.d)+S+"+"+CONN+MON+YC+yearWordsRX(f.y)+"|"+hebDateRX(f);
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
    out.push([rw[0][0]+"' "+rw.slice(1).join(" "),fw[0][0]+"' "+fw[1],1]);
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
/* earlier: שמות בדויים של מסמכים קודמים בסשן הזה, בלי האמיתיים שלהם (המסך שומר אותם בזיכרון בלבד). מה שמהם נמצא
   בתשובה נרשם כמה שנשאר, כדי שהמסך לא יאמר שלא נשאר בה פרט בדוי (הציד של 11.10) */
/* תאריך שה-AI חישב מתאריך מוזז (החלטת הבעלים, 12.10, «A»; הביקורת ההנדסית, H2): «45 יום מ-27.4.2026, כלומר עד
   11.6.2026». 27.4.2026 חוזר, כי הכלי כתב אותו; 11.6.2026 נשאר מוזז, והמועד שהיא קוראת שגוי בהזזה של המסמך. כל
   תאריך אחר בתשובה, עד שנה לפני או אחרי התאריכים שהכלי כתב, זז אחורה באותה הזזה ומסומן לבדיקה; תאריך רחוק יותר (חוק
   משנת 1962) נשאר כמו שנכתב, וכך גם תאריך שהוא תאריך אמיתי מהרשימה (היא כתבה אותו בשאלה). ההזזה: של המסמך הפתוח
   (off, בימים), או זו שכל זוגות התאריכים הידועים מסכימים עליה; בלי הזזה אחת ודאית (תיק של כמה מסמכים) כלום לא זז.
   known: [{f, t}], חלקי התאריך הבדוי והאמיתי. מוסיף ל-took ומחזיר את מה שזז. tests/dateback_t.js
   today: היום, {d, m, y}. הוא אף פעם לא זז (החלטת הבעלים, 18.10): «היום, 18.10.2026» שה-AI כתב הוא היום שלה, לא
   תאריך שחושב מהמסמך */
const dayNum=p=>p&&p.d!=null&&p.m?Date.UTC(p.y??dateRefYear(p),p.m-1,p.d)/864e5:null;
function backDates(txt,took,known,off,today){
  const fakes=known.map(x=>dayNum(x.f)).filter(Number.isFinite);
  if(!Number.isInteger(off)||!off){
    const offs=new Set(known.map(x=>dayNum(x.f)-dayNum(x.t)).filter(Number.isFinite));
    off=offs.size===1?[...offs][0]:0;
  }
  const P=PAT.find(p=>p.n==="DATE");
  if(!off||!fakes.length||!P)return [];
  const lo=Math.min(...fakes)-366, hi=Math.max(...fakes)+366;
  const realDays=new Set(known.map(x=>dayNum(x.t)).filter(Number.isFinite)), out=[];
  // היום והחודש של תאריך שהכלי כתב, בכתיב אחר («27.4» שה-AI הוסיף לו שנה): לא כאן. הוא חוזר בכתיב שיצא, ובכל כתיב
  // אחר נרשם במה שנשאר (dateforms_t), כי השנה שהוסיף אינה שלה
  const fakeDM=new Set(known.map(x=>x.f.d+"."+x.f.m));
  const NT=norm(txt);
  for(const m of NT.matchAll(new RegExp(P.rx.source,"gu"))){
    const v=m[P.g||0]; if(!v||(P.v&&!P.v(v)))continue;
    const s=m.index+(P.g?m[0].indexOf(v):0), e=s+v.length;
    if(took.some(t=>t[0]<e&&s<t[1]))continue;
    // קצה של טווח («4-23.12.2026», «23.12-4.1»): לא מחזירים חצי טווח, כמו בתאריכים שהכלי כתב
    if(/[0-9][\s\u00a0]?[-–—־][\s\u00a0]?$/.test(NT.slice(Math.max(0,s-4),s))||/^[\s\u00a0]?[-–—־][\s\u00a0]?[0-9]/.test(NT.slice(e,e+4)))continue;
    const raw=txt.slice(s,e), p=parseDate(raw), n=dayNum(p);
    if(n==null||n<lo||n>hi||realDays.has(n)||fakeDM.has(p.d+"."+p.m)||(p.y!=null&&n===dayNum(today)))continue;
    const now=fakeDate(raw,-off); if(!now||now===raw)continue;
    took.push([s,e,now]); out.push({s,e,was:raw,now});
  }
  return out;
}
function restoreNames(txt,pairs,earlier,dateOpt){
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
  const partial=new Map(), bad=new Set(), reals=new Map(), firstOf=new Map(), ownerOf=new Map();
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
    const whole=norm(String(pseudo)).trim();
    for(const [k,v] of ps){
      if(seen.has(k)||(partial.has(k)&&partial.get(k)!==v))bad.add(k);
      /* אותו חלק לשני אנשים, וגם האמיתי שלהם אחד: שם המשפחה של משפחה (sameSurname, 12.10). הוא חוזר, ובלי בדיקת השם
         הפרטי (fitsPart): «גב' כהן» היא «גב' לוי» בין אם זו רונית ובין אם אחרת מהמשפחה */
      else if(partial.has(k)){if(ownerOf.get(k)!==whole)firstOf.delete(k);}
      else{partial.set(k,v);ownerOf.set(k,whole);firstOf.set(k,whole.split(/\s+/)[0])}
    }
  }
  for(const k of bad)partial.delete(k);
  const longFirst=m=>[...m.entries()].sort((a,b)=>b[0].length-a[0].length);
  /* כל החזרה היא קטע של הטקסט שהודבק, וקטע שכבר נלקח לא נלקח שוב. עד כאן כל כינוי הוחלף
     בטקסט שכבר השתנה: חלק של שם נמצא בתוך שם אמיתי שחזר רגע קודם, ושם המשפחה לבד הוחלף
     בתוך שם מלא שלא נתפס ("שלאביבה ביטון" חזר כ"שלאביבה שרעבי", אדם שאינו קיים — בדיקה
     בכלי החי, 6.10). */
  const took=[], held=[];
  const free=(s,e,also)=>![took,also||[]].some(l=>l.some(t=>t[0]<e&&s<t[1]));
  // fits: מה שנמצא חוזר רק כשההקשר שלו מתאים (תואר ממין אחר, אות ראשונה אחרת: fitsPart)
  const run=(rx,to,also,fits)=>{
    let hit=0;
    for(const m of txt.matchAll(rx)){
      const s=m.index,e=s+m[0].length;
      if(!free(s,e,also))continue;
      if(fits&&!fits(m))continue;
      took.push([s,e,to(m)]);hit++;
    }
    return hit;
  };
  const back=real=>m=>(m[1]||(typeof m[2]==="string"?m[2]:"")||"")+real;
  const hits=new Map();
  // המילים של התשובה, לבדיקה אם חלק של שם הוא גם מילה בה ("הכהן", גם אחרי אות שימוש: "והכהן")
  const toks=new Set();
  for(const w of wordsOf(norm(txt))){toks.add(w);const h=/^[וכלבמש]{1,3}(ה.+)$/.exec(w);if(h)toks.add(h[1])}
  /* מילה שהיא גם מילה רגילה, לפי הרשימות, לפי מאגר הכינויים עצמו (WORDISH: «דנה», «מלמד», «פרץ», «מירב», שבחר בהם מקרה
     שנשמר לפני v73.6) או לפי התשובה הזאת */
  const rwordy=k=>wordish(k,toks)||WORDISH.has(k);
  /* כינוי של מילה אחת מהמאגר של אנשים (ילדה, עובדת סוציאלית, עדה) שהוא גם מילה — מקרה שנשמר לפני v73.6 — אינו מוחזר
     בניחוש, ונרשם כמה שנשאר לבדיקה ביד: «השופטת דנה בבקשה» חזר כ«השופטת בארי», «הממצא מלמד על» כ«הממצא גולוברג על»
     (הציד של 11.10). לזוג אין סוג: כל כינוי אחר של מילה אחת (גוף, מקום, שם שאינו מילה) חוזר כמו קודם */
  const inPool=p=>Object.values(POOL).some(a=>a.includes(p));
  const wordOne=new Map();
  for(const [pseudo,real] of longFirst(seen)){
    if(/^[א-ת][א-ת'׳]*$/.test(pseudo)&&inPool(pseudo)&&rwordy(norm(pseudo).trim())){wordOne.set(pseudo,real);continue}
    hits.set(pseudo,run(dateGuard(pseudo,pseudoRX(pseudo)),back(real)));
  }
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
  // כינוי שהוא מילה (wordOne) אינו "לא נמצא": הוא נרשם כמה שנשאר, במקומות שבהם הוא בתשובה
  for(const [pseudo] of longFirst(seen)){const h=hits.get(pseudo); if(h)n+=h; else if(own.has(pseudo)&&!wordOne.has(pseudo))missing.push(pseudo)}
  /* שם פרטי בדוי שה-AI שיבש, צמוד לשם המשפחה הבדוי שלו ("סרגאי לוי", "וסרגי לוי"): האדם כולו חוזר, לא שם המשפחה האמיתי
     ליד שם פרטי בדוי, אדם שאינו קיים. רק כשהמילה שלפני אינה שם מוכר אחר (אז זה אדם אחר באותה משפחה, "יעל לוי") ומרחק
     העריכה ממנה קטן */
  for(const [pseudo,real] of seen){
    const fw=pseudo.split(/\s+/), rw=String(real).split(/\s+/);
    if(!own.has(pseudo)||fw.length!==2||rw.length<2||!nameParts(pseudo,real).length)continue;
    const f=norm(fw[0]).trim(), rx=new RegExp("(?<![א-ת])([א-ת'׳]{2,})[\\s\u00a0]+"+pseudoPat(fw[1])+"(?![א-ת])","gu");
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
  /* חלק לבד: קודם אחרי תואר ("מר כהן"), ואחר כך בלי תואר — רק כשאינו מילה רגילה, ברשימות, במאגר או בתשובה הזאת
     עצמה (rwordy). תואר ממין אחר ("השופטת לוי" לשם בדוי של גבר) או אות ראשונה אחרת ("ר' לוי" ל«סרגיי לוי») הם אדם אחר,
     ושם המשפחה אינו חוזר שם: "השופטת אלמגור" (הציד של 11.10). חלק שהוא מילה רק בתשובה הזאת ("המזרחי") נשאר, ונרשם
     במקום שבו הוא עומד לבד (toksOnly, leftOver) */
  const parts=longFirst(partial), toksOnly=new Map();
  const femF=f=>FEM.has(f)||POOL.he_f.includes(f)||POOL.ar_f.includes(f), mascF=f=>MASC.has(f)||POOL.he_m.includes(f)||POOL.ar_m.includes(f);
  const fitsPart=k=>m=>{
    const f=firstOf.get(k); if(!f)return true;
    const before=txt.slice(Math.max(0,m.index-24),m.index+((m[1]||"").length));
    const ini=/(?:^|[\s(])([א-ת])['׳’.][\s\u00a0]*$/u.exec(before);
    if(ini&&ini[1]!==f[0])return false;
    if(mascF(f)&&!femF(f)&&/(?:גב['׳’]|גברת|השופטת|הרשמת)[\s\u00a0]*$/u.test(before))return false;
    if(femF(f)&&!mascF(f)&&/(?:^|[\s(])(?:מר|השופט|הרשם)[\s\u00a0]*$/u.test(before))return false;
    return true};
  for(const [k,v] of parts){const rx=partRX(k,true); if(rx)n+=run(rx,back(v),held,fitsPart(k))}
  /* שם פרטי מהמאגר שהוא גם מילה ("מיכל") חוזר לבד כמו קודם: לבד הוא כמעט תמיד האדם ("מיכל אמרה"). שם משפחה כזה
     ("מלמד", "מזרחי", "פרץ") אינו מוחזר לבד בניחוש */
  const partWordy=(k,kk)=>wordish(kk,toks)||(WORDISH.has(kk)&&firstOf.get(k)!==kk);
  for(const [k,v] of parts){
    const rx=partRX(k,false), kk=norm(k).trim(); if(!rx)continue;
    if(!partWordy(k,kk))n+=run(rx,back(v),held,fitsPart(k));
    else if(!(WORDLIKE.has(kk)||COMMON.has(kk)||STOP.has(kk)||VRB.has(kk)))toksOnly.set(k,v);
  }
  // תאריכים שה-AI חישב מתאריכים מוזזים: זזים אחורה ומסומנים (backDates)
  const moved=backDates(txt,took,days,dateOpt&&dateOpt.off,dateOpt&&dateOpt.today);
  let out="",at=0;
  for(const [s,e,t] of took.sort((a,b)=>a[0]-b[0])){out+=txt.slice(at,s)+t;at=e}
  // כינוי של אדם שה-AI כתב באות אחת אחרת («לנדא» של «לנדאו»): לכל מילה של כינוי, שלוש אותיות ומעלה, המילה האמיתית שבמקומה
  const nearOf=new Map();
  for(const [real,pseudo] of pairs) for(const [p,r] of nameParts(pseudo,real)){
    const pw=String(p).split(/\s+/), rw=String(r).split(/\s+/);
    if(pw.length!==rw.length)continue;
    pw.forEach((w,i)=>{ const k=norm(w).trim(); if(k.length>=3&&!wordish(k,toks)&&!nearOf.has(k))nearOf.set(k,rw[i]); });
  }
  const left=leftOver(txt,took,{conflict,held,bad,reals,seen,partial,toks,dates:lone,wordOne,toksOnly,earlier,nearOf});
  // המקום של כל תאריך שזז בטקסט שחוזר: ההחלפות שלפניו משנות את האורך
  const shiftAt=p=>took.reduce((d,[s,e,t])=>e<=p?d+t.length-(e-s):d,0);
  const dates=moved.map(x=>({was:x.was,now:x.now,at:[[x.s+shiftAt(x.s),x.s+shiftAt(x.s)+x.now.length]]}));
  return {text:out+txt.slice(at),count:n,missing,conflict:[...conflict],left,dates};
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
function leftOver(txt,took,{conflict,held,bad,reals,seen,partial,toks,dates,wordOne,toksOnly,earlier,nearOf}){
  const marked=[], left=[];
  const hit=(s,e)=>took.some(t=>t[0]<e&&s<t[1])||marked.some(t=>t[0]<e&&s<t[1]);
  const add=(fake,real,s,e,from)=>{
    if(hit(from,e))return;
    marked.push([s,e]);
    let it=left.find(x=>x.fake===fake);
    if(!it)left.push(it={fake,real,at:[]});
    it.at.push([s,e]);
  };
  /* אותיות השימוש שלפני הכינוי אינן חלק ממנו: הן לא מסומנות. pre: אילו אותיות שימוש מותרות (אחרת כל אחת): לפני חלק
     של שלוש אותיות רק ו, ש, כש, כמו בהחזרה ("לכהן" הוא פועל, לא «כהן» שנשאר); "" — רק החלק לבדו */
  const each=(p,real,pre)=>{for(const m of txt.matchAll(pseudoRX(p))){
    const px=(m[1]||"")+(typeof m[2]==="string"?m[2]:""), w=norm(px.replace(/[-־]/g,"")+p).trim();
    // אות שימוש שאינה מותרת: רק כשהמילה כולה מילה מוכרת ("לכהן" פועל); "וללוי" נרשם, אולי הוא האדם
    if(pre!==undefined&&px&&!(pre&&pre.test(px))&&(pre===""||VRB.has(w)||COMMON.has(w)||STOP.has(w)||VRB.has(w.replace(/^ו/,""))))continue;
    add(p,real,m.index+px.length,m.index+m[0].length,m.index);
  }};
  for(const p of conflict)each(p,null);
  for(const [s,e,p] of held)add(p,seen.has(p)?seen.get(p):null,s,e,s);
  // כינוי של מילה אחת שהוא גם מילה, שלא הוחזר בניחוש (restoreNames): כל מקום שלו לבדיקה ביד
  for(const [p,r] of wordOne||[])each(p,r);
  // חלק שהוא מילה רק בתשובה הזאת ("המזרחי"): במקום שבו הוא עומד לבד, בלי אות שימוש
  for(const [k,v] of toksOnly||[])each(k,v,"");
  // שם בדוי של מסמך קודם בסשן (restoreNames, earlier): האמיתי אינו נשמר, והוא מסומן כמו שהוא
  for(const p of earlier||[])if(p&&!seen.has(p)&&p!=="███"){each(p,null);const it=left.find(x=>x.fake===p);if(it)it.earlier=true}
  // חלק קצר (שתיים-שלוש אותיות) חוזר רק אחרי תואר או עם חלק מאותיות השימוש: במקום שלא חזר הוא נשאר
  const short=[...partial.keys()].filter(k=>norm(k).replace(/[^א-ת]/g,"").length<4);
  for(const k of [...bad,...short]){
    const rs=reals.get(k);
    if(!rs||seen.has(k)||wordish(norm(k).trim(),toks))continue;
    each(k,rs.size===1?[...rs][0]:null,norm(k).replace(/[^א-ת]/g,"").length<4?/^(?:ו|ש|כש|וש|וכש)[-־]?$/u:undefined);
  }
  for(const x of dates||[]){
    if(x.f.d==null)continue;
    const other=x.f.y==null?dateRX(x.f,{anyYear:true,range:true}):dateRX({d:x.f.d,m:x.f.m,y:null},{range:true});
    for(const rx of [dateRX(x.f,{range:true}),other])for(const m of txt.matchAll(rx)){
      const pre=((m.groups&&m.groups.pre)||"").length;
      add(x.p,x.r,m.index+pre,m.index+m[0].length,m.index);
    }
  }
  /* כינוי שה-AI כתב באות אחת אחרת («לנדא» של «לנדאו», הביקורת החיצונית של 18.10, F12): הוא לא חזר, והמסך אמר שלא נשאר
     בתשובה פרט בדוי. הוא נרשם כמו שנכתב, עם המילה האמיתית שבמקומו, ואינו מוחזר בניחוש. לא מילה רגילה, לא אחרי אות שימוש
     שהיא חלק ממילה אחרת, ולא מה שכבר חזר או סומן (nearOf, restoreNames) */
  // ועוד אות סופית במקום רגילה («פרצ» של «פרץ»), גם בשם של שלוש אותיות; והמילה גם בלי אות שימוש לפניה («ולנדא»)
  const fin=x=>x.replace(/[ךםןףץ]/g,c=>({"ך":"כ","ם":"מ","ן":"נ","ף":"פ","ץ":"צ"})[c]);
  if(nearOf&&nearOf.size)for(const m of txt.matchAll(/(?<![א-ת])[א-ת]{3,}(?![א-ת])/gu)){
    const tok=m[0], cands=[[0,tok]];
    for(let k=1;k<=2&&k<tok.length-2&&PFX.has(tok[k-1]);k++)cands.push([k,tok.slice(k)]);
    let done=false;
    for(const [k,c] of cands){
      const w=norm(c).trim(); if(nearOf.has(w)||wordish(w,toks))continue;
      for(const [sw,real] of nearOf){
        const near=w.length>=4&&Math.abs(w.length-sw.length)<=1&&lev(w,sw)===1;
        if(!near&&!(w!==sw&&fin(w)===fin(sw)))continue;
        add(c,real,m.index+k,m.index+tok.length,m.index+k); done=true; break;
      }
      if(done)break;
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



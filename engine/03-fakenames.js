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
/* אות עם גרש שמסמנת תעתיק מערבית: ח׳ (ח'אלד), ת׳, ד׳, ז׳, ט׳, ע׳ (ע'סאן). עד 12.10 התבנית הייתה [ח'ג'ת'ד'ז'],
   שהגרש עצמו בתוכה, וכל שם עם גרש נחשב ערבי: «יואב ברקוביץ'» קיבל שם בדוי ערבי (הביקורת ההנדסית). ג׳ (ג'ון) וצ׳
   (ברקוביץ') נשארים בחוץ: הם באים גם משמות באנגלית ובסלאבית. tests/aliaskey_t.js */
function origin(v){
  const w=v.split(/[\s-]+/);
  if(w.some(x=>AR_HINT.has(x)||AR_NAMES.has(x)))return "ar";
  if(/[חתדזטע]['׳’]/.test(v))return "ar";
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
/* מפתח סודי לשמות הבדויים (החלטת הבעלים, 12.10; הביקורת ההנדסית). השם הבדוי נגזר מהשם האמיתי בקוד ציבורי בלבד,
   ולכן מי שהחזיק את הטקסט שה־AI ראה ורשימת חשודים יכול היה לחשב לכל חשוד את השם הבדוי שלו ולאשר מי במסמך; ואותו
   אדם קיבל אותו שם בדוי אצל כל עורך דין. כך גם יישוב: 1,100 יישובים, וכל יישוב בדוי היה הפיך. עם מפתח של 256 ביט
   שנשמר בדפדפן של החשבון ואינו יוצא ממנו, הגזירה היא HMAC-SHA-256: אותו שם בדוי בכל מסמך שלה, ובלי המפתח אי אפשר
   לחשב אותו. hash32 לבדו, עם המפתח בתחילתו, לא היה מספיק: המצב הפנימי שלו 32 ביט, וזה ניתן לניחוש. בלי מפתח
   (הבדיקות, Node) הגזירה כמו קודם. SHA-256 כאן סינכרוני, כי השם נבחר באמצע זיהוי סינכרוני. tests/aliaskey_t.js */
const SHA_K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,
  0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,
  0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,
  0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,
  0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256Sync(bytes){
  const l=bytes.length, pad=new Uint8Array(((l+9+63)>>6)<<6), dv=new DataView(pad.buffer), w=new Uint32Array(64);
  pad.set(bytes); pad[l]=0x80; dv.setUint32(pad.length-4,(l*8)>>>0); dv.setUint32(pad.length-8,Math.floor(l/0x20000000));
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rot=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let o=0;o<pad.length;o+=64){
    for(let i=0;i<16;i++) w[i]=dv.getUint32(o+i*4);
    for(let i=16;i<64;i++){ const a=w[i-15], b=w[i-2];
      w[i]=(w[i-16]+(rot(a,7)^rot(a,18)^(a>>>3))+w[i-7]+(rot(b,17)^rot(b,19)^(b>>>10)))|0; }
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){
      const t1=(h+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+SHA_K[i]+w[i])|0;
      const t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))|0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0; H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
  }
  const out=new Uint8Array(32), odv=new DataView(out.buffer);
  H.forEach((x,i)=>odv.setUint32(i*4,x>>>0));
  return out;
}
// HMAC-SHA-256 (RFC 2104) של s במפתח (64 תווי hex), 32 הביטים הראשונים
function hmac32(keyHex,s){
  const key=new Uint8Array(64); for(let i=0;i<32;i++) key[i]=parseInt(keyHex.slice(i*2,i*2+2),16);
  const m=new TextEncoder().encode(s), inner=new Uint8Array(64+m.length), outer=new Uint8Array(96);
  for(let i=0;i<64;i++){ inner[i]=key[i]^0x36; outer[i]=key[i]^0x5c; }
  inner.set(m,64); outer.set(sha256Sync(inner),64);
  const d=sha256Sync(outer); return ((d[0]<<24)|(d[1]<<16)|(d[2]<<8)|d[3])>>>0;
}
let ALIAS_KEY=null;
function setAliasKey(k){ ALIAS_KEY=typeof k==="string"&&/^[0-9a-f]{64}$/.test(k)?k:null; return !!ALIAS_KEY; }
function aliasSeed(s){ return ALIAS_KEY?hmac32(ALIAS_KEY,s):hash32(s); }
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
/* צעד שזר לגודל המאגר, כך שכל השמות בו נבדקים: צעד 7 על מאגר של 28 (שמות המשפחה הערביים) בדק 4 מהם בלבד. הניסיון
   הראשון לא משתנה. ואם כולם תפוסים, השם עם המספר נבדק גם הוא מול התפוסים: עד 12.10 שני אנשים יכלו לקבל אותו שם בדוי,
   וההחזרה לא ידעה למי להחזיר (הביקורת ההנדסית). tests/aliaskey_t.js */
const gcd=(a,b)=>{while(b){[a,b]=[b,a%b]}return a};
function pickFrom(arr,seed,used,forbidden){
  const n=arr.length;
  let step=7; while(gcd(step,n)!==1) step++;
  for(let k=0;k<n;k++){
    const v=arr[(seed+k*step+((seed>>>8)%3))%n];
    if(used.has(v)||forbidden.has(v)||WORDLIKE.has(v))continue;
    if(WORDISH.has(v)||(/-/.test(v)&&v.split("-").some(poolWordy)))continue;
    if(typeof PLACE_BY!=="undefined"&&PLACE_BY[v])continue;
    if(STOP.has(v))continue;
    return v}
  for(let j=0;j<89;j++){ const v=arr[seed%n]+" "+(((seed+j)%89)+11); if(!used.has(v)) return v; }
  return arr[seed%n]+" "+((seed%89)+11)+"-"+(used.size+1)}
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
  const seed=aliasSeed(norm(value).trim());
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
  const seed=aliasSeed(norm(value).trim());
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
  const s=pickFrom(surs,aliasSeed("s"+norm(value)),used,forbidden); used.add(s);
  // "אלעד בן דוד" → "דניאל בן קפלן": המילית נשארת, כי היא חלק מהמבנה
  // ולא מהזהות. שם משפחה כפול אחר → שם משפחה בדוי אחד, פשוט יותר.
  const PARTS=new Set(["בן","בת","אבו","אל","דה","ואן","בר"]);
  const out=parts.length>2&&PARTS.has(parts[1])?f+" "+parts[1]+" "+s:f+" "+s;
  used.add(out);return out}


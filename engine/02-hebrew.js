/* ══════════════════════════ עברית ══════════════════════════ */
const NM={"\u05f3":"'","\u05f4":'"',"\u2018":"'","\u2019":"'","\u201c":'"',"\u201d":'"',
  "\u05be":"-","\u2010":"-","\u2011":"-","\u2012":"-","\u2013":"-","\u2014":"-",
  "\u00a0":" ","\u2007":" ","\u202f":" "};
/* \u05ea\u05d5\u05d5\u05d9\u05dd \u05e9\u05d4\u05e7\u05d5\u05e8\u05d0 \u05dc\u05d0 \u05e8\u05d5\u05d0\u05d4 (\u05d4\u05e6\u05d9\u05d3 \u05e9\u05dc 11.10): \u05de\u05e7\u05e3 \u05e8\u05da, \u05de\u05e6\u05d8\u05e8\u05e3 \u05de\u05d9\u05dc\u05d9\u05dd, BOM, \u05d5\u05e1\u05d9\u05de\u05e0\u05d9 \u05db\u05d9\u05d5\u05d5\u05df \u2014 \u05d1\u05d9\u05d3\u05d5\u05d3 (LRI/RLI/FSI/PDI),
   \u05d4\u05d8\u05d1\u05e2\u05d4 \u05d5\u05d4\u05d9\u05e4\u05d5\u05da (LRE\u2026RLO), ALM. \u05d9\u05d9\u05e6\u05d5\u05d0 \u05e9\u05dc \u05d5\u05d5\u05d8\u05e1\u05d0\u05e4 \u05d5\u05d8\u05e7\u05e1\u05d8 \u05e9\u05d4\u05d5\u05e2\u05ea\u05e7 \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d5\u05ea \u05e2\u05d5\u05d8\u05e4\u05d9\u05dd \u05d1\u05d4\u05dd \u05e9\u05de\u05d5\u05ea \u05d5\u05de\u05e1\u05e4\u05e8\u05d9\u05dd, \u05d5-Word \u05de\u05db\u05e0\u05d9\u05e1
   \u05de\u05e7\u05e3 \u05e8\u05da \u05d1\u05d0\u05de\u05e6\u05e2 \u05de\u05d9\u05dc\u05d4. \u05e2\u05d3 \u05db\u05d0\u05df \u05e8\u05e7 LRM, RLM \u05d5-ZWSP/ZWNJ/ZWJ \u05d4\u05d9\u05d5 \u05db\u05d0\u05df: \u05e9\u05dd \u05d1\u05e8\u05e9\u05d9\u05de\u05d4 \u05e9\u05d1\u05ea\u05d5\u05db\u05d5 \u05d0\u05d5 \u05e1\u05d1\u05d9\u05d1 \u05de\u05d9\u05dc\u05d5\u05ea\u05d9\u05d5 \u05d0\u05d7\u05d3 \u05de\u05d4\u05d0\u05d7\u05e8\u05d9\u05dd \u05dc\u05d0
   \u05e0\u05de\u05e6\u05d0, \u05d5\u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df \u05d0\u05d5 \u05ea"\u05d6 \u05e9\u05d1\u05ea\u05d5\u05db\u05dd \u05ea\u05d5 \u05db\u05d6\u05d4 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05d1\u05db\u05dc\u05dc \u2014 \u05d3\u05dc\u05d9\u05e4\u05d4 \u05de\u05ea\u05d7\u05ea \u05dc\u05e4\u05e1 \u05d9\u05e8\u05d5\u05e7. detect \u05e8\u05e5 \u05e2\u05dc \u05d4\u05d8\u05e7\u05e1\u05d8 \u05d1\u05dc\u05e2\u05d3\u05d9\u05d4\u05dd (squeeze).
   \u05d4\u05de\u05e7\u05e3 \u05d4\u05e2\u05d1\u05e8\u05d9 (U+05BE) \u05d9\u05e6\u05d0 \u05de\u05d8\u05d5\u05d5\u05d7 \u05d4\u05e0\u05d9\u05e7\u05d5\u05d3: \u05d4\u05d5\u05d0 \u05de\u05e7\u05e3, NM \u05de\u05de\u05d9\u05e8 \u05d0\u05d5\u05ea\u05d5 \u05dc-"-", \u05d5"\u05dc\u05d5\u05d9\u05be\u05d0\u05d1\u05e7\u05e1\u05d9\u05e1" \u05d4\u05d5\u05d0 "\u05dc\u05d5\u05d9-\u05d0\u05d1\u05e7\u05e1\u05d9\u05e1". */
const INVIS=/[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/;
const ZAP=/[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff\u0591-\u05bd\u05bf-\u05c7]/;
function norm(t){let o="";for(const c of t) o+= ZAP.test(c)?"\u0000":(NM[c]||c);return o}
// \u05d4\u05d8\u05e7\u05e1\u05d8 \u05d1\u05dc\u05d9 \u05d4\u05ea\u05d5\u05d5\u05d9\u05dd \u05d4\u05d1\u05dc\u05ea\u05d9 \u05e0\u05e8\u05d0\u05d9\u05dd, \u05d5\u05dc\u05db\u05dc \u05ea\u05d5 \u05d1\u05d5 \u05d4\u05de\u05d9\u05e7\u05d5\u05dd \u05e9\u05dc\u05d5 \u05d1\u05d8\u05e7\u05e1\u05d8 \u05d4\u05de\u05e7\u05d5\u05e8\u05d9 (pos[i]); null \u05db\u05e9\u05d0\u05d9\u05df \u05de\u05d4 \u05dc\u05d4\u05e1\u05d9\u05e8
function squeeze(t){
  if(!INVIS.test(t)) return null;
  let o=""; const pos=[];
  for(let i=0;i<t.length;i++){ if(INVIS.test(t[i]))continue; o+=t[i]; pos.push(i); }
  return {t:o,pos};
}
/* גבול מילה. גרש וגרשיים הם חלק ממילה רק כשהם צמודים לאות משני צדדיהם (עו"ד, ג'ורג') או
   אחרי אות בסוף מילה (ברקוביץ'). מירכאה שפותחת מילה אחרי רווח היא פיסוק: עד כאן ה-" שלפני
   "אלונים" נחשבה חלק מהמילה, ושם במירכאות לא נמצא ולא הוחלף בכלל — דליפה שקטה. אות שימוש אחת
   לפני המירכאה (ש"אלונים", ב"אלונים") היא עדיין פתיחת ציטוט; שתי אותיות לפניה (עו"ד) — ראשי תיבות. */
// אות עברית צמודה לספרה היא גבול בשני הכיוונים: "פרידמן2" (מספר הערת שוליים שהודבק) הוא השם,
// ו"ת"ז034567891" או "ביום14.3.2026" (בלי רווח) הם המספר. אות ליד אות, וספרה ליד ספרה, אינן
// גבול — אחרת מספר של עשר ספרות היה נתפס כת"ז בתשע הראשונות. אות לטינית צמודה חוסמת תמיד.
// אבל אות סופית (ך ם ן ף ץ) חותמת מילה: "פרידמןהגישה" ו"עםרחל" הן שתי מילים שהרווח ביניהן נשמט. בלי זה
// השם המלא לא נמצא, רק השם הפרטי הוחלף, ושם המשפחה האמיתי יצא ליד שם פרטי בדוי, בפס ירוק (הציד של 11.10).
const FIN="\\u05da\\u05dd\\u05df\\u05e3\\u05e5";
const HB="\\u0590-\\u05ff",NW=`(?<![A-Za-z])(?!(?<=[${HB}])(?<![${FIN}])[${HB}])(?!(?<=[0-9])[0-9])(?<![${HB}A-Za-z0-9][${HB}A-Za-z0-9]")(?<![${HB}A-Za-z0-9]')`,NWE=`(?![A-Za-z])(?!(?<=[${HB}])(?<![${FIN}])[${HB}])(?!(?<=[0-9])[0-9])(?!['"][${HB}A-Za-z0-9])`;
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
// norm שומר אורך וממיר ניקוד ל-\0, ולכן תבנית שמרשה \0 בין אותיות תופסת
// "רוֹנִית" בלי לשבור את מיפוי המיקומים. רווח ומקף שקולים: "לוי-אבקסיס"
// ו"לוי אבקסיס" הם אותו אדם.
const flex=s=>[...norm(s)].map(c=>/[\s-]/.test(c)?"[\\s-]+":esc(c)).join("\u0000*");
const H=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
// ערכים בעברית מלאים בגרשיים (ת"ז, עו"ד) — אטריביוט חייב קידוד חזק יותר
const A=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const SING=["ה","ו","ב","ל","מ","כ","ש"];
const DBL=["וה","ול","וב","ומ","וכ","וש","שה","של","שב","שכ","שמ","כש","מה","לכ","בה"];
// protect: מחרוזות שאסור שווריאנט יתנגש בהן (שמות אחרים, יישובים)
function variants(name,lvl,protect){
  const out=[[name,""]]; if(lvl==="off") return out;
  const p=name.trim().split(/\s+/),head=p[0],tail=p.slice(1);
  if(!/^[\u05d0-\u05ea]/.test(head)) return out;
  const pre = lvl==="safe"?["ה","ו","ל","ב"]:SING.concat(DBL);
  const seen=new Set([name]);
  for(const x of pre){
    const v=[x+head].concat(tail).join(" ");
    if(seen.has(v))continue;
    // "רון" + ש = "שרון" — אדם אחר לגמרי. לא מייצרים התנגשות.
    if(protect&&protect.has(v))continue;
    seen.add(v);out.push([v,x]);
  }
  return out;
}
const MERGE=new Set(["ב","ל","כ","ה"]);
/* ב/ל/כ + ה' הידיעה מתמזגות ("ל+הבית" → "לבית"), אבל רק כשה-ה' היא ה' הידיעה. בשם
   יישוב או בשם של אדם היא חלק מהשם: "ברמת גן" → "ב"+"הרצליה" נתן "ברצליה" (L14 בביקורת
   השנייה), ו"להדס" היה נעשה "לדס". שם מוכר — יישוב, שם פרטי, שם מהמאגר — שומר את ה-ה'. */
function nameWithHe(rep){
  const r=norm(String(rep||"")).trim(), w=r.split(/\s+/)[0];
  return (typeof PLACE_BY!=="undefined"&&!!(PLACE_BY[r]||PLACE_BY[w]))||
    (typeof KNOWN_FIRST!=="undefined"&&KNOWN_FIRST.has(w))||
    (typeof POOL!=="undefined"&&Object.values(POOL).some(a=>a.includes(w)));
}
function addPre(pre,rep){ if(!pre)return rep; if(!rep)return pre;
  if(rep[0]==="ה"&&MERGE.has(pre[pre.length-1])&&!nameWithHe(rep)) return pre+rep.slice(1);
  return pre+rep}
/* תאריך מוזז (Q5 בגרסה 3). תאריך שנמחק הוציא מה-AI "חסר תאריך ההחלטה"; תווית לא
   נותנת לו לחשב פרקי זמן. לכן כל תאריך מלא במסמך זז באותו מספר ימים — ההיסט
   נגזר מהמסמך (30–400 יום) ולכן יציב בין הרצות, המרווחים והסדר נשמרים, וההחזרה
   מחזירה כל תאריך למקורו כמו שם. הפורמט נשמר: אותו מפריד, אותו רוחב שנה. */
/* שנה בשתי ספרות: 20xx עד עשר שנים קדימה, ואחרת 19xx. עד כאן תמיד 20xx, ותאריך לידה מוזז "8.10.95"
   שה-AI כתב "8.10.1995" או "8 באוקטובר 1995" נשאר מוזז בתשובה (ביקורת, 6.10). fakeDate ו-dateParts. */
function fullYear(s){
  const n=+s; if(String(s).length!==2)return n;
  return 2000+n<=new Date().getUTCFullYear()+10?2000+n:1900+n;
}
/* כל כתיב רגיל של תאריך, ומה שצריך כדי לכתוב תאריך מוזז באותו כתיב: "12.3.2026", "12-03-26",
   "2026-03-12", "12 במרץ 2026" (גם ל, בלי אות, פסיק, מרס), ובלי שנה — "12.3", "12 במרץ". עד כאן רק
   תאריך מספרי עם שנה היה תאריך, ו"12 במרץ 2026" או "ביום 12.3" הגיעו ל-AI אמיתיים (הבעלים, 9.10, בדוגמה
   שבדף הבית). תאריך בלי שנה נבדק מול שנה מעוברת, כדי ש-29.2 יהיה תאריך. null: אינו תאריך אמיתי. */
const DATE_MONTHS=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
/* ועוד (הציד של 11.10): "מארס", חודש מקוצר עם גרש או נקודה כמו בלוח של המחשב ("ספט׳", "ספט'", "ספט."; למרץ, מאי,
   יוני ויולי אין קיצור), "12 לחודש מרץ 2026", "12 בחודש מרץ, שנת 2026", רווח אחרי הנקודות ("12. 3. 2026"), וחודש
   ושנה בלי יום ("מרץ 2026", "03/2026"). כל אלה הגיעו ל-AI אמיתיים, אף שהעזרה מבטיחה שכל תאריך זז */
const DATE_ABBR=["ינו","פבר","","אפר","","","","אוג","ספט","אוק","נוב","דצמ"];
const DATE_MON_ALT="ינואר|פברואר|מרץ|מרס|מארס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|(?:ינו|פבר|אפר|אוג|ספט|אוק|נוב|דצמ)['.]";
function dateMonth(tok){
  if(/^(?:מרץ|מרס|מארס)$/.test(tok))return 3;
  const i=DATE_MONTHS.indexOf(tok); if(i>=0)return i+1;
  const a=/^(.+)['.]$/.exec(tok); return a&&a[1]&&DATE_ABBR.includes(a[1])?DATE_ABBR.indexOf(a[1])+1:0;
}
// החודש המוזז נכתב כמו שהמסמך כתב את החודש: מקוצר באותו סימן, ומרץ באותו כתיב
function monthWord(mo,p){
  if(p.ab&&DATE_ABBR[mo-1])return DATE_ABBR[mo-1]+p.ab;
  return mo===3&&p.mar?p.mar:DATE_MONTHS[mo-1];
}
// בלי שנה: שנה רגילה, ושנה מעוברת רק ל-29.2
const dateRefYear=p=>p.m===2&&p.d===29?2024:2025;
function parseDate(s){
  const raw=String(s||""), t=norm(raw).replace(/\u0000/g,"").trim(), lead=x=>x.length===2&&x[0]==="0";
  // הגרש של הקיצור כמו שנכתב (׳ או '), כי norm מאחד אותם
  const style=tok=>({ab:/\.$/.test(tok)?".":/'$/.test(tok)?((/[\u05f3\u2019']/.exec(raw)||["'"])[0]):null,mar:/^(?:מרס|מארס)$/.test(tok)?tok:null});
  let m,p=null;
  if((m=/^(\d{1,2})([./-])( ?)(\d{1,2})(?:\2( ?)(\d{4}|\d{2}))?$/.exec(t))&&(m[6]||(m[2]!=="-"&&!m[3])))
    p={d:+m[1],m:+m[4],y:m[6]?fullYear(m[6]):null,form:"num",sep:m[2],g1:m[3],g2:m[5]||"",y2:!!m[6]&&m[6].length===2,pd:lead(m[1]),pm:lead(m[4])};
  else if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)))
    p={d:+m[3],m:+m[2],y:+m[1],form:"iso",pd:m[3].length===2,pm:m[2].length===2};
  else if((m=new RegExp("^(\\d{1,2})(\\s*)([בל]חודש\\s+|[בל]?-?)("+DATE_MON_ALT+")(?:(,?\\s*(?:ב?שנת\\s+)?)(\\d{4}))?$").exec(t)))
    p={d:+m[1],m:dateMonth(m[4]),y:m[6]?+m[6]:null,form:"words",sp:m[2],conn:m[3],yc:m[5]||"",...style(m[4])};
  else if((m=new RegExp("^("+DATE_MON_ALT+")(,?\\s+(?:ב?שנת\\s+)?)(\\d{4})$").exec(t)))
    p={d:null,m:dateMonth(m[1]),y:+m[3],form:"mwords",yc:m[2],...style(m[1])};
  else if((m=/^(\d{1,2})([./-])(\d{4})$/.exec(t)))
    p={d:null,m:+m[1],y:+m[3],form:"mnum",sep:m[2],pm:lead(m[1])};
  if(!p||p.m<1||p.m>12)return null;
  if(p.d==null)return p;
  if(p.d<1||p.d>31)return null;
  const c=new Date(Date.UTC(p.y??dateRefYear(p),p.m-1,p.d));
  return c.getUTCDate()===p.d&&c.getUTCMonth()===p.m-1?p:null;
}
/* הערך המוזז: יום בימים; חודש ושנה בלי יום בחודשים שלמים, הכי קרוב שאפשר לאותו מספר ימים, כדי שהמרווח
   בין שני חודשים במסמך יישמר בדיוק */
function shiftDate(p,off){
  if(p.d==null){const i=p.y*12+p.m-1+Math.round(off/30.4375); return {d:null,m:i%12+1,y:Math.floor(i/12)}}
  const t=new Date(Date.UTC(p.y??dateRefYear(p),p.m-1,p.d));
  t.setUTCDate(t.getUTCDate()+off);
  return {d:t.getUTCDate(),m:t.getUTCMonth()+1,y:p.y==null?null:t.getUTCFullYear()};
}
function fakeDate(s,offDays){
  const p=parseDate(s);
  if(!p)return null;
  const {d,m:mo,y}=shiftDate(p,offDays|0), z=(n,pad)=>pad&&n<10?"0"+n:String(n);
  if(p.form==="mwords")return monthWord(mo,p)+p.yc+y;
  if(p.form==="mnum")return z(mo,p.pm)+p.sep+y;
  if(p.form==="iso")return `${y}-${z(mo,p.pm)}-${z(d,p.pd)}`;
  if(p.form==="words")return d+p.sp+p.conn+monthWord(mo,p)+(p.y==null?"":p.yc+y);
  const dm=z(d,p.pd)+p.sep+p.g1+z(mo,p.pm);
  return p.y==null?dm:dm+p.sep+p.g2+(p.y2?String(y%100).padStart(2,"0"):String(y));
}
function validID(s){const d=s.replace(/\D/g,"");if(!d||d.length>9)return false;
  if(/^0+$/.test(d)||/^(\d)\1+$/.test(d))return false;
  const p=d.padStart(9,"0");let t=0;
  for(let i=0;i<9;i++){let n=+p[i]*(i%2?2:1);t+=n<10?n:n-9}return t%10===0}
function ibanOK(s){
  const t=s.replace(/\s/g,"").toUpperCase();
  if(!/^IL\d{21}$/.test(t))return false;
  const r=t.slice(4)+t.slice(0,4);
  let m=0; for(const c of r){
    const v=/\d/.test(c)?c:String(c.charCodeAt(0)-55);
    for(const d of v) m=(m*10+ +d)%97;
  }
  return m===1;
}
// כמה ספרות יש במספר שנמצא, וחלוקה שאינה שנה. אחרי תווית כמו «חשבון» או «תיק», ארבע ספרות שהן
// שנה (2025) אינן מספר מזהה
function digitsIn(lo,hi){return s=>{const n=s.replace(/\D/g,"").length;return n>=lo&&n<=hi}}
function notYear(s){const m=/(\d[\d/-]*\d)\s*$/.exec(s);const d=m?m[1]:"";return !/^(19|20)\d\d$/.test(d)&&d.replace(/\D/g,"").length>=3}
function luhn(s){const d=s.replace(/\D/g,"");if(d.length<12||d.length>19)return false;
  let t=0,a=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];
    if(a){n*=2;if(n>9)n-=9}t+=n;a=!a}return t%10===0}
const G_ONE=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
const G_TEN=["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
const G_HUN=["","ק","ר","ש","ת"];
function hord(n){
  if(n<1||n>=500)return "\u200f"+n+"\u200f";
  let r=n,out=G_HUN[Math.floor(r/100)]||""; r%=100;
  if(r===15)out+="טו"; else if(r===16)out+="טז";
  else {out+=G_TEN[Math.floor(r/10)]; out+=G_ONE[r%10];}
  return out.length>1 ? out.slice(0,-1)+'"'+out.slice(-1) : out+"׳";
}

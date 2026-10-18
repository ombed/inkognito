/* ══════════ תאריכים במילים ובלוח העברי ══════════ */
/* תאריך שנכתב במילים («שנים עשר ביוני אלפיים עשרים וחמש», «14 בפברואר אלפיים עשרים וחמש») או בלוח העברי («כ"ג בתשרי
   תשפ"ה») לא זוהה ולא זז, והגיע ל-AI כמו שהוא. לצד אותו תאריך בספרות, שזז, הוא חשף את ההזזה של כל המסמך; ו-AI שחישב
   ממנו מועד קיבל מועד אמיתי, שההחזרה הזיזה אחורה כאילו חושב מתאריך מוזז (הביקורת החיצונית של 18.10, F2). כאן: המספרים
   במילים (יום, 1 עד 31, בזכר ובנקבה; שנה, 1900 עד 2099) והלוח העברי (ההמרה אליו וממנו והכתיב שלו באותיות). parseDate
   קורא בעזרתם, ו-fakeDate כותב את התאריך המוזז באותו כתיב. tests/datewords_t.js */

// היחידות והעשרות בכתיב התקני, שבו התאריך המוזז נכתב
const NUMW_M=["","אחד","שניים","שלושה","ארבעה","חמישה","שישה","שבעה","שמונה","תשעה"];
const NUMW_F=["","אחת","שתיים","שלוש","ארבע","חמש","שש","שבע","שמונה","תשע"];
const NUMW_TEEN_M=["עשרה","אחד עשר","שנים עשר","שלושה עשר","ארבעה עשר","חמישה עשר","שישה עשר","שבעה עשר","שמונה עשר","תשעה עשר"];
const NUMW_TEEN_F=["עשר","אחת עשרה","שתים עשרה","שלוש עשרה","ארבע עשרה","חמש עשרה","שש עשרה","שבע עשרה","שמונה עשרה","תשע עשרה"];
const NUMW_TENS=["","","עשרים","שלושים","ארבעים","חמישים","שישים","שבעים","שמונים","תשעים"];
// כתיבים נוספים של אותה מילה, שנקראים ואינם נכתבים. «שנים» לבדה אינה שתיים: היא גם «שנים» של זמן («לפני שנים בינואר»)
const NUMW_ALT={"שניים":["שנים"],"שתיים":["שתים"],"שתים":["שתיים"],"שנים":["שניים"],"שלושה":["שלשה"],"שלוש":["שלש"],
  "חמישה":["חמשה"],"שישה":["ששה"],"שלושים":["שלשים"],"שישים":["ששים"]};
// 1 עד 99 במילים; f: נקבה. ו לפני האיבר האחרון («עשרים ואחת»)
function numWords(n,f){
  if(n<10)return (f?NUMW_F:NUMW_M)[n];
  if(n<20)return (f?NUMW_TEEN_F:NUMW_TEEN_M)[n-10];
  const t=NUMW_TENS[Math.floor(n/10)], u=n%10;
  return u?t+" ו"+(f?NUMW_F:NUMW_M)[u]:t;
}
// כל הכתיבים של צירוף: כל מילה בכתיב שלה או באחד מהנוספים (גם אחרי ו). «שנים» לבדה נשארת מחוץ, כמו שנאמר למעלה
function numwSpellings(s){
  let out=[""];
  for(const w of s.split(" ")){
    const and=w[0]==="ו"&&NUMW_ALT[w.slice(1)]?"ו":"", base=and?w.slice(1):w, alts=[base,...(NUMW_ALT[base]||[])];
    out=out.flatMap(o=>alts.map(a=>(o?o+" ":"")+and+a));
  }
  return s==="שניים"?out.filter(x=>x!=="שנים"):out;
}
/* יום בחודש במילים: מספר יסודי בזכר («שנים עשר ביוני», «ביום שנים עשר בחודש») או בנקבה («שתים עשרה ביוני»), ו«ראשון»
   לראשון בחודש. style: {f} לכתיבה באותו מין */
const DAYW=new Map();
for(let n=1;n<=31;n++) for(const f of [false,true]) for(const s of numwSpellings(numWords(n,f))) if(!DAYW.has(s))DAYW.set(s,{n,f});
DAYW.set("ראשון",{n:1,f:false,ord:true});
const dayWords=(n,st)=>numWords(n,!!(st&&st.f));
/* שנה במילים, 1900 עד 2099, בנקבה כמו שנה («אלפיים עשרים וחמש»): ו לפני האיבר האחרון («אלפיים ואחת», «אלפיים ועשרים»,
   «אלפיים עשרים וחמש»). נקראים גם היחידות בזכר («אלפיים עשרים וחמישה»), ו נוספת לפני העשרות («אלפיים ועשרים וחמש»),
   ועשרות עגולות בלי ו («אלפיים עשרים»). style: {f, and} לכתיבה באותו כתיב */
function yearWords(y,st){
  const f=!st||st.f!==false, head=y>=2000?"אלפיים":"אלף תשע מאות", r=y>=2000?y-2000:y-1900;
  if(!r)return head;
  const w=numWords(r,f);
  if(r<20||r%10===0)return head+(st&&st.bare&&r>=20&&r%10===0?" ":" ו")+w;
  return head+" "+(st&&st.and?"ו":"")+w;
}
const YEARW=new Map();
for(let y=1900;y<=2099;y++) for(const f of [true,false]) for(const and of [false,true]) for(const bare of [false,true]){
  const st={f,and,bare}, r=y%100;
  if((and&&(r<20||r%10===0))||(bare&&(r<20||r%10)))continue;
  for(const s of numwSpellings(yearWords(y,st))) if(!YEARW.has(s))YEARW.set(s,{y,f,and,bare});
}
/* בתבנית: דקדוק קצר של המילים, לא רשימה של כל הכתיבים (1,060 לשנה: התבנית של התאריכים נבנתה בשליש שנייה, ונבדקה פי
   תשעה לאט). הוא מקבל גם צירוף שאינו מספר («שלוש עשר»), ו-DAYW ו-YEARW, הרשימות המלאות, הן מה שקורא אותו: מה שאינו בהן
   אינו תאריך (dateOK, 06-model.js). הארוך קודם בכל חלופה, ורווח אחד או יותר בין המילים */
const NUMW_UNIT_ALT=[...new Set([...NUMW_M,...NUMW_F].filter(Boolean).flatMap(w=>[w,...(NUMW_ALT[w]||[])]))].sort((a,b)=>b.length-a.length).join("|");
const NUMW_TEEN_ALT="(?:"+NUMW_UNIT_ALT+") +(?:עשרה|עשר)|עשרה|עשר";
const NUMW_TENS_ALT=[...new Set(NUMW_TENS.filter(Boolean).flatMap(w=>[w,...(NUMW_ALT[w]||[])]))].join("|");
const D_DAYW_ALT="(?:"+NUMW_TEEN_ALT+"|(?:עשרים|שלושים|שלשים)(?: +ו(?:"+NUMW_UNIT_ALT+"))?|(?!שנים(?![א-ת]))(?:"+NUMW_UNIT_ALT+")|ראשון)";
const D_YEARW_ALT="(?:אלף +תשע +מאות|אלפיים)(?: +ו?(?:(?:"+NUMW_TENS_ALT+")(?: +ו(?:"+NUMW_UNIT_ALT+"))?|"+NUMW_TEEN_ALT+"|(?:"+NUMW_UNIT_ALT+")))?";

/* הלוח העברי, בחשבון הקבוע (Reingold ו-Dershowitz, Calendrical Calculations): חודשים 1 ניסן … 6 אלול, 7 תשרי … 12 אדר
   (אדר א' בשנה מעוברת), 13 אדר ב'. היום נספר מ-1.1.1 בלוח הגרגוריאני (R.D.). tests/datewords_t.js משווה לכל יום בשתי
   מאות שנים ללוח העברי של Intl */
const hebLeap=y=>(7*y+1)%19<7;
function hebElapsed(y){
  const mo=235*Math.floor((y-1)/19)+12*((y-1)%19)+Math.floor((7*((y-1)%19)+1)/19);
  const pe=204+793*(mo%1080), he=5+12*mo+793*Math.floor(mo/1080)+Math.floor(pe/1080);
  let d=1+29*mo+Math.floor(he/24); const parts=1080*(he%24)+pe%1080;
  if(parts>=19440||(d%7===2&&parts>=9924&&!hebLeap(y))||(d%7===1&&parts>=16789&&hebLeap(y-1)))d++;
  if(d%7===0||d%7===3||d%7===5)d++;
  return d;
}
const hebYearDays=y=>hebElapsed(y+1)-hebElapsed(y);
function hebMonthDays(m,y){
  if(m===2||m===4||m===6||m===10||m===13||(m===12&&!hebLeap(y)))return 29;
  if(m===8&&hebYearDays(y)%10!==5)return 29;
  if(m===9&&hebYearDays(y)%10===3)return 29;
  return 30;
}
function hebToRD(d,m,y){
  let n=d;
  if(m<7){for(let k=7;k<=(hebLeap(y)?13:12);k++)n+=hebMonthDays(k,y); for(let k=1;k<m;k++)n+=hebMonthDays(k,y)}
  else for(let k=7;k<m;k++)n+=hebMonthDays(k,y);
  return n+hebElapsed(y)-1373429;
}
function rdToHeb(rd){
  let y=Math.floor((rd+1373429)/366);
  while(rd>=hebToRD(1,7,y+1))y++;
  let m=rd<hebToRD(1,1,y)?7:1;
  while(rd>hebToRD(hebMonthDays(m,y),m,y))m++;
  return {d:rd-hebToRD(1,m,y)+1,m,y};
}
const gregToRD=(d,m,y)=>Date.UTC(y,m-1,d)/864e5+719163;
function rdToGreg(rd){const t=new Date((rd-719163)*864e5); return {d:t.getUTCDate(),m:t.getUTCMonth()+1,y:t.getUTCFullYear()}}

// שמות החודשים העבריים, בכתיב שבו התאריך המוזז נכתב; ובכתיבים שנקראים. «אדר» לבדו בשנה מעוברת הוא אדר ב'
const HMONTHS=[null,"ניסן","אייר","סיוון","תמוז","אב","אלול","תשרי","חשוון","כסלו","טבת","שבט","אדר","אדר ב'"];
const HMONTH_READ=[["ניסן",1],["אייר",2],["איר",2],["סיוון",3],["סיון",3],["תמוז",4],["מנחם אב",5],["אב",5],["אלול",6],["תשרי",7],
  ["מרחשוון",8],["מרחשון",8],["חשוון",8],["חשון",8],["כסלו",9],["כסליו",9],["טבת",10],["שבט",11],["אדר א'",12],["אדר א",12],
  ["אדר ראשון",12],["אדר ב'",13],["אדר ב",13],["אדר שני",13],["אדר",0]];
const D_HMONTH="(?:"+HMONTH_READ.map(([s])=>s.replace(/ /g," +")).sort((a,b)=>b.length-a.length).join("|")+")";
// אותיות ומספרים: «כ"ג» 23, «ט"ו» 15, «תשפ"ה» 785. האות האחרונה בסופית בשנה («תש"ף»), לא ביום («כ'»)
const GEMATRIA=[[400,"ת"],[300,"ש"],[200,"ר"],[100,"ק"],[90,"צ"],[80,"פ"],[70,"ע"],[60,"ס"],[50,"נ"],[40,"מ"],[30,"ל"],[20,"כ"],[10,"י"],
  [9,"ט"],[8,"ח"],[7,"ז"],[6,"ו"],[5,"ה"],[4,"ד"],[3,"ג"],[2,"ב"],[1,"א"]];
const GEM_VAL=Object.assign(Object.fromEntries(GEMATRIA.map(([v,c])=>[c,v])),{"ך":20,"ם":40,"ן":50,"ף":80,"ץ":90});
const GEM_FINAL={"כ":"ך","מ":"ם","נ":"ן","פ":"ף","צ":"ץ"};
function gemValue(s){let n=0; for(const c of s){const v=GEM_VAL[c]; if(!v)return null; n+=v} return n}
function gemLetters(n){
  let s="";
  for(const [v,c] of GEMATRIA.slice(0,4)) while(n>=v){s+=c;n-=v}
  if(n===15||n===16)return s+"ט"+(n===15?"ו":"ז");
  for(const [v,c] of GEMATRIA.slice(4)) if(n>=v){s+=c;n-=v}
  return s;
}
// גרש אחרי אות אחת, גרשיים לפני האחרונה; st.g ו-st.gg: הסימנים שהמסמך כתב. plain: בלי סימנים, כמו שהמסמך כתב את היום
function gemWrite(n,st,fin,plain){
  let s=gemLetters(n);
  if(fin&&GEM_FINAL[s.slice(-1)])s=s.slice(0,-1)+GEM_FINAL[s.slice(-1)];
  if(plain)return s;
  return s.length===1?s+st.g:s.slice(0,-1)+st.gg+s.slice(-1);
}
/* יום בחודש העברי, א' עד ל', אחרי norm, שבו הגרש הוא גרש ישר והגרשיים מירכאות ישרות, וגם בלי סימנים («ד באדר ב תשנ"ז»,
   כמו בפסקי דין ישנים; השנה אחריו היא הראיה); ושנה בשלוש מאות השנים 5600–5899 (1840–2139), עם ה' של האלפים או ה הידיעה
   או בלעדיהן */
const D_HDAY=`(?:י"?[א-דזחט]|ט"?[וז]|כ"?[א-ט]|[א-ט]'?|[יכל]'?)`, D_HYEAR=`(?:ה' ?|ה)?ת[א-ת]{0,2}"[א-ת]`;
const HEB_DATE_RX=new RegExp(`^(${D_HDAY})( +)([בל]חודש +|[בל]?)(${D_HMONTH})(,? +)(${D_HYEAR})$`,"u");
/* תאריך בלוח העברי (טקסט אחרי norm; raw לסימנים כמו שנכתבו): יום, חודש ושנה, וההמרה ללוח הגרגוריאני. בלי שנה הוא
   אינו תאריך כאן: «ט"ו בשבט», «ט' באב» הם חגים */
function parseHebDate(t,raw){
  const m=HEB_DATE_RX.exec(t); if(!m)return null;
  const d=gemValue(m[1].replace(/['"]/g,""));
  let ys=m[6].replace(/['"]/g,""), thousands=null;
  if(/^ה' ?/.test(m[6]))thousands=m[6].match(/^ה' ?/)[0], ys=m[6].slice(thousands.length).replace(/['"]/g,"");
  else if(ys[0]==="ה"&&ys[1]==="ת")thousands="ה", ys=ys.slice(1);
  const v=gemValue(ys); if(v==null||v<600||v>=900)return null;
  const hy=5000+v, mon=m[4].replace(/ +/g," "), found=HMONTH_READ.find(([s])=>s===mon);
  let hm=found[1]; if(!hm)hm=hebLeap(hy)?13:12;
  if(hm===13&&!hebLeap(hy))hm=12;
  if(hm===12&&mon!=="אדר"&&!hebLeap(hy))return null;
  if(!d||d>hebMonthDays(hm,hy))return null;
  const g=rdToGreg(hebToRD(d,hm,hy)), r=String(raw||"");
  // הסימנים כמו שנכתבו: ׳ או ', ״ או "
  const st={g:/׳/.test(r)?"׳":"'",gg:/״/.test(r)?"״":'"',sp:m[2],conn:m[3],yc:m[5],th:thousands==null?"":thousands.replace("'",/׳/.test(r)?"׳":"'"),
    mon:found[1]?mon:null,hm,fin:/[ךםןףץ]["״]?$/.test(r.trim())||!/[כמנפצ]$/.test(ys),dm:/['"]/.test(m[1])};
  return {d:g.d,m:g.m,y:g.y,form:"heb",h:st};
}
// התאריך המוזז, בלוח העברי ובאותו כתיב
function writeHebDate(g,st){
  const h=rdToHeb(gregToRD(g.d,g.m,g.y));
  let mon=h.m===12&&hebLeap(h.y)?"אדר א'":HMONTHS[h.m];
  if(st.mon&&HMONTH_READ.find(([s,k])=>s===st.mon&&k===h.m))mon=st.mon;
  // מי שכותב את היום בלי גרש כותב כך גם את חצי האדר («אדר ב»)
  mon=mon.replace("'",st.dm?st.g:"");
  return gemWrite(h.d,st,false,!st.dm)+st.sp+st.conn+mon+st.yc+st.th+gemWrite(h.y-5000,st,st.fin);
}
/* תאריך עם יום או שנה במילים: יום (במספר או במילים), חודש, ושנה (בספרות או במילים, או בלי שנה); וחודש ושנה במילים.
   רק כשיש בו מילים: הכתיב בספרות נקרא ב-parseDate עצמה */
const WORDS_DATE_RX=new RegExp(`^(?:(\\d{1,2}|${D_DAYW_ALT})( +)([בל]חודש +|[בל]?-?))?(${DATE_MON_ALT})(?:(,? +(?:ב?שנת +)?)(\\d{4}|${D_YEARW_ALT}))?$`,"u");
function parseWordsDate(t){
  const m=WORDS_DATE_RX.exec(t); if(!m)return null;
  // מילים שהדקדוק קיבל ואינן מספר ברשימות («שלוש עשר»): אינן תאריך
  const words=x=>!!x&&!/^\d/.test(x), dw=words(m[1])?DAYW.get(m[1].replace(/ +/g," ")):null, yw=words(m[6])?YEARW.get(m[6].replace(/ +/g," ")):null;
  if((words(m[1])&&!dw)||(words(m[6])&&!yw)||(!dw&&!yw))return null;
  return {d:m[1]?(dw?dw.n:+m[1]):null,m:dateMonth(m[4]),y:m[6]?(yw?yw.y:+m[6]):null,form:m[1]?"wday":"wmy",
    dw,yw,sp:m[2]||"",conn:m[3]||"",yc:m[5]||"",mtok:m[4]};
}
/* לזיהוי בתשובה של ה-AI: יום, שנה ותאריך עברי מסוימים בכל כתיב שנקרא כאן. ה-AI כותב תאריך במילים בספרות או בכתיב
   אחר, ותאריך עברי בלי ב, בגרש אחר או בלי ה' של האלפים (dateRX, 08-docx.js) */
const wordsRX=(m,k)=>"(?:"+[...m].filter(([,v])=>k(v)).map(([s])=>s.replace(/ /g,"[\\s\u00a0]+")).sort((a,b)=>b.length-a.length).join("|")+")";
const dayWordsRX=n=>wordsRX(DAYW,v=>v.n===n), yearWordsRX=y=>wordsRX(YEARW,v=>v.y===y);
function hebDateRX(f){
  if(f.d==null||f.y==null)return null;
  const h=rdToHeb(gregToRD(f.d,f.m,f.y));
  const gem=(n,fin)=>{const s=gemLetters(n), last=s.slice(-1), L=fin&&GEM_FINAL[last]?"["+last+GEM_FINAL[last]+"]":last;
    return s.length===1?s+"['׳]?":s.slice(0,-1)+"[\"״]?"+L};
  const mon=HMONTH_READ.filter(([,k])=>k===h.m||(!k&&(h.m===12||h.m===13))).map(([s])=>s.replace(/'/g,"['׳]").replace(/ /g,"[\\s\u00a0]+"));
  return gem(h.d,false)+"[\\s\u00a0]+(?:[בל]חודש[\\s\u00a0]+|[בל]?)(?:"+mon.sort((a,b)=>b.length-a.length).join("|")+"),?[\\s\u00a0]+(?:ה['׳]?[\\s\u00a0]?|ה)?"+gem(h.y-5000,true);
}
function writeWordsDate(p,d,mo,y,mw){
  const year=p.y==null?"":p.yc+(p.yw?yearWords(y,p.yw):String(y));
  if(p.form==="wmy")return mw+year;
  return (p.dw?dayWords(d,p.dw):String(d))+p.sp+p.conn+mw+year;
}

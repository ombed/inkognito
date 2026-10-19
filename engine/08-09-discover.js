/* השם שבשכן של תווית שעומדת לבדה (labelOf, הציד של 11.10). בטבלה: הפסקה הבאה באותו תא, ואם אין — התא שליד
   התווית באותה שורה, אחריה כשהשורה נפתחת בתווית ולפניה כשהיא נגמרת בתווית ("נגה טרכטנגוט | התובעת:"). תא ריק
   אחרי תווית הוא שדה ריק, לא רמז לשורה הבאה. מחוץ לטבלה: הפסקה הבאה באותו חלק. אחרי כותרת של רשימה: כל שורה
   שלה, ממוספרת או קצרה (המספור של Word אינו בטקסט). מה שהעוגנים כבר מצאו בשכן עצמו אינו נספר פעמיים.
   כל תוצאה: {i: מקום הבלוק, h: הממצא בתוכו}. */
const LIST_LINE=/^(?:\(?\d{1,2}[.)]|[א-ט][.)]|[-•·*])\s*[א-ת]/u;
// תא שנראה כתווית או ככותרת של טור: תווית של שם, נקודתיים בסוף, או רק מילים של טופס ("מספר זהות", "ת.ז.", "תפקיד")
const HEAD_WORDS=new Set(["ת.ז","ת.ז.","ת\"ז","תז","לידה","זהות","גיל","תפקיד","קרבה","מין","עיסוק","מקצוע","נייד","דרכון","משפחתי"]);
function labelLike(t){
  const x=norm(String(t||"")).replace(/\u0000/g,"").trim();
  if(!x||/\d/.test(x))return false;
  if(labelOf(x,true)||/:$/.test(x))return true;
  return x.split(/\s+/).every(w=>{const b=w.replace(/[.'"]+$/,"");
    return FORMLABEL.has(w)||HEAD_WORDS.has(w)||HEAD_WORDS.has(b)||COMMON.has(b)||STOP.has(b)||(b.length>3&&PFX.has(b[0])&&(COMMON.has(b.slice(1))||STOP.has(b.slice(1))))})}
function labelNext(blocks){
  const out=[], rows=new Map(), grid=new Map(), last=new Map(), txt=b=>String(b.text||"");
  const labs=blocks.map(b=>hiddenPart(b.part||"")?null:labelOf(txt(b),!!b.cell));
  blocks.forEach((b,i)=>{
    if(!b.cell)return;
    const r=rows.get(b.cell.row)||[]; r.push(i); rows.set(b.cell.row,r);
    const g=b.cell.tbl+"|"+b.cell.r+"|"+b.cell.col; if(!grid.has(g))grid.set(g,i);
    last.set(b.cell.tbl,Math.max(last.get(b.cell.tbl)||0,b.cell.r));
  });
  const at=(c,r,col)=>grid.get(c.tbl+"|"+r+"|"+col);
  // שורת חתימה ("__________") או קו בין התווית לשם אינה השכן: מדלגים על עד שתי שורות בלי אות
  const after=i=>{let j=i+1; while(j<blocks.length&&j<=i+3&&blocks[j].part===blocks[i].part&&!/[א-ת]/.test(txt(blocks[j])))j++; return j};
  const asRole=l=>l&&(l.keys.includes("role")||l.as==="role");
  // הממצאים בשכן j של התווית i, על הטקסט שהקורא רואה (anchoredSeen): סימן כיוון בראש השורה חסם כל קריאה של שכן.
  // מה שהעוגנים כבר מצאו בשכן לבדם אינו נספר פעמיים
  const memo=new Map();
  const read=(j,i)=>{
    const k=i+":"+j; if(memo.has(k))return memo.get(k);
    let r=[];
    if(j<blocks.length&&!labs[j]&&!hiddenPart(blocks[j].part||"")){
      const own=new Set(anchoredSeen(txt(blocks[j])).map(h=>h.s+":"+h.e));
      r=anchoredSeen(txt(blocks[j]),labs[i]).filter(h=>!own.has(h.s+":"+h.e));
    }
    memo.set(k,r); return r};
  /* פרוטוקול (הביקורת של 11.10): אותה תווית של צד לבדה כמה פעמים, ומתחתיה כל פעם משהו אחר, ורוב מה שמתחת לתוויות
     האלה אינו נקרא כשם — אלה דברים שנאמרו בדיון. בחלק כזה תווית של צד אינה קוראת את השכן שלה, גם כשתשובה קצרה
     נראית כשם. רשימה של תיקים, שבה כל "התובעת:" עומדת מעל שם, נקראת כרגיל */
  const turns=new Map(), named=new Map();
  labs.forEach((l,i)=>{
    if(!asRole(l))return;
    const p=blocks[i].part, j=after(i), nb=blocks[j], same=!!nb&&nb.part===p;
    const k=p+"\u0001"+norm(txt(blocks[i])).replace(/[^א-ת]/g,"");
    const t=turns.get(k)||new Set(); t.add(same?norm(txt(nb)).replace(/\u0000/g,"").trim():""); turns.set(k,t);
    const c=named.get(p)||{n:0,yes:0}; c.n++; if(same&&read(j,i).length)c.yes++; named.set(p,c)});
  const talk=new Set([...turns].filter(([,t])=>t.size>=2).map(([k])=>k.split("\u0001")[0])
    .filter(p=>{const c=named.get(p); return c.yes*2<c.n}));
  const field=l=>l.keys.some(x=>x==="field"||x==="fieldx");
  for(let i=0;i<blocks.length;i++){
    const lab=labs[i], b=blocks[i], ni=after(i), nb=blocks[ni]; if(!lab)continue;
    if(asRole(lab)&&talk.has(b.part))continue;
    const next=[];
    if(lab.list){
      for(let j=i+1;j<blocks.length&&next.length<40;j++){
        const t=norm(txt(blocks[j])).replace(/\u0000/g,"").trim();
        // "נ ג ד" סוגר את רשימת הצד הראשון
        if(blocks[j].part!==b.part||labs[j]||/^-?\s*(?:נ\s+ג\s+ד|נגד)\s*-?$/u.test(t)||!(LIST_LINE.test(t)||(t.split(/\s+/).length<=4&&!/[.:;]$/.test(t))))break;
        next.push(j);
      }
    }else if(b.cell&&!(nb&&nb.cell&&nb.cell.row===b.cell.row&&nb.cell.col===b.cell.col)){
      const row=rows.get(b.cell.row), others=row.filter(k=>blocks[k].cell.col!==b.cell.col), below=at(b.cell,b.cell.r+1,b.cell.col);
      if(b.cell.n===1){
        // טבלה של טור אחד ("שם:" ומתחתיו השם, ת"ז, עיר): רק התא שמתחת לתווית, לא הטור כולו (הביקורת של 11.10)
        if(below!==undefined&&!labelLike(txt(blocks[below])))next.push(below);
      }else if(b.cell.tbl&&below!==undefined&&!labelLike(txt(blocks[below]))&&others.every(k=>labelLike(txt(blocks[k])))){
        // שורת כותרות ("שם העד | תפקיד", "שם הקטין | ת.ז."): התווית היא כותרת של טור, והשמות מתחתיה, לא בתא שלידה.
        // הטור נעצר בתא הראשון שאינו שם: מתחת ל"נספח | שם | עמוד" באים מסמכים (הביקורת של 11.10)
        // טבלה עם תוויות של שורות בטור הראשון ("עיסוק", "הכנסה"): מה שמתחת לכותרת של צד הוא הערך של השורה, לא שם, ושם
        // בטבלה כזו נקרא מתווית השורה שלו ("שם"). "התובעת | הנתבע" מעל "עיסוק" מילא את הרשימה במקצועות (ביקורת שנייה)
        // טבלה כזו פותחת בפינה שאינה תווית של צד (ריקה, "פרט"): כשבפינה "התובעת", הטור הראשון הוא של צד, ושמו אינו תווית
        const c0=Math.min(...rows.get(blocks[below].cell.row).map(k=>blocks[k].cell.col)), k0=at(b.cell,b.cell.r+1,c0), kc=at(b.cell,b.cell.r,c0);
        if(c0!==b.cell.col&&k0!==undefined&&k0!==below&&/[א-ת]/.test(txt(blocks[k0]))&&!(kc!==undefined&&asRole(labs[kc])))continue;
        for(let r=b.cell.r+1;r<=Math.min(last.get(b.cell.tbl),b.cell.r+40);r++){
          const k=at(b.cell,r,b.cell.col); if(k===undefined)continue;
          if(labelLike(txt(blocks[k])))break;
          const hs=read(k,i); if(!hs.length)break;
          for(const h of hs)out.push({i:k,h});
          if(!field(lab))break;
        }
        continue;
      }else{
        const at1=c=>row.find(k=>blocks[k].cell.col===c), cols=row.map(k=>blocks[k].cell.col);
        const dir=labs[at1(Math.min(...cols))]?1:labs[at1(Math.max(...cols))]?-1:1;
        const k=at1(b.cell.col+dir); if(k!==undefined)next.push(k);
      }
    }else if(nb&&nb.part===b.part)next.push(ni);
    for(const j of next) for(const h of read(j,i)) out.push({i:j,h});
  }
  return out}
function discover(blocks){
  const found={};
  // יש תמלולים שמסמנים דובר בשורה משל עצמה, בלי נקודתיים: פסקה שכולה שם ואחריה
  // פסקאות הדיבור. עוגן הדוברים דורש נקודתיים, ולכן על תמלולים כאלה
  // discover החזיר אפס מועמדים. פסקה קצרה בלי פיסוק בסוף, שאחריה פסקה של ממש, היא דובר.
  const extra=[];
  for(let bi=0;bi<blocks.length;bi++){
    /* השורה כמו שאדם קורא אותה (squeeze), והמקום חוזר לטקסט עצמו. ל-\s של JavaScript, BOM הוא רווח: דובר ששמו
       עם BOM באמצעו נקרא שתי מילים בנות שתי אותיות, ונשאר (ביקורת 18.10, F1; bench/invisible.js) */
    const q0=squeeze(blocks[bi].text||""), line=q0?q0.t:(blocks[bi].text||"");
    const rawLine=line.trim();
    const t=trimEdges(rawLine), w=t.split(/\s+/).filter(Boolean);
    const nxt=blocks[bi+1]&&trimEdges(seenText(blocks[bi+1].text||""));
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
    // "בית המשפט הנכבד" מתחת ל"לכבוד" הוצע כאדם בשם «הנכבד»: שורה שהניקוי קיצץ ממנה מילה שאינה תואר
    // אינה שורה שכולה שם (הציד של 11.10)
    {const kept=c.split(/\s+/); if(w.some(x=>!kept.includes(x)&&!TITLE_RX.test(x+" ")))continue;}
    // "נגה ואליאב טרכטנגוט" הם זוג, לא דובר אחד: העוגנים מציעים אותם כשני אנשים (הביקורת של 11.10)
    {const cw=c.split(/\s+/); if(cw.length===3&&/^ו-?[א-ת]{2}/.test(cw[1]))continue;}
    if(c.split(/\s+/).some(x=>/(?:ים|ות|יים|יות)$/.test(norm(x))&&!KNOWN_FIRST.has(norm(x))))continue;
    if(c.split(/\s+/).some(x=>/^של[ךכםןנהוי]?$/.test(norm(x))))continue;
    const s0=line.indexOf(c); if(s0<0)continue;
    const [os,oe]=q0?[q0.pos[s0],q0.pos[s0+c.length-1]+1]:[s0,s0+c.length];
    extra.push({b:blocks[bi],h:{text:c,s:os,e:oe,why:"פסקה שכולה שם, ואחריה דיבור",anchor:"speakerline",g:null,role:null}});
  }
  for(const {b,h} of extra){
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    // בניגוד לתור דיבור עם נקודתיים, שורה בודדת היא רמז חלש: היא נשארת הצעה
    // בהקשה אחת ולעולם לא מתמלאת מעצמה, גם כשהיא חוזרת.
    r.count++;r.why.add(h.why);r.spk=(r.spk||0)+1;
    if(!r.ctx)r.ctx=ctxHTML(b.text,h.s,h.e);
  }
  // כותרת של תיק: שורת "נגד" ("נ ג ד") באותו חלק, או פרטים של צד בשורה שמתחת לשם
  const plain=b=>norm(String(b.text||"")).replace(/\u0000/g,"").trim(), at=new Map(blocks.map((b,i)=>[b,i]));
  const vsParts=new Set(blocks.filter(b=>/^-?\s*(?:נ\s+ג\s+ד|נגד)\s*-?$/u.test(plain(b))).map(b=>b.part));
  const DETAIL=/^(?:באמצעות|ע"י|ת\.?\s?ז|ת"ז|מ?רח(?:וב|')|ב"כ|עו"ד)/u, DETAIL_IN=/(?:^|[\s(])(?:באמצעות|ע"י|ב"כ|ת\.?\s?ז\.?|ת"ז)(?=[\s.:,]|$)/u;
  // וגם טבלה שיש בה פרטים של צד ("ע"י ב"כ", ת"ז) באחד התאים
  const tblOf=b=>b.cell&&b.cell.tbl!=null?b.part+"|"+b.cell.tbl:null, capTbl=new Set();
  for(const b of blocks){const t=tblOf(b); if(t&&DETAIL_IN.test(plain(b)))capTbl.add(t)}
  const caption=b=>{if(vsParts.has(b.part)||capTbl.has(tblOf(b)))return true;
    const nb=blocks[at.get(b)+1]; return !!nb&&nb.part===b.part&&DETAIL.test(plain(nb))};
  // שם מוכר מתחת לתווית של צד מעיד על הצדדים שלידו: באותה טבלה, או עד שש שורות ממנו
  const knownTbl=new Set(), knownAt=[];
  const take=(b,h)=>{
    const r=found[h.text]||(found[h.text]={count:0,why:new Set(),conf:"medium",ctx:"",role:null,g:null,gf:0,gm:0});
    r.count++;r.why.add(h.why);
    if(h.role&&!r.role)r.role=h.role;
    if(h.g==="f")r.gf++; if(h.g==="m")r.gm++;
    // שם בשכן של תווית ממלא את הרשימה רק כשהשורה היא השם בלבד ("נגה טרכטנגוט, ת.ז. …" מוצע), ומה שבא אחרי תפקיד
    // באותה שורה ואינו נראה כשם ("הנתבע - מתנגד נחרצות", unsure) מוצע ואינו ממלא אותה (הביקורת של 11.10)
    // ושכן ממלא אותה רק עם ראיה של שם: מילה של שם מוכר (known), כותרת של תיק (שורת "נגד" באותו חלק, רשימת צדדים
    // ממוספרת, או פרטי צד בשורה שמתחת: "באמצעות", ת"ז, "ע"י"), או אותו שם במקום אחר במסמך (למטה). חצי של זוג לעולם
    // לא (pair): "מהנדסת תוכנה" מתחת ל"המבקשת:" ו«קנין נגד» מ"אורי וקנין נגד" מילאו את הרשימה (ביקורת שנייה)
    const nearOK=!h.near||(h.only&&(h.known||h.numbered||caption(b)));
    if(!h.pair&&(h.anchor==="bid"||(h.anchor==="role"&&nearOK&&!h.unsure)))r.conf="high";
    else if(!h.pair&&h.anchor==="role"&&h.near&&h.only&&!h.unsure)(r.nearAt||(r.nearAt=new Set())).add(b);
    if(!h.pair&&h.anchor==="role"&&h.near&&h.only&&h.known&&!h.unsure){const t=tblOf(b); if(t)knownTbl.add(t); else knownAt.push(b)}
    // דובר שחוזר, או דובר בשם מלא, הוא אדם בוודאות. דובר יחיד במילה אחת נשאר
    // הצעה: "שאלה:" או "הערה:" נראים אותו דבר עד שחוזרים.
    // דובר הוא מי שחוזר: "מועד אחרון לתגובה:" הוא תווית של טופס, גם כשיש בה שתי מילים.
    // שתי מילים בפעם אחת היו "גבוה" ומולאו אוטומטית; עכשיו רק חזרה מעלה את הביטחון.
    // אחרי חותמת של שיחה, מילה אחת שאינה שם מוכר נשארת הצעה גם כשחוזרת (weakSpk): כך נראית גם תווית ביומן
    if(h.anchor==="speaker"){r.spk=(r.spk||0)+1; if(r.spk>=2&&!h.weakSpk)r.conf="high";}
    if(!r.ctx)r.ctx=ctxHTML(b.text,h.s,h.e)};
  for(const b of blocks) for(const h of anchoredSeen(b.text))take(b,h);
  // שם שתווית בתא או בפסקה שלידו מעידה עליו: "התובעת:" בתא אחד והשם בתא שלידו מילא את הרשימה כמו בשורה אחת
  for(const {i,h} of labelNext(blocks))take(blocks[i],h);
  // שם בשכן של תווית בלי מילה של שם מוכר ממלא את הרשימה כשצד לידו נקרא בשם מוכר, או כשהוא כתוב גם במקום אחר
  // במסמך, מחוץ לשכן
  const nearKnown=b=>knownTbl.has(tblOf(b))||(!tblOf(b)&&knownAt.some(k=>k!==b&&k.part===b.part&&Math.abs(at.get(k)-at.get(b))<=6));
  for(const [v,r] of Object.entries(found)){
    if(r.conf==="high"||!r.nearAt)continue;
    if([...r.nearAt].some(nearKnown)){r.conf="high";continue}
    const rx=new RegExp(NW+flex(norm(v).trim())+NWE,"u");
    if(blocks.some(b=>!r.nearAt.has(b)&&rx.test(norm(String(b.text||"")))))r.conf="high"}
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



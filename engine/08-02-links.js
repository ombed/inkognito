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

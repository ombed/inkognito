async function redactDocx(buf,subs,allow,opt){
  const files=await unzip(buf);
  const rep={ins:0,del:0,cm:0,rsid:0,hidden:0,img:0,embedded:0,dropped:[],meta:[],rels:[],sweep:0};
  // קטע מיובא נכתב כפסקאות לפני הכול, והחלק שלו יוצא מהקובץ כמו כל חלק שהוסר
  const chunks=await inlineChunks(files,0);
  // קובץ מוטמע יוצא, ושורה במקומו (dropObjects)
  const objs=dropObjects(files); rep.embedded=objs.files;
  // SVG שיש לו עותק PNG יוצא, ו-Word מציג את העותק (dropSvgCopies)
  const svgs=dropSvgCopies(files); rep.svg=svgs.length;
  let keep=files.filter(f=>{
    // התמונה הממוזערת היא צילום של העמוד הראשון, עם כל מה שכתוב בו (ביקורת H10)
    if(DROP.includes(f.name)||/(?:^|\/)customxml\//i.test(f.name)||f.name.startsWith("docProps/thumbnail.")||chunks.includes(f.name)||objs.gone.includes(f.name)||svgs.includes(f.name)){rep.dropped.push(f.name);return false}
    return true});
  // הקישורים של חלק שהוסר (ההערות) הולכים איתו: בלעדיו נשארו בקובץ, יתומים (הציד של 11.10)
  {const gone=new Set(rep.dropped.map(n=>n.replace(/([^/]*)$/,"_rels/$1.rels")));keep=keep.filter(f=>!gone.has(f.name))}
  for(const f of keep){
    // תמונה: בלי מקום, מצלמה, תאריך ומחבר (stripImageMeta)
    if(/(?:^|\/)media\/[^/]+$/i.test(f.name)){ const c=stripImageMeta(f.name,f.data); if(c){ f.data=c; rep.img++; } }
    // SVG שנשאר: בלי כותרת, תיאור, מטא-נתונים והערות (cleanSvg)
    if(/\.svg$/i.test(f.name)){ const c=cleanSvg(f.data); if(c){ f.data=c; rep.img++; } }
    if(f.name.endsWith(".rels")||f.name==="[Content_Types].xml"){
      let s=TXT.decode(f.data);
      for(const d of rep.dropped){
        const b=d.split("/").pop().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        s=s.replace(new RegExp(`<Relationship[^>]*Target="[^"]*${b}"[^>]*/>`,"g"),"")
           .replace(new RegExp(`<Override[^>]*PartName="/${d.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"[^>]*/>`,"g"),"")}
      f.data=ENC.encode(s)}
    if(f.name==="docProps/core.xml"||f.name==="docProps/app.xml"){
      const o=TXT.decode(f.data),d=parseXML(o);
      for(const el of d.getElementsByTagName("*")){
        // HLinks: העתק של כתובות הקישורים, שהיא אינה רואה (הציד של 11.10)
        if(["creator","lastModifiedBy","title","subject","description","keywords",
            "category","Company","Manager","LastAuthor","Template","TitlesOfParts",
            "HeadingPairs","Application","HLinks"].includes(el.localName)){
          if(el.textContent.trim())rep.meta.push(el.localName+"="+el.textContent.trim());
          el.textContent="";while(el.firstChild)el.removeChild(el.firstChild)}
        if(el.localName==="revision")el.textContent="1";
        if(["created","modified"].includes(el.localName))el.textContent="1970-01-01T00:00:00Z";
        if(["totaltime","lastprinted","hyperlinkbase","identifier","contentstatus"]
            .includes(el.localName.toLowerCase())){
          if(el.textContent.trim())rep.meta.push(el.localName+"="+el.textContent.trim());
          el.textContent=""}}
      f.data=ENC.encode(serXML(d,o))}
  }
  const docs=[];
  for(const f of keep){
    if(!isTextPart(f.name))continue;
    const main=TEXTPART.test(f.name);
    const o=TXT.decode(f.data),d=parseXML(o);
    // שינוי במעקב נשמר גם בסגנונות ובהגדרות המספור, עם שם מי שעשה אותו
    {const [i,dl]=acceptTracked(d);rep.ins+=i;rep.del+=dl;}
    if(main){rep.cm+=stripComments(d);rep.rsid+=stripRsid(d);}
    rep.hidden+=stripHidden(d);
    // כתובת בקוד שדה: כבר כאן מה שיוצא כולו (מייל, נתיב, רשת חברתית); כתובת אינטרנט נקראת אחרי ההחלפה
    if(main){joinFields(d);scrubFields(d,hostRule,rep.rels)}
    scrubPaths(d);
    docs.push({f,doc:d,orig:o});
  }
  rep.bookmarks=renameBookmarks(docs.map(x=>x.doc));
  /* בורר תאריך (פקד תוכן) שומר את התאריך גם כנתון, w:fullDate, ו-Word פותח עליו את לוח השנה: התאריך
     המוזז הוצג, והאמיתי נשאר מאחוריו (הציד של 11.10). אחרי ההחלפה הנתון הוא מה שמוצג — התאריך המוזז,
     או כלום כשהתאריך נמחק. תאריך שלא השתנה נשאר כמו שהוא. */
  const wText=el=>Array.from(el.getElementsByTagNameNS(W,"t")).map(t=>t.textContent).join("");
  const picks=[];
  for(const dd of docs)for(const el of Array.from(dd.doc.getElementsByTagNameNS(W,"date"))){
    const sdt=el.parentNode&&el.parentNode.parentNode, c=kidW(sdt,"sdtContent");
    if(c&&el.getAttribute("w:fullDate"))picks.push({el,c,was:wText(c)})}
  // dateFakes: כל תאריך בדוי שנכתב, כמה פעמים שנכתב, לבדיקה האחרונה (verify)
  const applied=[],flagged=[],secrets=[],dateSecrets=[],dateFakes=[],placeSecrets=[];
  // יישוב שחזר מהתיק ומוחלף רק במופע שהוא מקום (cond, 07-engine.js): נבדק כמו יישוב ששכבת היישובים החליפה
  const condV=new Set(subs.filter(s=>s.cond&&s.kind==="PLACE"&&placeCond(norm(s.value).trim())).map(s=>norm(s.value).trim()));
  let blocks=[];
  for(const dd of docs) blocks=blocks.concat(flatten(dd.doc,dd.f.name));
  twinParts(blocks);
  const eng=new Engine(subs,allow,opt,blocks.map(b=>b.text).join("\n"));
  // ה-XML משתנה במקום, ולכן flatten אחרי ההחלפה מחזיר את הטקסט המושחר.
  // בלי צילום מראש, סורק הגוף מציע לה בחזרה את השמות הבדויים שהמצאנו.
  const ORIG=blocks.filter(b=>!b.dupOf).map(b=>({part:b.part,text:b.text,label:!!b.label,pair:!!b.pair}));
  // שם שתווית בתא או בפסקה שלידו מעידה עליו נבדק כמו שם שאחרי תווית באותה שורה (labelNext)
  const nextTo=new Map();
  for(const {i,h} of labelNext(blocks)){const l=nextTo.get(blocks[i])||[]; l.push(h); nextTo.set(blocks[i],l)}
  /* ציטוטים של תיקים אחרים שנשארים כמו שהם (07-cite.js, החלטת הבעלים 13.10). קודם מעבר בלי ההגנה, שאוסף כל מה שיוחלף
     מחוץ לציטוטים — שם, יישוב, מספר — ורק אז נקבע מה נשאר: ציטוט שיש בו ערך כזה הוא של התיק הזה (הליך קודם בין אותם
     צדדים), והערך היה נשאר בקובץ בתוכו. cite:false מכבה; citeReplace: ציטוטים שהיא ביקשה להחליף */
  if(!(opt&&opt.cite===false)){
    const mine=new Set();
    for(const blk of blocks){ if(blk.dupOf)continue;
      const sp0=citeSpans(norm(blk.text)).filter(x=>x.parties);
      for(const h of eng.detect(blk.text,false,nextTo.get(blk))){
        if(!h.apply||sp0.some(x=>x.s<=h.s&&h.e<=x.e))continue;
        mine.add(h.base||h.text); if(h.dtext)mine.add(h.dtext); } }
    eng.citeKeys=citeKept(blocks.filter(b=>!b.dupOf).map(b=>b.text).join("\n"),mine,opt&&opt.citeReplace?new Set(opt.citeReplace):null);
  }
  for(const blk of blocks){
    // החלופה של תיבת טקסט מקבלת בדיוק את ההחלפות של הצורה, ואינה נספרת שוב
    if(blk.dupOf){if(blk.dupOf.reps)applyReps(blk,blk.dupOf.reps.map(r=>r.slice()));continue}
    const hits=eng.detect(blk.text,false,nextTo.get(blk));if(!hits.length)continue;
    const reps=[];
    for(const h of hits){
      // ערך שנמצא בתוך כתובת מקודדת נרשם מפוענח, כמו שהיא קוראת אותו. type: הסוג נשמר עם התיק (currentKinds
      // בדף), כדי שתאריך, יישוב או גוף מתיק שנפתח לא יחזרו כאדם (הציד של 11.10)
      const rec={value:h.dtext||h.text,label:h.label,part:partName(blk.part),why:h.why,
        ctx:ctxHTML(blk.text,h.s,h.e),review:!!h.review,src:h.src,base:h.base||undefined,type:h.type};
      // הכינוי הבסיסי נרשם לפי הערך שברשימה, לא לפי הטקסט שנתפס: "לנרות מאירות"
      // אינו מפתח, ובלעדיו ההחזרה קיבלה "לגפן" ככינוי ואיבדה את "בגפן".
      // בתוך כתובת הכינוי נכתב מקודד, והכתובת נשארת כתובת
      if(h.apply){const nw0=eng.repFor(h), nw=h.enc&&nw0?encodeURIComponent(nw0):nw0;rec.rep=nw;
        const fam=(CANON[h.type]||[h.type])[0];
        rec.baseRep=eng.map[ckey(fam,h.base||h.text)]||eng.map[ckey(h.type,h.text)]||nw0;
        let s=h.s,e=h.e;
        // השמטה: הערך נמחק נקי. רווח אחד סמוך נבלע איתו, כדי ש"נסע ל-X ביום" לא
        // יישאר עם שני רווחים, ומה שנשאר נקרא כאילו הערך לא היה שם מעולם.
        if(nw===""){ rec.deleted=true; rec.rep="";
          if(blk.text[e]===" "&&(s===0||blk.text[s-1]===" "||/[\s(]/.test(blk.text[s-1]||" ")))e++;
          else if(blk.text[s-1]===" ")s--; }
        reps.push([s,e,nw]);applied.push(rec);
        // יישוב שהוא גם מילה או צירוף (placeCond) הוחלף רק במופע שהטקסט מראה שהוא מקום, והמופע שנשאל נשאר בכוונה.
        // האימות מחפש אותו רק במופע כזה: בחיפוש רגיל «נקודת מבט רעננה» נספרה דליפה של «גרה ברעננה», והפס האדום
        // חסם מסמך תקין
        if(h.src==="pattern"&&h.type==="PLACE_CITY"&&placeCond(h.place))placeSecrets.push(h.place);
        else if(h.src==="list"&&condV.has(norm(h.base||"").trim()))placeSecrets.push(norm(h.base).trim());
        else{
          // תאריך נבדק בסוף רק במקום שבו הוא תאריך (notDateAt), ולכן הוא ברשימה משלו
          const sec=(CANON[h.type]||[h.type])[0]==="DATE"?dateSecrets:secrets;
          sec.push(h.text);
          if(h.dtext)sec.push(h.dtext);
          if(h.base)sec.push(h.base);
          if(sec===dateSecrets&&nw)dateFakes.push(nw)}}
      else flagged.push(rec)}
    // מיקום המחיקות בטקסט החדש, לסימון במסך הבדיקה: הערך איננו, אבל היא צריכה לראות
    // שהיה שם משהו ולוכל לבטל. כל החלפה שלפני נקודה מזיזה אותה בהפרש האורכים.
    {const srt=reps.slice().sort((a,b)=>a[0]-b[0]); let shift=0; const dels=[];
     for(const [s,e,nw] of srt){ if(nw==="")dels.push({s:s-shift, val:blk.text.slice(s,e).trim()}); shift+=(e-s)-nw.length; }
     if(dels.length)blk.dels=dels;}
    blk.reps=reps.map(r=>r.slice());
    applyReps(blk,reps)}
  // מעבר אחידות: כל ערך שהוחלף (ארבע אותיות ומעלה) נסרק שוב בכל חלקי המסמך,
  // כדי שמופע שאף שכבה לא סימנה יקבל אותו תחליף ולא יישאר בטקסט.
  const sweep={};
  for(const r of applied){
    const v=norm(r.value).trim(), rp=r.baseRep||r.rep;
    // יישוב שהוא גם מילה או צירוף הוחלף רק במופע שהטקסט מראה שהוא מקום; במופע אחר זו המילה ("גרה ברעננה"
    // ו"נקודת מבט רעננה", הציד של 11.10). findPlaces כבר שקל כל מופע, והמעבר לא דורס את השאלה שהוא שאל
    if(r.label==="יישוב"&&r.src==="pattern"&&placeCond(norm(r.base||r.value).trim()))continue;
    if(r.src==="list"&&condV.has(norm(r.base||r.value).trim()))continue;
    // אם התחליף מכיל את הערך ("דוד" → "דוד א׳"), סריקה חוזרת
    // תתפוס את התחליף עצמו ותכפיל אותו.
    // תאריך שנמצא מוחלף גם במקום אחר, אבל לא כשהוא שם מספר סעיף או כמות ("סעיף 12.3", "3.5 ימים"; notDateAt)
    if(v.length>=4&&!(v in sweep)&&rp&&!norm(rp).includes(v))sweep[v]={rep:rp,of:null,date:r.label==="תאריך"||r.label==="DATE"};
  }
  // "החלפתי את תמר גולדשמיט, ובטקסט נשאר גולדשמיט לבד" — זו הדליפה
  // הכי שקטה שיש, כי חיפוש-והחלפה על השם המלא לא נוגע בו. כאן כל חלק
  // של שם שהוחלף נסרק בנפרד, ורק כשהוא חד-משמעי: שם משפחה שמשותף
  // לשני אנשים במסמך לא מוחלף אלא מסומן לבדיקה.
  const partOf=new Map();
  const docTokAll=new Set();
  for(const b of ORIG)for(const w of wordsOf(norm(b.text)))docTokAll.add(w);
  // "בחיים" הוא המילה, לא הבן אדם. חלק של שם שהוא גם מילה, או שמופיע
  // במסמך עם ה' הידיעה, מוחלף רק כשהוא עומד לבד — בלי אותיות שימוש —
  // ומסומן לבדיקה.
  // שלוש אותיות לבדן אינן הופכות חלק של שם למילה: "סבג" ו"דהן" אינם מילים,
  // ובלי אות שימוש הם דולפים ("וסבג" נשאר בטקסט). מילה של ממש נתפסת ברשימות
  // ובצורת ה' הידיעה שבמסמך; שתי אותיות נשארות זהירות.
  const wordy=p=>WORDLIKE.has(p)||COMMON.has(p)||docTokAll.has("ה"+p)||p.length<=2;
  /* חלק של שם שהוא גם יישוב, ששכבת היישובים רק שואלת עליו (placeOwn): «אלעד» מתוך «אלעד כהן» יצא לבד, ואפילו
     הפס אמר שהשמות הוחלפו (הציד של 11.10). שם פרטי שהוא יישוב (TOWNWORD מסוג name) הוא האדם בכל צורה; כל יישוב
     אחר — מילה, שם דו-משמעי, שם קצר, ושלומי — רק כשעומד לבד, ולבדיקה */
  const partWordy=p=>TOWNWORD.get(p)==="name"?false:(wordy(p)||!!PLACE_BY[p]||AMBIG.has(p));
  // "רחוב הארזים 12" הוחלף, ו"ההסעות מהארזים" נשאר בטקסט: שם הרחוב לבדו הוא
  // אותו מקום. כל כתובת, רחוב או שכונה שהוחלפו תורמים את המילים שאחרי סוג
  // הרחוב, ובלי המספר; כשהשם הוא גם מילה, רק כשעומד לבד ולבדיקה. חמש
  // מ-16 הדליפות בקורפוס היו בדיוק זה.
  const STREET_HEAD=/^(?:רחוב|רח'|שדרות|שד'|סמטת|סמטה|דרך|שכונת|כיכר|ככר|מעלה|נחל|משעול)\s+(.+?)(?:\s+\d.*)?$/u;
  for(const r of applied){
    const rp=r.baseRep||r.rep; if(!rp||rp==="███")continue;
    // הערך שנתפס עשוי לשאת אות שימוש ("ברחוב הגפן"); הבסיס של הכלל נקי ממנה
    const src=norm(r.base||r.value).trim();
    const m=STREET_HEAD.exec(src)||STREET_HEAD.exec(src.replace(/^[בהולמכש]/,"")); if(!m)continue;
    const nm=m[1].trim();
    if(nm.length<3||(nm in sweep)||STOP.has(nm)||PLACE_BY[nm]||norm(rp).includes(nm))continue;
    sweep[nm]={rep:rp,of:r.value,wordy:wordy(nm),place:true};
  }
  const regPart=(value,rp,label)=>{
    if(!rp||rp==="███")return;
    if(label&&!label.startsWith("שם"))return;
    const vw=norm(value).trim().split(/\s+/), rw=norm(rp).trim().split(/\s+/);
    const real=opt.mode==="real";
    // מילית של שם משפחה (PART: «בן», «בר», «בת», «אבו»…) לבד אינה האדם: «הילד בן שבע», «חגג בר מצווה» (12.10)
    const particle=new RegExp(`^(?:${PART})$`);
    const add=(p,to)=>{
      // שתי אותיות ("כץ", "נץ") הן שם משפחה של ממש; הן נכנסות למעבר, ובגלל wordy
      // מוחלפות רק כשעומדות לבד ולבדיקה. הסריקה: 2 כמו 3, 4 מוסיף שש דליפות.
      if(!p||p.length<2||STOP.has(p)||particle.test(p)||placeOwn(p))return;
      if(p in sweep||!to||norm(to).includes(p))return;
      const g=partOf.get(p)||{to:new Set(),of:new Set(),wordy:partWordy(p)};
      g.to.add(to); g.of.add(value); partOf.set(p,g)};
    /* שם משפחה כפול במקף ("לוי-אבקסיס", גם במקף עברי): כל חצי לבד הוא אותו אדם — «לדברי אבקסיס», «גם לוי
       אמרה» — ושניהם דלפו (הציד של 11.10). כל חצי מקבל את החצי שלו מהבדוי כשגם הוא כפול, ואחרת את כולו */
    const dbl=(w,rs)=>{
      const hv=w.split("-").filter(Boolean); if(hv.length<2)return;
      const rh=real?String(rs).split("-").filter(Boolean):[];
      hv.forEach((h,i)=>add(h,real?(rh.length===hv.length?rh[i]:rs):rp));
    };
    if(vw.length<2){ dbl(vw[0],real?rw[rw.length-1]:rp); return; }
    // השם הפרטי לבד: במצב real (שם בדוי) הוא מקבל את השם הפרטי של הבדוי, ובמצבים
    // האחרים (תווית, השחרה) את התחליף כולו, כי אין בו שם פרטי נפרד
    add(vw[0],real?rw[0]:rp);
    // שם המשפחה כולו ("לב שדה", "בן דוד") והמילה האחרונה לבד
    const sur=vw.slice(1).join(" "), rsur=real?rw.slice(1).join(" "):rp;
    add(sur,rsur);
    if(vw.length>2)add(vw[vw.length-1],real?rw[rw.length-1]:rp);
    dbl(vw[vw.length-1],real?rw[rw.length-1]:rp);
  };
  // החלקים נגזרים מהערך שברשימה, לא מהצורה שנתפסה: "למרים לוין" תרם "למרים" כחלק
  for(const r of applied) regPart(r.base||r.value,r.baseRep||r.rep,r.label);
  // גם שמות מהפרופיל שלא הופיעו במלואם במסמך הזה: סיכום פגישה מזכיר
  // "גולדשמיט" לבד, בלי "תמר גולדשמיט" בשום מקום, וזה עדיין אותה אישה.
  for(const s of subs) if(s.kind==="NAME")
    regPart(s.value,s.replacement||eng.map[ckey("NAME",s.value)],null);
  const partAmbig=[];
  for(const [p,g] of partOf){
    if(g.to.size>1){partAmbig.push({p,of:[...g.of]});continue}
    sweep[p]={rep:[...g.to][0],of:[...g.of][0],wordy:g.wordy};
  }
  let blocks2=[];for(const dd of docs)blocks2=blocks2.concat(flatten(dd.doc,dd.f.name));
  twinParts(blocks2);
  /* כינוי שכבר נכתב אינו טקסט של המסמך, והסריקה לא נוגעת בו (סבב QA 1, M1). כינוי שהיא הקלידה
     ושהוא שם של אדם אמיתי אחר במסמך הוחלף שוב, בכינוי של האדם האחר — שרשרת — וכך גם כינוי
     שמכיל שם משפחה אמיתי של מישהו אחר */
  const pseudoWritten=[...new Set(applied.map(r=>norm(String(r.rep||"")).trim()).filter(w=>w.length>=2))];
  // הבדיקה המהירה רופפת כמו התבנית שאחריה (flex): "בן עמיאל" ברווח הוא "בן-עמיאל" שברשימה, וניקוד בין
  // האותיות אינו מפריד. בבדיקה המדויקת שם המשפחה של שולח בשיחה נשאר בטקסט (הציד של 11.10)
  const loose=s=>s.replace(/\u0000/g,"").replace(/[\s-]+/g," ");
  for(const blk of blocks2){
    if(blk.dupOf){if(blk.dupOf.reps)applyReps(blk,blk.dupOf.reps.map(r=>r.slice()));continue}
    // nl: בלי התווים שהקורא לא רואה (ניקוד, מקף רך, סימני כיוון). הסינון המהיר רץ עליו: על n, חלק של שם
    // שבתוכו תו כזה נפסל לפני שהביטוי (flex, שמדלג עליהם) הספיק לראות אותו, והחלק דלף (הציד של 11.10)
    const n=norm(blk.text),nl=loose(n),reps=[];
    const zones=[];
    for(const rx0 of eng.allow){rx0.lastIndex=0;let z;
      while((z=rx0.exec(n)))zones.push([z.index,z.index+z[0].length])}
    for(const w of pseudoWritten){let i=n.indexOf(w);
      while(i>=0){zones.push([i,i+w.length]);i=n.indexOf(w,i+1)}}
    // ציטוט של תיק אחר שנשאר (07-cite.js): גם המעבר הזה אינו כותב בתוכו
    for(const z of citeSpansIn(n,eng.citeKeys))zones.push(z);
    for(const [o,inf] of Object.entries(sweep)){
      if(!nl.includes(loose(o)))continue;
      const nw=inf.rep;
      // חלק של שם מופיע בעברית עם אות שימוש ("לגולדשמיט"), ולכן
      // הסריקה חייבת לקלוט אותה ולהחזיר אותה לתחליף.
      const rx=inf.of&&!inf.wordy
        ? new RegExp(NW+"([בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+flex(o)+NWE,"gu")
        : new RegExp(NW+"()"+flex(o)+NWE,"gu");
      let m;
      while((m=rx.exec(n))){
        const s=m.index,e=s+m[0].length;
        if(zones.some(([a,b])=>a<=s&&e<=b))continue;
        if(inf.date&&notDateAt(n,s,e))continue;
        const out=inf.of?addPre(m[1]||"",nw):nw;
        reps.push([s,e,out]); if(inf.date)dateFakes.push(out);
        applied.push({value:blk.text.slice(s,e),type:inf.place?"PLACE":"NAME",
          label:inf.of?(inf.place?"מקום (חלק)":"שם (חלק)"):"הופעה נוספת",part:partName(blk.part),
          why:inf.of?(inf.place
                ?(inf.wordy?`שם הרחוב מתוך «${inf.of}» — אבל גם מילה. הוחלף רק כשעומד לבד; ודאו שזה המקום`
                           :`שם הרחוב מתוך «${inf.of}» שכבר הוחלף, ומופיע כאן לבד`)
                :inf.wordy
                ?`חלק מהשם «${inf.of}» — אבל גם מילה. הוחלף רק כשעומד לבד; ודאו שזה האדם`
                :`חלק מהשם «${inf.of}» שכבר הוחלף, ומופיע כאן לבד`)
                    :"אותו ערך זוהה במקום אחר במסמך, אז הוחלף גם כאן",
          // חלק חד-משמעי של שם מהרשימה (שלוש אותיות ומעלה, לא מילה) מוחלף בלי
          // לבקש אישור (Q5 בגרסה 5): השם המלא ברשימה הוא ההחלטה שלה על האדם הזה.
          // חלק קצר, או שהוא גם מילה, נשאר לבדיקה — שם גרות ההחלפות השגויות.
          ctx:ctxHTML(blk.text,s,e),review:!!inf.of&&!!inf.wordy,rep:out,baseRep:nw,base:o,of:inf.of||undefined,src:"sweep"})}}
    blk.reps=reps.map(r=>r.slice());
    rep.sweep+=applyReps(blk,reps)}
  for(const c of eng.collided){
    flagged.push({value:c.rep,label:"שם בדוי שגם מופיע במסמך",part:"המסמך",review:true,src:"collide",collideOf:c.value,
      why:`«${c.value}» הוחלף ב«${c.rep}» כפי שבחרתם, אבל «${c.rep}» הוא גם אדם אמיתי במסמך הזה, `+
          `ושני האנשים ייראו כאחד. אפשר לבחור תחליף אחר בכרטיס של «${c.value}», או להוסיף לרשימה את האדם האמיתי בשם «${c.rep}»`,
      ctx:""});
  }
  for(const pa of partAmbig){
    const hit=blocks2.find(b=>new RegExp(NW+esc(pa.p)+NWE,"u").test(norm(b.text)));
    if(!hit)continue;
    const nb=norm(hit.text), mm=new RegExp(NW+esc(pa.p)+NWE,"u").exec(nb);
    flagged.push({value:pa.p,label:"שם משותף",part:partName(hit.part),
      why:`מופיע לבד, ומשותף ליותר מאדם אחד (${pa.of.join(", ")}) — לא הוחלף אוטומטית`,
      ctx:ctxHTML(hit.text,mm.index,mm.index+pa.p.length),review:true,src:"partAmbig"});
  }
  /* כתובות (הציד של 11.10): יעד של כל קשר בכל חלק .rels, וכתובת אינטרנט בקוד שדה, נקראים אחרי ההחלפה,
     עם הכינויים שכבר נבחרו ומול אותם ערכים שהבדיקה האחרונה מחפשת */
  const vsec=secrets.concat(subs.flatMap(s=>s.kind==="NAME"?variants(s.value,opt.prefixes||"normal").map(v=>v[0]):[s.value]));
  const ac=addrCtx(eng,applied,vsec.concat(dateSecrets),sweep);
  /* כתובת מקודדת שהוקלדה בטקסט עצמו — לא בקישור — עוברת את אותו ניקוי: שם הפוך או מחובר בנקודה ("שגיא_דנה.pdf",
     "דנה.שגיא") לא נמצא בה, והגיע ל-AI (הסקירה של 11.10). הטקסט כבר אחרי ההחלפות, אז מה שנשאר בה הוא מה שהן פספסו */
  {let blocks3=[];for(const dd of docs)blocks3=blocks3.concat(flatten(dd.doc,dd.f.name));
   for(const blk of blocks3){
     if(!/%[0-9A-Fa-f]{2}/.test(blk.text))continue;
     // הכתובת יכולה להיות דבוקה לאות שימוש ומקף ("נשמר ב-https://…"): מחפשים את תחילתה בתוך הטקסט
     const reps=[],rx=/(?:https?:\/\/|www\.|file:)[^\s"<>]+|(?<![A-Za-z0-9])[A-Za-z]:\\[^\s"<>|]+|\\\\[^\s"<>|]+/gi;let m;
     while((m=rx.exec(blk.text))){
       const tok=m[0].replace(/[.,;:!?)\]»"']+$/,"");
       if(!/%[0-9A-Fa-f]{2}/.test(tok))continue;
       const c=ac.clean(tok); if(c===tok)continue;
       reps.push([m.index,m.index+tok.length,c==null?"#":c]); rep.rels.push(tok)}
     if(reps.length)applyReps(blk,reps)}}
  for(const dd of docs)if(TEXTPART.test(dd.f.name))scrubFields(dd.doc,ac.clean,rep.rels);
  for(const f of keep)if(f.name.endsWith(".rels")){const s=TXT.decode(f.data),o=scrubRels(s,ac.clean,rep.rels);if(o!==s)f.data=ENC.encode(o)}
  for(const x of picks){
    const now=wText(x.c); if(now===x.was)continue;
    const iso=isoDateIn(now), full=x.el.getAttribute("w:fullDate");
    if(iso)x.el.setAttribute("w:fullDate",iso+full.slice(10)); else x.el.removeAttribute("w:fullDate")}
  for(const dd of docs) dd.f.data=ENC.encode(serXML(dd.doc,dd.orig));
  rep.residue=residuePass(keep,new Set(docs.map(d=>d.f.name)),subs,applied,dateFakes);
  /* מי שערך: w:author ו-w:initials שנשארו בחלק כלשהו — גם בחלק שהכלי אינו קורא, כמו הסגנונות של רכיבים
     מהירים — מתרוקנים. קבלת השינויים מוחקת את הרשומות עצמן; זו הרשת שמתחתיה (הציד של 11.10). */
  for(const f of keep){
    if(!f.name.endsWith(".xml"))continue;
    const o=TXT.decode(f.data), s=o.replace(/(\s[\w.-]+:(?:author|initials))="[^"]*"/g,'$1=""');
    if(s!==o)f.data=ENC.encode(s)}

  // התצוגה המקדימה: סימון כל תחליף על הטקסט שאחרי ההחלפה. תחליף שעומד ליותר
  // מערך אחד, או שהופיע כבר במקור, מסומן כדו-משמעי.
  const origAll=blocks.map(b=>b.text).join("\n");
  const repVals={};
  for(const r of applied){ if(!r.rep)continue;
    (repVals[r.rep]=repVals[r.rep]||new Set()).add(r.value); }
  const ambiguous=new Set(Object.keys(repVals).filter(rp=>
    repVals[rp].size>1 || origAll.includes(rp)));
  const ids={};applied.forEach((r,i)=>{if(r.rep&&!(r.rep in ids))ids[r.rep]=i});
  const preview=[];
  // התצוגה והטקסט שמועתק כוללים את מה ש-Word מוסיף בעצמו: מספרי סעיפים וסימני הערות
  const ctx=wordCtx(n=>{const x=docs.find(d=>d.f.name===n);return x?x.doc:null});
  let blocks3=[];for(const dd of docs)blocks3=blocks3.concat(flatten(dd.doc,dd.f.name,ctx));
  twinParts(blocks3);
  // שאלה של שכבת היישובים על מילה שהמעבר החליף כחלק של שם מהרשימה ("אלעד" מתוך «אלעד כהן»): כשלא נשאר ממנה
  // מופע, אין על מה להחליט, ואישור שלה היה הופך את האדם ליישוב בריצה הבאה
  {const fin=norm(blocks3.map(b=>b.text).join("\n"));
   for(let i=flagged.length-1;i>=0;i--){
     const f=flagged[i], v=norm(String(f.value||"")).trim(), sw=sweep[v];
     if(f.src!=="pattern"||f.type!=="PLACE_CITY"||!sw||!sw.of||sw.place)continue;
     if(!new RegExp(NW+"(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+flex(v)+NWE,"u").test(fin))flagged.splice(i,1);
   }}
  // פריט שנשאר לבדיקה אינו מסומן במסמך, ולכן הוא נראה בדיוק כמו טקסט שאיש לא נגע בו.
  // על מספר זה קטלני: מספר שנשאר בטקסט נקרא "הכלי פספס אותו", בעוד שבפועל הוא נמצא,
  // הוחלט שלא להחליף אותו אוטומטית, והוא מחכה להחלטה. סימון בצבע אזהרה אומר את זה.
  // "לא נמצא" ו"התנגשות פרופיל" אינם מוטבעים בטקסט ולכן אינם מסומנים.
  const flagVals=[...new Set(flagged.filter(r=>r.src!=="nohit"&&r.src!=="collide"&&r.value)
    .map(r=>String(r.value)).filter(v=>v.length>=2))];
  // המחיקות נרשמו על הבלוקים המקוריים; blocks3 הוא אותם בלוקים אחרי ההחלפה, באותו סדר
  const delsByIdx=blocks.map(b=>b.dels||[]);
  let bi3=-1;
  for(const blk of blocks3){
    bi3++;
    if(blk.dupOf)continue;
    const marks=[];
    for(const d of delsByIdx[bi3]||[]) marks.push({s:d.s,e:d.s,del:true,val:d.val});
    for(const [rp,id] of Object.entries(ids)){
      if(!rp||!blk.text.includes(rp))continue;
      let i=0;while((i=blk.text.indexOf(rp,i))>=0){marks.push({s:i,e:i+rp.length,id,amb:ambiguous.has(rp)});i+=rp.length}}
    for(const fv of flagVals){
      if(!blk.text.includes(fv))continue;
      let i=0;while((i=blk.text.indexOf(fv,i))>=0){marks.push({s:i,e:i+fv.length,flag:true,val:fv});i+=fv.length}}
    // החלפה גוברת על סימון לבדיקה כשהשניים חופפים
    marks.sort((a,b)=>a.s-b.s||(a.flag?1:0)-(b.flag?1:0));
    const kp=[];let last=-1;for(const m of marks)if(m.s>=last){kp.push(m);last=m.e}
    const sh=shown(blk);
    preview.push({part:partName(blk.part),text:sh.text,marks:sh.text===blk.text?kp:kp.map(m=>({...m,s:sh.at(m.s,false),e:m.del?sh.at(m.s,false):sh.at(m.e,true)}))});}

  // סריקת שיבושים על הפלט, לא על המקור: כל מה שדומה לשם שהוחלף ובכל זאת
  // שרד את ההחלפה — הוא בדיוק מה שהיה יוצא החוצה בלי שאף אחד ישים לב.
  let near=[], nearOf=null;
  if(opt.near!==false){
    const tset=new Map();
    for(const r of applied){
      const base=r.base||r.value; if(!base)continue;
      if(r.label==="הופעה נוספת")continue;
      if(!["שם","יישוב","מקום","מוסד חינוך","מוסד אקדמי","מוסד רפואי","עסק","גוף","מוסד","כתובת","פרט"]
         .includes(r.label)&&!r.label.startsWith("שם")&&!r.label.startsWith("גוף"))continue;
      const nv=norm(base).trim();
      if(!tset.has(nv))tset.set(nv,{value:base,norm:nv,words:nv.split(/\s+/).length,
        rep:r.baseRep||r.rep,kind:"NAME"});
    }
    for(const [p,g] of partOf){
      if(g.to.size!==1||tset.has(p))continue;
      tset.set(p,{value:p,norm:p,words:1,rep:[...g.to][0],kind:"NAME"});
    }
    for(const s of subs){
      const nv=norm(s.value).trim();
      if(!tset.has(nv))tset.set(nv,{value:s.value,norm:nv,words:nv.split(/\s+/).length,
        rep:s.replacement||eng.map[ckey(s.kind,s.value)]||"",kind:s.kind});
    }
    const banned=new Set();
    for(const r of applied){if(r.rep){const nr=norm(r.rep).trim();banned.add(nr);
      for(const w of nr.split(/\s+/))banned.add(w)}}
    for(const t of tset.values())banned.add(t.norm);
    for(const a of (allow||[]))banned.add(norm(a).trim());
    let blocksN=[];for(const dd of docs)blocksN=blocksN.concat(flatten(dd.doc,dd.f.name));
    twinParts(blocksN);
    const targets=[...tset.values()];
    near=findNear(blocksN.filter(b=>!b.dupOf&&!notProse(b.part)),targets,banned);
    nearOf=near.of>near.read?{read:near.read,of:near.of}:null;
    for(const nm of near)flagged.push(nm);
  }

  // שם מהרשימה שלא נמצא אפילו פעם אחת: או שהוא לא במסמך הזה, או שהוא
  // כתוב אחרת. שתיקה כאן משאירה אותה בטוחה שטופל.
  // גם ממצא שסומן לבדיקה הוא הופעה: שם קצר שמופיע רק עם אות שימוש ("והדס") מסומן
  // ולא מוחלף, וקודם דווח במקביל גם כ"לא מופיע במסמך הזה בכלל" — שתי אמירות סותרות
  // על אותו שם.
  const hitBases=new Set(applied.map(r=>norm(r.base||r.value).trim()));
  for(const r of flagged) if(r.src==="list"&&r.base) hitBases.add(norm(r.base).trim());
  // שם בתוך כתובת — יעד של קישור, או כתובת שהוסרה מהטקסט כולה (SharePoint) — הוא במסמך (הציד של 11.10)
  for(const r of applied) if(/%[0-9A-Fa-f]{2}|:\/\/|^www\./i.test(r.value)) ac.seen(r.value);
  for(const b of ac.names) hitBases.add(b);
  // יישוב מהתיק שכל מופעיו כאן נשאלו (cond): הוא במסמך, ולא "לא נמצא"
  for(const r of flagged) if(r.src==="pattern"&&r.base&&condV.has(norm(r.base).trim())) hitBases.add(norm(r.base).trim());
  const nearTargets=new Set(near.map(x=>norm(x.near.target).trim()));
  for(const s of subs){
    if(s.kind!=="NAME"&&s.kind!=="ORG"&&s.kind!=="PLACE")continue;
    const nv=norm(s.value).trim();
    if(hitBases.has(nv)||eng.alias[s.value])continue;
    const nearHit=near.find(x=>norm(x.near.target).trim()===nv);
    flagged.push({value:s.value,label:"לא נמצא",part:"המסמך",review:true,src:"nohit",ctx:"",
      why:nearHit?`לא מופיע במסמך בכתיב הזה, אבל נמצא «${nearHit.value}» — ראו למעלה`
                 :"לא מופיע במסמך הזה בכלל. אם זה שם מהתיק — בסדר; אם ציפיתם שיימצא, בדקו כתיב"});
  }
  const blob=await zip(keep);
  const outBuf=await blob.arrayBuffer();
  // שם שלא נמצא אינו דליפה — הוא מוצג ב«לבדיקה» אבל לא צובע את הבר
  const remaining=[...new Set(flagged.filter(r=>r.src!=="near"&&r.src!=="nohit").map(r=>r.value))];
  const dsubs=new Set(subs.filter(s=>s.kind==="DATE").map(s=>s.value));
  const ver=await verify(outBuf,vsec.filter(v=>!dsubs.has(v)&&!condV.has(norm(v).trim())),dateSecrets.concat([...dsubs]),dateFakes,
    placeSecrets.concat([...condV]));
  ver.hadList=subs.length>0;
  ver.remaining=remaining;
  ver.near=near;
  // הרשת האחרונה: שם שהיא לא רשמה, שיושב בגוף הטקסט ולא נגענו בו.
  // לא מחליפים אותו מאחורי גבה — שואלים.
  /* שכבה שנשברה אינה שכבה שלא מצאה כלום (ביקורת M25). סריקה שזרקה השאירה רשימה ריקה,
     והפס נעשה ירוק. עכשיו התוצאה אומרת איזו שכבה לא הסתיימה, והמסך מציג את זה. */
  const incomplete=[];
  if(nearOf){incomplete.push("near");ver.nearOf=nearOf}
  let suggest=[];
  try{
    if(opt.body===false)throw {skip:1};
    const known=[...subs.map(s=>s.value),...(allow||[]),
      ...applied.map(r=>r.base||r.value),...applied.map(r=>r.baseRep||r.rep)];
    suggest=bodyNames(ORIG.filter(b=>!notProse(b.part)),known)
      .filter(x=>!near.some(nm=>norm(nm.value).trim()===norm(x.value).trim()))
      // שם שמופיע רק בתוך ציטוטים של תיקים אחרים שנשארים אינו שם של התיק הזה (07-cite.js)
      .filter(x=>!citeOnly(x.value,ORIG.map(b=>b.text),eng.citeKeys))
      // והצעה שכל המילים בה נפוצות («במסגרתה», «עליו», «בעת ביצוע») אינה מוצגת (worthAsking, 05-bodynames.js)
      .filter(x=>worthAsking(x.value));
    // בלי תקרה: ההצעות נחתכו בשתים-עשרה, והשם השלושה-עשר שלא ברשימה לא הוצע ונשאר בקובץ (ביקורת L12).
  }catch(e){if(!e||!e.skip){console.warn("סריקת גוף הטקסט נכשלה",errNote(e));incomplete.push("body")}}
  ver.suggest=suggest;
  /* תווית בגרף או בתרשים עומדת לבדה, בלי משפט סביבה, ולכן סריקת הגוף — ששוקלת הקשר — אינה
     יכולה להציע אותה, וגם המודל כבוי לפעמים. תווית קצרה שכל מילה בה נראית כמו שם מוצעת
     להחלטה שלה, והפס אינו ירוק עד שהחליטה (ביקורת C2). */
  try{
    const knownN=new Set([...subs.map(s=>s.value),...(allow||[]),...applied.map(r=>r.base||r.value),
      ...suggest.map(x=>x.value)].map(v=>norm(v).trim()));
    const docTok=new Set(norm(ORIG.map(b=>b.text).join(" ")).split(/\s+/));
    const looksName=w=>KNOWN_FIRST.has(w)||POOL.he_s.includes(w)||POOL.ar_s.includes(w)||nameish(w,docTok);
    for(const b of ORIG){
      if(!b.label&&!/\/(?:charts|diagrams)\//.test(b.part))continue;
      const t=trimEdges(norm(b.text)).trim(), w=t.split(/\s+/).filter(Boolean);
      if(!t||w.length>3||knownN.has(t)||!w.every(looksName))continue;
      // מילה בודדת מוצעת רק כשהיא שם פרטי או שם משפחה מוכר: "הכנסות" ו"ינואר" הן תוויות רגילות
      if(w.length===1&&!(KNOWN_FIRST.has(t)||POOL.he_s.includes(t)||POOL.ar_s.includes(t)))continue;
      knownN.add(t);
      suggest.push({value:t,score:0,count:1,why:b.label?"כיתוב מעוצב (WordArt) שנראה כמו שם":"תווית בגרף או בתרשים שנראית כמו שם",ctx:ctxHTML(b.text,0,b.text.length),part:partName(b.part)});
    }
    /* טקסט חלופי של תמונה ("רחל פרידמן בפגישה במרכז הקשר") הוא משפט בלי הקשר של דיבור, וסריקת
       הגוף אינה קוראת אותו. בלי המודל שם שישב רק שם לא הוצע לאף שכבה, ועם המודל רק בחלק מהמקרים
       (נמצא במסמכי המבנה של הבנצ'מרק, ביקורת M20). שם פרטי מוכר ואחריו מילה שנראית כמו שם מוצעים. */
    for(const b of ORIG){
      if(!b.part.includes("טקסט חלופי")&&!b.pair)continue;
      const raw=String(b.text).split(/\s+/).map(x=>trimEdges(x)).filter(Boolean);
      for(let i=0;i+1<raw.length;i++){
        const a=norm(raw[i]).trim(), c=norm(raw[i+1]).trim();
        if(!(KNOWN_FIRST.has(a)||POOL.he_f.includes(a)||POOL.he_m.includes(a)||POOL.ar_f.includes(a)||POOL.ar_m.includes(a)))continue;
        if(!(POOL.he_s.includes(c)||POOL.ar_s.includes(c)||nameish(c,docTok)))continue;
        const t=raw[i]+" "+raw[i+1], tn=norm(t).trim();
        if(knownN.has(tn))continue;
        knownN.add(tn);
        suggest.push({value:t,score:0,count:1,why:"שם בטקסט החלופי של תמונה",ctx:ctxHTML(b.text,0,b.text.length),part:partName(b.part)});
      }
    }
  }catch(e){console.warn("סריקת התוויות נכשלה",errNote(e));incomplete.push("labels")}
  ver.incomplete=incomplete;
  // ירוק רק כשאין דליפות, אין ממצאים פתוחים, ואין ערוץ שלא נותח
  ver.complete=ver.passed&&!remaining.length&&!ver.embedded.length&&
    !near.length&&!suggest.length&&!incomplete.length;
  // dateOff: ההזזה של התאריכים במסמך הזה, בימים; ההחזרה מזיזה בה אחורה תאריך שה-AI חישב (backDates)
  // second: הבדיקה השנייה של התוצאה, בלי הרשימה (secondScan)
  return {blob,applied,flagged,preview,structural:rep,verification:ver,map:eng.map,dateOff:eng.dateOff,second:secondScan(preview,allow,subs,eng.citeKeys),
    // הציטוטים של תיקים אחרים שנשארו כמו שהם, לפי סדר הופעתם (07-cite.js); citeReplace מקבל מפתח מכאן
    cited:eng.citeKeys?[...eng.citeKeys]:[]};
}

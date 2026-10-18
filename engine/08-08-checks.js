// מספר או תאריך נבדקים בגבולות ספרות: "1.3.2026" אינו דולף בתוך התאריך המוזז "11.3.2026"
function secretTest(nv){
  if(!(/^\d/.test(nv)||/\d$/.test(nv)))return nt=>nt.includes(nv);
  const rx=new RegExp((/^\d/.test(nv)?"(?<!\\d)":"")+esc(nv)+(/\d$/.test(nv)?"(?!\\d)":""),"u");
  return nt=>rx.test(nt)}
/* dates: הערכים האמיתיים של תאריכים, ו-fakes: כל תאריך בדוי שנכתב, כמה פעמים שנכתב. תאריך נחשב שנשאר רק במקום
   שבו הוא תאריך: "12.3" של "ביום 12.3" אינו דולף ב"סעיף 12.3" או ב"3.5 ימים" (notDateAt), שהם מספר סעיף וכמות
   ונשארים כמו שהם (הציד של 11.10). תאריך נקרא על הטקסט בלי התגיות ועל ערכי התכונות, לא על ה-XML כמו שהוא: שם
   ריצה של Word בין "סעיף" למספר הסתירה את מילת הסעיף, והסעיף שנשאר נקרא תאריך שדלף (ביקורת 11.10). ותאריך דולף
   רק כשהוא מופיע יותר פעמים משנכתב בתוך תאריכים בדויים: במסמך צפוף, ההיסט לא תמיד מוצא מקום פנוי (dateOffFor),
   ותאריך בדוי שהוא גם תאריך אמיתי של המסמך אינו התאריך האמיתי שנשאר */
/* placeSecrets: יישובים שהם גם מילה או צירוף (placeCond) שהוחלפו במופע שהוא מקום. מופע שלהם הוא דליפה רק
   כשהשכבה הייתה מחליפה אותו בעצמה בטקסט הקריא (placeSure, אותו מבחן של findPlaces); המופע שנשאל ("נקודת מבט
   רעננה", "פותח פתח תקווה") אינו דליפה */
const XUN=s=>s.replace(/&(quot|apos|lt|gt|amp);/g,(m,k)=>({quot:'"',apos:"'",lt:"<",gt:">",amp:"&"})[k]);
/* בדיקה שנייה (החלטת הבעלים, 12.10, «A»; הביקורת ההנדסית: «הירוק בודק רק את הרשימה»). הבדיקה האחרונה (verify) מוודאת
   שמה שברשימה איננו בקובץ, ואינה יכולה לדעת על מה שהכלי לא מצא. זו קוראת את התוצאה עצמה, בלי הרשימה: מספר שנראה מזהה
   (ת"ז תקינה, טלפון, מייל, חשבון, כרטיס, דרכון, רכב), ושם פרטי מוכר שנשאר — לא מילה רגילה (wordish, poolWordy), לא בתוך
   מה שהכלי כתב (marks), ולא מה שהיא השאירה (allow). מה שנמצא אינו חוסם: הפס כתום, והיא מחליטה על כל אחד.
   preview: [{text, marks:[{s,e}]}], התוצאה. tests/secondscan_t.js */
const SECOND_NUM=new Set(["EMAIL","PHONE_MOBILE","PHONE_LAND","PHONE_INTL","FAX","ISRAELI_ID","ISRAELI_ID_SEP","ISRAELI_ID_LABELED",
  "CREDIT_CARD","IBAN","PASSPORT","PLATE","PLATE_LABELED","BANK_ACCOUNT"]);
// citeKeys: ציטוטים של תיקים אחרים שנשארו (07-cite.js); השמות שבהם אינם של התיק, והבדיקה אינה מעלה אותם
function secondScan(preview,allow,subs,citeKeys){
  const keep=new Set((allow||[]).map(a=>norm(String(a)).trim())), out=[], seen=new Set();
  const ctxOf=(t,s,e)=>({pre:(s>40?"…":"")+t.slice(Math.max(0,s-40),s), hit:t.slice(s,e), post:t.slice(e,e+40)+(e+40<t.length?"…":"")});
  const plain=x=>!poolWordy(x)&&!wordish(x);
  /* מילה של שם מהרשימה שנשארה לבדה («הורוביץ» ששם המשפחה שלו הוחלף רק בתוך השם המלא), או שונה ממנה באות אחת
     («בושקילה» של «בוסקילה»): הבדיקה האחרונה מחפשת את הערך כולו, ולא אותן */
  const listed=new Set(), particle=new Set(PART.split("|"));
  for(const r of subs||[]) if((r.kind||"NAME")==="NAME") for(const w of unseen(norm(String(r.value||""))).split(/\s+/)) if(w.length>=3&&plain(w)&&!particle.has(w)) listed.add(w);
  // שונה באות אחת: רק במילה של חמש אותיות לפחות. במילה קצרה יותר כמעט כל מילה רגילה רחוקה אות אחת משם («מוכן»)
  const near=w=>{ if(w.length<5)return false; for(const x of listed) if(x.length>=5&&Math.abs(x.length-w.length)<=1&&lev(w,x)<=1)return true; return false; };
  // סיומת של שם משפחה, בלי ‎-ייב ו־‎-סקה, שהן גם סיומות של מילים רגילות («התחייב», «הפסקה», «עסקה»)
  const SUR_END=/(?:וביץ|ביץ|סקי|ברג|בורג|שטיין|שטין|צקי)$/;
  const nameOk=x=>!!x&&plain(x)&&(KNOWN_FIRST.has(x)||listed.has(x)||near(x)||(x.length>=5&&SUR_END.test(x)));
  /* הבדיקה קוראת את מה שאדם קורא (ביקורת 18.10, F1): בלי התווים שאיש אינו רואה (squeeze), והסימונים עוברים למקומם
     בטקסט הזה. קודם «ברזניצקי» עם רווח ברוחב אפס אחרי הנו"ן נקראה «ברזנ» ו«יצקי», ושם המשפחה שנשאר לא הועלה. tests/readers_t.js */
  for(const b of preview||[]){
    const t0=String(b.text||""), q=squeeze(t0), t=q?q.t:t0, nt=norm(t), at=x=>q?seenAt(q,x):x;
    const marks=(b.marks||[]).map(m=>({s:at(m.s),e:at(m.e)})).concat(citeSpansIn(nt,citeKeys).map(([s,e])=>({s,e})));
    const inMark=(s,e)=>marks.some(m=>m.s<e&&s<m.e);
    // label: התווית של סוג הפרט, כמו בממצא רגיל, כדי ש«להחליף» יוסיף לרשימה את הסוג הנכון
    const push=(kind,pat,label,s,e)=>{
      const v=t.slice(s,e), k=norm(v).trim();
      if(!k||seen.has(kind+"|"+k)||keep.has(k))return;
      seen.add(kind+"|"+k); out.push({kind,pat,label,value:v,ctx:ctxOf(t,s,e)});
    };
    for(const p of PAT){
      if(!SECOND_NUM.has(p.n))continue;
      for(const m of nt.matchAll(new RegExp(p.rx.source,"gu"))){
        const v=m[p.g||0]; if(!v||(p.v&&!p.v(v)))continue;
        const s=m.index+(p.g?m[0].indexOf(v):0), e=s+v.length;
        if(!inMark(s,e))push("number",p.n,p.l,s,e);
      }
    }
    // ניקוד הוא \u0000 אחרי norm, והוא בתוך המילה, לא גבול שלה
    for(const m of nt.matchAll(/(?<![א-ת'"׳״]\u0000*)[א-ת](?:\u0000*[א-ת])+(?!\u0000*[א-ת'"׳״])/gu)){
      const w=unseen(m[0]), s=m.index, e=s+m[0].length;
      if(inMark(s,e))continue;
      // מילה שהיא עצמה שם מוכר או מהרשימה נלקחת כולה («הורוביץ», שה' שלו אינה אות שימוש); אחרת קודם בלי אות השימוש
      const whole=plain(w)&&(KNOWN_FIRST.has(w)||listed.has(w)), stem=w.length>3&&PFX.has(w[0])?w.slice(1):null;
      if(whole)push("name","NAME","שם",s,e);
      else if(stem&&nameOk(stem)&&!wordish(w))push("name","NAME","שם",s+1+m[0].slice(1).search(/[א-ת]/),e);
      else if(nameOk(w))push("name","NAME","שם",s,e);
    }
  }
  return out;
}
async function verify(buf,secrets,dates,fakes,placeSecrets){
  const files=await unzip(buf);
  const uniq2=a=>[...new Set((a||[]).filter(s=>s&&s.trim().length>=2))].map(s=>[s,norm(s)]);
  const sec=uniq2(secrets).map(([o,nv])=>{const v=unseen(nv); return [o,v,secretTest(v)]}), dsec=uniq2(dates).map(([o,nv])=>[o,nv.replace(/\u0000/g,"")]);
  const dateRX=nv=>new RegExp((/^\d/.test(nv)?"(?<!\\d)":"")+esc(nv)+(/\d$/.test(nv)?"(?!\\d)":""),"gu");
  const dateHits=(t,nv)=>{let c=0; for(const m of t.matchAll(dateRX(nv)))if(!notDateAt(t,m.index,m.index+m[0].length))c++; return c};
  const ps=new Set((placeSecrets||[]).map(s=>norm(s).trim()).filter(Boolean));
  const leaks=[],emb=[],dateIn=new Map();let n=0;
  for(const f of files){n++;
    if(/^word\/(embeddings|media)\//.test(f.name))emb.push(f.name);
    for(const enc of ["utf-8","utf-16le"]){
      let t;try{t=new TextDecoder(enc).decode(f.data)}catch(_){continue}
      let dv=t;
      /* הבדיקה קראה רק את ה-XML כמו שהוא, ושם שמפוצל בין ריצות, מופרד בטאב או כתוב
         עם קו תחתון ("רחל_פרידמן") לא נראה לה כלל (שכבה 1ב). קוראים גם את הטקסט בלי
         תגיות, כשטאב, טאב מיקום ומעבר שורה הם רווח וקו תחתון הוא רווח. */
      let read=t;
      if(/\.(xml|rels)$/.test(f.name)&&enc==="utf-8"){
        const raw=t;
        read=XUN(t.replace(/<\/(?:w|a):p>/g,"\n").replace(/<w:(?:tab|ptab|br|cr)\b[^>]*\/>/g," ").replace(/<w:noBreakHyphen\b[^>]*\/>/g,"-").replace(/<[^>]+>/g,""));
        // ומה שאינו טקסט ואינו תגית: ערכי תכונות והערות XML
        dv=read+"\n"+[...t.matchAll(/=(?:"([^"]*)"|'([^']*)')|<!--([\s\S]*?)-->/g)].map(m=>m[1]??m[2]??m[3]).join("\n");
        // + הוא רווח בכתובת ("?q=דנה+שגיא"), כמו קו תחתון
        t+="\n"+read+"\n"+t.replace(/[_+]/g," ");
        // וגם כמו שדפדפן קורא כתובת: "%D7%93" הוא "ד". שם מקודד ביעד של קישור עבר את הבדיקה (הציד של 11.10)
        if(/%[0-9A-Fa-f]{2}/.test(raw)){const d=pctPlain(raw);t+="\n"+d+"\n"+d.replace(/[+_]/g," ")}
      }
      // הבדיקה קוראת כמו אדם: תו שאיש אינו רואה או ניקוד בתוך שם שנשאר אינו מסתיר אותו (ביקורת 18.10, F1), כמו בתאריכים
      const nt=unseen(norm(t)), nd=norm(dv).replace(/\u0000/g,"");
      for(const [o,nv,has] of sec){
        if(!nv)continue;
        if(has(nt))leaks.push({value:o,part:f.name});
      }
      for(const [o,nv] of dsec){
        if(!nv)continue;
        const c=dateHits(nd,nv); if(!c)continue;
        const d=dateIn.get(o)||{n:0,parts:[]}; d.n+=c; d.parts.push(f.name); dateIn.set(o,d);
      }
      if(ps.size&&[...ps].some(p=>nt.includes(unseen(p.split(" ")[0])))){
        const nr=norm(seenText(read.replace(/_/g," "))), all=placeScan(nr);
        for(const x of all) if(ps.has(x.name)&&placeSure(nr,x,all)) leaks.push({value:x.name,part:f.name});
      }
    }}
  // התאריכים הבדויים בשורות נפרדות: אין בהם מילת סעיף או יחידה, ולכן כל אחד נקרא בהקשר של עצמו
  const wrote=(fakes||[]).map(x=>norm(String(x||"")).replace(/\u0000/g,"")).join("\n");
  for(const [o,nv] of dsec){
    const d=dateIn.get(o); if(!d)continue;
    if(d.n>dateHits(wrote,nv))for(const p of d.parts)leaks.push({value:o,part:p});
  }
  const uniq=[],seen=new Set();
  for(const l of leaks){const k=l.part+"|"+l.value;if(!seen.has(k)){seen.add(k);uniq.push(l)}}
  return {passed:!uniq.length,leaks:uniq,parts:n,embedded:emb}}


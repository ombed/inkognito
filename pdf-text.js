/* חילוץ טקסט מ-PDF. PDF סרוק (תמונה בלבד) יחזיר טקסט ריק — וזה מדווח כלפי מעלה
   במפורש, כי כלי שמחזיר "לא נמצאו ממצאים" על מסמך סרוק הוא כלי מסוכן. */
/* pdf.js רואה את ה-PDF שלה, ולכן הוא יושב באתר עצמו ולא נטען מ-CDN (ביקורת H14). הקבצים הם
   אלה של החבילה בגרסה הזאת בדיוק; tests/vendor_t.js מוודא. */
const LIB = new URL("./vendor/pdfjs-4.6.82/pdf.min.mjs", import.meta.url).href;
const WORKER = new URL("./vendor/pdfjs-4.6.82/pdf.worker.min.mjs", import.meta.url).href;

export async function pdfToText(buf){
  const pdfjs = await import(/* webpackIgnore: true */ LIB);
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  const doc = await pdfjs.getDocument({data:new Uint8Array(buf),isEvalSupported:false}).promise;
  const out=[], perPage=[];
  for(let p=1; p<=doc.numPages; p++){
    const pageLines=[];
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const count=(its,rx)=>(its.map(i=>i.str).join("").match(rx)||[]).length;
    const pageRtl=count(tc.items,/[א-ת]/g)>=count(tc.items,/[A-Za-z]/g);
    // איחוד פריטים לשורות לפי מיקום אנכי, אחרת כל מילה נופלת לשורה משלה
    const rows=new Map();
    for(const it of tc.items){
      if(!it.str) continue;
      const y=Math.round(it.transform[5]);
      let best=null;
      for(const k of rows.keys()) if(Math.abs(k-y)<=2){best=k;break}
      const key = best===null?y:best;
      (rows.get(key) || rows.set(key,[]).get(key)).push(it);
    }
    /* טקסט שאינו בתוכן העמוד (הציד של 11.10): טופס שמולא שומר את הערכים בשדות, ו«מילוי וחתימה» של Acrobat כותב
       בתיבות טקסט. רק התוויות נקראו: טופס קצר נראה סרוק, וטופס ארוך נטען בלי הערכים, בלי שום הודעה. כל ערך
       נכנס לשורה שבגובה השדה שלו, ליד התווית שלו */
    let ann=[]; try{ ann=await page.getAnnotations(); }catch(_){}
    for(const a of ann){
      if(!a||a.hidden||!Array.isArray(a.rect)) continue;
      let v=null;
      if(a.subtype==="Widget"&&a.fieldType!=="Btn") v=Array.isArray(a.fieldValue)?a.fieldValue.join(" "):a.fieldValue;
      else if(a.subtype==="FreeText") v=(a.contentsObj&&a.contentsObj.str)||(Array.isArray(a.textContent)?a.textContent.join(" "):"");
      if(typeof v!=="string"||!v.trim()) continue;
      const [x1,y1,x2,y2]=a.rect, yc=(y1+y2)/2, half=Math.abs(y2-y1)/2+2;
      let key=null;
      for(const k of rows.keys()) if(Math.abs(k-yc)<=half){key=k;break}
      if(key===null){ key=Math.round(yc); rows.set(key,[]); }
      rows.get(key).push({str:v.replace(/\s+/g," ").trim(), transform:[12,0,0,12,Math.min(x1,x2),key], width:Math.abs(x2-x1)});
    }
    const lines=[];
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([y,items])=>{
      /* שורה עברית נקראת מימין לשמאל, ולכן הפריט הראשון שלה הוא הימני ביותר. מיון עולה לפי x
         הפך כל שורה עברית שפוצלה לכמה פריטים — מספיקה מילה מודגשת אחת — ו"האם רונית לוי
         מתגוררת בחיפה" יצא "מתגוררת בחיפה רונית לוי האם": שם שנחצה בין שני פריטים יצא הפוך ולא
         נמצא, בלי שום שגיאה (חשד מהביקורת, אושר בהרצה). הטקסט שבתוך כל פריט כבר בסדר קריאה. */
      // שורה בלי אותיות בכלל (מספרים בלבד) הולכת אחרי הכיוון של העמוד
      const he=count(items,/[א-ת]/g), la=count(items,/[A-Za-z]/g), rtl=he+la?he>=la:pageRtl;
      items.sort((a,b)=>rtl?b.transform[4]-a.transform[4]:a.transform[4]-b.transform[4]);
      /* פריטים סמוכים שביניהם רווח בעמוד ולא בטקסט (הציד של 11.10): קטעי שורה עברית שנכתבו כל אחד לבד מימין לשמאל —
         מילה מודגשת באמצע שורה — יצאו דבוקים, «המבקשתרחל פרידמןהגישה», ושם שברשימה לא נמצא. pdf.js מוסיף רווח רק
         כשהכתיבה מתקדמת ימינה. מרווח של יותר מ-0.15 מגודל הגופן, בלי רווח באף צד, הוא רווח; פריטים צמודים נשארים מילה */
      let line="";
      items.forEach((it,k)=>{
        if(k){
          const p=items[k-1], t=it.transform, fs=Math.hypot(t[2],t[3])||Math.abs(t[0])||10;
          const gap=rtl?p.transform[4]-(t[4]+(it.width||0)):t[4]-(p.transform[4]+(p.width||0));
          if(gap>0.15*fs&&!/\s$/.test(line)&&!/^\s/.test(it.str)) line+=" ";
        }
        line+=it.str;
      });
      line=line.replace(/\s+/g," ").trim();
      if(line) lines.push({y, line, rtl, x0:Math.min(...items.map(i=>i.transform[4])), x1:Math.max(...items.map(i=>i.transform[4]+(i.width||0)))});
    });
    /* שורה שנשברה באמצע פסקה היא לא פסקה חדשה (הציד של 11.10): כל שורה חזותית נעשתה פסקה, והזיהוי רץ
       פסקה אחרי פסקה, ולכן טלפון שנשבר אחרי «052-», כתובת אחרי «ברחוב», תאריך או תואר בסוף שורה לא נמצאו,
       והפס היה ירוק. שורה ממשיכה לבאה כשהיא ממלאת את רוחב גוש הטקסט (שורה שנשברה מגיעה לשני הצדדים;
       השורה האחרונה של פסקה, או פסקה של שורה אחת, קצרה יותר), הגוש עצמו רחב (עמוד של שורות קצרות אינו
       פסקה אחת), הבאה במרחק שורה רגיל, ואינה פותחת סעיף ממוספר. מקף בסוף שורה מתחבר בלי רווח. */
    const pageW=page.view?page.view[2]-page.view[0]:0;
    const left=Math.min(...lines.map(l=>l.x0)), right=Math.max(...lines.map(l=>l.x1)), block=right-left;
    const gaps=lines.slice(1).map((l,i)=>lines[i].y-l.y).filter(g=>g>0).sort((a,b)=>a-b);
    const pitch=gaps.length?gaps[Math.floor(gaps.length/2)]:0;
    const wide=pageW>0&&block>=0.6*pageW;
    const full=l=>l.x1-l.x0>=0.9*block;
    for(let i=0;i<lines.length;i++){
      let text=lines[i].line;
      while(wide&&pitch>0&&i+1<lines.length&&full(lines[i])&&lines[i].y-lines[i+1].y<=1.5*pitch&&
            !/^(?:\d{1,3}[.)]|\(\s*[א-ת\d]{1,3}\s*\))\s/.test(lines[i+1].line)){
        const next=lines[i+1].line;
        // בשורה מימין לשמאל מספר שנשבר אחרי מקף נקרא בסדר החזותי שלו, «-052» ולא «052-»: הוא חוזר לסדר
        // הקריאה ומתחבר לשורה הבאה בלי רווח
        if(lines[i].rtl&&/^\d/.test(next)&&/(^|\s)-\d+$/.test(text)) text=text.replace(/-(\d+)$/,"$1-")+next;
        else text=/[-־]$/.test(text)?text+next:text+" "+next;
        i++;
      }
      out.push(text); pageLines.push(text);
    }
    perPage.push(pageLines);
    if(p<doc.numPages) out.push("");
  }
  const text=out.join("\n").trim();
  /* עמוד הוא תמונה כשמה שנשאר בו, אחרי שורות שחוזרות ברוב העמודים (כותרת של בית המשפט,
     מספר תיק, מספור עמוד), הוא פחות מארבעים תווים. הבדיקה הקודמת ספרה את כל הטקסט, ולכן
     מסמך סרוק שכל עמוד בו נושא כותרת מודפסת עבר כטקסט, והיא לא ידעה שגוף המסמך הוא תמונה
     (חשד מהביקורת, אושר). מסמך מעורב — עמוד חתום שנסרק בין עמודי טקסט — אומר אילו עמודים. */
  const key=l=>l.replace(/\d+/g,"#").trim();
  const seen=new Map();
  for(const lines of perPage) for(const k of new Set(lines.map(key))) seen.set(k,(seen.get(k)||0)+1);
  const repeated=k=>doc.numPages>=2&&seen.get(k)>=Math.max(2,Math.ceil(doc.numPages/2));
  const imagePages=[];
  perPage.forEach((lines,i)=>{ const own=lines.filter(l=>!repeated(key(l))).join("").replace(/\s+/g,"").length; if(own<40) imagePages.push(i+1); });
  return {text, pages:doc.numPages, imagePages, scanned:imagePages.length===doc.numPages};
}

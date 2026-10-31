const PARTN={"document.xml":"גוף המסמך","footnotes.xml":"הערות שוליים","endnotes.xml":"הערות סיום"};
function partName(p){
  const base=p.split(" (")[0].split("/").pop();
  const ex=p.includes("טקסט חלופי")?" · טקסט חלופי":p.includes("קוד שדה")?" · קוד שדה":p.includes("הגדרות עיצוב")?" · הגדרות עיצוב":"";
  // לפני גוף המסמך: הרכיבים המהירים יושבים ב-word/glossary/document.xml, ונקראו "גוף המסמך"
  if(p.includes("glossary"))return "רכיבים מהירים"+ex;
  if(PARTN[base])return PARTN[base]+ex;
  if(base.startsWith("header"))return "כותרת עליונה"+ex;
  if(base.startsWith("footer"))return "כותרת תחתונה"+ex;
  if(p.includes("glossary"))return "רכיבים מהירים"+ex;
  if(p.includes("/diagrams/"))return "תרשים SmartArt"+ex;
  if(p.includes("/charts/"))return "גרף"+ex;
  if(base==="settings.xml")return "הגדרות המסמך"+ex;
  if(base==="numbering.xml")return "מספור"+ex;
  if(base.startsWith("styles"))return "סגנונות"+ex;
  return base+ex}
function ctxHTML(t,s,e,w=55){
  const a=Math.max(0,s-w),b=Math.min(t.length,e+w);
  return {pre:(a>0?"…":"")+t.slice(a,s), hit:t.slice(s,e), post:t.slice(e,b)+(b<t.length?"…":"")}}

/* המשפטים שערך מופיע בהם, לכל היותר max מהם.

   מסך "מי בתיק" ומסך היישובים מבקשים החלטה על מילה בלי להראות אותה במסמך.
   כש«אזור» מופיע ברשימת המקומות, אי אפשר לדעת אם זו העיירה
   שליד חולון או המילה הרגילה, כשאף דבר במסך לא בא מהמסמך. מסך הבדיקה כבר
   שומר בדיוק את ההקשר הזה ומציג אותו; כאן הוא נבנה גם לשני המסכים שלפניו.

   אותו גבול מילה ואותה אות שימוש ככללי ההחלפה, כדי שמה שנראה בדוגמה יהיה מה
   שיוחלף בפועל. ההדגשה כוללת את אות השימוש ("באזור"), שזו הצורה שבמסמך. */
function examplesOf(blocks,value,max=3){
  const v=norm(String(value||"")).trim();
  if(v.length<2)return [];
  const rx=new RegExp(NW+"(?:[בהולמכש]|ו[בהלמכ]|כש|מה|לכ)?"+flex(v)+NWE,"gu");
  const out=[];
  for(const b of blocks||[]){
    const t=b&&typeof b.text==="string"?b.text:typeof b==="string"?b:"";
    if(!t)continue;
    const n=norm(t);
    rx.lastIndex=0; let m;
    while((m=rx.exec(n))){
      if(m[0].length)out.push(ctxHTML(t,m.index,m.index+m[0].length));
      else rx.lastIndex++;
      if(out.length>=max)return out;
    }
  }
  return out;
}


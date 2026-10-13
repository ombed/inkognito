/* ══════════════════════════ XML ══════════════════════════ */
const W="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XMLNS="http://www.w3.org/XML/1998/namespace";
const DEC='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const TXT=new TextDecoder(),ENC=new TextEncoder();
// תג הפתיחה של השורש ומקומו: מדלג על הצהרות, הוראות עיבוד והערות שלפניו
function rootTag(s){let i=0;
  while(i<s.length){const j=s.indexOf("<",i); if(j<0)return null;
    if(s.startsWith("<!--",j)){const e=s.indexOf("-->",j+4); if(e<0)return null; i=e+3; continue}
    if(s[j+1]==="?"||s[j+1]==="!"){const e=s.indexOf(">",j); if(e<0)return null; i=e+1; continue}
    let k=j+1,q=null;
    while(k<s.length){const c=s[k];
      if(q){if(c===q)q=null}else if(c==='"'||c==="'")q=c;else if(c===">")return {at:j,tag:s.slice(j,k+1)};
      k++}
    return null}
  return null}
function parseXML(str){const d=new DOMParser().parseFromString(str,"application/xml");
  if(d.querySelector("parsererror")) throw new Error("XML פגום");return d}
/* מה שהמסדר כתב, עם תג השורש המקורי (הצהרות המרחבים כפי שהיו) במקום התג שלו, ו-DEC כהצהרה היחידה.
   הדפדפנים ו-xmldom כותבים הצהרה לפני השורש: החלפת התג בחיתוך מתחילת הטקסט השאירה את זנב התג כטקסט בכל חלק
   שנכתב מחדש, ושורש ריק השאיר את ההצהרה של המסדר אחרי DEC — שתי הצהרות, קובץ פגום (13.10). */
function serXML(doc,orig){
  let out=new XMLSerializer().serializeToString(doc).replace(/^\s*<\?xml\s[^>]*\?>\s*/,"");
  const o=rootTag(orig),n=rootTag(out);
  if(o&&n&&!o.tag.endsWith("/>")&&!n.tag.endsWith("/>")) out=out.slice(0,n.at)+o.tag+out.slice(n.at+n.tag.length);
  return DEC+out;
}
const TEXTPART=/^word\/(glossary\/)?(document\d*\.xml|header\d*\.xml|footer\d*\.xml|footnotes\.xml|endnotes\.xml)$/;
const DROP=["word/comments.xml","word/commentsExtended.xml","word/commentsIds.xml",
  "word/commentsExtensible.xml","word/people.xml","docProps/custom.xml","word/threadedComments.xml"];


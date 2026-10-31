/* שמות שברשימה בטקסט של תמונת EMF (UTF-16, בכל פקודה, גם בעותק של EMF+), באותו אורך, כדי שאף מבנה בקובץ לא יזוז:
   הכינוי מרופד ברווחים או מקוצר. לא בתוך מילה ארוכה יותר. מה שלא ברשימה נשאר, כמו כל טקסט בתמונה (הביקורת החיצונית של
   18.10, F3). pairs: [ערך, כינוי, תאריך?] */
function emfNames(u,pairs,dateOut){
  let out=null;
  const heb=c=>c>=0x05D0&&c<=0x05EA, at=(a,i)=>i>=0&&i+1<a.length?a[i]|(a[i+1]<<8):0;
  for(const [v,r,d] of pairs){
    if(v.length<2||!/[א-ת0-9]/.test(v))continue;
    const fit=(r+" ".repeat(v.length)).slice(0,v.length), pat=new Uint8Array(2*v.length);
    for(let i=0;i<v.length;i++){pat[2*i]=v.charCodeAt(i)&255; pat[2*i+1]=v.charCodeAt(i)>>8}
    const a=out||u;
    for(let i=a.indexOf(pat[0]);i>=0&&i+pat.length<=a.length;i=a.indexOf(pat[0],i+1)){
      let k=1; while(k<pat.length&&a[i+k]===pat[k])k++;
      if(k<pat.length||heb(at(a,i-2))||heb(at(a,i+pat.length)))continue;
      if(!out)out=new Uint8Array(u);
      for(let j=0;j<fit.length;j++){out[i+2*j]=fit.charCodeAt(j)&255; out[i+2*j+1]=fit.charCodeAt(j)>>8}
      if(d&&dateOut)dateOut.push(fit.trim());
      i+=pat.length-1;
    }
  }
  return out;
}

// התאריך המלא הראשון שכתוב בטקסט, כ-YYYY-MM-DD, או null
function isoDateIn(s){
  const t=String(s||"").trim();
  for(const c of [t,...(t.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[בל]?-?[א-ת]+,?\s+\d{4}/g)||[])]){
    const p=parseDate(c); if(p&&p.y!=null)return p.y+"-"+String(p.m).padStart(2,"0")+"-"+String(p.d).padStart(2,"0")}
  return null}
/* פרטים נסתרים בתמונות שבמסמך (הביקורת ההנדסית, 12.10): צילום מטלפון נושא בתוכו את המקום (GPS), המצלמה, התאריך,
   לפעמים שם של אדם ותמונה ממוזערת. הכלי לא קורא את מה שבתמונה, אבל את אלה מסירים בלי לגעת בתמונה עצמה.
   JPEG: יוצאים EXIF ו-XMP (APP1), APP3 עד APP13, APP15, הערות (COM), APP2 שאינו פרופיל צבע, וכל מה שאחרי סוף
   התמונה (EOI; טלפונים מצרפים שם תמונות נוספות). נשארים JFIF (APP0), פרופיל הצבע (APP2 ICC) ו-Adobe (APP14),
   כי בלעדיהם הצבעים משתנים. כיוון הצילום נשמר ב-EXIF חדש שאין בו דבר מלבדו, אחרת צילום מטלפון יוצא על הצד.
   PNG: יוצאים tEXt, zTXt, iTXt, eXIf, tIME ומה שאחרי IEND. קובץ שלא נקרא עד סופו נשאר כמו שהוא (null).
   tests/imgmeta_t.js */
const u16=(u,i,le)=>le?u[i]|(u[i+1]<<8):(u[i]<<8)|u[i+1];
const u32=(u,i,le)=>(le?(u[i]|(u[i+1]<<8)|(u[i+2]<<16)|(u[i+3]<<24)):((u[i]<<24)|(u[i+1]<<16)|(u[i+2]<<8)|u[i+3]))>>>0;
function exifOrientation(seg){
  // seg: APP1 בלי הסמן והאורך; "Exif\0\0" ואחריו כותרת TIFF
  if(seg.length<14||String.fromCharCode(...seg.subarray(0,4))!=="Exif")return 0;
  const t=seg.subarray(6), le=t[0]===0x49; if(!le&&t[0]!==0x4D)return 0;
  const ifd=u32(t,4,le); if(ifd+2>t.length)return 0;
  const n=u16(t,ifd,le);
  for(let k=0;k<n;k++){ const e=ifd+2+12*k; if(e+12>t.length)return 0;
    if(u16(t,e,le)===0x0112&&u16(t,e+2,le)===3){ const o=u16(t,e+8,le); return o>=1&&o<=8?o:0; } }
  return 0;
}
function orientApp1(o){
  // FF E1, אורך 34, "Exif\0\0", TIFF big-endian, IFD0 עם רשומה אחת: Orientation (SHORT) = o
  return new Uint8Array([0xFF,0xE1,0,34,0x45,0x78,0x69,0x66,0,0,0x4D,0x4D,0,0x2A,0,0,0,8,0,1,0x01,0x12,0,3,0,0,0,1,0,o,0,0,0,0,0,0]);
}
const cat=parts=>{ const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let o=0; for(const p of parts){ out.set(p,o); o+=p.length; } return out; };
function stripJpeg(u){
  if(u.length<4||u[0]!==0xFF||u[1]!==0xD8)return null;
  const out=[u.subarray(0,2)]; let p=2, orient=0, changed=false, ended=false;
  while(p<u.length){
    if(u[p]!==0xFF)return null;
    const m=u[p+1];
    if(m===0xFF){ p++; continue; }
    if(m===0xD9){ out.push(u.subarray(p,p+2)); p+=2; ended=true; break; }
    if((m>=0xD0&&m<=0xD7)||m===0x01){ out.push(u.subarray(p,p+2)); p+=2; continue; }
    if(p+4>u.length)return null;
    const len=u16(u,p+2,false); if(len<2||p+2+len>u.length)return null;
    const seg=u.subarray(p,p+2+len), body=seg.subarray(4);
    const icc=m===0xE2&&String.fromCharCode(...body.subarray(0,11))==="ICC_PROFILE";
    const drop=m===0xE1||(m===0xE2&&!icc)||(m>=0xE3&&m<=0xED)||m===0xEF||m===0xFE;
    if(m===0xE1&&!orient){ const o=exifOrientation(body); if(o>1)orient=o; }
    if(drop)changed=true; else out.push(seg);
    p+=2+len;
    if(m===0xDA){
      // הנתונים המקודדים עד הסמן הבא: FF 00 הוא בית רגיל, FF D0..D7 הם סמני איפוס שבתוך הנתונים
      const s=p;
      while(p+1<u.length&&!(u[p]===0xFF&&u[p+1]!==0x00&&!(u[p+1]>=0xD0&&u[p+1]<=0xD7)))p++;
      if(p+1>=u.length)return null;
      out.push(u.subarray(s,p));
    }
  }
  if(!ended)return null;
  if(p<u.length)changed=true;
  if(!changed)return null;
  if(orient)out.splice(out[1]&&out[1][1]===0xE0?2:1,0,orientApp1(orient));
  return cat(out);
}
function stripPng(u){
  const SIG=[137,80,78,71,13,10,26,10];
  if(u.length<8||SIG.some((b,i)=>u[i]!==b))return null;
  const out=[u.subarray(0,8)]; let p=8, changed=false, ended=false;
  while(p+12<=u.length){
    const len=u32(u,p,false), type=String.fromCharCode(...u.subarray(p+4,p+8));
    if(p+12+len>u.length)return null;
    if(/^(?:tEXt|zTXt|iTXt|eXIf|tIME)$/.test(type))changed=true; else out.push(u.subarray(p,p+12+len));
    p+=12+len;
    if(type==="IEND"){ ended=true; break; }
  }
  if(!ended)return null;
  if(p<u.length)changed=true;
  return changed?cat(out):null;
}
/* ועוד (הביקורת החיצונית של 18.10, F3): GIF, WebP, TIFF ו-EMF יצאו כמו שהם. GIF: יוצאות ההערות (Comment Extension)
   ו-XMP. WebP: יוצאים EXIF ו-XMP, והדגלים שלהם בכותרת. TIFF: התגים שבהם טקסט (תיאור, מחבר, מצלמה, תוכנה, תאריך,
   זכויות, XMP, IPTC) מתאפסים במקומם, וכך גם כל מה שבתת-התיקיות של EXIF ו-GPS; המבנה עצמו לא זז. EMF: התיאור שבכותרת
   מתאפס (ושמות שברשימה בטקסט שבו מוחלפים ב-residuePass). מה שלא נקרא עד סופו נשאר כמו שהוא (null) */
function stripGif(u){
  const sig=String.fromCharCode(...u.subarray(0,6));
  if(u.length<13||(sig!=="GIF89a"&&sig!=="GIF87a"))return null;
  let p=13; if(u[10]&0x80)p+=3*(1<<((u[10]&7)+1));
  if(p>u.length)return null;
  const out=[u.subarray(0,p)]; let changed=false, ended=false;
  // רצף של תת-בלוקים, עד בלוק באורך אפס; המקום שאחריו, או -1
  const subs=q=>{while(q<u.length){const n=u[q++]; if(!n)return q; q+=n} return -1};
  while(p<u.length){
    const b=u[p];
    if(b===0x3B){out.push(u.subarray(p,p+1)); p++; ended=true; break}
    if(b===0x21){
      const label=u[p+1], xmp=label===0xFF&&u[p+2]===11&&String.fromCharCode(...u.subarray(p+3,p+14))==="XMP DataXMP";
      const q=subs(p+2); if(q<0)return null;
      if(label===0xFE||xmp)changed=true; else out.push(u.subarray(p,q));
      p=q; continue;
    }
    if(b===0x2C){
      let q=p+10; if(q>u.length)return null; if(u[p+9]&0x80)q+=3*(1<<((u[p+9]&7)+1));
      q=subs(q+1); if(q<0)return null;
      out.push(u.subarray(p,q)); p=q; continue;
    }
    return null;
  }
  if(!ended)return null;
  if(p<u.length)changed=true;
  return changed?cat(out):null;
}
function stripWebp(u){
  if(u.length<12||String.fromCharCode(...u.subarray(0,4))!=="RIFF"||String.fromCharCode(...u.subarray(8,12))!=="WEBP")return null;
  const out=[]; let p=12, at=12, x=-1, changed=false;
  while(p+8<=u.length){
    const id=String.fromCharCode(...u.subarray(p,p+4)), len=u32(u,p+4,true), end=p+8+len+(len&1);
    if(end>u.length)return null;
    if(id==="EXIF"||id==="XMP ")changed=true;
    else{ if(id==="VP8X")x=at; out.push(u.subarray(p,end)); at+=end-p; }
    p=end;
  }
  if(p<u.length)changed=true;
  if(!changed)return null;
  const r=cat([u.subarray(0,12),...out]), size=r.length-8;
  r[4]=size&255; r[5]=(size>>8)&255; r[6]=(size>>16)&255; r[7]=size>>>24;
  if(x>=0)r[x+8]&=~0x0C;
  return r;
}
const TIFF_TEXT=new Set([269,270,271,272,285,305,306,315,316,700,33432,33723,34377,37510,42016,42032,42033]);
const TIFF_SIZE={1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,13:4,16:8,17:8,18:8};
function stripTiff(u){
  const le=u[0]===0x49&&u[1]===0x49;
  if(u.length<8||(!le&&!(u[0]===0x4D&&u[1]===0x4D))||u16(u,2,le)!==42)return null;
  const out=new Uint8Array(u); let changed=false;
  // all: כל הרשומות של התיקייה (תת-תיקייה של EXIF או GPS); אחרת רק התגים שבהם טקסט. false: לא נקרא עד סופו
  const wipe=(ifd,all,depth)=>{
    if(depth>4||ifd+2>u.length)return false;
    const n=u16(u,ifd,le); if(ifd+2+12*n+4>u.length)return false;
    for(let k=0;k<n;k++){
      const e=ifd+2+12*k, tag=u16(u,e,le), type=u16(u,e+2,le), sz=(TIFF_SIZE[type]||1)*u32(u,e+4,le);
      if(tag===34665||tag===34853){ if(!wipe(u32(u,e+8,le),true,depth+1))return false; continue; }
      if(!all&&!TIFF_TEXT.has(tag))continue;
      if(sz<=4)out.fill(0,e+8,e+12);
      else{ const off=u32(u,e+8,le); if(off+sz>u.length)return false; out.fill(0,off,off+sz); }
      changed=true;
    }
    return true;
  };
  let ifd=u32(u,4,le);
  for(let page=0;ifd&&page<64;page++){
    if(!wipe(ifd,false,0))return null;
    ifd=u32(u,ifd+2+12*u16(u,ifd,le),le);
  }
  return changed?out:null;
}
function stripEmf(u){
  if(u.length<88||u32(u,0,true)!==1||u32(u,40,true)!==0x464D4520)return null;
  const n=u32(u,60,true), off=u32(u,64,true);
  if(!n||off+2*n>u.length)return null;
  const out=new Uint8Array(u); out.fill(0,off,off+2*n);
  return out;
}
function stripImageMeta(name,u){
  if(/\.(?:jpe?g|jfif)$/i.test(name))return stripJpeg(u);
  if(/\.png$/i.test(name))return stripPng(u);
  if(/\.gif$/i.test(name))return stripGif(u);
  if(/\.webp$/i.test(name))return stripWebp(u);
  if(/\.tiff?$/i.test(name))return stripTiff(u);
  if(/\.emf$/i.test(name))return stripEmf(u);
  return null;
}
/* SVG (הביקורת החיצונית של 18.10, F3): הטקסט שבו כתוב כטקסט, הכותרת (title), התיאור (desc), התוויות (text) והמטא-נתונים,
   ואיש מהם לא נקרא: «תרשים של …» יצא בקובץ כמו שהוא, והבדיקה האחרונה עברה. Word שומר כל SVG לצד עותק PNG שלו ומציג את
   ה-SVG; כאן ה-SVG יוצא, וההפניה אליו (svgBlip) איתו, ו-Word מציג את ה-PNG, תמונה כמו כל תמונה אחרת במסמך. מחזיר את
   החלקים שיצאו. SVG שיש אליו עוד הפניה נשאר, וממנו יוצאים כותרת, תיאור, מטא-נתונים והערות (cleanSvg); שמות שברשימה
   בטקסט שלו מוחלפים ב-residuePass. tests/pictext_t.js */
const SVG_EXT=/<(\w+):ext\b[^>]*\buri="\{96DAC541-7B7A-43D3-8B79-37D633B846F1\}"[^>]*>[\s\S]*?<\/\1:ext>/g;
function partOf(from,target){
  if(target.startsWith("/"))return target.slice(1);
  const out=from.split("/").slice(0,-1);
  for(const s of target.split("/")){ if(s==="..")out.pop(); else if(s&&s!==".")out.push(s); }
  return out.join("/");
}
function dropSvgCopies(files){
  const cut=new Set(), relsOf=n=>n.replace(/([^/]*)$/,"_rels/$1.rels");
  for(const f of files){
    if(!/\.xml$/.test(f.name))continue;
    const s=TXT.decode(f.data); if(!s.includes("96DAC541"))continue;
    const ids=[], t=s.replace(SVG_EXT,m=>{const r=/\bembed="([^"]+)"/.exec(m); if(r)ids.push(r[1]); return ""}).replace(/<(\w+):extLst>\s*<\/\1:extLst>/g,"");
    if(t===s)continue;
    f.data=ENC.encode(t);
    const rf=files.find(x=>x.name===relsOf(f.name)); if(!rf)continue;
    let rs=TXT.decode(rf.data);
    for(const id of ids){
      const m=new RegExp(`<Relationship\\b[^>]*\\bId="${esc(id)}"[^>]*/>`).exec(rs); if(!m)continue;
      const tg=(/\bTarget="([^"]+)"/.exec(m[0])||[])[1];
      rs=rs.replace(m[0],"");
      if(tg&&!/TargetMode="External"/.test(m[0]))cut.add(partOf(f.name,tg));
    }
    rf.data=ENC.encode(rs);
  }
  // SVG שעוד חלק מפנה אליו נשאר
  for(const rf of files.filter(x=>x.name.endsWith(".rels"))){
    const from=rf.name.replace(/_rels\/([^/]*)\.rels$/,"$1"), rs=TXT.decode(rf.data);
    for(const m of rs.matchAll(/<Relationship\b[^>]*>/g)){ const tg=(/\bTarget="([^"]+)"/.exec(m[0])||[])[1]; if(tg)cut.delete(partOf(from,tg)); }
  }
  return [...cut];
}
function cleanSvg(u){
  const s=TXT.decode(u);
  const t=s.replace(/<!--[\s\S]*?-->/g,"").replace(/<(\w+:)?(title|desc|metadata)\b[^>]*\/>/g,"").replace(/<((?:\w+:)?(?:title|desc|metadata))\b[^>]*>[\s\S]*?<\/\1>/g,"")
    .replace(/\s(?:aria-label|xlink:title|aria-description)="[^"]*"/g,"");
  return t===s?null:ENC.encode(t);
}

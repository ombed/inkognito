const NER_CACHE="transformers-cache";
let nerEnv=function(){
  const local=location.protocol==="file:";
  return {local,
    canCache:!local&&typeof caches!=="undefined"&&!!window.isSecureContext,
    canRun:!local};
};
let nerCached=async function(){
  try{
    if(!nerEnv().canCache)return false;
    const c=await caches.open(NER_CACHE);
    const k=await c.keys();
    // רק עותק של המודל הנוכחי נחשב: עותק ישן (dictabert-ner מ-Hugging Face) נמחק בטעינה הבאה
    return k.some(r=>r.url===MODEL_URL(NER_SPEC.weights.file));
  }catch(_){return false}
};
async function nerPersist(){
  try{
    if(!navigator.storage||!navigator.storage.persist)return null;
    if(await navigator.storage.persisted())return true;
    return await navigator.storage.persist();
  }catch(_){return null}
}
/* ── טעינת המודל בדפדפן ──
   המודל רץ אצלה במחשב. שום דבר לא נשלח לשום מקום — לא המסמך, לא הטקסט.
   מה שכן עובר ברשת הוא הורדת המודל עצמו, פעם אחת. */
/* שרשרת האספקה (ביקורת H14, M4). שתי הספריות שרואות את המסמך נטענו מ-CDN ב-import() חשוף,
   ש-Subresource Integrity אינו יכול לכסות, ועובד השירות שמר אותן קודם. עכשיו:
   - transformers.js, והטוען של ספריית ההרצה (mjs), יושבים באתר עצמו, תחת vendor/, בשם שנושא
     את הגרסה. tests/vendor_t.js מוודא שהם הקבצים של החבילה בגרסה הזאת בדיוק.
   - קובץ ה-WebAssembly של ספריית ההרצה (27MB) נשאר ב-CDN, בכתובת נעולת-גרסה, ונבדק: מורידים
     אותו כאן, משווים SHA-256 לערך הנעול, ומוסרים לספרייה את הבייטים שנבדקו. קובץ שהשתנה —
     הטעינה נכשלת, בקול.
   - המודל נעול לגרסה (commit) ולא ל-main, וקובץ המשקולות נבדק מול ה-SHA-256 שלו פעם אחת.
   מדיניות אבטחת התוכן (CSP) ב-index.html מגבילה לאן העמוד יכול לפנות. */
const NER_LIB="./vendor/transformers-4.2.0.min.js";
const ORT_V="1.24.0-dev.20251116-b39e144322";
const ORT_CDN="https://cdn.jsdelivr.net/npm/onnxruntime-web@"+ORT_V+"/dist/";
const ORT_WASM={"ort-wasm-simd-threaded.asyncify":"ijj2sXOzrwSfS0ib7b4dolPO7XoXIPls3vYD8oNrZlw=",
  "ort-wasm-simd-threaded":"v3jjoRtGXpqh51bCDtQG3dbP8trXwt8NCNhytDbVTio="};
/* המודל, במקום אחד (בדיקת המודלים, ספטמבר 2026): DictaBERT-parse, ראש הישויות
   בלבד, מיוצא ל-ONNX ב-8 ביט. היחיד מבין תשעה מודלים שלא פתח אף דליפה חדשה בקורפוס ובסט פרטי
   של מסמכים אמיתיים (התוצאות לא מפורסמות), וקורא טוב יותר בכל ארבעת הקבצים הציבוריים. הוא יושב באתר עצמו, models/<id>/, ולא
   ב-Hugging Face: העמוד לא פונה לשום אתר אחר כדי לטעון אותו. GitHub אינו מחזיק קובץ מעל
   100MB, ולכן המשקולות בארבעה חלקים (scripts/model-parts.js); nerJoinParts מחבר אותם, והקובץ
   המחובר נבדק מול ה-SHA-256 שלמטה, כמו קודם. הקרדיט והרישיון: models/<id>/NOTICE.md. */
const NER_SPEC={
  id:"dictabert-parse-ner-37f4d6f",
  source:"dicta-il/dictabert-parse@37f4d6fd556766f15e955fe5bd0f16942b46853e",
  weights:{file:"onnx/model_quantized.onnx",bytes:184983343,
    sha256:"71e519f3151eb78b73bfcaf02538cbdca1f69593235186b7b246b208c62e70ca",
    parts:["onnx/model_quantized.onnx.part1","onnx/model_quantized.onnx.part2",
      "onnx/model_quantized.onnx.part3","onnx/model_quantized.onnx.part4"]}
};
// כתובת מלאה ליד הדף; בלי כתובת בסיס (about:blank בבדיקות jsdom) — הנתיב היחסי
const NER_BASE=()=>{ try{ return new URL("./models/",location.href).href; }catch(_){ return "./models/"; } };
const MODEL_URL=file=>NER_BASE()+NER_SPEC.id+"/"+file;
const NER_OK_KEY="redact-model-verified";
let NERP=null,NERSTATE="off";
async function sha256(buf,enc){
  const d=new Uint8Array(await crypto.subtle.digest("SHA-256",buf));
  if(enc==="hex")return [...d].map(b=>b.toString(16).padStart(2,"0")).join("");
  return globalThis.btoa(String.fromCharCode(...d));
}
// ספריית ההרצה: הטוען מהאתר, ה-WebAssembly מה-CDN אחרי בדיקה. בלי wasmPaths.wasm,
// transformers.js אינו מוריד את הקובץ בעצמו ומשתמש ב-wasmBinary שמסרנו.
// האתר המאוחסן (scripts/build-hosted.js) מגיש את קובץ ה-WebAssembly בעצמו, בלי CDN, בחלקים
// מתחת לתקרת הקובץ של Cloudflare (25MiB): window.__resources.ort={base, parts:{<שם>:<חלקים>}}.
// הבתים המחוברים נבדקים מול אותו SHA-256 בדיוק; בלי ההגדרה הזאת — ה-CDN, כמו תמיד.
async function nerRuntimeBytes(f,v){
  const r=typeof window!=="undefined"&&window.__resources&&window.__resources.ort;
  const n=(r&&r.parts&&r.parts[v])||1;
  const urls=r?Array.from({length:n},(_,i)=>r.base+v+".wasm"+(n>1?".part"+(i+1):"")):[ORT_CDN+v+".wasm"];
  const bufs=[];
  for(const u of urls){
    const res=await f(u);
    if(!res.ok)throw new Error("לא הצלחתי להוריד את ספריית ההרצה ("+res.status+")");
    bufs.push(new Uint8Array(await res.arrayBuffer()));
  }
  if(bufs.length===1)return bufs[0].buffer;
  const out=new Uint8Array(bufs.reduce((s,b)=>s+b.length,0)); let o=0;
  for(const b of bufs){ out.set(b,o); o+=b.length; }
  return out.buffer;
}
async function nerRuntime(t){
  const safari=/^((?!chrome|android).)*safari/i.test((typeof navigator!=="undefined"&&navigator.userAgent)||"");
  const v=safari?"ort-wasm-simd-threaded":"ort-wasm-simd-threaded.asyncify";
  const f=RAW_FETCH||window.fetch.bind(window);
  const buf=await nerRuntimeBytes(f,v);
  if(await sha256(buf)!==ORT_WASM[v])throw new Error("ספריית ההרצה שהורדה אינה הקובץ הנעול. המודל לא נטען.");
  const o=t.env.backends.onnx;
  o.wasm.wasmPaths={mjs:new URL("./vendor/ort-"+ORT_V+"/"+v+".mjs",location.href).href};
  o.wasm.wasmBinary=buf;
}
// כל מה שבמטמון המודל ואינו של המודל הנוכחי נמחק: המודל הקודם (dictabert-ner מ-Hugging Face,
// 185MB) ועותקים של גרסאות אחרות (ביקורת M2: דבר לא פינה את המטמון הזה, והוא נשאר אחרי כל שינוי)
async function nerMigrateCache(){
  if(!nerEnv().canCache)return 0;
  const c=await caches.open(NER_CACHE), mine=MODEL_URL(""); let dropped=0;
  for(const req of await c.keys())
    if(!req.url.startsWith(mine)){ await c.delete(req); dropped++; }
  return dropped;
}
// קובץ המשקולות, מחובר מחלקיו. transformers.js מבקש קובץ אחד; העמוד מוריד את החלקים בזה אחר
// זה ומגיש אותם כזרם אחד, עם האורך הכולל (לפס ההתקדמות ולבדיקה). חלק שלא ירד — שגיאה בקול.
function nerIsWeights(url){
  try{ return new URL(url,location.href).href.split("?")[0]===MODEL_URL(NER_SPEC.weights.file); }catch(_){ return false; }
}
function nerJoinParts(){
  const f=RAW_FETCH||window.fetch.bind(window), parts=NER_SPEC.weights.parts.map(MODEL_URL);
  let i=-1, reader=null;
  const next=async()=>{
    i++; if(i>=parts.length)return false;
    const r=await f(parts[i]);
    if(!r.ok||!r.body)throw new Error("חלק "+(i+1)+" של קובץ המודל לא ירד ("+r.status+")");
    reader=r.body.getReader(); return true;
  };
  const body=new globalThis.ReadableStream({async pull(ctl){
    try{
      for(;;){
        if(!reader&&!(await next())){ctl.close();return}
        const {done,value}=await reader.read();
        if(!done){ctl.enqueue(value);return}
        reader=null;
      }
    }catch(e){ctl.error(e)}
  }});
  return new Response(body,{status:200,statusText:"OK",
    headers:{"Content-Type":"application/octet-stream","Content-Length":String(NER_SPEC.weights.bytes)}});
}
// המשקולות נבדקות פעם אחת מול ה-SHA-256 הנעול (185MB, שנייה או שתיים), והבדיקה נזכרת לפי
// גודל העותק השמור. עותק שאינו תואם נמחק, והטעינה נכשלת בקול.
async function nerVerifyWeights(){
  if(!nerEnv().canCache)return "no-cache";
  const c=await caches.open(NER_CACHE), url=MODEL_URL(NER_SPEC.weights.file);
  const r=await c.match(url); if(!r)return "not-cached";
  const tag=NER_SPEC.id+":"+(r.headers.get("content-length")||"");
  try{ if(localStorage.getItem(NER_OK_KEY)===tag)return "known"; }catch(_){}
  const h=await sha256(await r.arrayBuffer(),"hex");
  if(h!==NER_SPEC.weights.sha256){ await c.delete(url); try{localStorage.removeItem(NER_OK_KEY)}catch(_){}
    throw new Error("קובץ המודל שהורד אינו הקובץ הנעול. הוא נמחק מהמחשב; המודל לא נטען."); }
  try{ localStorage.setItem(NER_OK_KEY,tag); }catch(_){}
  return "verified";
}
// "מחיקת המודל מהמחשב" בהגדרות: הדרך היחידה לפנות אותו הייתה כלי המפתחים (ביקורת M2)
async function nerForget(){
  NERP=null; NERSTATE="off";
  try{ localStorage.removeItem(NER_OK_KEY); }catch(_){}
  if(typeof caches!=="undefined") return caches.delete(NER_CACHE);
  return false;
}
/* tokenizer.json של DictaBERT מכיל \" — escape חוקי במנוע ה-regex של
   Rust, ולא חוקי ב-JavaScript תחת דגל u. בלי זה הטוקנייזר לא נבנה בכלל.

   ניסיון ראשון היה לעטוף את RegExp, אבל מודול מה-CDN לא בהכרח פותר את
   השם דרך המשתנה הגלובלי שלנו. לכן מתקנים את הנתון עצמו: את קובץ
   הטוקנייזר, גם בדרך מהרשת וגם עותק ששמור כבר במטמון. */
// הבנאי המקורי, לפני שאנחנו עוטפים אותו — אחרת בדיקת התקינות למטה
// תשאל בנאי סלחן ותקבל תמיד "תקין", ושום תבנית לא תתוקן.
const RX_NATIVE=RegExp;
const RX_OK=/[\^$\\.*+?()\[\]{}|\/dDsSwWbBnrtvfxucpPk0-9]/;
const rxClean=p=>String(p).replace(/\\(.)/gu,(m,c)=>RX_OK.test(c)?m:c);
function rxBad(p){ try{new RX_NATIVE(p,"u");return false}catch(_){return true} }
/* \w ו-\W בתבנית של טוקנייזר: בספריית ה-tokenizers של Rust, שבה אומן המודל, \w כולל אותיות
   עבריות; ב-RegExp של JavaScript, גם עם הדגל u, רק ASCII. תבנית החלוקה של DictaBERT נגמרת
   ב-\w+|\p{P}|[^\w\s]+, ולכן אצלנו מילה עברית נפלה לענף האחרון יחד עם הפיסוק שאחריה: "שלישי."
   הייתה חתיכה אחת, והנקודה הגיעה למודל כ-##., ושם כפול עם מקף ("מלכה-אזולאי") הגיע כמילה אחת.
   בבדיקת המודלים רק 6 מ-50 משפטים יצאו כמו בפייתון (AutoTokenizer). כותבים את
   \w ואת \W כמחלקות היוניקוד שהן מייצגות שם — אותיות, סימנים, ספרות, מחברים — בתוך מחלקת
   תווים ומחוצה לה; 50 מ-50. \W בתוך מחלקה אינו ניתן לכתיבה כך, ותבנית כזאת נשארת כמו שהיא. */
const RX_W="\\p{L}\\p{M}\\p{Nd}\\p{Pc}";
function rxUnicodeW(p){
  let out="",inClass=false;
  for(let i=0;i<p.length;i++){
    const c=p[i];
    if(c==="\\"&&i+1<p.length){
      const n=p[i+1];
      if(n==="w")out+=inClass?RX_W:"["+RX_W+"]";
      else if(n==="W"){ if(inClass)return p; out+="[^"+RX_W+"]"; }
      else out+=c+n;
      i++; continue;
    }
    if(c==="["&&!inClass)inClass=true;
    else if(c==="]"&&inClass)inClass=false;
    out+=c;
  }
  return out;
}
// מתקנים כל תבנית שלא נבנית, וכותבים \w כפי שהמודל הכיר אותו
function fixTokJSON(txt){
  let j=null,repaired=false;
  try{j=JSON.parse(txt)}
  catch(e){
    // "תו מיותר אחרי סוף ה-JSON" — קורה כשנשמר גוף עם כותרות אורך
    // שלא תואמות לו. חותכים לסוגר האחרון ומנסים שוב.
    const k=txt.lastIndexOf("}");
    if(k>0){try{j=JSON.parse(txt.slice(0,k+1));repaired=true}catch(_){}}
    if(!j){console.warn("tokenizer.json לא ניתן לפענוח:",e.message);return txt}
    console.warn("tokenizer.json הכיל זנב מיותר —",txt.length-(k+1),"תווים נחתכו");
  }
  let n=0;
  (function walk(o){
    if(!o||typeof o!=="object")return;
    for(const k of Object.keys(o)){
      const v=o[k];
      if(typeof v==="string"){
        if(k==="Regex"||k==="pattern"){
          let f=v;
          if(rxBad(f)){ const c=rxClean(f); if(!rxBad(c))f=c; }
          const u=rxUnicodeW(f);
          if(u!==f&&!rxBad(u))f=u;
          if(f!==v){o[k]=f;n++}
        }
      } else walk(v);
    }
  })(j);
  if(n)console.log(`תוקנו ${n} תבניות בטוקנייזר`);
  if(!n&&!repaired)return txt;
  const out=JSON.stringify(j);
  // לא מחזירים משהו שלא נבדק — עדיף הקובץ המקורי מקובץ שבור
  try{JSON.parse(out)}catch(_){console.warn("התיקון יצא פגום, מחזירים מקור");return txt}
  return out;
}
// תשובה שנבנית מטקסט JSON מתוקן: לוו ה-fetch ולעותק שנכתב למטמון. (nerFixCached, שתיקנה עותק
// שמור במקום, לא נקראה מאף מקום והוסרה: ביקורת L8; nerPrepTokenizer עושה את זה)
let jsonRes=body=>new Response(body,{status:200,statusText:"OK",
  headers:{"Content-Type":"application/json"}});
const TOK_URL=()=>MODEL_URL("tokenizer.json");
let RAW_FETCH=null;
let FETCH_HOOKED=false;
function nerHookFetch(){
  if(FETCH_HOOKED)return; FETCH_HOOKED=true;
  const orig=window.fetch.bind(window);
  RAW_FETCH=orig;
  window.fetch=async function(input,init){
    const url=typeof input==="string"?input:(input&&input.url)||"";
    // קובץ המשקולות אינו קיים באתר כקובץ אחד: מחברים את חלקיו
    if(nerIsWeights(url))return nerJoinParts();
    const res=await orig(input,init);
    try{
      if(!/tokenizer\.json(\?|$)/.test(url)||!res.ok)return res;
      const txt=await res.clone().text();
      const fixed=fixTokJSON(txt);
      if(fixed===txt)return res;
      return jsonRes(fixed);
    }catch(e){console.warn("וו ה-fetch נכשל",e);return res}
  };
}
// שכבת גיבוי: אם בכל זאת נבנית תבנית שבורה, לא ליפול עליה
function nerFixRegExp(){
  if(window.__nerRx)return; window.__nerRx=1;
  const Orig=RegExp;
  const P=function(p,f){
    try{return new Orig(p,f)}
    catch(err){
      if(!(err instanceof SyntaxError)||typeof p!=="string")throw err;
      return new Orig(rxClean(p),f);
    }
  };
  P.prototype=Orig.prototype; Object.setPrototypeOf(P,Orig);
  window.RegExp=P; globalThis.RegExp=P;
}
// העטיפה של RegExp מותקנת כאן, בזמן הערכת המודול. המודול נטען ב-import דינמי
// מתוך componentDidMount, כלומר אחרי ש-#dc-root כבר מחובר. מי שקורא את RegExp
// הגלובלי לפני שה-import הסתיים רואה את המקורי, לא את העטוף.
// זה לא מזיק בפועל, ונבדק: סקריפט האתחול ב-index.html לא בונה אף תבנית,
// support.js בונה שתיים פשוטות לפירוק התבנית, ושלוש התבניות שנבנות כאן לפני
// השורה הזו (GF, GM, PLACE_RX) תקינות תחת הדגל u — אחרת המודול לא היה נטען.
// בדיקת הדפדפן ב-e2e/flow.spec.js ממתינה ל-window.__nerRx לפני שהיא שואלת.
nerFixRegExp();
export async function nerPrepTokenizer(report){
  const say=m=>{console.log("טוקנייזר: "+m); if(report)report(m)};
  const url=TOK_URL();
  const out={url,steps:[]};
  const step=(k,v)=>{out.steps.push(k+": "+v); say(k+": "+v)};
  if(!nerEnv().canCache){step("סביבה","אין מטמון — מדלגים");return out}
  const c=await caches.open(NER_CACHE);
  // עותק שמור שנקרא כ-JSON תקין משמש כמו שהוא: 2.9MB פחות בכל ביקור, והשניות
  // הראשונות של כל סשן בקו איטי. רק עותק פגום נמחק ומוריד מחדש.
  const prior=await c.match(url);
  if(prior){
    try{ const pt=await prior.text(); JSON.parse(pt); step("במטמון","עותק תקין — בלי הורדה"); out.ok=true; out.cached=true; return out; }
    catch(_){ step("במטמון","עותק פגום — מוריד מחדש"); }
  }
  let dropped=0;
  for(const k of await c.keys())
    if(/tokenizer\.json/.test(k.url)){await c.delete(k);dropped++}
  step("עותקים ישנים שנמחקו",dropped);
  const f=RAW_FETCH||window.fetch.bind(window);
  const res=await f(url,{cache:"reload"});
  step("הורדה",res.status+" "+(res.ok?"תקין":"נכשל"));
  if(!res.ok)throw new Error("לא הצלחתי להוריד את קובץ הטוקנייזר ("+res.status+")");
  const txt=await res.text();
  step("אורך",txt.length+" תווים");
  // האם המקור בכלל תקין, ואם לא — איפה בדיוק
  try{JSON.parse(txt);step("המקור","JSON תקין")}
  catch(e){
    const m=/position (\d+)/.exec(e.message);
    const p=m?+m[1]:-1;
    step("המקור פגום",e.message.slice(0,60));
    if(p>=0)step("סביבת התקלה",JSON.stringify(txt.slice(Math.max(0,p-40),p+40)));
  }
  const fixed=fixTokJSON(txt);
  step("אחרי תיקון",fixed.length+" תווים"+(fixed===txt?" (ללא שינוי)":""));
  try{JSON.parse(fixed);step("התוצאה","JSON תקין")}
  catch(e){throw new Error("התיקון לא הצליח: "+e.message.slice(0,60))}
  await c.put(url,jsonRes(fixed));
  const back=await c.match(url);
  if(!back)throw new Error("הכתיבה למטמון נכשלה");
  const bt=await back.text();
  step("קריאה חוזרת",bt.length+" תווים");
  try{JSON.parse(bt);step("במטמון","JSON תקין ✓")}
  catch(e){
    await c.delete(url);
    throw new Error("מה שנשמר במטמון פגום: "+e.message.slice(0,60));
  }
  out.ok=true;
  return out;
}
let nerLoad=async function(){
  if(NERP)return NERP;
  if(nerEnv().local)throw new Error("מקובץ מקומי אי אפשר לטעון את המודל");
  NERSTATE="loading";
  NERP=(async()=>{
    // בלי זה הדפדפן רשאי למחוק את המודל כשהמקום נגמר, והוא יירד שוב. בלי לחכות לתשובה: Firefox
    // שואל את המשתמש בחלון קופץ ולא עונה עד שהוא בוחר, ומי שלא בחר חיכה למודל לנצח (בדיקה ב-Firefox, 10.10)
    nerPersist();
    nerHookFetch();
    try{ const dropped=await nerMigrateCache(); if(dropped)console.log("מודל: "+dropped+" קבצים של מודל קודם נמחקו מהמטמון"); }
    catch(e){ console.warn('ניקוי המטמון נכשל',e); }
    try{ await nerPrepTokenizer(); }
    catch(e){ console.warn('הכנת הטוקנייזר נכשלה',e); }
    const t=await import(/* webpackIgnore: true */ NER_LIB);
    // המודל נטען מהאתר עצמו, models/<id>/: "מרוחק" מבחינת transformers.js, באותו מקור מבחינתנו
    t.env.allowLocalModels=false;
    t.env.allowRemoteModels=true;
    t.env.remoteHost=NER_BASE();
    t.env.remotePathTemplate="{model}/";
    t.env.useBrowserCache=true;
    await nerRuntime(t);
    const seen={};
    const pipe=await t.pipeline("token-classification",NER_SPEC.id,{
      dtype:"q8",
      progress_callback:p=>{
        if(p.status==="progress"&&p.file){
          // לפי בייטים, לא ממוצע של קבצים: הקבצים הקטנים נגמרים מיד וממוצע
          // כזה קפץ ל-76% ואז זחל דרך קובץ המשקולות היחיד (130MB)
          seen[p.file]={loaded:p.loaded||0,total:p.total||0,pct:p.progress||0};
          const v=Object.values(seen), tot=v.reduce((a,b)=>a+b.total,0);
          const pct=tot?100*v.reduce((a,b)=>a+b.loaded,0)/tot:v.reduce((a,b)=>a+b.pct,0)/v.length;
          const mb=x=>(x/1048576).toFixed(0);
          // "פעם אחת בלבד" הבטיח יותר מדי (ביקורת UX #6): הורדה שנקטעה מתחילה מאפס. מה שנכון:
          // אחרי הורדה שלמה המודל נשמר ולא יורד שוב.
          nerSay(tot?`מוריד את מודל הזיהוי: ${mb(v.reduce((a,b)=>a+b.loaded,0))} מתוך ${mb(tot)} MB · אחרי שיסתיים הוא נשמר במחשב`:`מוריד את מודל הזיהוי… ${Math.round(pct)}%`,pct);
        } else if(p.status==="ready")nerSay("המודל מוכן.",null);
      }});
    const w=await nerVerifyWeights();
    if(w==="verified")console.log("מודל: קובץ המשקולות נבדק מול הגרסה הנעולה");
    NERSTATE="ready";
    return pipe;
  })().catch(e=>{NERP=null;NERSTATE="error";throw e});
  return NERP;
};
// הורדה שנתקעה (UX #6): "לנסות שוב" צריך טעינה חדשה, לא את ההבטחה התקועה.
// הבקשה הישנה ממשיכה ברקע עד שהדפדפן מוותר; אם היא תסתיים, המטמון שלה ישמש.
function nerReset(){
  if(NERSTATE==="ready")return false;
  NERP=null; NERSTATE="off"; return true;
}
/* transformers.js לא בהכרח מחזיר היסטי מיקום ולא בהכרח מאחד תת-מילים,
   בניגוד לגרסה בפייתון. אם נסמוך על זה נקבל אפס תוצאות בלי שום שגיאה —
   וזה בדיוק סוג הכשל השקט שהכלי הזה לא יכול להרשות לעצמו.
   לכן: אם יש היסטים משתמשים בהם, ואם אין מיישרים את הטוקנים לטקסט לבד.

   היישור נעשה על עותק מנורמל של הטקסט, כמו שהטוקנייזר רואה אותו: בלי ניקוד וסימני הטעמה
   (NFD, בלי סימנים מצטרפים) ובאותיות קטנות, עם מפה חזרה למקום בטקסט המקורי. בלי זה "מיקה"
   של "מִיקָה" לא נמצאה במקומה אלא בהופעה מאוחרת יותר ("ומיקה תתחיל"), היישור קפץ לשם, וכל
   טוקן שביניהם לא מוקם: בקורפוס שאר הקטע כולו, וכל מה שהמודל מצא בו אבד (בדיקת המודלים).
   ואם בכל זאת טוקן נמצא רק רחוק קדימה — מעבר ליותר מילים משמספר הטוקנים שלא מוקמו רצוף לפניו,
   ועוד שתיים — הוא נשאר בלי מקום, והיישור לא זז. */
function nerNorm(text){
  let s=""; const map=[];
  for(let k=0;k<text.length;){
    const ch=String.fromCodePoint(text.codePointAt(k));
    for(const x of ch.normalize("NFD")){
      if(/\p{M}/u.test(x))continue;
      for(const y of x.toLowerCase()){ s+=y; map.push(k); }
    }
    k+=ch.length;
  }
  return {s,map};
}
const nerWordsIn=g=>(g.match(/[\p{L}\p{N}]+/gu)||[]).length;
function nerAlign(text,toks,off){
  const {s:ns,map}=nerNorm(text);
  let pos=0,pending=0;
  for(const t of toks){
    if(t.start!=null&&t.end!=null){t._s=off+t.start;t._e=off+t.end;continue}
    const w=nerNorm(String(t.word||t.token||t.text||"").replace(/^##/,"").trim()).s;
    if(!w){t._s=null;continue}
    const i=ns.indexOf(w,pos);
    if(i<0||nerWordsIn(ns.slice(pos,i))>pending+2){t._s=null;pending++;continue}
    let e=map[i+w.length-1]+1;
    while(e<text.length&&/\p{M}/u.test(text[e]))e++;   // הניקוד שאחרי האות האחרונה שייך למילה
    t._s=off+map[i]; t._e=off+e; pos=i+w.length; pending=0;
  }
}
function nerGroup(toks){
  const out=[]; let cur=null;
  for(const t of toks){
    if(t._s==null){cur=null;continue}
    // סימן פיסוק אינו חלק משם, גם כשהמודל מדביק לו תווית I-. "הילדה. מיקה"
    // ו"השופטת: הורוביץ" נולדו מכאן: הנקודה קיבלה I-PER והשרשרת נמשכה.
    const wtxt=String(t.word||t.token||t.text||"").replace(/^##/,"");
    // מקף צמוד בתוך שם ("בן-רביב", "אבו-סרחאן") שייך לשם; הקבוצה נמשכת
    // מעבר לו, ומקף שנשאר בסוף נחתך ב-trimEdges.
    if(/^[-־–]$/.test(wtxt)&&cur&&t._s<=cur.e){cur.e=t._e;continue}
    if(!/[֐-׿\w]/u.test(wtxt)){cur=null;continue}
    const raw=String(t.entity_group||t.entity||"");
    const type=raw.replace(/^[BI]-/,"");
    // המודל מתייג רק את תת-המילה הראשונה של כל מילה, וההמשכים ("##אן", "##טה")
    // חוזרים כ-O. תת-מילה שממשיכה את המילה של הישות הנוכחית שייכת לה בכל
    // מקרה: בלי זה "דסטה טספאיי" נשבר ל"דס" ול"טס", ההרחבה לגבול המילה מחזירה
    // שתי מילים נפרדות, והשם המלא לא מגיע לרשימה. זה היה הכשל השכיח ביותר
    // בגבולות המקטעים (94 מ-329 מופעים בקורפוס), לא פיסוק ולא קצה קטע.
    const sub=/^##/.test(String(t.word||t.token||t.text||""));
    if(sub&&cur&&t._s<=cur.e){cur.e=Math.max(cur.e,t._e);continue}
    if(!type||type==="O"){cur=null;continue}
    // תת-מילה ממשיכה את הישות; תווית B פותחת חדשה
    const cont=cur&&cur.type===type&&!/^B-/.test(raw)&&t._s<=cur.e+1;
    if(cont){cur.e=t._e;cur.score=Math.min(cur.score,+t.score)}
    else{cur={type,score:+t.score,s:t._s,e:t._e};out.push(cur)}
  }
  return out;
}
// הפלט הגולמי של הריצה האחרונה, לדוח הדליפה: מה המודל חשב על מקטע שפוספס
let NER_LAST=[];
function nerLast(){return NER_LAST}
/* אות שימוש או שם אחר? (Q4 בגרסה 3) "שגורגן" הוצע לצד "גורגן" וקיבל שם בדוי משלו.
   מקפלים צורה כזאת לשם הבסיס רק כשהמודל עצמו אומר שהאות אינה חלק מהמילה:
   הטוקנייזר שלו מפצל את האות לבדה ("ש" + "##גורגן"), בעוד "שרון" הוא יחידה אחת.
   עדות נוספת: קיצוץ בקצה המקטע (המודל בלע אות שימוש), ומיקום — תור דיבור או
   תואר לפני הצורה אומרים "שם" ומונעים קיפול. רשימות השמות רק חוסמות: הימצאות
   בהן אומרת "שם", היעדרות אינה אומרת דבר. כשאין הכרעה — הצעה, לא קיפול. */
function tokPieces(pipe,word){
  const tk=pipe&&pipe.tokenizer; if(!tk)return null;
  try{
    if(typeof tk.tokenize==="function")return tk.tokenize(word);
    if(typeof tk._encode_text==="function"){const r=tk._encode_text(word); if(Array.isArray(r))return r;}
    if(typeof tk.encode==="function"&&tk.model&&typeof tk.model.convert_ids_to_tokens==="function"){
      const ids=tk.encode(word,null,{add_special_tokens:false}); return tk.model.convert_ids_to_tokens(ids);}
  }catch(_){}
  return null;
}
function namePosition(text,surface){
  const n=norm(text), s=esc(norm(surface));
  // תור דיבור: בראש שורה, אולי אחרי חותמת זמן בסוגריים; או אחרי תואר
  if(new RegExp("(?:^|\\n)\\s*(?:\\[[^\\]\\n]*\\]\\s*)?"+s+"\\s*:","u").test(n))return true;
  if(new RegExp("(?:^|\\s)"+TITLE_RX.source.replace(/^\^/,"")+s+"(?![\\u0590-\\u05ff])","u").test(n))return true;
  return false;
}
function listedName(v){
  const x=norm(v).trim();
  return (typeof KNOWN_FIRST!=="undefined"&&KNOWN_FIRST.has(x))||(typeof FEM!=="undefined"&&FEM.has(x))||
    (typeof MASC!=="undefined"&&MASC.has(x))||(typeof POOL!=="undefined"&&(POOL.he_s||[]).includes(x))||
    (typeof PLACE_BY!=="undefined"&&!!PLACE_BY[x]);
}
async function foldEvidence(pipe,out,text){
  const names=out.filter(o=>o.kind==="NAME");
  const byNorm=new Map(names.map(o=>[norm(o.value).trim(),o]));
  for(const o of names){
    const v=norm(o.value).trim();
    if(/\s/.test(v)||v.length<4||!/^[בלמושהכ]/.test(v))continue;
    const stem=v.slice(1); const base=byNorm.get(stem); if(!base)continue;
    o.prefixOf=base.value;
    let fold="unknown", why=[];
    const pieces=tokPieces(pipe,o.value);
    if(pieces&&pieces.length){
      const first=String(pieces[0]).replace(/^[▁#]+/,"");
      if(pieces.length>=2&&first===v[0]){fold="yes";why.push("tokenizer:split");}
      else {fold="no";why.push("tokenizer:whole");}
    }
    if(o.cut){ if(fold!=="no")fold="yes"; why.push("cut"); }
    if(namePosition(text,o.value)){fold="no";why.push("position");}
    if(listedName(o.value)){fold="no";why.push("listed");}
    o.fold=fold; o.foldWhy=why.join(",");
  }
}
/* מה שהמודל קורא: הבלוקים כטקסט אחד, כמו שאדם קורא אותו, בלי התווים שאיש אינו רואה (squeeze). המודל קרא את הטקסט
   עם התווים, ושם שתו כזה בתוכו («ברזניצקי» עם רווח ברוחב אפס, «אוריאל» עם BOM) נקרא שתי מילים ולא יושר לטקסט, והשם יצא ל-AI תחת פס ירוק
   (ביקורת 18.10, F1, F4). הערכים שהמודל מוצא הם כמו שהם נקראים, והרשימה מוצאת אותם גם עם התו (tests/invisible_t.js).
   back: קטע בטקסט הזה ← הקטע בטקסט המחובר של הבלוקים, שבו דוח הדליפה קורא את nerLast. bench/lib.js קורא אותו טקסט.
   tests/readers_t.js */
function nerText(blocks){
  const doc=blocks.map(b=>b.text).join("\n"), q=squeeze(doc);
  return {text:q?q.t:doc, back:q?(s,e)=>[q.pos[s],q.pos[e-1]+1]:(s,e)=>[s,e]};
}
async function nerRun(blocks,onProgress){
  const pipe=await nerLoad();
  const {text,back}=nerText(blocks);
  const parts=nerChunks(text);
  const ents=[]; let raw=0,withOff=0,failed=0;
  for(let i=0;i<parts.length;i++){
    const {t,off}=parts[i];
    let res;
    try{res=await pipe(t,{ignore_labels:[]})}
    catch(e){console.warn("קטע נכשל",errNote(e));failed++;continue}
    if(!Array.isArray(res))res=res?[res]:[];
    if(!raw&&res.length)console.log("מבנה חיזוי גולמי:",Object.keys(res[0]||{}).join(","));
    raw+=res.length;
    withOff+=res.filter(r=>r.start!=null).length;
    nerAlign(t,res,off);
    for(const g of nerGroup(res))ents.push({type:g.type,score:g.score,s:g.s,e:g.e});
    if(onProgress&&(i%8===0||i===parts.length-1)){
      onProgress((i+1)/parts.length*100);
      await new Promise(r=>setTimeout(r,0));
    }
  }
  /* קטע שנכשל דולג בשקט, וחלק מהמסמך לא נקרא בידי המודל בלי שדבר במסך אמר זאת (ביקורת M25,
     אותה משפחה). מודל שלא קרא אף קטע נכשל, כדי שהמסך יציג כישלון ולא רשימה ריקה; מודל שקרא
     חלק מוסר כמה קטעים לא נקראו, והמסך אומר זאת. */
  if(parts.length&&failed===parts.length)throw new Error("המודל לא הצליח לקרוא אף קטע מהמסמך");
  NER_LAST=ents.map(x=>{const [s,e]=back(x.s,x.e); return {type:x.type,score:x.score,s,e}});
  const out=nerClean(ents,text);
  out.chunks=parts.length; out.failedChunks=failed;
  await foldEvidence(pipe,out,text);
  const chars=parts.reduce((a,p)=>a+p.t.length,0);
  console.log(`זיהוי: ${parts.length} קטעים (${chars}/${text.length} תווים) · `+
    `${raw} חיזויים גולמיים · ${withOff} עם היסט מהצינור · `+
    `${ents.length} ישויות · ${out.length} אחרי סינון`);
  if(!raw)console.log("⚠ המודל לא החזיר שום חיזוי — בדקו את מבנה הפלט למעלה");
  else if(!ents.length)console.log("⚠ חיזויים התקבלו אך לא הצליחו להתיישר לטקסט");
  return out;
}


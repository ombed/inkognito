const TITLE_RX=/^(?:עו"ד|עוה"ד|עו״ד|ד"ר|ד״ר|דר'|פרופ'|פרופ׳|פרופסור|מר|גב'|גב׳|גברת|הגב'|הגברת|הרב|הרבנית|השופט|השופטת|כב'|כבוד|ח"כ|ח״כ|חבר הכנסת|חברת הכנסת|סא"ל|רס"ן|אל"מ|משפחת|בני הזוג|הזוג|הקטין|הקטינה|המנוח|המנוחה|התובע|התובעת|הנתבע|הנתבעת|המבקש|המבקשת|המשיב|המשיבה|העד|העדה)\s+/u;
const ORG_RX=/^(?:עמותת|עמותה|מכון|חברת|חברה|בית ספר|בי"ס|ביה"ס|בית הספר|מרכז|אגודת|אגודה|קרן|מוסד|גן|מעון|פנימיית|פנימייה|ישיבת|ישיבה|קופת חולים|בנק|עיריית|מועצה|מועצת|משרד|לשכת|מרפאת|מרפאה|בית חולים|ביה"ח|מכללת|אוניברסיטת|תיכון|חטיבת)\b|\bבע"מ$/u;
// "נרות מאירות" בלי "עמותת" לפניו: שתי מילים ברבים, אף אחת אינה שם —
// זה גוף, לא אדם. שם בדוי של אדם במקום עמותה היה מבלבל את ה-AI.
function likelyOrg(v){
  const w=norm(v).split(/\s+/); if(w.length<2)return false;
  const isName=x=>FEM.has(x)||MASC.has(x)||POOL.he_s.includes(x)||AR_NAMES.has(x)||
    POOL.ar_s.includes(x)||/^(?:בן|בת|אבו|אל)-?/.test(x);
  if(w.some(isName))return false;
  return w.some(x=>/(?:ות|ים)$/.test(x)&&x.length>=4)||w.every(x=>COMMON.has(x));
}
function cleanEntry(raw){
  let v=trimEdges(raw).replace(/\s*\([^)]*\)\s*$/,"").trim(), note="";
  let m;while((m=TITLE_RX.exec(v))){v=v.slice(m[0].length).trim();note=`בלי «${m[0].trim()}»`}
  let kind="NAME";
  if(ORG_RX.test(v))kind="ORG";
  else if(likelyOrg(v)){kind="ORG";note="נראה כגוף — אם זה אדם, בחרו «אדם» ברשימת הסוג"}
  return {v:trimEdges(v),note,kind};
}


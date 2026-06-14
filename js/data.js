/* MedData — типы лекарств, дефолтные данные, иконки, хелперы. БЕЗ DOM. */
'use strict';
const RU_NAME={FUSID:'ФУСИД',FORXIGA:'ФОРКСИГА',AMIOCARD:'АМИОКАРД',ELIQUIS:'ЭЛИКВИС',LAEVOLAC:'ЛАЕВОЛАК',MUCOLESS:'МУКОЛЕСС',AEROVENT:'АЭРОВЕНТ',FLIXOTIDE:'ФЛИКСОТИД','VITAMIN D3':'ВИТАМИН D3',LIPITOR:'ЛИПИТОР',LAXADIN:'ЛАКСАДИН',GLYCERIN:'ГЛИЦЕРИН'};
function medRu(m){ const r=m.ru||RU_NAME[m.name]; return (r&&r!==m.name)?r:'' }
function medSub(m){return m.subKey?t(m.subKey):(m.sub||'')}
function medWarn(m){return m.warnKey?t(m.warnKey):(m.warn||'')}

/* ============ CONSTANTS ============ */
const TYPES={
 tab:{c:'#4F46E5',bg:'#ECECFD',svg:'<rect x="3" y="8" width="11" height="8" rx="4" transform="rotate(-45 8.5 12)"/><path d="M10.5 13.5l3-3"/>'},
 cap:{c:'#C2570C',bg:'#FCEBDD',svg:'<rect x="4" y="9.4" width="16" height="5.2" rx="2.6" transform="rotate(-35 12 12)"/><path d="M9.6 7.7l4.8 8.6"/>'},
 syr:{c:'#7C3AED',bg:'#F1E9FE',svg:'<path d="M9 3h6v3l-1 2v3h-4V8L9 6z"/><rect x="9" y="11" width="6" height="9" rx="2"/><path d="M9.5 15h5"/>'},
 drop:{c:'#0E7490',bg:'#DEF1F5',svg:'<path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z"/>'},
 inh:{c:'#059669',bg:'#DCF3EA',svg:'<path d="M3 12h6"/><circle cx="14" cy="12" r="4"/><path d="M18 12h3"/>'},
 sup:{c:'#EA580C',bg:'#FCE8DC',svg:'<path d="M12 3c2 2 3 4 3 7v7a3 3 0 0 1-6 0v-7c0-3 1-5 3-7z"/>'}
};
function tyLabel(k){return t('ty_'+k)}
const ORDER={tab:0,cap:1,syr:2,drop:3,inh:4,sup:5};
const DAYORDER=[0,1,2,3,4,5,6];
function icon(ty,s=18){const d=TYPES[ty]||TYPES.tab;return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d.svg}</svg>`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ============ DEFAULT DATA ============ */
function defaultState(){return JSON.parse(JSON.stringify({
 caregiver:"Джамшид",
 refillTime:"22:30",
 tgToken:"",
 tgChat:"",
 tgMissedMin:30,
 tgSummary:"22:00",
 times:["08:00","14:00","20:00"],
 /* Назначение Григория Разумовского, действует с 15 июня 2026 (по приложенным PDF) */
 meds:{
  esomeprazole:{name:"ESOMEPRAZOLE INOVAMED",ru:"ЭЗОМЕПРАЗОЛ ИНОВАМЕД",type:"tab",qty:"1 таблетка",sub:"Esomeprazole 40 мг · защита желудка",warn:"⚠ Внимание! Натощак, за 30–60 мин до завтрака — принять первым",warnLevel:"amber",img:"esomeprazole"},
  fusid:{name:"FUSID",ru:"ФУСИД",type:"tab",qty:"1 таблетка",sub:"Furosemide 40 мг · мочегонное",img:"fusid"},
  forxiga:{name:"FORXIGA",ru:"ФОРКСИГА",type:"tab",qty:"1 таблетка",sub:"Dapagliflozin 10 мг · для сердца / сахар",img:"forxiga"},
  amiodacore:{name:"AMIODACORE",ru:"АМИОДАКОР",type:"tab",qty:"1 таблетка",sub:"Amiodarone 200 мг · от аритмии · = AMIOCARD / PROCOR",warn:"Принимать 5 дней в неделю — НЕ давать по ВТОРНИКАМ и ПЯТНИЦАМ",warnLevel:"amber",excludeDays:[2,5],img:"amiodacore"},
  eliquis:{name:"ELIQUIS",ru:"ЭЛИКВИС",type:"tab",qty:"1 таблетка",sub:"Apixaban 5 мг · разжижает кровь",warn:"АНТИКОАГУЛЯНТ · глотать целиком, не дробить, не пропускать",warnLevel:"red",img:"eliquis"},
  lipitor:{name:"LIPITOR или LITORVA 40",ru:"ЛИПИТОР / ЛИТОРВА",type:"tab",qty:"1 таблетка",sub:"Atorvastatin 40 мг · холестерин",img:"lipitor"},
  avilac:{name:"AVILAC",ru:"АВИЛАК",type:"syr",qty:"30 мл",sub:"Lactulose 670 мг/мл · слабительное (сироп)",img:"avilac"},
  aerovent:{name:"AEROVENT",ru:"АЭРОВЕНТ",type:"inh",qty:"1 мл",sub:"Ipratropium 0,25 мг/мл · бронхолитик",warn:"Развести: 1 мл AEROVENT + 2–3 мл физраствора 0,9%",warnLevel:"info",img:"aerovent"},
  flixotide:{name:"FLIXOTIDE",ru:"ФЛИКСОТИД",type:"inh",qty:"2 мл",sub:"Fluticasone 0,5 мг/2 мл · стероид",warn:"0,5 мг = 1 небула (2 мл) · НЕ разбавлять. Сначала AEROVENT, через 5 минут FLIXOTIDE. Не смешивать в одной чашке.",warnLevel:"info",img:"flixotide"}
 },
 schedule:{
  "08:00":["esomeprazole","fusid","forxiga","amiodacore","eliquis","avilac","aerovent","flixotide"],
  "14:00":["flixotide"],
  "20:00":["eliquis","lipitor","aerovent","flixotide"]
 }
}))}

/* ---- добавлено при переходе на клиент-серверную структуру ---- */
var IMG_SRC = {
 "esomeprazole": "img/esomeprazole.jpg",
 "fusid": "img/fusid.jpg",
 "forxiga": "img/forxiga.jpg",
 "amiodacore": "img/amiodacore.jpg",
 "eliquis": "img/eliquis.jpg",
 "lipitor": "img/lipitor.jpg",
 "avilac": "img/avilac.jpg",
 "aerovent": "img/aerovent.jpg",
 "flixotide": "img/flixotide.jpg"
};
function medImg(m){ if(!m||!m.img)return null;
  if(typeof m.img==='string'&&m.img.indexOf('data:')===0)return m.img;
  return IMG_SRC[m.img]||null; }
/* FNV-1a 32-бит: пароль настроек и детектор изменений бэкапа */
function hash(str){ var h=0x811c9dc5>>>0; str=String(str);
  for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; }
  return (h>>>0).toString(36); }

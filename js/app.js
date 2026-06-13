/* MedApp — контроллер: рендер экранов, мастер выдачи, напоминания,
   настройки, Telegram, ИИ-скан, синхронизация. Глобальный скрипт
   (НЕ IIFE): встроенные onclick в шаблонах требуют глобальных функций.
   Зависимости (общий global lexical scope / window): i18n.js, data.js,
   MedStore (storage.js), MedSync (sync.js). */
/* ============ STORAGE ============ */
/* Низкоуровневый слой — в storage.js (window.MedStore). get/set синхронные,
   но старый код вызывает их через await — это совместимо. */
const store = window.MedStore;
const APP_VERSION = '1.3 от 13.06.2026';
/* маленький футер с номером версии — показывается внизу на всех экранах */
function verLine(){ return `<div class="note" style="text-align:center;opacity:.5;font-size:11px;margin-top:16px;letter-spacing:.02em">${t('ver_lbl')} ${APP_VERSION}</div>` }

/* ============ ИСТОРИЯ СОБЫТИЙ (просмотр в настройках, под паролем) ============ */
const EV_ICON={dose_given:'💊',dose_undone:'↩️',box_filled:'📦',box_emptied:'📭',refill:'📦',med_added:'➕',med_edited:'✏️',med_removed:'🗑',time_added:'⏰',time_changed:'⏰',time_removed:'⏰',sched_add:'🗓',sched_remove:'🗓'};
function evCellLabel(cell){ const p=String(cell||'').split('|'); return (p.length===2)?((DS()[Number(p[0])]||'')+' '+p[1]):(cell||''); }
function evText(ev){ return tf('ev_'+ev.type,{ time:ev.time||'', old:ev.old||'', med:ev.med||'', cell:evCellLabel(ev.cell), times:(ev.times||[]).join(' · ') }); }
async function openHistory(){
 const el=document.getElementById('scr-settings');
 const header=`<h2>📜 ${t('hist_title')}</h2><button class="sb1" style="border-radius:11px;padding:10px 14px;font-weight:800;font-size:14px;margin-bottom:8px" onclick="renderSettings()">← ${t('hist_back')}</button>`;
 el.innerHTML=header+`<div class="spin"></div><div class="note">${t('hist_loading')}</div>`;
 let events=[];
 try{
  if(MedSync.isOn(state)){
   const dates=await MedSync.listLogDates(state);
   const logs=await Promise.all(dates.slice(-120).map(d=>MedSync.fetchLog(state,d).catch(()=>[])));
   events=logs.reduce((a,b)=>a.concat(b),[]);
  }
  events=MedSync.mergeLog(events, getLog(dateISO())); // домержить локальные сегодняшние
 }catch(e){}
 if(document.getElementById('scr-settings').hidden)return; // ушли с экрана — не рисуем
 events.sort((a,b)=>(b.ts||0)-(a.ts||0));
 let html=header;
 if(!events.length){ html+=`<div class="card"><div class="note" style="text-align:center;font-size:15px">${MedSync.isOn(state)?t('hist_empty'):t('hist_offline')}</div></div>`; }
 else { let curDay='';
  for(const ev of events){ const d=new Date(ev.ts||0); const iso=dateISO(d);
   if(iso!==curDay){ curDay=iso; html+=`<h2 style="font-size:16px;margin:16px 0 6px">${DF()[d.getDay()]} · ${iso.slice(8,10)}.${iso.slice(5,7)}.${iso.slice(0,4)}</h2>`; }
   const hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
   html+=`<div class="trow" style="padding:10px 13px;margin-top:8px">
    <span style="font-size:22px;flex:0 0 auto">${EV_ICON[ev.type]||'•'}</span>
    <span class="rowmid"><span style="font-weight:800;font-size:15px">${esc(evText(ev))}</span>
     <span class="cnt">${hm}${(ev.by&&ev.by!=='?')?' · '+esc(ev.by):''}</span></span></div>`;
  }
 }
 el.innerHTML=html;
}

/* Новые строки интерфейса (синхронизация, ИИ-ключ, пароль) — дополняем L,
   чтобы они проходили через те же t()/tf() с фолбэком на русский. */
Object.assign(L.ru,{
 set_sync:"☁ Синхронизация (GitHub)",sync_on:"Включить синхронизацию",sync_repo:"Репозиторий данных (owner/name)",
 sync_token:"Токен доступа (PAT)",sync_device:"Имя устройства",
 sync_note:"Приватный репозиторий GitHub как хранилище. Токен: github.com → Settings → Developer settings → Fine-grained tokens, доступ только к этому репозиторию, право Contents: Read and write. Токен хранится только на устройстве.",
 sync_restore:"⟳ Загрузить из архива",sync_restore_q:"Заменить данные на этом устройстве копией из архива GitHub?",
 sync_restored:"Данные загружены из архива",sync_pull_fail:"Не удалось загрузить",
 st_synced:"🟢 Синхронизировано",st_off:"⚪ Синхронизация выключена",st_err:"🔴 Ошибка",
 cfg_updated:"Расписание обновлено с другого устройства",
 set_ai:"🤖 Распознавание (ИИ)",ai_key:"Ключ Anthropic API",
 ai_note:"Ключ хранится только на этом устройстве. Нужен для сканирования упаковок и рецептов.",
 ai_off:"Введите ключ Anthropic, чтобы включить сканирование.",
 f_password:"Пароль настроек",pw_ph:"новый пароль (мин. 4)",pw_save:"Сменить пароль",
 pw_short:"Пароль не короче 4 символов.",pw_saved:"Пароль изменён.",
 refresh_q:"Обновить приложение до последней версии? Данные сохранятся.",ver_lbl:"Версия",
 live_by:"отметил(а): {by}",live_upd:"обновлено {t}"});
Object.assign(L.en,{
 set_sync:"☁ Sync (GitHub)",sync_on:"Enable sync",sync_repo:"Data repository (owner/name)",
 sync_token:"Access token (PAT)",sync_device:"Device name",
 sync_note:"A private GitHub repo as storage. Token: github.com → Settings → Developer settings → Fine-grained tokens, access to this repo only, Contents: Read and write. The token is stored only on this device.",
 sync_restore:"⟳ Load from archive",sync_restore_q:"Replace data on this device with the copy from the GitHub archive?",
 sync_restored:"Data loaded from archive",sync_pull_fail:"Could not load",
 st_synced:"🟢 Synced",st_off:"⚪ Sync is off",st_err:"🔴 Error",
 cfg_updated:"Schedule updated from another device",
 set_ai:"🤖 Recognition (AI)",ai_key:"Anthropic API key",
 ai_note:"The key is stored only on this device. Needed to scan packages and prescriptions.",
 ai_off:"Enter an Anthropic key to enable scanning.",
 f_password:"Settings password",pw_ph:"new password (min 4)",pw_save:"Change password",
 pw_short:"Password must be at least 4 characters.",pw_saved:"Password changed.",
 refresh_q:"Update the app to the latest version? Your data will be kept.",ver_lbl:"Version",
 live_by:"marked by: {by}",live_upd:"updated {t}"});
Object.assign(L.he,{
 set_sync:"☁ סנכרון (GitHub)",sync_on:"הפעל סנכרון",sync_repo:"מאגר נתונים (owner/name)",
 sync_token:"אסימון גישה (PAT)",sync_device:"שם המכשיר",
 sync_note:"מאגר GitHub פרטי כאחסון. אסימון: github.com → Settings → Developer settings → Fine-grained tokens, גישה למאגר זה בלבד, הרשאת Contents: Read and write. האסימון נשמר רק במכשיר זה.",
 sync_restore:"⟳ טען מהארכיון",sync_restore_q:"להחליף את הנתונים במכשיר זה בעותק מהארכיון של GitHub?",
 sync_restored:"הנתונים נטענו מהארכיון",sync_pull_fail:"הטעינה נכשלה",
 st_synced:"🟢 מסונכרן",st_off:"⚪ הסנכרון כבוי",st_err:"🔴 שגיאה",
 cfg_updated:"לוח הזמנים עודכן ממכשיר אחר",
 set_ai:"🤖 זיהוי (AI)",ai_key:"מפתח Anthropic API",
 ai_note:"המפתח נשמר רק במכשיר זה. נדרש לסריקת אריזות ומרשמים.",
 ai_off:"הזן מפתח Anthropic כדי להפעיל סריקה.",
 f_password:"סיסמת הגדרות",pw_ph:"סיסמה חדשה (לפחות 4)",pw_save:"שנה סיסמה",
 pw_short:"הסיסמה חייבת להיות באורך 4 תווים לפחות.",pw_saved:"הסיסמה שונתה.",
 refresh_q:"לעדכן את האפליקציה לגרסה האחרונה? הנתונים יישמרו.",ver_lbl:"גרסה",
 live_by:"סומן ע״י: {by}",live_upd:"עודכן {t}"});
Object.assign(L.uz,{
 set_sync:"☁ Sinxronizatsiya (GitHub)",sync_on:"Sinxronizatsiyani yoqish",sync_repo:"Maʼlumotlar repozitoriysi (owner/name)",
 sync_token:"Kirish tokeni (PAT)",sync_device:"Qurilma nomi",
 sync_note:"Xususiy GitHub repozitoriysi xotira sifatida. Token: github.com → Settings → Developer settings → Fine-grained tokens, faqat shu repozitoriyga ruxsat, Contents: Read and write. Token faqat shu qurilmada saqlanadi.",
 sync_restore:"⟳ Arxivdan yuklash",sync_restore_q:"Bu qurilmadagi maʼlumotlar GitHub arxividagi nusxa bilan almashtirilsinmi?",
 sync_restored:"Maʼlumotlar arxivdan yuklandi",sync_pull_fail:"Yuklab boʻlmadi",
 st_synced:"🟢 Sinxronlangan",st_off:"⚪ Sinxronizatsiya oʻchiq",st_err:"🔴 Xato",
 cfg_updated:"Jadval boshqa qurilmadan yangilandi",
 set_ai:"🤖 Aniqlash (AI)",ai_key:"Anthropic API kaliti",
 ai_note:"Kalit faqat shu qurilmada saqlanadi. Qadoq va retseptlarni skanerlash uchun kerak.",
 ai_off:"Skanerlashni yoqish uchun Anthropic kalitini kiriting.",
 f_password:"Sozlamalar paroli",pw_ph:"yangi parol (kamida 4)",pw_save:"Parolni oʻzgartirish",
 pw_short:"Parol kamida 4 belgidan iborat boʻlsin.",pw_saved:"Parol oʻzgartirildi.",
 refresh_q:"Ilova soʻnggi versiyaga yangilansinmi? Maʼlumotlar saqlanadi.",ver_lbl:"Versiya",
 live_by:"belgiladi: {by}",live_upd:"yangilandi {t}"});
/* строки экрана «История» */
Object.assign(L.ru,{
 hist_open:"История",hist_title:"История событий",hist_back:"Назад",hist_loading:"Загрузка истории…",
 hist_empty:"Событий пока нет.",hist_offline:"Включите синхронизацию, чтобы видеть историю со всех устройств.",
 ev_dose_given:"Выдано — {time}",ev_dose_undone:"Отмена выдачи — {time}",
 ev_box_filled:"Ячейка пополнена — {cell}",ev_box_emptied:"Ячейка опустошена — {cell}",ev_refill:"Пополнение таблетницы — {times}",
 ev_med_added:"Лекарство добавлено: {med}",ev_med_edited:"Лекарство изменено: {med}",ev_med_removed:"Лекарство удалено: {med}",
 ev_time_added:"Время добавлено: {time}",ev_time_changed:"Время изменено: {old} → {time}",ev_time_removed:"Время удалено: {time}",
 ev_sched_add:"В {time} добавлено: {med}",ev_sched_remove:"Из {time} убрано: {med}"});
Object.assign(L.en,{
 hist_open:"History",hist_title:"Event history",hist_back:"Back",hist_loading:"Loading history…",
 hist_empty:"No events yet.",hist_offline:"Enable sync to see history from all devices.",
 ev_dose_given:"Given — {time}",ev_dose_undone:"Give undone — {time}",
 ev_box_filled:"Cell filled — {cell}",ev_box_emptied:"Cell emptied — {cell}",ev_refill:"Pillbox refilled — {times}",
 ev_med_added:"Medication added: {med}",ev_med_edited:"Medication changed: {med}",ev_med_removed:"Medication removed: {med}",
 ev_time_added:"Time added: {time}",ev_time_changed:"Time changed: {old} → {time}",ev_time_removed:"Time removed: {time}",
 ev_sched_add:"Added to {time}: {med}",ev_sched_remove:"Removed from {time}: {med}"});
Object.assign(L.he,{
 hist_open:"היסטוריה",hist_title:"היסטוריית אירועים",hist_back:"חזרה",hist_loading:"טוען היסטוריה…",
 hist_empty:"אין אירועים עדיין.",hist_offline:"הפעל סנכרון כדי לראות היסטוריה מכל המכשירים.",
 ev_dose_given:"ניתן — {time}",ev_dose_undone:"ביטול מתן — {time}",
 ev_box_filled:"תא מולא — {cell}",ev_box_emptied:"תא רוקן — {cell}",ev_refill:"מילוי הקופסה — {times}",
 ev_med_added:"תרופה נוספה: {med}",ev_med_edited:"תרופה שונתה: {med}",ev_med_removed:"תרופה הוסרה: {med}",
 ev_time_added:"שעה נוספה: {time}",ev_time_changed:"שעה שונתה: {old} → {time}",ev_time_removed:"שעה הוסרה: {time}",
 ev_sched_add:"נוסף ל-{time}: {med}",ev_sched_remove:"הוסר מ-{time}: {med}"});
Object.assign(L.uz,{
 hist_open:"Tarix",hist_title:"Hodisalar tarixi",hist_back:"Orqaga",hist_loading:"Tarix yuklanmoqda…",
 hist_empty:"Hodisalar hali yoʻq.",hist_offline:"Barcha qurilmalardan tarixni koʻrish uchun sinxronizatsiyani yoqing.",
 ev_dose_given:"Berildi — {time}",ev_dose_undone:"Berish bekor qilindi — {time}",
 ev_box_filled:"Katak toʻldirildi — {cell}",ev_box_emptied:"Katak boʻshatildi — {cell}",ev_refill:"Qutiga toʻldirish — {times}",
 ev_med_added:"Dori qoʻshildi: {med}",ev_med_edited:"Dori oʻzgartirildi: {med}",ev_med_removed:"Dori oʻchirildi: {med}",
 ev_time_added:"Vaqt qoʻshildi: {time}",ev_time_changed:"Vaqt oʻzgartirildi: {old} → {time}",ev_time_removed:"Vaqt oʻchirildi: {time}",
 ev_sched_add:"{time} ga qoʻshildi: {med}",ev_sched_remove:"{time} dan olib tashlandi: {med}"});

/* ============ TELEGRAM ============ */
function tgConfigured(){ return !!(state&&state.tgToken&&state.tgChat) }
async function tgSend(text){ if(!tgConfigured())return {ok:false,reason:'off'};
 try{
  const r=await fetch('https://api.telegram.org/bot'+encodeURIComponent(state.tgToken)+'/sendMessage',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:state.tgChat,text:text,parse_mode:'HTML',disable_web_page_preview:true})});
  const j=await r.json().catch(()=>({}));
  return {ok:!!j.ok, reason:j.description||('HTTP '+r.status)};
 }catch(e){ return {ok:false, reason:String(e)} } }
function tgEsc(x){ return String(x??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }
function tgLines(time, day){ const all=sortMeds(medsAt(time)); const lines=[];
 for(const m of all){ const skip=(m.excludeDays||[]).includes(day);
  const nm=tgEsc(m.name)+(medRu(m)?(' / '+tgEsc(medRu(m))):'');
  lines.push(skip ? ('• <s>'+nm+'</s> '+t('tg_skip_one')) : ('• <b>'+nm+'</b> — '+tgEsc(locQty(m.qty))));
 }
 return lines.join('\n') }
function tgClock(){ const n=new Date(); return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0') }
async function notifyGiven(time){ if(!tgConfigured())return; const day=new Date().getDay();
 const head='<b>'+t('tg_given_t')+'</b>';
 const who=tgEsc(state.caregiver||'');
 const when=tf('tg_when',{d:DF()[day],t:tgClock()});
 const body=head+'\n'+tf('tg_at',{t:time})+' · '+when+'\n👤 '+who+'\n\n'+t('tg_list')+'\n'+tgLines(time,day);
 await tgSend(body) }
async function notifyMissed(time){ if(!tgConfigured())return; const day=new Date().getDay();
 const head='<b>'+t('tg_missed_t')+'</b>';
 const body=head+'\n'+tf('tg_at',{t:time})+' · '+DF()[day]+'\n\n'+t('tg_list')+'\n'+tgLines(time,day);
 await tgSend(body) }
function sumStatusLine(time, done, gat){ if(done.includes(time)){ const at=gat[time]; return '<b>'+time+'</b> — '+t('tg_sum_given')+(at?(' '+tf('tg_sum_at',{t:at})):''); }
 // not given: pending if its time (today) hasn't arrived yet, else missed
 const n=new Date(); const [H,M]=time.split(':').map(Number); const tt=new Date(n); tt.setHours(H,M,0,0);
 const future = n.getTime() < tt.getTime();
 return '<b>'+time+'</b> — '+(future ? t('tg_sum_pending') : t('tg_sum_missed')); }
async function notifySummary(iso, day){ if(!tgConfigured())return;
 const done=await getDone(iso); const gat=await getGivenAt(iso);
 const head='<b>'+t('tg_sum_t')+'</b> · '+DF()[day];
 const rows=[];
 for(const time of state.times){ rows.push(sumStatusLine(time, done, gat)); }
 const body=head+'\n👤 '+tgEsc(state.caregiver||'')+'\n\n'+(rows.length?rows.join('\n'):t('tg_sum_none'));
 await tgSend(body) }

/* ============ STATE ============ */
let state=null, soundOn=true, audioCtx=null;
let firedAlerts={}, snoozeUntil={}, alertTime=null, alertTimer=null, titleTimer=null;
let firedRefill={}, currentRefill=null, rTimer=null, refillCtx=null;
let firedMissed={}; let firedSummary=null;
let doneCache={};
function dateISO(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
async function getDone(iso){ if(doneCache[iso])return doneCache[iso];
 const raw=await store.get('medapp:done:'+iso); let v=[]; try{v=raw?JSON.parse(raw):[]}catch(e){}
 doneCache[iso]=v; return v }
async function freshDone(iso){ const raw=await store.get('medapp:done:'+iso); let v=[]; try{v=raw?JSON.parse(raw):[]}catch(e){} doneCache[iso]=v; return v }
async function tgMissedGet(iso){ const raw=await store.get('medapp:tgmissed:'+iso); try{return raw?JSON.parse(raw):{}}catch(e){return {}} }
async function tgMissedMark(iso,time){ const o=await tgMissedGet(iso); o[time]=1; await store.set('medapp:tgmissed:'+iso,JSON.stringify(o)) }
async function markDone(iso,time){ const d=await getDone(iso); if(!d.includes(time)){d.push(time);doneCache[iso]=d;await store.set('medapp:done:'+iso,JSON.stringify(d))} firedMissed[iso+'|'+time]=true;
 try{ const gk='medapp:givenat:'+iso; const raw=await store.get(gk); const g=raw?JSON.parse(raw):{}; if(!g[time]){ const n=new Date(); g[time]=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'); await store.set(gk,JSON.stringify(g)) } }catch(e){}
 await setSlotMeta(iso,time); pushStatusSoon(iso); }
async function getGivenAt(iso){ try{const raw=await store.get('medapp:givenat:'+iso); return raw?JSON.parse(raw):{}}catch(e){return {}} }
async function unmarkDone(iso,time){ const d=await getDone(iso); const i=d.indexOf(time); if(i>=0){d.splice(i,1);doneCache[iso]=d;await store.set('medapp:done:'+iso,JSON.stringify(d))}
 await setSlotMeta(iso,time); pushStatusSoon(iso); }
async function undoGiven(tm){ if(!confirm(tf('undo_q',{t:tm})))return;
 await unmarkDone(dateISO(),tm); appendEvent('dose_undone',{time:tm});
 const day=new Date().getDay(); if(boxState&&boxState[day+'|'+tm]){ await boxTouch(day+'|'+tm,false) }
 renderHome(true) }
/* box cells: key "<weekday>|<time>" -> ISO date emptied; absent key = cell is filled */
let boxState=null;
async function loadBox(){ if(boxState)return boxState;
 const raw=await store.get('medapp:box');
 if(raw!=null){ try{boxState=JSON.parse(raw)||{}}catch(e){boxState={}} }
 else { boxState={}; const d=new Date(); boxState[d.getDay()+'|'+((state&&state.times[0])||'08:00')]=dateISO(d); await saveBox() }
 return boxState }
async function saveBox(){ await store.set('medapp:box',JSON.stringify(boxState||{})) }
const BOXED=['tab','cap'];
function boxMedsAt(tm){ return sortMeds(medsAt(tm)).filter(m=>BOXED.includes(m.type)) }
function boxTimes(){ return (state?state.times:[]).filter(tm=>boxMedsAt(tm).length>0) }
function boxEmptyTimes(day){ return boxTimes().filter(tm=>boxState&&boxState[day+'|'+tm]) }
async function emptyCell(time){ if(!boxMedsAt(time).length)return; await loadBox(); const d=new Date(); await boxTouch(d.getDay()+'|'+time,true,dateISO(d)); pushStatusSoon(dateISO(d)) }
async function syncGivenFromBox(){ const d=new Date(); const iso=dateISO(d); const day=d.getDay();
 for(const tm of (state?state.times:[])){ if(boxState&&boxState[day+'|'+tm]===iso){ await markDone(iso,tm) } } }
async function pendingRefill(){ await loadBox();
 let best=null;
 for(const k of Object.keys(boxState)){ const iso=boxState[k]; const day=Number(k.split('|')[0]);
  if(!best||iso<best.iso)best={day,iso} }
 if(!best)return null;
 const now=new Date();
 if(best.iso<dateISO(now))return best;
 const hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
 if(hm>=(state.refillTime||'22:30'))return best;
 return null }
async function loadState(){ const raw=await store.get('medapp:state:v2');
 if(raw){try{const s=JSON.parse(raw); if(s&&s.times&&s.meds&&s.schedule)state=s}catch(e){}}
 if(!state)state=defaultState(); if(!state.caregiver)state.caregiver='Джамшид'; if(!state.refillTime)state.refillTime='22:30';
 if(state.tgToken===undefined)state.tgToken='';
 if(state.tgChat===undefined)state.tgChat='';
 if(state.tgMissedMin===undefined)state.tgMissedMin=30;
 if(state.tgSummary===undefined)state.tgSummary='22:00';
 /* новое (клиент-серверная версия) */
 if(!state.sync||typeof state.sync!=='object')state.sync={enabled:false,repo:'',token:''};
 if(state.sync.repo===undefined)state.sync.repo='';
 if(state.sync.token===undefined)state.sync.token='';
 if(state.aiKey===undefined)state.aiKey='';
 if(state.passwordHash===undefined)state.passwordHash=hash('1234');
 if(!state.deviceName)state.deviceName='';
 if(!(Number(state.statusPollSec)>0))state.statusPollSec=20;
for(const id in state.meds){ if((state.meds[id].qty||'').indexOf('см. ⚠')>=0)state.meds[id].qty='2 мг — спросить врача' }
 for(const id in state.meds){ const m=state.meds[id];
  if(m.name==='FLIXOTIDE'){ if(!m.qty||/спросить врача|см\. ⚠|2 мг/.test(m.qty))m.qty='4 ампулы (4 мг)';
   if(m.warnKey==='w_flixotide'){delete m.warnKey; delete m.warnLevel} } }
 state.times.sort() }
async function saveState(){ state.times.sort(); await store.set('medapp:state:v2',JSON.stringify(state)) }
/* medImg(...) теперь в data.js (ссылается на img/<id>.png через IMG_SRC) */
function medsAt(time){ return (state.schedule[time]||[]).map(id=>({id,...state.meds[id]})).filter(m=>m.name) }
function sortMeds(arr){ return [...arr].sort((a,b)=>(ORDER[a.type]??9)-(ORDER[b.type]??9)) }
function activeMedsAt(time,day){ return sortMeds(medsAt(time)).filter(m=>!(m.excludeDays||[]).includes(day)) }

/* ============ LANGUAGE ============ */
async function setLang(l){ lang=l; await store.set('medapp:lang',l);
 document.documentElement.lang=l; document.documentElement.dir=(l==='he')?'rtl':'ltr';
 applyChrome(); const cur=['home','collect','settings'].find(s=>!document.getElementById('scr-'+s).hidden)||'home';
 if(cur==='home')renderHome(); if(cur==='collect')renderCollect(); if(cur==='settings')renderSettings(); }
function applyChrome(){
 document.getElementById('appTitle').textContent=t('app_title');
 document.getElementById('nb-home').textContent='🏠 '+t('nav_home');
 document.getElementById('nb-collect').textContent='📦 '+t('nav_collect');
 document.getElementById('nb-settings').textContent='⚙️ '+t('nav_settings');
 document.getElementById('langBtn').textContent='🌐 '+lang.toUpperCase();
 const b=document.getElementById('soundBtn'); b.classList.toggle('on',soundOn); b.innerHTML=(soundOn?'🔔 '+t('sound_on'):'🔕 '+t('sound'));
 document.getElementById('abell').textContent=t('alert_t');
 document.getElementById('abtn1').textContent=t('alert_go');
 document.getElementById('abtn2').textContent=t('alert_sn');
 document.getElementById('abtn3').textContent=t('alert_x');
 document.getElementById('wexit').textContent=t('wiz_exit');
 document.getElementById('rbell').textContent=t('refill_alert_t');
 document.getElementById('rbtn1').textContent=t('refill_start');
 document.getElementById('rbtn2').textContent=t('refill_later');
 tick() }
function pickLang(){ let rows='';
 for(const[code,m]of Object.entries(LANG_META)){
  rows+=`<button class="langopt ${code===lang?'on':''}" onclick="setLang('${code}');closeModal()"><span class="lf">${m.flag}</span>${m.name}<span style="margin-inline-start:auto;color:var(--muted);font-size:13px">${code.toUpperCase()}</span></button>` }
 openModal(`<h3>${t('lang_pick')}</h3>${rows}<button class="bigbtn gray" onclick="closeModal()">${t('close')}</button>`) }

/* ============ FULLSCREEN ============ */
const FS_EXPAND='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5"/><path d="M15 4h5v5"/><path d="M9 20H4v-5"/><path d="M15 20h5v-5"/></svg>';
const FS_COMPRESS='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h5V4"/><path d="M20 9h-5V4"/><path d="M4 15h5v5"/><path d="M20 15h-5v5"/></svg>';
function fsOn(){ return !!(document.fullscreenElement||document.webkitFullscreenElement) }
function fsEnter(){ try{ const el=document.documentElement; const f=el.requestFullscreen||el.webkitRequestFullscreen; if(f)f.call(el) }catch(e){} }
function fsExit(){ try{ const f=document.exitFullscreen||document.webkitExitFullscreen; if(f)f.call(document) }catch(e){} }
function toggleFS(){ fsOn()?fsExit():fsEnter() }
function updFS(){ const b=document.getElementById('fsBtn'); if(b)b.innerHTML=fsOn()?FS_COMPRESS:FS_EXPAND }
document.addEventListener('fullscreenchange',updFS);
document.addEventListener('webkitfullscreenchange',updFS);
/* ============ NAV / CLOCK ============ */
function show(scr){ for(const s of ['home','collect','settings']){ document.getElementById('scr-'+s).hidden=(s!==scr); document.getElementById('nb-'+s).classList.toggle('on',s===scr) }
 if(scr==='home')renderHome(); if(scr==='collect')renderCollect(); if(scr==='settings'){setAuthed=false;renderSettings()} window.scrollTo(0,0) }
function tick(){ const n=new Date();
 document.getElementById('clock').textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
 document.getElementById('hdate').textContent=DF()[n.getDay()]+', '+n.getDate()+'.'+String(n.getMonth()+1).padStart(2,'0') }

/* ============ AUDIO ============ */
function ensureAudio(){ if(!audioCtx){ try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){} } if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume() }
function chime(){ if(!soundOn||!audioCtx)return; const tt=audioCtx.currentTime;
 [[880,0],[1108.7,.18],[1318.5,.36],[880,.9],[1318.5,1.08]].forEach(([f,d])=>{
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type='sine';o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,tt+d);g.gain.exponentialRampToValueAtTime(0.5,tt+d+0.025);g.gain.exponentialRampToValueAtTime(0.0001,tt+d+1.1);
  o.connect(g);g.connect(audioCtx.destination);o.start(tt+d);o.stop(tt+d+1.2) }) }
/* Ringing pattern: 3 bursts, each ~8s (melody repeats every 1.6s inside a burst), 20s gap between bursts, then stop. */
let ringTimers=[];
const RING_BURSTS=3, RING_BURST_MS=8000, RING_GAP_MS=20000, RING_REPEAT_MS=1600;
function stopRinging(){ ringTimers.forEach(id=>clearTimeout(id)); ringTimers.forEach(id=>clearInterval(id)); ringTimers=[]; }
function startRinging(){ stopRinging();
 for(let bn=0; bn<RING_BURSTS; bn++){
  const burstStart=bn*(RING_BURST_MS+RING_GAP_MS);
  // schedule the repeating chimes within this burst
  const tStart=setTimeout(()=>{ chime();
    const iv=setInterval(chime, RING_REPEAT_MS); ringTimers.push(iv);
    const tStop=setTimeout(()=>clearInterval(iv), RING_BURST_MS); ringTimers.push(tStop);
  }, burstStart);
  ringTimers.push(tStart);
 } }
function toggleSound(){ ensureAudio(); soundOn=!soundOn;
 const b=document.getElementById('soundBtn'); b.classList.toggle('on',soundOn);
 b.innerHTML=(soundOn?'🔔 '+t('sound_on'):'🔕 '+t('sound'));
 store.set('medapp:sound',soundOn?'1':'0'); if(soundOn)chime() }

/* ============ REMINDERS ============ */
async function checkReminders(){ if(!state)return; const n=new Date(); const iso=dateISO(n); const day=n.getDay();
 const done=await freshDone(iso);
 const flowOpen=document.getElementById('wiz').classList.contains('open');
 for(const time of state.times){
  if(flowOpen)break;
  if(done.includes(time))continue;
  const key=iso+'|'+time;
  if(firedAlerts[key])continue;
  if(snoozeUntil[time]&&n.getTime()<snoozeUntil[time])continue;
  const [H,M]=time.split(':').map(Number); const tt=new Date(n); tt.setHours(H,M,0,0);
  const diff=n.getTime()-tt.getTime();
  if(diff>=0&&diff<10*60*1000){ firedAlerts[key]=true; openAlert(time,day); break }
 }
 // evening summary (once per day at/after configured time)
 if(tgConfigured()&&state.tgSummary&&/^\d{2}:\d{2}$/.test(state.tgSummary)){
  const skey=iso; if(firedSummary!==skey){ const hm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
   if(hm>=state.tgSummary){ firedSummary=skey; notifySummary(iso, day) } } }
 // missed-dose Telegram alert (once per time per day), after grace minutes
 if(tgConfigured()){ const graceMs=(state.tgMissedMin||30)*60*1000;
  const sent=await tgMissedGet(iso);
  for(const time of state.times){ if(done.includes(time))continue;
   const mkey=iso+'|'+time; if(firedMissed[mkey]||sent[time])continue;
   const [H,M]=time.split(':').map(Number); const tt=new Date(n); tt.setHours(H,M,0,0);
   if(n.getTime()-tt.getTime()>=graceMs){
    const recheck=await freshDone(iso); if(recheck.includes(time))continue;
    firedMissed[mkey]=true; await tgMissedMark(iso,time); notifyMissed(time); } }
 }
 if(!document.getElementById('alert').classList.contains('open')&&!document.getElementById('ralert').classList.contains('open')&&!document.getElementById('wiz').classList.contains('open')){
  const pr=await pendingRefill();
  if(pr&&!firedRefill[pr.iso+'|'+pr.day]){ firedRefill[pr.iso+'|'+pr.day]=true; openRefillAlert(pr) }
 }
 renderHome(false) }
function openAlert(time,day){ alertTime=time;
 const all=sortMeds(medsAt(time));
 const active=all.filter(m=>!(m.excludeDays||[]).includes(day));
 document.getElementById('atime').textContent=time;
 document.getElementById('ainfo').textContent=tf('alert_n',{m:fmtMeds(active.length)});
 let rows='';
 for(const m of all){ const d=TYPES[m.type]||TYPES.tab; const im=medImg(m);
  const skip=(m.excludeDays||[]).includes(day);
  rows+=`<div class="arow ${skip?'skip':''}">
   ${im?`<img src="${im}" alt="">`:`<span class="aic" style="background:${d.bg};color:${d.c}">${icon(m.type,24)}</span>`}
   <div><div class="an">${esc(m.name)}${medRu(m)?` <span class="anru">${esc(medRu(m))}</span>`:''}</div><div class="at" style="color:${skip?'#B42222':d.c}">${skip?t('skip_chip'):tyLabel(m.type)}</div></div>
   <span class="aq" style="${skip?'':`color:${d.c};border-color:${d.c}`}">${skip?t('alert_skip'):esc(locQty(m.qty))}</span></div>` }
 document.getElementById('alist').innerHTML=rows||'';
 document.getElementById('alert').classList.add('open');
 try{navigator.vibrate&&navigator.vibrate([300,150,300])}catch(e){}
 startRinging();
 clearInterval(titleTimer); let f=false; titleTimer=setInterval(()=>{document.title=(f=!f)?'🔔!':t('app_title')},900) }
function closeAlert(){ document.getElementById('alert').classList.remove('open');
 stopRinging();clearInterval(titleTimer);document.title=t('app_title') }
function alertSnooze(){ if(alertTime){ snoozeUntil[alertTime]=Date.now()+5*60*1000; delete firedAlerts[dateISO()+'|'+alertTime] } closeAlert() }
function alertCollect(){ closeAlert(); startGive(alertTime) }
function dayStrip(target){ let h='<div class="days" style="margin-top:12px">'; for(const d of DAYORDER){h+=`<span class="dchip ${d===target?'on':''}">${DS()[d]}</span>`} return h+'</div>' }
function openRefillAlert(pr){ currentRefill=pr;
 document.getElementById('rday').textContent=DF()[pr.day].toUpperCase();
 document.getElementById('rinfo').textContent=(pr.iso===dateISO())?t('refill_sub'):t('refill_late_sub');
 const cells=boxEmptyTimes(pr.day); const showCells=cells.length?cells:boxTimes();
 document.getElementById('rstrip').innerHTML=dayStrip(pr.day)+`<div class="note" style="font-weight:800;font-size:13px">${tf('cells_lbl',{t:showCells.join(' · ')})}</div>`;
 document.getElementById('ralert').classList.add('open');
 try{navigator.vibrate&&navigator.vibrate([200,120,200])}catch(e){}
 startRinging() }
function closeRAlert(){ document.getElementById('ralert').classList.remove('open'); stopRinging() }
function refillStart(){ const pr=currentRefill; closeRAlert(); if(pr)startRefill(pr.iso,pr.day) }

/* ============ HOME ============ */
async function renderHome(force){ const el=document.getElementById('scr-home'); if(el.hidden&&force!==false&&force!==true)return; if(el.hidden&&force===false)return;
 const n=new Date(); const iso=dateISO(n); const day=n.getDay(); const done=await getDone(iso);
 const hm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
 let next=null; for(const tm of state.times){ if(!done.includes(tm)&&tm>=hm){next=tm;break} }
 let nextHtml;
 if(next){ const [H,M]=next.split(':').map(Number); const tt=new Date(n); tt.setHours(H,M,0,0);
  let mins=Math.max(0,Math.round((tt-n)/60000)); const h=Math.floor(mins/60),m=mins%60;
  const ts=fmtDur(h,m);
  nextHtml=`<div class="next"><div class="lbl">${t('next_intake')}</div><div class="big">${next}</div>
  <div class="in">${tf('in_t',{t:ts,m:fmtMeds(activeMedsAt(next,day).length)})}</div></div>`;
 } else {
  const anyLeft=state.times.some(tm=>!done.includes(tm));
  nextHtml=anyLeft
   ?`<div class="next" style="background:linear-gradient(135deg,#B45309,#d97a1d)"><div class="lbl">${t('missed')}</div><div class="big">⚠</div></div>`
   :`<div class="next" style="background:linear-gradient(135deg,#059669,#10b981)"><div class="lbl">${t('today_lbl')}</div><div class="big">${t('all_done')}</div><div class="in">${t('all_done_sub')}</div></div>`;
 }
 let rows='';
 for(const tm of state.times){ const meds=activeMedsAt(tm,day); const isDone=done.includes(tm);
  const isNow=!isDone&&(()=>{const[H,M]=tm.split(':').map(Number);const x=new Date(n);x.setHours(H,M,0,0);return n>=x&&(n-x)<10*60*1000})();
  const late=!isDone&&!isNow&&tm<hm;
  rows+=`<button class="trow" onclick="${isDone?`undoGiven('${tm}')`:`startGive('${tm}')`}">
   <span class="tm">${tm}</span>
   <span class="rowmid"><span class="tyics">${[...new Set(meds.map(x=>x.type))].sort((a,b)=>(ORDER[a]??9)-(ORDER[b]??9)).map(k=>`<span class="tyic" style="background:${TYPES[k].bg};color:${TYPES[k].c}">${icon(k,15)}</span>`).join('')}</span><span class="cnt">${fmtMeds(meds.length)} ${meds.some(m=>m.warnLevel==='red')?'❗':''}</span></span>
   <span class="st ${isDone?'done':isNow?'now':'wait'}">${isDone?t('st_done'):isNow?t('st_now'):late?t('st_late'):t('st_wait')}</span></button>` }
 const pr=await pendingRefill();
 const banner=pr?`<button class="trow" style="background:#F4EEFE;border-color:#dcc9f8" onclick="startRefill('${pr.iso}',${pr.day})">
  <span style="font-size:24px">📦</span>
  <span style="text-align:start"><span style="display:block;font-weight:900;font-size:15px;color:#5b21b6">${t('refill_alert_t')}</span>
  <span style="display:block;font-size:12.5px;color:#7c3aed;font-weight:700">${tf('refill_section',{d:DF()[pr.day].toUpperCase()})} · ${tf('cells_n',{n:boxEmptyTimes(pr.day).length})} · ${pr.iso===dateISO()?t('b_today'):(pr.iso.slice(8,10)+'.'+pr.iso.slice(5,7))}</span></span>
  <span class="st now" style="margin-inline-start:auto">!</span></button>`:'';
 el.innerHTML=`${nextHtml}${banner}<h2>${tf('today_is',{d:DF()[day]})}</h2>${rows}
 <button class="bigbtn" onclick="show('collect')">${t('btn_collect')}</button>
 <div class="note">${t('home_note')}</div>${verLine()}` }

/* ============ ORDER INFOGRAPHIC ============ */
function orderInfographic(){
 const arrow=`<span class="oarr"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h14"/><path d="M13 6l6 6-6 6"/></svg></span>`;
 const node=(num,ty,extra)=>{const d=TYPES[ty];
  return `<div class="onode"><span class="oic" style="background:${d.bg};color:${d.c}"><span class="onum">${num}</span>${icon(ty,30)}</span>
  <span class="olbl" style="color:${d.c}">${tyLabel(ty)}${extra?`<small>${extra}</small>`:''}</span></div>`};
 return `<div class="order"><div class="otitle">${t('order_title')}</div>
  <div class="oflow">${node(1,'tab','+ '+tyLabel('cap'))}${arrow}${node(2,'syr','')}${arrow}${node(3,'drop','')}${arrow}${node(4,'inh','')}</div></div>` }

/* ============ COLLECT ============ */
function renderCollect(){ const el=document.getElementById('scr-collect');
 const bts=boxTimes(); const today=new Date().getDay();
 let cells=`<span class="bxt"></span>`;
 for(const d of DAYORDER){ cells+=`<span class="bxh ${d===today?'tdy':''}">${DS()[d]}</span>` }
 for(const tm of bts){
  cells+=`<span class="bxt">${tm}</span>`;
  for(const d of DAYORDER){ const key=d+'|'+tm; const emptyISO=boxState&&boxState[key];
   cells+= emptyISO
    ? `<button class="bxc empty ${d===today?'tdy':''}" onclick="cellMenu(${d},'${tm}')">${t('box_empty_cell')}</button>`
    : `<button class="bxc full ${d===today?'tdy':''}" onclick="cellMenu(${d},'${tm}')">✓</button>` } }
 el.innerHTML=`<h2>📦 ${t('box_title')}</h2>
 <div class="card"><div class="bxgrid" style="grid-template-columns:54px repeat(${DAYORDER.length},1fr)">${cells}</div></div>
 <div class="note">${t('box_legend')}</div>
 ${orderInfographic()}${verLine()}` }

/* ============ WIZARD ============ */
let steps=[],stepIdx=0,wizDay=0;
function closeWiz(){ refillCtx=null; document.getElementById('wiz').classList.remove('open'); renderHome(false) }
function renderStep(){ const s=steps[stepIdx]; if(!s){closeWiz();return}
 const body=document.getElementById('wbody'), nav=document.getElementById('wnav');
 const groupSteps=steps.filter(x=>x.k==='group');
 if(groupSteps.length){
  const pg=steps.slice(0,stepIdx).filter(x=>x.k==='group').length;
  document.getElementById('wfill').style.width=(s.k==='thanks'?100:Math.round(100*pg/groupSteps.length))+'%';
  document.getElementById('wtitle').textContent=t('give_title')+' · '+(s.time||'');
 } else {
  const medSteps=steps.filter(x=>x.k==='med'||x.k==='skip');
  const passed=steps.slice(0,stepIdx).filter(x=>x.k==='med'||x.k==='skip').length;
  document.getElementById('wfill').style.width=Math.round(100*passed/Math.max(1,medSteps.length))+'%';
  document.getElementById('wtitle').textContent=(refillCtx?t('refill_title'):t('wiz'))+' · '+DF()[wizDay];
 }
 const backBtn=stepIdx>0?`<button class="back" onclick="stepIdx--;renderStep()">←</button>`:'';
 if(s.k==='med'||s.k==='skip'){
  const m=s.med,d=TYPES[m.type]||TYPES.tab;
  const inTime=steps.filter(x=>(x.k==='med'||x.k==='skip')&&x.time===s.time);
  const idxIn=inTime.indexOf(s)+1;
  document.getElementById('wprog').textContent=refillCtx?tf('rcell_step',{t:s.time,i:idxIn,n:inTime.length}):tf('wiz_step',{t:s.time,i:idxIn,n:inTime.length});
  const im=medImg(m);
  const ph=im?`<img src="${im}" alt="">`
            :`<div class="noimg" style="background:${d.bg};color:${d.c}">${icon(m.type,42)}<span>${t('no_photo')}</span></div>`;
  if(s.k==='skip'){
   body.innerHTML=`<div class="wcard" style="border:3px solid var(--red)">
    <span class="tchip" style="background:#FBE7E7;color:#B42222">${refillCtx?t('skip_box'):t('skip_chip')}</span>
    <div class="nm" style="color:#B42222">${esc(m.name)}</div>
    ${medRu(m)?`<div class="nm nmru" style="color:#B42222">${esc(medRu(m))}</div>`:''}
    <div class="sb">${esc(medSub(m))}</div>
    <div class="ph">${ph}</div>
    <div class="wflag red">${refillCtx?tf('skip_note_box',{d:DF()[wizDay].toUpperCase()}):tf('skip_note',{d:DF()[wizDay].toUpperCase()})}<br>${esc(medWarn(m))}</div></div>`;
   nav.innerHTML=`${backBtn}<button class="done" style="background:var(--red)" onclick="stepIdx++;renderStep()">${t('skip_btn')}</button>`;
  } else {
   body.innerHTML=`<div class="wcard">
    <span class="tchip" style="background:${d.bg};color:${d.c}">${icon(m.type,16)} ${tyLabel(m.type)}</span>
    <div class="nm">${esc(m.name)}</div>
    ${medRu(m)?`<div class="nm nmru">${esc(medRu(m))}</div>`:''}
    <div class="sb">${esc(medSub(m))}</div>
    <div class="ph">${ph}</div>
    <div><span class="qy" style="color:${d.c};border-color:${d.c}">${esc(locQty(m.qty))}</span></div>
    ${medWarn(m)?`<div class="wflag ${m.warnLevel||'info'}">${esc(medWarn(m))}</div>`:''}</div>`;
   nav.innerHTML=`${backBtn}<button class="done" onclick="stepIdx++;renderStep()">${refillCtx?t('placed_btn'):t('done_btn')}</button>`;
  }
 } else if(s.k==='rintro'){
  document.getElementById('wprog').textContent='';
  body.innerHTML=`<div class="wcard"><div style="font-size:46px;line-height:1">📦</div>
   <div class="sb" style="font-size:14px;font-weight:800;letter-spacing:.05em;margin-top:6px">${t('refill_intro_t')}</div>
   <div class="wbig" style="font-size:38px;color:#6b21a8">${DF()[s.day].toUpperCase()}</div>
   ${dayStrip(s.day)}
   <div class="note" style="font-weight:800;font-size:13px">${tf('cells_lbl',{t:((refillCtx&&refillCtx.times)?refillCtx.times:boxTimes()).join(' · ')})}</div>
   <div class="wflag info" style="margin-top:10px">${t('refill_intro_note')}</div></div>`;
  nav.innerHTML=`<button class="done" style="background:#7C3AED" onclick="stepIdx++;renderStep()">${t('refill_start')}</button>`;
 } else if(s.k==='rdone'){
  document.getElementById('wprog').textContent='';
  body.innerHTML=`<div class="wcard"><div style="font-size:50px;line-height:1">📦✅</div>
   <div class="wbig" style="font-size:27px">${esc(tf('rdone_t',{d:DF()[s.day]}))}</div>
   <div class="sb" style="font-size:17px">${esc(tf('thanks_t',{name:state.caregiver||'Джамшид'}))}</div>
   ${dayStrip(s.day)}</div>`;
  nav.innerHTML=`<button class="done" onclick="finishRefill()">${t('alert_x')}</button>`;
 } else if(s.k==='group'){
  document.getElementById('wprog').textContent=tf('give_step',{i:s.gi+1,n:s.gn});
  const isInh=s.types.includes('inh');
  const present=[...new Set(s.meds.map(m=>m.type))];
  const title=present.map(k=>tyLabel(k)).join(' + ');
  const ticons=present.map(k=>`<span class="oic" style="background:${TYPES[k].bg};color:${TYPES[k].c};width:46px;height:46px;display:inline-flex;margin:0 4px">${icon(k,26)}</span>`).join('');
  let rows='';
  for(const m of s.meds){ const d=TYPES[m.type]||TYPES.tab; const im=medImg(m);
   const skip=(m.excludeDays||[]).includes(wizDay);
   const warn=medWarn(m);
   rows+=`<div class="grow ${skip?'skip':''}">
    ${im?`<img src="${im}">`:`<span class="gic" style="background:${d.bg};color:${d.c}">${icon(m.type,30)}</span>`}
    <div style="flex:1;min-width:0"><div class="gn">${esc(m.name)}${medRu(m)?` <span class="gnru">${esc(medRu(m))}</span>`:''}</div>
     <div class="gs">${skip?t('skip_chip'):esc(medSub(m))}</div>
     ${(!skip&&warn)?`<div class="wflag ${m.warnLevel||'info'} gwarn">${esc(warn)}</div>`:''}</div>
    <span class="gq" style="${skip?'color:#B42222;border-color:#B42222':`color:${d.c};border-color:${d.c}`}">${skip?t('alert_skip'):esc(locQty(m.qty))}</span></div>` }
  const gsteps=steps.filter(x=>x.k==='group'&&x.time===s.time);
  const stepper=gsteps.map((g,i)=>{ const ty=[...new Set(g.meds.map(m=>m.type))].sort((a,b)=>(ORDER[a]??9)-(ORDER[b]??9))[0]; const dd=TYPES[ty];
   const st=i<s.gi?'background:#E2F4EA;color:#1d6b43;border-color:#bfe3cd':(i===s.gi?`background:${dd.bg};color:${dd.c};border-color:${dd.c}`:'');
   return `<span class="stp" style="${st}">${i<s.gi?'✓':icon(ty,24)}</span>`;
  }).join(`<span class="sarr"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h14"/><path d="M13 6l6 6-6 6"/></svg></span>`);
  body.innerHTML=`<div style="width:100%;max-width:560px">
   ${gsteps.length>1?`<div class="stepper">${stepper}</div>`:`<div style="text-align:center;margin-bottom:6px">${ticons}</div>`}
   <div style="text-align:center;font-weight:900;font-size:32px;letter-spacing:.02em">${title}</div>
   <div style="text-align:center;font-size:18px;font-weight:800;color:var(--ink);margin-top:4px">${isInh?t('give_inh_note'):t('give_note')}</div>
   ${rows}</div>`;
  nav.innerHTML=`${backBtn}<button class="done" onclick="confirmGroup()">${isInh?t('conf_inh'):t('conf_given')}</button>`;
 } else if(s.k==='thanks'){
  document.getElementById('wprog').textContent='';
  const done=doneCache[dateISO()]||[];
  const nxt=state.times.find(tm=>tm>s.time&&!done.includes(tm));
  body.innerHTML=`<div class="wcard"><div style="font-size:54px;line-height:1">🙏</div>
   <div class="wbig" style="font-size:32px">${esc(tf('thanks_t',{name:state.caregiver||'Джамшид'}))}</div>
   <div class="sb" style="font-size:17px">${t('thanks_s')}</div>
   <div class="wflag info" style="margin-top:16px;font-size:16px;font-weight:800">${nxt?tf('next_at',{t:nxt}):t('none_more')}</div></div>`;
  nav.innerHTML=`<button class="done" onclick="closeWiz();show('home')">${t('alert_x')}</button>`;
 } else if(s.k==='tdone'){
  document.getElementById('wprog').textContent=refillCtx?tf('rtdone',{t:s.time}):tf('tdone_lbl',{t:s.time});
  const nxt=steps.slice(stepIdx+1).find(x=>x.k==='med'||x.k==='skip');
  body.innerHTML=`<div class="wcard"><div class="wcheck"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg></div>
   <div class="wbig">${s.time} ✓</div><div class="sb" style="font-size:17px">${refillCtx?t('cell_done'):t('tdone')}</div></div>`;
  nav.innerHTML=`${backBtn}<button class="done" onclick="finishTime('${s.time}')">${nxt?tf('next_btn',{t:nxt.time}):t('finish')}</button>`;
 } else if(s.k==='alldone'){
  document.getElementById('wprog').textContent='';
  body.innerHTML=`<div class="wcard"><div class="wcheck" style="width:110px;height:110px"><svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg></div>
   <div class="wbig" style="font-size:30px">${t('all_collected')}</div>
   <div class="sb" style="font-size:16px">${tf('all_collected_sub',{d:DF()[wizDay]})}</div></div>`;
  nav.innerHTML=`<button class="done" onclick="closeWiz();show('home')">${t('to_home')}</button>`;
 }
 document.getElementById('wbody').scrollTop=0 }
async function finishTime(tm){ if(!refillCtx&&wizDay===new Date().getDay()){ await markDone(dateISO(),tm); await emptyCell(tm); notifyGiven(tm) } stepIdx++;renderStep() }

/* ============ GIVE FLOW (staged administration) ============ */
function startGive(time){ refillCtx=null; wizDay=new Date().getDay(); steps=[];
 const all=sortMeds(medsAt(time));
 const defs=[['tab','cap'],['syr','drop','sup'],['inh']];
 const groups=[]; for(const g of defs){ const meds=all.filter(m=>g.includes(m.type)); if(meds.length)groups.push({types:g,meds}) }
 groups.forEach((g,gi)=>steps.push({k:'group',time,types:g.types,meds:g.meds,gi,gn:groups.length}));
 steps.push({k:'thanks',time});
 stepIdx=0; document.getElementById('wiz').classList.add('open'); renderStep() }
function startRefill(iso,day,onlyTimes){ const cells=(onlyTimes&&onlyTimes.length)?onlyTimes:boxEmptyTimes(day); const useTimes=cells.length?cells:boxTimes();
 refillCtx={iso,day,times:useTimes}; wizDay=day; steps=[{k:'rintro',day,iso}];
 for(const tm of useTimes){ const all=boxMedsAt(tm); if(!all.length)continue;
  for(const m of all){ steps.push((m.excludeDays||[]).includes(day)?{k:'skip',time:tm,med:m}:{k:'med',time:tm,med:m}) }
  steps.push({k:'tdone',time:tm}) }
 steps.push({k:'rdone',iso,day});
 stepIdx=0; document.getElementById('wiz').classList.add('open'); renderStep() }
function cellMenu(day,tm){ const key=day+'|'+tm; const emptyISO=boxState&&boxState[key];
 openModal(`<h3>📦 ${DF()[day]} · ${tm}</h3>
  <div class="wflag ${emptyISO?'red':'info'}" style="text-align:center;font-size:16px">${emptyISO?t('c_now_empty'):t('c_now_full')}</div>
  ${emptyISO?`<button class="bigbtn" style="background:#7C3AED" onclick="closeModal();startRefill('${emptyISO}',${day},['${tm}'])">${t('c_fill_steps')}</button>
   <button class="bigbtn green" onclick="markCellFull(${day},'${tm}')">${t('c_mark_full')}</button>`
  :`<button class="bigbtn" onclick="cellContents(${day},'${tm}')">${t('c_show')}</button>
   <button class="bigbtn red" onclick="markCellEmpty(${day},'${tm}')">${t('c_mark_empty')}</button>`}
  <button class="bigbtn gray" onclick="closeModal()">${t('cancel')}</button>`) }
function cellContents(day,tm){ const meds=boxMedsAt(tm); let rows='';
 for(const m of meds){ const d=TYPES[m.type]||TYPES.tab; const im=medImg(m); const skip=(m.excludeDays||[]).includes(day);
  rows+=`<div class="arow ${skip?'skip':''}">
   ${im?`<img src="${im}" alt="">`:`<span class="aic" style="background:${d.bg};color:${d.c}">${icon(m.type,24)}</span>`}
   <div><div class="an">${esc(m.name)}${medRu(m)?` <span class="anru">${esc(medRu(m))}</span>`:''}</div><div class="at" style="color:${skip?'#B42222':d.c}">${skip?t('skip_box'):tyLabel(m.type)}</div></div>
   <span class="aq" style="${skip?'':`color:${d.c};border-color:${d.c}`}">${skip?'—':esc(locQty(m.qty))}</span></div>` }
 openModal(`<h3>📦 ${DF()[day]} · ${tm}</h3>
  <div class="note" style="font-weight:800;font-size:14.5px;margin:0 0 8px">${t('c_in_cell')}</div>
  <div class="alist" style="max-height:52vh">${rows}</div>
  <button class="bigbtn gray" onclick="closeModal()">${t('close')}</button>`) }
async function markCellFull(day,tm){ await boxTouch(day+'|'+tm,false); appendEvent('box_filled',{cell:day+'|'+tm}); pushStatusSoon(dateISO()); closeModal(); renderCollect(); renderHome(false) }
async function markCellEmpty(day,tm){ await loadBox(); await boxTouch(day+'|'+tm,true,dateISO()); appendEvent('box_emptied',{cell:day+'|'+tm}); pushStatusSoon(dateISO()); closeModal(); renderCollect(); renderHome(false) }
async function finishRefill(){ if(refillCtx){ appendEvent('refill',{day:refillCtx.day,times:(refillCtx.times||[]).slice()}); for(const tm of (refillCtx.times||[])){ await boxTouch(refillCtx.day+'|'+tm,false) } pushStatusSoon(dateISO()) }
 refillCtx=null; document.getElementById('wiz').classList.remove('open'); show('home') }
async function confirmGroup(){ const s=steps[stepIdx];
 if(steps[stepIdx+1]&&steps[stepIdx+1].k==='thanks'){ await markDone(dateISO(),s.time); await emptyCell(s.time); notifyGiven(s.time); appendEvent('dose_given',{time:s.time}) }
 stepIdx++; renderStep() }

/* ============ SETTINGS PASSWORD GATE ============ */
/* Пароль — настраиваемый (state.passwordHash, по умолчанию «1234», хэш FNV-1a
   в data.js). Синхронизируется в конфиг-бэкап, поэтому общий для устройств.
   Жёсткой блокировки нет (это барьер от самого пациента, а не криптозащита):
   счётчик попыток мягкий, при исчерпании просто сбрасывается. */
let setAuthed=false, pwLeft=5;
function renderSettingsGate(){ const el=document.getElementById('scr-settings');
 el.innerHTML=`<div class="card" style="margin-top:26px;text-align:center;padding:26px 18px">
  <div style="font-size:54px;line-height:1">🔒</div>
  <h2 style="margin:12px 0 6px">${t('s_prot_t')}</h2>
  <div class="note" style="font-size:14.5px;margin-bottom:14px">${t('s_enter')}</div>
  <input type="password" id="spw" inputmode="numeric" autocomplete="off"
   style="font-size:26px;font-weight:900;text-align:center;letter-spacing:.18em;max-width:320px;margin:0 auto"
   onkeydown="if(event.key==='Enter')tryUnlock()">
  <div id="spwerr" class="wflag red" style="display:none;margin:12px auto 0;max-width:320px"></div>
  <button class="bigbtn" style="max-width:320px;margin:16px auto 0" onclick="tryUnlock()">🔓 ${t('s_open')}</button>
 </div>`;
 setTimeout(()=>{const i=document.getElementById('spw'); if(i)i.focus()},50) }
function tryUnlock(){ const v=(document.getElementById('spw')||{}).value||'';
 if(hash(v)===state.passwordHash){ pwLeft=5; setAuthed=true; renderSettings(); return }
 pwLeft--; if(pwLeft<=0)pwLeft=5;
 const e=document.getElementById('spwerr'); if(e){e.style.display='block'; e.textContent=tf('s_wrong',{n:pwLeft})}
 const i=document.getElementById('spw'); if(i){i.value=''; i.focus()} }
async function savePassword(v){ v=(v||'').trim(); if(v.length<4){alert(t('pw_short'));return}
 state.passwordHash=hash(v); await saveState(); alert(t('pw_saved')) }

/* ============ SETTINGS ============ */
function renderSettings(){ if(!setAuthed){renderSettingsGate();return} const el=document.getElementById('scr-settings');
 let timesHtml='';
 state.times.forEach((tm,i)=>{ timesHtml+=`<div class="row">
  <input type="time" value="${tm}" onchange="changeTime(${i},this.value)">
  <span style="font-size:13px;color:var(--muted);font-weight:600">${fmtMeds(medsAt(tm).length)}</span>
  <button class="icbtn red" style="margin-inline-start:auto" onclick="delTime(${i})">🗑</button></div>` });
 let schedHtml='';
 for(const tm of state.times){ let chips='';
  for(const m of sortMeds(medsAt(tm))){ const im=medImg(m); const d=TYPES[m.type]||TYPES.tab;
   chips+=`<div class="medchip">${im?`<img src="${im}">`:`<span style="color:${d.c}">${icon(m.type,26)}</span>`}
    <div><div class="mn">${esc(m.name)}${medRu(m)?` <span style="font-weight:800;color:var(--muted)">${esc(medRu(m))}</span>`:''}</div><div class="mq">${tyLabel(m.type)} · ${esc(locQty(m.qty))}</div></div>
    <button class="icbtn red x" onclick="removeFromTime('${tm}','${m.id}')">✕</button></div>` }
  schedHtml+=`<div style="margin-top:14px"><div style="font-weight:900;font-size:19px">${tm}</div>${chips}
  <button class="addln" onclick="pickMedFor('${tm}')">${tf('add_med',{t:tm})}</button></div>` }
 let lib='';
 for(const [id,m] of Object.entries(state.meds)){ const im=medImg(m); const d=TYPES[m.type]||TYPES.tab;
  lib+=`<div class="libc">${im?`<img src="${im}">`:`<div class="noimg" style="background:${d.bg};color:${d.c}">${icon(m.type,30)}</div>`}
   <div class="n">${esc(m.name)}</div>${medRu(m)?`<div class="n" style="font-size:12.5px;color:var(--muted);margin-top:1px">${esc(medRu(m))}</div>`:''}<div class="ty" style="color:${d.c}">${tyLabel(m.type)}</div>
   <div class="btns"><button class="ebtn" onclick="editMed('${id}')">${t('edit')}</button><button class="dbtn" onclick="delMed('${id}')">${t('del')}</button></div></div>` }
 el.innerHTML=`<button class="bigbtn" style="background:#5b21b6;margin-top:4px" onclick="openHistory()">📜 ${t('hist_open')}</button>
 <h2>👤 ${t('f_caregiver')}</h2>
 <div class="card"><input type="text" value="${esc(state.caregiver||'')}" onchange="saveCaregiver(this.value)" style="font-weight:800;font-size:17px">
 <div class="note">${t('cg_note')}</div></div>
 <h2>${tf('set_times',{n:state.times.length})}</h2>
 <div class="card set">${timesHtml}<button class="addln" onclick="addTime()">${t('add_time')}</button></div>
 <h2>✈ ${t('set_tg')}</h2>
 <div class="card">
  <div class="fld" style="margin-top:0"><label>${t('tg_token')}</label><input type="text" id="tgtok" value="${esc(state.tgToken||'')}" placeholder="123456:ABC..." autocomplete="off" onchange="saveTg()"></div>
  <div class="fld"><label>${t('tg_chat')}</label><input type="text" id="tgchat" value="${esc(state.tgChat||'')}" placeholder="напр. 123456789" inputmode="numeric" autocomplete="off" onchange="saveTg()"></div>
  <button class="sb1" style="border-radius:11px;padding:12px 13px;font-weight:800;font-size:14px;margin-top:10px" onclick="testTg()">${t('tg_test')}</button>
  <div id="tgmsg" class="note" style="margin-top:8px">${tgConfigured()?'':t('tg_off')}</div>
  <div class="note">${t('tg_note')}</div>
  <div class="row" style="border-top:1px solid var(--line);margin-top:10px;padding-top:12px">
   <span style="flex:1;font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.04em">${t('f_summary')}</span>
   <input type="time" value="${esc(state.tgSummary||'')}" onchange="setSummary(this.value)"></div>
  <div class="note">${t('summary_note')}</div>
  <button class="sb1" style="border-radius:11px;padding:12px 13px;font-weight:800;font-size:14px;margin-top:8px" onclick="sendSummaryNow()">${t('send_summary_now')}</button>
  <div id="sumNowMsg" class="note" style="margin-top:6px"></div>
 </div>
 <h2>📦 ${t('set_box')}</h2>
 <div class="card"><div style="display:flex;align-items:center;gap:10px">
  <span style="flex:1;font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.04em">${t('f_refill_time')}</span>
  <input type="time" value="${state.refillTime||'22:30'}" onchange="setRefillTime(this.value)"></div>
  <div class="note">${t('box_note')}</div>
  <button class="sb1" style="border-radius:11px;padding:11px 13px;font-weight:800;font-size:14px;margin-top:8px" onclick="testRefill()">${t('test_refill')}</button></div>
 <h2>${t('set_sched')}</h2><div class="card">${schedHtml||'<div class="note">'+t('no_times')+'</div>'}</div>
 <h2>${t('set_lib')}</h2>
 <div class="srow" style="margin-bottom:10px">
  <button class="sb1" onclick="editMed(null)">${t('new_med')}</button>
  <button class="sb2" onclick="document.getElementById('fileRx').click()">${t('scan_rx')}</button>
 </div>
 <div class="lib">${lib}</div>
 <h2>${t('set_sync')}</h2>
 <div class="card">
  <div class="row" style="border-top:none;padding-top:0">
   <span style="flex:1;font-weight:800">${t('sync_on')}</span>
   <input type="checkbox" id="syncOn" ${state.sync.enabled?'checked':''} onchange="setSyncEnabled(this.checked)" style="width:24px;height:24px;flex:0 0 auto">
  </div>
  <div class="fld"><label>${t('sync_repo')}</label><input type="text" id="syncRepo" value="${esc(state.sync.repo||'')}" placeholder="eliduc/lekarstva-data" autocomplete="off" onchange="saveSync()"></div>
  <div class="fld"><label>${t('sync_token')}</label><input type="password" id="syncTok" value="${esc(state.sync.token||'')}" placeholder="github_pat_..." autocomplete="off" onchange="saveSync()"></div>
  <div class="fld"><label>${t('sync_device')}</label><input type="text" id="syncDev" value="${esc(state.deviceName||'')}" placeholder="${t('sync_device')}" autocomplete="off" onchange="saveDevice(this.value)"></div>
  <div class="note" id="syncStatus">${syncStatusLine()}</div>
  <button class="sb1" style="border-radius:11px;padding:12px 13px;font-weight:800;font-size:14px;margin-top:8px" onclick="restoreFromArchive()">${t('sync_restore')}</button>
  <div class="note">${t('sync_note')}</div>
 </div>
 <h2>${t('set_ai')}</h2>
 <div class="card">
  <div class="fld" style="margin-top:0"><label>${t('ai_key')}</label><input type="password" id="aiKey" value="${esc(state.aiKey||'')}" placeholder="sk-ant-..." autocomplete="off" onchange="saveAiKey(this.value)"></div>
  <div class="note">${t('ai_note')}</div>
 </div>
 <h2>🔑 ${t('f_password')}</h2>
 <div class="card"><div style="display:flex;gap:8px">
  <input type="password" id="newPw" placeholder="${t('pw_ph')}" autocomplete="new-password">
  <button class="sb1" style="border-radius:11px;padding:0 16px;font-weight:800;font-size:14px;white-space:nowrap" onclick="savePassword(document.getElementById('newPw').value)">${t('pw_save')}</button>
 </div></div>
 <div class="hr"></div>
 <div class="srow">
  <button class="sb1" onclick="testAlert()">${t('test')}</button>
  <button class="dbtn" style="padding:11px 13px;border-radius:11px;font-size:14px" onclick="resetAll()">${t('reset')}</button>
 </div>
 <div class="note">${t('set_note')}</div>
 ${verLine()}` }
async function saveCaregiver(v){ state.caregiver=(v||'').trim()||'Джамшид'; await saveState() }
async function saveTg(){ const tk=(document.getElementById('tgtok')||{}).value||''; const ch=(document.getElementById('tgchat')||{}).value||'';
 state.tgToken=tk.trim(); state.tgChat=ch.trim(); await saveState();
 const m=document.getElementById('tgmsg'); if(m)m.textContent=tgConfigured()?'':t('tg_off') }
async function testTg(){ await saveTg(); const m=document.getElementById('tgmsg');
 if(!tgConfigured()){ if(m)m.textContent=t('tg_off'); return }
 if(m)m.textContent='…';
 const r=await tgSend('<b>'+t('tg_test_t')+'</b>\n'+t('tg_test_b'));
 if(m)m.textContent=r.ok?t('tg_ok'):(t('tg_fail')+' ('+tgEsc(r.reason)+')') }
async function setSummary(v){ state.tgSummary=(/^\d{2}:\d{2}$/.test(v))?v:''; await saveState() }
async function sendSummaryNow(){ const m=document.getElementById('sumNowMsg');
 if(!tgConfigured()){ if(m)m.textContent=t('tg_off'); return }
 if(m)m.textContent='…';
 const before=tgConfigured();
 // capture result by calling tgSend directly through a summary build
 const iso=dateISO(); const day=new Date().getDay();
 const done=await getDone(iso); const gat=await getGivenAt(iso);
 const rows=[];
 for(const time of state.times){ rows.push(sumStatusLine(time, done, gat)); }
 const head='<b>'+t('tg_sum_t')+'</b> · '+DF()[day];
 const body=head+'\n👤 '+tgEsc(state.caregiver||'')+'\n\n'+(rows.length?rows.join('\n'):t('tg_sum_none'));
 const r=await tgSend(body);
 if(m)m.textContent=r.ok?t('summary_sent'):(t('tg_fail')+' ('+tgEsc(r.reason)+')') }
async function setRefillTime(v){ if(/^\d{2}:\d{2}$/.test(v)){state.refillTime=v; await saveState()} }
function testRefill(){ ensureAudio(); openRefillAlert({iso:dateISO(),day:new Date().getDay()}) }
async function addTime(){ const tm=prompt(t('new_time'),'14:00'); if(!tm||!/^\d{2}:\d{2}$/.test(tm))return;
 if(!state.times.includes(tm)){state.times.push(tm);state.schedule[tm]=state.schedule[tm]||[];appendEvent('time_added',{time:tm})} await saveState(); renderSettings() }
async function changeTime(i,val){ if(!/^\d{2}:\d{2}$/.test(val))return; const old=state.times[i]; if(old===val)return;
 state.schedule[val]=(state.schedule[val]||[]).concat(state.schedule[old]||[]); delete state.schedule[old];
 state.times[i]=val; appendEvent('time_changed',{old:old,time:val}); await saveState(); renderSettings() }
async function delTime(i){ const tm=state.times[i]; if(!confirm(tf('del_time',{t:tm})))return;
 delete state.schedule[tm]; state.times.splice(i,1); appendEvent('time_removed',{time:tm}); await saveState(); renderSettings() }
async function removeFromTime(tm,id){ const mn=(state.meds[id]||{}).name||id; state.schedule[tm]=(state.schedule[tm]||[]).filter(x=>x!==id); appendEvent('sched_remove',{time:tm,med:mn}); await saveState(); renderSettings() }
async function delMed(id){ const m=state.meds[id]; if(!confirm(tf('del_med',{m:m.name})))return;
 delete state.meds[id]; for(const tm of state.times)state.schedule[tm]=(state.schedule[tm]||[]).filter(x=>x!==id);
 appendEvent('med_removed',{med:m.name}); await saveState(); renderSettings() }
function pickMedFor(tm){ const used=new Set(state.schedule[tm]||[]); let rows='';
 for(const [id,m] of Object.entries(state.meds)){ if(used.has(id))continue; const d=TYPES[m.type]||TYPES.tab; const im=medImg(m);
  rows+=`<div class="medchip" style="cursor:pointer" onclick="addToTime('${tm}','${id}')">${im?`<img src="${im}">`:`<span style="color:${d.c}">${icon(m.type,26)}</span>`}
   <div><div class="mn">${esc(m.name)}${medRu(m)?` <span style="font-weight:800;color:var(--muted)">${esc(medRu(m))}</span>`:''}</div><div class="mq">${tyLabel(m.type)} · ${esc(locQty(m.qty))}</div></div><span style="margin-inline-start:auto;font-weight:900;color:var(--teal)">＋</span></div>` }
 openModal(`<h3>${tf('add_to',{t:tm})}</h3>${rows||'<div class="note">'+t('all_added')+'</div>'}
  <button class="bigbtn gray" onclick="closeModal()">${t('close')}</button>`) }
async function addToTime(tm,id){ (state.schedule[tm]=state.schedule[tm]||[]).push(id); appendEvent('sched_add',{time:tm,med:(state.meds[id]||{}).name||id}); await saveState(); closeModal(); renderSettings() }
async function resetAll(){ if(!confirm(t('reset_q')))return; state=defaultState(); await saveState(); renderSettings() }
function testAlert(){ ensureAudio(); openAlert(state.times[0]||'08:00',new Date().getDay()) }

/* ============ MODAL ============ */
function openModal(html){ document.getElementById('mbox').innerHTML=html; document.getElementById('modal').classList.add('open') }
function closeModal(){ document.getElementById('modal').classList.remove('open') }
document.getElementById('modal').addEventListener('click',e=>{ if(e.target.id==='modal')closeModal() });

/* ============ MED EDITOR ============ */
let editId=null, editPhoto=null;
function editMed(id){ editId=id; const m=id?state.meds[id]:{name:'',type:'tab',qty:'',sub:'',warn:'',warnLevel:'info',excludeDays:[],img:null};
 editPhoto=medImg(m)||null;
 let typeOpts=''; for(const k of Object.keys(TYPES))typeOpts+=`<option value="${k}" ${m.type===k?'selected':''}>${tyLabel(k)}</option>`;
 let days=''; for(const d of DAYORDER){ const on=(m.excludeDays||[]).includes(d);
  days+=`<label class="${on?'on':''}" onclick="this.classList.toggle('on')" data-day="${d}">${DS()[d]}</label>` }
 openModal(`<h3>${id?t('e_edit'):t('e_new')}</h3>
 <div style="display:flex;gap:12px;align-items:flex-start">
  <div class="mphoto" id="ephoto">${editPhoto?`<img src="${editPhoto}">`:t('no_photo')}</div>
  <div style="flex:1">
   <div class="srow" style="margin-top:0">
    <button class="sb1" onclick="document.getElementById('fileMedPhoto').click()">${t('e_photo')}</button>
    <button class="sb2" onclick="document.getElementById('filePack').click()">${t('e_scan')}</button>
   </div>
   <div class="note">${t('e_scan_note')}</div>
  </div></div>
 <div class="fld"><label>${t('f_name')}</label><input type="text" id="ename" value="${esc(m.name)}" style="font-weight:900;font-size:19px;text-transform:uppercase"></div>
 <div class="fld" style="display:flex;gap:10px"><div style="flex:1"><label>${t('f_type')}</label><select id="etype">${typeOpts}</select></div>
 <div style="flex:1"><label>${t('f_qty')}</label><input type="text" id="eqty" value="${esc(m.qty||'')}"></div></div>
 <div class="fld"><label>${t('f_sub')}</label><input type="text" id="esub" value="${esc(medSub(m))}"></div>
 <div class="fld"><label>${t('f_warn')}</label><input type="text" id="ewarn" value="${esc(medWarn(m))}"></div>
 <div class="fld"><label>${t('f_wl')}</label><select id="ewlevel">
  <option value="info" ${m.warnLevel==='info'?'selected':''}>${t('wl_i')}</option>
  <option value="amber" ${m.warnLevel==='amber'?'selected':''}>${t('wl_a')}</option>
  <option value="red" ${m.warnLevel==='red'?'selected':''}>${t('wl_r')}</option></select></div>
 <div class="fld"><label>${t('f_days')}</label><div class="dayschk" id="edays">${days}</div></div>
 <button class="bigbtn green" onclick="saveMed()">${t('save')}</button>
 <button class="bigbtn gray" onclick="closeModal()">${t('cancel')}</button>`) }
async function saveMed(){ const name=document.getElementById('ename').value.trim().toUpperCase();
 if(!name){alert(t('name_req'));return}
 const ex=[...document.querySelectorAll('#edays label.on')].map(l=>Number(l.dataset.day));
 const old=(editId&&state.meds[editId])?state.meds[editId]:{};
 const subTyped=document.getElementById('esub').value.trim();
 const warnTyped=document.getElementById('ewarn').value.trim();
 const med={name,type:document.getElementById('etype').value,qty:document.getElementById('eqty').value.trim(),
  warnLevel:document.getElementById('ewlevel').value,excludeDays:ex};
 // keep translation keys if text untouched
 if(old.subKey&&subTyped===t(old.subKey))med.subKey=old.subKey; else med.sub=subTyped;
 if(old.warnKey&&warnTyped===t(old.warnKey))med.warnKey=old.warnKey; else med.warn=warnTyped;
 if(!med.warn&&!med.warnKey)med.warnLevel=undefined;
 if(String(editPhoto||'').startsWith('data:'))med.img=editPhoto; else med.img=old.img||null;
 const id=editId||('m'+Date.now());
 appendEvent(editId?'med_edited':'med_added',{med:name});
 state.meds[id]=med; await saveState(); closeModal(); renderSettings() }

/* photo helpers */
function fileToDataUrl(file,maxW){ return new Promise((res,rej)=>{ const r=new FileReader();
 r.onload=()=>{ const img=new Image(); img.onload=()=>{ const sc=Math.min(1,maxW/Math.max(img.width,img.height));
  const c=document.createElement('canvas'); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.82)) };
  img.onerror=rej; img.src=r.result };
 r.onerror=rej; r.readAsDataURL(file) }) }
document.getElementById('fileMedPhoto').addEventListener('change',async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f)return;
 editPhoto=await fileToDataUrl(f,420); document.getElementById('ephoto').innerHTML=`<img src="${editPhoto}">` });

/* ============ AI SCANNING ============ */
const LANGNAME={ru:'русском',en:'English',he:'עברית',uz:'oʻzbek (lotin)'};
function promptPack(){return `Это фото упаковки лекарства. Распознай его. Ответь ТОЛЬКО валидным JSON без markdown и пояснений:
{"name":"НАЗВАНИЕ ЗАГЛАВНЫМИ ЛАТИНИЦЕЙ","substance":"действующее вещество и дозировка","type":"tab|cap|syr|drop|inh|sup","note":"назначение, 2-4 слова"}
type: tab=таблетки, cap=капсулы, syr=сироп, drop=капли или раствор внутрь, inh=раствор для ингаляций (небулайзер), sup=свечи.
Поля substance и note напиши на языке: ${LANGNAME[lang]}.`}
function promptRx(){return `Это фото назначения врача или выписки (язык может быть русский, иврит или английский). Извлеки ВСЕ назначенные лекарства. Ответь ТОЛЬКО валидным JSON без markdown:
{"meds":[{"name":"НАЗВАНИЕ ЗАГЛАВНЫМИ ЛАТИНИЦЕЙ","substance":"вещество и доза","type":"tab|cap|syr|drop|inh|sup","qty":"количество на один приём","times":["08:00"],"note":"краткое примечание"}]}
Если указана только кратность без часов: 1 раз=["08:00"], 2 раза=["08:00","20:00"], 3 раза=["08:00","12:00","18:00"], 4 раза=["08:00","12:00","16:00","20:00"].
Поля qty, substance и note напиши на языке: ${LANGNAME[lang]}.`}
async function aiScan(dataUrl,prompt){ const key=((state&&state.aiKey)||'').trim();
 if(!key)throw new Error(t('ai_off'));
 const base64=dataUrl.split(',')[1];
 const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{
   'Content-Type':'application/json',
   'x-api-key':key,
   'anthropic-version':'2023-06-01',
   'anthropic-dangerous-direct-browser-access':'true'},
  body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1200,messages:[{role:'user',content:[
   {type:'image',source:{type:'base64',media_type:'image/jpeg',data:base64}},{type:'text',text:prompt}]}]})});
 if(!resp.ok){ let dm=''; try{const ej=await resp.json(); dm=(ej&&ej.error&&ej.error.message)||''}catch(e){} throw new Error('HTTP '+resp.status+(dm?': '+dm:'')); }
 const data=await resp.json();
 const text=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
 return JSON.parse(text.replace(/```json|```/g,'').trim()) }
document.getElementById('filePack').addEventListener('change',async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f)return;
 const big=await fileToDataUrl(f,900);
 const ph=document.getElementById('ephoto'); if(ph)ph.innerHTML='<div class="spin"></div>';
 try{ const r=await aiScan(big,promptPack());
  editPhoto=await fileToDataUrl(f,420);
  if(ph)ph.innerHTML=`<img src="${editPhoto}">`;
  if(r.name)document.getElementById('ename').value=r.name;
  if(r.type&&TYPES[r.type])document.getElementById('etype').value=r.type;
  const sub=[r.substance,r.note].filter(Boolean).join(' · '); if(sub)document.getElementById('esub').value=sub;
 }catch(err){ if(ph)ph.innerHTML=editPhoto?`<img src="${editPhoto}">`:t('no_photo');
  alert(t('pack_fail')+'\n'+(String(err).includes('Failed to fetch')?t('only_claude'):err)) } });
document.getElementById('fileRx').addEventListener('change',async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f)return;
 openModal(`<h3>${t('rx_scan')}</h3><div class="spin"></div><div class="note">${t('rx_wait')}</div>`);
 try{ const big=await fileToDataUrl(f,1100);
  const r=await aiScan(big,promptRx());
  if(!r.meds||!r.meds.length)throw new Error('no meds');
  let rows=''; r.meds.forEach((m,i)=>{ rows+=`<div class="prow"><input type="checkbox" id="rx${i}" checked>
   <div style="flex:1"><div style="font-weight:900;font-size:16px">${esc(m.name||'?')}</div>
   <div style="font-size:12.5px;color:var(--muted)">${esc(m.substance||'')} ${m.note?'· '+esc(m.note):''}</div>
   <div style="display:flex;gap:6px;margin-top:6px">
    <select id="rxt${i}" style="flex:1">${Object.keys(TYPES).map(k=>`<option value="${k}" ${m.type===k?'selected':''}>${tyLabel(k)}</option>`).join('')}</select>
    <input type="text" id="rxq${i}" value="${esc(m.qty||'')}" placeholder="${t('qty_ph')}" style="flex:1">
   </div>
   <input type="text" id="rxh${i}" value="${esc((m.times||[]).join(', '))}" placeholder="${t('times_ph')}" style="margin-top:6px"></div></div>` });
  window._rxMeds=r.meds;
  openModal(`<h3>${tf('rx_found',{n:r.meds.length})}</h3><div class="note">${t('rx_note')}</div>
   ${rows}<button class="bigbtn green" onclick="applyRx()">${t('rx_apply')}</button>
   <button class="bigbtn gray" onclick="closeModal()">${t('cancel')}</button>`);
 }catch(err){ openModal(`<h3>${t('rx_fail')}</h3><div class="note">${esc(String(err).includes('Failed to fetch')?t('only_claude'):String(err))}</div>
  <button class="bigbtn gray" onclick="closeModal()">${t('close')}</button>`) } });
async function applyRx(){ const meds=window._rxMeds||[];
 for(let i=0;i<meds.length;i++){ const chk=document.getElementById('rx'+i); if(!chk||!chk.checked)continue;
  const name=(meds[i].name||'').toUpperCase().trim(); if(!name)continue;
  let id=Object.keys(state.meds).find(k=>state.meds[k].name===name);
  const type=document.getElementById('rxt'+i).value, qty=document.getElementById('rxq'+i).value.trim();
  if(!id){ id='m'+Date.now()+'_'+i;
   state.meds[id]={name,type,qty,sub:[meds[i].substance,meds[i].note].filter(Boolean).join(' · '),img:null}; appendEvent('med_added',{med:name}) }
  else { state.meds[id].type=type; if(qty)state.meds[id].qty=qty; appendEvent('med_edited',{med:name}) }
  const times=(document.getElementById('rxh'+i).value||'').split(',').map(s=>s.trim()).filter(s=>/^\d{1,2}:\d{2}$/.test(s)).map(s=>s.padStart(5,'0'));
  for(const tm of times){ if(!state.times.includes(tm)){state.times.push(tm);state.schedule[tm]=[];appendEvent('time_added',{time:tm})}
   if(!(state.schedule[tm]||[]).includes(id))(state.schedule[tm]=state.schedule[tm]||[]).push(id) } }
 await saveState(); closeModal(); renderSettings() }

/* ============ DEVICE / SLOT-META / BOX-META ============ */
function deviceName(){ return ((state&&state.deviceName)||'').trim()||'?'; }
async function setSlotMeta(iso,time){ try{ const k='medapp:slotmeta:'+iso; const raw=await store.get(k); const o=raw?JSON.parse(raw):{}; o[time]={ts:Date.now(),by:deviceName()}; await store.set(k,JSON.stringify(o)); }catch(e){} }
async function getSlotMeta(iso){ try{ const raw=await store.get('medapp:slotmeta:'+iso); return raw?JSON.parse(raw):{}; }catch(e){ return {}; } }
async function getBoxMeta(){ try{ const raw=await store.get('medapp:boxmeta'); return raw?JSON.parse(raw):{}; }catch(e){ return {}; } }
async function boxTouch(key,emptied,iso){ await loadBox();
 if(emptied){ boxState[key]=iso||dateISO(); } else { delete boxState[key]; }
 try{ const bm=await getBoxMeta(); bm[key]={ts:Date.now(),by:deviceName(),empty:!!emptied,iso:emptied?(iso||dateISO()):null}; await store.set('medapp:boxmeta',JSON.stringify(bm)); }catch(e){}
 await saveBox(); }

/* ============ LIVE STATUS (build / apply) ============ */
async function buildLocalStatus(iso){
 const done=await getDone(iso); const gat=await getGivenAt(iso); const sm=await getSlotMeta(iso);
 const slots={}; const times=new Set([...done,...Object.keys(sm),...Object.keys(gat)]);
 times.forEach(tm=>{ slots[tm]={ given:done.includes(tm), at:gat[tm]||null, ts:(sm[tm]&&sm[tm].ts)||0, by:(sm[tm]&&sm[tm].by)||'' }; });
 await loadBox(); const bm=await getBoxMeta(); const box={};
 const cells=new Set([...Object.keys(boxState||{}),...Object.keys(bm)]);
 cells.forEach(k=>{ const empty=!!(boxState&&boxState[k]); box[k]={ empty:empty, iso:empty?boxState[k]:null, ts:(bm[k]&&bm[k].ts)||0, by:(bm[k]&&bm[k].by)||'' }; });
 return { date:iso, slots:slots, box:box, ts:Date.now() };
}
async function applyStatus(iso,merged){ merged=merged||{};
 if(merged.date===iso&&merged.slots){ const slots=merged.slots; const done=[]; const gat={}; const sm={};
  Object.keys(slots).forEach(tm=>{ const s=slots[tm]||{}; if(s.given){done.push(tm); if(s.at)gat[tm]=s.at;} if(s.ts)sm[tm]={ts:s.ts,by:s.by||''}; });
  doneCache[iso]=done;
  await store.set('medapp:done:'+iso,JSON.stringify(done));
  await store.set('medapp:givenat:'+iso,JSON.stringify(gat));
  await store.set('medapp:slotmeta:'+iso,JSON.stringify(sm)); }
 if(merged.box){ await loadBox(); const bm={};
  Object.keys(merged.box).forEach(k=>{ const c=merged.box[k]||{}; if(c.empty){ boxState[k]=c.iso||dateISO(); } else { delete boxState[k]; } bm[k]={ts:c.ts||0,by:c.by||'',empty:!!c.empty,iso:c.empty?(c.iso||null):null}; });
  await store.set('medapp:boxmeta',JSON.stringify(bm)); await saveBox(); }
}

/* ============ SYNC RUNNERS ============ */
let statusInFlight=false, configInFlight=false, logInFlight=false, statusPushTimer=null, logPushTimer=null, syncChain=Promise.resolve(), evCounter=0;
/* Единая очередь: конфиг, статус и журнал НИКОГДА не пишутся одновременно —
   иначе два коммита в одну ветку GitHub дают 409 (CONFLICT). Строго по очереди. */
function queueSync(doConfig, doStatus, doLogs){
 syncChain = syncChain.then(async function(){
  if(doConfig) await runConfigSync();
  if(doStatus) await runStatusSync();
  if(doLogs) await runLogSync();
 }).catch(function(){});
 return syncChain;
}
function pushStatusSoon(){ if(!MedSync.isOn(state))return; clearTimeout(statusPushTimer); statusPushTimer=setTimeout(function(){queueSync(false,true,false)},1200); }
function pushLogSoon(){ if(!MedSync.isOn(state))return; clearTimeout(logPushTimer); logPushTimer=setTimeout(function(){queueSync(false,false,true)},1200); }

/* ---- вечный журнал событий (локально + досылка на сервер) ---- */
function logKey(iso){ return 'medapp:log:'+iso; }
function getLog(iso){ try{ return JSON.parse(store.get(logKey(iso)))||[]; }catch(e){ return []; } }
function getLogDirty(){ try{ return JSON.parse(store.get('medapp:logdirty'))||[]; }catch(e){ return []; } }
function setLogDirty(arr){ store.set('medapp:logdirty', JSON.stringify(arr)); }
/* записать событие: всегда локально (досылается, когда появится сеть/синхронизация) */
function appendEvent(type, details){
 const ts=Date.now(); const iso=dateISO(new Date(ts));
 const ev=Object.assign({ id:deviceName()+'-'+ts+'-'+(evCounter++), ts:ts, type:type, by:deviceName() }, details||{});
 const arr=getLog(iso); arr.push(ev); store.set(logKey(iso), JSON.stringify(arr));
 const d=getLogDirty(); if(d.indexOf(iso)<0){ d.push(iso); setLogDirty(d); }
 pushLogSoon();
}
async function runLogSync(){ if(!MedSync.isOn(state)||logInFlight)return; logInFlight=true;
 try{ const remaining=[];
  for(const iso of getLogDirty().slice()){ const res=await MedSync.syncLog(state,store,iso,getLog(iso));
   if(res&&!res.error){ store.set(logKey(iso), JSON.stringify(res.merged)); } else { remaining.push(iso); } }
  setLogDirty(remaining);
 }catch(e){} logInFlight=false; updSyncUI(); }
async function runStatusSync(){ if(!MedSync.isOn(state)||statusInFlight)return; statusInFlight=true;
 try{ const iso=dateISO(); const local=await buildLocalStatus(iso);
  const res=await MedSync.syncStatus(state,store,local);
  if(res&&res.pulledNew){ await applyStatus(iso,res.merged);
   const cur=['home','collect'].find(s=>!document.getElementById('scr-'+s).hidden);
   if(cur==='home')renderHome(true); else if(cur==='collect')renderCollect();
   updLive(res.merged); }
 }catch(e){} statusInFlight=false; updSyncUI(); }
async function applyConfig(cloudState,generation){
 const keepSync=state.sync, keepAi=state.aiKey, keepDev=state.deviceName;
 state=cloudState;
 state.sync=keepSync; state.aiKey=keepAi; state.deviceName=keepDev;
 if(!(Number(state.statusPollSec)>0))state.statusPollSec=20;
 if(state.passwordHash===undefined)state.passwordHash=hash('1234');
 await saveState();
 store.setMeta('backupGeneration',generation);
 store.setMeta('lastBackupHash',MedSync.configHash(state)); // не пушим тут же обратно
 lang=(L[lang]?lang:'ru'); document.documentElement.dir=(lang==='he')?'rtl':'ltr'; applyChrome();
 const cur=['home','collect','settings'].find(s=>!document.getElementById('scr-'+s).hidden)||'home';
 if(cur==='home')renderHome(true); else if(cur==='collect')renderCollect(); else if(cur==='settings'&&setAuthed)renderSettings();
}
async function runConfigSync(){ if(!MedSync.isOn(state)||configInFlight)return; configInFlight=true;
 try{ const pulled=await MedSync.pullConfigIfNewer(state,store);
  if(pulled){ await applyConfig(pulled.state,pulled.generation); toast(t('cfg_updated')); }
  await MedSync.backupConfigIfChanged(state,store);
 }catch(e){} configInFlight=false; updSyncUI(); }
function syncTick(){ if(!MedSync.isOn(state))return; queueSync(true,true,true); }

/* ============ SYNC SETTINGS HANDLERS ============ */
async function saveSync(){ const repo=(document.getElementById('syncRepo')||{}).value||''; const tok=(document.getElementById('syncTok')||{}).value||'';
 state.sync.repo=repo.trim(); state.sync.token=tok.trim(); await saveState(); updSyncUI();
 if(MedSync.isOn(state)){ queueSync(true,true,true); } }
async function setSyncEnabled(on){ state.sync.enabled=!!on; await saveState(); updSyncUI();
 if(MedSync.isOn(state)){ queueSync(true,true,true); } }
async function saveDevice(v){ state.deviceName=(v||'').trim(); await saveState() }
async function saveAiKey(v){ state.aiKey=(v||'').trim(); await saveState() }
function syncStatusLine(){ if(!MedSync.isOn(state))return t('st_off'); const err=store.getMeta('lastSyncError'); return err?(t('st_err')+': '+err):t('st_synced'); }
function updSyncUI(){ const el=document.getElementById('syncStatus'); if(el)el.textContent=syncStatusLine() }
async function restoreFromArchive(){ if(!MedSync.isOn(state)){ alert(t('st_off')); return; }
 if(!confirm(t('sync_restore_q')))return;
 try{ const r=await MedSync.fetchConfig(state); await applyConfig(r.state,r.generation); alert(t('sync_restored')); }
 catch(e){ alert(t('sync_pull_fail')+': '+((e&&e.message)||e)); } }

/* ============ TOAST / LIVE BADGE / REFRESH ============ */
let toastTimer=null;
function toast(msg){ const el=document.getElementById('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3500) }
function updLive(merged){ const el=document.getElementById('livebadge'); if(!el)return;
 let last=null; const sl=(merged&&merged.slots)||{}; Object.keys(sl).forEach(k=>{ if(!last||((sl[k].ts||0)>(last.ts||0)))last=sl[k]; });
 const n=new Date(); const hhmmss=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');
 el.textContent=tf('live_upd',{t:hhmmss})+((last&&last.by)?(' · '+tf('live_by',{by:last.by})):'');
 el.style.display='block'; }
async function forceRefresh(){ if(!confirm(t('refresh_q')))return;
 try{ if('serviceWorker' in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); for(const r of regs)await r.unregister(); }
  if(window.caches){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(e){}
 location.reload(); }

/* ============ INIT ============ */
(async function(){ await loadState(); await loadBox(); await syncGivenFromBox();
 const lg=await store.get('medapp:lang'); if(lg&&L[lg])lang=lg;
 const sp=await store.get('medapp:sound'); soundOn=(sp===null||sp===undefined)?true:(sp==='1');
 document.documentElement.lang=lang; document.documentElement.dir=(lang==='he')?'rtl':'ltr';
 applyChrome(); updFS();
 (function(){ function unlock(){ if(soundOn)ensureAudio(); document.removeEventListener('pointerdown',unlock,true); document.removeEventListener('keydown',unlock,true); }
  document.addEventListener('pointerdown',unlock,true); document.addEventListener('keydown',unlock,true); })();
 tick(); setInterval(tick,1000);
 renderHome(); setInterval(checkReminders,5000);
 document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ checkReminders(); syncTick(); } });
 /* синхронизация с GitHub */
 if(MedSync.isOn(state)){ try{ await queueSync(true,true,true); }catch(e){} }
 setInterval(syncTick, Math.max(8,Number(state.statusPollSec)||20)*1000);
 if('serviceWorker' in navigator && location.protocol==='https:'){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
})();

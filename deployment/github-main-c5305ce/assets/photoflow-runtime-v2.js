(()=>{
'use strict';
const documentRoot=typeof document!=='undefined'?document.documentElement:null;
documentRoot?.classList.add('pf-booting');
window.setTimeout(()=>documentRoot?.classList.remove('pf-booting'),6000);
const SNAP='fotocrm:snapshot:v2';
const QUEUE='fotocrm:offline-queue:v1';
const CUSTOM='photoflow:smart-custom:v1';
const OVERRIDES='photoflow:smart-overrides:v1';
const VARS=['{имя}','{дата}','{время}','{место}','{срок_сдачи}','{остаток}','{стоимость}','{предоплата}','{оплата}'];
const DEFAULT_SMART={
  'Подтверждение':'Здравствуйте, {имя}! Подтверждаю нашу съёмку {дата} в {время}, {место}. Если планы изменятся, пожалуйста, напишите заранее.',
  'Я выезжаю':'Здравствуйте, {имя}! Я выезжаю на нашу съёмку. Буду ориентировочно к {время}. До встречи!',
  'После съёмки':'Спасибо за съёмку! Готовые фотографии пришлю до {срок_сдачи}. {оплата}'
};
const BASE_GEAR=['Основная камера','Запасная камера','Заряженные аккумуляторы','Чистые карты памяти','Вспышка и синхронизатор'];
const WEDDING_GEAR=['Два комплекта объективов','Пауэрбанк','Дождевик'];
const OTHER_GEAR=['Рефлектор','Салфетка для оптики'];
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const snap=()=>read(SNAP,{shoots:[],types:[]});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('ru-RU');
const fmtDate=iso=>{const d=new Date(iso||'');return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
const fmtTime=iso=>{const d=new Date(iso||'');return Number.isFinite(d.getTime())?d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):''};

const array=value=>Array.isArray(value)?value:[];
const numeric=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const queue=()=>array(read(QUEUE,[])).filter(item=>item?.action!=='deleteActiveShoots'&&item?.action!=='deleteAllShoots');
const queueWrite=items=>write(QUEUE,array(items));
const queueKey=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const validState=value=>!!value&&typeof value==='object'&&Array.isArray(value.clients)&&Array.isArray(value.shoots)&&Array.isArray(value.types);
function normalizeShoot(value={}){
  return {
    ...value,
    id:Number.isFinite(Number(value.id))?Number(value.id):-Date.now(),
    clientId:value.clientId==null?null:Number(value.clientId),clientName:String(value.clientName||'Без имени'),clientPhone:String(value.clientPhone||''),
    type:String(value.type||'Съёмка'),color:String(value.color||'#5267FF'),startAt:String(value.startAt||''),endAt:String(value.endAt||value.startAt||''),
    allDay:!!value.allDay,comment:String(value.comment||''),price:numeric(value.price),paymentType:String(value.paymentType||'advance'),paidAmount:numeric(value.paidAmount),
    deliveryDays:Math.max(1,numeric(value.deliveryDays,14)),delivered:!!value.delivered,archived:!!value.archived,status:String(value.status||'booked'),
    location:String(value.location||''),travelMinutes:numeric(value.travelMinutes),organizerName:String(value.organizerName||''),organizerPhone:String(value.organizerPhone||''),
    editingHours:numeric(value.editingHours),travelCost:numeric(value.travelCost),otherCosts:numeric(value.otherCosts),equipment:array(value.equipment),shotList:array(value.shotList),
    timeline:array(value.timeline),portalToken:String(value.portalToken||''),clientGuide:String(value.clientGuide||'')
  };
}
function normalizeState(value={},fallback={}){
  const source=value&&typeof value==='object'?value:{},base=fallback&&typeof fallback==='object'?fallback:{};
  return {
    ...base,...source,
    clients:array(source.clients??base.clients),
    shoots:array(source.shoots??base.shoots).map(normalizeShoot),
    types:array(source.types??base.types),
    reminders:array(source.reminders??base.reminders).length?array(source.reminders??base.reminders):[5,1,0],
    profile:source.profile&&typeof source.profile==='object'?source.profile:(base.profile&&typeof base.profile==='object'?base.profile:{})
  };
}
function arrivalTimeline(startAt){
  const dateValue=new Date(startAt||'');if(!Number.isFinite(dateValue.getTime()))return[];
  dateValue.setMinutes(dateValue.getMinutes()-20);
  return [{id:`arrival-${Date.now()}-${Math.random().toString(36).slice(2)}`,time:`${String(dateValue.getHours()).padStart(2,'0')}:${String(dateValue.getMinutes()).padStart(2,'0')}`,label:'Прибытие',done:false}];
}
function applyAction(source,action,data={},id){
  const state=normalizeState(source),shootId=Number(id);
  if(action==='createShoot'){
    const temp=Number.isFinite(Number(data.__offlineId))?Number(data.__offlineId):(Number.isFinite(shootId)?shootId:-Date.now());
    const clean={...data,id:temp};delete clean.__offlineId;const shoot=normalizeShoot(clean),index=state.shoots.findIndex(item=>Number(item.id)===temp);
    state.shoots=index>=0?state.shoots.map((item,i)=>i===index?shoot:item):[...state.shoots,shoot];
  }else if(action==='updateShoot'&&Number.isFinite(shootId))state.shoots=state.shoots.map(item=>Number(item.id)===shootId?normalizeShoot({...item,...data,id:item.id}):item);
  else if(action==='deleteShoot'&&Number.isFinite(shootId))state.shoots=state.shoots.filter(item=>Number(item.id)!==shootId);
  else if(action==='createClient'){
    const temp=Number.isFinite(Number(data.__offlineId))?Number(data.__offlineId):-Date.now(),clean={...data,id:temp};delete clean.__offlineId;
    state.clients=[...state.clients.filter(item=>Number(item.id)!==temp),clean];
  }else if(action==='savePreferences'){
    if(data.profile&&typeof data.profile==='object')state.profile=data.profile;
    if(Array.isArray(data.types))state.types=data.types;
    if(Array.isArray(data.reminders))state.reminders=data.reminders;
    if(data.deliveryReminder&&typeof data.deliveryReminder==='object')state.deliveryReminder=data.deliveryReminder;
  }
  return state;
}
function emitState(state,reason='local'){
  const normalized=normalizeState(state);write(SNAP,normalized);
  window.dispatchEvent(new CustomEvent('photoflow:state-changed',{detail:{state:normalized,reason}}));
  if((reason==='bootstrap'||reason==='server')&&documentRoot){
    requestAnimationFrame(()=>requestAnimationFrame(()=>documentRoot.classList.remove('pf-booting')));
  }
  return normalized;
}
function replay(source,items){let state=normalizeState(source);for(const item of array(items))state=applyAction(state,item.action,item.data,item.id);return state}
function beforeFor(state,action,id){
  const numericId=Number(id),index=state.shoots.findIndex(item=>Number(item.id)===numericId);
  if(action==='updateShoot'||action==='deleteShoot')return{shoot:index>=0?state.shoots[index]:null,index};
  if(action==='savePreferences')return{profile:state.profile,types:state.types,reminders:state.reminders,deliveryReminder:state.deliveryReminder};
  return null;
}
function rollbackItem(source,item){
  const state=normalizeState(source),before=item?.before;
  if(item?.action==='createShoot')return applyAction(state,'deleteShoot',{},Number(item?.data?.__offlineId));
  if(item?.action==='createClient'){state.clients=state.clients.filter(client=>Number(client.id)!==Number(item?.data?.__offlineId));return state}
  if((item?.action==='updateShoot'||item?.action==='deleteShoot')&&before?.shoot){
    const without=state.shoots.filter(shoot=>Number(shoot.id)!==Number(before.shoot.id)),at=Math.max(0,Math.min(numeric(before.index,without.length),without.length));
    without.splice(at,0,normalizeShoot(before.shoot));state.shoots=without;return state;
  }
  if(item?.action==='savePreferences'&&before){state.profile=before.profile;state.types=before.types;state.reminders=before.reminders;state.deliveryReminder=before.deliveryReminder;return state}
  return state;
}
function prepareQueue(action,data,id,state){
  let items=queue(),payload=data&&typeof data==='object'?{...data}:{},numericId=Number(id),focusKey='';
  if(action==='createShoot'){
    const temp=-Math.max(Date.now(),...state.shoots.filter(item=>Number(item.id)<0).map(item=>Math.abs(Number(item.id))+1),1);
    payload={...payload,timeline:arrivalTimeline(payload.startAt),__offlineId:temp};focusKey=queueKey('create');items.push({key:focusKey,action,data:payload,before:null});
    return{items,payload,id:temp,focusKey,localAction:'createShoot'};
  }
  if(action==='createClient'){
    const temp=-Math.max(Date.now(),...state.clients.filter(item=>Number(item.id)<0).map(item=>Math.abs(Number(item.id))+1),1);
    payload={...payload,__offlineId:temp};focusKey=queueKey('client');items.push({key:focusKey,action,data:payload,before:null});
    return{items,payload,id:temp,focusKey,localAction:'createClient'};
  }
  if(action==='updateShoot'&&numericId<0){
    const index=items.findIndex(item=>item?.action==='createShoot'&&Number(item?.data?.__offlineId)===numericId);
    if(index>=0){items=[...items];items[index]={...items[index],data:{...items[index].data,...payload,__offlineId:numericId}};return{items,payload,id:numericId,focusKey:items[index].key,localAction:action}}
  }
  if(action==='deleteShoot'&&numericId<0){
    items=items.filter(item=>!(item?.action==='createShoot'&&Number(item?.data?.__offlineId)===numericId)&&Number(item?.id)!==numericId);
    return{items,payload,id:numericId,focusKey:'',localAction:action,localOnly:true};
  }
  if(action==='updateShoot'&&Number.isFinite(numericId)){
    const index=items.findIndex(item=>item?.action==='updateShoot'&&Number(item?.id)===numericId);
    if(index>=0){items=[...items];items[index]={...items[index],data:{...(items[index].data||{}),...payload}};return{items,payload,id:numericId,focusKey:items[index].key,localAction:action}}
  }
  if(action==='deleteShoot'&&Number.isFinite(numericId))items=items.filter(item=>!(item?.action==='updateShoot'&&Number(item?.id)===numericId));
  if(action==='savePreferences'){
    const index=items.findIndex(item=>item?.action==='savePreferences');
    if(index>=0){items=[...items];items[index]={...items[index],data:{...(items[index].data||{}),...payload}};return{items,payload,id,focusKey:items[index].key,localAction:action}}
  }
  focusKey=queueKey(action);items.push({key:focusKey,action,data:payload,id:Number.isFinite(numericId)&&numericId>0?numericId:void 0,before:beforeFor(state,action,numericId)});
  return{items,payload,id:numericId,focusKey,localAction:action};
}
async function parseResponse(response){
  let body=null;try{body=await response.clone().json()}catch{}
  return{response,body,full:validState(body)?normalizeState(body):null,shoot:body?.shoot&&typeof body.shoot==='object'?body.shoot:null,client:body?.client&&typeof body.client==='object'?body.client:null};
}
async function fetchTimed(url,options={},timeout=5000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}
}
function retryable(response){return !response||response.status===404||response.status===405||response.status===408||response.status===429||response.status>=500}
let syncPromise=null;
async function syncQueue(){
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
    const failed=new Map();
    while(navigator.onLine){
      let items=queue();if(!items.length)break;const item=items[0];let parsed=null;
      try{
        const requestData={...(item.data||{})};delete requestData.__offlineId;
        const response=await fetchTimed('/api/crm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:item.action,data:requestData,id:item.id&&Number(item.id)>0?Number(item.id):void 0})});
        parsed=await parseResponse(response);
        if(!response.ok){
          if(retryable(response))break;
          const message=parsed.body?.error||'Сервер отклонил изменение';emitState(rollbackItem(snap(),item),'rollback');items=items.filter(entry=>entry.key!==item.key);queueWrite(items);failed.set(item.key,message);window.dispatchEvent(new CustomEvent('photoflow:sync-error',{detail:{message}}));continue;
        }
        const responseId=Number(parsed.body?.id),createdId=(item.action==='createShoot'||item.action==='createClient')&&Number.isFinite(responseId)&&responseId>0,
          validShoot=!!parsed.shoot&&(item.action!=='createShoot'||Number.isFinite(Number(parsed.shoot.id))&&Number(parsed.shoot.id)>0),
          validClient=!!parsed.client&&(item.action!=='createClient'||Number.isFinite(Number(parsed.client.id))&&Number(parsed.client.id)>0),
          acceptsBare=parsed.body?.ok===true&&item.action!=='createShoot'&&item.action!=='createClient';
        if(!parsed.full&&!validShoot&&!validClient&&!createdId&&!acceptsBare){
          const message='Сервер вернул некорректный ответ';emitState(rollbackItem(snap(),item),'rollback');items=items.filter(entry=>entry.key!==item.key);queueWrite(items);failed.set(item.key,message);window.dispatchEvent(new CustomEvent('photoflow:sync-error',{detail:{message}}));continue;
        }
      }catch{break}
      items=queue().filter(entry=>entry.key!==item.key);let state=parsed.full||normalizeState(snap()),serverShoot=null;
      if(item.action==='createShoot'){
        const temp=Number(item.data?.__offlineId);
        if(parsed.shoot)serverShoot=normalizeShoot({...item.data,...parsed.shoot});
        if(!serverShoot&&Number.isFinite(Number(parsed.body?.id))&&Number(parsed.body.id)>0)serverShoot=normalizeShoot({...item.data,id:Number(parsed.body.id)});
        if(!serverShoot&&parsed.full)serverShoot=parsed.full.shoots.find(shoot=>Number(shoot.id)>0&&shoot.clientName===item.data?.clientName&&shoot.startAt===item.data?.startAt&&shoot.type===item.data?.type)||null;
        if(serverShoot){
          if(!parsed.full)state.shoots=state.shoots.map(shoot=>Number(shoot.id)===temp?serverShoot:shoot);
          items=items.map(entry=>({...entry,id:Number(entry.id)===temp?serverShoot.id:entry.id,data:{...(entry.data||{}),__offlineId:Number(entry.data?.__offlineId)===temp?serverShoot.id:entry.data?.__offlineId}}));
        }
      }else if(item.action==='createClient'){
        const temp=Number(item.data?.__offlineId);let serverClient=parsed.client?{...item.data,...parsed.client}:null;
        if(!serverClient&&Number.isFinite(Number(parsed.body?.id))&&Number(parsed.body.id)>0)serverClient={...item.data,id:Number(parsed.body.id)};
        if(!serverClient&&parsed.full)serverClient=parsed.full.clients.find(client=>Number(client.id)>0&&client.name===item.data?.name&&String(client.phone||'')===String(item.data?.phone||''))||null;
        if(serverClient){
          if(!parsed.full)state.clients=state.clients.map(client=>Number(client.id)===temp?serverClient:client);
          state.shoots=state.shoots.map(shoot=>Number(shoot.clientId)===temp?{...shoot,clientId:Number(serverClient.id)}:shoot);
          items=items.map(entry=>({...entry,data:{...(entry.data||{}),clientId:Number(entry.data?.clientId)===temp?Number(serverClient.id):entry.data?.clientId}}));
        }
      }else if(item.action==='updateShoot'&&parsed.shoot&&!parsed.full)state.shoots=state.shoots.map(shoot=>Number(shoot.id)===Number(item.id)?normalizeShoot({...shoot,...parsed.shoot,id:shoot.id}):shoot);
      queueWrite(items);state=replay(state,items);emitState(state,'server');
    }
    return{failed,items:queue(),state:normalizeState(snap())};
  })().finally(()=>{syncPromise=null});
  return syncPromise;
}
async function mutate(action,data={},id){
  const state=normalizeState(snap()),prepared=prepareQueue(action,data,id,state),next=applyAction(state,prepared.localAction,prepared.payload,prepared.id);
  queueWrite(prepared.items);emitState(next,'optimistic');
  if(prepared.localOnly||!navigator.onLine)return{ok:true,queued:!prepared.localOnly,state:next};
  const pending=syncQueue(),confirmationWindow=action==='createShoot'||action==='createClient'?5200:650,
    quick=await Promise.race([pending.then(result=>({done:true,result})),new Promise(resolve=>setTimeout(()=>resolve({done:false}),confirmationWindow))]);
  if(!quick.done)return{ok:true,queued:true,state:next};
  const result=quick.result,error=result.failed.get(prepared.focusKey);
  return{ok:!error,queued:result.items.some(item=>item.key===prepared.focusKey),state:result.state,error};
}
async function bootstrap(fallback={}){
  queueWrite(queue());const stored=read(SNAP,null),initial=normalizeState(stored&&typeof stored==='object'?stored:fallback,fallback);emitState(replay(initial,queue()),'bootstrap');
  if(!navigator.onLine)return normalizeState(snap());
  await syncQueue();if(queue().length)return normalizeState(snap());
  try{
    const response=await fetchTimed('/api/crm',{headers:{accept:'application/json'}}),parsed=await parseResponse(response);
    if(response.ok&&parsed.full)return emitState(parsed.full,'server');
  }catch{}
  return normalizeState(snap());
}
window.PhotoFlowData={getState:()=>normalizeState(snap()),normalizeState,mutate,sync:syncQueue,bootstrap,validState};
function installVisualViewport(){
  const root=document.documentElement,viewport=window.visualViewport;
  if(!root)return;
  let frame=0;
  const update=()=>{
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const height=viewport?.height||window.innerHeight,top=viewport?.offsetTop||0,keyboard=Math.max(0,window.innerHeight-height-top);
      root.style.setProperty('--pf-viewport-height',`${Math.round(height)}px`);
      root.style.setProperty('--pf-viewport-top',`${Math.round(top)}px`);
      root.style.setProperty('--pf-keyboard-inset',`${Math.round(keyboard)}px`);
      const active=document.activeElement;
      if(keyboard>100&&active?.closest?.('.modal-form'))active.scrollIntoView({block:'center',inline:'nearest'});
    });
  };
  viewport?.addEventListener('resize',update,{passive:true});viewport?.addEventListener('scroll',update,{passive:true});window.addEventListener('orientationchange',update,{passive:true});
  document.addEventListener('focusin',event=>{if(event.target?.closest?.('.modal-form'))setTimeout(update,80)},{passive:true});
  document.addEventListener('focusout',event=>{if(event.target?.closest?.('.modal-form'))setTimeout(update,120)},{passive:true});
  update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installVisualViewport,{once:true});else installVisualViewport();
function currentShoot(){
  const state=snap(),mode=document.querySelector('.day-mode');
  if(!mode)return null;
  const shoots=Array.isArray(state.shoots)?state.shoots:[];
  const id=Number(mode.dataset.shootId);
  if(Number.isFinite(id)){const exact=shoots.find(s=>Number(s.id)===id);if(exact)return exact}
  const hero=mode.querySelector('.day-hero,.shoot-day-hero')||mode;
  const text=hero.textContent||'';
  const name=(hero.querySelector('h1,h2,h3')?.textContent||'').trim();
  const date=text.match(/\d{2}\.\d{2}\.\d{4}/)?.[0]||'';
  return shoots.find(s=>String(s.clientName||'').trim()===name&&(!date||fmtDate(s.startAt)===date))
    ||shoots.find(s=>date&&fmtDate(s.startAt)===date)
    ||shoots.find(s=>String(s.clientName||'').trim()===name)
    ||null;
}
function renderTemplate(template,shoot){
  if(!shoot)return String(template||'');
  const state=snap(),start=new Date(shoot.startAt||'');
  const days=Number(shoot.deliveryDays||state.types?.find(t=>String(t.name)===String(shoot.type))?.deliveryDays||14);
  const due=Number.isFinite(start.getTime())?new Date(start.getFullYear(),start.getMonth(),start.getDate()+days):null;
  const left=Math.max(0,Number(shoot.price||0)-Number(shoot.paidAmount||0));
  const vars={
    '{имя}':String(shoot.clientName||'клиент'),'{дата}':fmtDate(shoot.startAt),'{время}':fmtTime(shoot.startAt),'{место}':String(shoot.location||''),
    '{срок_сдачи}':due?due.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):'',
    '{остаток}':money(left),'{стоимость}':money(shoot.price||0),'{предоплата}':money(shoot.paidAmount||0),
    '{оплата}':left>0?`Остаток к оплате — ${money(left)} ₽.`:'Оплата закрыта полностью.'
  };
  let out=String(template||'');
  for(const [k,v] of Object.entries(vars))out=out.split(k).join(v);
  return out.replace(/\s+([.,!?])/g,'$1').replace(/\s{2,}/g,' ').trim();
}
async function saveShoot(shoot,data){
  if(!shoot)return false;
  const result=await window.PhotoFlowData.mutate('updateShoot',data,shoot.id);
  return !!result.ok;
}
function ensureStyle(){
  if(document.getElementById('pf-runtime-v2-style'))return;
  const s=document.createElement('style');s.id='pf-runtime-v2-style';s.textContent=`
  .pf-edit-shell,.pf-pay-shell{position:relative!important;overflow:hidden!important;border-radius:18px!important;background:#fff!important}
  .pf-edit-row,.pf-pay-row{position:relative!important;z-index:2!important;background:#fff!important;transition:transform .2s cubic-bezier(.2,.8,.2,1)!important;touch-action:pan-y!important;will-change:transform}
  .pf-edit-actions{position:absolute!important;right:0!important;top:0!important;bottom:0!important;width:150px!important;display:grid!important;grid-template-columns:75px 75px!important;pointer-events:none!important;overflow:hidden!important}
  .pf-edit-shell.pf-open .pf-edit-actions{pointer-events:auto!important}
  .pf-edit-action{border:0!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:0!important;font-size:11px!important;font-weight:700!important;white-space:nowrap!important}
  .pf-edit-action.edit{background:#e5e9ff!important;color:#5065d9!important}.pf-edit-action.delete{background:#f8deda!important;color:#b85b54!important}
  .pf-pay-action{position:absolute!important;right:0!important;top:0!important;bottom:0!important;width:118px!important;border:0!important;background:#e3f3ec!important;color:#3a806c!important;font-weight:700!important;pointer-events:none!important}
  .pf-pay-shell.pf-open .pf-pay-action{pointer-events:auto!important}
  .pf-owned-editor{display:grid!important;gap:0!important}.pf-owned-row{width:100%!important;min-height:66px!important;border:0!important;background:#fff!important;color:#17191f!important;display:grid!important;align-items:center!important;text-align:left!important;padding:12px 18px 12px 0!important}
  .pf-owned-row.timeline{grid-template-columns:86px 22px minmax(0,1fr)!important;gap:10px!important}.pf-owned-row time{color:#5267ff!important;font-size:16px!important;text-align:center!important}.pf-dot{width:12px;height:12px;border:3px solid #5267ff;border-radius:50%}.pf-owned-row.done{opacity:.58}.pf-owned-row.done .pf-dot{background:#5267ff}.pf-owned-row.done .pf-label{text-decoration:line-through}
  .pf-add-box{display:grid!important;gap:9px!important;margin:0!important;padding:12px 28px 16px!important;position:relative!important;z-index:10!important;background:transparent!important}.pf-add-fields{display:flex!important;gap:10px!important;width:100%!important}.pf-add-fields input{height:48px!important;border:1px solid #dfe3eb!important;border-radius:13px!important;background:#fff!important;color:#17191f!important;font-size:16px!important;box-sizing:border-box!important;position:relative!important;z-index:11!important;pointer-events:auto!important}.pf-add-fields .pf-time{flex:0 0 96px!important;width:96px!important;min-width:96px!important;padding:0 8px!important;text-align:center!important;-webkit-appearance:auto!important;appearance:auto!important;color-scheme:light!important}.pf-add-fields .pf-label-input{flex:1 1 auto!important;min-width:0!important;padding:0 14px!important}.pf-add-btn{height:48px!important;border:0!important;border-radius:13px!important;background:#eef0ff!important;color:#5267ff!important;font-size:16px!important;font-weight:700!important}.pf-edit-cancel{display:none!important;height:40px!important;border:0!important;background:transparent!important;color:#7f8795!important;text-align:left!important;padding-left:0!important}.pf-add-box.pf-editing .pf-edit-cancel{display:block!important}.pf-add-box.pf-editing .pf-add-btn{background:#5267ff!important;color:#fff!important}
  .pf-tech-panel{display:grid!important;gap:0!important}.pf-tech-progress{display:flex;align-items:center;gap:12px;padding:8px 16px 14px;color:#7f8795}.pf-tech-progress i{height:4px;flex:1;background:#eef0f4;border-radius:99px;overflow:hidden}.pf-tech-progress b{display:block;height:100%;background:#5267ff;border-radius:99px}.pf-tech-row{grid-template-columns:66px minmax(0,1fr)!important}.pf-tech-check{width:28px;height:28px;margin-left:24px;border:1.5px solid #d4d8e2;border-radius:9px;display:grid;place-items:center}.pf-owned-row.done .pf-tech-check{background:#5267ff;color:#fff}.pf-tech-add{display:grid!important;gap:9px!important;padding:12px 28px 16px!important}.pf-tech-add input{height:48px;border:1px solid #dfe3eb;border-radius:13px;padding:0 14px;font-size:16px}.pf-tech-add button{height:48px;border:0;border-radius:13px;background:#eef0ff;color:#5267ff;font-weight:700;font-size:16px}.pf-tech-add .pf-edit-cancel{height:40px;background:transparent;color:#7f8795;text-align:left}.pf-tech-add.pf-editing .pf-edit-cancel{display:block!important}.pf-tech-add.pf-editing .pf-tech-save{background:#5267ff;color:#fff}
  .pf-smart-plus{border:0!important;background:transparent!important;color:#5267ff!important;font-size:32px!important;line-height:1!important;min-width:38px!important;min-height:38px!important}.pf-smart-modal-bg{position:fixed;inset:0;z-index:999999;background:rgba(17,19,26,.28);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center}.pf-smart-modal{width:min(100%,680px);max-height:84dvh;overflow:auto;background:#fffdf9;border-radius:26px 26px 0 0;padding:22px 22px calc(22px + env(safe-area-inset-bottom));box-sizing:border-box}.pf-smart-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.pf-smart-head h3{margin:0;font-size:23px}.pf-smart-close{width:42px;height:42px;border:0;border-radius:50%;background:#f3f4f6;color:#7b8290;font-size:27px}.pf-smart-modal label{display:block;margin-bottom:14px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#858d9a}.pf-smart-modal input,.pf-smart-modal textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #dfe3ea;border-radius:15px;background:#fff;padding:13px 14px;font-size:16px;color:#17191f}.pf-smart-modal textarea{min-height:145px;resize:vertical}.pf-smart-vars{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 16px}.pf-smart-var{border:0;background:#eef0ff;color:#5267ff;border-radius:999px;padding:8px 10px;font-size:13px;font-weight:650}.pf-smart-save{width:100%;height:50px;border:0;border-radius:15px;background:#5267ff;color:#fff;font-size:16px;font-weight:700}.pf-smart-delete{width:100%;height:46px;margin-top:10px;border:1px solid #f0c9c5;border-radius:15px;background:#fff7f6;color:#b85b54;font-size:15px}.pf-smart-hint{font-size:12px;color:#9299a6;margin:0 0 8px}
  @media(max-width:480px){.pf-add-fields .pf-time{flex-basis:92px!important;width:92px!important;min-width:92px!important}.pf-edit-action{font-size:10.5px!important}}
  `;document.head.appendChild(s);
}
function installSwipe(row,reveal,onOpen){
  let sx=0,sy=0,dx=0,active=false,open=false,moved=false;
  row.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=open?-reveal:0;active=true;moved=false},{passive:true});
  row.addEventListener('touchmove',e=>{if(!active)return;const x=e.touches[0].clientX-sx,y=e.touches[0].clientY-sy;if(Math.abs(y)>Math.abs(x)&&Math.abs(y)>8){active=false;return}if(Math.abs(x)>8)moved=true;dx=Math.max(-reveal,Math.min(0,x+(open?-reveal:0)));row.style.transform=`translateX(${dx}px)`},{passive:true});
  row.addEventListener('touchend',()=>{if(!active)return;active=false;open=Math.abs(dx)>=55;row.style.transform=open?`translateX(-${reveal}px)`:'translateX(0)';if(moved)row.dataset.pfSwipeAt=String(Date.now());onOpen?.(open)}, {passive:true});
  return()=>Date.now()-Number(row.dataset.pfSwipeAt||0)<350;
}
function wrapEdit(row,onEdit,onDelete){
  const shell=document.createElement('div');shell.className='pf-edit-shell';row.parentNode.insertBefore(shell,row);shell.appendChild(row);row.classList.add('pf-edit-row');
  const actions=document.createElement('div');actions.className='pf-edit-actions';actions.innerHTML='<button type="button" class="pf-edit-action edit">Изменить</button><button type="button" class="pf-edit-action delete">Удалить</button>';shell.insertBefore(actions,row);
  const swiped=installSwipe(row,150,open=>shell.classList.toggle('pf-open',open));
  actions.querySelector('.edit').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();onEdit();shell.classList.remove('pf-open');row.style.transform='translateX(0)'});
  actions.querySelector('.delete').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();onDelete()});
  return swiped;
}
function hintEditSwipe(row,key,index){
  if(index!==0)return;try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1')}catch{}
  setTimeout(()=>{if(row.isConnected)row.classList.add('pf-swipe-hint')},180);
  setTimeout(()=>row.classList.remove('pf-swipe-hint'),1150);
}
function renderTimeline(container){
  const shoot=currentShoot();if(!shoot||!container)return;
  const fresh=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||shoot;
  const items=Array.isArray(fresh.timeline)?fresh.timeline:[];
  container.dataset.pfRuntime='timeline';container.classList.add('pf-owned-editor');
  container.innerHTML=`${items.map(i=>`<button type="button" class="pf-owned-row timeline ${i.done?'done':''}" data-id="${esc(i.id)}"><time>${esc(i.time||'')}</time><span class="pf-dot"></span><span class="pf-label">${esc(i.label||'')}</span></button>`).join('')}<div class="pf-add-box"><div class="pf-add-fields"><input class="pf-time" type="time" value="10:00" aria-label="Время этапа"><input class="pf-label-input" type="text" placeholder="Название этапа" aria-label="Название этапа"></div><button type="button" class="pf-add-btn">+ Добавить этап</button><button type="button" class="pf-edit-cancel">Отменить редактирование</button></div>`;
  const box=container.querySelector('.pf-add-box'),time=container.querySelector('.pf-time'),label=container.querySelector('.pf-label-input'),add=container.querySelector('.pf-add-btn'),cancel=container.querySelector('.pf-edit-cancel');
  container.querySelectorAll('.pf-owned-row').forEach((row,index)=>{
    const id=row.dataset.id;
    const swiped=wrapEdit(row,()=>{
      const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,it=(cur.timeline||[]).find(x=>String(x.id)===String(id));if(!it)return;
      box.dataset.editId=String(id);box.classList.add('pf-editing');time.value=it.time||'10:00';label.value=it.label||'';add.textContent='Сохранить изменения';setTimeout(()=>label.focus({preventScroll:true}),0);
    },async()=>{
      const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,next=(cur.timeline||[]).filter(x=>String(x.id)!==String(id));if(await saveShoot(cur,{timeline:next}))renderTimeline(container);
    });
    hintEditSwipe(row,'photoflow:timeline-swipe-hint:v1',index);
    row.addEventListener('click',async e=>{if(swiped())return;const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,next=(cur.timeline||[]).map(x=>String(x.id)===String(id)?{...x,done:!x.done}:x);if(await saveShoot(cur,{timeline:next}))renderTimeline(container)});
  });
  add.addEventListener('click',async()=>{
    const value=label.value.trim();if(!value){label.focus();return}
    const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,editId=box.dataset.editId||'';
    const next=editId?(cur.timeline||[]).map(x=>String(x.id)===editId?{...x,time:time.value||'10:00',label:value}:x):[...(cur.timeline||[]),{id:`tl-${Date.now()}`,time:time.value||'10:00',label:value,done:false}];
    add.disabled=true;if(await saveShoot(cur,{timeline:next}))renderTimeline(container);else add.disabled=false;
  });
  cancel.addEventListener('click',()=>renderTimeline(container));
}
function defaultGear(shoot){return [...BASE_GEAR,...(shoot?.type==='Свадьба'?WEDDING_GEAR:OTHER_GEAR)].map((label,i)=>({id:`eq-${Date.now()}-${i}`,label,done:false}))}
async function renderTech(){
  const mode=document.querySelector('.day-mode'),shoot=currentShoot();if(!mode||!shoot)return;
  let fresh=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||shoot;
  if(!Array.isArray(fresh.equipment)){const equipment=defaultGear(fresh);await saveShoot(fresh,{equipment});fresh={...fresh,equipment}}
  const items=Array.isArray(fresh.equipment)?fresh.equipment:[];
  let panel=mode.querySelector('.pf-tech-panel');if(!panel){panel=document.createElement('div');panel.className='pf-tech-panel';mode.querySelector('.day-tabs')?.insertAdjacentElement('afterend',panel)}
  mode.querySelectorAll('.day-timeline,.day-checklist').forEach(el=>{el.hidden=true;el.style.display='none'});panel.hidden=false;panel.style.display='grid';
  const done=items.filter(x=>x.done).length;
  panel.innerHTML=`<div class="pf-tech-progress"><span>${done} из ${items.length}</span><i><b style="width:${items.length?done/items.length*100:0}%"></b></i></div>${items.map(i=>`<button type="button" class="pf-owned-row pf-tech-row ${i.done?'done':''}" data-id="${esc(i.id)}"><span class="pf-tech-check">${i.done?'✓':''}</span><span class="pf-label">${esc(i.label||'')}</span></button>`).join('')}<div class="pf-tech-add"><input class="pf-tech-input" type="text" placeholder="Техника или аксессуар"><button type="button" class="pf-tech-save">+ Добавить</button><button type="button" class="pf-edit-cancel">Отменить редактирование</button></div>`;
  const addBox=panel.querySelector('.pf-tech-add'),input=panel.querySelector('.pf-tech-input'),save=panel.querySelector('.pf-tech-save'),cancel=panel.querySelector('.pf-edit-cancel');
  panel.querySelectorAll('.pf-tech-row').forEach((row,index)=>{
    const id=row.dataset.id;
    const swiped=wrapEdit(row,()=>{const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,it=(cur.equipment||[]).find(x=>String(x.id)===String(id));if(!it)return;addBox.dataset.editId=String(id);addBox.classList.add('pf-editing');input.value=it.label||'';save.textContent='Сохранить изменения';setTimeout(()=>input.focus({preventScroll:true}),0)},async()=>{const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,next=(cur.equipment||[]).filter(x=>String(x.id)!==String(id));if(await saveShoot(cur,{equipment:next}))renderTech()});
    hintEditSwipe(row,'photoflow:equipment-swipe-hint:v1',index);
    row.addEventListener('click',async()=>{if(swiped())return;const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,next=(cur.equipment||[]).map(x=>String(x.id)===String(id)?{...x,done:!x.done}:x);if(await saveShoot(cur,{equipment:next}))renderTech()});
  });
  save.addEventListener('click',async()=>{const value=input.value.trim();if(!value){input.focus();return}const cur=snap().shoots?.find(s=>Number(s.id)===Number(shoot.id))||fresh,editId=addBox.dataset.editId||'',next=editId?(cur.equipment||[]).map(x=>String(x.id)===editId?{...x,label:value}:x):[...(cur.equipment||[]),{id:`eq-${Date.now()}`,label:value,done:false}];save.disabled=true;if(await saveShoot(cur,{equipment:next}))renderTech();else save.disabled=false});
  cancel.addEventListener('click',()=>renderTech());
}
function showTab(kind){
  const mode=document.querySelector('.day-mode');if(!mode)return;const tabs=[...mode.querySelectorAll('.day-tabs button')],timing=tabs.find(b=>(b.textContent||'').trim()==='Тайминг'),tech=tabs.find(b=>(b.textContent||'').trim()==='Техника');
  const techOn=kind==='tech';timing?.classList.toggle('active',!techOn);tech?.classList.toggle('active',techOn);
  const timeline=mode.querySelector('.day-timeline'),native=mode.querySelector('.day-checklist'),panel=mode.querySelector('.pf-tech-panel');
  if(native){native.hidden=true;native.style.display='none'}
  if(techOn){if(timeline){timeline.hidden=true;timeline.style.display='none'}renderTech()}
  else{if(panel){panel.hidden=true;panel.style.display='none'}if(timeline){timeline.hidden=false;timeline.style.display='';if(timeline.dataset.pfRuntime!=='timeline')renderTimeline(timeline)}}
}
function closeSmart(){document.querySelector('.pf-smart-modal-bg')?.remove()}
function openSmartModal(item){
  closeSmart();const isCustom=item?.kind==='custom',isBuiltin=item?.kind==='builtin';
  const bg=document.createElement('div');bg.className='pf-smart-modal-bg';
  bg.innerHTML=`<section class="pf-smart-modal"><div class="pf-smart-head"><h3>${item?'Редактировать сообщение':'Новое умное сообщение'}</h3><button type="button" class="pf-smart-close">×</button></div><label>Название<input class="pf-smart-title" ${isBuiltin?'readonly':''} placeholder="Например, Напоминание"></label><label>Текст<textarea class="pf-smart-text" placeholder="Введите текст сообщения"></textarea></label><p class="pf-smart-hint">Можно использовать:</p><div class="pf-smart-vars"></div><button type="button" class="pf-smart-save">${item?'Сохранить изменения':'Добавить сообщение'}</button>${isCustom?'<button type="button" class="pf-smart-delete">Удалить сообщение</button>':''}</section>`;
  document.body.appendChild(bg);const title=bg.querySelector('.pf-smart-title'),text=bg.querySelector('.pf-smart-text'),vars=bg.querySelector('.pf-smart-vars');title.value=item?.title||'';text.value=item?.template||'';
  let caret=text.value.length;const remember=()=>{caret=typeof text.selectionStart==='number'?text.selectionStart:text.value.length};['input','click','keyup','focus'].forEach(ev=>text.addEventListener(ev,remember));
  VARS.forEach(token=>{const b=document.createElement('button');b.type='button';b.className='pf-smart-var';b.textContent=token;b.addEventListener('pointerdown',e=>{e.preventDefault();remember()});b.addEventListener('click',()=>{const start=Math.max(0,Math.min(caret,text.value.length)),end=document.activeElement===text&&typeof text.selectionEnd==='number'?text.selectionEnd:start;text.setRangeText(token,start,end,'end');caret=start+token.length;text.focus({preventScroll:true});text.setSelectionRange(caret,caret)});vars.appendChild(b)});
  bg.querySelector('.pf-smart-close').onclick=closeSmart;bg.addEventListener('click',e=>{if(e.target===bg)closeSmart()});
  bg.querySelector('.pf-smart-save').onclick=()=>{
    const newTitle=title.value.trim(),template=text.value.trim();if(!newTitle||!template)return;
    if(isBuiltin){const o=read(OVERRIDES,{});o[item.title]=template;write(OVERRIDES,o)}
    else{const all=read(CUSTOM,[]);if(isCustom){const idx=all.findIndex(x=>String(x.id)===String(item.id));if(idx>=0)all[idx]={...all[idx],title:newTitle,text:template}}else all.push({id:`sm-${Date.now()}`,title:newTitle,text:template});write(CUSTOM,all)}
    closeSmart();window.dispatchEvent(new CustomEvent('photoflow:smart-changed'));patchSmart();
  };
  bg.querySelector('.pf-smart-delete')?.addEventListener('click',()=>{if(!isCustom)return;const all=read(CUSTOM,[]).filter(x=>String(x.id)!==String(item.id));write(CUSTOM,all);closeSmart();window.dispatchEvent(new CustomEvent('photoflow:smart-changed'));patchSmart()});
}
function sendText(text){if(navigator.share)return navigator.share({text}).catch(()=>{});if(navigator.clipboard)return navigator.clipboard.writeText(text).catch(()=>{})}
function articleTitle(article){return (article.querySelector('h1,h2,h3,strong')?.textContent||'').trim()}
function patchSmart(){
  const section=document.querySelector('.smart-messages');if(!section)return;const shoot=currentShoot(),overrides=read(OVERRIDES,{}),custom=read(CUSTOM,[]),heading=section.querySelector('.section-heading');
  if(heading&&!heading.querySelector('.pf-smart-plus')){heading.querySelector('small')?.remove();const plus=document.createElement('button');plus.type='button';plus.className='pf-smart-plus';plus.textContent='+';plus.setAttribute('aria-label','Добавить умное сообщение');plus.onclick=()=>openSmartModal(null);heading.appendChild(plus)}
  section.querySelectorAll('[data-pf-custom="1"]').forEach(el=>el.remove());
  section.querySelectorAll('article:not([data-pf-custom="1"])').forEach(article=>{
    const title=articleTitle(article);if(!title||!DEFAULT_SMART[title])return;const template=overrides[title]||DEFAULT_SMART[title];const p=article.querySelector('p');if(p)p.textContent=renderTemplate(template,shoot);let actions=article.querySelector('p+div')||article.querySelector('div');if(!actions){actions=document.createElement('div');article.appendChild(actions)}actions.innerHTML='<button type="button">Редактировать</button><button type="button">Отправить</button>';const buttons=[...actions.querySelectorAll('button')];buttons[0].onclick=e=>{e.preventDefault();e.stopPropagation();openSmartModal({kind:'builtin',title,template})};buttons[1].onclick=e=>{e.preventDefault();e.stopPropagation();sendText(renderTemplate(template,shoot))}
  });
  custom.forEach(item=>{const a=document.createElement('article');a.dataset.pfCustom='1';a.innerHTML='<strong></strong><p></p><div><button type="button">Редактировать</button><button type="button">Отправить</button></div>';a.querySelector('strong').textContent=item.title;a.querySelector('p').textContent=renderTemplate(item.text,shoot);const [edit,send]=a.querySelectorAll('button');edit.onclick=()=>openSmartModal({kind:'custom',id:item.id,title:item.title,template:item.text});send.onclick=()=>sendText(renderTemplate(item.text,shoot));section.appendChild(a)});
}
window.PhotoFlowSmart={
  create:()=>openSmartModal(null),
  editBuiltin:title=>openSmartModal({kind:'builtin',title,template:read(OVERRIDES,{})[title]||DEFAULT_SMART[title]||''}),
  render:(title,shoot)=>renderTemplate(read(OVERRIDES,{})[title]||DEFAULT_SMART[title]||'',shoot),
  sendBuiltin:(title,renderedText)=>sendText(renderedText||renderTemplate(read(OVERRIDES,{})[title]||DEFAULT_SMART[title]||'',currentShoot()))
};
function patchEditors(){const mode=document.querySelector('.day-mode');if(!mode)return;const timeline=mode.querySelector('.day-timeline');if(timeline&&timeline.dataset.pfRuntime!=='timeline')renderTimeline(timeline);const active=[...mode.querySelectorAll('.day-tabs button')].find(b=>b.classList.contains('active'))?.textContent?.trim();if(active==='Техника')renderTech()}
function patch(){ensureStyle();patchEditors();patchSmart()}
let timer=0;function schedule(delay=30){clearTimeout(timer);timer=setTimeout(()=>requestAnimationFrame(patch),delay)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(0),{once:true});else schedule(0);
window.addEventListener('pageshow',()=>schedule(0));
window.addEventListener('photoflow:state-changed',()=>schedule(0));
window.addEventListener('photoflow:shoot-opened',()=>schedule(0));
window.addEventListener('photoflow:shoot-tab',event=>showTab(event.detail?.tab==='gear'?'tech':'timeline'));
})();

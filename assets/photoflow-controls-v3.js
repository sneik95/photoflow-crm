(()=>{
'use strict';
const SNAPSHOT_KEY='fotocrm:snapshot:v2';
const DEFAULT_BASE=['Основная камера','Запасная камера','Заряженные аккумуляторы','Чистые карты памяти','Вспышка и синхронизатор'];
const DEFAULT_WEDDING=['Два комплекта объективов','Пауэрбанк','Дождевик'];
const DEFAULT_OTHER=['Рефлектор','Салфетка для оптики'];
const readSnap=()=>{try{return JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'{}')}catch{return{}}};
const writeSnap=s=>{try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(s))}catch{}};
const fmtDate=iso=>{const d=new Date(iso||'');return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
function mode(){return document.querySelector('.day-mode')}
function reactHandler(el){
  if(!el)return null;
  const keys=Object.keys(el);
  const propsKey=keys.find(k=>k.startsWith('__reactProps$'));
  if(propsKey&&typeof el[propsKey]?.onClick==='function')return el[propsKey].onClick;
  let fiberKey=keys.find(k=>k.startsWith('__reactFiber$'));
  let fiber=fiberKey?el[fiberKey]:null;
  for(let i=0;fiber&&i<8;i++,fiber=fiber.return){
    if(typeof fiber.memoizedProps?.onClick==='function')return fiber.memoizedProps.onClick;
    if(typeof fiber.pendingProps?.onClick==='function')return fiber.pendingProps.onClick;
  }
  return null;
}
function invokeReact(el){
  const fn=reactHandler(el); if(typeof fn!=='function')return false;
  try{fn({currentTarget:el,target:el,preventDefault(){},stopPropagation(){},nativeEvent:{type:'pointerup'}});return true}catch{return false}
}
function getShoot(){
  const m=mode(); if(!m)return null;
  const hero=m.querySelector('.day-hero');
  const name=(hero?.querySelector('h2')?.textContent||'').trim();
  const date=(hero?.textContent||'').match(/\d{2}\.\d{2}\.\d{4}/)?.[0];
  const snap=readSnap(),shoots=snap.shoots||[];
  return shoots.find(s=>String(s.clientName||'').trim()===name&&(!date||fmtDate(s.startAt)===date))||shoots.find(s=>String(s.clientName||'').trim()===name)||null;
}
function defaultsFor(shoot){
  const labels=[...DEFAULT_BASE,...(shoot?.type==='Свадьба'?DEFAULT_WEDDING:DEFAULT_OTHER)];
  return labels.map((label,i)=>({id:`pf-default-${i}-${label.toLowerCase().replace(/\s+/g,'-')}`,label,done:false}));
}
async function ensureEquipmentData(){
  const shoot=getShoot(); if(!shoot)return null;
  if(Array.isArray(shoot.equipment)&&shoot.equipment.length)return shoot;
  const equipment=defaultsFor(shoot),snap=readSnap();
  snap.shoots=(snap.shoots||[]).map(s=>Number(s.id)===Number(shoot.id)?{...s,equipment}:s);
  writeSnap(snap);
  try{await fetch('/api/crm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'updateShoot',id:shoot.id,data:{equipment}})})}catch{}
  return {...shoot,equipment};
}
async function wakeGear(){
  const m=mode(); if(!m)return;
  const gear=[...m.querySelectorAll('.day-tabs button')].find(b=>(b.textContent||'').trim()==='Техника');
  if(!gear?.classList.contains('active'))return;
  await ensureEquipmentData();
  const list=m.querySelector('.day-checklist');
  if(list){
    list.removeAttribute('data-pf-owned');
    list.dataset.pfRefresh=String(Date.now());
  }
}
function isCloseButton(target){
  const btn=target?.closest?.('button'); if(!btn)return null;
  const m=mode(); if(!m)return null;
  const modal=m.closest('.modal');
  return modal&&btn===modal.querySelector('header button[aria-label="Закрыть"]')?btn:null;
}
function isModeTab(target){
  const btn=target?.closest?.('.day-tabs button');
  return btn&&mode()?.contains(btn)?btn:null;
}
let handling=false;
function handlePointer(e){
  if(handling)return;
  const close=isCloseButton(e.target),tab=isModeTab(e.target);
  if(!close&&!tab)return;
  handling=true;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation?.();
  const el=close||tab;
  const label=(el.textContent||'').trim();
  const ok=invokeReact(el);
  if(!ok){try{el.click()}catch{}}
  if(tab){
    setTimeout(()=>{
      const m=mode(); if(!m){handling=false;return}
      const active=[...m.querySelectorAll('.day-tabs button')].find(b=>(b.textContent||'').trim()===label);
      if(active&&!active.classList.contains('active'))invokeReact(active);
      setTimeout(()=>{wakeGear().finally(()=>{handling=false})},25);
    },20);
  }else{
    setTimeout(()=>{
      const m=mode();
      if(m){
        const modal=m.closest('.modal');
        const btn=modal?.querySelector('header button[aria-label="Закрыть"]');
        if(btn)invokeReact(btn);
      }
      handling=false;
    },45);
  }
}
function install(){
  if(document.documentElement.dataset.pfControlsV3==='1')return;
  document.documentElement.dataset.pfControlsV3='1';
  document.addEventListener('pointerup',handlePointer,true);
  document.addEventListener('touchend',e=>{
    if(typeof PointerEvent!=='undefined')return;
    handlePointer(e);
  },{capture:true,passive:false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
new MutationObserver(()=>{if(mode())setTimeout(wakeGear,0)}).observe(document.documentElement,{childList:true,subtree:true});
})();
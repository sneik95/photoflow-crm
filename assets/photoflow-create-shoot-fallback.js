(()=>{
'use strict';
const SNAP='fotocrm:snapshot:v2';
const QUEUE='fotocrm:offline-queue:v1';
if(window.__pfCreateShootFallback)return;window.__pfCreateShootFallback=true;
const nativeFetch=window.fetch.bind(window);
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const defaultColor='#3659E3';
const str=v=>typeof v==='string'?v:'';
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const arr=v=>Array.isArray(v)?v:[];
function safeItem(item={}){return{id:str(item.id)||`item-${Date.now()}-${Math.random().toString(36).slice(2)}`,label:str(item.label),done:!!item.done}}
function safeTimeline(item={}){return{id:str(item.id)||`step-${Date.now()}-${Math.random().toString(36).slice(2)}`,time:/^\d{2}:\d{2}$/.test(str(item.time))?item.time:'10:00',label:str(item.label)||'Этап',done:!!item.done}}
function arrivalTimeline(startAt){const d=new Date(startAt||'');if(!Number.isFinite(d.getTime()))return[];d.setMinutes(d.getMinutes()-20);return[{id:`arrival-${Date.now()}-${Math.random().toString(36).slice(2)}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,label:'Прибытие',done:false}]}
function safeShoot(s={}){return{
 ...s,
 id:Number.isFinite(Number(s.id))?Number(s.id):-Date.now(),
 clientId:s.clientId==null?null:Number(s.clientId),clientName:str(s.clientName)||'Без имени',clientPhone:str(s.clientPhone),
 type:str(s.type)||'Съёмка',color:str(s.color)||defaultColor,startAt:str(s.startAt)||new Date().toISOString().slice(0,16),endAt:str(s.endAt)||str(s.startAt)||new Date().toISOString().slice(0,16),allDay:!!s.allDay,
 comment:str(s.comment),price:num(s.price),paymentType:str(s.paymentType)||'advance',paidAmount:num(s.paidAmount),deliveryDays:Math.max(1,num(s.deliveryDays,14)),delivered:!!s.delivered,archived:!!s.archived,status:str(s.status)||'booked',location:str(s.location),travelMinutes:num(s.travelMinutes),organizerName:str(s.organizerName),organizerPhone:str(s.organizerPhone),editingHours:num(s.editingHours),travelCost:num(s.travelCost),otherCosts:num(s.otherCosts),equipment:arr(s.equipment).map(safeItem),shotList:arr(s.shotList).map(safeItem),timeline:arr(s.timeline).map(safeTimeline),backupStatus:str(s.backupStatus)||'none',portalToken:str(s.portalToken),clientGuide:str(s.clientGuide)
}}
function safeType(t={}){return{name:str(t.name)||'Съёмка',color:str(t.color)||defaultColor,deliveryDays:Math.max(1,num(t.deliveryDays,14))}}
function safeClient(c={}){return{...c,id:Number.isFinite(Number(c.id))?Number(c.id):-Date.now(),name:str(c.name)||'Без имени',phone:str(c.phone),email:str(c.email),kind:str(c.kind)||'person',notes:str(c.notes)}}
function normalizeState(v,base){const b=base||{};return{...b,...(v&&typeof v==='object'?v:{}),clients:arr(v?.clients??b.clients).map(safeClient),shoots:arr(v?.shoots??b.shoots).map(safeShoot),types:arr(v?.types??b.types).map(safeType),reminders:arr(v?.reminders??b.reminders).length?arr(v?.reminders??b.reminders).map(x=>num(x)): [5,1,0],profile:v?.profile&&typeof v.profile==='object'?v.profile:(b.profile&&typeof b.profile==='object'?b.profile:{})}}
function cloneState(){return normalizeState(read(SNAP,{}),{})}
function withInitialTimeline(data={}){return{...data,timeline:arrivalTimeline(data.startAt)}}
function queueCreate(data,id){const q=arr(read(QUEUE,[]));const key=(globalThis.crypto&&typeof crypto.randomUUID==='function')?crypto.randomUUID():`pf-${Date.now()}-${Math.random()}`;write(QUEUE,[...q,{key,action:'createShoot',data:{...data,__offlineId:id},id:void 0}])}
function makeResponse(state){write(SNAP,state);return new Response(JSON.stringify(state),{status:200,headers:{'content-type':'application/json'}})}
function localResponse(data){const state=cloneState();const id=-Date.now();const prepared=withInitialTimeline(data);state.shoots=[...state.shoots,safeShoot({...prepared,id})];queueCreate(prepared,id);return makeResponse(state)}
window.fetch=async function(input,init){
 let url='';try{url=typeof input==='string'?input:(input?.url||'')}catch{}
 let body=null;
 if(url.includes('/api/crm')&&init?.method?.toUpperCase()==='POST'){
   try{body=typeof init.body==='string'?JSON.parse(init.body):null}catch{}
   if(body?.action==='createShoot'){
     const prepared=withInitialTimeline(body.data||{});body={...body,data:prepared};init={...init,body:JSON.stringify(body)};
     const base=cloneState();
     try{
       const r=await nativeFetch(input,init);
       if(r.ok){
         try{
           const data=await r.clone().json();
           if(data&&typeof data==='object'&&Array.isArray(data.shoots))return makeResponse(normalizeState(data,base));
           if(data?.shoot){const state=normalizeState(base,base);state.shoots=[...state.shoots,safeShoot(data.shoot)];return makeResponse(state)}
         }catch{}
         try{const fresh=await nativeFetch('/api/crm');if(fresh.ok){const data=await fresh.json();if(Array.isArray(data?.shoots))return makeResponse(normalizeState(data,base))}}catch{}
         return r;
       }
       if(r.status<500&&r.status!==408&&r.status!==429)return r;
       return localResponse(prepared);
     }catch{return localResponse(prepared)}
   }
 }
 return nativeFetch(input,init);
};
})();
(()=>{
'use strict';
const SNAP='fotocrm:snapshot:v2';
const QUEUE='fotocrm:offline-queue:v1';
if(window.__pfCreateShootFallback)return;window.__pfCreateShootFallback=true;
const nativeFetch=window.fetch.bind(window);
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
function cloneState(){const s=read(SNAP,{clients:[],shoots:[],types:[],reminders:[5,1,0],profile:{}});return {...s,clients:Array.isArray(s.clients)?s.clients:[],shoots:Array.isArray(s.shoots)?s.shoots:[],types:Array.isArray(s.types)?s.types:[]}}
function queueCreate(data,id){const q=read(QUEUE,[]);const item={key:(crypto.randomUUID?.()||`pf-${Date.now()}-${Math.random()}`),action:'createShoot',data:{...data,__offlineId:id},id:void 0};write(QUEUE,[...q,item])}
function localResponse(data){const state=cloneState();const id=-Date.now();const shoot={...data,id};state.shoots=[...state.shoots,shoot];write(SNAP,state);queueCreate(data,id);window.dispatchEvent(new CustomEvent('photoflow:create-local',{detail:{id}}));return new Response(JSON.stringify(state),{status:200,headers:{'content-type':'application/json'}})}
window.fetch=async function(input,init){
  let url='';try{url=typeof input==='string'?input:(input?.url||'')}catch{}
  let body=null;
  if(url.includes('/api/crm')&&init?.method?.toUpperCase()==='POST'){
    try{body=typeof init.body==='string'?JSON.parse(init.body):null}catch{}
    if(body?.action==='createShoot'){
      try{
        const r=await nativeFetch(input,init);
        if(r.ok)return r;
        return localResponse(body.data||{});
      }catch{return localResponse(body.data||{})}
    }
  }
  return nativeFetch(input,init);
};
})();
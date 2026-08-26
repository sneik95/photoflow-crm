(()=>{
'use strict';
const SNAP='fotocrm:snapshot:v2';
const QUEUE='fotocrm:offline-queue:v1';
if(window.__pfUpdateShootFallback)return;window.__pfUpdateShootFallback=true;
const nativeFetch=window.fetch.bind(window);
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const normalizeState=s=>({
  ...(s&&typeof s==='object'?s:{}),
  clients:Array.isArray(s?.clients)?s.clients:[],
  shoots:Array.isArray(s?.shoots)?s.shoots:[],
  types:Array.isArray(s?.types)?s.types:[],
  reminders:Array.isArray(s?.reminders)?s.reminders:[5,1,0],
  profile:s?.profile&&typeof s.profile==='object'?s.profile:{}
});
function patchLocal(id,data){
  const state=normalizeState(read(SNAP,{}));
  state.shoots=state.shoots.map(s=>Number(s.id)===Number(id)?{...s,...data}:s);
  write(SNAP,state);
  const q=read(QUEUE,[]),safe=Array.isArray(q)?q:[];
  if(Number(id)<0){
    write(QUEUE,safe.map(item=>item?.action==='createShoot'&&Number(item?.data?.__offlineId)===Number(id)?{...item,data:{...item.data,...data,__offlineId:Number(id)}}:item));
  }else{
    const key=(globalThis.crypto&&typeof crypto.randomUUID==='function')?crypto.randomUUID():`pf-up-${Date.now()}-${Math.random()}`;
    const exists=safe.some(item=>item?.action==='updateShoot'&&Number(item?.id)===Number(id));
    if(!exists)write(QUEUE,[...safe,{key,action:'updateShoot',data:{...data},id:Number(id)}]);
  }
  return state;
}
function response(state){return new Response(JSON.stringify(normalizeState(state)),{status:200,headers:{'content-type':'application/json'}})}
window.fetch=async function(input,init){
  let url='';try{url=typeof input==='string'?input:(input?.url||'')}catch{}
  if(!url.includes('/api/crm')||init?.method?.toUpperCase()!=='POST')return nativeFetch(input,init);
  let body=null;try{body=typeof init.body==='string'?JSON.parse(init.body):null}catch{}
  if(body?.action!=='updateShoot'||body?.id==null)return nativeFetch(input,init);
  const id=Number(body.id),data=body.data&&typeof body.data==='object'?body.data:{};
  if(id<0)return response(patchLocal(id,data));
  try{
    const r=await nativeFetch(input,init);
    if(r.ok){
      try{const state=await r.clone().json();if(Array.isArray(state?.shoots))return r}catch{}
    }
  }catch{}
  return response(patchLocal(id,data));
};
})();
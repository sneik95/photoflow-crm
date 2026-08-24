(()=>{
'use strict';
const SNAP='fotocrm:snapshot:v2';
const money=n=>Number(n||0).toLocaleString('ru-RU');
function read(){try{return JSON.parse(localStorage.getItem(SNAP)||'{}')}catch{return{}}}
function refresh(){
  const radar=document.querySelector('.risk-radar');
  if(!radar)return;
  const grid=radar.querySelector('.risk-grid');
  const h=radar.querySelector('h2');
  if(!grid||!h)return;
  const shoots=(read().shoots||[]).filter(s=>Number(s.paidAmount||0)<Number(s.price||0));
  const total=shoots.reduce((sum,s)=>sum+Math.max(0,Number(s.price||0)-Number(s.paidAmount||0)),0);
  let balance=[...grid.querySelectorAll('button')].find(b=>/не получено/i.test((b.textContent||'').replace(/\s+/g,' ')));
  if(!shoots.length){
    if(balance)balance.remove();
    const n=grid.querySelectorAll('button').length;
    h.textContent=n?`${n} ${n===1?'сигнал требует':'сигнала требуют'} внимания`:'Всё под контролем';
    if(!n){
      let empty=radar.querySelector('.radar-empty');
      if(!empty){empty=document.createElement('p');empty.className='radar-empty';radar.appendChild(empty)}
      empty.textContent='Рисков сейчас нет';
    }
    return;
  }
  radar.querySelector('.radar-empty')?.remove();
  if(balance){
    const strong=balance.querySelector('strong');
    const small=balance.querySelector('small');
    if(strong)strong.textContent=`${money(total)} ₽ не получено`;
    if(small)small.textContent=`${shoots.length} ${shoots.length===1?'клиент с остатком':'клиента с остатком'}`;
  }
  const n=grid.querySelectorAll('button').length;
  h.textContent=n?`${n} ${n===1?'сигнал требует':'сигнала требуют'} внимания`:'Всё под контролем';
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})};
const orig=Storage.prototype.setItem;
if(!Storage.prototype.__pfRiskLive){
  Storage.prototype.setItem=function(k,v){const r=orig.call(this,k,v);if(this===localStorage&&k===SNAP)schedule();return r};
  Storage.prototype.__pfRiskLive=true;
}
window.addEventListener('storage',e=>{if(e.key===SNAP)schedule()});
document.addEventListener('click',()=>setTimeout(schedule,60),true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
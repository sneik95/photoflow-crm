(()=>{
'use strict';
function reactProps(el){if(!el)return null;const k=Object.keys(el).find(k=>k.startsWith('__reactProps$'));return k?el[k]:null}
function callReactClick(el){const p=reactProps(el);if(typeof p?.onClick!=='function')return false;try{p.onClick({currentTarget:el,target:el,preventDefault(){},stopPropagation(){},nativeEvent:{}});return true}catch{return false}}
function fix(){const mode=document.querySelector('.day-mode');if(!mode)return;const modal=mode.closest('.modal');if(modal){const close=modal.querySelector('header button[aria-label="Закрыть"]');if(close&&!close.dataset.pfDirectClose){close.dataset.pfDirectClose='1';close.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(!callReactClick(close)){modal.closest('.modal-backdrop')?.remove();document.body.style.overflow=''}},{capture:true})}}
const tabs=[...mode.querySelectorAll('.day-tabs button')];const timing=tabs.find(b=>(b.textContent||'').trim()==='Тайминг');const gear=tabs.find(b=>(b.textContent||'').trim()==='Техника');
if(timing&&!timing.dataset.pfDirectTab){timing.dataset.pfDirectTab='1';timing.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();callReactClick(timing);setTimeout(()=>window.dispatchEvent(new Event('resize')),0)},{capture:true})}
if(gear&&!gear.dataset.pfDirectTab){gear.dataset.pfDirectTab='1';gear.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();callReactClick(gear);setTimeout(()=>window.dispatchEvent(new Event('resize')),0)},{capture:true})}
}
let q=false;const run=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;fix()})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
(()=>{
'use strict';
function mode(){return document.querySelector('.day-mode')}
function reactHandler(el){if(!el)return null;const keys=Object.keys(el);const propsKey=keys.find(k=>k.startsWith('__reactProps$'));if(propsKey&&typeof el[propsKey]?.onClick==='function')return el[propsKey].onClick;let fiberKey=keys.find(k=>k.startsWith('__reactFiber$'));let fiber=fiberKey?el[fiberKey]:null;for(let i=0;fiber&&i<8;i++,fiber=fiber.return){if(typeof fiber.memoizedProps?.onClick==='function')return fiber.memoizedProps.onClick;if(typeof fiber.pendingProps?.onClick==='function')return fiber.pendingProps.onClick}return null}
function invokeReact(el){const fn=reactHandler(el);if(typeof fn!=='function')return false;try{fn({currentTarget:el,target:el,preventDefault(){},stopPropagation(){},nativeEvent:{type:'pointerup'}});return true}catch{return false}}
function isClose(target){const btn=target?.closest?.('button');if(!btn)return null;const m=mode();if(!m)return null;const modal=m.closest('.modal');return modal&&btn===modal.querySelector('header button[aria-label="Закрыть"]')?btn:null}
let handling=false;
function handlePointer(e){if(handling)return;const close=isClose(e.target);if(!close)return;handling=true;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();const ok=invokeReact(close);if(!ok){try{close.click()}catch{}}setTimeout(()=>{const m=mode();if(m){const modal=m.closest('.modal');const btn=modal?.querySelector('header button[aria-label="Закрыть"]');if(btn)invokeReact(btn)}handling=false},45)}
function install(){if(document.documentElement.dataset.pfCloseStable==='1')return;document.documentElement.dataset.pfCloseStable='1';document.addEventListener('pointerup',handlePointer,true);document.addEventListener('touchend',e=>{if(typeof PointerEvent!=='undefined')return;handlePointer(e)},{capture:true,passive:false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
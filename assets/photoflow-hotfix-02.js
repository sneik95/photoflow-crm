(()=>{
  'use strict';
  const style=document.createElement('style');
  style.id='pf-risk-prehide';
  style.textContent='.risk-radar{visibility:hidden!important}';
  document.head.appendChild(style);
  const reveal=()=>{document.getElementById('pf-risk-prehide')?.remove()};
  const load=(src,onload)=>{const s=document.createElement('script');s.src=src;s.async=false;if(onload)s.addEventListener('load',onload,{once:true});document.head.appendChild(s)};
  const start=()=>setTimeout(()=>{
    const v='20260823-11';
    load('/assets/photoflow-base-6ca.js?v='+v,()=>requestAnimationFrame(()=>requestAnimationFrame(reveal)));
    load('/assets/photoflow-controls-v3.js?v='+v);
    load('/assets/photoflow-tech-rescue.js?v='+v);
    setTimeout(reveal,2200);
  },350);
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
})();
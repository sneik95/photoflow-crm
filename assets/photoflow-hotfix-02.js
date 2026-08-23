(()=>{
  'use strict';
  const purgeRisks=()=>{
    document.querySelectorAll('.risk-grid button').forEach(btn=>{
      const t=(btn.textContent||'').replace(/\s+/g,' ');
      if(/Материал без 2-й копии/i.test(t)||/съёмк[аи]\s+за\s+7\s+д/i.test(t)) btn.remove();
    });
    document.querySelectorAll('.shoot-list-panel .danger-link,.panel-actions .danger-link').forEach(el=>el.remove());
    const radar=document.querySelector('.risk-radar');
    if(radar){
      const n=radar.querySelectorAll('.risk-grid button').length;
      const h=radar.querySelector('h2');
      if(h) h.textContent=n?`${n} ${n===1?'сигнал требует':'сигнала требуют'} внимания`:'Всё под контролем';
    }
  };
  purgeRisks();
  new MutationObserver(()=>queueMicrotask(purgeRisks)).observe(document.documentElement,{childList:true,subtree:true});
  const load=src=>{const s=document.createElement('script');s.src=src;s.async=false;document.head.appendChild(s)};
  const v='20260823-9';
  load('/assets/photoflow-base-6ca.js?v='+v);
  load('/assets/photoflow-controls-v3.js?v='+v);
  load('/assets/photoflow-tech-rescue.js?v='+v);
})();
(()=>{
'use strict';
/* Native React controls must receive the original click. This helper never
   prevents propagation; it only supplies a delayed fallback if React did not
   react to the click for some reason. */
function reactClick(el){
  if(!el)return false;
  const propKey=Object.keys(el).find(k=>k.startsWith('__reactProps$'));
  const fiberKey=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));
  const fn=(propKey&&el[propKey]?.onClick)||(fiberKey&&el[fiberKey]?.memoizedProps?.onClick);
  if(typeof fn!=='function')return false;
  try{fn({currentTarget:el,target:el,preventDefault(){},stopPropagation(){},nativeEvent:{}});return true}catch{return false}
}
function findMode(){return document.querySelector('.day-mode')}
function getShoot(){
  try{
    const mode=findMode(); if(!mode)return null;
    const hero=mode.querySelector('.day-hero');
    const name=(hero?.querySelector('h2')?.textContent||'').trim();
    const date=(hero?.textContent||'').match(/\d{2}\.\d{2}\.\d{4}/)?.[0];
    const snap=JSON.parse(localStorage.getItem('fotocrm:snapshot:v2')||'{}');
    const fmt=iso=>{const d=new Date(iso||'');return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
    return (snap.shoots||[]).find(s=>String(s.clientName||'').trim()===name&&(!date||fmt(s.startAt)===date))||(snap.shoots||[]).find(s=>String(s.clientName||'').trim()===name)||null;
  }catch{return null}
}
function ensureGearVisible(){
  const mode=findMode(); if(!mode)return;
  const gear=[...mode.querySelectorAll('.day-tabs button')].find(b=>(b.textContent||'').trim()==='Техника');
  if(!gear?.classList.contains('active'))return;
  const list=mode.querySelector('.day-checklist');
  if(!list)return;
  /* Let the main hotfix own enhanced gear rendering. If it has not rendered
     yet, wake its MutationObserver without replacing React's nodes. */
  if(!list.children.length){
    list.removeAttribute('data-pf-owned');
    list.dataset.pfRefresh=String(Date.now());
  }
}
function install(){
  const mode=findMode(); if(!mode)return;
  const modal=mode.closest('.modal');
  const close=modal?.querySelector('header button[aria-label="Закрыть"]');
  if(close&&!close.dataset.pfSafeClose){
    close.dataset.pfSafeClose='1';
    close.addEventListener('click',()=>{
      const backdrop=modal.closest('.modal-backdrop');
      setTimeout(()=>{
        /* First allow the normal React handler to run. Only if the same modal
           is still mounted do we invoke its handler directly as a fallback. */
        if(backdrop&&document.body.contains(backdrop)){
          reactClick(close);
          setTimeout(()=>{
            if(document.body.contains(backdrop)){
              backdrop.remove();
              document.body.style.overflow='';
            }
          },60);
        }
      },40);
    });
  }
  [...mode.querySelectorAll('.day-tabs button')].forEach(btn=>{
    if(btn.dataset.pfSafeTab)return;
    btn.dataset.pfSafeTab='1';
    btn.addEventListener('click',()=>{
      const label=(btn.textContent||'').trim();
      setTimeout(()=>{
        const current=findMode(); if(!current)return;
        const expected=label==='Техника'?current.querySelector('.day-checklist'):current.querySelector('.day-timeline');
        if(!btn.classList.contains('active')||!expected){reactClick(btn)}
        setTimeout(ensureGearVisible,40);
      },35);
    });
  });
}
let queued=false;const run=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;install();ensureGearVisible()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
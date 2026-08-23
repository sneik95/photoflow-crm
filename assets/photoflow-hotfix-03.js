(()=>{
  'use strict';
  const CUSTOM_KEY='photoflow:smart-custom:v1';
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')||f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

  function ensureStyles(){
    if(document.getElementById('pf-hf03-style')) return;
    const s=document.createElement('style');
    s.id='pf-hf03-style';
    s.textContent=`
      .pf-smart-plus{border:0!important;background:transparent!important;box-shadow:none!important;color:#5267ff!important;padding:0!important;margin:0!important;font:500 30px/1 -apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif!important;min-width:34px!important;min-height:34px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
      .pf-smart-modal-bg{position:fixed;inset:0;z-index:999999;background:rgba(17,19,26,.28);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center}
      .pf-smart-modal{width:min(100%,680px);background:#fffdf9;border-radius:26px 26px 0 0;padding:22px 22px calc(22px + env(safe-area-inset-bottom));box-sizing:border-box;max-height:82dvh;overflow:auto}
      .pf-smart-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.pf-smart-modal-head h3{margin:0;font-size:23px}.pf-smart-close{border:0;background:#f3f4f6;width:42px;height:42px;border-radius:50%;font-size:26px;color:#7b8290}
      .pf-smart-modal label{display:block;margin:0 0 14px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#858d9a}.pf-smart-modal input,.pf-smart-modal textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #dfe3ea;border-radius:15px;background:#fff;padding:13px 14px;font-size:16px;color:#17191f;outline:none}.pf-smart-modal textarea{min-height:145px;resize:vertical}.pf-smart-save{width:100%;border:0;border-radius:15px;background:#5267ff;color:#fff;padding:15px;font-size:16px;font-weight:700}.pf-smart-hint{font-size:12px;color:#9299a6;line-height:1.45;margin:0 0 16px}
      .smart-messages article[data-pf-custom="1"]{border-top:1px solid #e5e7eb;padding-top:18px;margin-top:18px}
    `;
    document.head.appendChild(s);
  }

  function cleanup(){
    document.querySelectorAll('.day-weather,.weather-card,.backup-card,.day-backup').forEach(el=>el.remove());
    document.querySelectorAll('.risk-grid button').forEach(btn=>{
      const t=btn.textContent||'';
      if(/Материал без 2-й копии/i.test(t)||/съёмк[аи]\s+за\s+7\s+д/i.test(t)) btn.remove();
    });
    document.querySelectorAll('.shoot-list-panel .danger-link,.panel-actions .danger-link').forEach(el=>el.remove());
    const radar=document.querySelector('.risk-radar');
    if(radar){
      const n=radar.querySelectorAll('.risk-grid button').length;
      const h=radar.querySelector('h2');
      if(h) h.textContent=n?`${n} ${n===1?'сигнал требует':'сигнала требуют'} внимания`:'Всё под контролем';
      const empty=radar.querySelector('.radar-empty');
      if(empty) empty.textContent='Нет просрочек и неоплаченных остатков.';
    }
  }

  function closeModal(){document.querySelector('.pf-smart-modal-bg')?.remove()}
  function openModal(){
    closeModal();
    const bg=document.createElement('div');
    bg.className='pf-smart-modal-bg';
    bg.innerHTML=`<section class="pf-smart-modal" role="dialog" aria-modal="true"><div class="pf-smart-modal-head"><h3>Новое умное сообщение</h3><button type="button" class="pf-smart-close" aria-label="Закрыть">×</button></div><label>Название<input class="pf-smart-title" placeholder="Например, Напоминание"></label><label>Текст<textarea class="pf-smart-text" placeholder="Введите текст сообщения"></textarea></label><p class="pf-smart-hint">Можно использовать: {имя}, {дата}, {время}, {место}, {срок_сдачи}, {остаток}, {стоимость}, {предоплата}, {оплата}</p><button type="button" class="pf-smart-save">Добавить сообщение</button></section>`;
    document.body.appendChild(bg);
    bg.querySelector('.pf-smart-close').onclick=closeModal;
    bg.addEventListener('click',e=>{if(e.target===bg)closeModal()});
    bg.querySelector('.pf-smart-save').onclick=()=>{
      const title=bg.querySelector('.pf-smart-title').value.trim();
      const text=bg.querySelector('.pf-smart-text').value.trim();
      if(!title||!text)return;
      const all=read(CUSTOM_KEY,[]);all.push({id:Date.now(),title,text});write(CUSTOM_KEY,all);closeModal();patchSmart();
    };
  }

  function patchSmart(){
    const section=document.querySelector('.smart-messages');
    if(!section)return;
    const heading=section.querySelector('.section-heading');
    if(heading){
      const small=heading.querySelector('small');
      if(small)small.remove();
      if(!heading.querySelector('.pf-smart-plus')){
        const plus=document.createElement('button');plus.type='button';plus.className='pf-smart-plus';plus.textContent='+';plus.setAttribute('aria-label','Добавить умное сообщение');plus.onclick=openModal;heading.appendChild(plus);
      }
    }
    section.querySelectorAll('article').forEach(article=>{
      if(article.dataset.pfCustom==='1')return;
      const buttons=[...article.querySelectorAll('button')];
      if(buttons[0])buttons[0].textContent='Редактировать';
      if(buttons[1])buttons[1].textContent='Отправить';
    });
    section.querySelectorAll('article[data-pf-custom="1"]').forEach(el=>el.remove());
    for(const item of read(CUSTOM_KEY,[])){
      const a=document.createElement('article');a.dataset.pfCustom='1';a.innerHTML='<strong></strong><p></p><div><button type="button">Редактировать</button><button type="button">Отправить</button></div>';a.querySelector('strong').textContent=item.title;a.querySelector('p').textContent=item.text;section.appendChild(a);
    }
  }

  function patch(){ensureStyles();cleanup();patchSmart()}
  let q=false;const schedule=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;patch()})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  document.addEventListener('click',()=>setTimeout(schedule,0),true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
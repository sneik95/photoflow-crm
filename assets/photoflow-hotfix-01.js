(() => {
  const parseDate = (text) => {
    const m = String(text || '').match(/(\d{2})\.(\d{2})\.(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  };

  const today = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const patch = () => {
    const hero = document.querySelector('.shoot-day-hero');
    if (hero) {
      const d = parseDate(hero.querySelector('.shoot-day-copy p')?.textContent);
      if (d && d < today()) hero.style.display = 'none';
      const label = hero.querySelector('.shoot-day-metrics > div:first-child span');
      if (label && /выехать\s+в/i.test(label.textContent || '')) label.textContent = 'Выезд';
    }

    document.querySelectorAll('.panel-actions .danger-link').forEach((el) => el.remove());

    document.querySelectorAll('.shoot-price').forEach((el) => {
      if (el.dataset.pfPatched === '1') return;
      const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw.includes('/')) return;
      const parts = raw.split('/').map((x) => x.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1]) return;
      const paid = parts[0];
      const total = parts[1];
      el.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = total;
      const small = document.createElement('small');
      small.textContent = `Предоплата: ${paid}`;
      el.append(strong, small);
      el.dataset.pfPatched = '1';
    });
  };

  const run = () => requestAnimationFrame(patch);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patch();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(patch, 500);
  setTimeout(patch, 1500);
})();

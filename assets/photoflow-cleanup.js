(() => {
  let queued = false;

  const cleanup = () => {
    queued = false;

    document.querySelectorAll('.risk-radar').forEach(radar => {
      const buttons = [...radar.querySelectorAll('.risk-grid > button')];

      buttons.forEach(button => {
        const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
        const removedRisk =
          /материал\s+без\s+2[-–—]?й?\s+коп/i.test(text) ||
          /резервн\w*\s+коп/i.test(text) ||
          /съ[её]мк\w*\s+за\s+7\s+дн/i.test(text) ||
          /проверьте\s+дорогу.*техник/i.test(text);

        if (removedRisk) button.remove();
      });

      const visible = [...radar.querySelectorAll('.risk-grid > button')];
      const heading = radar.querySelector('.panel-title-row h2');
      if (heading) {
        const n = visible.length;
        heading.textContent = n === 0
          ? 'Всё под контролем'
          : n === 1
            ? '1 сигнал требует внимания'
            : `${n} ${n >= 2 && n <= 4 ? 'сигнала требуют' : 'сигналов требуют'} внимания`;
      }
    });

    document.querySelectorAll('.panel-actions .danger-link').forEach(button => button.remove());
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(cleanup);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

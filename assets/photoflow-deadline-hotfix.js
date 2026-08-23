(() => {
  const SNAPSHOT_KEY = 'fotocrm:snapshot:v2';
  const DAY = 86400000;

  const readSnapshot = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
      return parsed && Array.isArray(parsed.shoots) ? parsed : { shoots: [] };
    } catch (_) {
      return { shoots: [] };
    }
  };

  const formatDate = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
  };

  const shootKey = (shoot) => `${String(shoot.clientName || '').trim()}|${formatDate(shoot.startAt)}`;
  const delivered = (shoot) => shoot?.delivered === true || shoot?.archived === true || shoot?.status === 'delivered';

  const daysLeft = (shoot) => {
    if (!shoot?.startAt) return null;
    const start = new Date(shoot.startAt);
    if (Number.isNaN(start.getTime())) return null;
    const deadline = new Date(start);
    deadline.setHours(0, 0, 0, 0);
    deadline.setDate(deadline.getDate() + (Number(shoot.deliveryDays) || 0));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((deadline.getTime() - now.getTime()) / DAY);
  };

  const isStatusFilter = (el) => el instanceof HTMLSelectElement && (
    el.getAttribute('aria-label') === 'Фильтр съёмок по статусу' ||
    [...el.options].some(o => /горят дедлайны|просрочен|архив/i.test(o.textContent || ''))
  );

  const choiceKind = (select) => {
    const text = (select.options[select.selectedIndex]?.textContent || '').trim();
    if (/горят дедлайны/i.test(text)) return 'urgent';
    if (/просрочен/i.test(text)) return 'overdue';
    return null;
  };

  let mode = null;

  const setAllOption = (select) => {
    const all = [...select.options].find(o => o.value === 'all' || /^все$/i.test((o.textContent || '').trim()));
    if (all) select.value = all.value;
  };

  const render = () => {
    if (!mode) return;
    const panel = document.querySelector('.shoot-list-panel');
    const list = panel?.querySelector('.shoot-list');
    const select = document.querySelector('select[aria-label="Фильтр съёмок по статусу"]');
    if (!panel || !list || !select) return;

    const wanted = readSnapshot().shoots.filter(shoot => {
      if (delivered(shoot)) return false;
      const left = daysLeft(shoot);
      if (left === null) return false;
      return mode === 'urgent' ? left >= 0 && left <= 3 : left < 0;
    });
    const keys = new Set(wanted.map(shootKey));

    let shown = 0;
    list.querySelectorAll('.shoot-card').forEach(card => {
      const name = (card.querySelector('h3')?.textContent || '').trim();
      const dateText = card.querySelector('.shoot-schedule span')?.textContent || card.textContent || '';
      const date = dateText.match(/\d{2}\.\d{2}\.\d{4}/)?.[0] || '';
      const visible = keys.has(`${name}|${date}`);
      card.style.display = visible ? '' : 'none';
      if (visible) shown++;
    });

    let empty = list.querySelector('.pf-deadline-empty');
    if (!shown) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'shoot-filter-empty pf-deadline-empty';
        empty.innerHTML = `<strong>Съёмки не найдены</strong><span>${mode === 'urgent' ? 'Нет несданных съёмок со сроком сдачи в ближайшие 3 дня.' : 'Нет просроченных несданных съёмок.'}</span>`;
        list.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }

    const count = panel.querySelector('.panel-actions > span');
    if (count) count.textContent = `${shown} ${shown === 1 ? 'проект' : shown >= 2 && shown <= 4 ? 'проекта' : 'проектов'}`;
  };

  const clear = () => {
    mode = null;
    document.querySelectorAll('.shoot-card').forEach(card => { card.style.display = ''; });
    document.querySelectorAll('.pf-deadline-empty').forEach(el => el.remove());
  };

  document.addEventListener('change', event => {
    const select = event.target;
    if (!isStatusFilter(select)) return;
    const kind = choiceKind(select);
    if (!kind) {
      clear();
      return;
    }
    mode = kind;
    setAllOption(select);
    [0, 30, 80, 180, 400].forEach(ms => setTimeout(render, ms));
  }, true);

  new MutationObserver(() => {
    if (mode) requestAnimationFrame(render);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
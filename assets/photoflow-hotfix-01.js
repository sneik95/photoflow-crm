(() => {
  const SNAPSHOT_KEY = 'fotocrm:snapshot:v2';
  const nativeFetch = window.fetch.bind(window);

  const forceStatusAlignment = () => {
    let style = document.getElementById('pf-status-align');
    if (!style) {
      style = document.createElement('style');
      style.id = 'pf-status-align';
      style.textContent = `
        .shoot-card-topline{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;width:auto!important}
        .shoot-card-topline .eyebrow{padding-right:0!important;display:inline-block!important;flex:0 0 auto!important}
        .shoot-card-topline .shoot-status{position:static!important;inset:auto!important;margin:0!important;transform:none!important;flex:0 0 auto!important}
      `;
      document.head.appendChild(style);
    }
  };
  forceStatusAlignment();

  const defaultTypes = [
    { name: 'Свадьба', color: '#3659E3', deliveryDays: 120 },
    { name: 'Семейная', color: '#008A68', deliveryDays: 14 },
    { name: 'Портрет', color: '#C92A69', deliveryDays: 14 },
    { name: 'Love story', color: '#E46F00', deliveryDays: 14 },
    { name: 'Бизнес', color: '#007FB5', deliveryDays: 5 },
    { name: 'Беременность', color: '#5F8F00', deliveryDays: 10 },
    { name: 'Новорождённые', color: '#A58F00', deliveryDays: 10 },
    { name: 'Репортаж', color: '#596475', deliveryDays: 7 }
  ];

  const initialSnapshot = () => ({
    clients: [
      { id: 1, name: 'Алёна Наумова', phone: '+7 918 555-41-20', email: '', kind: 'person', notes: 'Свадьба в Абрау-Дюрсо' },
      { id: 2, name: 'Женя Ревина', phone: '+7 988 555-18-09', email: '', kind: 'person', notes: 'Портретная съёмка' }
    ],
    shoots: [
      { id: 1, clientId: 2, clientName: 'Женя Ревина', type: 'Портрет', color: '#C92A69', startAt: '2026-08-19T12:00', endAt: '2026-08-19T14:00', allDay: false, comment: 'Портретная прогулка у моря', price: 12000, paymentType: 'postpay', paidAmount: 0, deliveryDays: 14, delivered: false, archived: false, status: 'processing', location: 'Суджукская коса, Новороссийск', travelMinutes: 25, organizerName: '', organizerPhone: '', editingHours: 4, travelCost: 600, otherCosts: 0, equipment: [], shotList: [], timeline: [], backupStatus: 'one', portalToken: '', clientGuide: 'Возьмите два образа и удобную обувь для прогулки.' },
      { id: 2, clientId: 1, clientName: 'Алёна Наумова', type: 'Свадьба', color: '#3659E3', startAt: '2026-08-22T14:00', endAt: '2026-08-22T22:00', allDay: false, comment: 'Полный свадебный день', price: 69000, paymentType: 'advance', paidAmount: 5000, deliveryDays: 120, delivered: false, archived: false, status: 'preparing', location: 'Абрау-Дюрсо, Краснодарский край', travelMinutes: 70, organizerName: 'Мария, организатор', organizerPhone: '+7 918 777-14-20', editingHours: 28, travelCost: 3500, otherCosts: 8000, equipment: [], shotList: [], timeline: [], backupStatus: 'none', portalToken: '', clientGuide: 'Будьте готовы за 20 минут до начала.' }
    ],
    types: defaultTypes,
    reminders: [5, 1, 0],
    profile: { firstName: 'Кристина', lastName: 'Вениченко', phone: '+7 900 000-00-00', city: 'Новороссийск', email: 'kristina@example.ru', goal: '2500000' }
  });

  const readSnapshot = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
      if (parsed && Array.isArray(parsed.clients) && Array.isArray(parsed.shoots)) return parsed;
    } catch (_) {}
    return initialSnapshot();
  };

  const writeSnapshot = (snapshot) => {
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch (_) {}
  };

  const nextId = (items) => Math.max(0, ...items.map((x) => Number(x.id) || 0)) + 1;

  const applyAction = (snapshot, payload) => {
    const action = payload?.action;
    const data = payload?.data || {};
    const id = Number(payload?.id);
    const next = {
      ...snapshot,
      clients: [...(snapshot.clients || [])],
      shoots: [...(snapshot.shoots || [])],
      types: [...(snapshot.types || defaultTypes)],
      reminders: [...(snapshot.reminders || [5, 1, 0])],
      profile: { ...(snapshot.profile || initialSnapshot().profile) }
    };

    if (action === 'createShoot') {
      const clean = { ...data };
      delete clean.__offlineId;
      clean.id = nextId(next.shoots);
      next.shoots.push(clean);
    } else if (action === 'createClient') {
      const clean = { ...data };
      delete clean.__offlineId;
      clean.id = nextId(next.clients);
      next.clients.push(clean);
    } else if (action === 'updateShoot' && Number.isFinite(id)) {
      next.shoots = next.shoots.map((shoot) => Number(shoot.id) === id ? { ...shoot, ...data } : shoot);
    } else if (action === 'deleteShoot' && Number.isFinite(id)) {
      next.shoots = next.shoots.filter((shoot) => Number(shoot.id) !== id);
    } else if (action === 'deleteActiveShoots') {
      next.shoots = next.shoots.filter((shoot) => shoot.archived || shoot.delivered || shoot.status === 'delivered');
    } else if (action === 'deleteAllShoots') {
      next.shoots = [];
    } else if (action === 'savePreferences') {
      if (data.profile) next.profile = { ...data.profile };
      if (data.types) next.types = [...data.types];
      if (data.reminders) next.reminders = [...data.reminders];
    }

    writeSnapshot(next);
    return next;
  };

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
    if ((url === '/api/crm' || url.endsWith('/api/crm')) && method === 'POST') {
      try {
        const payload = JSON.parse(init?.body || '{}');
        const snapshot = applyAction(readSnapshot(), payload);
        return new Response(JSON.stringify(snapshot), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Ошибка сохранения' }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      }
    }
    return nativeFetch(input, init);
  };

  const parseDate = (text) => {
    const m = String(text || '').match(/(\d{2})\.(\d{2})\.(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  };

  const today = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const patch = () => {
    forceStatusAlignment();
    const hero = document.querySelector('.shoot-day-hero');
    if (hero) {
      const d = parseDate(hero.querySelector('.shoot-day-copy p')?.textContent);
      hero.style.display = d && d < today() ? 'none' : '';
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

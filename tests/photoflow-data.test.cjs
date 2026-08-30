const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const RUNTIME = path.join(__dirname, '..', 'assets', 'photoflow-runtime-v2.js');
const SNAPSHOT = 'fotocrm:snapshot:v2';
const OFFLINE_QUEUE = 'fotocrm:offline-queue:v1';

class StorageMock {
  constructor(values) {
    this.values = values instanceof Map ? values : new Map();
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class CustomEventMock {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createEnvironment({ online = false, fetchImpl, storage, now = 1_800_000_000_000 } = {}) {
  const listeners = new Map();
  const localStorage = storage || new StorageMock();
  const classNames = new Set();
  const documentElement = {
    classList: {
      add: (...names) => names.forEach((name) => classNames.add(name)),
      remove: (...names) => names.forEach((name) => classNames.delete(name)),
    },
    style: { setProperty() {} },
  };
  const document = {
    readyState: 'loading',
    documentElement,
    activeElement: null,
    hidden: false,
    body: { appendChild() {} },
    head: { appendChild() {} },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() {
      return {
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        appendChild() {},
        setAttribute() {},
      };
    },
  };
  const clock = class extends Date {
    constructor(value) { super(value === undefined ? now : value); }
    static now() { return now; }
  };
  const setTimeoutMock = (handler, delay, ...args) => {
    const timer = setTimeout(handler, delay, ...args);
    if (delay >= 5_000) timer.unref?.();
    return timer;
  };
  const context = {
    console,
    Response,
    URL,
    AbortController,
    Date: clock,
    Math,
    JSON,
    Number,
    String,
    Array,
    Object,
    Map,
    Promise,
    CustomEvent: CustomEventMock,
    localStorage,
    document,
    navigator: { onLine: online },
    crypto: { randomUUID: () => `uuid-${Math.random()}` },
    fetch: fetchImpl || (async () => jsonResponse({ error: 'not found' }, 404)),
    setTimeout: setTimeoutMock,
    clearTimeout,
    requestAnimationFrame: (handler) => handler(),
    cancelAnimationFrame() {},
    innerHeight: 900,
  };
  context.window = context;
  context.globalThis = context;
  context.addEventListener = (type, handler) => {
    const registered = listeners.get(type) || [];
    registered.push(handler);
    listeners.set(type, registered);
  };
  context.removeEventListener = (type, handler) => {
    listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
  };
  context.dispatchEvent = (event) => {
    for (const handler of listeners.get(event.type) || []) handler(event);
    return true;
  };
  vm.runInNewContext(fs.readFileSync(RUNTIME, 'utf8'), context, { filename: RUNTIME });
  return context;
}

function queueOf(environment) {
  return JSON.parse(environment.localStorage.getItem(OFFLINE_QUEUE) || '[]');
}

const fallback = {
  clients: [],
  shoots: [],
  types: [{ name: 'Свадьба', color: '#5267FF', deliveryDays: 14 }],
  reminders: [5, 1, 0],
  profile: {},
};

const shootInput = {
  clientId: null,
  clientName: 'Иванов Иван Иванович',
  clientPhone: '+7 999 123-45-67',
  type: 'Свадьба',
  color: '#5267FF',
  startAt: '2027-01-10T14:00',
  endAt: '2027-01-10T20:00',
  price: 50_000,
  paidAmount: 5_000,
  paymentType: 'advance',
  location: 'Москва, Красная площадь',
};

async function testOfflineCrudAndReload() {
  const storage = new StorageMock();
  const first = createEnvironment({ online: false, storage });
  const reasons = [];
  first.addEventListener('photoflow:state-changed', (event) => reasons.push(event.detail.reason));
  await first.PhotoFlowData.bootstrap(fallback);

  const created = await first.PhotoFlowData.mutate('createShoot', shootInput);
  assert.equal(created.ok, true);
  assert.equal(created.queued, true);
  let shoot = first.PhotoFlowData.getState().shoots[0];
  assert.ok(shoot.id < 0, 'offline shoot must receive a temporary negative ID');
  assert.deepEqual(
    Array.from(shoot.timeline, (item) => [item.time, item.label]),
    [['13:40', 'Прибытие']],
    'a new shoot gets only the arrival stage, exactly 20 minutes before start',
  );
  assert.ok(reasons.includes('optimistic'), 'UI state event must be emitted immediately');

  await first.PhotoFlowData.mutate('updateShoot', {
    timeline: [...shoot.timeline, { id: 'custom-stage', time: '15:00', label: 'Церемония', done: false }],
    equipment: [],
  }, shoot.id);
  await first.PhotoFlowData.mutate('updateShoot', { delivered: true, archived: true, status: 'delivered' }, shoot.id);
  await first.PhotoFlowData.mutate('updateShoot', { delivered: false, archived: false, status: 'processing' }, shoot.id);
  await first.PhotoFlowData.mutate('updateShoot', { paidAmount: 50_000 }, shoot.id);

  let queue = queueOf(first);
  assert.equal(queue.length, 1, 'updates for a temporary shoot must merge into createShoot');
  assert.equal(queue[0].action, 'createShoot');
  assert.equal(queue[0].data.status, 'processing');
  assert.equal(queue[0].data.paidAmount, 50_000);
  assert.deepEqual(queue[0].data.equipment, [], 'an intentionally empty equipment list must remain empty');

  const reopened = createEnvironment({ online: false, storage });
  await reopened.PhotoFlowData.bootstrap(fallback);
  shoot = reopened.PhotoFlowData.getState().shoots[0];
  assert.equal(shoot.clientName, shootInput.clientName, 'snapshot must survive an app restart');
  assert.equal(shoot.timeline.length, 2);
  assert.equal(shoot.equipment.length, 0);

  await reopened.PhotoFlowData.mutate('deleteShoot', {}, shoot.id);
  assert.equal(reopened.PhotoFlowData.getState().shoots.length, 0);
  assert.equal(queueOf(reopened).length, 0, 'deleting a temporary shoot removes its pending create operation');
}

async function testCreateAndServerIdReconciliation() {
  const requests = [];
  const environment = createEnvironment({
    online: true,
    fetchImpl: async (url, init) => {
      if (!init?.method) return jsonResponse(fallback);
      const body = JSON.parse(init.body);
      requests.push(body);
      if (body.action === 'createShoot') return jsonResponse({ shoot: { id: 101 } });
      if (body.action === 'updateShoot') return jsonResponse({ shoot: { ...body.data } });
      return jsonResponse({ ok: true });
    },
  });
  await environment.PhotoFlowData.bootstrap(fallback);
  const created = await environment.PhotoFlowData.mutate('createShoot', shootInput);
  assert.equal(created.ok, true);
  assert.equal(created.queued, false);
  assert.equal(environment.PhotoFlowData.getState().shoots[0].id, 101);
  assert.equal(environment.PhotoFlowData.getState().shoots[0].clientName, shootInput.clientName, 'partial create response must preserve local fields');
  assert.equal(queueOf(environment).length, 0);
  assert.equal(requests[0].id, undefined, 'temporary ID must never be sent as a server ID');
  assert.equal(requests[0].data.__offlineId, undefined, 'offline metadata must not leak into the API payload');

  await environment.PhotoFlowData.mutate('updateShoot', { delivered: true, status: 'delivered' }, 101);
  assert.equal(requests[1].id, 101, 'subsequent updates must use the reconciled server ID');
  assert.equal(environment.PhotoFlowData.getState().shoots[0].clientName, shootInput.clientName, 'partial update response must preserve local fields');
}

async function testQueuedClientAndShootReconciliation() {
  const requests = [];
  const environment = createEnvironment({
    online: false,
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (body.action === 'createClient') return jsonResponse({ client: { id: 202 } });
      if (body.action === 'createShoot') return jsonResponse({ shoot: { id: 303 } });
      return jsonResponse({ ok: true });
    },
  });
  await environment.PhotoFlowData.bootstrap(fallback);
  const clientResult = await environment.PhotoFlowData.mutate('createClient', { name: 'Петров Пётр', phone: '+7 900 000-00-00' });
  const temporaryClientId = environment.PhotoFlowData.getState().clients[0].id;
  assert.ok(temporaryClientId < 0);
  assert.equal(clientResult.queued, true);
  await environment.PhotoFlowData.mutate('createShoot', { ...shootInput, clientId: temporaryClientId, clientName: 'Петров Пётр' });

  environment.navigator.onLine = true;
  await environment.PhotoFlowData.sync();
  const state = environment.PhotoFlowData.getState();
  assert.equal(state.clients[0].id, 202);
  assert.equal(state.shoots[0].id, 303);
  assert.equal(state.shoots[0].clientId, 202);
  assert.equal(requests[0].data.__offlineId, undefined);
  assert.equal(requests[1].data.clientId, 202, 'queued shoot must be rewritten to the reconciled client ID');
  assert.equal(requests.some((request) => request.id < 0), false);
}

async function testPermanentFailuresRollback() {
  const initial = {
    ...fallback,
    shoots: [{ ...shootInput, id: 7, paidAmount: 0, status: 'processing' }],
  };
  const environment = createEnvironment({
    online: true,
    fetchImpl: async (url, init) => init?.method
      ? jsonResponse({ error: 'Validation failed' }, 422)
      : jsonResponse(initial),
  });
  await environment.PhotoFlowData.bootstrap(initial);

  const update = await environment.PhotoFlowData.mutate('updateShoot', { paidAmount: 50_000 }, 7);
  assert.equal(update.ok, false);
  assert.equal(environment.PhotoFlowData.getState().shoots[0].paidAmount, 0, 'rejected update must rollback');
  assert.equal(queueOf(environment).length, 0);

  const deletion = await environment.PhotoFlowData.mutate('deleteShoot', {}, 7);
  assert.equal(deletion.ok, false);
  assert.equal(environment.PhotoFlowData.getState().shoots[0].id, 7, 'rejected deletion must restore the card');
  assert.equal(queueOf(environment).length, 0);
}

async function testInvalidSuccessBodyIsNotAccepted() {
  const environment = createEnvironment({
    online: true,
    fetchImpl: async (url, init) => init?.method
      ? jsonResponse({ shoot: {} })
      : jsonResponse(fallback),
  });
  await environment.PhotoFlowData.bootstrap(fallback);
  const created = await environment.PhotoFlowData.mutate('createShoot', shootInput);
  assert.equal(created.ok, false, 'HTTP 200 with an invalid contract must not be treated as success');
  assert.equal(environment.PhotoFlowData.getState().shoots.length, 0, 'invalid create response must rollback');
  assert.equal(queueOf(environment).length, 0);
}

async function testSlowPermanentCreateFailureRollsBackBeforeReturn() {
  const environment = createEnvironment({
    online: true,
    fetchImpl: async (url, init) => {
      if (!init?.method) return jsonResponse(fallback);
      await new Promise((resolve) => setTimeout(resolve, 800));
      return jsonResponse({ error: 'Client data rejected' }, 422);
    },
  });
  await environment.PhotoFlowData.bootstrap(fallback);
  const created = await environment.PhotoFlowData.mutate('createShoot', shootInput);
  assert.equal(created.ok, false, 'create must wait for a definitive server rejection instead of closing the form');
  assert.equal(environment.PhotoFlowData.getState().shoots.length, 0);
  assert.equal(queueOf(environment).length, 0);
}

async function testRetryableApiFailureStaysLocal() {
  const environment = createEnvironment({
    online: true,
    fetchImpl: async () => jsonResponse({ error: 'not found' }, 404),
  });
  await environment.PhotoFlowData.bootstrap(fallback);
  const created = await environment.PhotoFlowData.mutate('createShoot', shootInput);
  assert.equal(created.ok, true);
  assert.equal(created.queued, true);
  assert.equal(environment.PhotoFlowData.getState().shoots.length, 1);
  assert.equal(queueOf(environment).length, 1);
}

async function testInvalidGetDoesNotEraseSnapshot() {
  const storage = new StorageMock();
  const stored = { ...fallback, shoots: [{ ...shootInput, id: 44 }] };
  storage.setItem(SNAPSHOT, JSON.stringify(stored));
  const environment = createEnvironment({
    online: true,
    storage,
    fetchImpl: async () => jsonResponse({ shoots: [] }),
  });
  await environment.PhotoFlowData.bootstrap(fallback);
  assert.equal(environment.PhotoFlowData.getState().shoots[0].id, 44, 'incomplete GET response must not erase state');
}

async function testLegacyDestructiveQueueEntriesAreRemoved() {
  const storage = new StorageMock();
  storage.setItem(OFFLINE_QUEUE, JSON.stringify([
    { key: 'old-1', action: 'deleteAllShoots', data: {} },
    { key: 'old-2', action: 'deleteActiveShoots', data: {} },
    { key: 'keep', action: 'savePreferences', data: { reminders: [3] } },
  ]));
  const environment = createEnvironment({ online: false, storage });
  await environment.PhotoFlowData.bootstrap(fallback);
  assert.deepEqual(queueOf(environment).map((item) => item.key), ['keep']);
}

(async () => {
  await testOfflineCrudAndReload();
  await testCreateAndServerIdReconciliation();
  await testQueuedClientAndShootReconciliation();
  await testPermanentFailuresRollback();
  await testInvalidSuccessBodyIsNotAccepted();
  await testSlowPermanentCreateFailureRollsBackBeforeReturn();
  await testRetryableApiFailureStaysLocal();
  await testInvalidGetDoesNotEraseSnapshot();
  await testLegacyDestructiveQueueEntriesAreRemoved();
  console.log('PhotoFlow data-layer regression: OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  CrmDataLayer,
  type CrmSnapshot,
  type QueueItem,
} from "../app/crm-data-layer.ts";
import {
  DEFAULT_TYPES,
  INITIAL_SHOOTS,
  type Client,
  type Shoot,
} from "../app/crm-data.ts";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) || null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const profile = {
  firstName: "Тест",
  lastName: "",
  phone: "",
  city: "",
  email: "test@example.com",
  goal: "0",
};

function snapshot(shoots: Shoot[] = [], clients: Client[] = []): CrmSnapshot {
  return {
    shoots,
    clients,
    types: DEFAULT_TYPES,
    reminders: [5, 1, 0],
    profile,
  };
}

const sampleShoot = INITIAL_SHOOTS[0];
const sampleClient: Client = {
  id: 41,
  name: sampleShoot.clientName,
  phone: "+7 900 000-00-00",
  email: "client@example.com",
  kind: "person",
  notes: "Важно",
};

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function serverShoot(id: number, clientId = 41, patch: Partial<Shoot> = {}): Shoot {
  return { ...sampleShoot, ...patch, id, clientId };
}

test("online create is optimistic and reconciles shoot/client IDs", async () => {
  let resolveResponse!: (response: Response) => void;
  let sent: Record<string, unknown> | undefined;
  const pendingResponse = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot(),
    online: () => true,
    createKey: () => "create-1",
    fetcher: async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return pendingResponse;
    },
  });
  const operation = layer.createShoot(sampleShoot);
  const optimistic = layer.getState().snapshot.shoots[0];
  assert.ok(optimistic.id < 0);
  assert.ok(Number(optimistic.clientId) < 0);
  resolveResponse(
    json({
      ...snapshot(
        [serverShoot(101)],
        [{ id: 41, name: sampleShoot.clientName, phone: "", email: "", kind: "person", notes: "" }],
      ),
      mutation: { action: "createShoot", shootId: 101, clientId: 41 },
    }),
  );
  const result = await operation;
  assert.equal(result.ok, true);
  assert.equal(layer.getState().snapshot.shoots[0].id, 101);
  assert.equal(layer.getState().snapshot.shoots[0].clientId, 41);
  const request = sent as { data: { id?: number; clientId?: number } };
  assert.equal(request.data.id, undefined);
  assert.notEqual(request.data.clientId, optimistic.clientId);
});

test("offline create updates state and persists one queued operation", async () => {
  const storage = new MemoryStorage();
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot(),
    storage,
    online: () => false,
    createKey: () => "offline-create",
  });
  const result = await layer.createShoot(sampleShoot);
  assert.equal(result.ok, true);
  assert.equal(result.queued, true);
  assert.ok(layer.getState().snapshot.shoots[0].id < 0);
  assert.equal(layer.getState().queued, 1);
  assert.equal(JSON.parse(storage.getItem("fotocrm:offline-queue:v1") || "[]").length, 1);
});

test("update changes UI before the server confirms and accepts a partial shoot", async () => {
  const original = serverShoot(7);
  let resolveResponse!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([original]),
    online: () => true,
    fetcher: async () => response,
  });
  const operation = layer.updateShoot(7, { location: "Новая локация" });
  assert.equal(layer.getState().snapshot.shoots[0].location, "Новая локация");
  resolveResponse(json({ shoot: { id: 7, location: "Новая локация" } }));
  assert.equal((await operation).ok, true);
  assert.equal(layer.getState().snapshot.shoots[0].clientName, original.clientName);
});

test("delete removes a card optimistically", async () => {
  const original = serverShoot(8);
  let resolveResponse!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([original]),
    online: () => true,
    fetcher: async () => response,
  });
  const operation = layer.deleteShoot(8);
  assert.equal(layer.getState().snapshot.shoots.length, 0);
  resolveResponse(json(snapshot()));
  assert.equal((await operation).ok, true);
});

test("delivered and returnToWork update state immediately", async () => {
  let current = serverShoot(9);
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([current]),
    online: () => true,
    fetcher: async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      current = { ...current, ...request.data };
      return json(snapshot([current]));
    },
  });
  const delivered = layer.setDelivered(9);
  assert.equal(layer.getState().snapshot.shoots[0].delivered, true);
  await delivered;
  const returned = layer.returnToWork(9);
  assert.equal(layer.getState().snapshot.shoots[0].delivered, false);
  assert.equal(layer.getState().snapshot.shoots[0].status, "processing");
  await returned;
});

test("payment sets paidAmount to the full price immediately", async () => {
  const original = serverShoot(10, 41, { price: 42000, paidAmount: 5000 });
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([original]),
    online: () => true,
    fetcher: async () => json(snapshot([{ ...original, paidAmount: 42000 }])),
  });
  const operation = layer.payShoot(10);
  assert.equal(layer.getState().snapshot.shoots[0].paidAmount, 42000);
  await operation;
});

test("permanent failure rolls back optimistic state", async () => {
  const original = serverShoot(11);
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([original]),
    online: () => true,
    fetcher: async () => json({ error: "Отклонено" }, 422),
  });
  const result = await layer.updateShoot(11, { location: "Не сохранится" });
  assert.equal(result.ok, false);
  assert.equal(layer.getState().snapshot.shoots[0].location, original.location);
  assert.equal(layer.getState().queued, 0);
});

test("retryable failure keeps optimistic state and queue", async () => {
  const original = serverShoot(12);
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([original]),
    online: () => true,
    fetcher: async () => json({ error: "Временно недоступно" }, 503),
  });
  const result = await layer.updateShoot(12, { location: "Офлайн-изменение" });
  assert.equal(result.ok, true);
  assert.equal(result.queued, true);
  assert.equal(layer.getState().snapshot.shoots[0].location, "Офлайн-изменение");
  assert.equal(layer.getState().queued, 1);
});

test("invalid HTTP 200 response rolls back instead of confirming success", async () => {
  const original = serverShoot(13);
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([original]),
    online: () => true,
    fetcher: async () => json({ ok: true }),
  });
  const result = await layer.deleteShoot(13);
  assert.equal(result.ok, false);
  assert.equal(layer.getState().snapshot.shoots.length, 1);
});

test("incomplete GET never erases a valid cached snapshot", async () => {
  const storage = new MemoryStorage();
  const cached = snapshot([serverShoot(14)]);
  storage.setItem("fotocrm:snapshot:v2", JSON.stringify(cached));
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot(),
    storage,
    online: () => true,
    fetcher: async () => json({ clients: [] }),
  });
  await layer.bootstrap();
  assert.equal(layer.getState().snapshot.shoots[0].id, 14);
});

test("queued create reconciles IDs and rewrites following operations", async () => {
  const storage = new MemoryStorage();
  const temporary = serverShoot(-20, -21, { location: "Локально" });
  const before = snapshot();
  const cached = snapshot(
    [temporary],
    [{ id: -21, name: temporary.clientName, phone: "", email: "", kind: "person", notes: "" }],
  );
  const queue: QueueItem[] = [
    {
      key: "create",
      action: "createShoot",
      data: { ...temporary, __offlineId: -20, __offlineClientId: -21 },
      before,
    },
    {
      key: "update",
      action: "updateShoot",
      id: -20,
      data: { location: "После создания" },
      before: cached,
    },
  ];
  storage.setItem("fotocrm:snapshot:v2", JSON.stringify(cached));
  storage.setItem("fotocrm:offline-queue:v1", JSON.stringify(queue));
  const sentIds: Array<number | undefined> = [];
  let post = 0;
  const created = serverShoot(201, 301, { location: "Локально" });
  const layer = new CrmDataLayer({
    initialSnapshot: before,
    storage,
    online: () => true,
    fetcher: async (_url, init) => {
      if (!init?.method) return json(before);
      const request = JSON.parse(String(init.body));
      sentIds.push(request.id);
      post += 1;
      return post === 1
        ? json({
            ...snapshot(
              [created],
              [{ id: 301, name: created.clientName, phone: "", email: "", kind: "person", notes: "" }],
            ),
            mutation: { action: "createShoot", shootId: 201, clientId: 301 },
          })
        : json(snapshot([{ ...created, location: "После создания" }]));
    },
  });
  await layer.bootstrap();
  assert.deepEqual(sentIds, [undefined, 201]);
  assert.equal(layer.getState().snapshot.shoots[0].id, 201);
  assert.equal(layer.getState().snapshot.shoots[0].clientId, 301);
  assert.equal(layer.getState().snapshot.shoots[0].location, "После создания");
  assert.equal(layer.getState().queued, 0);
});

test("deleting an unsynced temporary shoot removes its create without API delete", async () => {
  let requests = 0;
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot(),
    online: () => false,
    fetcher: async () => {
      requests += 1;
      return json(snapshot());
    },
  });
  await layer.createShoot(sampleShoot);
  const temporaryId = layer.getState().snapshot.shoots[0].id;
  const result = await layer.deleteShoot(temporaryId);
  assert.equal(result.ok, true);
  assert.equal(layer.getState().snapshot.shoots.length, 0);
  assert.equal(layer.getState().queued, 0);
  assert.equal(requests, 0);
});

test("client rename is optimistic, preserves id/data and updates linked shoot name", async () => {
  const linkedShoot = serverShoot(31, sampleClient.id);
  let resolveResponse!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([linkedShoot], [sampleClient]),
    online: () => true,
    fetcher: async () => response,
  });
  const operation = layer.updateClient(sampleClient.id, { name: "Новое имя" });
  const optimistic = layer.getState().snapshot;
  assert.equal(optimistic.clients[0].id, sampleClient.id);
  assert.equal(optimistic.clients[0].phone, sampleClient.phone);
  assert.equal(optimistic.shoots[0].clientId, sampleClient.id);
  assert.equal(optimistic.shoots[0].clientName, "Новое имя");
  resolveResponse(json(snapshot(
    [{ ...linkedShoot, clientName: "Новое имя" }],
    [{ ...sampleClient, name: "Новое имя" }],
  )));
  assert.equal((await operation).ok, true);
});

test("linked client deletion is rejected without touching shoots or the API", async () => {
  let requests = 0;
  const linkedShoot = serverShoot(32, sampleClient.id);
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([linkedShoot], [sampleClient]),
    online: () => true,
    fetcher: async () => {
      requests += 1;
      return json(snapshot());
    },
  });
  const result = await layer.deleteClient(sampleClient.id);
  assert.equal(result.ok, false);
  assert.equal(layer.getState().snapshot.clients.length, 1);
  assert.equal(layer.getState().snapshot.shoots.length, 1);
  assert.equal(requests, 0);
});

test("unlinked client deletion is optimistic and can be queued offline", async () => {
  const layer = new CrmDataLayer({
    initialSnapshot: snapshot([], [sampleClient]),
    online: () => false,
  });
  const result = await layer.deleteClient(sampleClient.id);
  assert.equal(result.ok, true);
  assert.equal(result.queued, true);
  assert.equal(layer.getState().snapshot.clients.length, 0);
  assert.equal(layer.getState().queued, 1);
});

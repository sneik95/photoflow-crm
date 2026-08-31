import type { Client, Shoot, ShootType } from "./crm-data";

export type CrmProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  email: string;
  goal: string;
};

export type CrmSnapshot = {
  clients: Client[];
  shoots: Shoot[];
  types: ShootType[];
  reminders: number[];
  profile: CrmProfile;
  preferences?: {
    showAverage?: boolean;
    deliveryReminderDays?: number;
  };
};

type ShootAction = "createShoot" | "updateShoot" | "deleteShoot";
type ClientAction = "createClient" | "updateClient" | "deleteClient";
type MutationAction = ShootAction | ClientAction;

export type QueueItem = {
  key: string;
  action: MutationAction;
  data: Record<string, unknown>;
  id?: number;
  before: CrmSnapshot;
};

export type DataLayerState = {
  snapshot: CrmSnapshot;
  queued: number;
  syncing: boolean;
  online: boolean;
};

export type MutationResult = {
  ok: boolean;
  queued: boolean;
  error?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type FetchLike = typeof fetch;

type DataLayerOptions = {
  initialSnapshot: CrmSnapshot;
  storage?: StorageLike;
  fetcher?: FetchLike;
  online?: () => boolean;
  createKey?: () => string;
};

type ApiPayload = Record<string, unknown> & {
  error?: string;
  mutation?: {
    action?: string;
    shootId?: number;
    clientId?: number | null;
  };
  shoot?: Partial<Shoot> & { id: number };
};

const SNAPSHOT_KEY = "fotocrm:snapshot:v2";
const QUEUE_KEY = "fotocrm:offline-queue:v1";

function cloneSnapshot(snapshot: CrmSnapshot): CrmSnapshot {
  return structuredClone(snapshot);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isClient(value: unknown): value is Client {
  return (
    isRecord(value) &&
    Number.isFinite(Number(value.id)) &&
    typeof value.name === "string" &&
    typeof value.phone === "string"
  );
}

function isShoot(value: unknown): value is Shoot {
  return (
    isRecord(value) &&
    Number.isFinite(Number(value.id)) &&
    typeof value.clientName === "string" &&
    typeof value.type === "string" &&
    typeof value.startAt === "string" &&
    typeof value.endAt === "string" &&
    Number.isFinite(Number(value.price)) &&
    Number.isFinite(Number(value.paidAmount))
  );
}

function isPartialShoot(value: unknown): value is Partial<Shoot> & { id: number } {
  if (!isRecord(value) || !Number.isInteger(Number(value.id)) || Number(value.id) <= 0) {
    return false;
  }
  const numericFields = [
    "price",
    "paidAmount",
    "deliveryDays",
    "travelMinutes",
    "editingHours",
    "travelCost",
    "otherCosts",
  ];
  return numericFields.every(
    (field) => value[field] === undefined || Number.isFinite(Number(value[field])),
  );
}

export function normalizeSnapshot(
  value: unknown,
  fallback: CrmSnapshot,
): CrmSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.clients) || !Array.isArray(value.shoots)) {
    return null;
  }
  if (!value.clients.every(isClient) || !value.shoots.every(isShoot)) return null;
  return {
    clients: value.clients as Client[],
    shoots: value.shoots as Shoot[],
    types: Array.isArray(value.types) ? (value.types as ShootType[]) : fallback.types,
    reminders: Array.isArray(value.reminders)
      ? value.reminders.map(Number).filter(Number.isFinite)
      : fallback.reminders,
    profile: isRecord(value.profile)
      ? ({ ...fallback.profile, ...value.profile } as CrmProfile)
      : fallback.profile,
    preferences: isRecord(value.preferences)
      ? { ...fallback.preferences, ...value.preferences }
      : fallback.preferences,
  };
}

function applyMutation(
  snapshot: CrmSnapshot,
  action: MutationAction,
  data: Record<string, unknown>,
  id?: number,
): CrmSnapshot {
  if (action === "createClient") {
    const client = data as unknown as Client;
    if (snapshot.clients.some((item) => item.id === client.id)) return snapshot;
    return { ...snapshot, clients: [...snapshot.clients, client] };
  }
  if (action === "updateClient" && id !== undefined) {
    const name = typeof data.name === "string" ? data.name : undefined;
    return {
      ...snapshot,
      clients: snapshot.clients.map((client) =>
        client.id === id ? { ...client, ...(data as Partial<Client>) } : client,
      ),
      shoots: name === undefined
        ? snapshot.shoots
        : snapshot.shoots.map((shoot) =>
          shoot.clientId === id ? { ...shoot, clientName: name } : shoot,
        ),
    };
  }
  if (action === "deleteClient" && id !== undefined) {
    return {
      ...snapshot,
      clients: snapshot.clients.filter((client) => client.id !== id),
    };
  }
  if (action === "createShoot") {
    const shoot = data as unknown as Shoot;
    if (snapshot.shoots.some((item) => item.id === shoot.id)) return snapshot;
    let clients = snapshot.clients;
    if (
      Number(shoot.clientId) < 0 &&
      !clients.some((client) => client.id === shoot.clientId)
    ) {
      clients = [
        ...clients,
        {
          id: Number(shoot.clientId),
          name: shoot.clientName,
          phone: String(data.clientPhone || ""),
          email: "",
          kind: "person",
          notes: "",
        },
      ];
    }
    return { ...snapshot, clients, shoots: [...snapshot.shoots, shoot] };
  }
  if (action === "updateShoot" && id !== undefined) {
    return {
      ...snapshot,
      shoots: snapshot.shoots.map((shoot) =>
        shoot.id === id ? { ...shoot, ...(data as Partial<Shoot>) } : shoot,
      ),
    };
  }
  if (action === "deleteShoot" && id !== undefined) {
    const deleted = snapshot.shoots.find((shoot) => shoot.id === id);
    const shoots = snapshot.shoots.filter((shoot) => shoot.id !== id);
    const clients =
      deleted && Number(deleted.clientId) < 0 &&
      !shoots.some((shoot) => shoot.clientId === deleted.clientId)
        ? snapshot.clients.filter((client) => client.id !== deleted.clientId)
        : snapshot.clients;
    return { ...snapshot, clients, shoots };
  }
  return snapshot;
}

function replayQueue(snapshot: CrmSnapshot, queue: QueueItem[]) {
  return queue.reduce(
    (current, item) => applyMutation(current, item.action, item.data, item.id),
    snapshot,
  );
}

function shootFingerprint(shoot: Partial<Shoot>) {
  return `${shoot.clientName || ""}\u0000${shoot.startAt || ""}\u0000${shoot.type || ""}`;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export class CrmDataLayer {
  private snapshot: CrmSnapshot;
  private queue: QueueItem[] = [];
  private syncing = false;
  private onlineState: boolean;
  private listeners = new Set<(state: DataLayerState) => void>();
  private readonly storage?: StorageLike;
  private readonly fetcher?: FetchLike;
  private readonly isOnline: () => boolean;
  private readonly createKey: () => string;
  private nextTemporaryId = -1;

  constructor(options: DataLayerOptions) {
    this.snapshot = cloneSnapshot(options.initialSnapshot);
    this.storage = options.storage;
    this.fetcher = options.fetcher;
    this.isOnline = options.online || (() => true);
    this.onlineState = this.isOnline();
    this.createKey = options.createKey || (() => crypto.randomUUID());
    this.nextTemporaryId = this.findNextTemporaryId(this.snapshot);
  }

  subscribe(listener: (state: DataLayerState) => void) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): DataLayerState {
    return {
      snapshot: cloneSnapshot(this.snapshot),
      queued: this.queue.length,
      syncing: this.syncing,
      online: this.onlineState,
    };
  }

  setOnline(online: boolean) {
    this.onlineState = online;
    this.emit();
    if (online) void this.flushQueue();
  }

  acceptServerSnapshot(value: unknown) {
    const normalized = normalizeSnapshot(value, this.snapshot);
    if (!normalized) return false;
    this.snapshot = replayQueue(normalized, this.queue);
    this.persist();
    this.emit();
    return true;
  }

  async bootstrap() {
    const cached = this.readSnapshot();
    this.queue = this.readQueue();
    if (cached) this.snapshot = cached;
    else if (this.queue.length) this.snapshot = replayQueue(this.snapshot, this.queue);
    this.nextTemporaryId = this.findNextTemporaryId(this.snapshot);
    this.onlineState = this.isOnline();
    this.emit();

    if (!this.onlineState || !this.fetcher) return;
    try {
      const response = await this.fetcher("/api/crm");
      const body = await this.readJson(response);
      if (response.ok) {
        const server = normalizeSnapshot(body, this.snapshot);
        if (server) {
          this.snapshot = replayQueue(server, this.queue);
          this.persist();
          this.emit();
        }
      }
    } catch {
      // Keep the validated snapshot. Pending writes will be retried later.
    }
    await this.flushQueue();
  }

  async createShoot(input: Omit<Shoot, "id"> & { clientPhone?: string }) {
    const temporaryShootId = this.takeTemporaryId();
    const knownClient = this.snapshot.clients.find(
      (client) =>
        (Number(input.clientId) > 0 && client.id === input.clientId) ||
        client.name.trim().toLowerCase() === input.clientName.trim().toLowerCase(),
    );
    const temporaryClientId = knownClient?.id || this.takeTemporaryId();
    const data: Record<string, unknown> = {
      ...input,
      id: temporaryShootId,
      clientId: temporaryClientId,
      __offlineId: temporaryShootId,
      __offlineClientId: temporaryClientId < 0 ? temporaryClientId : undefined,
    };
    return this.enqueue("createShoot", data);
  }

  async createClient(input: Omit<Client, "id">) {
    const temporaryClientId = this.takeTemporaryId();
    return this.enqueue("createClient", {
      ...input,
      id: temporaryClientId,
      __offlineId: temporaryClientId,
    });
  }

  async updateClient(id: number, patch: Partial<Client>) {
    if (id < 0) {
      const create = this.queue.find(
        (item) =>
          item.action === "createClient" && Number(item.data.__offlineId) === id,
      );
      if (create) {
        create.data = { ...create.data, ...patch, id, __offlineId: id };
        this.snapshot = applyMutation(this.snapshot, "updateClient", patch, id);
        this.persist();
        this.emit();
        return { ok: true, queued: true } satisfies MutationResult;
      }
    }
    return this.enqueue("updateClient", patch as Record<string, unknown>, id);
  }

  async deleteClient(id: number) {
    if (this.snapshot.shoots.some((shoot) => shoot.clientId === id)) {
      return {
        ok: false,
        queued: false,
        error: "Клиент связан со съёмками и не может быть удалён",
      } satisfies MutationResult;
    }
    if (id < 0) {
      const hasPendingCreate = this.queue.some(
        (item) =>
          item.action === "createClient" && Number(item.data.__offlineId) === id,
      );
      if (hasPendingCreate) {
        this.queue = this.queue.filter(
          (item) =>
            !(
              (item.action === "createClient" && Number(item.data.__offlineId) === id) ||
              item.id === id
            ),
        );
        this.snapshot = applyMutation(this.snapshot, "deleteClient", {}, id);
        this.persist();
        this.emit();
        return { ok: true, queued: false } satisfies MutationResult;
      }
    }
    return this.enqueue("deleteClient", {}, id);
  }

  async updateShoot(id: number, patch: Partial<Shoot>) {
    if (id < 0) {
      const create = this.queue.find(
        (item) =>
          item.action === "createShoot" && Number(item.data.__offlineId) === id,
      );
      if (create) {
        create.data = { ...create.data, ...patch, id, __offlineId: id };
        this.snapshot = applyMutation(this.snapshot, "updateShoot", patch, id);
        this.persist();
        this.emit();
        return { ok: true, queued: true } satisfies MutationResult;
      }
    }
    return this.enqueue("updateShoot", patch as Record<string, unknown>, id);
  }

  async deleteShoot(id: number) {
    if (id < 0) {
      const hasPendingCreate = this.queue.some(
        (item) =>
          item.action === "createShoot" && Number(item.data.__offlineId) === id,
      );
      if (hasPendingCreate) {
        this.queue = this.queue.filter(
          (item) =>
            !(
              (item.action === "createShoot" && Number(item.data.__offlineId) === id) ||
              item.id === id
            ),
        );
        this.snapshot = applyMutation(this.snapshot, "deleteShoot", {}, id);
        this.persist();
        this.emit();
        return { ok: true, queued: false } satisfies MutationResult;
      }
    }
    return this.enqueue("deleteShoot", {}, id);
  }

  setDelivered(id: number) {
    return this.updateShoot(id, {
      delivered: true,
      archived: true,
      status: "delivered",
    });
  }

  returnToWork(id: number, status: Shoot["status"] = "processing") {
    return this.updateShoot(id, {
      delivered: false,
      archived: false,
      status,
    });
  }

  payShoot(id: number) {
    const shoot = this.snapshot.shoots.find((item) => item.id === id);
    if (!shoot) {
      return Promise.resolve({
        ok: false,
        queued: false,
        error: "Съёмка не найдена",
      } satisfies MutationResult);
    }
    return this.updateShoot(id, { paidAmount: shoot.price });
  }

  async flushQueue(): Promise<MutationResult> {
    if (this.syncing || !this.queue.length || !this.onlineState || !this.fetcher) {
      return { ok: true, queued: this.queue.length > 0 };
    }
    this.syncing = true;
    this.emit();
    let permanentError: string | undefined;
    try {
      while (this.queue.length && this.onlineState) {
        const item = this.queue[0];
        if (
          item.id !== undefined &&
          item.id < 0 &&
          item.action !== "createShoot" &&
          item.action !== "createClient"
        ) {
          break;
        }
        let response: Response;
        let body: ApiPayload;
        try {
          response = await this.fetcher("/api/crm", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(this.serverPayload(item)),
          });
          body = (await this.readJson(response)) as ApiPayload;
        } catch {
          break;
        }

        if (!response.ok) {
          if (isRetryableStatus(response.status)) break;
          permanentError = body.error || "Сервер отклонил изменение";
          this.rollback(item);
          continue;
        }

        const serverSnapshot = normalizeSnapshot(body, this.snapshot);
        const partialShoot = isPartialShoot(body.shoot) ? body.shoot : null;
        const createdShootId = Number(body.mutation?.shootId);
        const createdClientId = Number(body.mutation?.clientId);
        const validShootCreate =
          item.action !== "createShoot" ||
          (Number.isInteger(createdShootId) && createdShootId > 0) ||
          Boolean(serverSnapshot?.shoots.some((shoot) => shootFingerprint(shoot) === shootFingerprint(item.data as Partial<Shoot>)));
        const validClientCreate =
          item.action !== "createClient" ||
          (Number.isInteger(createdClientId) && createdClientId > 0);
        if (
          (!serverSnapshot && !partialShoot) ||
          !validShootCreate ||
          !validClientCreate
        ) {
          permanentError = body.error || "Сервер вернул неполный ответ";
          this.rollback(item);
          continue;
        }

        this.queue.shift();
        if (item.action === "createShoot") {
          const serverShoot =
            serverSnapshot?.shoots.find((shoot) => shoot.id === createdShootId) ||
            serverSnapshot?.shoots.find(
              (shoot) => shootFingerprint(shoot) === shootFingerprint(item.data as Partial<Shoot>),
            ) ||
            partialShoot;
          if (!serverShoot || serverShoot.id <= 0) {
            permanentError = "Сервер не подтвердил создание съёмки";
            this.rollback(item);
            continue;
          }
          this.reconcileIds(
            Number(item.data.__offlineId),
            serverShoot.id,
            Number(item.data.__offlineClientId),
            Number(body.mutation?.clientId || serverShoot.clientId),
          );
        }
        if (item.action === "createClient") {
          this.reconcileClientId(
            Number(item.data.__offlineId),
            createdClientId,
          );
        }

        if (serverSnapshot) {
          this.snapshot = replayQueue(serverSnapshot, this.queue);
        } else if (partialShoot) {
          this.snapshot = {
            ...this.snapshot,
            shoots: this.snapshot.shoots.map((shoot) =>
              shoot.id === partialShoot.id ? { ...shoot, ...partialShoot } : shoot,
            ),
          };
        }
        this.persist();
        this.emit();
      }
    } finally {
      this.syncing = false;
      this.persist();
      this.emit();
    }
    return {
      ok: !permanentError,
      queued: this.queue.length > 0,
      error: permanentError,
    };
  }

  private async enqueue(
    action: MutationAction,
    data: Record<string, unknown>,
    id?: number,
  ): Promise<MutationResult> {
    const before = cloneSnapshot(this.snapshot);
    const item: QueueItem = {
      key: this.createKey(),
      action,
      data,
      id,
      before,
    };
    this.queue.push(item);
    this.snapshot = applyMutation(this.snapshot, action, data, id);
    this.persist();
    this.emit();
    if (!this.onlineState) return { ok: true, queued: true };
    return this.flushQueue();
  }

  private rollback(item: QueueItem) {
    this.queue = this.queue.filter((candidate) => candidate.key !== item.key);
    this.snapshot = replayQueue(item.before, this.queue);
    this.persist();
    this.emit();
  }

  private reconcileIds(
    temporaryShootId: number,
    serverShootId: number,
    temporaryClientId: number,
    serverClientId: number,
  ) {
    this.queue = this.queue.map((item) => ({
      ...item,
      id: item.id === temporaryShootId ? serverShootId : item.id,
      data: {
        ...item.data,
        ...(Number(item.data.id) === temporaryShootId ? { id: serverShootId } : {}),
        ...(Number(item.data.clientId) === temporaryClientId && serverClientId > 0
          ? { clientId: serverClientId }
          : {}),
      },
    }));
    this.snapshot = {
      ...this.snapshot,
      clients: this.snapshot.clients.map((client) =>
        client.id === temporaryClientId && serverClientId > 0
          ? { ...client, id: serverClientId }
          : client,
      ),
      shoots: this.snapshot.shoots.map((shoot) =>
        shoot.id === temporaryShootId
          ? {
              ...shoot,
              id: serverShootId,
              clientId:
                shoot.clientId === temporaryClientId && serverClientId > 0
                  ? serverClientId
                  : shoot.clientId,
            }
          : shoot,
      ),
    };
  }

  private reconcileClientId(temporaryClientId: number, serverClientId: number) {
    this.queue = this.queue.map((item) => ({
      ...item,
      id: item.id === temporaryClientId ? serverClientId : item.id,
      data: {
        ...item.data,
        ...(Number(item.data.id) === temporaryClientId ? { id: serverClientId } : {}),
        ...(Number(item.data.clientId) === temporaryClientId
          ? { clientId: serverClientId }
          : {}),
      },
    }));
    this.snapshot = {
      ...this.snapshot,
      clients: this.snapshot.clients.map((client) =>
        client.id === temporaryClientId
          ? { ...client, id: serverClientId }
          : client,
      ),
      shoots: this.snapshot.shoots.map((shoot) =>
        shoot.clientId === temporaryClientId
          ? { ...shoot, clientId: serverClientId }
          : shoot,
      ),
    };
  }

  private serverPayload(item: QueueItem) {
    const data = { ...item.data };
    delete data.id;
    delete data.__offlineId;
    delete data.__offlineClientId;
    if (Number(data.clientId) < 0) data.clientId = null;
    return {
      action: item.action,
      data,
      id: item.id !== undefined && item.id > 0 ? item.id : undefined,
    };
  }

  private takeTemporaryId() {
    const value = this.nextTemporaryId;
    this.nextTemporaryId -= 1;
    return value;
  }

  private findNextTemporaryId(snapshot: CrmSnapshot) {
    const values = [
      ...snapshot.shoots.map((shoot) => shoot.id),
      ...snapshot.clients.map((client) => client.id),
    ].filter((id) => id < 0);
    return Math.min(-1, ...values) - 1;
  }

  private readSnapshot() {
    if (!this.storage) return null;
    try {
      const parsed = JSON.parse(this.storage.getItem(SNAPSHOT_KEY) || "null");
      return normalizeSnapshot(parsed, this.snapshot);
    } catch {
      return null;
    }
  }

  private readQueue(): QueueItem[] {
    if (!this.storage) return [];
    try {
      const parsed = JSON.parse(this.storage.getItem(QUEUE_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is QueueItem =>
              isRecord(item) &&
              typeof item.key === "string" &&
              (item.action === "createShoot" ||
                item.action === "updateShoot" ||
                item.action === "deleteShoot" ||
                item.action === "createClient" ||
                item.action === "updateClient" ||
                item.action === "deleteClient") &&
              isRecord(item.data) &&
              Boolean(normalizeSnapshot(item.before, this.snapshot)),
          )
        : [];
    } catch {
      return [];
    }
  }

  private persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(SNAPSHOT_KEY, JSON.stringify(this.snapshot));
      this.storage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // Private browsing can reject storage writes; React state remains authoritative.
    }
  }

  private async readJson(response: Response): Promise<ApiPayload> {
    try {
      const value = await response.json();
      return isRecord(value) ? (value as ApiPayload) : {};
    } catch {
      return {};
    }
  }

  private emit() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

export function createBrowserDataLayer(initialSnapshot: CrmSnapshot) {
  return new CrmDataLayer({
    initialSnapshot,
    storage: window.localStorage,
    fetcher: window.fetch.bind(window),
    online: () => navigator.onLine,
  });
}

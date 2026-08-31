import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients, preferences, shoots } from "../../../db/schema";
import {
  DEFAULT_TYPES,
  INITIAL_CLIENTS,
  INITIAL_SHOOTS,
  defaultEquipment,
  defaultShotList,
} from "../../crm-data";
import { initialShootTimeline } from "../../crm-new-shoot";

const DEMO_OWNER = "demo@fotocrm.local";

function ownerFrom(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || DEMO_OWNER;
}

function safeTypes(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : DEFAULT_TYPES;
  } catch {
    return DEFAULT_TYPES;
  }
}

function safeReminders(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length === 3 ? parsed : [5, 1, 0];
  } catch {
    return [5, 1, 0];
  }
}

function safeList<T>(value: string, fallback: T[]) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function portalToken() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 24);
}

async function ensureAccount(owner: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(preferences)
    .where(eq(preferences.owner, owner))
    .limit(1);

  if (existing) return;

  await db
    .insert(preferences)
    .values({
      owner,
      firstName: owner === DEMO_OWNER ? "Кристина" : "",
      lastName: owner === DEMO_OWNER ? "Вениченко" : "",
      city: owner === DEMO_OWNER ? "Новороссийск" : "",
      typesJson: JSON.stringify(DEFAULT_TYPES),
    })
    .onConflictDoNothing({ target: preferences.owner });

  const existingClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.owner, owner))
    .limit(1);
  if (existingClients.length) return;

  const seededClients = await db
    .insert(clients)
    .values(INITIAL_CLIENTS.map(({ id: _id, ...client }) => ({ ...client, owner })))
    .returning();

  const clientIdByName = new Map(
    seededClients.map((client) => [client.name, client.id]),
  );
  await db.insert(shoots).values(
    INITIAL_SHOOTS.map(
      ({ id: _id, equipment, shotList, timeline, ...shoot }) => ({
        ...shoot,
        owner,
        portalToken: portalToken(),
        equipmentJson: JSON.stringify(equipment),
        shotListJson: JSON.stringify(shotList),
        timelineJson: JSON.stringify(timeline),
        clientId: clientIdByName.get(shoot.clientName) || null,
      }),
    ),
  );
}

async function snapshot(owner: string) {
  const db = getDb();
  await ensureAccount(owner);
  const [clientRows, rawShootRows, [preference]] = await Promise.all([
    db.select().from(clients).where(eq(clients.owner, owner)).orderBy(asc(clients.name)),
    db.select().from(shoots).where(eq(shoots.owner, owner)).orderBy(asc(shoots.startAt)),
    db.select().from(preferences).where(eq(preferences.owner, owner)).limit(1),
  ]);

  const shootRows = await Promise.all(
    rawShootRows.map(async (databaseRow) => {
      let row = databaseRow;
      const demo = INITIAL_SHOOTS.find(
        (item) =>
          item.clientName === row.clientName && item.startAt === row.startAt,
      );
      const needsFeatureBackfill =
        demo &&
        !row.location &&
        row.editingHours === 0 &&
        row.travelCost === 0 &&
        row.otherCosts === 0 &&
        row.equipmentJson === "[]" &&
        row.shotListJson === "[]" &&
        row.timelineJson === "[]";
      if (needsFeatureBackfill) {
        const featureValues = {
          status: demo.status,
          location: demo.location,
          travelMinutes: demo.travelMinutes,
          organizerName: demo.organizerName,
          organizerPhone: demo.organizerPhone,
          editingHours: demo.editingHours,
          travelCost: demo.travelCost,
          otherCosts: demo.otherCosts,
          equipmentJson: JSON.stringify(demo.equipment),
          shotListJson: JSON.stringify(demo.shotList),
          timelineJson: JSON.stringify(demo.timeline),
          clientGuide: demo.clientGuide,
        };
        await db
          .update(shoots)
          .set(featureValues)
          .where(and(eq(shoots.owner, owner), eq(shoots.id, row.id)));
        row = { ...row, ...featureValues };
      }
      const token =
        !row.portalToken || row.portalToken.endsWith("-demo-2026")
          ? portalToken()
          : row.portalToken;
      if (token !== row.portalToken) {
        await db
          .update(shoots)
          .set({ portalToken: token })
          .where(and(eq(shoots.owner, owner), eq(shoots.id, row.id)));
      }
      const { equipmentJson, shotListJson, timelineJson, ...shoot } = row;
      return {
        ...shoot,
        portalToken: token,
        equipment: safeList(equipmentJson, []),
        shotList: safeList(shotListJson, defaultShotList(row.type)),
        timeline: safeList(timelineJson, []),
      };
    }),
  );

  return {
    clients: clientRows,
    shoots: shootRows,
    types: safeTypes(preference.typesJson),
    reminders: safeReminders(preference.remindersJson),
    profile: {
      firstName: preference.firstName,
      lastName: preference.lastName,
      phone: preference.phone,
      city: preference.city,
      email: owner === DEMO_OWNER ? "kristina@example.ru" : owner,
      goal: String(preference.annualGoal),
    },
    preferences: {
      showAverage: preference.showAverage,
      deliveryReminderDays: preference.deliveryReminderDays,
    },
  };
}

export async function GET(request: Request) {
  try {
    return Response.json(await snapshot(ownerFrom(request)));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить данные" },
      { status: 500 },
    );
  }
}

type Payload = {
  action?: string;
  id?: number;
  data?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const owner = ownerFrom(request);
  try {
    await ensureAccount(owner);
    const payload = (await request.json()) as Payload;
    const data = payload.data || {};
    const db = getDb();
    let mutation: {
      action: string;
      shootId?: number;
      clientId?: number | null;
    } | null = null;

    if (payload.action === "createClient") {
      const name = String(data.name || "").trim();
      if (!name) {
        return Response.json({ error: "Укажите имя клиента" }, { status: 400 });
      }
      const [createdClient] = await db.insert(clients).values({
        owner,
        name,
        phone: String(data.phone || ""),
        email: String(data.email || ""),
        kind: data.kind === "company" ? "company" : "person",
        notes: String(data.notes || ""),
      }).returning({ id: clients.id });
      if (!createdClient?.id) {
        return Response.json(
          { error: "Сервер не подтвердил создание клиента" },
          { status: 500 },
        );
      }
      mutation = { action: "createClient", clientId: createdClient.id };
    } else if (payload.action === "updateClient" && payload.id) {
      const clientId = Number(payload.id);
      const name = String(data.name || "").trim();
      if (clientId <= 0) {
        return Response.json(
          { error: "Временный ID нельзя отправлять на сервер" },
          { status: 400 },
        );
      }
      if (!name) {
        return Response.json({ error: "Укажите имя клиента" }, { status: 400 });
      }
      const updated = await db
        .update(clients)
        .set({ name })
        .where(and(eq(clients.owner, owner), eq(clients.id, clientId)))
        .returning({ id: clients.id });
      if (!updated.length) {
        return Response.json({ error: "Клиент не найден" }, { status: 404 });
      }
      await db
        .update(shoots)
        .set({ clientName: name })
        .where(and(eq(shoots.owner, owner), eq(shoots.clientId, clientId)));
      mutation = { action: "updateClient", clientId };
    } else if (payload.action === "createShoot") {
      const clientName = String(data.clientName || "").trim();
      const hasClientPhone = typeof data.clientPhone === "string";
      const clientPhone = String(data.clientPhone || "").trim();
      const type = String(data.type || "").trim();
      if (!clientName || !type || !data.startAt || !data.endAt) {
        return Response.json(
          { error: "Заполните клиента, тип, дату и время" },
          { status: 400 },
        );
      }
      let clientId = Number(data.clientId) > 0 ? Number(data.clientId) : null;
      let [matchingClient] = clientId
        ? await db
          .select({ id: clients.id, name: clients.name, phone: clients.phone })
          .from(clients)
          .where(and(eq(clients.owner, owner), eq(clients.id, clientId)))
          .limit(1)
        : await db
          .select({ id: clients.id, name: clients.name, phone: clients.phone })
          .from(clients)
          .where(and(eq(clients.owner, owner), eq(clients.name, clientName)))
          .limit(1);
      if (!matchingClient && clientPhone) {
        [matchingClient] = await db
          .select({ id: clients.id, name: clients.name, phone: clients.phone })
          .from(clients)
          .where(and(eq(clients.owner, owner), eq(clients.phone, clientPhone)))
          .limit(1);
      }
      if (matchingClient) {
        clientId = matchingClient.id;
        if (
          matchingClient.name !== clientName ||
          (hasClientPhone && matchingClient.phone !== clientPhone)
        ) {
          await db
            .update(clients)
            .set({
              name: clientName,
              ...(hasClientPhone ? { phone: clientPhone } : {}),
            })
            .where(
              and(eq(clients.owner, owner), eq(clients.id, matchingClient.id)),
            );
        }
      } else {
        const [createdClient] = await db
          .insert(clients)
          .values({
            owner,
            name: clientName,
            phone: clientPhone,
            email: "",
            kind: "person",
            notes: "",
          })
          .returning({ id: clients.id });
        clientId = createdClient.id;
      }
      const [createdShoot] = await db.insert(shoots).values({
        owner,
        clientId,
        clientName,
        type,
        color: String(data.color || "#3659E3"),
        startAt: String(data.startAt),
        endAt: String(data.endAt),
        allDay: Boolean(data.allDay),
        comment: String(data.comment || ""),
        price: Math.max(0, Number(data.price) || 0),
        paymentType:
          data.paymentType === "full" || data.paymentType === "postpay"
            ? data.paymentType
            : "advance",
        paidAmount: Math.max(0, Number(data.paidAmount) || 0),
        deliveryDays: Math.max(1, Number(data.deliveryDays) || 14),
        delivered: Boolean(data.delivered),
        archived: Boolean(data.archived),
        status: String(data.status || "booked"),
        location: String(data.location || ""),
        travelMinutes: Math.max(0, Number(data.travelMinutes) || 0),
        organizerName: String(data.organizerName || ""),
        organizerPhone: String(data.organizerPhone || ""),
        editingHours: Math.max(0, Number(data.editingHours) || 0),
        travelCost: Math.max(0, Number(data.travelCost) || 0),
        otherCosts: Math.max(0, Number(data.otherCosts) || 0),
        equipmentJson: JSON.stringify(Array.isArray(data.equipment) ? data.equipment : defaultEquipment(type)),
        shotListJson: JSON.stringify(data.shotList || defaultShotList(type)),
        timelineJson: JSON.stringify(Array.isArray(data.timeline) ? data.timeline : initialShootTimeline(String(data.startAt))),
        portalToken: portalToken(),
        clientGuide: String(data.clientGuide || ""),
      }).returning({ id: shoots.id, clientId: shoots.clientId });
      if (!createdShoot?.id) {
        return Response.json(
          { error: "Сервер не подтвердил создание съёмки" },
          { status: 500 },
        );
      }
      mutation = {
        action: "createShoot",
        shootId: createdShoot.id,
        clientId: createdShoot.clientId,
      };
    } else if (payload.action === "updateShoot" && payload.id) {
      if (Number(payload.id) <= 0) {
        return Response.json(
          { error: "Временный ID нельзя отправлять на сервер" },
          { status: 400 },
        );
      }
      const allowed: Partial<typeof shoots.$inferInsert> = {};
      if (typeof data.delivered === "boolean") allowed.delivered = data.delivered;
      if (typeof data.archived === "boolean") allowed.archived = data.archived;
      if (typeof data.paidAmount === "number") {
        allowed.paidAmount = Math.max(0, data.paidAmount);
      }
      if (typeof data.status === "string") allowed.status = data.status;
      if (typeof data.location === "string") allowed.location = data.location;
      if (typeof data.travelMinutes === "number") {
        allowed.travelMinutes = Math.max(0, data.travelMinutes);
      }
      if (typeof data.organizerName === "string") {
        allowed.organizerName = data.organizerName;
      }
      if (typeof data.organizerPhone === "string") {
        allowed.organizerPhone = data.organizerPhone;
      }
      if (typeof data.editingHours === "number") {
        allowed.editingHours = Math.max(0, data.editingHours);
      }
      if (typeof data.travelCost === "number") {
        allowed.travelCost = Math.max(0, data.travelCost);
      }
      if (typeof data.otherCosts === "number") {
        allowed.otherCosts = Math.max(0, data.otherCosts);
      }
      if (Array.isArray(data.equipment)) {
        allowed.equipmentJson = JSON.stringify(data.equipment);
      }
      if (Array.isArray(data.shotList)) {
        allowed.shotListJson = JSON.stringify(data.shotList);
      }
      if (Array.isArray(data.timeline)) {
        allowed.timelineJson = JSON.stringify(data.timeline);
      }
      if (typeof data.clientGuide === "string") {
        allowed.clientGuide = data.clientGuide;
      }
      const updated = await db
        .update(shoots)
        .set(allowed)
        .where(and(eq(shoots.owner, owner), eq(shoots.id, Number(payload.id))))
        .returning({ id: shoots.id });
      if (!updated.length) {
        return Response.json({ error: "Съёмка не найдена" }, { status: 404 });
      }
      mutation = { action: "updateShoot", shootId: Number(payload.id) };
    } else if (payload.action === "deleteShoot" && payload.id) {
      if (Number(payload.id) <= 0) {
        return Response.json(
          { error: "Временный ID нельзя отправлять на сервер" },
          { status: 400 },
        );
      }
      const deleted = await db
        .delete(shoots)
        .where(and(eq(shoots.owner, owner), eq(shoots.id, Number(payload.id))))
        .returning({ id: shoots.id });
      if (!deleted.length) {
        return Response.json({ error: "Съёмка не найдена" }, { status: 404 });
      }
      mutation = { action: "deleteShoot", shootId: Number(payload.id) };
    } else if (payload.action === "deleteClient" && payload.id) {
      const clientId = Number(payload.id);
      if (clientId <= 0) {
        return Response.json(
          { error: "Временный ID нельзя отправлять на сервер" },
          { status: 400 },
        );
      }
      const linkedShoots = await db
        .select({ id: shoots.id })
        .from(shoots)
        .where(and(eq(shoots.owner, owner), eq(shoots.clientId, clientId)))
        .limit(1);
      if (linkedShoots.length) {
        return Response.json(
          { error: "Клиент связан со съёмками и не может быть удалён" },
          { status: 409 },
        );
      }
      const deleted = await db
        .delete(clients)
        .where(and(eq(clients.owner, owner), eq(clients.id, clientId)))
        .returning({ id: clients.id });
      if (!deleted.length) {
        return Response.json({ error: "Клиент не найден" }, { status: 404 });
      }
      mutation = { action: "deleteClient", clientId };
    } else if (payload.action === "savePreferences") {
      const profile = (data.profile || {}) as Record<string, unknown>;
      const reminderDays = Number(data.deliveryReminderDays);
      const update = {
        firstName: String(profile.firstName || ""),
        lastName: String(profile.lastName || ""),
        phone: String(profile.phone || ""),
        city: String(profile.city || ""),
        annualGoal: Math.max(0, Number(profile.goal) || 0),
        typesJson: JSON.stringify(Array.isArray(data.types) ? data.types : DEFAULT_TYPES),
        remindersJson: JSON.stringify(data.reminders || [5, 1, 0]),
        showAverage: Boolean(data.showAverage),
        deliveryReminderDays:
          Number.isInteger(reminderDays) && reminderDays >= 0 ? reminderDays : 1,
        updatedAt: new Date().toISOString(),
      };
      await db
        .insert(preferences)
        .values({ owner, ...update })
        .onConflictDoUpdate({ target: preferences.owner, set: update });
    } else if (payload.action === "deleteActiveShoots") {
      await db
        .delete(shoots)
        .where(
          and(
            eq(shoots.owner, owner),
            eq(shoots.archived, false),
            eq(shoots.delivered, false),
            ne(shoots.status, "delivered"),
          ),
        );
    } else if (payload.action === "deleteAllShoots") {
      await db.delete(shoots).where(eq(shoots.owner, owner));
    } else {
      return Response.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const state = await snapshot(owner);
    return Response.json(mutation ? { ...state, mutation } : state);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить данные" },
      { status: 500 },
    );
  }
}

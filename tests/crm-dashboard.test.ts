import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INITIAL_SHOOTS, type Shoot } from "../app/crm-data.ts";
import {
  filterShoots,
  hasTravelTime,
  isOverdue,
  isUrgent,
  processingCount,
  projectCountLabel,
  selectDashboardHero,
  shootDeadline,
  unpaidShoots,
  upcomingCount,
} from "../app/crm-shoot-logic.ts";

const now = new Date("2026-08-31T10:00:00Z");

function atDays(days: number, patch: Partial<Shoot> = {}): Shoot {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + days);
  return {
    ...INITIAL_SHOOTS[0],
    id: 100 + days,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3_600_000).toISOString(),
    deliveryDays: 2,
    delivered: false,
    archived: false,
    status: days < 0 ? "processing" : "preparing",
    ...patch,
  };
}

test("upcoming counts only the next seven days and does not exclude delivered", () => {
  const shoots = [
    atDays(0),
    atDays(7, { id: 107, delivered: true, archived: true, status: "delivered" }),
    atDays(8, { id: 108 }),
    atDays(-1, { id: 99 }),
  ];
  assert.equal(upcomingCount(shoots, now), 2);
});

test("processing count reacts to delivered and return-to-work state", () => {
  const working = atDays(-2, { id: 1 });
  const delivered = { ...working, delivered: true, archived: true, status: "delivered" as const };
  assert.equal(processingCount([working], now), 1);
  assert.equal(processingCount([delivered], now), 0);
  assert.equal(
    processingCount([{ ...delivered, delivered: false, archived: false, status: "processing" }], now),
    1,
  );
});

test("unpaid balances contain only real positive balances", () => {
  const unpaid = atDays(1, { id: 1, price: 50000, paidAmount: 10000 });
  const paid = atDays(2, { id: 2, price: 50000, paidAmount: 50000 });
  const overpaid = atDays(3, { id: 3, price: 50000, paidAmount: 60000 });
  assert.deepEqual(
    unpaidShoots([unpaid, paid, overpaid]).map(({ shoot, balance }) => [shoot.id, balance]),
    [[1, 40000]],
  );
  assert.equal(unpaidShoots([{ ...unpaid, paidAmount: unpaid.price }]).length, 0);
});

test("archive filter is delivered projects and All keeps every project", () => {
  const active = atDays(-1, { id: 1 });
  const delivered = atDays(-2, {
    id: 2,
    delivered: true,
    archived: true,
    status: "delivered",
  });
  assert.deepEqual(filterShoots([active, delivered], "all", now).map((shoot) => shoot.id), [1, 2]);
  assert.deepEqual(filterShoots([active, delivered], "archived", now).map((shoot) => shoot.id), [2]);
});

test("urgent and overdue filters share the authoritative deadline", () => {
  const urgent = atDays(-1, { id: 1, deliveryDays: 3 });
  const overdue = atDays(-5, { id: 2, deliveryDays: 2 });
  assert.equal(isUrgent(urgent, now), true);
  assert.equal(isOverdue(overdue, now), true);
  assert.deepEqual(filterShoots([urgent, overdue], "urgent", now).map((shoot) => shoot.id), [1]);
  assert.deepEqual(filterShoots([urgent, overdue], "overdue", now).map((shoot) => shoot.id), [2]);
});

test("delivered projects never enter urgent or overdue", () => {
  const deliveredUrgent = atDays(-1, {
    id: 1,
    deliveryDays: 2,
    delivered: true,
    archived: true,
    status: "delivered",
  });
  const deliveredOverdue = atDays(-10, {
    id: 2,
    deliveryDays: 1,
    delivered: true,
    archived: true,
    status: "delivered",
  });
  assert.equal(filterShoots([deliveredUrgent, deliveredOverdue], "urgent", now).length, 0);
  assert.equal(filterShoots([deliveredUrgent, deliveredOverdue], "overdue", now).length, 0);
});

test("deadline helper adds deliveryDays once", () => {
  const shoot = atDays(-2, { deliveryDays: 14 });
  const expected = new Date(shoot.startAt);
  expected.setDate(expected.getDate() + 14);
  assert.equal(shootDeadline(shoot).toISOString(), expected.toISOString());
});

test("project counter uses correct Russian declension", () => {
  const expected = [
    [1, "1 проект"],
    [2, "2 проекта"],
    [5, "5 проектов"],
    [11, "11 проектов"],
    [21, "21 проект"],
    [22, "22 проекта"],
    [25, "25 проектов"],
  ] as const;
  expected.forEach(([value, label]) => assert.equal(projectCountLabel(value), label));
});

test("dashboard hero uses only an undelivered shoot within the next 30 calendar days", () => {
  const past = atDays(-1, { id: 1 });
  const near = atDays(12, { id: 2 });
  const far = atDays(31, { id: 3 });
  const deliveredNear = atDays(2, { id: 4, delivered: true, status: "delivered" });
  assert.deepEqual(selectDashboardHero([far, past, deliveredNear, near], now), {
    kind: "shoot",
    shoot: near,
  });
});

test("dashboard hero includes the exact 30-calendar-day boundary", () => {
  const boundary = atDays(30, { id: 30 });
  assert.equal(selectDashboardHero([boundary], now)?.shoot.id, boundary.id);
});

test("dashboard hero falls back to the nearest processing deadline deterministically", () => {
  const laterDeadline = atDays(-4, { id: 9, deliveryDays: 10 });
  const nearestDeadline = atDays(-3, { id: 7, deliveryDays: 4 });
  const sameDeadlineHigherId = atDays(-3, { id: 8, deliveryDays: 4 });
  const result = selectDashboardHero(
    [laterDeadline, sameDeadlineHigherId, nearestDeadline],
    now,
  );
  assert.equal(result?.kind, "processing");
  assert.equal(result?.shoot.id, nearestDeadline.id);
});

test("dashboard hero has no arbitrary fallback when nothing qualifies", () => {
  const deliveredPast = atDays(-2, { id: 1, delivered: true, status: "delivered" });
  const farFuture = atDays(31, { id: 2 });
  assert.equal(selectDashboardHero([deliveredPast, farFuture], now), undefined);
});

test("departure badge requires a real positive travel duration", () => {
  assert.equal(hasTravelTime(25), true);
  for (const value of [0, null, undefined, "", Number.NaN, -5]) {
    assert.equal(hasTravelTime(value), false);
  }
});

test("radar source has only balance risk and opens the balance sheet for one client", async () => {
  const source = await readFile(new URL("../app/crm-pages-primary.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Материал без 2-й копии/);
  assert.doesNotMatch(source, /backupStatus/);
  assert.doesNotMatch(source, /съёмки за 7 дней/);
  assert.match(source, /Всё под контролем/);
  assert.match(source, /Рисков сейчас нет/);
  assert.match(source, /onClick=\{\(\) => setBalanceSheetOpen\(true\)\}/);
  assert.match(source, /title="КЛИЕНТЫ С ОСТАТКОМ"/);
  assert.match(source, /paidAmount: shoot\.price/);
});

test("state synchronization does not use reload, MutationObserver, polling or scrollTo", async () => {
  const files = await Promise.all(
    ["crm-app.tsx", "crm-data-layer.ts", "crm-pages-primary.tsx"].map((name) =>
      readFile(new URL(`../app/${name}`, import.meta.url), "utf8"),
    ),
  );
  const source = files.join("\n");
  assert.doesNotMatch(source, /window\.location\.reload|MutationObserver|setInterval\s*\(|scrollTo\s*\(/);
  assert.doesNotMatch(source, /visibilitychange/);
});

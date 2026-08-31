import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_TYPES, INITIAL_SHOOTS } from "../app/crm-data.ts";
import {
  deliveryReminderSetting,
  normalizeShootType,
  positiveWholeNumber,
  reminderDaysLabel,
  removeShootType,
  storedDeliveryReminderDays,
} from "../app/crm-settings.ts";

test("type editing keeps name, color and positive delivery days", () => {
  assert.deepEqual(
    normalizeShootType({ name: "  Коммерческая  ", color: "#3659E3", deliveryDays: 21 }),
    { name: "Коммерческая", color: "#3659E3", deliveryDays: 21 },
  );
  assert.equal(positiveWholeNumber(0), 1);
});

test("type deletion is explicit and does not mutate shoots or restore an empty list", () => {
  const originalShoot = structuredClone(INITIAL_SHOOTS[0]);
  const remaining = removeShootType([DEFAULT_TYPES[0]], 0);
  assert.deepEqual(remaining, []);
  assert.deepEqual(INITIAL_SHOOTS[0], originalShoot);
  assert.equal(INITIAL_SHOOTS[0].type, originalShoot.type);
  assert.equal(INITIAL_SHOOTS[0].color, originalShoot.color);
  assert.equal(INITIAL_SHOOTS[0].deliveryDays, originalShoot.deliveryDays);
});

test("delivery reminder keeps a positive value only while enabled", () => {
  assert.deepEqual(deliveryReminderSetting(3), { enabled: true, days: 3 });
  assert.deepEqual(deliveryReminderSetting(0), { enabled: false, days: 1 });
  assert.equal(storedDeliveryReminderDays({ enabled: true, days: 3 }), 3);
  assert.equal(storedDeliveryReminderDays({ enabled: false, days: 3 }), 0);
  assert.equal(storedDeliveryReminderDays({ enabled: true, days: 0 }), 1);
});

test("Russian day declension covers required values", () => {
  const expected = [
    [1, "1 день"],
    [2, "2 дня"],
    [5, "5 дней"],
    [11, "11 дней"],
    [21, "21 день"],
    [22, "22 дня"],
    [25, "25 дней"],
  ] as const;
  expected.forEach(([value, label]) => assert.equal(reminderDaysLabel(value), label));
});

test("settings source keeps swipe actions, confirmation and iPhone input contract", () => {
  const page = readFileSync(new URL("../app/crm-pages-secondary.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/crm-light.css", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/crm/route.ts", import.meta.url), "utf8");

  assert.match(page, /type-swipe-actions/);
  assert.match(page, /Изменить/);
  assert.match(page, /Удалить/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /didSwipe\.current/);
  assert.match(page, /delivery-reminder-input/);
  assert.doesNotMatch(page, /Письмо за 1 день до дедлайна/);
  assert.match(css, /\.delivery-reminder-input[\s\S]*?font-size: 16px;/);
  assert.match(css, /\.type-row[\s\S]*?touch-action: pan-y;/);
  assert.match(route, /Array\.isArray\(parsed\) \? parsed : DEFAULT_TYPES/);
  assert.match(route, /Number\.isInteger\(reminderDays\) && reminderDays >= 0/);
});

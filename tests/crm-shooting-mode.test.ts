import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { INITIAL_SHOOTS } from "../app/crm-data.ts";
import {
  addChecklistItem,
  addTimelineItem,
  normalizeChecklistItems,
  normalizeTimelineItems,
  removeChecklistItem,
  removeTimelineItem,
  updateChecklistItem,
  updateTimelineItem,
} from "../app/crm-project-tools.ts";
import {
  DEFAULT_SMART_MESSAGES,
  insertMessageVariable,
  normalizeSmartMessages,
  renderSmartMessage,
  SMART_VARIABLES,
} from "../app/crm-smart-messages.ts";

const dayMode = readFileSync(new URL("../app/crm-day-mode.tsx", import.meta.url), "utf8");
const lightCss = readFileSync(new URL("../app/crm-light.css", import.meta.url), "utf8");

test("shooting mode has direct close and tab handlers without legacy backup UI", () => {
  assert.match(dayMode, /<Modal title="Режим съёмки" onClose=\{onClose\}/);
  assert.match(dayMode, /setSection\("timeline"\)/);
  assert.match(dayMode, /setSection\("gear"\)/);
  assert.match(dayMode, /href=\{phoneHref\(clientPhone\)\}/);
  assert.doesNotMatch(dayMode, /backupStatus|Резервные копии|Погода и свет|STATUS_STEPS|setInterval|MutationObserver|showPicker/);
  assert.equal(existsSync(new URL("../app/api/weather/route.ts", import.meta.url)), false);
});

test("timeline supports safe normalization, add, edit and delete", () => {
  assert.deepEqual(normalizeTimelineItems(undefined), []);
  assert.deepEqual(normalizeTimelineItems([{ id: "bad", label: "", time: "12:00" }]), []);
  const added = addTimelineItem([], { id: "arrival", label: "Прибытие", time: "13:40", done: false });
  const changed = updateTimelineItem(added, "arrival", { label: "Сбор команды", time: "13:30" });
  assert.deepEqual(changed, [{ id: "arrival", label: "Сбор команды", time: "13:30", done: false }]);
  assert.deepEqual(removeTimelineItem(changed, "arrival"), []);
  assert.match(dayMode, /input type="time"/);
  assert.match(dayMode, /\+ Добавить этап/);
  assert.match(dayMode, /<SwipeActions open=\{open\} onEdit=\{onEdit\} onDelete=\{onDelete\}/);
});

test("equipment accepts an intentional empty list and supports checklist CRUD", () => {
  assert.deepEqual(normalizeChecklistItems(undefined), []);
  assert.deepEqual(normalizeChecklistItems([]), []);
  const added = addChecklistItem([], "Камера", "camera");
  const checked = updateChecklistItem(added, "camera", { done: true, label: "Камера" });
  assert.deepEqual(checked, [{ id: "camera", label: "Камера", done: true }]);
  assert.deepEqual(removeChecklistItem(checked, "camera"), []);
  assert.match(dayMode, /type="checkbox"/);
  assert.match(dayMode, /Список техники пуст/);
});

test("smart templates are global placeholders and render shoot data only at send time", () => {
  assert.deepEqual(DEFAULT_SMART_MESSAGES.map((message) => message.title), ["Подтверждение", "Я выезжаю", "После съёмки"]);
  const custom = normalizeSmartMessages([{ id: "custom", title: "Напоминание", text: "{имя}, остаток: {остаток}" }]);
  assert.equal(custom[0].text, "{имя}, остаток: {остаток}");
  const rendered = renderSmartMessage(custom[0].text, INITIAL_SHOOTS[0]);
  assert.notEqual(rendered, custom[0].text);
  assert.match(rendered, new RegExp(INITIAL_SHOOTS[0].clientName.split(" ")[0]));
  assert.equal(custom[0].text, "{имя}, остаток: {остаток}");
  assert.match(dayMode, /Редактировать/);
  assert.match(dayMode, /Отправить/);
  assert.match(dayMode, /smart-message-add/);
  assert.equal(SMART_VARIABLES.length, 9);
});

test("variable chip replaces the current selection and preserves editor focus contract", () => {
  assert.deepEqual(insertMessageVariable("Привет, мир", 8, 11, "{имя}"), { value: "Привет, {имя}", cursor: 13 });
  assert.match(dayMode, /textarea\?\.focus\(\)/);
  assert.match(dayMode, /setSelectionRange\(result\.cursor, result\.cursor\)/);
});

test("shooting mode uses iPhone-safe input and swipe styles", () => {
  assert.match(lightCss, /\.project-swipe-surface[\s\S]*?touch-action: pan-y;/);
  assert.match(lightCss, /\.project-entry-form input,[\s\S]*?font-size: 16px;/);
  assert.match(lightCss, /\.smart-message-editor textarea[\s\S]*?min-height: 148px/);
  assert.doesNotMatch(dayMode, /window\.location\.reload|scrollTo\(/);
});

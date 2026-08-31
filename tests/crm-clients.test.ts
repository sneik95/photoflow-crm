import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const primarySource = await readFile("app/crm-pages-primary.tsx", "utf8");
const secondarySource = await readFile("app/crm-pages-secondary.tsx", "utf8");
const uiSource = await readFile("app/crm-ui.tsx", "utf8");
const appSource = await readFile("app/crm-app.tsx", "utf8");
const modalSource = await readFile("app/crm-modals.tsx", "utf8");
const apiSource = await readFile("app/api/crm/route.ts", "utf8");
const lightCss = await readFile("app/crm-light.css", "utf8");

test("client header kicker stays on one line through the shared header style", () => {
  assert.match(lightCss, /\.page-kicker\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(primarySource, /<PageHeader\s+title="Клиенты"/);
});

test("client rows use the shared swipe actions and one-time hint", () => {
  assert.match(primarySource, /photoflow:clients-swipe-hint:v1/);
  assert.match(primarySource, /<SwipeActions/);
  assert.match(primarySource, /useSwipeGesture\(\{/);
  assert.match(lightCss, /\.client-list \.client-row[\s\S]*?touch-action:\s*pan-y;/);
});

test("settings and clients share the common swipe gesture implementation", () => {
  assert.match(uiSource, /export function useSwipeGesture/);
  assert.match(secondarySource, /useSwipeGesture\(\{/);
  assert.doesNotMatch(secondarySource, /SWIPE_ACTIONS_WIDTH/);
});

test("client edit updates the existing id and keeps the form prefilled", () => {
  assert.match(modalSource, /useState\(client\.name\)/);
  assert.match(modalSource, /onSave\(client\.id, nextName\)/);
  assert.match(appSource, /dataLayer\.updateClient\(id, \{ name \}\)/);
});

test("client deletion is guarded in the UI, data layer and API", () => {
  assert.match(primarySource, /if \(clientShoots\.length\)/);
  assert.match(primarySource, /window\.confirm/);
  assert.match(apiSource, /linkedShoots[\s\S]*?status: 409/);
  assert.match(apiSource, /\.delete\(clients\)/);
});

test("renaming a client keeps denormalized shoot names consistent", () => {
  assert.match(apiSource, /\.update\(shoots\)[\s\S]*?\.set\(\{ clientName: name \}\)/);
});

test("contact picker runs only from an explicit button and never auto-saves", () => {
  assert.match(modalSource, /type="button"[\s\S]*?onClick=\{\(\) => void chooseContact\(\)\}[\s\S]*?Выбрать из контактов/);
  const picker = modalSource.slice(
    modalSource.indexOf("async function chooseContact"),
    modalSource.indexOf("return (", modalSource.indexOf("async function chooseContact")),
  );
  assert.doesNotMatch(picker, /onSave\(/);
});

test("contact picker is feature-detected and has a manual-entry fallback", () => {
  assert.match(modalSource, /!window\.isSecureContext/);
  assert.match(modalSource, /typeof contactNavigator\.contacts\.select !== "function"/);
  assert.match(modalSource, /\["name", "tel"\]/);
  assert.match(modalSource, /setName\(contactName\)/);
  assert.match(modalSource, /setPhone\(contactPhone\)/);
  assert.match(modalSource, /error\.name === "AbortError"/);
  assert.match(modalSource, /Введите данные вручную/);
});

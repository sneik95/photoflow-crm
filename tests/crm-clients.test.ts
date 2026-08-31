import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const primarySource = await readFile("app/crm-pages-primary.tsx", "utf8");
const secondarySource = await readFile("app/crm-pages-secondary.tsx", "utf8");
const uiSource = await readFile("app/crm-ui.tsx", "utf8");
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

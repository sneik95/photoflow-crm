import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("production build keeps server, client and API in one Vinext pipeline", () => {
  const build = source("scripts/build-verified.sh");
  const worker = source("worker/index.ts");
  assert.match(build, /"\$\{vinext\}" build/);
  assert.doesNotMatch(build, /deployment\/|github-main-c5305ce|photoflow-hotfix|runtime-v2|risk-modal-fix|cp -R/);
  assert.doesNotMatch(worker, /pathname === "\/"|\/index\.html/);
  assert.match(worker, /return handler\.fetch\(request, env, ctx\)/);
  assert.equal(existsSync(new URL("../deployment/github-main-c5305ce", import.meta.url)), false);
});

test("authoritative React CRUD path has no DOM synchronization layer", () => {
  const app = source("app/crm-app.tsx");
  const data = source("app/crm-data-layer.ts");
  const pages = [
    source("app/crm-pages-primary.tsx"),
    source("app/crm-pages-secondary.tsx"),
    source("app/crm-day-mode.tsx"),
  ].join("\n");
  assert.equal((app.match(/dataLayer\.createShoot\(/g) || []).length, 1);
  assert.match(app, /dataLayerRef\.current\?\.deleteShoot\(/);
  assert.match(app, /dataLayer\.setDelivered\(/);
  assert.match(app, /dataLayer\.returnToWork\(/);
  assert.match(data, /payShoot\(id: number\)/);
  assert.doesNotMatch(`${app}\n${data}\n${pages}`, /MutationObserver|location\.reload|document\.addEventListener\(["']click|setInterval\(/);
});

test("removed backup, weather and destructive legacy UI are absent from source", () => {
  const product = [
    source("app/crm-app.tsx"),
    source("app/crm-pages-primary.tsx"),
    source("app/crm-pages-secondary.tsx"),
    source("app/crm-day-mode.tsx"),
    source("app/crm-data.ts"),
  ].join("\n");
  assert.doesNotMatch(product, /Материал без 2-й копии|Резервные копии|Погода и свет|backupStatus|STATUS_STEPS|Удалить все/);
  assert.equal(existsSync(new URL("../app/api/weather/route.ts", import.meta.url)), false);
});

test("service worker advances the shell cache for the unified source build", () => {
  const worker = source("public/sw.js");
  assert.match(worker, /photoflow-shell-v6-source-build/);
  assert.match(worker, /keys\.filter\(\(key\) => key !== CACHE\)/);
});

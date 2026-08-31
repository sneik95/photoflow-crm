import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /Мои съёмки/);
  assert.doesNotMatch(html, /Материал без 2-й копии|Удалить все|Резервные копии|Погода и свет/);
  assert.doesNotMatch(html, /photoflow-hotfix|photoflow-runtime|risk-modal-fix/);

  const assets = readdirSync(new URL("../dist/client/assets/", import.meta.url));
  assert.ok(assets.some((asset) => asset.endsWith(".js")));
  assert.ok(assets.some((asset) => asset.endsWith(".css")));
  assert.equal(assets.some((asset) => /hotfix|runtime-v2|risk-modal-fix/.test(asset)), false);
});

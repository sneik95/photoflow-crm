import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  initialShootTimeline,
  validateNewShoot,
  type NewShootDraft,
} from "../app/crm-new-shoot.ts";

const validDraft: NewShootDraft = {
  clientName: "Иванов Иван Иванович",
  clientPhone: "+7 999 123-45-67",
  location: "Новороссийск, набережная",
  price: "25000",
  paymentType: "postpay",
  advance: "",
};

test("new shoot validates every required base field", () => {
  assert.deepEqual(validateNewShoot({ ...validDraft, clientName: "" }), ["clientName"]);
  assert.deepEqual(validateNewShoot({ ...validDraft, clientPhone: "" }), ["clientPhone"]);
  assert.deepEqual(validateNewShoot({ ...validDraft, location: "" }), ["location"]);
  assert.deepEqual(validateNewShoot({ ...validDraft, price: "" }), ["price"]);
});

test("price and advance must be positive amounts", () => {
  assert.deepEqual(validateNewShoot({ ...validDraft, price: "0" }), ["price"]);
  assert.deepEqual(
    validateNewShoot({ ...validDraft, paymentType: "advance", advance: "" }),
    ["advance"],
  );
  assert.deepEqual(
    validateNewShoot({ ...validDraft, paymentType: "advance", advance: "0" }),
    ["advance"],
  );
  assert.deepEqual(
    validateNewShoot({ ...validDraft, paymentType: "advance", advance: "5000" }),
    [],
  );
});

test("new shoot gets only an arrival item twenty minutes before start", () => {
  assert.deepEqual(initialShootTimeline("2026-08-22T14:00"), [
    { id: "arrival", time: "13:40", label: "Прибытие", done: false },
  ]);
  assert.deepEqual(initialShootTimeline("2026-08-22T00:10"), [
    { id: "arrival", time: "23:50", label: "Прибытие", done: false },
  ]);
});

test("new shoot form keeps the required source-level UX contract", () => {
  const modal = readFileSync(new URL("../app/crm-modals.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/crm-app.tsx", import.meta.url), "utf8");
  const lightCss = readFileSync(new URL("../app/crm-light.css", import.meta.url), "utf8");

  assert.match(modal, /placeholder="Иванов Иван Иванович"/);
  assert.match(modal, /placeholder="Например, 25 000"/);
  assert.match(modal, /placeholder="Например, 5 000"/);
  assert.match(modal, /placeholder="Например, 30"/);
  assert.doesNotMatch(modal, /Умное распознавание/);
  assert.doesNotMatch(modal, /Весь день/);
  assert.doesNotMatch(modal, /Указать стоимость/);
  assert.match(modal, /viewportAware/);
  assert.match(modal, /focusInvalidField\(invalidFields\[0\]\)/);
  assert.match(modal, /if \(!result\.ok\) \{[\s\S]*?return;[\s\S]*?\}\s*onClose\(\)/);
  assert.match(app, /onSave=\{addShoot\}/);
  assert.match(lightCss, /\.modal-form input,[\s\S]*?font-size: 16px;/);
});

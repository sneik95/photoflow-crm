import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AVATAR_CROP_SIZE,
  AVATAR_OUTPUT_SIZE,
  clampAvatarOffset,
} from "../app/crm-avatar.ts";

test("avatar crop clamps the image so the circular viewport is always covered", () => {
  assert.equal(AVATAR_CROP_SIZE, 272);
  assert.equal(AVATAR_OUTPUT_SIZE, 512);
  const first = clampAvatarOffset({ x: 999, y: -999 }, { width: 1200, height: 800 }, 1);
  assert.ok(Math.abs(first.x - 68) < 0.001);
  assert.ok(Math.abs(first.y) < 0.001);
  const second = clampAvatarOffset({ x: 999, y: 999 }, { width: 1200, height: 800 }, 2);
  assert.ok(Math.abs(second.x - 272) < 0.001);
  assert.ok(Math.abs(second.y - 136) < 0.001);
});

test("profile source uses an explicit picker, cancellable crop and optimized avatar output", () => {
  const page = readFileSync(new URL("../app/crm-pages-secondary.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/crm-light.css", import.meta.url), "utf8");

  assert.match(page, /type="file"/);
  assert.match(page, /accept="image\/\*"/);
  assert.match(page, /onClick=\{openPhotoPicker\}/);
  assert.match(page, /if \(!file\) return;/);
  assert.match(page, /URL\.createObjectURL/);
  assert.match(page, /onCancel=\{closeCrop\}/);
  assert.match(page, /onConfirm=\{saveAvatar\}/);
  assert.match(page, /onPointerDown=\{onPointerDown\}/);
  assert.match(page, /onPointerMove=\{onPointerMove\}/);
  assert.match(page, /canvas\.toDataURL\("image\/jpeg", 0\.86\)/);
  assert.match(css, /\.avatar-crop-stage[\s\S]*?border-radius: 50%;[\s\S]*?touch-action: none;/);
  assert.match(css, /\.profile-avatar-image[\s\S]*?object-fit: cover;/);
});

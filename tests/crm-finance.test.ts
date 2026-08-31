import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INITIAL_SHOOTS, type Shoot } from "../app/crm-data.ts";
import {
  availableFinanceYears,
  shootsInCurrentMonth,
  shootsInFinanceYear,
} from "../app/crm-finance.ts";

const financePageSource = await readFile("app/crm-pages-secondary.tsx", "utf8");

function shoot(id: number, startAt: string): Shoot {
  return { ...structuredClone(INITIAL_SHOOTS[0]), id, startAt };
}

test("finance year range includes December 31 and excludes next January 1", () => {
  const shoots = [
    shoot(1, "2024-01-01T00:00:00"),
    shoot(2, "2024-12-31T23:59:59.999"),
    shoot(3, "2025-01-01T00:00:00"),
  ];
  assert.deepEqual(shootsInFinanceYear(shoots, 2024).map((item) => item.id), [1, 2]);
});

test("available years come from data and always include the current year", () => {
  const shoots = [shoot(1, "2022-06-10T12:00:00"), shoot(2, "2024-03-01T12:00:00")];
  assert.deepEqual(availableFinanceYears(shoots, 2026), [2026, 2024, 2022]);
});

test("current month uses the actual calendar month only", () => {
  const shoots = [
    shoot(1, "2026-08-01T00:00:00"),
    shoot(2, "2026-08-31T23:59:59"),
    shoot(3, "2026-09-01T00:00:00"),
  ];
  assert.deepEqual(
    shootsInCurrentMonth(shoots, new Date("2026-08-15T12:00:00")).map((item) => item.id),
    [1, 2],
  );
});

test("finance UI uses one selected year and removes the currency label", () => {
  assert.match(financePageSource, /const \[selectedYear, setSelectedYear\] = useState\(currentYear\)/);
  assert.match(financePageSource, /value=\{selectedYear\}/);
  assert.match(financePageSource, /const yearShoots = shootsInFinanceYear\(shoots, selectedYear\)/);
  assert.doesNotMatch(financePageSource, /₽ Рубли/);
});

test("current month and past-year profit per hour are mutually exclusive", () => {
  assert.match(financePageSource, /\{isCurrentYear \? \([\s\S]*?Текущий месяц[\s\S]*?\) : \([\s\S]*?Прибыль в час/);
  assert.match(financePageSource, /\{isCurrentYear && \([\s\S]*?Прибыль в час/);
});

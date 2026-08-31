import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INITIAL_SHOOTS, type Shoot } from "../app/crm-data.ts";
import {
  availableFinanceYears,
  financeProfitPerHour,
  financeSummary,
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
  assert.match(financePageSource, /financeSummary\(shoots, selectedYear\)/);
  assert.doesNotMatch(financePageSource, /₽ Рубли/);
});

test("current month and past-year profit per hour are mutually exclusive", () => {
  assert.match(financePageSource, /\{isCurrentYear \? \([\s\S]*?Текущий месяц[\s\S]*?\) : \([\s\S]*?Прибыль в час/);
  assert.match(financePageSource, /\{isCurrentYear && \([\s\S]*?Прибыль в час/);
});

test("all annual calculations use only the selected year's projects", () => {
  const current = { ...shoot(1, "2024-06-01T10:00:00"), price: 12_000, paidAmount: 4_000 };
  const next = { ...shoot(2, "2025-01-01T00:00:00"), price: 90_000, paidAmount: 90_000 };
  const summary = financeSummary([current, next], 2024);
  assert.equal(summary.yearShoots.length, 1);
  assert.equal(summary.total, 12_000);
  assert.equal(summary.received, 4_000);
  assert.equal(summary.averageCheck, 12_000);
});

test("empty years return safe zero values", () => {
  const summary = financeSummary([], 2024);
  assert.equal(summary.total, 0);
  assert.equal(summary.totalCosts, 0);
  assert.equal(summary.totalHours, 0);
  assert.equal(summary.averageCheck, 0);
  assert.equal(summary.averageProfitHour, 0);
  Object.values(summary).forEach((value) => {
    if (typeof value === "number") assert.equal(Number.isFinite(value), true);
  });
});

test("missing optional numbers are normalized to zero for display calculations", () => {
  const incomplete = {
    ...shoot(1, "2024-07-01T10:00:00"),
    endAt: "2024-07-01T12:00:00",
    price: 10_000,
    paidAmount: undefined,
    travelCost: null,
    otherCosts: "",
    editingHours: undefined,
    travelMinutes: null,
  } as unknown as Shoot;
  const summary = financeSummary([incomplete], 2024);
  assert.equal(summary.received, 0);
  assert.equal(summary.totalCosts, 0);
  assert.equal(summary.totalHours, 2);
  assert.equal(summary.averageCheck, 10_000);
  assert.equal(financeProfitPerHour(incomplete), 5_000);
});

test("average check is permanent and its legacy setting is absent", () => {
  assert.match(financePageSource, /<span>Средний чек<\/span><strong>\{money\(averageCheck\)\}<\/strong>/);
  assert.doesNotMatch(financePageSource, /Показывать средний чек/);
});

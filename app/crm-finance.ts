import type { Shoot } from "./crm-data";

export function availableFinanceYears(shoots: Shoot[], currentYear: number) {
  const years = new Set<number>([currentYear]);
  shoots.forEach((shoot) => {
    const year = new Date(shoot.startAt).getFullYear();
    if (Number.isInteger(year)) years.add(year);
  });
  return [...years].sort((a, b) => b - a);
}

export function shootsInFinanceYear(shoots: Shoot[], year: number) {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  return shoots.filter((shoot) => {
    const shootStart = new Date(shoot.startAt).getTime();
    return Number.isFinite(shootStart) && shootStart >= start && shootStart < end;
  });
}

export function shootsInCurrentMonth(shoots: Shoot[], now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return shoots.filter((shoot) => {
    const shootStart = new Date(shoot.startAt).getTime();
    return Number.isFinite(shootStart) && shootStart >= start && shootStart < end;
  });
}

export function safeFinanceNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function financeShootHours(shoot: Shoot) {
  const start = new Date(shoot.startAt).getTime();
  const end = new Date(shoot.endAt).getTime();
  const duration = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, (end - start) / 3_600_000)
    : 0;
  return duration +
    Math.max(0, safeFinanceNumber(shoot.editingHours)) +
    Math.max(0, safeFinanceNumber(shoot.travelMinutes)) / 60;
}

export function financeProfitPerHour(shoot: Shoot) {
  const profit =
    safeFinanceNumber(shoot.price) -
    safeFinanceNumber(shoot.travelCost) -
    safeFinanceNumber(shoot.otherCosts);
  const hours = financeShootHours(shoot);
  return hours > 0 ? Math.round(profit / hours) : 0;
}

export function financeSummary(shoots: Shoot[], year: number) {
  const yearShoots = shootsInFinanceYear(shoots, year);
  const total = yearShoots.reduce(
    (sum, shoot) => sum + safeFinanceNumber(shoot.price),
    0,
  );
  const received = yearShoots.reduce(
    (sum, shoot) => sum + safeFinanceNumber(shoot.paidAmount),
    0,
  );
  const totalCosts = yearShoots.reduce(
    (sum, shoot) =>
      sum +
      safeFinanceNumber(shoot.travelCost) +
      safeFinanceNumber(shoot.otherCosts),
    0,
  );
  const totalHours = yearShoots.reduce(
    (sum, shoot) => sum + financeShootHours(shoot),
    0,
  );
  const netProfit = total - totalCosts;
  const averageProfitHour = totalHours > 0
    ? Math.round(netProfit / totalHours)
    : 0;
  const averageCheck = yearShoots.length > 0
    ? Math.round(total / yearShoots.length)
    : 0;
  const byType = Object.entries(
    yearShoots.reduce<Record<string, number>>((result, shoot) => ({
      ...result,
      [shoot.type]:
        (result[shoot.type] || 0) + safeFinanceNumber(shoot.price),
    }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return {
    yearShoots,
    total,
    received,
    expected: total - received,
    totalCosts,
    totalHours,
    netProfit,
    averageProfitHour,
    averageCheck,
    byType,
  };
}

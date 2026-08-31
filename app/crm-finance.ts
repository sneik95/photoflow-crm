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

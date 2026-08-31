import type { Shoot } from "./crm-data";

export type ShootListFilter =
  | "all"
  | "upcoming"
  | "processing"
  | "urgent"
  | "overdue"
  | "archived";

const DAY_MS = 86_400_000;

export function shootIsDelivered(shoot: Shoot) {
  return shoot.delivered || shoot.archived || shoot.status === "delivered";
}

export function shootDeadline(shoot: Pick<Shoot, "startAt" | "deliveryDays">) {
  const deadline = new Date(shoot.startAt);
  deadline.setDate(deadline.getDate() + Math.max(0, Number(shoot.deliveryDays) || 0));
  return deadline;
}

export function calendarDaysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

export function isUpcomingWithin(shoot: Shoot, now: Date, days = 7) {
  const start = new Date(shoot.startAt).getTime();
  const from = now.getTime();
  return Number.isFinite(start) && start >= from && start <= from + days * DAY_MS;
}

export function isProcessing(shoot: Shoot, now: Date) {
  return !shootIsDelivered(shoot) && new Date(shoot.startAt).getTime() < now.getTime();
}

export function isUrgent(shoot: Shoot, now: Date) {
  if (shootIsDelivered(shoot)) return false;
  const days = calendarDaysBetween(now, shootDeadline(shoot));
  return days >= 0 && days <= 3;
}

export function isOverdue(shoot: Shoot, now: Date) {
  return !shootIsDelivered(shoot) && shootDeadline(shoot).getTime() < now.getTime();
}

export function filterShoots(
  shoots: Shoot[],
  filter: ShootListFilter,
  now: Date,
) {
  switch (filter) {
    case "archived":
      return shoots.filter(shootIsDelivered);
    case "upcoming":
      return shoots.filter((shoot) => new Date(shoot.startAt).getTime() >= now.getTime());
    case "processing":
      return shoots.filter((shoot) => isProcessing(shoot, now));
    case "urgent":
      return shoots.filter((shoot) => isUrgent(shoot, now));
    case "overdue":
      return shoots.filter((shoot) => isOverdue(shoot, now));
    default:
      return shoots;
  }
}

export function processingCount(shoots: Shoot[], now: Date) {
  return shoots.filter((shoot) => isProcessing(shoot, now)).length;
}

export function upcomingCount(shoots: Shoot[], now: Date) {
  return shoots.filter((shoot) => isUpcomingWithin(shoot, now, 7)).length;
}

export type UnpaidShoot = {
  shoot: Shoot;
  balance: number;
};

export function unpaidShoots(shoots: Shoot[]): UnpaidShoot[] {
  return shoots.flatMap((shoot) => {
    const balance = Math.max(0, Number(shoot.price) - Number(shoot.paidAmount));
    return balance > 0 ? [{ shoot, balance }] : [];
  });
}

export function russianPlural(
  value: number,
  forms: readonly [string, string, string],
) {
  const count = Math.abs(Math.trunc(value));
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

export function projectCountLabel(value: number) {
  return `${value} ${russianPlural(value, ["проект", "проекта", "проектов"])}`;
}

export function clientCountLabel(value: number) {
  return `${value} ${russianPlural(value, ["клиент", "клиента", "клиентов"])}`;
}

import type { ShootType } from "./crm-data";

export type DeliveryReminderSetting = {
  enabled: boolean;
  days: number;
};

export function positiveWholeNumber(value: unknown, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function deliveryReminderSetting(value: unknown): DeliveryReminderSetting {
  const number = Number(value);
  return {
    enabled: Number.isInteger(number) && number > 0,
    days: positiveWholeNumber(number),
  };
}

export function storedDeliveryReminderDays(setting: DeliveryReminderSetting) {
  return setting.enabled ? positiveWholeNumber(setting.days) : 0;
}

export function russianDays(value: number) {
  const days = Math.abs(Math.trunc(value));
  const lastTwo = days % 100;
  const last = days % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
}

export function reminderDaysLabel(value: number) {
  const days = positiveWholeNumber(value);
  return `${days} ${russianDays(days)}`;
}

export function normalizeShootType(type: ShootType): ShootType {
  return {
    name: type.name.trim(),
    color: type.color,
    deliveryDays: positiveWholeNumber(type.deliveryDays),
  };
}

export function removeShootType(types: ShootType[], index: number) {
  return types.filter((_, itemIndex) => itemIndex !== index);
}

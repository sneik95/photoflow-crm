import type { TimelineItem } from "./crm-data";

export type NewShootField =
  | "clientName"
  | "clientPhone"
  | "location"
  | "price"
  | "advance";

export type NewShootDraft = {
  clientName: string;
  clientPhone: string;
  location: string;
  price: string;
  paymentType: "advance" | "full" | "postpay";
  advance: string;
};

export const NEW_SHOOT_REQUIRED_MESSAGE =
  "Заполните отмеченное обязательное поле";

function isPositiveAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function validateNewShoot(draft: NewShootDraft): NewShootField[] {
  const invalid: NewShootField[] = [];
  if (!draft.clientName.trim()) invalid.push("clientName");
  if (!draft.clientPhone.trim()) invalid.push("clientPhone");
  if (!draft.location.trim()) invalid.push("location");
  if (!isPositiveAmount(draft.price)) invalid.push("price");
  if (draft.paymentType === "advance" && !isPositiveAmount(draft.advance)) {
    invalid.push("advance");
  }
  return invalid;
}

function minutesToTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
}

/** The only automatically created timeline item for a new shoot. */
export function initialShootTimeline(startAt: string): TimelineItem[] {
  const match = startAt.match(/T(\d{2}):(\d{2})/);
  const startMinutes = match
    ? Number(match[1]) * 60 + Number(match[2])
    : 10 * 60;
  return [
    {
      id: "arrival",
      time: minutesToTime(startMinutes - 20),
      label: "Прибытие",
      done: false,
    },
  ];
}

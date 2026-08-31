import type { Shoot } from "./crm-data.ts";
import { dateRu, deliveryDate, money } from "./crm-data.ts";

export type SmartMessage = {
  id: string;
  title: string;
  text: string;
  builtIn?: boolean;
};

export const SMART_VARIABLES = [
  "{имя}",
  "{дата}",
  "{время}",
  "{место}",
  "{срок_сдачи}",
  "{остаток}",
  "{стоимость}",
  "{предоплата}",
  "{оплата}",
] as const;

export const DEFAULT_SMART_MESSAGES: SmartMessage[] = [
  {
    id: "confirmation",
    title: "Подтверждение",
    builtIn: true,
    text: "Здравствуйте, {имя}! Подтверждаю нашу съёмку {дата} в {время}. Место: {место}.",
  },
  {
    id: "on-my-way",
    title: "Я выезжаю",
    builtIn: true,
    text: "Здравствуйте, {имя}! Я выезжаю на съёмку и буду к {время}. До встречи!",
  },
  {
    id: "after-shoot",
    title: "После съёмки",
    builtIn: true,
    text: "Спасибо за съёмку! Готовые фотографии пришлю до {срок_сдачи}. {остаток}",
  },
];

function cleanMessage(value: unknown, index: number): SmartMessage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const text = typeof item.text === "string" ? item.text.trim() : "";
  if (!title || !text) return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : `message-${index + 1}`,
    title,
    text,
    builtIn: item.builtIn === true,
  };
}

export function normalizeSmartMessages(value: unknown): SmartMessage[] {
  if (!Array.isArray(value)) return DEFAULT_SMART_MESSAGES;
  const messages = value.flatMap(cleanMessage);
  return messages.length ? messages : DEFAULT_SMART_MESSAGES;
}

export function renderSmartMessage(template: string, shoot: Shoot) {
  const firstName = shoot.clientName.trim().split(/\s+/)[0] || shoot.clientName;
  const balance = Math.max(0, shoot.price - shoot.paidAmount);
  const payment = shoot.paymentType === "advance"
    ? "Аванс"
    : shoot.paymentType === "postpay"
      ? "После съёмки"
      : "Полная оплата";
  const values: Record<(typeof SMART_VARIABLES)[number], string> = {
    "{имя}": firstName,
    "{дата}": dateRu(shoot.startAt),
    "{время}": new Date(shoot.startAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    "{место}": shoot.location || "место уточняется",
    "{срок_сдачи}": dateRu(deliveryDate(shoot).toISOString()),
    "{остаток}": balance ? `Остаток к оплате — ${money(balance)}.` : "Оплата закрыта полностью.",
    "{стоимость}": money(shoot.price),
    "{предоплата}": money(shoot.paidAmount),
    "{оплата}": payment,
  };
  return SMART_VARIABLES.reduce(
    (result, variable) => result.replaceAll(variable, values[variable]),
    template,
  );
}

export function insertMessageVariable(
  text: string,
  start: number,
  end: number,
  variable: string,
) {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  const value = `${text.slice(0, from)}${variable}${text.slice(to)}`;
  return { value, cursor: from + variable.length };
}

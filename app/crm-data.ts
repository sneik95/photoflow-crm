export type Tab =
  | "shoots"
  | "calendar"
  | "clients"
  | "finance"
  | "settings"
  | "profile";

export type Client = {
  id: number;
  name: string;
  phone: string;
  email: string;
  kind: "person" | "company";
  notes: string;
};

export type ShootType = {
  name: string;
  color: string;
  deliveryDays: number;
};

export type CheckItem = {
  id: string;
  label: string;
  done: boolean;
};

export type TimelineItem = CheckItem & {
  time: string;
};

export type ShootStatus =
  | "lead"
  | "booked"
  | "preparing"
  | "shooting"
  | "processing"
  | "delivered";

export type Shoot = {
  id: number;
  clientId: number | null;
  clientName: string;
  type: string;
  color: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  comment: string;
  price: number;
  paymentType: "advance" | "full" | "postpay";
  paidAmount: number;
  deliveryDays: number;
  delivered: boolean;
  archived: boolean;
  status: ShootStatus;
  location: string;
  travelMinutes: number;
  organizerName: string;
  organizerPhone: string;
  editingHours: number;
  travelCost: number;
  otherCosts: number;
  equipment: CheckItem[];
  shotList: CheckItem[];
  timeline: TimelineItem[];
  portalToken: string;
  clientGuide: string;
};

export const CALENDAR_COLORS = {
  cobalt: "#3659E3",
  emerald: "#008A68",
  raspberry: "#C92A69",
  orange: "#E46F00",
  cyan: "#007FB5",
  lime: "#5F8F00",
  ochre: "#A58F00",
  slate: "#596475",
  red: "#C9343A",
  brown: "#6B4C3A",
} as const;

export const DEFAULT_TYPES: ShootType[] = [
  { name: "Свадьба", color: CALENDAR_COLORS.cobalt, deliveryDays: 120 },
  { name: "Семейная", color: CALENDAR_COLORS.emerald, deliveryDays: 14 },
  { name: "Портрет", color: CALENDAR_COLORS.raspberry, deliveryDays: 14 },
  { name: "Love story", color: CALENDAR_COLORS.orange, deliveryDays: 14 },
  { name: "Бизнес", color: CALENDAR_COLORS.cyan, deliveryDays: 5 },
  { name: "Беременность", color: CALENDAR_COLORS.lime, deliveryDays: 10 },
  { name: "Новорождённые", color: CALENDAR_COLORS.ochre, deliveryDays: 10 },
  { name: "Репортаж", color: CALENDAR_COLORS.slate, deliveryDays: 7 },
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 1,
    name: "Алёна Наумова",
    phone: "+7 918 555-41-20",
    email: "",
    kind: "person",
    notes: "Свадьба в Абрау-Дюрсо",
  },
  {
    id: 2,
    name: "Женя Ревина",
    phone: "+7 988 555-18-09",
    email: "",
    kind: "person",
    notes: "Портретная съёмка",
  },
];

export const INITIAL_SHOOTS: Shoot[] = [
  {
    id: 1,
    clientId: 2,
    clientName: "Женя Ревина",
    type: "Портрет",
    color: CALENDAR_COLORS.raspberry,
    startAt: "2026-08-19T12:00",
    endAt: "2026-08-19T14:00",
    allDay: false,
    comment: "Портретная прогулка у моря",
    price: 12000,
    paymentType: "postpay",
    paidAmount: 0,
    deliveryDays: 14,
    delivered: false,
    archived: false,
    status: "processing",
    location: "Суджукская коса, Новороссийск",
    travelMinutes: 25,
    organizerName: "",
    organizerPhone: "",
    editingHours: 4,
    travelCost: 600,
    otherCosts: 0,
    equipment: defaultEquipment("Портрет"),
    shotList: defaultShotList("Портрет"),
    timeline: defaultTimeline("12:00", "14:00", "Портрет"),
    portalToken: "",
    clientGuide: "Возьмите два образа и удобную обувь для прогулки.",
  },
  {
    id: 2,
    clientId: 1,
    clientName: "Алёна Наумова",
    type: "Свадьба",
    color: CALENDAR_COLORS.cobalt,
    startAt: "2026-08-22T14:00",
    endAt: "2026-08-22T22:00",
    allDay: false,
    comment: "Полный свадебный день",
    price: 69000,
    paymentType: "advance",
    paidAmount: 5000,
    deliveryDays: 120,
    delivered: false,
    archived: false,
    status: "preparing",
    location: "Абрау-Дюрсо, Краснодарский край",
    travelMinutes: 70,
    organizerName: "Мария, организатор",
    organizerPhone: "+7 918 777-14-20",
    editingHours: 28,
    travelCost: 3500,
    otherCosts: 8000,
    equipment: defaultEquipment("Свадьба"),
    shotList: defaultShotList("Свадьба"),
    timeline: defaultTimeline("14:00", "22:00", "Свадьба"),
    portalToken: "",
    clientGuide:
      "Будьте готовы за 20 минут до начала. Кольца, приглашения и детали положите рядом с платьем.",
  },
];

export const COLORS = Object.values(CALENDAR_COLORS);

const LEGACY_COLORS: Record<string, string> = {
  "#8b7cf6": CALENDAR_COLORS.cobalt,
  "#16b98c": CALENDAR_COLORS.emerald,
  "#e45287": CALENDAR_COLORS.raspberry,
  "#ff9f1c": CALENDAR_COLORS.orange,
  "#368fd8": CALENDAR_COLORS.cyan,
  "#df4c5c": CALENDAR_COLORS.red,
  "#6cad26": CALENDAR_COLORS.lime,
  "#bd7317": CALENDAR_COLORS.ochre,
  "#9b9b96": CALENDAR_COLORS.slate,
  "#ed562c": CALENDAR_COLORS.brown,
  "#5267ff": CALENDAR_COLORS.cobalt,
  "#63c7a4": CALENDAR_COLORS.emerald,
  "#ff8e73": CALENDAR_COLORS.raspberry,
  "#ffb08f": CALENDAR_COLORS.orange,
  "#5b8def": CALENDAR_COLORS.cyan,
  "#ff776d": CALENDAR_COLORS.red,
  "#84c99f": CALENDAR_COLORS.lime,
  "#d7a66e": CALENDAR_COLORS.ochre,
  "#8f98a6": CALENDAR_COLORS.slate,
  "#ff9b7a": CALENDAR_COLORS.brown,
};

export function displayColor(color: string) {
  return LEGACY_COLORS[color.toLowerCase()] || color;
}

export function money(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function dateRu(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

export function deliveryDate(shoot: Shoot) {
  const result = new Date(shoot.startAt);
  result.setDate(result.getDate() + shoot.deliveryDays);
  return result;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function item(label: string, index: number): CheckItem {
  return { id: `item-${index}-${label.toLowerCase().replace(/\s+/g, "-")}`, label, done: false };
}

export function defaultEquipment(type: string): CheckItem[] {
  const common = [
    "Основная камера",
    "Запасная камера",
    "Заряженные аккумуляторы",
    "Чистые карты памяти",
    "Вспышка и синхронизатор",
  ];
  const extra = type === "Свадьба" ? ["Два комплекта объективов", "Пауэрбанк", "Дождевик"] : ["Рефлектор", "Салфетка для оптики"];
  return [...common, ...extra].map(item);
}

export function defaultShotList(type: string): CheckItem[] {
  const labels =
    type === "Свадьба"
      ? ["Детали и кольца", "Сборы невесты", "Первая встреча", "Церемония", "Семейные группы", "Портреты пары", "Первый танец", "Торт и финал"]
      : ["Общий план локации", "Крупный портрет", "Средний план", "Детали", "Кадр в движении", "Вертикальный кадр для Stories"];
  return labels.map(item);
}

export function defaultTimeline(
  start: string,
  end: string,
  type: string,
): TimelineItem[] {
  if (type === "Свадьба") {
    return [
      { id: "arrival", time: start, label: "Прибытие и детали", done: false },
      { id: "ceremony", time: "16:00", label: "Церемония", done: false },
      { id: "portraits", time: "18:30", label: "Портреты пары", done: false },
      { id: "finish", time: end, label: "Финальные кадры", done: false },
    ];
  }
  return [
    { id: "arrival", time: start, label: "Встреча и подготовка", done: false },
    { id: "main", time: start, label: "Основная серия", done: false },
    { id: "finish", time: end, label: "Финальные кадры", done: false },
  ];
}

export function shootDurationHours(shoot: Shoot) {
  const duration = new Date(shoot.endAt).getTime() - new Date(shoot.startAt).getTime();
  return Math.max(0, duration / 3_600_000);
}

export function profitPerHour(shoot: Shoot) {
  const profit = shoot.price - shoot.travelCost - shoot.otherCosts;
  const hours = shootDurationHours(shoot) + shoot.editingHours + shoot.travelMinutes / 60;
  return hours > 0 ? Math.round(profit / hours) : 0;
}

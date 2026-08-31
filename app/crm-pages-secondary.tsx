"use client";

import {
  Dispatch,
  FormEvent,
  PointerEvent,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Client, Shoot, ShootType } from "./crm-data";
import {
  COLORS,
  dateRu,
  displayColor,
  money,
  profitPerHour,
  shootDurationHours,
} from "./crm-data";
import { downloadCrmExcel } from "./excel-export";
import {
  deliveryReminderSetting,
  normalizeShootType,
  positiveWholeNumber,
  reminderDaysLabel,
  removeShootType,
  storedDeliveryReminderDays,
} from "./crm-settings";
import { Field, Icon, PageHeader, ToggleRow } from "./crm-ui";

export function FinancePage({ shoots }: { shoots: Shoot[] }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "numeric",
  }).format(now);
  const total = shoots.reduce((sum, shoot) => sum + shoot.price, 0);
  const received = shoots.reduce((sum, shoot) => sum + shoot.paidAmount, 0);
  const expected = total - received;
  const totalCosts = shoots.reduce(
    (sum, shoot) => sum + shoot.travelCost + shoot.otherCosts,
    0,
  );
  const netProfit = total - totalCosts;
  const totalHours = shoots.reduce(
    (sum, shoot) =>
      sum +
      shootDurationHours(shoot) +
      shoot.editingHours +
      shoot.travelMinutes / 60,
    0,
  );
  const averageProfitHour = totalHours ? Math.round(netProfit / totalHours) : 0;
  const annualGoal = 2_500_000;
  const byType = Object.entries(
    shoots.reduce<Record<string, number>>(
      (acc, shoot) => ({
        ...acc,
        [shoot.type]: (acc[shoot.type] || 0) + shoot.price,
      }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section className="page">
      <PageHeader
        title="Финансы"
        subtitle={`${currentYear} год`}
        action={
          <span className="currency" aria-label="Валюта: рубли">
            ₽ Рубли
          </span>
        }
      />
      <div className="kpi-grid">
        <article>
          <span>Всего за год</span><strong>{money(total)}</strong>
          <p>{shoots.length} проектов</p>
        </article>
        <article>
          <span>Текущий месяц</span><strong className="green-text">{money(total)}</strong>
          <p>{currentMonth}</p>
        </article>
        <article>
          <span>Проектов всего</span><strong>{shoots.length}</strong>
          <p>в {currentYear} году</p>
        </article>
        <article>
          <span>Прибыль в час</span><strong>{money(averageProfitHour)}</strong>
          <p>{Math.round(totalHours)} ч. вместе с обработкой</p>
        </article>
      </div>

      <div className="panel time-economics">
        <div className="panel-title-row">
          <div>
            <h2>Экономика времени</h2>
            <p>Что действительно приносит деньги после расходов и обработки</p>
          </div>
          <span>{money(netProfit)} чистыми</span>
        </div>
        <div className="time-kpis">
          <div><span>Расходы</span><strong>{money(totalCosts)}</strong></div>
          <div><span>Рабочих часов</span><strong>{Math.round(totalHours)} ч.</strong></div>
          <div><span>Среднее</span><strong>{money(averageProfitHour)}/ч</strong></div>
        </div>
        <div className="profitability-list">
          {shoots
            .slice()
            .sort((a, b) => profitPerHour(b) - profitPerHour(a))
            .map((shoot, index) => {
              const hours =
                shootDurationHours(shoot) +
                shoot.editingHours +
                shoot.travelMinutes / 60;
              return (
                <article key={shoot.id}>
                  <span className="profit-rank">{index + 1}</span>
                  <div>
                    <strong>{shoot.type} · {shoot.clientName}</strong>
                    <small>{hours.toFixed(1)} ч. · расходы {money(shoot.travelCost + shoot.otherCosts)}</small>
                  </div>
                  <b>{money(profitPerHour(shoot))}/ч</b>
                </article>
              );
            })}
        </div>
        {!!shoots.length && (
          <p className="economics-tip">
            Подсказка: сравнивайте прибыль в час, а не только стоимость пакета — так легче понять, какие съёмки стоит продвигать.
          </p>
        )}
      </div>

      <div className="panel cashflow">
        <h2>Денежный поток</h2>
        <div className="cash-grid">
          <div>
            <span><i className="dot green-dot" />Получено</span>
            <strong className="green-text">{money(received)}</strong>
            <p>авансы и оплаты</p>
          </div>
          <div>
            <span><i className="dot orange-dot" />Ожидается</span>
            <strong className="orange-text">{money(expected)}</strong>
            <p>остатки и постоплата</p>
          </div>
          <div>
            <span><i className="dot violet-dot" />По договорам</span>
            <strong>{money(total)}</strong>
            <p>сумма съёмок</p>
          </div>
        </div>
        <div className="flow-bar">
          <i
            style={{
              width: `${total ? Math.max(4, (received / total) * 100) : 0}%`,
            }}
          />
        </div>
        <div className="flow-labels">
          <span>
            Получено {total ? Math.round((received / total) * 100) : 0}%
          </span>
          <span>
            Ожидается {total ? Math.round((expected / total) * 100) : 0}%
          </span>
        </div>
        <div className="finance-shoots">
          {shoots.map((shoot) => (
            <article key={shoot.id}>
              <div>
                <h3>{shoot.clientName}</h3>
                <p>{shoot.type} · {dateRu(shoot.startAt)}</p>
              </div>
              <strong>{money(shoot.price)}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="panel goal-panel">
        <div className="panel-title-row">
          <h2>Факт / план</h2>
          <span>{Math.round((total / annualGoal) * 100)}% выполнено</span>
        </div>
        <div className="goal-line">
          <span>Получено / цель на год</span>
          <strong>{money(total)} / {money(annualGoal)}</strong>
        </div>
        <div className="progress wide">
          <i style={{ width: `${Math.min(100, (total / annualGoal) * 100)}%` }} />
        </div>
        <p className="forecast">
          Прогноз при текущем темпе <strong>{money(total * 1.5)}</strong>
        </p>
      </div>

      <div className="panel breakdown">
        <h2>По типам съёмок</h2>
        {byType.map(([type, amount]) => (
          <div key={type}>
            <span>{type}</span><strong>{money(amount)}</strong>
            <i><b style={{ width: `${total ? (amount / total) * 100 : 0}%` }} /></i>
          </div>
        ))}
      </div>
    </section>
  );
}

type TypeEditState = { index: number; draft: ShootType } | null;

function SwipeableTypeRow({
  type,
  index,
  isOpen,
  isHinted,
  editing,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onDraftChange,
  onSaveEdit,
  onCancelEdit,
}: {
  type: ShootType;
  index: number;
  isOpen: boolean;
  isHinted: boolean;
  editing: TypeEditState;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDraftChange: (patch: Partial<ShootType>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [dragX, setDragX] = useState<number | null>(null);
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    horizontal: boolean | null;
  } | null>(null);
  const didSwipe = useRef(false);
  const actionsWidth = 178;
  const editDraft = editing?.index === index ? editing.draft : null;
  const restingX = isOpen ? -actionsWidth : isHinted ? -42 : 0;
  const translateX = dragX === null ? restingX : dragX;

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".type-row-controls")) return;
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      horizontal: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (current.horizontal === null && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      current.horizontal = Math.abs(deltaX) > Math.abs(deltaY);
    }
    if (!current.horizontal) return;
    didSwipe.current = true;
    setDragX(Math.min(0, Math.max(-actionsWidth - 18, (isOpen ? -actionsWidth : 0) + deltaX)));
  }

  function finishPointer(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.horizontal) {
      const deltaX = event.clientX - current.startX;
      if (deltaX < -48 || dragX !== null && dragX < -actionsWidth / 2) onOpen();
      else onClose();
    }
    gesture.current = null;
    setDragX(null);
    window.requestAnimationFrame(() => {
      didSwipe.current = false;
    });
  }

  return (
    <div className="type-swipe-shell">
      <div className="type-swipe-actions" aria-hidden={!isOpen}>
        <button type="button" className="type-swipe-edit" onClick={onEdit} tabIndex={isOpen ? 0 : -1}>
          Изменить
        </button>
        <button type="button" className="type-swipe-delete" onClick={onDelete} tabIndex={isOpen ? 0 : -1}>
          Удалить
        </button>
      </div>
      <article
        className={`type-row${editDraft ? " expanded" : ""}${isHinted ? " swipe-hint" : ""}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <button
          type="button"
          className="type-row-summary"
          aria-label={`Изменить тип ${type.name}`}
          onClick={(event) => {
            if (didSwipe.current) {
              event.preventDefault();
              return;
            }
            onEdit();
          }}
        >
          <i className="type-swatch" style={{ background: displayColor(type.color), color: displayColor(type.color) }} />
          <span className="type-summary-copy">
            <strong>{type.name}</strong>
            <small>Цвет и срок обработки</small>
          </span>
          <span className="type-deadline-summary">
            <b>{type.deliveryDays}</b>
            <small>дней</small>
          </span>
        </button>
        {editDraft && (
          <div className="type-row-controls">
            <label className="settings-control-block">
              <span>Название типа</span>
              <input
                className="type-name-input"
                value={editDraft.name}
                onChange={(event) => onDraftChange({ name: event.target.value })}
                aria-label="Название типа съёмки"
              />
            </label>
            <div className="settings-control-block">
              <span>Цвет в календаре</span>
              <div className="color-picker" role="group" aria-label={`Цвет типа ${type.name}`}>
                {COLORS.map((color) => (
                  <button
                    type="button"
                    aria-label={`Выбрать цвет ${color}`}
                    aria-pressed={editDraft.color === color}
                    key={color}
                    onClick={() => onDraftChange({ color })}
                    className={editDraft.color === color ? "selected" : ""}
                    style={{ background: displayColor(color) }}
                  />
                ))}
              </div>
            </div>
            <div className="deadline-control">
              <span>
                <strong>Срок обработки</strong>
                <small>Дедлайн после даты съёмки</small>
              </span>
              <label className="deadline-input">
                <input
                  aria-label={`Срок обработки для ${type.name}`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={editDraft.deliveryDays}
                  onChange={(event) => onDraftChange({ deliveryDays: Number(event.target.value) })}
                />
                <span>дней</span>
              </label>
            </div>
            <div className="type-edit-actions">
              <button type="button" className="button muted" onClick={onCancelEdit}>Отменить</button>
              <button type="button" className="button primary" onClick={onSaveEdit}>Сохранить</button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

export function SettingsPage({
  types,
  setTypes,
  shoots,
  clients,
  notify,
  initialReminders,
  initialDeliveryReminderDays = 1,
  onSave,
}: {
  types: ShootType[];
  setTypes: Dispatch<SetStateAction<ShootType[]>>;
  shoots: Shoot[];
  clients: Client[];
  notify: (message: string) => void;
  initialReminders?: number[];
  initialDeliveryReminderDays?: number;
  onSave?: (types: ShootType[], reminders: number[], deliveryReminderDays: number) => Promise<boolean> | boolean | void;
}) {
  const [reminders, setReminders] = useState(initialReminders || [5, 1, 0]);
  const [deliveryReminder, setDeliveryReminder] = useState(() =>
    deliveryReminderSetting(initialDeliveryReminderDays),
  );
  const [googleHelp, setGoogleHelp] = useState(false);
  const [openSwipe, setOpenSwipe] = useState<number | null>(null);
  const [hintedType, setHintedType] = useState<number | null>(null);
  const [editing, setEditing] = useState<TypeEditState>(null);

  useEffect(() => {
    if (!types.length || typeof window === "undefined") return;
    const hintKey = "photoflow:settings-types-swipe-hint:v1";
    if (window.sessionStorage.getItem(hintKey)) return;
    window.sessionStorage.setItem(hintKey, "1");
    let timeout: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      setHintedType(0);
      timeout = window.setTimeout(() => setHintedType(null), 560);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [types.length]);

  const deliveryReminderDays = storedDeliveryReminderDays(deliveryReminder);

  async function persist(nextTypes = types, nextDeliveryDays = deliveryReminderDays) {
    const result = await onSave?.(nextTypes, reminders, nextDeliveryDays);
    return result !== false;
  }

  function beginEdit(index: number) {
    setOpenSwipe(null);
    setHintedType(null);
    setEditing({ index, draft: { ...types[index] } });
  }

  async function saveType() {
    if (!editing) return;
    const next = normalizeShootType(editing.draft);
    if (!next.name) {
      notify("Введите название типа съёмки");
      return;
    }
    const nextTypes = types.map((type, index) => index === editing.index ? next : type);
    setTypes(nextTypes);
    setEditing(null);
    if (await persist(nextTypes)) notify("Тип съёмки сохранён");
  }

  async function deleteType(index: number) {
    setOpenSwipe(null);
    if (!window.confirm(`Удалить тип «${types[index]?.name || ""}»? Существующие съёмки сохранят свои данные.`)) {
      return;
    }
    const nextTypes = removeShootType(types, index);
    setTypes(nextTypes);
    if (editing?.index === index) setEditing(null);
    if (await persist(nextTypes)) notify("Тип съёмки удалён");
  }

  function exportCalendar() {
    const pad = (value: number) => String(value).padStart(2, "0");
    const stamp = (value: string) => {
      const date = new Date(value);
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
    };
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PhotoFlow//RU",
      ...shoots.flatMap((shoot) => [
        "BEGIN:VEVENT",
        `UID:shoot-${shoot.id}@photoflow`,
        `DTSTART:${stamp(shoot.startAt)}`,
        `DTEND:${stamp(shoot.endAt)}`,
        `SUMMARY:${shoot.type} — ${shoot.clientName}`,
        `DESCRIPTION:${shoot.comment}`,
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/calendar" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "photoflow-calendar.ics";
    link.click();
    URL.revokeObjectURL(url);
    notify("Календарь скачан");
  }

  return (
    <section className="page">
      <PageHeader title="Настройки" subtitle="Настройте PhotoFlow под себя" />
      <div className="panel settings-panel settings-types-panel">
        <div className="settings-section-head compact">
          <Icon name="spark" />
          <div>
            <span>Рабочий процесс</span>
            <h2>Типы съёмок</h2>
            <p>Цвет в календаре и срок обработки для каждого проекта.</p>
          </div>
        </div>
        <div className="type-list">
          {types.map((type, index) => (
            <SwipeableTypeRow
              key={`${type.name}-${index}`}
              type={type}
              index={index}
              isOpen={openSwipe === index}
              isHinted={hintedType === index}
              editing={editing}
              onOpen={() => setOpenSwipe(index)}
              onClose={() => setOpenSwipe(null)}
              onEdit={() => beginEdit(index)}
              onDelete={() => void deleteType(index)}
              onDraftChange={(patch) => setEditing((current) =>
                current?.index === index
                  ? { ...current, draft: { ...current.draft, ...patch } }
                  : current,
              )}
              onSaveEdit={() => void saveType()}
              onCancelEdit={() => setEditing(null)}
            />
          ))}
        </div>
        <button
          className="button secondary full add-type-button"
          onClick={() => {
            const index = types.length;
            const nextTypes = [
              ...types,
              {
                name: `Новый тип ${types.length + 1}`,
                color: COLORS[types.length % COLORS.length],
                deliveryDays: 14,
              },
            ];
            setTypes(nextTypes);
            setEditing({ index, draft: nextTypes[index] });
          }}
        >
          <Icon name="plus" />
          <span>Добавить тип съёмки</span>
        </button>
      </div>

      <div className="panel settings-panel">
        <div className="settings-section-head compact">
          <Icon name="calendar" />
          <div>
            <span>Планирование</span>
            <h2>Календарь и напоминания</h2>
            <p>Три контрольные точки перед каждой съёмкой.</p>
          </div>
        </div>
        <div className="reminder-grid">
          {reminders.map((value, index) => (
            <label className="reminder-card" key={index}>
              <span className="reminder-index">0{index + 1}</span>
              <span className="reminder-copy">
                <strong>Напоминание {index + 1}</strong>
                <small>До начала съёмки</small>
              </span>
              <select
                aria-label={`Напоминание ${index + 1}`}
                value={value}
                onChange={(event) =>
                  setReminders((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? Number(event.target.value) : item,
                    ),
                  )
                }
              >
                <option value="7">За 7 дней</option>
                <option value="5">За 5 дней</option>
                <option value="3">За 3 дня</option>
                <option value="1">За 1 день</option>
                <option value="0">За 3 часа</option>
              </select>
            </label>
          ))}
        </div>
        <div className="settings-group-title">
          <strong>Интеграции</strong>
          <span>Календарь, синхронизация и работа без сети</span>
        </div>
        <div className="settings-list">
          <div className="integration-row">
            <Icon name="calendar" />
            <div>
              <strong>Календарь телефона</strong>
              <p>Экспорт всех текущих съёмок</p>
            </div>
            <button className="button secondary" onClick={exportCalendar}>
              Скачать .ics
            </button>
          </div>
          <div className="integration-row">
            <span className="settings-service-icon google" aria-hidden="true">G</span>
            <div>
              <strong>Google Calendar <span className="integration-badge">Не подключён</span></strong>
              <p>Автоматическое создание и обновление событий</p>
            </div>
            <button
              className="button secondary"
              onClick={() => setGoogleHelp((value) => !value)}
            >
              {googleHelp ? "Скрыть" : "Как подключить"}
            </button>
          </div>
          {googleHelp && (
            <div className="oauth-guide">
              <span>Подключение Google</span>
              <ol>
                <li>Создайте проект в Google Cloud Console и включите Google Calendar API.</li>
                <li>Настройте OAuth consent screen и создайте OAuth Client для веб-приложения.</li>
                <li>Добавьте адрес возврата вашего PhotoFlow и передайте разработчику Client ID и Client Secret безопасным способом.</li>
              </ol>
              <p>Секрет нельзя присылать в обычном сообщении или хранить в коде. До подключения экспорт .ics выше полностью рабочий.</p>
            </div>
          )}
          <div className="integration-row">
            <span className="settings-service-icon ready" aria-hidden="true">✓</span>
            <div>
              <strong>Офлайн-режим <span className="integration-badge ready">Включён</span></strong>
              <p>Проекты доступны без сети, изменения синхронизируются позже</p>
            </div>
            <button className="button muted" onClick={() => notify("Офлайн-режим работает автоматически")}>Активно</button>
          </div>
        </div>
      </div>

      <div className="panel settings-panel">
        <div className="settings-section-head compact">
          <Icon name="settings" />
          <div>
            <span>Интерфейс</span>
            <h2>Другие настройки</h2>
            <p>Только то, что нужно именно в вашей работе.</p>
          </div>
        </div>
        <div className="settings-toggle-list">
          <ToggleRow
            title="Показывать средний чек"
            subtitle="Карточка среднего чека в финансах"
          />
          <div className="delivery-reminder-setting">
            <ToggleRow
              title="Напоминать о сроке сдачи"
              subtitle={
                deliveryReminder.enabled
                  ? `Напомнить за ${reminderDaysLabel(deliveryReminder.days)} до срока сдачи`
                  : "Напоминания отключены"
              }
              checked={deliveryReminder.enabled}
              onChange={(enabled) =>
                setDeliveryReminder((current) => ({ ...current, enabled }))
              }
            />
            <label className="delivery-reminder-days">
              <span>Напомнить за</span>
              <input
                className="delivery-reminder-input"
                aria-label="За сколько дней напомнить о сроке сдачи"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                disabled={!deliveryReminder.enabled}
                value={deliveryReminder.days}
                onChange={(event) => {
                  const days = positiveWholeNumber(event.target.value, 0);
                  if (days > 0) {
                    setDeliveryReminder((current) => ({ ...current, days }));
                  }
                }}
              />
              <span>{reminderDaysLabel(deliveryReminder.days).replace(/^\d+\s/, "")}</span>
              <span>до срока сдачи</span>
            </label>
          </div>
        </div>
      </div>
      <div className="panel settings-panel">
        <div className="settings-section-head compact">
          <Icon name="finance" />
          <div>
            <span>Резервная копия</span>
            <h2>Данные</h2>
            <p>Скачайте клиентов и съёмки одним Excel-файлом.</p>
          </div>
        </div>
        <div className="data-export-card">
          <div>
            <strong>Полная выгрузка</strong>
            <span>{clients.length} клиентов · {shoots.length} проектов · 2 листа</span>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              downloadCrmExcel(clients, shoots);
              notify("Excel-файл скачан");
            }}
          >
            Скачать Excel
          </button>
        </div>
      </div>
      <button
        className="button primary full settings-save"
        onClick={() => {
          void persist().then((saved) => saved && notify("Настройки сохранены"));
        }}
      >
        Сохранить настройки
      </button>
    </section>
  );
}

export type ProfileData = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  email: string;
  goal: string;
};

export function ProfilePage({
  notify,
  initialProfile,
  onSave,
}: {
  notify: (message: string) => void;
  initialProfile?: ProfileData;
  onSave?: (profile: ProfileData) => void;
}) {
  const [profile, setProfile] = useState<ProfileData>(
    initialProfile || {
      firstName: "Кристина",
      lastName: "Вениченко",
      phone: "+7 900 000-00-00",
      city: "Новороссийск",
      email: "kristina@example.ru",
      goal: "2500000",
    },
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave?.(profile);
    notify("Профиль сохранён");
  }

  return (
    <section className="page">
      <PageHeader title="Профиль" subtitle="Настройки аккаунта" />
      <div className="profile-card panel">
        <span className="avatar large">
          {profile.firstName[0]}{profile.lastName[0]}
        </span>
        <div>
          <h2>{profile.firstName} {profile.lastName}</h2>
          <p>{profile.email}</p>
        </div>
      </div>
      <form className="panel profile-form" onSubmit={submit}>
        <h2>Данные</h2>
        <div className="form-grid">
          <Field label="Имя">
            <input
              value={profile.firstName}
              onChange={(event) =>
                setProfile({ ...profile, firstName: event.target.value })
              }
            />
          </Field>
          <Field label="Фамилия">
            <input
              value={profile.lastName}
              onChange={(event) =>
                setProfile({ ...profile, lastName: event.target.value })
              }
            />
          </Field>
          <Field label="Телефон">
            <input
              value={profile.phone}
              onChange={(event) =>
                setProfile({ ...profile, phone: event.target.value })
              }
            />
          </Field>
          <Field label="Город">
            <input
              value={profile.city}
              onChange={(event) =>
                setProfile({ ...profile, city: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Финансовая цель на год">
          <input
            type="number"
            value={profile.goal}
            onChange={(event) =>
              setProfile({ ...profile, goal: event.target.value })
            }
          />
        </Field>
        <button className="button primary full">Сохранить</button>
      </form>

      <div className="panel subscription">
        <div className="panel-title-row">
          <h2>Подписка</h2><span>Текущий тариф</span>
        </div>
        <div className="plan-row">
          <div>
            <strong>Бесплатный план</strong>
            <p>До 10 съёмок · до 10 клиентов</p>
          </div>
          <button
            className="button secondary"
            onClick={() => notify("Тарифы появятся после подключения оплаты")}
          >
            Улучшить
          </button>
        </div>
      </div>

      <div className="panel referral">
        <span>Реферальная программа</span>
        <h2>Пригласите коллегу — получите месяц бесплатно</h2>
        <p>
          Когда друг оплатит подписку по вашей ссылке, вам начислится месяц Pro.
        </p>
        <button
          className="button secondary"
          onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/ref/demo`);
            notify("Ссылка скопирована");
          }}
        >
          Скопировать ссылку
        </button>
      </div>
    </section>
  );
}

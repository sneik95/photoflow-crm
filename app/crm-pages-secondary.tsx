"use client";

import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  useRef,
  useState,
} from "react";
import type { Client, Shoot, ShootType } from "./crm-data";
import {
  COLORS,
  dateRu,
  displayColor,
  money,
} from "./crm-data";
import {
  availableFinanceYears,
  financeProfitPerHour,
  financeShootHours,
  financeSummary,
  safeFinanceNumber,
  shootsInCurrentMonth,
} from "./crm-finance";
import { downloadCrmExcel } from "./excel-export";
import {
  deliveryReminderSetting,
  normalizeShootType,
  positiveWholeNumber,
  reminderDaysLabel,
  removeShootType,
  russianDays,
} from "./crm-settings";
import {
  Field,
  Icon,
  Modal,
  PageHeader,
  SwipeActions,
  ToggleRow,
  useOneTimeSwipeHint,
  useSwipeGesture,
} from "./crm-ui";
import {
  AVATAR_CROP_SIZE,
  AVATAR_OUTPUT_SIZE,
  clampAvatarOffset,
  type AvatarOffset,
} from "./crm-avatar";

type AvatarCropSource = {
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
};


export function FinancePage({ shoots }: { shoots: Shoot[] }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const availableYears = availableFinanceYears(shoots, currentYear);
  const {
    yearShoots,
    total,
    received,
    expected,
    totalCosts,
    totalHours,
    netProfit,
    averageProfitHour,
    averageCheck,
    byType,
  } = financeSummary(shoots, selectedYear);
  const isCurrentYear = selectedYear === currentYear;
  const currentMonth = new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "numeric",
  }).format(now);
  const currentMonthTotal = shootsInCurrentMonth(shoots, now).reduce(
    (sum, shoot) => sum + safeFinanceNumber(shoot.price),
    0,
  );
  const annualGoal = 2_500_000;

  return (
    <section className="page">
      <PageHeader
        title="Финансы"
        subtitle={
          <label className="finance-year-select">
            <select
              aria-label="Год финансовой сводки"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year} год</option>
              ))}
            </select>
          </label>
        }
      />
      <div className="kpi-grid">
        <article>
          <span>Всего за год</span><strong>{money(total)}</strong>
          <p>{yearShoots.length} проектов</p>
        </article>
        {isCurrentYear ? (
          <article>
            <span>Текущий месяц</span><strong className="green-text">{money(currentMonthTotal)}</strong>
            <p>{currentMonth}</p>
          </article>
        ) : (
          <article>
            <span>Прибыль в час</span><strong>{money(averageProfitHour)}</strong>
            <p>{Math.round(totalHours)} ч. вместе с обработкой</p>
          </article>
        )}
        <article>
          <span>Проектов всего</span><strong>{yearShoots.length}</strong>
          <p>в {selectedYear} году</p>
        </article>
        {isCurrentYear && (
          <article>
            <span>Прибыль в час</span><strong>{money(averageProfitHour)}</strong>
            <p>{Math.round(totalHours)} ч. вместе с обработкой</p>
          </article>
        )}
        <article>
          <span>Средний чек</span><strong>{money(averageCheck)}</strong>
          <p>за проект в {selectedYear} году</p>
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
          {yearShoots
            .slice()
            .sort((a, b) => financeProfitPerHour(b) - financeProfitPerHour(a))
            .map((shoot, index) => {
              const hours = financeShootHours(shoot);
              const costs =
                safeFinanceNumber(shoot.travelCost) +
                safeFinanceNumber(shoot.otherCosts);
              return (
                <article key={shoot.id}>
                  <span className="profit-rank">{index + 1}</span>
                  <div>
                    <strong>{shoot.type} · {shoot.clientName}</strong>
                    <small>{hours.toFixed(1)} ч. · расходы {money(costs)}</small>
                  </div>
                  <b>{money(financeProfitPerHour(shoot))}/ч</b>
                </article>
              );
            })}
        </div>
        {!!yearShoots.length && (
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
          {yearShoots.map((shoot) => (
            <article key={shoot.id}>
              <div>
                <h3>{shoot.clientName}</h3>
                <p>{shoot.type} · {dateRu(shoot.startAt)}</p>
              </div>
              <strong>{money(safeFinanceNumber(shoot.price))}</strong>
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
  onHintDismiss,
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
  onHintDismiss: () => void;
  onDraftChange: (patch: Partial<ShootType>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const editDraft = editing?.index === index ? editing.draft : null;
  const swipe = useSwipeGesture({
    open: isOpen,
    hinted: isHinted,
    onOpen,
    onClose,
    onHintDismiss,
    ignoreSelector: ".type-row-controls",
  });

  return (
    <div className="type-swipe-shell">
      <SwipeActions open={isOpen} onEdit={onEdit} onDelete={onDelete} />
      <article
        className={`type-row${editDraft ? " expanded" : ""}${isHinted ? " swipe-hint" : ""}`}
        style={{ transform: `translateX(${swipe.translateX}px)` }}
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
      >
        <button
          type="button"
          className="type-row-summary"
          aria-label={`Изменить тип ${type.name}`}
          onClick={(event) => {
            if (swipe.didSwipe.current) {
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
  const [reminderDaysInput, setReminderDaysInput] = useState(() =>
    String(deliveryReminderSetting(initialDeliveryReminderDays).days),
  );
  const [googleHelp, setGoogleHelp] = useState(false);
  const [openSwipe, setOpenSwipe] = useState<number | null>(null);
  const [editing, setEditing] = useState<TypeEditState>(null);
  const typeHint = useOneTimeSwipeHint(
    "photoflow:settings-types-swipe-hint:v1",
    types.length > 0,
  );

  const reminderDraftDays = positiveWholeNumber(
    reminderDaysInput,
    deliveryReminder.days,
  );
  const deliveryReminderDays = deliveryReminder.enabled
    ? reminderDraftDays
    : 0;

  function commitReminderDaysInput() {
    const days = positiveWholeNumber(reminderDaysInput, deliveryReminder.days);
    setDeliveryReminder((current) => ({ ...current, days }));
    setReminderDaysInput(String(days));
  }

  async function persist(nextTypes = types, nextDeliveryDays = deliveryReminderDays) {
    const result = await onSave?.(nextTypes, reminders, nextDeliveryDays);
    return result !== false;
  }

  function beginEdit(index: number) {
    setOpenSwipe(null);
    typeHint.dismissHint();
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
              isHinted={typeHint.showHint && index === 0}
              editing={editing}
              onOpen={() => setOpenSwipe(index)}
              onClose={() => setOpenSwipe(null)}
              onEdit={() => beginEdit(index)}
              onDelete={() => void deleteType(index)}
              onHintDismiss={typeHint.dismissHint}
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
                value={reminderDaysInput}
                onChange={(event) => setReminderDaysInput(event.target.value)}
                onBlur={commitReminderDaysInput}
              />
              <span>{russianDays(reminderDraftDays)}</span>
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

function AvatarCropModal({
  source,
  onCancel,
  onConfirm,
}: {
  source: AvatarCropSource;
  onCancel: () => void;
  onConfirm: (avatar: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<AvatarOffset>({ x: 0, y: 0 });
  const gesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    offset: AvatarOffset;
  } | null>(null);
  const baseScale = Math.max(
    AVATAR_CROP_SIZE / source.width,
    AVATAR_CROP_SIZE / source.height,
  );
  const imageWidth = source.width * baseScale * zoom;
  const imageHeight = source.height * baseScale * zoom;

  function updateZoom(nextZoom: number) {
    setZoom(nextZoom);
    setOffset((current) => clampAvatarOffset(current, source, nextZoom));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    setOffset(
      clampAvatarOffset(
        {
          x: current.offset.x + event.clientX - current.x,
          y: current.offset.y + event.clientY - current.y,
        },
        source,
        zoom,
      ),
    );
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null;
  }

  function confirmCrop() {
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return;

    const renderedScale = baseScale * zoom;
    const imageLeft = (AVATAR_CROP_SIZE - imageWidth) / 2 + offset.x;
    const imageTop = (AVATAR_CROP_SIZE - imageHeight) / 2 + offset.y;
    const sourceWidth = AVATAR_CROP_SIZE / renderedScale;
    const sourceHeight = AVATAR_CROP_SIZE / renderedScale;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    context.drawImage(
      source.image,
      -imageLeft / renderedScale,
      -imageTop / renderedScale,
      sourceWidth,
      sourceHeight,
      0,
      0,
      AVATAR_OUTPUT_SIZE,
      AVATAR_OUTPUT_SIZE,
    );
    onConfirm(canvas.toDataURL("image/jpeg", 0.86));
  }

  return (
    <Modal title="Кадрировать фото" onClose={onCancel} fullScreen viewportAware>
      <div className="avatar-crop-modal">
        <p>Переместите фото, чтобы выбрать область для аватара.</p>
        <div
          className="avatar-crop-stage"
          role="presentation"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
        >
          <img
            src={source.url}
            alt="Предпросмотр кадрирования"
            draggable={false}
            style={{
              width: imageWidth,
              height: imageHeight,
              left: (AVATAR_CROP_SIZE - imageWidth) / 2 + offset.x,
              top: (AVATAR_CROP_SIZE - imageHeight) / 2 + offset.y,
            }}
          />
          <span className="avatar-crop-ring" aria-hidden="true" />
        </div>
        <label className="avatar-crop-zoom">
          <span>Масштаб</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => updateZoom(Number(event.target.value))}
            aria-label="Масштаб фото"
          />
        </label>
        <div className="avatar-crop-actions">
          <button type="button" className="button secondary" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="button primary" onClick={confirmCrop}>
            Сохранить фото
          </button>
        </div>
      </div>
    </Modal>
  );
}

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
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<AvatarCropSource | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  function closeCrop() {
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
  }

  function openPhotoPicker() {
    photoInput.current?.click();
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || !URL.createObjectURL) {
      notify("Не удалось открыть выбранное изображение");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setCropSource({
        url,
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      notify("Не удалось открыть выбранное изображение");
    };
    image.src = url;
  }

  function saveAvatar(nextAvatar: string) {
    setAvatar(nextAvatar);
    closeCrop();
    notify("Фото профиля сохранено");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave?.(profile);
    notify("Профиль сохранён");
  }

  return (
    <section className="page">
      <PageHeader title="Профиль" subtitle="Настройки аккаунта" />
      <div className="profile-card panel">
        <button
          type="button"
          className="profile-avatar-button"
          onClick={openPhotoPicker}
          aria-label="Выбрать фото профиля"
        >
          {avatar ? (
            <img className="avatar large profile-avatar-image" src={avatar} alt="Фото профиля" />
          ) : (
            <span className="avatar large">
              {profile.firstName[0]}{profile.lastName[0]}
            </span>
          )}
          <span>Изменить фото</span>
        </button>
        <input
          ref={photoInput}
          className="profile-photo-input"
          type="file"
          accept="image/*"
          onChange={selectPhoto}
          tabIndex={-1}
        />
        <div>
          <h2>{profile.firstName} {profile.lastName}</h2>
          <p>{profile.email}</p>
        </div>
      </div>
      {cropSource && (
        <AvatarCropModal
          source={cropSource}
          onCancel={closeCrop}
          onConfirm={saveAvatar}
        />
      )}
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

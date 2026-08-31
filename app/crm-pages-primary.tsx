"use client";

import {
  CSSProperties,
  TouchEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Client, Shoot, ShootType } from "./crm-data";
import {
  dateRu,
  displayColor,
  initials,
  money,
} from "./crm-data";
import {
  calendarDaysBetween,
  clientCountLabel,
  filterShoots,
  hasTravelTime,
  isOverdue,
  processingCount,
  projectCountLabel,
  selectDashboardHero,
  shootDeadline,
  shootIsDelivered,
  type ShootListFilter,
  unpaidShoots,
  upcomingCount,
} from "./crm-shoot-logic";
import { DayModeModal } from "./crm-day-mode";
import { Icon, Modal, PageHeader, useOneTimeSwipeHint } from "./crm-ui";

type ShootStatusFilter = ShootListFilter;

type ShootDateSort = "asc" | "desc";

function daysLabel(value: number) {
  const count = Math.abs(value);
  const lastTwo = count % 100;
  const last = count % 10;
  const word =
    lastTwo >= 11 && lastTwo <= 14
      ? "дней"
      : last === 1
        ? "день"
        : last >= 2 && last <= 4
          ? "дня"
          : "дней";
  return `${count} ${word}`;
}

function departureTime(shoot: Shoot) {
  const value = new Date(shoot.startAt);
  value.setMinutes(value.getMinutes() - Math.max(0, shoot.travelMinutes) - 15);
  return value.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShootsPage({
  shoots,
  clients,
  onUpdate,
  onOpen,
  onDelete,
  notify,
}: {
  shoots: Shoot[];
  clients: Client[];
  onUpdate: (id: number, patch: Partial<Shoot>) => void | Promise<void>;
  onOpen: () => void;
  onDelete: (id: number) => void | Promise<void>;
  notify: (message: string) => void;
}) {
  const [dayShootId, setDayShootId] = useState<number | null>(null);
  const [balanceSheetOpen, setBalanceSheetOpen] = useState(false);
  const [openBalanceId, setOpenBalanceId] = useState<number | null>(null);
  const [shootQuery, setShootQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShootStatusFilter>("all");
  const [dateSort, setDateSort] = useState<ShootDateSort>("asc");
  const shootListPanelRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const todayLabel = dateRu(now.toISOString());
  const listShoots = filterShoots(shoots, statusFilter, now);
  const normalizedShootQuery = shootQuery.trim().toLowerCase();
  const filteredShoots = listShoots.filter((shoot) => {
    return (
      !normalizedShootQuery ||
      `${shoot.clientName} ${shoot.location} ${shoot.type}`
        .toLowerCase()
        .includes(normalizedShootQuery)
    );
  });
  const shootFiltersActive =
    !!normalizedShootQuery || statusFilter !== "all" || dateSort !== "asc";

  function resetShootFilters() {
    setShootQuery("");
    setStatusFilter("all");
    setDateSort("asc");
  }

  function applyStatFilter(filter: ShootStatusFilter) {
    setShootQuery("");
    setStatusFilter((current) => (current === filter ? "all" : filter));
    window.requestAnimationFrame(() => {
      shootListPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
  const overdue = shoots.filter((shoot) => isOverdue(shoot, now)).length;
  const upcoming = upcomingCount(shoots, now);
  const monthlyIncome = shoots
    .filter((shoot) => {
      const date = new Date(shoot.startAt);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    })
    .reduce((sum, shoot) => sum + shoot.price, 0);
  const processing = processingCount(shoots, now);
  const hero = selectDashboardHero(shoots, now);
  const focusShoot = hero?.shoot;
  const showDeparture = focusShoot && hasTravelTime(focusShoot.travelMinutes);
  const dayShoot = shoots.find((shoot) => shoot.id === dayShootId);

  const balances = useMemo(() => unpaidShoots(shoots), [shoots]);
  const balanceTotal = balances.reduce((sum, item) => sum + item.balance, 0);

  return (
    <section className="page">
      <PageHeader
        title="Мои съёмки"
        subtitle={todayLabel}
        action={
          <button className="button secondary desktop-action" onClick={onOpen}>
            + Добавить
          </button>
        }
      />
      {focusShoot && (
        <section
          className="shoot-day-hero"
          style={{ "--shoot-color": displayColor(focusShoot.color) } as CSSProperties}
        >
          <div className="shoot-day-photo" aria-hidden="true" />
          <div className="shoot-day-copy">
            <span className="shoot-day-kicker">
              {hero?.kind === "processing" ? "Ближайшая обработка" : "Ближайшая съёмка"}
            </span>
            <h2>{focusShoot.clientName}</h2>
            <p>
              {dateRu(focusShoot.startAt)} ·{" "}
              {new Date(focusShoot.startAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <div className="shoot-day-tags">
              <span>{focusShoot.type}</span>
            </div>
          </div>
          <div className={`shoot-day-metrics${showDeparture ? "" : " single"}`}>
            {showDeparture && (
              <div><span>Выехать в</span><strong>{departureTime(focusShoot)}</strong></div>
            )}
            <div className="shoot-price-metric">
              <span>Стоимость</span>
              <strong>{money(focusShoot.price)}</strong>
              {focusShoot.paymentType === "advance" &&
                focusShoot.paidAmount > 0 &&
                focusShoot.paidAmount < focusShoot.price && (
                  <small>Предоплата {money(focusShoot.paidAmount)}</small>
                )}
            </div>
          </div>
          <button className="button primary" onClick={() => setDayShootId(focusShoot.id)}>
            Открыть проект
          </button>
        </section>
      )}

      <div className="stat-grid dashboard-metrics">
        <StatCard label="Доход за месяц" value={money(monthlyIncome)} tone="blue" />
        <StatCard
          label="В обработке"
          value={processing}
          tone="neutral"
          count
          active={statusFilter === "processing"}
          onClick={() => applyStatFilter("processing")}
        />
        <StatCard
          label="Просроченные задачи"
          value={overdue}
          tone="coral"
          count
          active={statusFilter === "overdue"}
          onClick={() => applyStatFilter("overdue")}
        />
        <StatCard
          label="Ближайшие съёмки"
          value={upcoming}
          tone="mint"
          count
          active={statusFilter === "upcoming"}
          onClick={() => applyStatFilter("upcoming")}
        />
      </div>

      <section className="risk-radar panel">
        <div className="panel-title-row">
          <div>
            <span className="radar-kicker">Радар рисков</span>
            <h2>{balances.length ? "Требуется внимание" : "Всё под контролем"}</h2>
          </div>
        </div>
        {balances.length ? (
          <div className="risk-grid">
            <button
              type="button"
              className="orange"
              onClick={() => setBalanceSheetOpen(true)}
            >
              <i />
              <span>
                <strong>{money(balanceTotal)} не получено</strong>
                <small>{clientCountLabel(balances.length)} с остатком</small>
              </span>
              <b>Показать →</b>
            </button>
          </div>
        ) : (
          <p className="radar-empty">Рисков сейчас нет</p>
        )}
      </section>
      <div className="panel shoot-list-panel" ref={shootListPanelRef}>
        <div className="panel-title-row">
          <h2>Все съёмки</h2>
          <div className="panel-actions">
            <span>{projectCountLabel(filteredShoots.length)}</span>
          </div>
        </div>
        <div className="shoot-filter-panel">
          <label className="shoot-filter-search">
            <Icon name="search" />
            <input
              value={shootQuery}
              onChange={(event) => setShootQuery(event.target.value)}
              placeholder="Клиент или локация…"
            />
          </label>
          <label className="shoot-filter-sort">
            <span>Статус</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ShootStatusFilter)
              }
              aria-label="Фильтр съёмок по статусу"
            >
              <option value="all">Все</option>
              <option value="upcoming">Предстоят</option>
              <option value="processing">В обработке</option>
              <option value="urgent">Горят дедлайны</option>
              <option value="overdue">Просрочены</option>
              <option value="archived">Архивные</option>
            </select>
          </label>
          <label className="shoot-filter-sort">
            <span>По дате</span>
            <select
              value={dateSort}
              onChange={(event) =>
                setDateSort(event.target.value as ShootDateSort)
              }
              aria-label="Сортировка съёмок по дате"
            >
              <option value="asc">Сначала ранние</option>
              <option value="desc">Сначала поздние</option>
            </select>
          </label>
          {shootFiltersActive && (
            <button
              type="button"
              className="shoot-filter-reset"
              onClick={resetShootFilters}
            >
              Сбросить
            </button>
          )}
        </div>
        <div className="shoot-list">
          {filteredShoots
            .slice()
            .sort((a, b) =>
              dateSort === "asc"
                ? a.startAt.localeCompare(b.startAt)
                : b.startAt.localeCompare(a.startAt),
            )
            .map((shoot) => {
              const start = new Date(shoot.startAt);
              const deliver = shootDeadline(shoot);
              const days = calendarDaysBetween(now, deliver);
              const before = start >= now;
              const isDelivered = shootIsDelivered(shoot);
              return (
                <article
                  className="shoot-card"
                  key={shoot.id}
                  style={{ "--shoot-color": displayColor(shoot.color) } as CSSProperties}
                  tabIndex={0}
                  aria-label={`Открыть режим съёмки: ${shoot.clientName}`}
                  onClick={() => setDayShootId(shoot.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDayShootId(shoot.id);
                    }
                  }}
                >
                  <div className="shoot-accent" />
                  <span className="shoot-price">
                    {shoot.paidAmount > 0
                      ? `${money(shoot.paidAmount)} / ${money(shoot.price)}`
                      : money(shoot.price)}
                  </span>
                  <div className="shoot-copy">
                    <div className="shoot-card-topline">
                      <span className="eyebrow">{shoot.type}</span>
                      <span className={`shoot-status ${isDelivered ? "done" : before ? "upcoming" : "processing"}`}>
                        {isDelivered ? "Сдано" : before ? "Предстоит" : "В обработке"}
                      </span>
                    </div>
                    <h3>{shoot.clientName}</h3>
                    <div className="shoot-schedule">
                      <span>{dateRu(shoot.startAt)} ·{" "}
                      {new Date(shoot.startAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}</span>
                      <small>Контакт: {shoot.organizerName || shoot.clientName}</small>
                    </div>
                    {shoot.location && <p className="shoot-location">{shoot.location}</p>}
                    <div className="progress">
                      <i style={{ width: isDelivered ? "100%" : before ? "8%" : "48%" }} />
                    </div>
                  </div>
                  <div className="shoot-meta">
                    <strong>
                      {isDelivered
                        ? "Проект сдан"
                        : before
                        ? `До съёмки — ${daysLabel(Math.max(calendarDaysBetween(now, start), 0))}`
                        : days >= 0
                          ? `До сдачи — ${daysLabel(days)}`
                          : `Сдача просрочена на ${daysLabel(days)}`}
                    </strong>
                  </div>
                  <div className="shoot-actions">
                    <button
                      className={isDelivered ? "chip reopen" : "chip success"}
                      title={isDelivered ? "Вернуть съёмку в работу" : "Отметить съёмку как сданную"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdate(
                          shoot.id,
                          isDelivered
                            ? {
                                archived: false,
                                delivered: false,
                                status: before ? "preparing" : "processing",
                              }
                            : {
                                delivered: true,
                                status: "delivered",
                                archived: true,
                              },
                        );
                      }}
                    >
                      {isDelivered ? "Вернуть в работу" : "Сдано"}
                    </button>
                    <button
                      className="chip delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (
                          window.confirm(
                            `Удалить съёмку «${shoot.clientName}»? Это действие нельзя отменить.`,
                          )
                        ) {
                          if (dayShootId === shoot.id) setDayShootId(null);
                          onDelete(shoot.id);
                        }
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              );
            })}
          {!filteredShoots.length && (
            <div className="shoot-filter-empty">
              <strong>
                {statusFilter === "archived"
                  ? "Архив пока пуст"
                  : "Съёмки не найдены"}
              </strong>
              <span>
                {statusFilter === "archived"
                  ? "Сданные проекты появятся здесь автоматически."
                  : "Измените параметры поиска или сбросьте категорию."}
              </span>
            </div>
          )}
        </div>
      </div>
      {balanceSheetOpen && (
        <Modal
          title="КЛИЕНТЫ С ОСТАТКОМ"
          onClose={() => setBalanceSheetOpen(false)}
        >
          <div className="risk-selection">
            <p>{money(balanceTotal)} осталось получить</p>
            <div className="risk-selection-list">
              {balances.map(({ shoot, balance }, index) => (
                <BalanceSwipeRow
                  key={shoot.id}
                  shoot={shoot}
                  balance={balance}
                  showHint={index === 0}
                  open={openBalanceId === shoot.id}
                  onOpenChange={(open) =>
                    setOpenBalanceId(open ? shoot.id : null)
                  }
                  onOpen={() => {
                    setBalanceSheetOpen(false);
                    setDayShootId(shoot.id);
                  }}
                  onPaid={() => {
                    if (balances.length === 1) setBalanceSheetOpen(false);
                    void onUpdate(shoot.id, { paidAmount: shoot.price });
                  }}
                />
              ))}
            </div>
          </div>
        </Modal>
      )}
      {dayShoot && (
        <DayModeModal
          shoot={dayShoot}
          client={clients.find((client) => client.id === dayShoot.clientId)}
          onClose={() => setDayShootId(null)}
          onUpdate={onUpdate}
          notify={notify}
        />
      )}
    </section>
  );
}

const BALANCE_ACTION_WIDTH = 112;
const BALANCE_FULL_SWIPE = 96;
const BALANCE_HINT_KEY = "photoflow:balance-swipe-hint:v1";

function BalanceSwipeRow({
  shoot,
  balance,
  showHint,
  open,
  onOpenChange,
  onOpen,
  onPaid,
}: {
  shoot: Shoot;
  balance: number;
  showHint: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: () => void;
  onPaid: () => void;
}) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const startRef = useRef({ x: 0, y: 0, axis: "" as "" | "x" | "y" });
  const movedRef = useRef(false);
  const hint = useOneTimeSwipeHint(BALANCE_HINT_KEY, showHint);

  const offset = dragOffset ?? (open ? -BALANCE_ACTION_WIDTH : hint.showHint ? -42 : 0);

  function handleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    hint.dismissHint();
    const touch = event.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY, axis: "" };
    movedRef.current = false;
    setDragOffset(offset);
  }

  function handleTouchMove(event: TouchEvent<HTMLButtonElement>) {
    const touch = event.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    if (!startRef.current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      startRef.current.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
    }
    if (startRef.current.axis !== "x") return;
    event.preventDefault();
    movedRef.current = true;
    const origin = open ? -BALANCE_ACTION_WIDTH : 0;
    setDragOffset(Math.max(-BALANCE_ACTION_WIDTH - 28, Math.min(0, origin + dx)));
  }

  function handleTouchEnd() {
    if (startRef.current.axis !== "x") {
      setDragOffset(null);
      return;
    }
    const current = dragOffset ?? 0;
    if (current <= -BALANCE_FULL_SWIPE) {
      onOpenChange(false);
      setDragOffset(0);
      onPaid();
    } else {
      onOpenChange(current < -44);
      setDragOffset(null);
    }
  }

  return (
    <div className="balance-swipe-row">
      <button
        type="button"
        className="balance-paid-action"
        onClick={() => {
          onOpenChange(false);
          onPaid();
        }}
      >
        Оплачено
      </button>
      <button
        type="button"
        className={`balance-swipe-content${hint.showHint ? " swipe-hint" : ""}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onClick={() => {
          if (!movedRef.current) onOpen();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => setDragOffset(null)}
      >
        <span>
          <strong>{shoot.clientName}</strong>
          <small>{shoot.type} · {dateRu(shoot.startAt)}</small>
        </span>
        <b>{money(balance)} к оплате</b>
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  count = false,
  active = false,
  onClick,
}: {
  label: string;
  value: number | string;
  tone: string;
  count?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong className={count ? "count-badge" : ""}>{value}</strong>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`stat-card ${tone} clickable ${active ? "selected" : ""}`}
        onClick={onClick}
        aria-pressed={active}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`stat-card ${tone}`}>
      {content}
    </article>
  );
}

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calendarTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calendarProjectStatus(shoot: Shoot, today: Date) {
  if (shoot.delivered || shoot.status === "delivered") {
    return { label: "Сдано", tone: "done" };
  }
  if (new Date(shoot.startAt) > today) {
    return { label: "Предстоит", tone: "upcoming" };
  }
  if (calendarDateKey(shootDeadline(shoot)) < calendarDateKey(today)) {
    return { label: "Просрочено", tone: "overdue" };
  }
  return { label: "В обработке", tone: "processing" };
}

export function CalendarPage({
  shoots,
  types,
  clients,
  onUpdate,
  onAddAtDate,
  notify,
}: {
  shoots: Shoot[];
  types: ShootType[];
  clients: Client[];
  onUpdate: (id: number, patch: Partial<Shoot>) => void;
  onAddAtDate: (date: string) => void;
  notify: (message: string) => void;
}) {
  const todayDate = new Date();
  const todayKey = calendarDateKey(todayDate);
  const [cursor, setCursor] = useState(
    new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayShootId, setDayShootId] = useState<number | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const raw = index - firstWeekday + 1;
    if (raw < 1) return { day: prevDays + raw, current: false, month: month - 1 };
    if (raw > days) return { day: raw - days, current: false, month: month + 1 };
    return { day: raw, current: true, month };
  });
  const monthName = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(cursor);
  const eventsByDate = useMemo(() => {
    const result = new Map<string, Shoot[]>();
    shoots.forEach((shoot) => {
      const key = calendarDateKey(new Date(shoot.startAt));
      result.set(key, [...(result.get(key) || []), shoot]);
    });
    result.forEach((items) =>
      items.sort((a, b) => a.startAt.localeCompare(b.startAt)),
    );
    return result;
  }, [shoots]);
  const deadlinesByDate = useMemo(() => {
    const result = new Map<string, Shoot[]>();
    shoots.forEach((shoot) => {
      const key = calendarDateKey(shootDeadline(shoot));
      result.set(key, [...(result.get(key) || []), shoot]);
    });
    return result;
  }, [shoots]);
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) || [] : [];
  const selectedDeadlines = selectedDate
    ? deadlinesByDate.get(selectedDate) || []
    : [];
  const dayShoot = shoots.find((shoot) => shoot.id === dayShootId);

  function openShoot(id: number) {
    setSelectedDate(null);
    setDayShootId(id);
  }

  function openDate(date: Date) {
    const key = calendarDateKey(date);
    if (date.getMonth() !== month || date.getFullYear() !== year) {
      setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    if (!(eventsByDate.get(key)?.length || deadlinesByDate.get(key)?.length)) {
      onAddAtDate(key);
      return;
    }
    setSelectedDate(key);
  }

  return (
    <section className="page">
      <PageHeader title="Календарь" subtitle="Съёмки, планы дня и сроки сдачи" />
      <div className="calendar-toolbar">
        <button
          aria-label="Предыдущий месяц"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <label className="calendar-month-picker">
          <strong>{monthName}</strong>
          <input
            type="month"
            aria-label="Выбрать месяц и год"
            value={`${year}-${String(month + 1).padStart(2, "0")}`}
            onChange={(event) => {
              const [nextYear, nextMonth] = event.target.value
                .split("-")
                .map(Number);
              if (nextYear && nextMonth) {
                setCursor(new Date(nextYear, nextMonth - 1, 1));
              }
            }}
          />
        </label>
        <button
          aria-label="Следующий месяц"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          ›
        </button>
        <button
          className="calendar-today-button"
          onClick={() =>
            setCursor(
              new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
            )
          }
        >
          Сегодня
        </button>
      </div>
      <div className="panel calendar-panel">
        <div className="weekdays">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((cell, index) => {
            const cellDate = new Date(year, cell.month, cell.day);
            const dateKey = calendarDateKey(cellDate);
            const events = eventsByDate.get(dateKey) || [];
            const deadlines = deadlinesByDate.get(dateKey) || [];
            const today = dateKey === todayKey;
            const dateLabel = dateRu(`${dateKey}T12:00`);
            return (
              <div
                className={`calendar-cell ${cell.current ? "" : "outside"} ${selectedDate === dateKey ? "selected" : ""}`}
                key={`${dateKey}-${index}`}
              >
                <button
                  type="button"
                  className="calendar-cell-hit"
                  aria-label={`${dateLabel}. ${events.length ? `${events.length} съёмок.` : "Съёмок нет."} ${deadlines.length ? `${deadlines.length} сроков сдачи.` : ""}`}
                  onClick={() => openDate(cellDate)}
                />
                <span className={today ? "today" : ""}>{cell.day}</span>
                <div className="calendar-events">
                  {events.slice(0, 2).map((event) => (
                    <button
                      type="button"
                      className="calendar-event-pill"
                      key={event.id}
                      style={{ "--event-color": displayColor(event.color) } as CSSProperties}
                      aria-label={`Открыть ${event.type.toLowerCase()}, ${event.clientName}, ${calendarTime(event.startAt)}`}
                      onClick={() => openShoot(event.id)}
                    >
                      <time>{calendarTime(event.startAt)}</time>
                      <span title={event.clientName}>{event.clientName}</span>
                    </button>
                  ))}
                  {events.length > 2 && (
                    <button
                      type="button"
                      className="calendar-more"
                      onClick={() => setSelectedDate(dateKey)}
                    >
                      +{events.length - 2}
                    </button>
                  )}
                </div>
                {!!deadlines.length && (
                  <div className="calendar-deadlines" aria-label="Сроки сдачи">
                    {deadlines.slice(0, 3).map((shoot) => {
                      const tone =
                        shoot.delivered || shoot.status === "delivered"
                          ? "done"
                          : dateKey < todayKey
                            ? "overdue"
                            : "due";
                      return (
                        <button
                          type="button"
                          className={`calendar-deadline ${tone}`}
                          key={shoot.id}
                          title={`Сдать ${shoot.clientName}`}
                          aria-label={`Открыть срок сдачи проекта ${shoot.clientName}`}
                          onClick={() => openShoot(shoot.id)}
                        >
                          {tone === "done" ? "✓" : "!"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="legend calendar-legend">
        {types.slice(0, 5).map((type) => (
          <span key={type.name}>
            <i style={{ background: displayColor(type.color) }} />
            {type.name}
          </span>
        ))}
        <span><i className="deadline-due" />Срок сдачи</span>
        <span><i className="deadline-overdue" />Просрочено</span>
        <span><i className="deadline-done" />Сдано</span>
      </div>

      {selectedDate && (
        <Modal
          title={`План дня · ${dateRu(`${selectedDate}T12:00`)}`}
          onClose={() => setSelectedDate(null)}
          wide
        >
          <div className="calendar-day-sheet">
            <div className="calendar-day-summary">
              <div>
                <span>Съёмки</span>
                <strong>{selectedEvents.length}</strong>
              </div>
              <div>
                <span>Сроки сдачи</span>
                <strong>{selectedDeadlines.length}</strong>
              </div>
            </div>

            {!!selectedEvents.length && (
              <section className="calendar-day-section">
                <h3>План съёмок</h3>
                <div className="calendar-day-projects">
                  {selectedEvents.map((shoot) => {
                    const client = clients.find(
                      (item) =>
                        item.id === shoot.clientId ||
                        item.name === shoot.clientName,
                    );
                    const status = calendarProjectStatus(shoot, todayDate);
                    const payment = shoot.paidAmount
                      ? `${money(shoot.paidAmount)} / ${money(shoot.price)}`
                      : money(shoot.price);
                    return (
                      <article
                        className="calendar-day-project"
                        style={{ "--event-color": displayColor(shoot.color) } as CSSProperties}
                        key={shoot.id}
                      >
                        <button
                          type="button"
                          className="calendar-day-project-main"
                          onClick={() => openShoot(shoot.id)}
                        >
                          <span className="calendar-day-project-type">
                            {shoot.type} · {calendarTime(shoot.startAt)}–{calendarTime(shoot.endAt)}
                          </span>
                          <span className={`calendar-project-status ${status.tone}`}>
                            {status.label}
                          </span>
                          <strong>{shoot.clientName}</strong>
                          <p>{shoot.location || "Локация не указана"}</p>
                          <small>
                            Сдать до {dateRu(shootDeadline(shoot).toISOString())}
                          </small>
                          <b>{payment}</b>
                        </button>
                        <footer>
                          {shoot.location && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shoot.location)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Маршрут ↗
                            </a>
                          )}
                          {client?.phone && (
                            <>
                              <a href={`tel:${client.phone.replace(/[^+\d]/g, "")}`}>
                                Позвонить
                              </a>
                              <a
                                href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Написать
                              </a>
                            </>
                          )}
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {!!selectedDeadlines.length && (
              <section className="calendar-day-section">
                <h3>Сроки сдачи</h3>
                <div className="calendar-deadline-list">
                  {selectedDeadlines.map((shoot) => {
                    const status = calendarProjectStatus(shoot, todayDate);
                    return (
                      <button
                        type="button"
                        key={shoot.id}
                        className={`calendar-deadline-card ${status.tone}`}
                        onClick={() => openShoot(shoot.id)}
                      >
                        <span>
                          <strong>{shoot.clientName}</strong>
                          <small>{shoot.type} · снять {dateRu(shoot.startAt)}</small>
                        </span>
                        <b>{status.label}</b>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {!selectedEvents.length && !selectedDeadlines.length && (
              <div className="calendar-day-empty">
                <strong>На этот день ничего не запланировано</strong>
                <span>Можно добавить новую съёмку.</span>
              </div>
            )}

            <button
              type="button"
              className="button primary full calendar-add-shoot"
              onClick={() => {
                const date = selectedDate;
                setSelectedDate(null);
                onAddAtDate(date);
              }}
            >
              + Добавить съёмку на эту дату
            </button>
          </div>
        </Modal>
      )}

      {dayShoot && (
        <DayModeModal
          shoot={dayShoot}
          client={clients.find(
            (client) =>
              client.id === dayShoot.clientId ||
              client.name === dayShoot.clientName,
          )}
          onClose={() => setDayShootId(null)}
          onUpdate={onUpdate}
          notify={notify}
        />
      )}
    </section>
  );
}

export function ClientsPage({
  clients,
  shoots,
  onAdd,
}: {
  clients: Client[];
  shoots: Shoot[];
  onAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | Client["kind"]>("all");
  const filtered = clients.filter(
    (client) =>
      (kind === "all" || client.kind === kind) &&
      `${client.name} ${client.phone}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <section className="page">
      <PageHeader
        title="Клиенты"
        subtitle={`${clients.length} клиентов`}
        action={
          <button className="button secondary" onClick={onAdd}>
            + Добавить
          </button>
        }
      />
      <label className="search-field">
        <Icon name="search" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по имени или телефону…"
        />
      </label>
      <div className="filter-row">
        {(["all", "person", "company"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setKind(value)}
            className={kind === value ? "active" : ""}
          >
            {value === "all" ? "Все" : value === "person" ? "Физлица" : "Юрлица"}
          </button>
        ))}
      </div>
      <div className="panel client-list">
        {filtered.map((client) => {
          const clientShoots = shoots.filter(
            (shoot) => shoot.clientId === client.id,
          );
          return (
            <article key={client.id}>
              <span className="avatar">{initials(client.name)}</span>
              <div>
                <h3>{client.name}</h3>
                <p>
                  {client.phone || "нет телефона"} · {clientShoots.length} съёмок
                </p>
              </div>
              <strong>
                {money(
                  clientShoots.reduce((sum, shoot) => sum + shoot.price, 0),
                )}
              </strong>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="empty">
            <h3>Ничего не найдено</h3>
            <p>Измените запрос или добавьте нового клиента.</p>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { CheckItem, Client, Shoot, ShootStatus, TimelineItem } from "./crm-data";
import { dateRu, deliveryDate, displayColor, money, profitPerHour } from "./crm-data";
import { Modal } from "./crm-ui";

type Weather = {
  available: boolean;
  label?: string;
  icon?: string;
  temperature?: number;
  max?: number;
  min?: number;
  precipitation?: number;
  wind?: number;
  cloud?: number;
  sunrise?: string;
  sunset?: string;
  goldenHour?: string;
  resolvedName?: string;
  geocoder?: "openstreetmap" | "coordinates";
  provider?: "met-norway";
  updatedAt?: string;
  error?: string;
};

const STATUS_STEPS: Array<{ value: ShootStatus; label: string }> = [
  { value: "booked", label: "Забронировано" },
  { value: "preparing", label: "Подготовка" },
  { value: "shooting", label: "Съёмка" },
  { value: "processing", label: "Обработка" },
  { value: "delivered", label: "Сдано" },
];

function time(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function departureTime(shoot: Shoot) {
  const value = new Date(shoot.startAt);
  value.setMinutes(value.getMinutes() - shoot.travelMinutes - 15);
  return time(value.toISOString());
}

function phoneHref(value: string) {
  return `tel:${value.replace(/[^+\d]/g, "")}`;
}

function mapsHref(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

async function copyText(value: string, notify: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    notify("Скопировано");
  } catch {
    notify("Не удалось скопировать");
  }
}

function Checklist({
  items,
  onChange,
}: {
  items: CheckItem[];
  onChange: (items: CheckItem[]) => void;
}) {
  const done = items.filter((item) => item.done).length;
  return (
    <div className="day-checklist">
      <div className="checklist-progress">
        <span>{done} из {items.length}</span>
        <i><b style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></i>
      </div>
      {items.map((item) => (
        <button
          type="button"
          className={item.done ? "done" : ""}
          key={item.id}
          onClick={() =>
            onChange(
              items.map((candidate) =>
                candidate.id === item.id
                  ? { ...candidate, done: !candidate.done }
                  : candidate,
              ),
            )
          }
        >
          <i>{item.done ? "✓" : ""}</i>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function Timeline({
  items,
  onChange,
}: {
  items: TimelineItem[];
  onChange: (items: TimelineItem[]) => void;
}) {
  return (
    <div className="day-timeline">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={item.done ? "done" : ""}
          onClick={() =>
            onChange(
              items.map((candidate) =>
                candidate.id === item.id
                  ? { ...candidate, done: !candidate.done }
                  : candidate,
              ),
            )
          }
        >
          <time>{item.time}</time>
          <i />
          <span>{item.label}</span>
          <b>{item.done ? "Готово" : ""}</b>
        </button>
      ))}
    </div>
  );
}

export function DayModeModal({
  shoot,
  client,
  onClose,
  onUpdate,
  notify,
}: {
  shoot: Shoot;
  client?: Client;
  onClose: () => void;
  onUpdate: (id: number, patch: Partial<Shoot>) => void;
  notify: (message: string) => void;
}) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherVersion, setWeatherVersion] = useState(0);
  const [section, setSection] = useState<"timeline" | "gear">("timeline");
  const [shootHasEnded, setShootHasEnded] = useState(
    () => Date.now() >= new Date(shoot.endAt).getTime(),
  );
  const [details, setDetails] = useState({
    location: shoot.location,
    travelMinutes: String(shoot.travelMinutes),
    organizerName: shoot.organizerName,
    organizerPhone: shoot.organizerPhone,
    editingHours: String(shoot.editingHours),
    travelCost: String(shoot.travelCost),
    otherCosts: String(shoot.otherCosts),
    clientGuide: shoot.clientGuide,
  });
  const portalUrl = typeof window === "undefined"
    ? ""
    : `${window.location.origin}/client/${shoot.portalToken}`;

  useEffect(() => {
    const updateShootTimeState = () => {
      setShootHasEnded(Date.now() >= new Date(shoot.endAt).getTime());
    };
    updateShootTimeState();
    const timer = window.setInterval(updateShootTimeState, 60_000);
    return () => window.clearInterval(timer);
  }, [shoot.endAt]);

  useEffect(() => {
    if (!shoot.location) {
      const timer = window.setTimeout(
        () =>
          setWeather({
            available: false,
            error: "Добавьте локацию для прогноза",
          }),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const resetTimer = window.setTimeout(() => setWeather(null), 0);
    fetch(
      `/api/weather?source=met-no&location=${encodeURIComponent(shoot.location)}&date=${shoot.startAt.slice(0, 10)}&time=${shoot.startAt.slice(11, 16)}&refresh=${weatherVersion}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const result = (await response.json()) as Weather;
        if (!response.ok) throw new Error(result.error || "Прогноз недоступен");
        setWeather(result);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setWeather({ available: false, error: error.message });
        }
      });
    return () => {
      window.clearTimeout(resetTimer);
      controller.abort();
    };
  }, [shoot.location, shoot.startAt, weatherVersion]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setWeatherVersion((value) => value + 1),
      30 * 60 * 1000,
    );
    const refreshVisible = () => {
      if (document.visibilityState === "visible") {
        setWeatherVersion((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, []);

  const messages = useMemo(() => {
    const firstName = shoot.clientName.split(" ")[0];
    const balance = Math.max(0, shoot.price - shoot.paidAmount);
    return [
      {
        label: "Подтверждение",
        text: `Здравствуйте, ${firstName}! Подтверждаю нашу съёмку ${dateRu(shoot.startAt)} в ${time(shoot.startAt)}${shoot.location ? `, ${shoot.location}` : ""}. Если планы изменятся, пожалуйста, напишите заранее.`,
      },
      {
        label: "Я выезжаю",
        text: `Здравствуйте, ${firstName}! Я выезжаю на нашу съёмку. Буду ориентировочно к ${time(shoot.startAt)}. До встречи!`,
      },
      {
        label: "После съёмки",
        text: `Спасибо за съёмку! Готовые фотографии пришлю до ${dateRu(deliveryDate(shoot).toISOString())}.${balance ? ` Остаток к оплате — ${money(balance)}.` : " Оплата закрыта полностью."}`,
      },
    ];
  }, [shoot]);

  function updateStatus(status: ShootStatus) {
    onUpdate(shoot.id, {
      status,
      delivered: status === "delivered",
      archived: status === "delivered",
    });
  }

  return (
    <Modal title="Режим съёмки" onClose={onClose} wide fullScreen>
      <div className="day-mode">
        <section className="day-hero" style={{ "--shoot-color": displayColor(shoot.color) } as React.CSSProperties}>
          <span>{shoot.type} · {dateRu(shoot.startAt)}</span>
          <h2>{shoot.clientName}</h2>
          <div className="day-time-row">
            <strong>{time(shoot.startAt)}–{time(shoot.endAt)}</strong>
            <span>
              {shootHasEnded
                ? `Сдать до ${dateRu(deliveryDate(shoot).toISOString())}`
                : `Выезд в ${departureTime(shoot)}`}
            </span>
          </div>
          {shoot.location && (
            <a href={mapsHref(shoot.location)} target="_blank" rel="noreferrer">
              📍 {shoot.location} <b>Маршрут ↗</b>
            </a>
          )}
        </section>

        <div className="day-status-strip" aria-label="Статус проекта">
          {STATUS_STEPS.map((step, index) => {
            const current = Math.max(0, STATUS_STEPS.findIndex((item) => item.value === shoot.status));
            return (
              <button
                type="button"
                key={step.value}
                className={index <= current ? "active" : ""}
                onClick={() => updateStatus(step.value)}
              >
                <i>{index < current ? "✓" : index + 1}</i>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        <section className="day-weather panel-inset">
          <div>
            <span>Погода и свет</span>
            {!weather && <strong>Загружаю прогноз…</strong>}
            {weather?.available && (
              <strong>{weather.icon} {weather.label}, {Math.round(weather.temperature ?? weather.max ?? 0)}°</strong>
            )}
            {weather && !weather.available && <strong>{weather.error || "Прогноз недоступен"}</strong>}
          </div>
          {weather?.available && (
            <div className="weather-details">
              <span>Осадки {weather.precipitation ?? 0}%</span>
              <span>Ветер {Math.round(weather.wind ?? 0)} км/ч</span>
              <span>Облачность {weather.cloud ?? 0}%</span>
              <span>Восход {weather.sunrise}</span>
              <span>Закат {weather.sunset}</span>
              <span className="golden">Золотой час ≈ {weather.goldenHour}</span>
            </div>
          )}
          <footer className="weather-footer">
            <small>
              {weather?.resolvedName
                ? `${weather.resolvedName.split(",").slice(0, 3).join(", ")} · `
                : ""}
              {weather?.updatedAt
                ? `обновлено ${new Date(weather.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </small>
            <button type="button" onClick={() => setWeatherVersion((value) => value + 1)}>
              Обновить
            </button>
            <span>
              {weather?.geocoder === "openstreetmap" && (
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
              )}
              <a href="https://www.met.no/en/free-meteorological-data" target="_blank" rel="noreferrer">Погода: MET Norway</a>
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
            </span>
          </footer>
        </section>

        <section className="day-contacts panel-inset">
          <div>
            <span>Клиент</span>
            <strong>{shoot.clientName}</strong>
            <small>{client?.phone || "Телефон не указан"}</small>
          </div>
          {client?.phone && <a href={phoneHref(client.phone)}>Позвонить</a>}
          {shoot.organizerName && (
            <div>
              <span>На площадке</span>
              <strong>{shoot.organizerName}</strong>
              <small>{shoot.organizerPhone || "Телефон не указан"}</small>
            </div>
          )}
          {shoot.organizerPhone && <a href={phoneHref(shoot.organizerPhone)}>Позвонить</a>}
        </section>

        <div className="day-tabs">
          <button type="button" className={section === "timeline" ? "active" : ""} onClick={() => setSection("timeline")}>Тайминг</button>
          <button type="button" className={section === "gear" ? "active" : ""} onClick={() => setSection("gear")}>Техника</button>
        </div>
        {section === "timeline" && <Timeline items={shoot.timeline} onChange={(timeline) => onUpdate(shoot.id, { timeline })} />}
        {section === "gear" && <Checklist items={shoot.equipment} onChange={(equipment) => onUpdate(shoot.id, { equipment })} />}

        <section className="backup-card panel-inset">
          <div>
            <span>Резервные копии</span>
            <strong>{shoot.backupStatus === "two" ? "Материал в безопасности" : "Не забудьте скопировать карты"}</strong>
          </div>
          <div className="backup-buttons">
            {(["none", "one", "two"] as const).map((value, index) => (
              <button
                type="button"
                key={value}
                className={shoot.backupStatus === value ? "active" : ""}
                onClick={() => onUpdate(shoot.id, { backupStatus: value })}
              >
                {index === 0 ? "Нет" : `${index} коп.`}
              </button>
            ))}
          </div>
        </section>

        <section className="smart-messages panel-inset">
          <div className="section-heading">
            <span>Умные сообщения</span>
            <small>Готовы к отправке</small>
          </div>
          {messages.map((message) => (
            <article key={message.label}>
              <strong>{message.label}</strong>
              <p>{message.text}</p>
              <div>
                <button type="button" onClick={() => copyText(message.text, notify)}>Копировать</button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button type="button" onClick={() => navigator.share({ text: message.text })}>Поделиться</button>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="portal-card">
          <div>
            <span>Кабинет клиента</span>
            <h3>Одна ссылка вместо десятка вопросов</h3>
            <p>{shoot.portalToken ? "Дата, адрес, памятка, статус, срок готовности и остаток к оплате." : "Ссылка появится после синхронизации проекта."}</p>
          </div>
          <div>
            <button type="button" className="button secondary" disabled={!shoot.portalToken} onClick={() => copyText(portalUrl, notify)}>Скопировать ссылку</button>
            {shoot.portalToken && <a className="button primary" href={portalUrl} target="_blank" rel="noreferrer">Предпросмотр</a>}
          </div>
        </section>

        <section className="day-economics panel-inset">
          <div><span>Проект</span><strong>{money(shoot.price)}</strong></div>
          <div><span>Расходы</span><strong>{money(shoot.travelCost + shoot.otherCosts)}</strong></div>
          <div><span>Прибыль в час</span><strong>{money(profitPerHour(shoot))}</strong></div>
          {shoot.price > shoot.paidAmount && (
            <button type="button" onClick={() => onUpdate(shoot.id, { paidAmount: shoot.price })}>
              Отметить {money(shoot.price - shoot.paidAmount)} оплаченными
            </button>
          )}
        </section>

        <details className="project-details panel-inset">
          <summary>Изменить детали проекта</summary>
          <div className="project-fields">
            <label>
              <span>Локация</span>
              <input value={details.location} onChange={(event) => setDetails({ ...details, location: event.target.value })} />
            </label>
            <label>
              <span>Дорога, минут</span>
              <input type="number" min="0" value={details.travelMinutes} onChange={(event) => setDetails({ ...details, travelMinutes: event.target.value })} />
            </label>
            <label>
              <span>Организатор</span>
              <input value={details.organizerName} onChange={(event) => setDetails({ ...details, organizerName: event.target.value })} />
            </label>
            <label>
              <span>Телефон организатора</span>
              <input value={details.organizerPhone} onChange={(event) => setDetails({ ...details, organizerPhone: event.target.value })} />
            </label>
            <label>
              <span>Обработка, часов</span>
              <input type="number" min="0" value={details.editingHours} onChange={(event) => setDetails({ ...details, editingHours: event.target.value })} />
            </label>
            <label>
              <span>Расходы на дорогу</span>
              <input type="number" min="0" value={details.travelCost} onChange={(event) => setDetails({ ...details, travelCost: event.target.value })} />
            </label>
            <label>
              <span>Прочие расходы</span>
              <input type="number" min="0" value={details.otherCosts} onChange={(event) => setDetails({ ...details, otherCosts: event.target.value })} />
            </label>
            <label className="wide">
              <span>Памятка клиенту</span>
              <textarea value={details.clientGuide} onChange={(event) => setDetails({ ...details, clientGuide: event.target.value })} />
            </label>
          </div>
          <button
            type="button"
            className="button primary full"
            onClick={() => {
              onUpdate(shoot.id, {
                location: details.location.trim(),
                travelMinutes: Math.max(0, Number(details.travelMinutes) || 0),
                organizerName: details.organizerName.trim(),
                organizerPhone: details.organizerPhone.trim(),
                editingHours: Math.max(0, Number(details.editingHours) || 0),
                travelCost: Math.max(0, Number(details.travelCost) || 0),
                otherCosts: Math.max(0, Number(details.otherCosts) || 0),
                clientGuide: details.clientGuide.trim(),
              });
              notify("Детали проекта сохранены");
            }}
          >
            Сохранить детали
          </button>
        </details>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { dateRu, displayColor } from "./crm-data";

type PortalProject = {
  id: number;
  clientName: string;
  type: string;
  color: string;
  startAt: string;
  endAt: string;
  location: string;
  price: number;
  paidAmount: number;
  balance: number;
  deliveryDays: number;
  delivered: boolean;
  status: string;
  clientGuide: string;
  contact: { name: string; phone: string; email: string };
};

const STATUS = [
  { value: "booked", label: "Дата забронирована" },
  { value: "preparing", label: "Готовимся" },
  { value: "shooting", label: "Съёмка" },
  { value: "processing", label: "Обработка" },
  { value: "delivered", label: "Фотографии готовы" },
];

function money(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function countdown(target: Date, now: Date) {
  const milliseconds = target.getTime() - now.getTime();
  if (milliseconds <= 0) return null;
  const days = Math.floor(milliseconds / 86_400_000);
  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

export default function ClientPortal({ token }: { token: string }) {
  const [project, setProject] = useState<PortalProject | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetch(`/api/portal?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = (await response.json()) as { project?: PortalProject; error?: string };
        if (!response.ok || !data.project) throw new Error(data.error || "Проект не найден");
        setProject(data.project);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Проект не найден"));
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(
    () => (project ? countdown(new Date(project.startAt), now) : null),
    [project, now],
  );

  if (error) {
    return (
      <main className="client-portal-shell centered">
        <div className="portal-logo">Photo<span>Flow</span></div>
        <section className="portal-error">
          <span>Ссылка недоступна</span>
          <h1>{error}</h1>
          <p>Попросите фотографа прислать новую ссылку на проект.</p>
        </section>
      </main>
    );
  }

  if (!project) {
    return <main className="client-portal-shell centered"><div className="portal-loader">Открываем ваш проект…</div></main>;
  }

  const currentStatus = project.delivered
    ? STATUS.length - 1
    : Math.max(0, STATUS.findIndex((item) => item.value === project.status));
  const delivery = new Date(project.startAt);
  delivery.setDate(delivery.getDate() + project.deliveryDays);

  return (
    <main className="client-portal-shell" style={{ "--portal-color": displayColor(project.color) } as React.CSSProperties}>
      <header className="portal-topbar">
        <div className="portal-logo">Photo<span>Flow</span></div>
        <span>Ваш проект</span>
      </header>
      <section className="portal-welcome">
        <span>{project.type}</span>
        <h1>{project.clientName}, всё о съёмке — здесь</h1>
        <p>Актуальные детали проекта без поиска по переписке.</p>
      </section>

      {remaining ? (
        <section className="portal-countdown">
          <span>До нашей съёмки</span>
          <div>
            <strong>{remaining.days}<small>дней</small></strong>
            <i>:</i>
            <strong>{remaining.hours}<small>часов</small></strong>
            <i>:</i>
            <strong>{remaining.minutes}<small>минут</small></strong>
          </div>
        </section>
      ) : (
        <section className="portal-countdown past"><span>Съёмка состоялась</span><strong>Спасибо за доверие ✨</strong></section>
      )}

      <section className="portal-grid">
        <article>
          <span>Дата и время</span>
          <strong>{dateRu(project.startAt)}</strong>
          <p>{new Date(project.startAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}–{new Date(project.endAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>
        </article>
        <article>
          <span>Локация</span>
          <strong>{project.location || "Уточняем"}</strong>
          {project.location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.location)}`} target="_blank" rel="noreferrer">Открыть карту ↗</a>}
        </article>
      </section>

      <section className="portal-panel">
        <span>Статус проекта</span>
        <h2>{STATUS[currentStatus]?.label || "Проект в работе"}</h2>
        <div className="portal-progress"><i style={{ width: `${((currentStatus + 1) / STATUS.length) * 100}%` }} /></div>
        <div className="portal-statuses">
          {STATUS.map((status, index) => <i key={status.value} className={index <= currentStatus ? "active" : ""} />)}
        </div>
        <p>{project.delivered ? "Фотограф сообщит, как скачать готовые материалы." : `Плановая готовность — до ${dateRu(delivery.toISOString())}.`}</p>
      </section>

      <section className="portal-panel guide">
        <span>Памятка к съёмке</span>
        <h2>Как подготовиться</h2>
        <p>{project.clientGuide || "Фотограф скоро добавит персональные рекомендации. Если у вас есть вопросы — напишите заранее."}</p>
      </section>

      <section className="portal-payment">
        <div><span>Стоимость</span><strong>{money(project.price)}</strong></div>
        <div><span>Оплачено</span><strong>{money(project.paidAmount)}</strong></div>
        <div className={project.balance ? "balance-due" : "paid"}><span>Остаток</span><strong>{project.balance ? money(project.balance) : "Оплачено"}</strong></div>
      </section>

      <footer><div className="portal-logo">Photo<span>Flow</span></div><p>Персональная страница вашего фотопроекта</p></footer>
    </main>
  );
}

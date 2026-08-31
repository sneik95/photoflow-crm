"use client";

import { CSSProperties, ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Tab } from "./crm-data";

export function Icon({
  name,
}: {
  name: Tab | "plus" | "close" | "search" | "spark";
}) {
  const paths: Record<string, ReactNode> = {
    shoots: <path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v5H4zM14 15h6v5h-6z" />,
    calendar: <path d="M5 4v3m14-3v3M4 9h16M5 6h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM7 13h3m4 0h3m-10 4h3m4 0h3" />,
    clients: <path d="M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 2.13a4 4 0 010 7.75" />,
    finance: <path d="M3 20h18M5 16l4-5 4 3 6-9m-5 0h5v5" />,
    settings: <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm0-13v2m0 15v2m9-9h-2M5 12H3m15.36-6.36l-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0l-1.42-1.42M7.06 7.06L5.64 5.64" />,
    profile: <path d="M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M5 5l14 14M19 5L5 19" />,
    search: <path d="M21 21l-4.4-4.4m2.4-5.1a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />,
    spark: <path d="M12 2l1.3 5.7L19 9l-5.7 1.3L12 16l-1.3-5.7L5 9l5.7-1.3L12 2zm7 12l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14z" />,
  };

  return (
    <span
      className={`liquid-icon liquid-icon-${name}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24">
        {paths[name]}
      </svg>
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <span className="page-kicker">
          <i />
          <span>PhotoFlow</span>
          <b>CRM для фотографов</b>
        </span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Field({
  label,
  children,
  invalid = false,
}: {
  label: string;
  children: ReactNode;
  invalid?: boolean;
}) {
  return (
    <label className={`field${invalid ? " field-invalid" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ToggleRow({
  title,
  subtitle,
  defaultOn = false,
  checked,
  onChange,
}: {
  title: string;
  subtitle: string;
  defaultOn?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const [active, setActive] = useState(defaultOn);
  const isActive = checked ?? active;
  return (
    <button
      type="button"
      className="toggle-row"
      aria-pressed={isActive}
      onClick={() => {
        const next = !isActive;
        if (checked === undefined) setActive(next);
        onChange?.(next);
      }}
    >
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <i className={isActive ? "on" : ""}>
        <b />
      </i>
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  fullScreen = false,
  viewportAware = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  fullScreen?: boolean;
  viewportAware?: boolean;
}) {
  const portalTarget = typeof document === "undefined" ? null : document.body;
  const [viewport, setViewport] = useState<{
    height: number;
    offsetTop: number;
  }>();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!fullScreen || !viewportAware || !window.visualViewport) return;
    const visualViewport = window.visualViewport;
    const updateViewport = () =>
      setViewport({
        height: Math.round(visualViewport.height),
        offsetTop: Math.round(visualViewport.offsetTop),
      });
    updateViewport();
    visualViewport.addEventListener("resize", updateViewport);
    visualViewport.addEventListener("scroll", updateViewport);
    return () => {
      visualViewport.removeEventListener("resize", updateViewport);
      visualViewport.removeEventListener("scroll", updateViewport);
    };
  }, [fullScreen, viewportAware]);

  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`modal-backdrop${fullScreen ? " fullscreen-backdrop" : ""}${viewportAware ? " viewport-aware" : ""}`}
      role="presentation"
      style={
        viewport
          ? ({
              "--modal-visible-height": `${viewport.height}px`,
              "--modal-visible-offset": `${viewport.offsetTop}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <section
        className={`modal ${wide ? "wide" : ""} ${fullScreen ? "fullscreen" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    portalTarget,
  );
}

export function BottomNav({
  tab,
  setTab,
  onAdd,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  onAdd: () => void;
}) {
  const items: { tab: Tab; label: string }[] = [
    { tab: "shoots", label: "Мои съёмки" },
    { tab: "calendar", label: "Календарь" },
    { tab: "clients", label: "Клиенты" },
    { tab: "finance", label: "Финансы" },
    { tab: "settings", label: "Настройки" },
    { tab: "profile", label: "Профиль" },
  ];

  const navButton = (item: (typeof items)[number]) => (
    <button
      key={item.tab}
      className={tab === item.tab ? "active" : ""}
      onClick={() => {
        setTab(item.tab);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <Icon name={item.tab} />
      <span className="nav-label">{item.label}</span>
    </button>
  );

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.slice(0, 3).map(navButton)}
      <button className="add-button" onClick={onAdd} aria-label="Добавить съёмку">
        <Icon name="plus" />
      </button>
      {items.slice(3).map(navButton)}
    </nav>
  );
}

"use client";

import { CSSProperties, PointerEvent, ReactNode, useEffect, useRef, useState } from "react";
import type { CheckItem, Client, Shoot, TimelineItem } from "./crm-data";
import { dateRu, deliveryDate, displayColor, money, profitPerHour } from "./crm-data";
import { addChecklistItem, addTimelineItem, normalizeChecklistItems, normalizeTimelineItems, removeChecklistItem, removeTimelineItem, updateChecklistItem, updateTimelineItem } from "./crm-project-tools";
import { DEFAULT_SMART_MESSAGES, insertMessageVariable, normalizeSmartMessages, renderSmartMessage, SMART_VARIABLES, type SmartMessage } from "./crm-smart-messages";
import { Modal, SwipeActions, SWIPE_ACTIONS_WIDTH } from "./crm-ui";

const SMART_MESSAGES_STORAGE_KEY = "fotocrm:smart-messages:v1";

function time(value: string) { return new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); }
function departureTime(shoot: Shoot) { const value = new Date(shoot.startAt); value.setMinutes(value.getMinutes() - Math.max(0, shoot.travelMinutes) - 15); return time(value.toISOString()); }
function phoneHref(value: string) { return `tel:${value.replace(/[^+\d]/g, "")}`; }
function mapsHref(location: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`; }
function itemId(prefix: string) { return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`; }

function readSmartMessages() {
  if (typeof window === "undefined") return DEFAULT_SMART_MESSAGES;
  try { return normalizeSmartMessages(JSON.parse(window.localStorage.getItem(SMART_MESSAGES_STORAGE_KEY) || "null")); }
  catch { return DEFAULT_SMART_MESSAGES; }
}
function writeSmartMessages(messages: SmartMessage[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(SMART_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
}
async function sendMessage(text: string, notify: (message: string) => void) {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) { await navigator.share({ text }); return; }
    await navigator.clipboard?.writeText(text);
    notify("Сообщение скопировано — отправьте его в мессенджере");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    notify("Не удалось подготовить сообщение к отправке");
  }
}
async function copyText(value: string, notify: (message: string) => void) {
  try { await navigator.clipboard.writeText(value); notify("Ссылка скопирована"); }
  catch { notify("Не удалось скопировать ссылку"); }
}

function useOneTimeSwipeHint(key: string, length: number) {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!length || typeof window === "undefined" || window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    let timeout: number | undefined;
    const frame = window.requestAnimationFrame(() => { setHint(true); timeout = window.setTimeout(() => setHint(false), 560); });
    return () => { window.cancelAnimationFrame(frame); if (timeout !== undefined) window.clearTimeout(timeout); };
  }, [key, length]);
  return hint;
}

function ProjectSwipeRow({ open, showHint, onOpenChange, onEdit, onDelete, children }: {
  open: boolean; showHint: boolean; onOpenChange: (next: boolean) => void; onEdit: () => void; onDelete: () => void;
  children: (consumeSwipe: boolean) => ReactNode;
}) {
  const [dragX, setDragX] = useState<number | null>(null);
  const [consumeSwipe, setConsumeSwipe] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; horizontal: boolean | null } | null>(null);
  const restingX = open ? -SWIPE_ACTIONS_WIDTH : showHint ? -42 : 0;
  function pointerDown(event: PointerEvent<HTMLElement>) { if (event.pointerType === "mouse" && event.button !== 0) return; gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: null }; event.currentTarget.setPointerCapture(event.pointerId); }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current; if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x; const dy = event.clientY - current.y;
    if (current.horizontal === null && Math.max(Math.abs(dx), Math.abs(dy)) > 8) current.horizontal = Math.abs(dx) > Math.abs(dy);
    if (!current.horizontal) return;
    setConsumeSwipe(true); setDragX(Math.min(0, Math.max(-SWIPE_ACTIONS_WIDTH - 18, (open ? -SWIPE_ACTIONS_WIDTH : 0) + dx)));
  }
  function finishPointer(event: PointerEvent<HTMLElement>) {
    const current = gesture.current; if (!current || current.id !== event.pointerId) return;
    if (current.horizontal) { const dx = event.clientX - current.x; onOpenChange(dx < -48 || (dragX !== null && dragX < -SWIPE_ACTIONS_WIDTH / 2)); }
    gesture.current = null; setDragX(null); window.requestAnimationFrame(() => { setConsumeSwipe(false); });
  }
  return <div className="project-swipe-shell"><SwipeActions open={open} onEdit={onEdit} onDelete={onDelete} /><div className={`project-swipe-surface${showHint ? " swipe-hint" : ""}`} style={{ transform: `translateX(${dragX ?? restingX}px)` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer}>{children(consumeSwipe)}</div></div>;
}

function TimelineManager({ items, onChange }: { items: unknown; onChange: (next: TimelineItem[]) => void }) {
  const timeline = normalizeTimelineItems(items);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id?: string; label: string; time: string } | null>(null);
  const showHint = useOneTimeSwipeHint("photoflow:timeline-swipe-hint:v1", timeline.length);
  function saveDraft() {
    if (!draft?.label.trim() || !/^\d{2}:\d{2}$/.test(draft.time)) return;
    const next = draft.id ? updateTimelineItem(timeline, draft.id, { label: draft.label, time: draft.time }) : addTimelineItem(timeline, { id: itemId("timeline"), label: draft.label, time: draft.time, done: false });
    onChange(next); setDraft(null);
  }
  return <section className="project-manager"><div className="project-manager-heading"><span>Тайминг</span><button type="button" onClick={() => setDraft({ label: "", time: "" })}>+ Добавить этап</button></div>{draft && <div className="project-entry-form"><label><span>Название этапа</span><input autoFocus value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label><label><span>Время</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label><div><button type="button" className="button muted" onClick={() => setDraft(null)}>Отменить</button><button type="button" className="button primary" onClick={saveDraft}>{draft.id ? "Сохранить изменения" : "Добавить этап"}</button></div></div>}<div className="project-list day-timeline">{!timeline.length && <p className="project-empty">Этапов пока нет. Добавьте первый этап вручную.</p>}{timeline.map((item, index) => <ProjectSwipeRow key={item.id} open={openId === item.id} showHint={showHint && index === 0} onOpenChange={(open) => setOpenId(open ? item.id : null)} onEdit={() => { setOpenId(null); setDraft({ id: item.id, label: item.label, time: item.time }); }} onDelete={() => { setOpenId(null); onChange(removeTimelineItem(timeline, item.id)); }}>{(consumeSwipe) => <button type="button" className={item.done ? "done" : ""} onClick={() => !consumeSwipe && onChange(updateTimelineItem(timeline, item.id, { done: !item.done }))}><time>{item.time}</time><i /><span>{item.label}</span><b>{item.done ? "Готово" : ""}</b></button>}</ProjectSwipeRow>)}</div></section>;
}

function EquipmentManager({ items, onChange }: { items: unknown; onChange: (next: CheckItem[]) => void }) {
  const equipment = normalizeChecklistItems(items);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id?: string; label: string } | null>(null);
  const showHint = useOneTimeSwipeHint("photoflow:equipment-swipe-hint:v1", equipment.length);
  const done = equipment.filter((item) => item.done).length;
  function saveDraft() { if (!draft?.label.trim()) return; const next = draft.id ? updateChecklistItem(equipment, draft.id, { label: draft.label }) : addChecklistItem(equipment, draft.label, itemId("equipment")); onChange(next); setDraft(null); }
  return <section className="project-manager"><div className="project-manager-heading"><span>Техника</span><button type="button" onClick={() => setDraft({ label: "" })}>+ Добавить</button></div>{draft && <div className="project-entry-form"><label><span>Техника или аксессуар</span><input autoFocus value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label><div><button type="button" className="button muted" onClick={() => setDraft(null)}>Отменить</button><button type="button" className="button primary" onClick={saveDraft}>{draft.id ? "Сохранить изменения" : "Добавить"}</button></div></div>}<div className="project-list day-checklist"><div className="checklist-progress"><span>{done} из {equipment.length}</span><i><b style={{ width: `${equipment.length ? (done / equipment.length) * 100 : 0}%` }} /></i></div>{!equipment.length && <p className="project-empty">Список техники пуст.</p>}{equipment.map((item, index) => <ProjectSwipeRow key={item.id} open={openId === item.id} showHint={showHint && index === 0} onOpenChange={(open) => setOpenId(open ? item.id : null)} onEdit={() => { setOpenId(null); setDraft({ id: item.id, label: item.label }); }} onDelete={() => { setOpenId(null); onChange(removeChecklistItem(equipment, item.id)); }}>{(consumeSwipe) => <label className={`project-check-row${item.done ? " done" : ""}`}><input type="checkbox" checked={item.done} onChange={() => !consumeSwipe && onChange(updateChecklistItem(equipment, item.id, { done: !item.done }))} /><i aria-hidden="true">{item.done ? "✓" : ""}</i><span>{item.label}</span></label>}</ProjectSwipeRow>)}</div></section>;
}

function SmartMessageEditor({ message, onClose, onSave }: { message?: SmartMessage; onClose: () => void; onSave: (next: SmartMessage) => void }) {
  const [title, setTitle] = useState(message?.title || ""); const [text, setText] = useState(message?.text || ""); const textareaRef = useRef<HTMLTextAreaElement>(null);
  function addVariable(variable: string) { const textarea = textareaRef.current; const result = insertMessageVariable(text, textarea?.selectionStart ?? text.length, textarea?.selectionEnd ?? text.length, variable); setText(result.value); window.requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(result.cursor, result.cursor); }); }
  return <Modal title={message ? "Редактировать сообщение" : "Новое умное сообщение"} onClose={onClose} wide fullScreen viewportAware><form className="smart-message-editor" onSubmit={(event) => { event.preventDefault(); if (!title.trim() || !text.trim()) return; onSave({ id: message?.id || itemId("message"), title: title.trim(), text: text.trim(), builtIn: message?.builtIn }); }}><label><span>Название</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, напоминание" /></label><label><span>Текст</span><textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} placeholder="Текст сообщения" /></label><div className="smart-variable-chips" aria-label="Переменные сообщения">{SMART_VARIABLES.map((variable) => <button type="button" key={variable} onClick={() => addVariable(variable)}>{variable}</button>)}</div><button className="button primary full" type="submit">Сохранить сообщение</button></form></Modal>;
}

function SmartMessages({ shoot, notify }: { shoot: Shoot; notify: (message: string) => void }) {
  const [messages, setMessages] = useState(readSmartMessages); const [editor, setEditor] = useState<SmartMessage | "new" | null>(null);
  function saveMessage(message: SmartMessage) { const next = messages.some((item) => item.id === message.id) ? messages.map((item) => item.id === message.id ? message : item) : [...messages, message]; setMessages(next); writeSmartMessages(next); setEditor(null); notify("Шаблон сообщения сохранён"); }
  return <section className="smart-messages panel-inset"><div className="section-heading"><span>Умные сообщения</span><button type="button" className="smart-message-add" aria-label="Новое умное сообщение" onClick={() => setEditor("new")}>+</button></div>{messages.map((message) => { const rendered = renderSmartMessage(message.text, shoot); return <article key={message.id}><strong>{message.title}</strong><p>{rendered}</p><div><button type="button" onClick={() => setEditor(message)}>Редактировать</button><button type="button" onClick={() => void sendMessage(rendered, notify)}>Отправить</button></div></article>; })}{editor && <SmartMessageEditor message={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={saveMessage} />}</section>;
}

export function DayModeModal({ shoot, client, onClose, onUpdate, notify }: { shoot: Shoot; client?: Client; onClose: () => void; onUpdate: (id: number, patch: Partial<Shoot>) => void; notify: (message: string) => void }) {
  const [section, setSection] = useState<"timeline" | "gear">("timeline");
  const [details, setDetails] = useState({ location: shoot.location, travelMinutes: String(shoot.travelMinutes), organizerName: shoot.organizerName, organizerPhone: shoot.organizerPhone, clientGuide: shoot.clientGuide });
  const portalUrl = typeof window === "undefined" ? "" : `${window.location.origin}/client/${shoot.portalToken}`;
  const clientPhone = client?.phone || "";
  return <Modal title="Режим съёмки" onClose={onClose} wide fullScreen><div className="day-mode"><section className="day-hero" style={{ "--shoot-color": displayColor(shoot.color) } as CSSProperties}><span>{shoot.type} · {dateRu(shoot.startAt)}</span><h2>{shoot.clientName}</h2><div className="day-time-row"><strong>{time(shoot.startAt)}–{time(shoot.endAt)}</strong><span>{shoot.delivered ? `Сдано ${dateRu(deliveryDate(shoot).toISOString())}` : `Выехать в ${departureTime(shoot)}`}</span></div>{shoot.location && <a href={mapsHref(shoot.location)} target="_blank" rel="noreferrer">📍 {shoot.location} <b>Маршрут ↗</b></a>}</section><section className="day-contacts panel-inset"><div><span>Клиент</span><strong>{shoot.clientName}</strong><small>{clientPhone || "Телефон не указан"}</small></div>{clientPhone && <a href={phoneHref(clientPhone)}>Позвонить</a>}{shoot.organizerName && <div><span>На площадке</span><strong>{shoot.organizerName}</strong><small>{shoot.organizerPhone || "Телефон не указан"}</small></div>}{shoot.organizerPhone && <a href={phoneHref(shoot.organizerPhone)}>Позвонить</a>}</section><div className="day-tabs" role="tablist" aria-label="Управление проектом"><button type="button" role="tab" aria-selected={section === "timeline"} className={section === "timeline" ? "active" : ""} onClick={() => setSection("timeline")}>Тайминг</button><button type="button" role="tab" aria-selected={section === "gear"} className={section === "gear" ? "active" : ""} onClick={() => setSection("gear")}>Техника</button></div>{section === "timeline" ? <TimelineManager items={shoot.timeline} onChange={(timeline) => onUpdate(shoot.id, { timeline })} /> : <EquipmentManager items={shoot.equipment} onChange={(equipment) => onUpdate(shoot.id, { equipment })} />}<SmartMessages shoot={shoot} notify={notify} /><section className="portal-card"><div><span>Кабинет клиента</span><h3>Одна ссылка вместо десятка вопросов</h3><p>{shoot.portalToken ? "Дата, адрес, памятка, статус, срок готовности и остаток к оплате." : "Ссылка появится после синхронизации проекта."}</p></div><div><button type="button" className="button secondary" disabled={!shoot.portalToken} onClick={() => void copyText(portalUrl, notify)}>Скопировать ссылку</button>{shoot.portalToken && <a className="button primary" href={portalUrl} target="_blank" rel="noreferrer">Предпросмотр</a>}</div></section><section className="day-economics panel-inset"><div><span>Проект</span><strong>{money(shoot.price)}</strong></div><div><span>Расходы</span><strong>{money(shoot.travelCost + shoot.otherCosts)}</strong></div><div><span>Прибыль в час</span><strong>{money(profitPerHour(shoot))}</strong></div>{shoot.price > shoot.paidAmount && <button type="button" onClick={() => onUpdate(shoot.id, { paidAmount: shoot.price })}>Отметить {money(shoot.price - shoot.paidAmount)} оплаченными</button>}</section><details className="project-details panel-inset"><summary>Изменить детали проекта</summary><div className="project-fields"><label><span>Локация</span><input value={details.location} onChange={(event) => setDetails({ ...details, location: event.target.value })} /></label><label><span>Дорога, минут</span><input type="number" min="0" value={details.travelMinutes} onChange={(event) => setDetails({ ...details, travelMinutes: event.target.value })} /></label><label><span>Организатор</span><input value={details.organizerName} onChange={(event) => setDetails({ ...details, organizerName: event.target.value })} /></label><label><span>Телефон организатора</span><input value={details.organizerPhone} onChange={(event) => setDetails({ ...details, organizerPhone: event.target.value })} /></label><label className="wide"><span>Памятка клиенту</span><textarea value={details.clientGuide} onChange={(event) => setDetails({ ...details, clientGuide: event.target.value })} /></label></div><button type="button" className="button primary full" onClick={() => { onUpdate(shoot.id, { location: details.location.trim(), travelMinutes: Math.max(0, Number(details.travelMinutes) || 0), organizerName: details.organizerName.trim(), organizerPhone: details.organizerPhone.trim(), clientGuide: details.clientGuide.trim() }); notify("Детали проекта сохранены"); }}>Сохранить детали</button></details></div></Modal>;
}

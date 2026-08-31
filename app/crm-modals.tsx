"use client";

import {
  CSSProperties,
  type FocusEvent,
  FormEvent,
  useRef,
  useState,
} from "react";
import type { Client, Shoot, ShootType } from "./crm-data";
import {
  defaultEquipment,
  displayColor,
  defaultShotList,
  money,
} from "./crm-data";
import {
  initialShootTimeline,
  NEW_SHOOT_REQUIRED_MESSAGE,
  type NewShootField,
  validateNewShoot,
} from "./crm-new-shoot";
import { Field, Modal } from "./crm-ui";

type NewShootInput = Omit<Shoot, "id"> & { clientPhone: string };
type NewShootSaveResult = { ok: boolean; queued?: boolean; error?: string };

function normalizedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("8")
    ? `7${digits.slice(1)}`
    : digits;
}

export function NewClientModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (client: Omit<Client, "id">) => void;
}) {
  const [kind, setKind] = useState<Client["kind"]>("person");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Modal title="Новый клиент" onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) {
            onSave({ name: name.trim(), phone, email, kind, notes });
          }
        }}
      >
        <div className="segmented wide-segment">
          <button
            type="button"
            className={kind === "person" ? "active" : ""}
            onClick={() => setKind("person")}
          >
            Физлицо
          </button>
          <button
            type="button"
            className={kind === "company" ? "active" : ""}
            onClick={() => setKind("company")}
          >
            Юрлицо
          </button>
        </div>
        <Field label="Имя или название *">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Анна Смирнова"
          />
        </Field>
        <div className="form-grid">
          <Field label="Телефон">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+7 900 000-00-00"
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="mail@example.ru"
            />
          </Field>
        </div>
        <Field label="Заметки">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Предпочтения и важные детали…"
          />
        </Field>
        <button className="button primary full">Добавить клиента</button>
      </form>
    </Modal>
  );
}

export function NewShootModal({
  clients,
  types,
  initialDate,
  onClose,
  onSave,
  notify,
}: {
  clients: Client[];
  types: ShootType[];
  initialDate?: string;
  onClose: () => void;
  onSave: (shoot: NewShootInput) => Promise<NewShootSaveResult>;
  notify: (message: string) => void;
}) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(initialDate || localToday);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [typeName, setTypeName] = useState(types[0]?.name || "Свадьба");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState("");
  const [travelMinutes, setTravelMinutes] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [editingHours, setEditingHours] = useState("6");
  const [travelCost, setTravelCost] = useState("0");
  const [otherCosts, setOtherCosts] = useState("0");
  const [clientGuide, setClientGuide] = useState("");
  const [price, setPrice] = useState("");
  const [paymentType, setPaymentType] =
    useState<Shoot["paymentType"]>("advance");
  const [paid, setPaid] = useState("");
  const [errors, setErrors] = useState<Partial<Record<NewShootField, boolean>>>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef<Partial<Record<NewShootField, HTMLInputElement>>>({});
  const selectedType =
    types.find((type) => type.name === typeName) ||
    types[0] ||
    { name: typeName, color: "#5267FF", deliveryDays: 14 };

  function clearError(field: NewShootField) {
    setErrors((current) =>
      current[field] ? { ...current, [field]: false } : current,
    );
  }

  function focusInvalidField(field: NewShootField) {
    const input = inputRefs.current[field];
    if (!input) return;
    input.focus({ preventScroll: true });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        input.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }),
      ),
    );
  }

  function keepFocusedFieldVisible(event: FocusEvent<HTMLElement>) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
      return;
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        input.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }),
      ),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalidFields = validateNewShoot({
      clientName,
      clientPhone,
      location,
      price,
      paymentType,
      advance: paid,
    });
    if (invalidFields.length) {
      setErrors(
        Object.fromEntries(invalidFields.map((field) => [field, true])) as Partial<
          Record<NewShootField, boolean>
        >,
      );
      notify(NEW_SHOOT_REQUIRED_MESSAGE);
      focusInvalidField(invalidFields[0]);
      return;
    }
    setSaveError("");
    setSaving(true);
    const normalizedClientPhone = normalizedPhone(clientPhone);
    const client = clients.find(
      (item) =>
        item.name.toLocaleLowerCase("ru-RU") ===
          clientName.trim().toLocaleLowerCase("ru-RU") ||
        (!!normalizedClientPhone &&
          normalizedPhone(item.phone) === normalizedClientPhone),
    );
    let result: NewShootSaveResult;
    try {
      result = await onSave({
        clientId: client?.id || null,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        type: typeName,
        color: selectedType.color,
        startAt: `${date}T${start}`,
        endAt: `${date}T${end}`,
        allDay: false,
        comment,
        price: Number(price),
        paymentType,
        paidAmount:
          paymentType === "full" ? Number(price) : Number(paid || 0),
        deliveryDays: selectedType.deliveryDays,
        delivered: false,
        archived: false,
        status: "booked",
        location: location.trim(),
        travelMinutes: Number(travelMinutes || 0),
        organizerName,
        organizerPhone,
        editingHours: Number(editingHours),
        travelCost: Number(travelCost),
        otherCosts: Number(otherCosts),
        equipment: defaultEquipment(typeName),
        shotList: defaultShotList(typeName),
        timeline: initialShootTimeline(`${date}T${start}`),
        backupStatus: "none",
        portalToken: "",
        clientGuide,
      });
    } catch {
      result = { ok: false, error: "Не удалось сохранить съёмку. Повторите попытку." };
    } finally {
      setSaving(false);
    }
    if (!result.ok) {
      setSaveError(result.error || "Не удалось сохранить съёмку. Проверьте подключение и повторите.");
      return;
    }
    onClose();
  }

  return (
    <Modal title="Новая съёмка" onClose={onClose} wide fullScreen viewportAware>
      <form className="modal-form" onSubmit={submit} onFocusCapture={keepFocusedFieldVisible}>
        <div className="form-grid client-fields">
          <Field label="Имя клиента *" invalid={errors.clientName}>
            <input
              list="client-names"
              required
              value={clientName}
              onChange={(event) => {
                const value = event.target.value;
                const previousClient = clients.find(
                  (client) => client.name === clientName,
                );
                const selectedClient = clients.find(
                  (client) =>
                    client.name.toLocaleLowerCase("ru-RU") ===
                    value.trim().toLocaleLowerCase("ru-RU"),
                );
                setClientName(value);
                if (selectedClient) {
                  setClientName(selectedClient.name);
                  setClientPhone(selectedClient.phone);
                } else if (previousClient) {
                  setClientPhone("");
                }
                clearError("clientName");
              }}
              ref={(node) => {
                inputRefs.current.clientName = node || undefined;
              }}
              placeholder="Иванов Иван Иванович"
            />
            <datalist id="client-names">
              {clients.map((client) => (
                <option value={client.name} key={client.id}>
                  {client.phone}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Телефон *" invalid={errors.clientPhone}>
            <input
              type="tel"
              inputMode="tel"
              required
              list="client-phones"
              value={clientPhone}
              onChange={(event) => {
                const value = event.target.value;
                const phone = normalizedPhone(value);
                const selectedClient = clients.find(
                  (client) =>
                    !!phone && normalizedPhone(client.phone) === phone,
                );
                setClientPhone(value);
                if (selectedClient) {
                  setClientName(selectedClient.name);
                  setClientPhone(selectedClient.phone);
                }
                clearError("clientPhone");
              }}
              ref={(node) => {
                inputRefs.current.clientPhone = node || undefined;
              }}
              placeholder="+7 900 000-00-00"
            />
            <datalist id="client-phones">
              {clients
                .filter((client) => client.phone)
                .map((client) => (
                  <option value={client.phone} key={client.id}>
                    {client.name}
                  </option>
                ))}
            </datalist>
          </Field>
        </div>

        <div className="form-grid date-grid">
          <Field label="Дата">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Начало">
            <input
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </Field>
          <Field label="Конец">
            <input
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </Field>
        </div>

        <fieldset className="type-selector">
          <legend>Тип *</legend>
          {types.map((type) => (
            <button
              type="button"
              key={type.name}
              onClick={() => setTypeName(type.name)}
              className={typeName === type.name ? "active" : ""}
              style={{ "--type-color": displayColor(type.color) } as CSSProperties}
            >
              {type.name}
            </button>
          ))}
        </fieldset>

        <div className="form-grid">
          <Field label="Локация или адрес *" invalid={errors.location}>
            <input
              required
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                clearError("location");
              }}
              ref={(node) => {
                inputRefs.current.location = node || undefined;
              }}
              placeholder="Абрау-Дюрсо, площадка…"
            />
          </Field>
          <Field label="Время в дороге, минут">
            <input
              type="number"
              min="0"
              value={travelMinutes}
              onChange={(event) => setTravelMinutes(event.target.value)}
              placeholder="Например, 30"
            />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Организатор / контакт на площадке">
            <input
              value={organizerName}
              onChange={(event) => setOrganizerName(event.target.value)}
              placeholder="Имя и роль"
            />
          </Field>
          <Field label="Телефон организатора">
            <input
              value={organizerPhone}
              onChange={(event) => setOrganizerPhone(event.target.value)}
              placeholder="+7 900 000-00-00"
            />
          </Field>
        </div>

        <Field label="Комментарий">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Пожелания, локация, тайминг…"
          />
        </Field>
        <details className="advanced-fields">
          <summary>Экономика и подготовка клиента</summary>
          <div className="form-grid triple-grid">
            <Field label="Часов на обработку">
              <input type="number" min="0" value={editingHours} onChange={(event) => setEditingHours(event.target.value)} />
            </Field>
            <Field label="Расходы на дорогу">
              <input type="number" min="0" value={travelCost} onChange={(event) => setTravelCost(event.target.value)} />
            </Field>
            <Field label="Прочие расходы">
              <input type="number" min="0" value={otherCosts} onChange={(event) => setOtherCosts(event.target.value)} />
            </Field>
          </div>
          <Field label="Что увидит клиент в памятке">
            <textarea
              value={clientGuide}
              onChange={(event) => setClientGuide(event.target.value)}
              placeholder="Что взять, как подготовиться, рекомендации по одежде…"
            />
          </Field>
        </details>
        <Field label="Стоимость съёмки *" invalid={errors.price}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            required
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              clearError("price");
            }}
            ref={(node) => {
              inputRefs.current.price = node || undefined;
            }}
            placeholder="Например, 25 000"
            enterKeyHint={paymentType === "advance" ? "next" : "done"}
          />
        </Field>
        <fieldset className="payment-selector">
          <legend>Тип оплаты</legend>
          {(["advance", "full", "postpay"] as const).map((value) => (
            <button
              type="button"
              className={paymentType === value ? "active" : ""}
              onClick={() => {
                setPaymentType(value);
                if (value !== "advance") clearError("advance");
              }}
              key={value}
            >
              {value === "advance"
                ? "Аванс"
                : value === "full"
                  ? "Полная"
                  : "Постоплата"}
            </button>
          ))}
        </fieldset>
        {paymentType === "advance" && (
          <Field label="Сумма аванса *" invalid={errors.advance}>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max={price || undefined}
              step="1"
              required
              value={paid}
              onChange={(event) => {
                setPaid(event.target.value);
                clearError("advance");
              }}
              ref={(node) => {
                inputRefs.current.advance = node || undefined;
              }}
              placeholder="Например, 5 000"
              enterKeyHint="done"
            />
          </Field>
        )}
        <div className="balance">
          <span>Остаток к оплате</span>
          <strong>
            {money(
              Math.max(
                0,
                Number(price || 0) -
                  (paymentType === "full" ? Number(price || 0) : Number(paid || 0)),
              ),
            )}
          </strong>
        </div>
        {saveError && <p className="form-save-error" role="alert">{saveError}</p>}
        <button className="button primary full large-button" disabled={saving}>
          {saving ? "Сохраняю…" : "Добавить съёмку"}
        </button>
      </form>
    </Modal>
  );
}

"use client";

import { CSSProperties, FormEvent, useState } from "react";
import type { Client, Shoot, ShootType } from "./crm-data";
import {
  defaultEquipment,
  displayColor,
  defaultShotList,
  defaultTimeline,
  money,
} from "./crm-data";
import { Field, Icon, Modal, ToggleRow } from "./crm-ui";

type NewShootInput = Omit<Shoot, "id"> & { clientPhone: string };

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
  onSave: (shoot: NewShootInput) => void;
  notify: (message: string) => void;
}) {
  const [recognition, setRecognition] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(initialDate || localToday);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [allDay, setAllDay] = useState(false);
  const [typeName, setTypeName] = useState(types[0]?.name || "Свадьба");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState("");
  const [travelMinutes, setTravelMinutes] = useState("30");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [editingHours, setEditingHours] = useState("6");
  const [travelCost, setTravelCost] = useState("0");
  const [otherCosts, setOtherCosts] = useState("0");
  const [clientGuide, setClientGuide] = useState("");
  const [attachedImage, setAttachedImage] = useState("");
  const [withPrice, setWithPrice] = useState(true);
  const [price, setPrice] = useState("0");
  const [paymentType, setPaymentType] =
    useState<Shoot["paymentType"]>("advance");
  const [paid, setPaid] = useState("0");
  const selectedType = types.find((type) => type.name === typeName) || types[0];

  function dictate() {
    const browserWindow = window as Window & {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        start: () => void;
        onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
        onerror: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        start: () => void;
        onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
        onerror: () => void;
      };
    };
    const Recognition =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      notify("Голосовой ввод не поддерживается этим браузером");
      return;
    }
    const recognitionApi = new Recognition();
    recognitionApi.lang = "ru-RU";
    recognitionApi.interimResults = false;
    recognitionApi.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript || "";
      setRecognition((current) => `${current} ${text}`.trim());
      notify("Голос преобразован в текст");
    };
    recognitionApi.onerror = () => notify("Не удалось распознать голос");
    recognitionApi.start();
  }

  async function readImage(file: File) {
    setAttachedImage(file.name);
    const browserWindow = window as Window & {
      TextDetector?: new () => {
        detect: (bitmap: ImageBitmap) => Promise<Array<{ rawValue?: string }>>;
      };
    };
    if (!browserWindow.TextDetector) {
      notify("Фото прикреплено. OCR зависит от браузера — при необходимости продиктуйте текст");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const blocks = await new browserWindow.TextDetector().detect(bitmap);
      const text = blocks.map((block) => block.rawValue || "").join("\n").trim();
      if (text) {
        setRecognition(text);
        notify("Текст с изображения распознан");
      } else {
        notify("Текст на изображении не найден");
      }
    } catch {
      notify("Не удалось распознать изображение");
    }
  }

  function recognize() {
    if (!recognition.trim()) {
      notify("Вставьте сообщение клиента");
      return;
    }
    const lower = recognition.toLowerCase();
    const foundType = types.find((type) =>
      lower.includes(type.name.toLowerCase()),
    );
    if (foundType) setTypeName(foundType.name);

    const dateMatch = recognition.match(
      /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/,
    );
    if (dateMatch) {
      setDate(
        `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`,
      );
    }
    const times = [...recognition.matchAll(/(?:в\s*)?(\d{1,2}):(\d{2})/g)];
    if (times[0]) setStart(`${times[0][1].padStart(2, "0")}:${times[0][2]}`);
    if (times[1]) setEnd(`${times[1][1].padStart(2, "0")}:${times[1][2]}`);

    const priceMatch = recognition.match(
      /(?:стоимость|цена|за|₽)\s*[:—-]?\s*(\d[\d\s]{2,})|((?:\d[\d\s]{2,}))\s*(?:₽|руб)/i,
    );
    if (priceMatch) {
      setPrice((priceMatch[1] || priceMatch[2]).replace(/\s/g, ""));
    }
    const knownClient = clients.find((client) =>
      lower.includes(client.name.toLowerCase().split(" ")[0]),
    );
    if (knownClient) {
      setClientName(knownClient.name);
      setClientPhone(knownClient.phone);
    } else {
      const phoneMatch = recognition.match(/(?:\+7|8)[\d\s()\-]{9,}/);
      if (phoneMatch) setClientPhone(phoneMatch[0].trim());
    }
    const locationMatch = recognition.match(
      /(?:локация|адрес|место)\s*[:—-]\s*([^\n,;]+)/i,
    );
    if (locationMatch) setLocation(locationMatch[1].trim());
    setComment(recognition.trim());
    notify("Поля заполнены — проверьте результат");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!clientName.trim()) {
      notify("Укажите клиента");
      return;
    }
    const normalizedClientPhone = normalizedPhone(clientPhone);
    const client = clients.find(
      (item) =>
        item.name.toLocaleLowerCase("ru-RU") ===
          clientName.trim().toLocaleLowerCase("ru-RU") ||
        (!!normalizedClientPhone &&
          normalizedPhone(item.phone) === normalizedClientPhone),
    );
    onSave({
      clientId: client?.id || null,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      type: typeName,
      color: selectedType.color,
      startAt: `${date}T${allDay ? "00:00" : start}`,
      endAt: `${date}T${allDay ? "23:59" : end}`,
      allDay,
      comment,
      price: withPrice ? Number(price) : 0,
      paymentType,
      paidAmount:
        paymentType === "full" ? Number(price) : Number(paid),
      deliveryDays: selectedType.deliveryDays,
      delivered: false,
      archived: false,
      status: "booked",
      location,
      travelMinutes: Number(travelMinutes),
      organizerName,
      organizerPhone,
      editingHours: Number(editingHours),
      travelCost: Number(travelCost),
      otherCosts: Number(otherCosts),
      equipment: defaultEquipment(typeName),
      shotList: defaultShotList(typeName),
      timeline: defaultTimeline(start, end, typeName),
      backupStatus: "none",
      portalToken: "",
      clientGuide,
    });
  }

  return (
    <Modal title="Новая съёмка" onClose={onClose} wide fullScreen>
      <form className="modal-form" onSubmit={submit}>
        <div className="recognition-box">
          <div className="recognition-title">
            <Icon name="spark" />
            <strong>Умное распознавание</strong>
            <span>необязательно</span>
          </div>
          <textarea
            value={recognition}
            onChange={(event) => setRecognition(event.target.value)}
            placeholder="Вставьте переписку: «Алёна, свадьба 22.08.2026 в 14:00, стоимость 69 000 ₽…»"
          />
          <button type="button" className="button primary" onClick={recognize}>
            Распознать
          </button>
          <div className="recognition-actions">
            <button type="button" onClick={dictate}>🎙 Продиктовать</button>
            <label>
              📷 Прикрепить скрин
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readImage(file);
                }}
              />
            </label>
          </div>
          {attachedImage && <small className="attached-file">Прикреплено: {attachedImage}</small>}
        </div>

        <div className="form-grid client-fields">
          <Field label="Имя клиента *">
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
              }}
              placeholder="Например, Иванов Иван"
            />
            <datalist id="client-names">
              {clients.map((client) => (
                <option value={client.name} key={client.id}>
                  {client.phone}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Телефон">
            <input
              type="tel"
              inputMode="tel"
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

        <ToggleRow
          title="Весь день"
          subtitle="Для свадеб и длинных съёмок"
          onChange={setAllDay}
        />
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
              disabled={allDay}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </Field>
          <Field label="Конец">
            <input
              type="time"
              disabled={allDay}
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
          <Field label="Локация или адрес">
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Абрау-Дюрсо, площадка…"
            />
          </Field>
          <Field label="Время в дороге, минут">
            <input
              type="number"
              min="0"
              value={travelMinutes}
              onChange={(event) => setTravelMinutes(event.target.value)}
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
        <button
          type="button"
          className="toggle-row price-toggle"
          onClick={() => setWithPrice(!withPrice)}
        >
          <span><strong>Указать стоимость</strong><small>Необязательно</small></span>
          <i className={withPrice ? "on" : ""}><b /></i>
        </button>

        {withPrice && (
          <>
            <Field label="Стоимость съёмки">
              <input
                type="number"
                min="0"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </Field>
            <fieldset className="payment-selector">
              <legend>Тип оплаты</legend>
              {(["advance", "full", "postpay"] as const).map((value) => (
                <button
                  type="button"
                  className={paymentType === value ? "active" : ""}
                  onClick={() => setPaymentType(value)}
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
              <Field label="Сумма аванса">
                <input
                  type="number"
                  min="0"
                  max={price}
                  value={paid}
                  onChange={(event) => setPaid(event.target.value)}
                />
              </Field>
            )}
            <div className="balance">
              <span>Остаток к оплате</span>
              <strong>
                {money(
                  Math.max(
                    0,
                    Number(price) -
                      (paymentType === "full" ? Number(price) : Number(paid)),
                  ),
                )}
              </strong>
            </div>
          </>
        )}
        <button className="button primary full large-button">
          Добавить съёмку
        </button>
      </form>
    </Modal>
  );
}

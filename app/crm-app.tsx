"use client";

import { useEffect, useRef, useState } from "react";
import {
  createBrowserDataLayer,
  type CrmDataLayer,
  type CrmSnapshot,
} from "./crm-data-layer";
import type { Client, Shoot, Tab } from "./crm-data";
import {
  DEFAULT_TYPES,
  displayColor,
  INITIAL_CLIENTS,
  INITIAL_SHOOTS,
} from "./crm-data";
import { NewClientModal, NewShootModal } from "./crm-modals";
import { CalendarPage, ClientsPage, ShootsPage } from "./crm-pages-primary";
import {
  FinancePage,
  type ProfileData,
  ProfilePage,
  SettingsPage,
} from "./crm-pages-secondary";
import { BottomNav } from "./crm-ui";

const INITIAL_PROFILE: ProfileData = {
  firstName: "Кристина",
  lastName: "Вениченко",
  phone: "+7 900 000-00-00",
  city: "Новороссийск",
  email: "kristina@example.ru",
  goal: "2500000",
};

const INITIAL_SNAPSHOT: CrmSnapshot = {
  clients: INITIAL_CLIENTS,
  shoots: INITIAL_SHOOTS,
  types: DEFAULT_TYPES,
  reminders: [5, 1, 0],
  profile: INITIAL_PROFILE,
};

function normalizeColors(snapshot: CrmSnapshot): CrmSnapshot {
  return {
    ...snapshot,
    shoots: snapshot.shoots.map((shoot) => ({
      ...shoot,
      color: displayColor(shoot.color),
    })),
    types: snapshot.types.map((type) => ({
      ...type,
      color: displayColor(type.color),
    })),
  };
}

export default function CrmApp() {
  const [tab, setTab] = useState<Tab>("shoots");
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [shoots, setShoots] = useState(INITIAL_SHOOTS);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [reminders, setReminders] = useState([5, 1, 0]);
  const [profile, setProfile] = useState<ProfileData>(INITIAL_PROFILE);
  const [shootModal, setShootModal] = useState(false);
  const [shootModalDate, setShootModalDate] = useState<string | undefined>();
  const [clientModal, setClientModal] = useState(false);
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(true);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const dataLayerRef = useRef<CrmDataLayer | null>(null);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  useEffect(() => {
    const dataLayer = createBrowserDataLayer(INITIAL_SNAPSHOT);
    dataLayerRef.current = dataLayer;
    const unsubscribe = dataLayer.subscribe((state) => {
      const snapshot = normalizeColors(state.snapshot);
      setClients(snapshot.clients);
      setShoots(snapshot.shoots);
      setTypes(snapshot.types);
      setReminders(snapshot.reminders);
      setProfile(snapshot.profile);
      setQueued(state.queued);
      setSyncing(state.syncing);
      setOnline(state.online);
    });
    const handleOnline = () => dataLayer.setOnline(true);
    const handleOffline = () => dataLayer.setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    void dataLayer.bootstrap().catch(() => {
      notify(
        navigator.onLine
          ? "Открыт демонстрационный режим"
          : "Открыта офлайн-копия",
      );
    });
    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      dataLayerRef.current = null;
    };
  }, []);

  async function serverAction(
    action: string,
    data: Record<string, unknown> = {},
    id?: number,
  ) {
    if (!navigator.onLine) {
      notify("Это изменение требует подключения к сети");
      return false;
    }
    setSyncing(true);
    try {
      const response = await fetch("/api/crm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, data, id }),
      });
      const result = (await response.json()) as Record<string, unknown> & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Ошибка сохранения");
      if (!dataLayerRef.current?.acceptServerSnapshot(result)) {
        throw new Error("Сервер вернул неполные данные");
      }
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось сохранить");
      return false;
    } finally {
      setSyncing(false);
    }
  }

  async function addClient(client: Omit<Client, "id">) {
    if (await serverAction("createClient", client)) notify("Клиент добавлен");
  }

  async function addShoot(shoot: Omit<Shoot, "id">) {
    const result = await dataLayerRef.current?.createShoot(shoot);
    if (!result) return;
    if (result.ok) {
      notify(result.queued ? "Съёмка сохранена офлайн" : "Съёмка добавлена");
      setTab("shoots");
    } else {
      notify(result.error || "Не удалось добавить съёмку");
    }
  }

  async function updateShoot(id: number, patch: Partial<Shoot>) {
    const dataLayer = dataLayerRef.current;
    if (!dataLayer) return;
    const current = shoots.find((shoot) => shoot.id === id);
    const result =
      patch.delivered === true
        ? await dataLayer.setDelivered(id)
        : patch.delivered === false
          ? await dataLayer.returnToWork(id, patch.status || "processing")
          : current && patch.paidAmount === current.price
            ? await dataLayer.payShoot(id)
            : await dataLayer.updateShoot(id, patch);
    if (!result.ok) notify(result.error || "Не удалось сохранить изменение");
  }

  async function deleteShoot(id: number) {
    const result = await dataLayerRef.current?.deleteShoot(id);
    if (!result) return;
    if (result.ok) notify("Съёмка удалена");
    else notify(result.error || "Не удалось удалить съёмку");
  }

  return (
    <div className="app-shell">
      {syncing && <div className="sync-indicator">Сохранение…</div>}
      {!online && (
        <div className="offline-indicator">
          Офлайн{queued ? ` · ${queued} в очереди` : " · данные доступны"}
        </div>
      )}
      <main className="app-main">
        {tab === "shoots" && (
          <ShootsPage
            shoots={shoots}
            clients={clients}
            onUpdate={updateShoot}
            onOpen={() => setShootModal(true)}
            onDelete={deleteShoot}
            notify={notify}
          />
        )}
        {tab === "calendar" && (
          <CalendarPage
            shoots={shoots}
            types={types}
            clients={clients}
            onUpdate={updateShoot}
            onAddAtDate={(date) => {
              setShootModalDate(date);
              setShootModal(true);
            }}
            notify={notify}
          />
        )}
        {tab === "clients" && (
          <ClientsPage
            clients={clients}
            shoots={shoots}
            onAdd={() => setClientModal(true)}
          />
        )}
        {tab === "finance" && <FinancePage shoots={shoots} />}
        {tab === "settings" && (
          <SettingsPage
            types={types}
            setTypes={setTypes}
            shoots={shoots}
            clients={clients}
            notify={notify}
            initialReminders={reminders}
            onSave={(nextTypes, nextReminders) => {
              setReminders(nextReminders);
              void serverAction("savePreferences", {
                profile,
                types: nextTypes,
                reminders: nextReminders,
              }).then((saved) => saved && notify("Настройки сохранены"));
            }}
          />
        )}
        {tab === "profile" && (
          <ProfilePage
            key={`${profile.email}-${profile.firstName}`}
            notify={notify}
            initialProfile={profile}
            onSave={(nextProfile) => {
              setProfile(nextProfile);
              void serverAction("savePreferences", {
                profile: nextProfile,
                types,
                reminders,
              });
            }}
          />
        )}
      </main>

      <BottomNav
        tab={tab}
        setTab={setTab}
        onAdd={() => {
          setShootModalDate(undefined);
          setShootModal(true);
        }}
      />

      {shootModal && (
        <NewShootModal
          clients={clients}
          types={types}
          initialDate={shootModalDate}
          onClose={() => {
            setShootModal(false);
            setShootModalDate(undefined);
          }}
          onSave={(shoot) => {
            void addShoot(shoot);
            setShootModal(false);
            setShootModalDate(undefined);
          }}
          notify={notify}
        />
      )}
      {clientModal && (
        <NewClientModal
          onClose={() => setClientModal(false)}
          onSave={(client) => {
            void addClient(client);
            setClientModal(false);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

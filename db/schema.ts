import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    kind: text("kind").notNull().default("person"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("clients_owner_idx").on(table.owner)],
);

export const shoots = sqliteTable(
  "shoots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: text("owner").notNull(),
    clientId: integer("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    clientName: text("client_name").notNull(),
    type: text("type").notNull(),
    color: text("color").notNull(),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    comment: text("comment").notNull().default(""),
    price: integer("price").notNull().default(0),
    paymentType: text("payment_type").notNull().default("advance"),
    paidAmount: integer("paid_amount").notNull().default(0),
    deliveryDays: integer("delivery_days").notNull().default(14),
    delivered: integer("delivered", { mode: "boolean" })
      .notNull()
      .default(false),
    archived: integer("archived", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("booked"),
    location: text("location").notNull().default(""),
    travelMinutes: integer("travel_minutes").notNull().default(30),
    organizerName: text("organizer_name").notNull().default(""),
    organizerPhone: text("organizer_phone").notNull().default(""),
    editingHours: integer("editing_hours").notNull().default(0),
    travelCost: integer("travel_cost").notNull().default(0),
    otherCosts: integer("other_costs").notNull().default(0),
    equipmentJson: text("equipment_json").notNull().default("[]"),
    shotListJson: text("shot_list_json").notNull().default("[]"),
    timelineJson: text("timeline_json").notNull().default("[]"),
    backupStatus: text("backup_status").notNull().default("none"),
    portalToken: text("portal_token").notNull().default(""),
    clientGuide: text("client_guide").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("shoots_owner_idx").on(table.owner),
    index("shoots_start_idx").on(table.startAt),
    index("shoots_portal_token_idx").on(table.portalToken),
  ],
);

export const preferences = sqliteTable(
  "preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: text("owner").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    city: text("city").notNull().default(""),
    annualGoal: integer("annual_goal").notNull().default(2500000),
    typesJson: text("types_json").notNull().default("[]"),
    remindersJson: text("reminders_json").notNull().default("[5,1,0]"),
    showAverage: integer("show_average", { mode: "boolean" })
      .notNull()
      .default(false),
    deliveryReminderDays: integer("delivery_reminder_days").notNull().default(1),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("preferences_owner_uidx").on(table.owner)],
);

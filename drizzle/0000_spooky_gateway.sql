CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'person' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clients_owner_idx` ON `clients` (`owner`);--> statement-breakpoint
CREATE TABLE `preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`annual_goal` integer DEFAULT 2500000 NOT NULL,
	`types_json` text DEFAULT '[]' NOT NULL,
	`reminders_json` text DEFAULT '[5,1,0]' NOT NULL,
	`show_average` integer DEFAULT false NOT NULL,
	`delivery_reminder_days` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preferences_owner_uidx` ON `preferences` (`owner`);--> statement-breakpoint
CREATE TABLE `shoots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`client_id` integer,
	`client_name` text NOT NULL,
	`type` text NOT NULL,
	`color` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`payment_type` text DEFAULT 'advance' NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`delivery_days` integer DEFAULT 14 NOT NULL,
	`delivered` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `shoots_owner_idx` ON `shoots` (`owner`);--> statement-breakpoint
CREATE INDEX `shoots_start_idx` ON `shoots` (`start_at`);
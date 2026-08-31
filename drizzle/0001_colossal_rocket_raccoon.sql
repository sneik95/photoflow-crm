ALTER TABLE `shoots` ADD `status` text DEFAULT 'booked' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `travel_minutes` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `organizer_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `organizer_phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `editing_hours` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `travel_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `other_costs` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `equipment_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `shot_list_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `timeline_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `backup_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `portal_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `client_guide` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `shoots_portal_token_idx` ON `shoots` (`portal_token`);
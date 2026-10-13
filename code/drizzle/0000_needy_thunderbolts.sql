CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`kind` text NOT NULL,
	`encrypted_secret` text NOT NULL,
	`label` text NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `api_keys_org_idx` ON `api_keys` (`org_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`model_version` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_org_idx` ON `audit_log` (`org_id`);--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `defects` (
	`id` text PRIMARY KEY NOT NULL,
	`panel_result_id` text NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`location` text NOT NULL,
	`confidence` real NOT NULL,
	`eff_loss_pct` real NOT NULL,
	`notes` text,
	`bbox_json` text,
	`accepted_by_user_id` text,
	FOREIGN KEY (`panel_result_id`) REFERENCES `panel_results`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `defects_panel_result_idx` ON `defects` (`panel_result_id`);--> statement-breakpoint
CREATE TABLE `inspection_images` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`sha256` text NOT NULL,
	`image_url` text NOT NULL,
	`exif_json` text,
	`lat` real,
	`lon` real,
	`taken_at` integer,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inspection_images_inspection_idx` ON `inspection_images` (`inspection_id`);--> statement-breakpoint
CREATE INDEX `inspection_images_sha_idx` ON `inspection_images` (`sha256`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`site_id` text,
	`kind` text NOT NULL,
	`source_filename` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`panel_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	`created_by_user_id` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inspections_org_idx` ON `inspections` (`org_id`);--> statement-breakpoint
CREATE INDEX `inspections_site_idx` ON `inspections` (`site_id`);--> statement-breakpoint
CREATE INDEX `inspections_status_idx` ON `inspections` (`status`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`scheduled_for` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `jobs_status_sched_idx` ON `jobs` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `jobs_org_idx` ON `jobs` (`org_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_user_org_uq` ON `memberships` (`user_id`,`org_id`);--> statement-breakpoint
CREATE INDEX `memberships_org_idx` ON `memberships` (`org_id`);--> statement-breakpoint
CREATE TABLE `model_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`provider` text NOT NULL,
	`model_name` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_versions_role_name_hash_uq` ON `model_versions` (`role`,`model_name`,`prompt_hash`);--> statement-breakpoint
CREATE TABLE `modules` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`string_id` text,
	`serial_number` text,
	`manufacturer` text,
	`model` text,
	`wattage_w` integer,
	`install_date` integer,
	`lat` real,
	`lon` real,
	`mount_type` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`string_id`) REFERENCES `strings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `modules_site_idx` ON `modules` (`site_id`);--> statement-breakpoint
CREATE INDEX `modules_string_idx` ON `modules` (`string_id`);--> statement-breakpoint
CREATE INDEX `modules_serial_idx` ON `modules` (`serial_number`);--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_slug_unique` ON `orgs` (`slug`);--> statement-breakpoint
CREATE TABLE `panel_results` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`image_id` text,
	`module_id` text,
	`panel_id_string` text NOT NULL,
	`panel_type` text NOT NULL,
	`condition_score` integer NOT NULL,
	`cleanliness_score` integer NOT NULL,
	`eff_loss_pct` real NOT NULL,
	`observations` text NOT NULL,
	`image_quality` text NOT NULL,
	`confidence` real NOT NULL,
	`model_version_id` text,
	`source_bbox_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `inspection_images`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`model_version_id`) REFERENCES `model_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `panel_results_inspection_idx` ON `panel_results` (`inspection_id`);--> statement-breakpoint
CREATE INDEX `panel_results_module_idx` ON `panel_results` (`module_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`executive_summary` text NOT NULL,
	`severity_counts_json` text NOT NULL,
	`top_risks_json` text NOT NULL,
	`recommendations_json` text NOT NULL,
	`fleet_health_score` integer NOT NULL,
	`fleet_eff_loss_pct` real NOT NULL,
	`model_version_id` text,
	`locale` text DEFAULT 'en' NOT NULL,
	`persona` text DEFAULT 'default' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_version_id`) REFERENCES `model_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reports_inspection_idx` ON `reports` (`inspection_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`inspection_id` text,
	`payload_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `shares_org_idx` ON `shares` (`org_id`);--> statement-breakpoint
CREATE INDEX `shares_expires_idx` ON `shares` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`lat` real,
	`lon` real,
	`capacity_kw` real,
	`country` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sites_org_idx` ON `sites` (`org_id`);--> statement-breakpoint
CREATE TABLE `strings` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`name` text NOT NULL,
	`panel_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `strings_site_idx` ON `strings` (`site_id`);--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`user_id` text,
	`kind` text NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`model_version_id` text,
	`request_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`model_version_id`) REFERENCES `model_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `usage_events_org_idx` ON `usage_events` (`org_id`);--> statement-breakpoint
CREATE INDEX `usage_events_user_idx` ON `usage_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `usage_events_created_idx` ON `usage_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`email_verified` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`sub_id` text NOT NULL,
	`event` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text NOT NULL,
	`response_code` integer,
	`attempted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sub_id`) REFERENCES `webhook_subs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_sub_idx` ON `webhook_deliveries` (`sub_id`);--> statement-breakpoint
CREATE TABLE `webhook_subs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`event_types` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_subs_org_idx` ON `webhook_subs` (`org_id`);
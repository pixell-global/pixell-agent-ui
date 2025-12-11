CREATE TABLE `action_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`app_id` varchar(80),
	`action_key` varchar(120) NOT NULL,
	`units` int NOT NULL DEFAULT 1,
	`idempotency_key` varchar(120),
	`metadata` json,
	`brand_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `action_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`primary_team_id` char(36),
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_invitations` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`token` varchar(255) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `org_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `org_settings` (
	`org_id` char(36) NOT NULL,
	`brand_access_mode` enum('shared','isolated') NOT NULL DEFAULT 'shared',
	`require_brand_context` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_settings_org_id` PRIMARY KEY(`org_id`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`role` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'owner',
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `organization_members_org_id_user_id_pk` PRIMARY KEY(`org_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` char(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`created_by` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_brand_access` (
	`team_id` char(36) NOT NULL,
	`brand_id` char(36) NOT NULL,
	`role` enum('manager','editor','analyst','viewer') NOT NULL DEFAULT 'viewer',
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `team_brand_access_team_id_brand_id_pk` PRIMARY KEY(`team_id`,`brand_id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`role` enum('lead','member','viewer') NOT NULL DEFAULT 'member',
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `team_members_team_id_user_id_pk` PRIMARY KEY(`team_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_brand_access` (
	`brand_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`role` enum('manager','editor','analyst','viewer') NOT NULL DEFAULT 'viewer',
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `user_brand_access_brand_id_user_id_pk` PRIMARY KEY(`brand_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`display_name` varchar(120),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`is_deleted` int NOT NULL DEFAULT 0,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `idx_usage_org_created` ON `action_events` (`org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_usage_brand_created` ON `action_events` (`brand_id`,`created_at`);
CREATE TABLE `activities` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`conversation_id` char(36),
	`agent_id` varchar(255),
	`name` varchar(255) NOT NULL,
	`description` text,
	`activity_type` enum('task','scheduled','workflow') NOT NULL DEFAULT 'task',
	`activity_status` enum('pending','running','paused','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`progress_message` varchar(500),
	`schedule_cron` varchar(100),
	`schedule_next_run` timestamp,
	`schedule_last_run` timestamp,
	`schedule_timezone` varchar(50) DEFAULT 'UTC',
	`started_at` timestamp,
	`completed_at` timestamp,
	`estimated_duration_ms` int,
	`actual_duration_ms` int,
	`result` json,
	`error_message` text,
	`error_code` varchar(50),
	`metadata` json,
	`tags` json,
	`priority` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archived_at` timestamp,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_approval_requests` (
	`id` char(36) NOT NULL,
	`activity_id` char(36) NOT NULL,
	`approval_request_type` enum('permission','confirmation','input') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`required_scopes` json,
	`options` json,
	`approval_request_status` enum('pending','approved','denied','expired') NOT NULL DEFAULT 'pending',
	`responded_at` timestamp,
	`response` json,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_steps` (
	`id` char(36) NOT NULL,
	`activity_id` char(36) NOT NULL,
	`step_order` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`activity_step_status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`started_at` timestamp,
	`completed_at` timestamp,
	`result` json,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billable_actions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`action_tier` enum('small','medium','large','xl') NOT NULL,
	`credits_used` decimal(10,2) NOT NULL,
	`agent_id` varchar(255),
	`agent_name` varchar(255),
	`action_key` varchar(120),
	`description` text,
	`metadata` json,
	`billing_period_start` timestamp NOT NULL,
	`billing_period_end` timestamp NOT NULL,
	`idempotency_key` varchar(120),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billable_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` char(36) NOT NULL,
	`conversation_id` char(36) NOT NULL,
	`conversation_message_role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`title` varchar(255),
	`title_source` enum('auto','user') DEFAULT 'auto',
	`is_public` boolean NOT NULL DEFAULT true,
	`message_count` int NOT NULL DEFAULT 0,
	`last_message_at` timestamp,
	`last_message_preview` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_balances` (
	`org_id` char(36) NOT NULL,
	`billing_period_start` timestamp NOT NULL,
	`billing_period_end` timestamp NOT NULL,
	`included_small` int NOT NULL DEFAULT 0,
	`included_medium` int NOT NULL DEFAULT 0,
	`included_large` int NOT NULL DEFAULT 0,
	`included_xl` int NOT NULL DEFAULT 0,
	`used_small` int NOT NULL DEFAULT 0,
	`used_medium` int NOT NULL DEFAULT 0,
	`used_large` int NOT NULL DEFAULT 0,
	`used_xl` int NOT NULL DEFAULT 0,
	`topup_credits` decimal(10,2) NOT NULL DEFAULT '0',
	`topup_credits_used` decimal(10,2) NOT NULL DEFAULT '0',
	`auto_topup_enabled` boolean DEFAULT false,
	`auto_topup_threshold` int NOT NULL DEFAULT 50,
	`auto_topup_amount` int NOT NULL DEFAULT 500,
	`last_warning_80_at` timestamp,
	`last_warning_100_at` timestamp,
	`last_reset_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_balances_org_id` PRIMARY KEY(`org_id`)
);
--> statement-breakpoint
CREATE TABLE `credit_purchases` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`stripe_payment_intent_id` varchar(120),
	`stripe_invoice_id` varchar(120),
	`credits_amount` int NOT NULL,
	`amount_paid` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'usd',
	`purchase_type` enum('manual','auto_topup') NOT NULL,
	`status` enum('pending','succeeded','failed','canceled') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `credit_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_accounts` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`oauth_provider` enum('tiktok','instagram','google','reddit') NOT NULL,
	`provider_account_id` varchar(255) NOT NULL,
	`provider_username` varchar(255),
	`display_name` varchar(255),
	`avatar_url` text,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text,
	`token_expires_at` timestamp,
	`scopes` json,
	`is_default` boolean DEFAULT false,
	`auto_approve` boolean DEFAULT false,
	`is_active` boolean DEFAULT true,
	`last_used_at` timestamp,
	`last_error_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_provider_account` UNIQUE(`org_id`,`oauth_provider`,`provider_account_id`)
);
--> statement-breakpoint
CREATE TABLE `hidden_conversations` (
	`user_id` varchar(128) NOT NULL,
	`conversation_id` char(36) NOT NULL,
	`hidden_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hidden_conversations_user_id_conversation_id_pk` PRIMARY KEY(`user_id`,`conversation_id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`stripe_invoice_id` varchar(120) NOT NULL,
	`stripe_subscription_id` varchar(120),
	`amount_due` decimal(10,2) NOT NULL,
	`amount_paid` decimal(10,2) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'usd',
	`status` enum('draft','open','paid','void','uncollectible') NOT NULL,
	`invoice_type` enum('subscription','credit_purchase') NOT NULL,
	`hosted_invoice_url` text,
	`invoice_pdf` text,
	`period_start` timestamp,
	`period_end` timestamp,
	`due_date` timestamp,
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_stripe_invoice_id_unique` UNIQUE(`stripe_invoice_id`)
);
--> statement-breakpoint
CREATE TABLE `pending_action_items` (
	`id` char(36) NOT NULL,
	`pending_action_id` char(36) NOT NULL,
	`item_index` int NOT NULL,
	`payload` json NOT NULL,
	`preview_text` text,
	`is_edited` boolean DEFAULT false,
	`edited_payload` json,
	`pending_action_item_status` enum('pending','approved','rejected','executed','failed') NOT NULL DEFAULT 'pending',
	`executed_at` timestamp,
	`result` json,
	`error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pending_action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pending_actions` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`conversation_id` char(36),
	`external_account_id` char(36),
	`oauth_provider` enum('tiktok','instagram','google','reddit') NOT NULL,
	`action_type` varchar(50) NOT NULL,
	`action_description` text,
	`items` json NOT NULL,
	`item_count` int NOT NULL,
	`pending_action_status` enum('pending','approved','rejected','executing','completed','partial','failed','expired') NOT NULL DEFAULT 'pending',
	`items_approved` int DEFAULT 0,
	`items_rejected` int DEFAULT 0,
	`items_executed` int DEFAULT 0,
	`items_failed` int DEFAULT 0,
	`expires_at` timestamp,
	`reviewed_at` timestamp,
	`execution_started_at` timestamp,
	`execution_completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pending_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` char(36) NOT NULL,
	`org_id` char(36) NOT NULL,
	`stripe_subscription_id` varchar(120),
	`stripe_price_id` varchar(120),
	`stripe_customer_id` varchar(120),
	`plan_tier` enum('free','starter','pro','max') NOT NULL DEFAULT 'free',
	`status` enum('active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid') NOT NULL DEFAULT 'incomplete',
	`current_period_start` timestamp,
	`current_period_end` timestamp,
	`trial_end` timestamp,
	`cancel_at_period_end` boolean DEFAULT false,
	`canceled_at` timestamp,
	`ended_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_stripe_subscription_id_unique` UNIQUE(`stripe_subscription_id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`stripe_event_id` varchar(120) NOT NULL,
	`event_type` varchar(120) NOT NULL,
	`payload` json NOT NULL,
	`processed_at` timestamp,
	`status` enum('pending','processed','failed') NOT NULL DEFAULT 'pending',
	`error` text,
	`retry_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_stripe_event_id_unique` UNIQUE(`stripe_event_id`),
	CONSTRAINT `idx_webhook_events_stripe_id` UNIQUE(`stripe_event_id`)
);
--> statement-breakpoint
ALTER TABLE `brands` DROP INDEX `brands_code_unique`;--> statement-breakpoint
ALTER TABLE `action_events` ADD `billable_action_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `organizations` ADD `stripe_customer_id` varchar(120);--> statement-breakpoint
ALTER TABLE `organizations` ADD `subscription_status` enum('active','trialing','past_due','incomplete','canceled') DEFAULT 'incomplete' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `subscription_tier` enum('free','starter','pro','max') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `trial_ends_at` timestamp;--> statement-breakpoint
ALTER TABLE `organizations` ADD `last_billing_warning_at` timestamp;--> statement-breakpoint
ALTER TABLE `brands` ADD CONSTRAINT `brands_org_name_unique` UNIQUE(`org_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_activities_org_status` ON `activities` (`org_id`,`activity_status`);--> statement-breakpoint
CREATE INDEX `idx_activities_org_created` ON `activities` (`org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activities_schedule_next_run` ON `activities` (`schedule_next_run`);--> statement-breakpoint
CREATE INDEX `idx_activities_conversation` ON `activities` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_user` ON `activities` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_archived` ON `activities` (`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_activity` ON `activity_approval_requests` (`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_status` ON `activity_approval_requests` (`approval_request_status`);--> statement-breakpoint
CREATE INDEX `idx_approval_requests_expires` ON `activity_approval_requests` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_steps_activity` ON `activity_steps` (`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_steps_order` ON `activity_steps` (`activity_id`,`step_order`);--> statement-breakpoint
CREATE INDEX `idx_billable_org_period` ON `billable_actions` (`org_id`,`billing_period_start`,`billing_period_end`);--> statement-breakpoint
CREATE INDEX `idx_billable_org_created` ON `billable_actions` (`org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_billable_org_user` ON `billable_actions` (`org_id`,`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_billable_tier` ON `billable_actions` (`action_tier`);--> statement-breakpoint
CREATE INDEX `idx_billable_idempotency` ON `billable_actions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_billable_user` ON `billable_actions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_conv_messages_conversation` ON `conversation_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_conversations_org_user` ON `conversations` (`org_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_org_public` ON `conversations` (`org_id`,`is_public`);--> statement-breakpoint
CREATE INDEX `idx_conversations_last_msg` ON `conversations` (`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_conversations_deleted` ON `conversations` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_credit_purchases_org` ON `credit_purchases` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_purchases_stripe_pi` ON `credit_purchases` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_purchases_status` ON `credit_purchases` (`status`);--> statement-breakpoint
CREATE INDEX `idx_credit_purchases_created` ON `credit_purchases` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_external_accounts_org_provider` ON `external_accounts` (`org_id`,`oauth_provider`);--> statement-breakpoint
CREATE INDEX `idx_external_accounts_user` ON `external_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_hidden_conversations_user` ON `hidden_conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_invoices_org` ON `invoices` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_invoices_stripe` ON `invoices` (`stripe_invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_invoices_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `idx_invoices_created` ON `invoices` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_pending_action_items_action` ON `pending_action_items` (`pending_action_id`);--> statement-breakpoint
CREATE INDEX `idx_pending_action_items_status` ON `pending_action_items` (`pending_action_id`,`pending_action_item_status`);--> statement-breakpoint
CREATE INDEX `idx_pending_actions_org_status` ON `pending_actions` (`org_id`,`pending_action_status`);--> statement-breakpoint
CREATE INDEX `idx_pending_actions_conversation` ON `pending_actions` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_pending_actions_expires` ON `pending_actions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_pending_actions_external_account` ON `pending_actions` (`external_account_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_org` ON `subscriptions` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_stripe` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_tier` ON `subscriptions` (`plan_tier`);--> statement-breakpoint
CREATE INDEX `idx_webhook_events_type` ON `webhook_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `idx_webhook_events_status` ON `webhook_events` (`status`);--> statement-breakpoint
CREATE INDEX `idx_webhook_events_created` ON `webhook_events` (`created_at`);--> statement-breakpoint
ALTER TABLE `brands` DROP COLUMN `code`;
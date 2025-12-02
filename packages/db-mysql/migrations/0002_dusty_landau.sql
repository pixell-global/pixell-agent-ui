CREATE TABLE `waitlist` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`source` varchar(100),
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_waitlist_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `idx_waitlist_created_at` ON `waitlist` (`created_at`);
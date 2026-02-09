CREATE TABLE `admin_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`usedBy` int,
	`usedAt` timestamp,
	`expiresAt` timestamp,
	`status` enum('active','used','expired','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_invites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `workers` ADD `school` varchar(200);--> statement-breakpoint
ALTER TABLE `workers` ADD `hasWorkPermit` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workers` ADD `hasHealthCheck` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_invites` ADD CONSTRAINT `admin_invites_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_invites` ADD CONSTRAINT `admin_invites_usedBy_users_id_fk` FOREIGN KEY (`usedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
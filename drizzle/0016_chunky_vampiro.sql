CREATE TABLE `payroll_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`totalAmount` int,
	`totalHours` int,
	`assignmentCount` int,
	`settledBy` int,
	`settledAt` timestamp NOT NULL DEFAULT (now()),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payroll_settlements` ADD CONSTRAINT `payroll_settlements_workerId_workers_id_fk` FOREIGN KEY (`workerId`) REFERENCES `workers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_settlements` ADD CONSTRAINT `payroll_settlements_settledBy_users_id_fk` FOREIGN KEY (`settledBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
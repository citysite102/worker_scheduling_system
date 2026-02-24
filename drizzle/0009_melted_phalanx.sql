CREATE TABLE `demandTypeOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`demandTypeId` int NOT NULL,
	`content` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demandTypeOptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `demandTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demandTypes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `demands` ADD `demandTypeId` int;--> statement-breakpoint
ALTER TABLE `demands` ADD `selectedOptions` text;--> statement-breakpoint
ALTER TABLE `demandTypeOptions` ADD CONSTRAINT `demandTypeOptions_demandTypeId_demandTypes_id_fk` FOREIGN KEY (`demandTypeId`) REFERENCES `demandTypes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `demands` ADD CONSTRAINT `demands_demandTypeId_demandTypes_id_fk` FOREIGN KEY (`demandTypeId`) REFERENCES `demandTypes`(`id`) ON DELETE no action ON UPDATE no action;
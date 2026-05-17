CREATE TABLE `jobCategoryOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobCategoryId` int NOT NULL,
	`content` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobCategoryOptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `demandTypes` ADD `requiredJobCategoryId` int;--> statement-breakpoint
ALTER TABLE `demands` ADD `jobCategoryId` int;--> statement-breakpoint
ALTER TABLE `jobCategoryOptions` ADD CONSTRAINT `jobCategoryOptions_jobCategoryId_jobCategories_id_fk` FOREIGN KEY (`jobCategoryId`) REFERENCES `jobCategories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `demands` ADD CONSTRAINT `demands_jobCategoryId_jobCategories_id_fk` FOREIGN KEY (`jobCategoryId`) REFERENCES `jobCategories`(`id`) ON DELETE no action ON UPDATE no action;
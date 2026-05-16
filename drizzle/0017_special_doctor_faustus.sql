CREATE TABLE `jobCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(20) NOT NULL DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workerJobCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerId` int NOT NULL,
	`jobCategoryId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workerJobCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `workerJobCategories` ADD CONSTRAINT `workerJobCategories_workerId_workers_id_fk` FOREIGN KEY (`workerId`) REFERENCES `workers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workerJobCategories` ADD CONSTRAINT `workerJobCategories_jobCategoryId_jobCategories_id_fk` FOREIGN KEY (`jobCategoryId`) REFERENCES `jobCategories`(`id`) ON DELETE no action ON UPDATE no action;
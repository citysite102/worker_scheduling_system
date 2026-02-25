ALTER TABLE `demands` MODIFY COLUMN `status` enum('draft','pending','confirmed','assigned','completed','cancelled','closed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','client') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `demands` ADD `createdBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `clientId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `position` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(50);
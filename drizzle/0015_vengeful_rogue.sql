ALTER TABLE `assignments` ADD `payType` enum('hourly','unit','fixed') DEFAULT 'hourly';--> statement-breakpoint
ALTER TABLE `assignments` ADD `unitCount` int;--> statement-breakpoint
ALTER TABLE `assignments` ADD `unitType` varchar(50);--> statement-breakpoint
ALTER TABLE `assignments` ADD `payRate` int;--> statement-breakpoint
ALTER TABLE `assignments` ADD `payAmount` int;
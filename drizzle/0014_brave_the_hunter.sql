ALTER TABLE `assignments` ADD `role` enum('regular','intern') DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);
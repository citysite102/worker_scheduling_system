ALTER TABLE `clients` ADD `clientCode` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_clientCode_unique` UNIQUE(`clientCode`);
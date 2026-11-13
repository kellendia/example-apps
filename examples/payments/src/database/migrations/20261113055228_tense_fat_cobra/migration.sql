CREATE TABLE `webhook_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`event_type` text,
	`transaction_id` text,
	`signature_valid` integer NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`error` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);

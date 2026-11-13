CREATE TABLE `bill_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`biller_type` text,
	`reference` text NOT NULL UNIQUE,
	`transaction_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount` integer,
	`request_payload` text,
	`response_payload` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);

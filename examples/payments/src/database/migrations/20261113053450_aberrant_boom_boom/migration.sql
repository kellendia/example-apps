CREATE TABLE `checkout_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`reference` text NOT NULL UNIQUE,
	`transaction_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount` integer,
	`request_payload` text,
	`response_payload` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `direct_debit_debits` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`mandate_id` text NOT NULL,
	`amount` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`response_payload` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `direct_debit_mandates` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`reference` text NOT NULL UNIQUE,
	`mandate_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount` integer,
	`request_payload` text,
	`response_payload` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`token_key` text NOT NULL UNIQUE,
	`customer_email` text,
	`response_payload` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `virtual_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`reference` text NOT NULL UNIQUE,
	`status` text DEFAULT 'active' NOT NULL,
	`request_payload` text,
	`response_payload` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);

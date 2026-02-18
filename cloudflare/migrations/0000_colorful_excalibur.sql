CREATE TABLE `http_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status_code` integer NOT NULL,
	`domain` text NOT NULL,
	`timestamp` text DEFAULT (datetime('now')) NOT NULL,
	`duration_ms` integer,
	`request_headers` text,
	`response_headers` text,
	`body_size` integer
);

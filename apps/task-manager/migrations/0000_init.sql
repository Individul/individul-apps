CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_name` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`finished_at` text,
	`ok` integer DEFAULT false NOT NULL,
	`tables_count` integer DEFAULT 0 NOT NULL,
	`rows_count` integer DEFAULT 0 NOT NULL,
	`files_uploaded` integer DEFAULT 0 NOT NULL,
	`files_pending` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `backup_runs_started_idx` ON `backup_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_task_idx` ON `comments` (`task_id`);--> statement-breakpoint
CREATE TABLE `contraveners` (
	`id` text PRIMARY KEY NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`patronymic` text,
	`decision_date` text NOT NULL,
	`final_date` text,
	`arrest_days` integer NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`executed_on` text,
	`informed_at` text,
	`informed_by` text,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`informed_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "contraveners_last_name_check" CHECK(length(trim(last_name)) > 0),
	CONSTRAINT "contraveners_first_name_check" CHECK(length(trim(first_name)) > 0),
	CONSTRAINT "contraveners_arrest_days_check" CHECK(arrest_days > 0),
	CONSTRAINT "contraveners_final_after_decision" CHECK(final_date is null or final_date >= decision_date),
	CONSTRAINT "contraveners_executed_after_decision" CHECK(executed_on is null or executed_on >= decision_date)
);
--> statement-breakpoint
CREATE INDEX `contraveners_decision_idx` ON `contraveners` (`decision_date`);--> statement-breakpoint
CREATE TABLE `defendants` (
	`id` text PRIMARY KEY NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`regime` text NOT NULL,
	`established_on` text NOT NULL,
	`court` text,
	`case_number` text,
	`status` text DEFAULT 'inculpat' NOT NULL,
	`convicted_on` text,
	`note` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`preventive_measure` integer DEFAULT false NOT NULL,
	`preventive_measure_on` text,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "defendants_last_name_check" CHECK(length(trim(last_name)) > 0),
	CONSTRAINT "defendants_first_name_check" CHECK(length(trim(first_name)) > 0),
	CONSTRAINT "defendants_regime_check" CHECK(regime in ('inchis', 'semiinchis')),
	CONSTRAINT "defendants_status_check" CHECK(status in ('inculpat', 'condamnat')),
	CONSTRAINT "defendants_status_date" CHECK((status = 'inculpat' and convicted_on is null) or (status = 'condamnat' and convicted_on is not null)),
	CONSTRAINT "defendants_preventive" CHECK(preventive_measure or preventive_measure_on is null)
);
--> statement-breakpoint
CREATE INDEX `defendants_status_idx` ON `defendants` (`status`,`last_name`);--> statement-breakpoint
CREATE TABLE `hearings` (
	`id` text PRIMARY KEY NOT NULL,
	`session_date` text NOT NULL,
	`tc_petrecute` integer DEFAULT 0 NOT NULL,
	`tc_amanate` integer DEFAULT 0 NOT NULL,
	`ij_petrecute` integer DEFAULT 0 NOT NULL,
	`ij_amanate` integer DEFAULT 0 NOT NULL,
	`tc_total` integer GENERATED ALWAYS AS (tc_petrecute + tc_amanate) STORED,
	`ij_total` integer GENERATED ALWAYS AS (ij_petrecute + ij_amanate) STORED,
	`total_general` integer GENERATED ALWAYS AS (tc_petrecute + tc_amanate + ij_petrecute + ij_amanate) STORED,
	`note` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "hearings_counts_check" CHECK(tc_petrecute >= 0 and tc_amanate >= 0 and ij_petrecute >= 0 and ij_amanate >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hearings_session_date_unique` ON `hearings` (`session_date`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`task_id` text,
	`actor_id` text,
	`actor_name` text,
	`message` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`petition_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`petition_id`) REFERENCES `petitions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "notifications_type_check" CHECK(type in ('assigned', 'comment', 'status', 'edited', 'deleted', 'created'))
);
--> statement-breakpoint
CREATE INDEX `notifications_user_unread_idx` ON `notifications` (`user_id`,`read`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_petition_idx` ON `notifications` (`petition_id`);--> statement-breakpoint
CREATE TABLE `obligation_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`obligation_id` text NOT NULL,
	`due_date` text NOT NULL,
	`completed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`completed_by` text,
	`note` text,
	FOREIGN KEY (`obligation_id`) REFERENCES `obligations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `obligation_completions_unique` ON `obligation_completions` (`obligation_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `obligations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`recipient` text DEFAULT 'ANP' NOT NULL,
	`kind` text NOT NULL,
	`day_of_month` integer,
	`weekday` integer,
	`assignee_id` text,
	`active` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`starts_on` text DEFAULT (date('now')) NOT NULL,
	FOREIGN KEY (`assignee_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "obligations_title_check" CHECK(length(trim(title)) > 0),
	CONSTRAINT "obligations_kind_check" CHECK(kind in ('lunar_zi', 'lunar_ultima_zi', 'saptamanal')),
	CONSTRAINT "obligations_day_check" CHECK(day_of_month is null or day_of_month between 1 and 31),
	CONSTRAINT "obligations_weekday_check" CHECK(weekday is null or weekday between 0 and 6),
	CONSTRAINT "obligations_kind_fields" CHECK((kind = 'lunar_zi' and day_of_month is not null and weekday is null)
        or (kind = 'lunar_ultima_zi' and day_of_month is null and weekday is null)
        or (kind = 'saptamanal' and weekday is not null and day_of_month is null))
);
--> statement-breakpoint
CREATE TABLE `petition_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`petition_id` text NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`mime` text,
	`size` integer,
	`uploaded_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`petition_id`) REFERENCES `petitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "petition_attachments_kind_check" CHECK(kind in ('petitie', 'raspuns'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `petition_attachments_path_unique` ON `petition_attachments` (`path`);--> statement-breakpoint
CREATE INDEX `petition_attachments_petition_idx` ON `petition_attachments` (`petition_id`);--> statement-breakpoint
CREATE TABLE `petitions` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`petitioner` text NOT NULL,
	`petitioner_type` text DEFAULT 'detinut' NOT NULL,
	`subject` text,
	`received_date` text DEFAULT (date('now')) NOT NULL,
	`response_deadline` text GENERATED ALWAYS AS (date(received_date, '+27 days')) STORED,
	`status` text DEFAULT 'in_examinare' NOT NULL,
	`response` text,
	`response_date` text,
	`assignee_id` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`assignee_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "petitions_petitioner_type_check" CHECK(petitioner_type in ('detinut', 'avocat', 'civil')),
	CONSTRAINT "petitions_status_check" CHECK(status in ('in_examinare', 'solutionat'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `petitions_number_unique` ON `petitions` (`number`);--> statement-breakpoint
CREATE INDEX `petitions_deadline_idx` ON `petitions` (`response_deadline`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text,
	`avatar_url` text,
	`role` text DEFAULT 'member',
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`username` text,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profiles_role_check" CHECK(role in ('admin', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_lower_idx` ON `profiles` (lower(username)) WHERE username is not null;--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`release_date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "releases_count_check" CHECK(count >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `releases_release_date_unique` ON `releases` (`release_date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`done_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subtasks_task_idx` ON `subtasks` (`task_id`,`position`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#64748b' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_tags_tag_idx` ON `task_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`assignee_id` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`waiting_since` text,
	`completed_at` text,
	`appealed_csj` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`assignee_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasks_status_check" CHECK(status in ('todo', 'in_progress', 'waiting', 'done')),
	CONSTRAINT "tasks_priority_check" CHECK(priority in ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assignee_id`);--> statement-breakpoint
CREATE TABLE `transfer_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`court` text,
	`institution` integer NOT NULL,
	`hearing_date` text,
	`done` integer DEFAULT false NOT NULL,
	`note` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`basis` text DEFAULT 'sedinta' NOT NULL,
	`decision_date` text,
	`notified_at` text,
	`notified_by` text,
	`notified_hearing_date` text,
	`ruling_date` text,
	`term_start` text,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`notified_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transfer_plans_last_name_check" CHECK(length(trim(last_name)) > 0),
	CONSTRAINT "transfer_plans_first_name_check" CHECK(length(trim(first_name)) > 0),
	CONSTRAINT "transfer_plans_court_check" CHECK(court is null or length(trim(court)) > 0),
	CONSTRAINT "transfer_plans_institution_check" CHECK(institution between 1 and 18 and institution not in (6, 14)),
	CONSTRAINT "transfer_plans_basis_check" CHECK(basis in ('sedinta', 'decizie', 'termen30')),
	CONSTRAINT "transfer_plans_temei" CHECK((basis = 'sedinta' and hearing_date is not null and decision_date is null and ruling_date is null and court is not null)
        or (basis = 'decizie' and decision_date is not null and hearing_date is null and ruling_date is null)
        or (basis = 'termen30' and ruling_date is not null and term_start is not null and hearing_date is null and decision_date is null and court is not null)),
	CONSTRAINT "transfer_plans_instiintare" CHECK((notified_at is null and notified_hearing_date is null) or (notified_at is not null and notified_hearing_date is not null)),
	CONSTRAINT "transfer_plans_ruling_before_start" CHECK(ruling_date is null or term_start is null or ruling_date <= term_start)
);
--> statement-breakpoint
CREATE INDEX `transfer_plans_hearing_idx` ON `transfer_plans` (`hearing_date`) WHERE done = 0;--> statement-breakpoint
CREATE INDEX `transfer_plans_decision_idx` ON `transfer_plans` (`decision_date`) WHERE done = 0;--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_date` text NOT NULL,
	`institution` integer NOT NULL,
	`kind` text DEFAULT 'planificat' NOT NULL,
	`plecati` integer DEFAULT 0 NOT NULL,
	`sositi` integer DEFAULT 0 NOT NULL,
	`total` integer GENERATED ALWAYS AS (plecati + sositi) STORED,
	`note` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transfers_institution_check" CHECK(institution between 1 and 18 and institution not in (6, 14)),
	CONSTRAINT "transfers_kind_check" CHECK(kind in ('planificat', 'urgent')),
	CONSTRAINT "transfers_counts_check" CHECK(plecati >= 0 and sositi >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfers_day_unique` ON `transfers` (`transfer_date`,`institution`,`kind`);--> statement-breakpoint
CREATE INDEX `transfers_date_idx` ON `transfers` (`transfer_date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `google_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `access_token` TEXT NULL,
    `refresh_token` TEXT NULL,
    `token_expiry` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_google_id_key`(`google_id`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sender_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `smtp_host` VARCHAR(191) NOT NULL,
    `smtp_port` INTEGER NOT NULL,
    `smtp_user` VARCHAR(191) NOT NULL,
    `smtp_pass` TEXT NOT NULL,
    `daily_limit` INTEGER NOT NULL DEFAULT 100,
    `sent_today` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sender_accounts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `sender_account_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    `scheduled_at` DATETIME(3) NULL,
    `total_recipients` INTEGER NOT NULL DEFAULT 0,
    `sent_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `campaigns_user_id_idx`(`user_id`),
    INDEX `campaigns_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_messages` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `sender_account_id` VARCHAR(191) NOT NULL,
    `recipient_email` VARCHAR(191) NOT NULL,
    `recipient_name` VARCHAR(191) NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('SCHEDULED', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'SCHEDULED',
    `scheduled_at` DATETIME(3) NOT NULL,
    `hourly_limit` INTEGER NOT NULL DEFAULT 200,
    `sent_at` DATETIME(3) NULL,
    `message_id` VARCHAR(255) NULL,
    `preview_url` TEXT NULL,
    `failed_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_messages_status_scheduled_at_idx`(`status`, `scheduled_at`),
    INDEX `email_messages_campaign_id_idx`(`campaign_id`),
    INDEX `email_messages_sender_account_id_idx`(`sender_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `slack_connections` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `team_id` VARCHAR(191) NOT NULL,
    `team_name` VARCHAR(191) NULL,
    `channel_id` VARCHAR(191) NULL,
    `channel_name` VARCHAR(191) NULL,
    `webhook_url` TEXT NULL,
    `access_token` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `slack_connections_user_id_idx`(`user_id`),
    UNIQUE INDEX `slack_connections_user_id_team_id_key`(`user_id`, `team_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sender_accounts` ADD CONSTRAINT `sender_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_sender_account_id_fkey` FOREIGN KEY (`sender_account_id`) REFERENCES `sender_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_messages` ADD CONSTRAINT `email_messages_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_messages` ADD CONSTRAINT `email_messages_sender_account_id_fkey` FOREIGN KEY (`sender_account_id`) REFERENCES `sender_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `slack_connections` ADD CONSTRAINT `slack_connections_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
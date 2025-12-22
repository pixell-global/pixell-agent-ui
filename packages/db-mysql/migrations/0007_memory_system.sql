-- Memory System Migration
-- Two-tier memory architecture for AI personalization

-- Main memories table
CREATE TABLE IF NOT EXISTS `memories` (
  `id` char(36) NOT NULL,
  `org_id` char(36) NOT NULL,
  `user_id` varchar(128) NOT NULL,
  `agent_id` varchar(255) DEFAULT NULL,
  `memory_category` enum('user_preference','project_context','domain_knowledge','conversation_goal','entity') NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `confidence` decimal(3,2) NOT NULL DEFAULT '1.00',
  `memory_source` enum('auto_extracted','user_provided','user_edited') NOT NULL DEFAULT 'auto_extracted',
  `source_conversation_id` char(36) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `usage_count` int NOT NULL DEFAULT '0',
  `last_used_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_memory` (`org_id`,`user_id`,`agent_id`,`key`),
  KEY `idx_memories_org_user` (`org_id`,`user_id`),
  KEY `idx_memories_org_user_agent` (`org_id`,`user_id`,`agent_id`),
  KEY `idx_memories_category` (`memory_category`),
  KEY `idx_memories_key` (`key`),
  KEY `idx_memories_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Memory extraction jobs table (background processing)
CREATE TABLE IF NOT EXISTS `memory_extraction_jobs` (
  `id` char(36) NOT NULL,
  `org_id` char(36) NOT NULL,
  `user_id` varchar(128) NOT NULL,
  `conversation_id` char(36) NOT NULL,
  `memory_extraction_status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `memories_extracted` int NOT NULL DEFAULT '0',
  `memories_updated` int NOT NULL DEFAULT '0',
  `error` text DEFAULT NULL,
  `retry_count` int NOT NULL DEFAULT '0',
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_extraction_jobs_status` (`memory_extraction_status`),
  KEY `idx_extraction_jobs_conversation` (`conversation_id`),
  KEY `idx_extraction_jobs_created` (`created_at`),
  KEY `idx_extraction_jobs_org_user` (`org_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User memory settings table
CREATE TABLE IF NOT EXISTS `user_memory_settings` (
  `user_id` varchar(128) NOT NULL,
  `memory_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `auto_extraction_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `incognito_mode` tinyint(1) NOT NULL DEFAULT '0',
  `extraction_categories` json DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `canvas_templates` (
  `template_id` int NOT NULL AUTO_INCREMENT,
  `template_key` varchar(120) NOT NULL,
  `template_name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `category` varchar(30) NOT NULL DEFAULT 'general',
  `template_data` json NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`),
  UNIQUE KEY `uq_canvas_templates_key` (`template_key`),
  KEY `idx_canvas_templates_active` (`is_active`),
  KEY `idx_canvas_templates_created_by` (`created_by`),
  CONSTRAINT `fk_canvas_templates_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

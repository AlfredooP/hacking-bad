-- Refresh tokens for JWT auth
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(512) NOT NULL,
  `user_id` INT NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `refresh_tokens_token_key` (`token`),
  INDEX `refresh_tokens_user_id_idx` (`user_id`),
  CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Deduplicate ResultadosIA: keep latest row per container, then add unique constraint
DELETE r1 FROM `ResultadosIA` r1
INNER JOIN `ResultadosIA` r2
  ON r1.id_contenedor = r2.id_contenedor AND r1.id < r2.id;

-- Add unique constraint if not exists (idempotent for fresh DBs)
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'ResultadosIA'
    AND index_name = 'uq_resultado_ia_contenedor'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE `ResultadosIA` ADD UNIQUE INDEX `uq_resultado_ia_contenedor` (`id_contenedor`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

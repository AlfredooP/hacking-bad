-- Evolución: contenedores inteligentes, inferencia de residuo y alertas

ALTER TABLE `Contenedores`
  ADD COLUMN `nombre` VARCHAR(100) NULL AFTER `id_contenedor`,
  ADD COLUMN `zona` VARCHAR(50) NULL AFTER `ubicacion`,
  ADD COLUMN `capacidad_max` FLOAT NULL AFTER `capacidad`,
  ADD COLUMN `estado_operativo` VARCHAR(20) NULL DEFAULT 'Activo' AFTER `estado`,
  ADD COLUMN `tipos_residuos_permitidos` VARCHAR(255) NULL AFTER `tipo_residuo`,
  ADD COLUMN `prioridad_configurada` ENUM('alta', 'media', 'baja') NULL AFTER `tipos_residuos_permitidos`;

ALTER TABLE `LecturasSensores`
  ADD COLUMN `densidad` FLOAT NULL AFTER `humedad`;

ALTER TABLE `ResultadosIA`
  ADD COLUMN `densidad` FLOAT NULL AFTER `humedad`,
  ADD COLUMN `tipo_residuo_inferido` VARCHAR(50) NULL AFTER `peso_kg`,
  ADD COLUMN `confianza_inferencia` FLOAT NULL AFTER `tipo_residuo_inferido`,
  ADD COLUMN `contaminacion_detectada` TINYINT(1) NOT NULL DEFAULT 0 AFTER `confianza_inferencia`,
  ADD COLUMN `mensaje_contaminacion` VARCHAR(255) NULL AFTER `contaminacion_detectada`;

CREATE TABLE IF NOT EXISTS `AlertasContaminacion` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_contenedor` INT NOT NULL,
  `tipo_esperado` VARCHAR(50) NULL,
  `tipo_inferido` VARCHAR(50) NULL,
  `mensaje` VARCHAR(255) NULL,
  `resuelta` TINYINT(1) NOT NULL DEFAULT 0,
  `fecha_deteccion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_alerta_contenedor` (`id_contenedor`, `fecha_deteccion` DESC),
  CONSTRAINT `AlertasContaminacion_ibfk_1` FOREIGN KEY (`id_contenedor`) REFERENCES `Contenedores` (`id_contenedor`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrar datos existentes
UPDATE `Contenedores` SET
  `nombre` = COALESCE(`nombre`, `ubicacion`),
  `capacidad_max` = COALESCE(`capacidad_max`, CAST(REGEXP_SUBSTR(`capacidad`, '[0-9]+') AS UNSIGNED)),
  `estado_operativo` = COALESCE(`estado_operativo`, 'Activo'),
  `tipos_residuos_permitidos` = COALESCE(`tipos_residuos_permitidos`, `tipo_residuo`)
WHERE `id_contenedor` IN (1, 2, 3);

UPDATE `Contenedores` SET `zona` = 'Campus Norte' WHERE `id_contenedor` = 1;
UPDATE `Contenedores` SET `zona` = 'Campus Central' WHERE `id_contenedor` = 2;
UPDATE `Contenedores` SET `zona` = 'Campus Central' WHERE `id_contenedor` = 3;

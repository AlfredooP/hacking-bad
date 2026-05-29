USE bin_db;

-- Contenedores.tipo_residuo
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Contenedores'
    AND column_name = 'tipo_residuo'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `Contenedores` ADD COLUMN `tipo_residuo` varchar(50) DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Camiones.tipo_residuos
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Camiones'
    AND column_name = 'tipo_residuos'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `Camiones` ADD COLUMN `tipo_residuos` varchar(255) DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Camiones.capacidad_max
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Camiones'
    AND column_name = 'capacidad_max'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `Camiones` ADD COLUMN `capacidad_max` float DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Camiones.capacidad_disponible
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Camiones'
    AND column_name = 'capacidad_disponible'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `Camiones` ADD COLUMN `capacidad_disponible` float DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Camiones.latitud
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Camiones'
    AND column_name = 'latitud'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `Camiones` ADD COLUMN `latitud` decimal(10,6) DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Camiones.longitud
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Camiones'
    AND column_name = 'longitud'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `Camiones` ADD COLUMN `longitud` decimal(10,6) DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `Contenedores` SET `tipo_residuo` = 'Orgánicos' WHERE `id_contenedor` = 1 AND `tipo_residuo` IS NULL;
UPDATE `Contenedores` SET `tipo_residuo` = 'Reciclables' WHERE `id_contenedor` = 2 AND `tipo_residuo` IS NULL;
UPDATE `Contenedores` SET `tipo_residuo` = 'Inorgánicos' WHERE `id_contenedor` = 3 AND `tipo_residuo` IS NULL;

UPDATE `Camiones`
SET
  `capacidad_max` = 1000,
  `capacidad_disponible` = 1000,
  `estado` = 'Disponible',
  `latitud` = 25.532500,
  `longitud` = -103.435000,
  `tipo_residuos` = 'Orgánicos,Reciclables'
WHERE `id_camion` = 1;

UPDATE `Camiones`
SET
  `capacidad_max` = 1500,
  `capacidad_disponible` = 1500,
  `estado` = 'Disponible',
  `latitud` = 25.534000,
  `longitud` = -103.437000,
  `tipo_residuos` = 'Inorgánicos,Residuos especiales'
WHERE `id_camion` = 2;

INSERT IGNORE INTO `Camiones` (`id_camion`, `placa`, `capacidad`, `capacidad_max`, `capacidad_disponible`, `estado`, `latitud`, `longitud`, `tipo_residuos`) VALUES
(1, 'TRK-001', '1000kg', 1000, 1000, 'Disponible', 25.532500, -103.435000, 'Orgánicos,Reciclables'),
(2, 'TRK-002', '1500kg', 1500, 1500, 'Disponible', 25.534000, -103.437000, 'Inorgánicos,Residuos especiales');

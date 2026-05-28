CREATE DATABASE IF NOT EXISTS bin_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bin_db;

CREATE TABLE IF NOT EXISTS `Camiones` (
  `id_camion` int NOT NULL AUTO_INCREMENT,
  `placa` varchar(20) DEFAULT NULL,
  `capacidad` varchar(20) DEFAULT NULL,
  `estado` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id_camion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Contenedores` (
  `id_contenedor` int NOT NULL AUTO_INCREMENT,
  `ubicacion` varchar(100) DEFAULT NULL,
  `latitud` decimal(10,6) DEFAULT NULL,
  `longitud` decimal(10,6) DEFAULT NULL,
  `capacidad` varchar(20) DEFAULT NULL,
  `estado` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id_contenedor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Sensores` (
  `id_sensor` int NOT NULL AUTO_INCREMENT,
  `tipo_sensor` varchar(50) DEFAULT NULL,
  `id_contenedor` int DEFAULT NULL,
  PRIMARY KEY (`id_sensor`),
  KEY `id_contenedor` (`id_contenedor`),
  CONSTRAINT `Sensores_ibfk_1` FOREIGN KEY (`id_contenedor`) REFERENCES `Contenedores` (`id_contenedor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `LecturasSensores` (
  `id_lectura` int NOT NULL AUTO_INCREMENT,
  `id_sensor` int DEFAULT NULL,
  `fecha_hora` datetime DEFAULT NULL,
  `tempCelsius` float DEFAULT NULL,
  `humedad` float DEFAULT NULL,
  `distanciaBoteTapa` float DEFAULT NULL,
  `pesoKg` float DEFAULT NULL,
  PRIMARY KEY (`id_lectura`),
  KEY `idx_sensor_fecha` (`id_sensor`,`fecha_hora`),
  CONSTRAINT `LecturasSensores_ibfk_1` FOREIGN KEY (`id_sensor`) REFERENCES `Sensores` (`id_sensor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ReportesCiudadanos` (
  `id_reporte` int NOT NULL AUTO_INCREMENT,
  `descripcion` text,
  `foto` varchar(255) DEFAULT NULL,
  `latitud` decimal(10,6) DEFAULT NULL,
  `longitud` decimal(10,6) DEFAULT NULL,
  `fecha` datetime DEFAULT NULL,
  PRIMARY KEY (`id_reporte`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ResultadosIA` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_contenedor` int NOT NULL,
  `prioridad` enum('alta','media','baja') NOT NULL,
  `score` float DEFAULT NULL,
  `volumen_pct` float DEFAULT NULL,
  `temperatura` float DEFAULT NULL,
  `humedad` float DEFAULT NULL,
  `peso_kg` float DEFAULT NULL,
  `fecha_clasificacion` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_ria_contenedor` (`id_contenedor`),
  KEY `idx_ria_prioridad` (`prioridad`,`fecha_clasificacion` DESC),
  CONSTRAINT `fk_ria_contenedor` FOREIGN KEY (`id_contenedor`) REFERENCES `Contenedores` (`id_contenedor`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Rutas` (
  `id_ruta` int NOT NULL AUTO_INCREMENT,
  `nombre_ruta` varchar(100) DEFAULT NULL,
  `fecha` date DEFAULT NULL,
  `id_camion` int DEFAULT NULL,
  PRIMARY KEY (`id_ruta`),
  KEY `id_camion` (`id_camion`),
  CONSTRAINT `Rutas_ibfk_1` FOREIGN KEY (`id_camion`) REFERENCES `Camiones` (`id_camion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `RutaContenedores` (
  `id_ruta` int NOT NULL,
  `id_contenedor` int NOT NULL,
  `orden` int DEFAULT NULL,
  PRIMARY KEY (`id_ruta`,`id_contenedor`),
  KEY `id_contenedor` (`id_contenedor`),
  CONSTRAINT `RutaContenedores_ibfk_1` FOREIGN KEY (`id_ruta`) REFERENCES `Rutas` (`id_ruta`),
  CONSTRAINT `RutaContenedores_ibfk_2` FOREIGN KEY (`id_contenedor`) REFERENCES `Contenedores` (`id_contenedor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Usuarios` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` varchar(50) NOT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `Contenedores` (`id_contenedor`, `ubicacion`, `latitud`, `longitud`, `capacidad`, `estado`) VALUES
(1,'Edificio 19',25.533254,-103.436151,'200L','Lleno'),
(2,'Lab Computo',25.532843,-103.436120,'200L','Vacío'),
(3,'Fuente',25.532954,-103.435852,'150L','Medio');

INSERT IGNORE INTO `Sensores` (`id_sensor`, `tipo_sensor`, `id_contenedor`) VALUES
(1,'Infrarrojo',1),(2,'Infrarrojo',2),(3,'Ultrasónico',3);

-- password: password123 (bcrypt $2b$10)
INSERT IGNORE INTO `Usuarios` (`id_usuario`, `nombre`, `email`, `password`, `rol`) VALUES
(1,'Admin BIN','admin@bin.local','$2b$10$TobPqSZOOcrYGoWfBYBhPeASEqHL3hOrB9OwVJO0Wd6UGY9ksOtbS','admin');

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

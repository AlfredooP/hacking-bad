-- CreateTable
CREATE TABLE `Regiones` (
    `id_region` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `metadata` JSON NULL,
    `kpis` JSON NULL,
    `sim_settings` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id_region`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Zonas` (
    `id_zone` VARCHAR(191) NOT NULL,
    `id_region` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `geometry` JSON NOT NULL,
    `centroid_lng` DECIMAL(10, 6) NULL,
    `centroid_lat` DECIMAL(10, 6) NULL,
    `area_sq_m` DOUBLE NULL,
    `waste_metadata` JSON NULL,
    `assigned_vehicle_ids` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Zonas_id_region_idx`(`id_region`),
    PRIMARY KEY (`id_zone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Contenedores` ADD COLUMN `id_zone` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;

-- CreateIndex
CREATE INDEX `Contenedores_id_zone_idx` ON `Contenedores`(`id_zone`);

-- AddForeignKey
ALTER TABLE `Zonas` ADD CONSTRAINT `Zonas_id_region_fkey` FOREIGN KEY (`id_region`) REFERENCES `Regiones`(`id_region`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contenedores` ADD CONSTRAINT `Contenedores_id_zone_fkey` FOREIGN KEY (`id_zone`) REFERENCES `Zonas`(`id_zone`) ON DELETE SET NULL ON UPDATE CASCADE;

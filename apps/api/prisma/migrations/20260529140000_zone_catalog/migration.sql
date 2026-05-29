-- Allow zones in catalog without a region assignment
ALTER TABLE `Zonas` MODIFY `id_region` VARCHAR(191) NULL;

ALTER TABLE `Zonas` DROP FOREIGN KEY `Zonas_id_region_fkey`;

ALTER TABLE `Zonas` ADD CONSTRAINT `Zonas_id_region_fkey` FOREIGN KEY (`id_region`) REFERENCES `Regiones`(`id_region`) ON DELETE SET NULL ON UPDATE CASCADE;

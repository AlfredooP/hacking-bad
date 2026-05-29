-- AlterTable: Add id_region column to Camiones
ALTER TABLE `Camiones`
  ADD COLUMN `id_region` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Camiones_id_region_idx` ON `Camiones`(`id_region`);

-- AddForeignKey
ALTER TABLE `Camiones` ADD CONSTRAINT `Camiones_id_region_fkey`
  FOREIGN KEY (`id_region`) REFERENCES `Regiones`(`id_region`)
  ON DELETE SET NULL ON UPDATE CASCADE;

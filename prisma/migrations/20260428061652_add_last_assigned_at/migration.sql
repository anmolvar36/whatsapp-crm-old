-- DropForeignKey
ALTER TABLE `menu` DROP FOREIGN KEY `Menu_roleId_fkey`;

-- DropForeignKey
ALTER TABLE `submenu` DROP FOREIGN KEY `Submenu_menuId_fkey`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `lastAssignedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `activity_logs_timestamp_idx` ON `activity_logs`(`timestamp`);

-- CreateIndex
CREATE INDEX `leads_stage_idx` ON `leads`(`stage`);

-- CreateIndex
CREATE INDEX `leads_country_idx` ON `leads`(`country`);

-- AddForeignKey
ALTER TABLE `menu` ADD CONSTRAINT `menu_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submenu` ADD CONSTRAINT `submenu_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `menu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- removed to fix shadow db

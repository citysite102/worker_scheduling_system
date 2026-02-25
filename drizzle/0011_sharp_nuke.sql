-- Custom SQL migration file, put your code below! --
-- 將 workers 表的 uiNumber 欄位重新命名為 idNumber
ALTER TABLE `workers` RENAME COLUMN `uiNumber` TO `idNumber`;
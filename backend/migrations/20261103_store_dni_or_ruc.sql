-- Ejecutar una sola vez sobre una instalación previa.
-- Conserva los comercios existentes: su identificador actual se migra como RUC.
ALTER TABLE stores MODIFY ruc CHAR(11) NULL;
ALTER TABLE stores
  ADD COLUMN tipo_documento ENUM('DNI','RUC') NULL AFTER ruc,
  ADD COLUMN documento VARCHAR(11) NULL AFTER tipo_documento;

UPDATE stores
SET tipo_documento = 'RUC', documento = ruc
WHERE tipo_documento IS NULL;

ALTER TABLE stores
  MODIFY tipo_documento ENUM('DNI','RUC') NOT NULL,
  MODIFY documento VARCHAR(11) NOT NULL,
  ADD UNIQUE KEY uq_stores_documento(tipo_documento, documento);

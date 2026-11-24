-- Requisitos del enunciado: producto completo, datos generales y alta/baja de clientes,
-- tasa moratoria nominal o efectiva y periodo de capitalización de las tasas nominales.
ALTER TABLE products
  ADD COLUMN descripcion VARCHAR(255) NULL AFTER nombre,
  ADD COLUMN marca VARCHAR(80) NULL AFTER descripcion,
  ADD COLUMN proveedor VARCHAR(120) NULL AFTER marca,
  ADD COLUMN unidad_medida VARCHAR(20) NOT NULL DEFAULT 'unidad' AFTER proveedor,
  ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE customers
  ADD COLUMN telefono VARCHAR(15) NULL AFTER dni,
  ADD COLUMN direccion VARCHAR(160) NULL AFTER telefono,
  ADD COLUMN email VARCHAR(120) NULL AFTER direccion,
  ADD COLUMN capitalizacion TINYINT NOT NULL DEFAULT 1 AFTER tipo_tasa,
  ADD COLUMN tipo_tasa_mora ENUM('TEA','TNA') NOT NULL DEFAULT 'TEA' AFTER tasa,
  ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT chk_customers_capitalizacion CHECK (capitalizacion IN (1,15,30));

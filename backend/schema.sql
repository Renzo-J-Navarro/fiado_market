CREATE TABLE stores(id INT AUTO_INCREMENT PRIMARY KEY, ruc CHAR(11) UNIQUE NULL, tipo_documento ENUM('DNI','RUC') NOT NULL,
 documento VARCHAR(11) NOT NULL, owner_dni CHAR(8) NULL, nombre_comercial VARCHAR(120) NOT NULL, giro VARCHAR(60) NOT NULL,
 contact_email VARCHAR(120) NULL, status ENUM('PENDING','ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
 UNIQUE KEY uq_stores_documento(tipo_documento,documento));
CREATE TABLE users(id INT AUTO_INCREMENT PRIMARY KEY, store_id INT NOT NULL, email VARCHAR(120) UNIQUE NOT NULL, password_hash VARCHAR(100) NULL, role ENUM('ADMIN','CLIENTE') NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, FOREIGN KEY(store_id) REFERENCES stores(id));
CREATE TABLE customers(id INT AUTO_INCREMENT PRIMARY KEY, store_id INT NOT NULL, user_id INT NULL, nombre VARCHAR(120) NOT NULL, dni CHAR(8) NOT NULL,
 lmc DECIMAL(10,2) NOT NULL CHECK(lmc<=500), dia_corte TINYINT NOT NULL CHECK(dia_corte BETWEEN 1 AND 30), dia_pago TINYINT NOT NULL CHECK(dia_pago BETWEEN 1 AND 30),
 tipo_tasa ENUM('TEA','TNA') NOT NULL, tasa DECIMAL(7,4) NOT NULL CHECK(tasa<=114.13), tasa_mora DECIMAL(7,4) NOT NULL CHECK(tasa_mora<=15),
 moneda ENUM('PEN','USD') DEFAULT 'PEN', plazo_max TINYINT NOT NULL, UNIQUE(store_id,dni), CHECK(dia_pago>=dia_corte),
 FOREIGN KEY(store_id) REFERENCES stores(id), FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE products(id INT AUTO_INCREMENT PRIMARY KEY, store_id INT NOT NULL, nombre VARCHAR(120) NOT NULL, imagen_url VARCHAR(255),
 precio_contado DECIMAL(10,2) NOT NULL, precio_lista DECIMAL(10,2) NOT NULL, permite_fin_mes BOOL DEFAULT 1, permite_cuotas BOOL DEFAULT 1,
 CHECK(precio_lista>=precio_contado), FOREIGN KEY(store_id) REFERENCES stores(id));
CREATE TABLE sales(id INT AUTO_INCREMENT PRIMARY KEY, store_id INT NOT NULL, customer_id INT NOT NULL, product_id INT NOT NULL,
 fecha_compra DATE NOT NULL, cantidad SMALLINT UNSIGNED NOT NULL DEFAULT 1, monto DECIMAL(10,2) NOT NULL, plazo TINYINT NOT NULL, fecha_pago_pactada DATE NOT NULL,
 FOREIGN KEY(customer_id) REFERENCES customers(id), FOREIGN KEY(product_id) REFERENCES products(id));
CREATE TABLE installments(id INT AUTO_INCREMENT PRIMARY KEY, sale_id INT NOT NULL, n TINYINT NOT NULL, due_date DATE NOT NULL,
 capital DECIMAL(10,2) NOT NULL, interes DECIMAL(10,2) NOT NULL, paid_mora DECIMAL(10,2) DEFAULT 0, paid_interes DECIMAL(10,2) DEFAULT 0,
 paid_capital DECIMAL(10,2) DEFAULT 0, FOREIGN KEY(sale_id) REFERENCES sales(id));
CREATE TABLE payments(id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, fecha DATE NOT NULL, monto DECIMAL(10,2) NOT NULL, FOREIGN KEY(customer_id) REFERENCES customers(id));
CREATE TABLE password_tokens(id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash CHAR(64) NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME NULL, INDEX(token_hash), FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE platform_admins(id TINYINT UNSIGNED PRIMARY KEY CHECK(id=1), tipo_documento ENUM('DNI','RUC') NOT NULL,
 documento VARCHAR(11) NOT NULL UNIQUE, email VARCHAR(120) NOT NULL UNIQUE, password_hash VARCHAR(100) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);

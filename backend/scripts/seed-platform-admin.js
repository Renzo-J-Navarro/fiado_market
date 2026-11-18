require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { db: cfg } = require('../src/config');

async function main() {
  const tipo = process.env.SUPERADMIN_DOCUMENT_TYPE;
  const documento = process.env.SUPERADMIN_DOCUMENT;
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const digits = tipo === 'RUC' ? 11 : tipo === 'DNI' ? 8 : 0;
  if (!digits || !new RegExp(`^\\d{${digits}}$`).test(documento || '')) {
    throw new Error('Define SUPERADMIN_DOCUMENT_TYPE (DNI/RUC) y un documento válido en .env');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Define un SUPERADMIN_EMAIL válido en .env');
  if (!password || password.length < 12 || password.length > 72) {
    throw new Error('SUPERADMIN_PASSWORD debe tener entre 12 y 72 caracteres');
  }
  if (tipo === 'DNI' && password.includes(documento)) throw new Error('La contraseña no puede contener el DNI del administrador');

  const connection = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.pass, database: cfg.name,
  });
  try {
    const [[{ total }]] = await connection.query('SELECT COUNT(*) total FROM platform_admins');
    if (total > 1) throw new Error('Hay más de un administrador global; revisar la tabla platform_admins antes de continuar');
    const [[store]] = await connection.query('SELECT id FROM stores WHERE tipo_documento=? AND documento=?', [tipo, documento]);
    if (store) throw new Error('El documento ya identifica un comercio. Usa otro documento para evitar conflictos de inicio de sesión.');
    const [[user]] = await connection.query('SELECT id FROM users WHERE email=?', [email.toLowerCase()]);
    if (user) throw new Error('El email ya pertenece a una cuenta de negocio. Usa otro email para el administrador global.');
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.query(`INSERT INTO platform_admins(id,tipo_documento,documento,email,password_hash) VALUES(1,?,?,?,?)
      ON DUPLICATE KEY UPDATE tipo_documento=VALUES(tipo_documento),documento=VALUES(documento),email=VALUES(email),password_hash=VALUES(password_hash)`,
    [tipo, documento, email.toLowerCase(), passwordHash]);
    console.log('Administrador global configurado. No se imprimieron sus credenciales.');
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

const fs = require('fs'); const mysql = require('mysql2/promise'); const e = process.env; const name = e.DB_NAME;
(async () => {
  if (!name || !name.endsWith('_test')) throw new Error('DB_NAME debe terminar en _test (se borra y recrea)');
  const c = await mysql.createConnection({ host: e.DB_HOST, port: +e.DB_PORT || 3306, user: e.DB_USER, password: e.DB_PASS || '', multipleStatements: true });
  await c.query(`DROP DATABASE IF EXISTS \`${name}\`; CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4; USE \`${name}\`;` + fs.readFileSync(__dirname + '/../schema.sql', 'utf8'));
  await c.end(); console.log('BD de pruebas lista:', name);
})().catch(x => { console.error(x.message); process.exit(1); });

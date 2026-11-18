const { db: c } = require('./config');
const pool = require('mysql2/promise').createPool({ host: c.host, port: c.port, user: c.user, password: c.pass, database: c.name,
  dateStrings: true, decimalNumbers: true, connectionLimit: 10 });
pool.tx = async fn => { const k = await pool.getConnection();
  try { await k.beginTransaction(); const r = await fn(k); await k.commit(); return r; } catch (e) { await k.rollback(); throw e; } finally { k.release(); } };
module.exports = pool;

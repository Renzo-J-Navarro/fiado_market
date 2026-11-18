require('dotenv').config(); const e = process.env;
const miss = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'].filter(k => !e[k]);
if (miss.length) throw new Error('Configuración incompleta. Faltan: ' + miss.join(', '));
if (e.JWT_SECRET.length < 16) throw new Error('JWT_SECRET debe tener al menos 16 caracteres');
module.exports = { port: +e.PORT || 4000, jwtSecret: e.JWT_SECRET, loginMax: +e.LOGIN_MAX || 10,
  corsOrigins: (e.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()),
  db: { host: e.DB_HOST, port: +e.DB_PORT || 3306, user: e.DB_USER, pass: e.DB_PASS || '', name: e.DB_NAME } };

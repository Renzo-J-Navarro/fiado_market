const express = require('express'); const cors = require('cors'); const config = require('./config');
const app = express(); app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins }), express.json({ limit: '100kb' }));
app.use('/api/auth', require('./routes/auth')); app.use('/api', require('./routes'));
app.use((q, s) => s.status(404).json({ error: 'Ruta no encontrada' }));
app.use((e, q, s, n) => { // mensajes controlados; el detalle interno solo va al log
  if (e.status && e.status < 500) return s.status(e.status).json({ error: e.message });
  if (e.type === 'entity.parse.failed') return s.status(400).json({ error: 'JSON inválido' });
  if (e.code === 'ER_DUP_ENTRY') return s.status(409).json({ error: 'El registro ya existe (documento del comercio, email o DNI duplicado)' });
  if (e instanceof RangeError) return s.status(400).json({ error: e.message });
  console.error('[error]', e); s.status(500).json({ error: 'Error interno del servidor' }); });
module.exports = app;

let app, config;
try { config = require('./config'); app = require('./app'); } catch (e) { console.error(e.message); process.exit(1); }
app.listen(config.port, () => console.log(`API fiado en :${config.port}`));

const jwt = require('jsonwebtoken'); const config = require('./config'); const { HttpError } = require('./validate'); const db = require('./db');
exports.wrap = fn => (q, s, n) => fn(q, s, n).catch(n);
exports.auth = roles => async (q, s, n) => {
  try {
    const user = jwt.verify((q.headers.authorization || '').replace(/^Bearer\s+/i, ''), config.jwtSecret, { algorithms: ['HS256'] });
    if (!['SUPERADMIN', 'ADMIN', 'CLIENTE'].includes(user.role) || (roles && !roles.includes(user.role))) {
      throw new HttpError(403, 'Sin permiso');
    }
    if (user.role === 'SUPERADMIN') {
      if (user.id !== 1) throw new HttpError(401, 'No autenticado');
    } else if (user.role === 'ADMIN' && user.platformAdmin === true) {
      const [[admin]] = await db.query('SELECT id FROM platform_admins WHERE id=1 AND id=?', [user.id]);
      const [[account]] = user.storeId && user.storeAdminId
        ? await db.query(`SELECT u.id FROM users u JOIN stores st ON st.id=u.store_id
          WHERE u.id=? AND u.store_id=? AND u.role='ADMIN' AND u.active=TRUE AND st.status='ACTIVE'`,
        [user.storeAdminId, user.storeId])
        : [[]];
      if (!admin || !account) throw new HttpError(401, 'No autenticado');
    } else {
      const [rows] = await db.query(`SELECT 1 FROM users u JOIN stores st ON st.id=u.store_id
        WHERE u.id=? AND u.store_id=? AND u.role=? AND u.active=TRUE AND st.status='ACTIVE'`,
      [user.id, user.storeId, user.role]);
      if (!rows.length) throw new HttpError(401, 'Cuenta desactivada');
    }
    q.user = user;
    n();
  } catch (e) {
    n(e instanceof jwt.JsonWebTokenError || e instanceof jwt.TokenExpiredError
      ? new HttpError(401, 'No autenticado')
      : e);
  }
};

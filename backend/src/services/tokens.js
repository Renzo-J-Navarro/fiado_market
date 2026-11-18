const crypto = require('crypto');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
// Token de un solo uso (48 h) para que el cliente establezca/recupere su clave. Solo se guarda el hash.
async function issue(conn, userId) {
  const t = crypto.randomBytes(32).toString('hex');
  await conn.query('UPDATE password_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [userId]);
  await conn.query('INSERT INTO password_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 48 HOUR))', [userId, sha(t)]);
  return t; }
module.exports = { issue, sha };

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = m => new HttpError(400, m);
const num = (v, name, { min = -Infinity, max = Infinity, int = false } = {}) => {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v);
  if (typeof v !== 'number' || !Number.isFinite(v)) throw bad(`${name} debe ser un número válido`);
  if (int && !Number.isInteger(v)) throw bad(`${name} debe ser un entero`);
  if (v < min || v > max) throw bad(`${name} fuera de rango (${min} a ${max})`); return v; };
const str = (v, name, { min = 1, max = 120, re, msg } = {}) => {
  if (typeof v !== 'string') throw bad(msg || `${name} es obligatorio`); v = v.trim();
  if (v.length < min || v.length > max || (re && !re.test(v))) throw bad(msg || `${name} inválido`); return v; };
const date = (v, name) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw bad(`${name} debe ser una fecha válida AAAA-MM-DD`); return v; };
const oneOf = (v, name, list) => { if (!list.includes(v)) throw bad(`${name} debe ser uno de: ${list.join(', ')}`); return v; };
const email = v => str(v, 'email', { max: 120, re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: 'Email inválido' }).toLowerCase();
const password = (v, dni) => { const p = str(v, 'contraseña', { min: 8, max: 72, msg: 'La contraseña debe tener entre 8 y 72 caracteres' });
  if (dni && p.includes(dni)) throw bad('La contraseña no puede contener el DNI'); return p; };
const today = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); // hora de Lima (UTC-5)
module.exports = { HttpError, bad, num, str, date, oneOf, email, password, today };

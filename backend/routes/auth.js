const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { auth } = require('../middleware/auth');

/* ── POST /api/auth/login ──────────────────────────────────── */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE email = ? AND activo = 1 LIMIT 1',
      [email.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok)  return res.status(401).json({ error: 'Credenciales incorrectas' });

    const payload = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '8h' });

    res.json({ token, user: payload });
  } catch (e) { next(e); }
});

/* ── POST /api/auth/register ───────────────────────────────── */
// Sólo el admin puede crear transportadores y otros admins
router.post('/register', async (req, res, next) => {
  try {
    const { nombre, email, password, rol = 'cliente' } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ error: 'Todos los campos son requeridos' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)',
      [nombre.trim(), email.trim().toLowerCase(), hash, rol]
    );
    res.status(201).json({ id: result.insertId, nombre, email, rol });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El email ya está registrado' });
    next(e);
  }
});

/* ── GET /api/auth/me ──────────────────────────────────────── */
router.get('/me', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

module.exports = router;

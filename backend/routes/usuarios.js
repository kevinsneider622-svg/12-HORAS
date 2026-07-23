const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

/* ── GET /api/usuarios ──────────────────────────────────────── */
// Admin: lista todos. Transportador: sólo puede ver transportadores.
router.get('/', auth, requireRole('admin','transportador'), async (req, res, next) => {
  try {
    let sql = 'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios';
    const params = [];
    if (req.user.rol === 'transportador') {
      sql += " WHERE rol = 'transportador' AND activo = 1";
    }
    sql += ' ORDER BY nombre';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ── GET /api/usuarios/transportadores ──────────────────────── */
router.get('/transportadores', auth, requireRole('admin','asignador'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nombre, email FROM usuarios WHERE rol='transportador' AND activo=1 ORDER BY nombre"
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/* ── POST /api/usuarios ─────────────────────────────────────── */
router.post('/', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol)
      return res.status(400).json({ error: 'Todos los campos requeridos' });
    if (!['cliente','admin','transportador','asignador'].includes(rol))
      return res.status(400).json({ error: 'Rol inválido' });

    const hash = await bcrypt.hash(password, 10);
    const [r] = await db.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)',
      [nombre.trim(), email.trim().toLowerCase(), hash, rol]
    );
    res.status(201).json({ id: r.insertId, nombre, email, rol });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El email ya existe' });
    next(e);
  }
});

/* ── PATCH /api/usuarios/:id ────────────────────────────────── */
router.patch('/:id', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { nombre, activo } = req.body;
    const updates = [];
    const vals    = [];
    if (nombre  !== undefined) { updates.push('nombre = ?');  vals.push(nombre); }
    if (activo  !== undefined) { updates.push('activo = ?');  vals.push(activo ? 1 : 0); }
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
    vals.push(req.params.id);
    await db.query(`UPDATE usuarios SET ${updates.join(',')} WHERE id = ?`, vals);
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (e) { next(e); }
});

module.exports = router;

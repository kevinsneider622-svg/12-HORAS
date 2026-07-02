const router = require('express').Router();
const db     = require('../db');
const { auth } = require('../middleware/auth');

/* ── GET /api/notificaciones ────────────────────────────────── */
router.get('/', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT n.*, e.codigo_seguimiento
       FROM notificaciones n
       LEFT JOIN envios e ON n.envio_id = e.id
       WHERE n.usuario_id = ?
       ORDER BY n.creada_en DESC
       LIMIT 50`, [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/* ── GET /api/notificaciones/count ──────────────────────────── */
router.get('/count', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = 0',
      [req.user.id]
    );
    res.json({ sin_leer: rows[0].total });
  } catch (e) { next(e); }
});

/* ── PATCH /api/notificaciones/leer-todas ───────────────────── */
router.patch('/leer-todas', auth, async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?',
      [req.user.id]
    );
    res.json({ mensaje: 'Todas marcadas como leídas' });
  } catch (e) { next(e); }
});

/* ── PATCH /api/notificaciones/:id/leer ─────────────────────── */
router.patch('/:id/leer', auth, async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ mensaje: 'Notificación marcada como leída' });
  } catch (e) { next(e); }
});

module.exports = router;

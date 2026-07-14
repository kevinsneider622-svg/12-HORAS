const router   = require('express').Router();
const db       = require('../db');
const webpush  = require('web-push');
const { auth } = require('../middleware/auth');

// Configurar VAPID
webpush.setVapidDetails(
  process.env.VAPID_EMAIL    || 'mailto:admin@logistica.co',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/* ── GET /api/notificaciones/vapid-public-key ───────────────── */
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

/* ── POST /api/notificaciones/suscribir ─────────────────────── */
router.post('/suscribir', auth, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Suscripción requerida' });

    const subStr = JSON.stringify(subscription);

    // Verificar si ya existe
    const [existe] = await db.query(
      'SELECT id FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
      [req.user.id, subscription.endpoint]
    );

    if (existe.length === 0) {
      await db.query(
        'INSERT INTO push_subscriptions (usuario_id, endpoint, subscription) VALUES (?,?,?)',
        [req.user.id, subscription.endpoint, subStr]
      );
    } else {
      await db.query(
        'UPDATE push_subscriptions SET subscription = ? WHERE usuario_id = ? AND endpoint = ?',
        [subStr, req.user.id, subscription.endpoint]
      );
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── DELETE /api/notificaciones/desuscribir ─────────────────── */
router.delete('/desuscribir', auth, async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM push_subscriptions WHERE usuario_id = ?',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

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
    await db.query('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?', [req.user.id]);
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

/* ── Función interna: enviar push a un usuario ──────────────── */
async function enviarPushAUsuario(usuarioId, titulo, cuerpo, datos = {}) {
  try {
    const [subs] = await db.query(
      'SELECT subscription FROM push_subscriptions WHERE usuario_id = ?',
      [usuarioId]
    );
    for (const row of subs) {
      try {
        const sub = JSON.parse(row.subscription);
        await webpush.sendNotification(sub, JSON.stringify({
          title: titulo,
          body:  cuerpo,
          icon:  '../frontend/imagenes/12horas-192.png',
          badge: '../frontend/imagenes/12horas-96.png',
          data:  datos
        }));
      } catch (err) {
        // Si la suscripción expiró, eliminarla
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.query(
            'DELETE FROM push_subscriptions WHERE usuario_id = ? AND subscription = ?',
            [usuarioId, row.subscription]
          );
        }
      }
    }
  } catch {}
}

module.exports = router;
module.exports.enviarPushAUsuario = enviarPushAUsuario;
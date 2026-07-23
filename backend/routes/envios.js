const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const XLSX   = require('xlsx');
const { enviarPushAUsuario } = require('./notificaciones');

// ESTADOS
const ESTADOS_ADMIN   = ['Registrado','Recibido','En Tránsito','Entregado','Devolución','Reprogramado'];
const ESTADOS_TRANS   = ['En Tránsito','Entregado','Devolución','Reprogramado'];
const TARIFA_FIJA     = 10000;

/* helper: genera código de seguimiento */
function generarCodigo() {
  const año  = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `ENV-${año}-${rand}`;
}

/* helper: inserta notificación */
async function notificar(conn, usuarioId, envioId, mensaje) {
  await conn.query(
    'INSERT INTO notificaciones (usuario_id, envio_id, mensaje) VALUES (?,?,?)',
    [usuarioId, envioId, mensaje]
  );
}

/* ── GET /api/envios ────────────────────────────────────────── */
router.get('/', auth, async (req, res, next) => {
  try {
    const { rol, id } = req.user;
    let sql, params = [];

    if (rol === 'cliente') {
      sql = `SELECT e.*, u.nombre AS transportador_nombre
             FROM envios e
             LEFT JOIN usuarios u ON e.transportador_id = u.id
             WHERE e.cliente_id = ?
             ORDER BY e.creado_en DESC`;
      params = [id];
    } else if (rol === 'transportador') {
      // Solo envíos asignados en las últimas 24h (o sin fecha de asignación registrada, por compatibilidad)
      sql = `SELECT e.*, u.nombre AS cliente_nombre
             FROM envios e
             JOIN usuarios u ON e.cliente_id = u.id
             WHERE e.transportador_id = ?
               AND (e.asignado_en IS NULL OR e.asignado_en >= NOW() - INTERVAL 24 HOUR)
             ORDER BY e.creado_en DESC`;
      params = [id];
    } else if (rol === 'asignador') {
      // Ve todos los envíos igual que admin, pero SIN columnas monetarias
      sql = `SELECT
               e.id, e.codigo_seguimiento, e.destinatario_nombre, e.destinatario_tel,
               e.direccion_entrega, e.ciudad_entrega, e.descripcion_paquete, e.peso_kg,
               e.estado, e.cliente_id, e.transportador_id,
               e.creado_en, e.actualizado_en, e.asignado_en,
               uc.nombre AS cliente_nombre,
               ut.nombre AS transportador_nombre
             FROM envios e
             JOIN usuarios uc ON e.cliente_id = uc.id
             LEFT JOIN usuarios ut ON e.transportador_id = ut.id
             ORDER BY e.creado_en DESC`;
    } else {
      // admin: todos, sin filtro de tiempo
      sql = `SELECT e.*,
               uc.nombre AS cliente_nombre,
               ut.nombre AS transportador_nombre
             FROM envios e
             JOIN usuarios uc ON e.cliente_id = uc.id
             LEFT JOIN usuarios ut ON e.transportador_id = ut.id
             ORDER BY e.creado_en DESC`;
    }
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ── GET /api/envios/:id ────────────────────────────────────── */
router.get('/:id', auth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*,
         uc.nombre AS cliente_nombre,
         ut.nombre AS transportador_nombre,
         ut.email  AS transportador_email
       FROM envios e
       JOIN usuarios uc ON e.cliente_id = uc.id
       LEFT JOIN usuarios ut ON e.transportador_id = ut.id
       WHERE e.id = ?`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Envío no encontrado' });

    const envio = rows[0];
    if (req.user.rol === 'cliente' && envio.cliente_id !== req.user.id)
      return res.status(403).json({ error: 'Sin acceso' });
    if (req.user.rol === 'transportador' && envio.transportador_id !== req.user.id)
      return res.status(403).json({ error: 'Sin acceso' });

    // El rol asignador puede ver el envío para asignarlo, pero sin datos monetarios
    if (req.user.rol === 'asignador') {
      delete envio.valor_comercial;
      delete envio.tarifa;
    }

    const [historial] = await db.query(
      `SELECT h.*, u.nombre AS actor_nombre, u.rol AS actor_rol
       FROM historial_estados h
       JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.envio_id = ?
       ORDER BY h.registrado_en ASC`, [envio.id]
    );
    res.json({ ...envio, historial });
  } catch (e) { next(e); }
});

/* ── GET /api/envios/seguimiento/:codigo ─────────────────────── */
router.get('/seguimiento/:codigo', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.codigo_seguimiento, e.estado, e.destinatario_nombre,
              e.direccion_entrega, e.ciudad_entrega, e.creado_en, e.actualizado_en,
              e.valor_comercial, e.tarifa,
              ut.nombre AS transportador_nombre
      FROM envios e
      LEFT JOIN usuarios ut ON e.transportador_id = ut.id
      WHERE e.codigo_seguimiento = ?`, [req.params.codigo]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Código no encontrado' });

    const [hist] = await db.query(
      `SELECT h.estado, h.comentario, h.registrado_en, u.nombre AS actor
       FROM historial_estados h
       JOIN envios e ON h.envio_id = e.id
       JOIN usuarios u ON h.usuario_id = u.id
       WHERE e.codigo_seguimiento = ?
       ORDER BY h.registrado_en ASC`, [req.params.codigo]
    );
    res.json({ ...rows[0], historial: hist });
  } catch (e) { next(e); }
});

/* ── POST /api/envios ───────────────────────────────────────── */
router.post('/', auth, requireRole('cliente','admin'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const clienteId = req.user.rol === 'cliente' ? req.user.id : req.body.cliente_id;
    const enviosData = Array.isArray(req.body.envios) ? req.body.envios : [req.body];
    const creados = [];

for (const datos of enviosData) {
      const { destinatario_nombre, destinatario_tel, direccion_entrega,
              ciudad_entrega, descripcion_paquete, peso_kg, valor_comercial } = datos;

      if (!destinatario_nombre || !destinatario_tel || !direccion_entrega || !ciudad_entrega)
        throw Object.assign(new Error('Faltan datos del destinatario'), { status: 400 });

      const codigo = generarCodigo();
      const [r] = await conn.query(
        `INSERT INTO envios
           (codigo_seguimiento, cliente_id, destinatario_nombre, destinatario_tel,
            direccion_entrega, ciudad_entrega, descripcion_paquete, peso_kg, valor_comercial, tarifa)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [codigo, clienteId, destinatario_nombre, destinatario_tel,
         direccion_entrega, ciudad_entrega, descripcion_paquete || null,
         peso_kg || null, valor_comercial || 0, TARIFA_FIJA]
      );

      const envioId = r.insertId;

      await conn.query(
        'INSERT INTO historial_estados (envio_id, usuario_id, estado, comentario) VALUES (?,?,?,?)',
        [envioId, req.user.id, 'Registrado', 'Envío registrado en sistema']
      );

      const [admins] = await conn.query(
        "SELECT id FROM usuarios WHERE rol='admin' AND activo=1"
      );
      for (const adm of admins) {
        await notificar(conn, adm.id, envioId,
          `📦 Nuevo envío ${codigo} de ${req.user.nombre} → ${ciudad_entrega}`);
           enviarPushAUsuario(adm.id, '📦 Nuevo envío recibido',
          `De ${req.user.nombre} con destino ${ciudad_entrega}`,
          { codigo, url: '/' });
      }
      creados.push({ id: envioId, codigo_seguimiento: codigo });
    }

    await conn.commit();
    res.status(201).json({ mensaje: `${creados.length} envío(s) creado(s)`, envios: creados });
    } catch (e) {
      await conn.rollback();
      next(e);
    } finally { conn.release(); }
  });

/* ── PATCH /api/envios/:id/estado ──────────────────────────── */
router.patch('/:id/estado', auth, requireRole('admin','transportador'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM envios WHERE id = ?', [req.params.id]);
    const envio  = rows[0];
    if (!envio) return res.status(404).json({ error: 'Envío no encontrado' });

    const { estado, comentario } = req.body;

    const permitidos = req.user.rol === 'admin' ? ESTADOS_ADMIN : ESTADOS_TRANS;
    if (!permitidos.includes(estado))
      return res.status(403).json({ error: `Estado "${estado}" no permitido para tu rol` });

    if (req.user.rol === 'transportador' && envio.transportador_id !== req.user.id)
      return res.status(403).json({ error: 'Este envío no te está asignado' });

    await conn.query('UPDATE envios SET estado = ? WHERE id = ?', [estado, envio.id]);
    await conn.query(
      'INSERT INTO historial_estados (envio_id, usuario_id, estado, comentario) VALUES (?,?,?,?)',
      [envio.id, req.user.id, estado, comentario || null]
    );

    await notificar(conn, envio.cliente_id, envio.id,
      `📍 Tu envío ${envio.codigo_seguimiento} cambió a: ${estado}`);

    enviarPushAUsuario(envio.cliente_id, `📍 Envío ${envio.codigo_seguimiento}`,
    `Tu paquete cambió a: ${estado}`,
    { codigo: envio.codigo_seguimiento, url: '/' });

    await conn.commit();
    res.json({ mensaje: 'Estado actualizado', estado });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally { conn.release(); }
});

/* ── PATCH /api/envios/:id/asignar ─────────────────────────── */
// Al asignar transportador, el envío pasa automáticamente a "En Tránsito"
router.patch('/:id/asignar', auth, requireRole('admin','asignador'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { transportador_id } = req.body;
    if (!transportador_id)
      return res.status(400).json({ error: 'transportador_id requerido' });

    const [tRows] = await conn.query(
      "SELECT * FROM usuarios WHERE id = ? AND rol = 'transportador' AND activo = 1",
      [transportador_id]
    );
    if (!tRows[0]) return res.status(404).json({ error: 'Transportador no encontrado' });

    const [envRows] = await conn.query('SELECT * FROM envios WHERE id = ?', [req.params.id]);
    const envio = envRows[0];
    if (!envio) return res.status(404).json({ error: 'Envío no encontrado' });

    const NUEVO_ESTADO = 'En Tránsito';

    // Asigna transportador + cambia estado + marca fecha de asignación (para la regla de 24h)
    await conn.query(
      'UPDATE envios SET transportador_id = ?, estado = ?, asignado_en = NOW() WHERE id = ?',
      [transportador_id, NUEVO_ESTADO, envio.id]
    );

    // Registrar el cambio en el historial
    await conn.query(
      'INSERT INTO historial_estados (envio_id, usuario_id, estado, comentario) VALUES (?,?,?,?)',
      [envio.id, req.user.id, NUEVO_ESTADO, `Asignado a ${tRows[0].nombre}`]
    );

    // Notificar al transportador
    await notificar(conn, transportador_id, envio.id,
      `🚚 Se te asignó el envío ${envio.codigo_seguimiento} con destino ${envio.ciudad_entrega}`);

    enviarPushAUsuario(transportador_id, '🚚 Nuevo envío asignado',
      `Código ${envio.codigo_seguimiento} → ${envio.ciudad_entrega}`,
      { codigo: envio.codigo_seguimiento, url: '/' });

    // Notificar al cliente del cambio automático de estado
    await notificar(conn, envio.cliente_id, envio.id,
      `📍 Tu envío ${envio.codigo_seguimiento} cambió a: ${NUEVO_ESTADO}`);

    await conn.commit();
    res.json({ mensaje: `Envío asignado a ${tRows[0].nombre} y actualizado a "${NUEVO_ESTADO}"` });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally { conn.release(); }
});

/* ── GET /api/envios/export/excel ───────────────────────────── */
router.get('/export/excel', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const {
      cliente,
      estado,
      transportador,
      codigo,
      desde,
      hasta
    } = req.query;

    const where = [];
    const params = [];

    // Cliente
    if (cliente) {
      where.push("uc.nombre = ?");
      params.push(cliente);
    }

    // Estado
    if (estado) {
      where.push("e.estado = ?");
      params.push(estado);
    }

    // Transportador
    if (transportador) {
      where.push("ut.nombre = ?");
      params.push(transportador);
    }

    // Código de seguimiento
    if (codigo) {
      where.push("e.codigo_seguimiento LIKE ?");
      params.push(`%${codigo}%`);
    }

    // Fecha inicial
    if (desde) {
      where.push("e.creado_en >= ?");
      params.push(`${desde} 00:00:00`);
    }

    // Fecha final
    if (hasta) {
      where.push("e.creado_en <= ?");
      params.push(`${hasta} 23:59:59`);
    }

    const filtroSQL = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

    const [envios] = await db.query(
      `SELECT
          e.codigo_seguimiento AS 'Código',
          uc.nombre AS 'Cliente',
          e.destinatario_nombre AS 'Destinatario',
          e.destinatario_tel AS 'Teléfono',
          e.direccion_entrega AS 'Dirección',
          e.ciudad_entrega AS 'Ciudad',
          e.descripcion_paquete AS 'Descripción',
          e.peso_kg AS 'Peso (kg)',
          e.valor_comercial AS 'Valor Comercial (COP)',
          e.tarifa AS 'Tarifa Transporte (COP)',
          (e.valor_comercial + e.tarifa) AS 'Total (COP)',
          ut.nombre AS 'Transportador',
          e.estado AS 'Estado',
          e.creado_en AS 'Fecha Creación',
          e.actualizado_en AS 'Última Actualización'    
       FROM envios e
       JOIN usuarios uc ON e.cliente_id = uc.id
       LEFT JOIN usuarios ut ON e.transportador_id = ut.id
       ${filtroSQL}
       ORDER BY e.creado_en DESC`,
      params
    );

    // Asegura que los valores monetarios sean números reales (no texto),
    // para que Excel los reconozca como moneda y no marque error de "número guardado como texto".
    const enviosParaExcel = envios.map(e => ({
      ...e,
      'Valor Comercial (COP)':   Number(e['Valor Comercial (COP)'] || 0),
      'Tarifa Transporte (COP)': Number(e['Tarifa Transporte (COP)'] || 0),
      'Total (COP)':             Number(e['Total (COP)'] || 0),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(enviosParaExcel);
    XLSX.utils.book_append_sheet(wb, ws, 'Envíos');

    // Formato de moneda (COP) con separador de miles y sin decimales, para las 3 columnas monetarias.
    const formatoMoneda = '"$" #,##0';
    const columnasMoneda = ['I', 'J', 'K']; // Valor Comercial, Tarifa Transporte, Total
    columnasMoneda.forEach(col => {
      for (let fila = 2; fila <= enviosParaExcel.length + 1; fila++) {
        const celda = ws[`${col}${fila}`];
        if (celda) celda.z = formatoMoneda;
      }
    });

    const totalTarifas = envios.reduce(
        (s, e) => s + Number(e['Tarifa Transporte (COP)'] || 0),
        0
    );

    const totalComercial = envios.reduce(
        (s, e) => s + Number(e['Valor Comercial (COP)'] || 0),
        0
    );

    const totalGeneral = envios.reduce(
        (s, e) => s + Number(e['Total (COP)'] || 0),
        0
    );

    const summary = [
        {
            Métrica: 'Total envíos',
            Valor: envios.length
        },
        {
            Métrica: 'Valor comercial',
            Valor: `$${totalComercial.toLocaleString('es-CO')} COP`
        },
        {
            Métrica: 'Tarifas transporte',
            Valor: `$${totalTarifas.toLocaleString('es-CO')} COP`
        },
        {
            Métrica: 'Total general',
            Valor: `$${totalGeneral.toLocaleString('es-CO')} COP`
        },
        {
            Métrica: 'Entregados',
            Valor: envios.filter(e => e.Estado === 'Entregado').length
        },
        {
            Métrica: 'En Tránsito',
            Valor: envios.filter(e => e.Estado === 'En Tránsito').length
        },
        {
            Métrica: 'Pendientes',
            Valor: envios.filter(e => e.Estado === 'Recibido').length
        }
    ];
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Resumen');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="logistica_${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (e) { next(e); }
});

module.exports = router;
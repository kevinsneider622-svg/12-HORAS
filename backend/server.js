require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const authRouter = require('./routes/auth');
const enviosRouter   = require('./routes/envios');
const usuariosRouter = require('./routes/usuarios');
const notifRouter    = require('./routes/notificaciones');

const app = express();

app.use(cors({ origin: '*' }));          // Ajusta origin en producción
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas
app.use('/api/auth',           authRouter);
app.use('/api/envios',         enviosRouter);
app.use('/api/usuarios',       usuariosRouter);
app.use('/api/notificaciones', notifRouter);

// Health-check
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: new Date() }));

// Manejo de errores global
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));

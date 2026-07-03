const mysql = require('mysql2/promise');

const sslConfig = process.env.DB_SSL_CA
  ? { ca: process.env.DB_SSL_CA }
  : undefined;

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  ssl:                sslConfig,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '-05:00',
  charset:            'utf8mb4',
  decimalNumbers:     true,
});

// Forzar UTF-8 en cada nueva conexión
pool.on('connection', (conn) => {
  conn.query("SET NAMES 'utf8mb4'");
  conn.query("SET CHARACTER SET utf8mb4");
});

module.exports = pool;
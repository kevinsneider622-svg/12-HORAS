const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '7372546011',
  database:           process.env.DB_NAME     || 'logistica_db',
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
-- ============================================================
-- PLATAFORMA DE LOGÍSTICA - SCRIPT DE BASE DE DATOS
-- Motor: MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS logistica_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE logistica_db;

-- ------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  rol           ENUM('cliente','admin','transportador','asignador') NOT NULL DEFAULT 'cliente',
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- DESTINATARIOS (reutilizables por cliente)
-- ------------------------------------------------------------
CREATE TABLE destinatarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id    INT          NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  telefono      VARCHAR(20)  NOT NULL,
  direccion     VARCHAR(255) NOT NULL,
  ciudad        VARCHAR(100) NOT NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ENVÍOS
-- ------------------------------------------------------------
CREATE TABLE envios (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  codigo_seguimiento  VARCHAR(20)   NOT NULL UNIQUE,
  cliente_id          INT           NOT NULL,
  transportador_id    INT           NULL,
  destinatario_nombre VARCHAR(100)  NOT NULL,
  destinatario_tel    VARCHAR(20)   NOT NULL,
  direccion_entrega   VARCHAR(255)  NOT NULL,
  ciudad_entrega      VARCHAR(100)  NOT NULL,
  descripcion_paquete TEXT          NULL,
  peso_kg             DECIMAL(6,2)  NULL,
  tarifa              DECIMAL(10,2) NOT NULL DEFAULT 10000.00,
  estado              ENUM('Recibido','En Tránsito','Entregado','Devolución','Reprogramado')
                      NOT NULL DEFAULT 'Recibido',
  notas_admin         TEXT          NULL,
  creado_en           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id)       REFERENCES usuarios(id),
  FOREIGN KEY (transportador_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- HISTORIAL DE ESTADOS (trazabilidad completa)
-- ------------------------------------------------------------
CREATE TABLE historial_estados (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  envio_id    INT          NOT NULL,
  usuario_id  INT          NOT NULL,
  estado      ENUM('Recibido','En Tránsito','Entregado','Devolución','Reprogramado') NOT NULL,
  comentario  TEXT         NULL,
  registrado_en DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (envio_id)   REFERENCES envios(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- NOTIFICACIONES
-- ------------------------------------------------------------
CREATE TABLE notificaciones (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT          NOT NULL,
  envio_id    INT          NULL,
  mensaje     VARCHAR(500) NOT NULL,
  leida       TINYINT(1)   NOT NULL DEFAULT 0,
  creada_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (envio_id)   REFERENCES envios(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- DATOS INICIALES DE PRUEBA
-- password para todos: "Admin123" (bcryptjs hash rounds=10)
-- ------------------------------------------------------------
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
('Admin Principal',  'admin@logistica.co',   '$2b$10$kOXp9cGZyCzWMeywmibf9OL/enm1kvZYuELWTagbOJ50tvbXqRQda', 'admin'),
('Carlos Repartidor','carlos@logistica.co',  '$2b$10$kOXp9cGZyCzWMeywmibf9OL/enm1kvZYuELWTagbOJ50tvbXqRQda', 'transportador'),
('Ana Repartidora',  'ana@logistica.co',     '$2b$10$kOXp9cGZyCzWMeywmibf9OL/enm1kvZYuELWTagbOJ50tvbXqRQda', 'transportador'),
('Tienda El Éxito',  'tienda@cliente.co',    '$2b$10$kOXp9cGZyCzWMeywmibf9OL/enm1kvZYuELWTagbOJ50tvbXqRQda', 'cliente'),
('Boutique Moda',    'boutique@cliente.co',  '$2b$10$kOXp9cGZyCzWMeywmibf9OL/enm1kvZYuELWTagbOJ50tvbXqRQda', 'cliente');

-- Envíos de muestra
INSERT INTO envios (codigo_seguimiento, cliente_id, transportador_id, destinatario_nombre,
  destinatario_tel, direccion_entrega, ciudad_entrega, descripcion_paquete, peso_kg, estado)
VALUES
('ENV-2024-0001', 4, 2, 'María García',  '3001234567', 'Cra 7 # 45-12',     'Bogotá',     'Ropa y accesorios', 1.2, 'En Tránsito'),
('ENV-2024-0002', 4, NULL,'Pedro López', '3109876543', 'Cll 80 # 22-30',    'Medellín',   'Zapatos talla 42',  0.8, 'Recibido'),
('ENV-2024-0003', 5, 3, 'Luis Martínez', '3205551234', 'Av. El Dorado 68',  'Bogotá',     'Bolsos de cuero',   2.0, 'Entregado'),
('ENV-2024-0004', 4, 2, 'Sandra Ruiz',   '3156789012', 'Cra 15 # 93-40',    'Cali',       'Camisetas x5',      0.5, 'Reprogramado');

-- Historial inicial
INSERT INTO historial_estados (envio_id, usuario_id, estado, comentario) VALUES
(1, 1, 'Recibido',     'Paquete recibido en bodega central'),
(1, 2, 'En Tránsito',  'En ruta hacia el destinatario'),
(2, 1, 'Recibido',     'Paquete recibido en bodega central'),
(3, 1, 'Recibido',     'Paquete recibido en bodega central'),
(3, 3, 'En Tránsito',  'Salió en moto hace 10 min'),
(3, 3, 'Entregado',    'Entregado a portería del edificio'),
(4, 1, 'Recibido',     'Recibido'),
(4, 2, 'En Tránsito',  'En ruta'),
(4, 2, 'Reprogramado', 'Cliente no disponible, se agenda para mañana');

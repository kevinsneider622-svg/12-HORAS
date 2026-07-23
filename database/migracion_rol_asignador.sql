-- ============================================================
-- Migración: agregar el rol 'asignador' a la tabla usuarios
-- Ejecutar UNA sola vez sobre la base de datos ya existente.
-- Mantiene el mismo charset/collation que ya tiene la columna "rol".
-- ============================================================

ALTER TABLE usuarios
  MODIFY `rol` ENUM('cliente','admin','transportador','asignador')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  NOT NULL DEFAULT 'cliente';

-- Verificación rápida: confirma que el nuevo valor quedó disponible
-- SHOW COLUMNS FROM usuarios LIKE 'rol';

-- (Opcional) Crear un usuario de ejemplo con el nuevo rol.
-- Cambia el email y usa un hash de contraseña real (bcrypt) antes de ejecutar.
--
-- INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
-- ('Nombre Asignador', 'asignador@logistica.co', '<hash_bcrypt_aqui>', 'asignador');

# 🚚 LogiTrack CO — Plataforma de Logística

MVP funcional con 3 roles: Cliente, Administrador y Transportador.

---

## Estructura del proyecto

```
logistica/
├── database/
│   └── schema.sql          ← Script de creación de tablas y datos de prueba
├── backend/
│   ├── server.js           ← Punto de entrada de la API
│   ├── db.js               ← Pool de conexiones MySQL
│   ├── .env.example        ← Variables de entorno (renombrar a .env)
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js         ← JWT + control de roles
│   └── routes/
│       ├── auth.js         ← Login, registro, /me
│       ├── envios.js       ← CRUD envíos, estados, asignación, Excel
│       ├── usuarios.js     ← Gestión de usuarios (admin)
│       └── notificaciones.js
└── frontend/
    ├── index.html          ← SPA principal (login + app por roles)
    └── tracking.html       ← Página pública de rastreo
```

---

## Instalación paso a paso

### 1. Base de datos MySQL

```sql
-- Ejecuta en tu cliente MySQL (Workbench, DBeaver, phpMyAdmin, etc.)
SOURCE /ruta/a/logistica/database/schema.sql;
```

### 2. Backend (Node.js)

**Requisitos:** Node.js 18+ y MySQL 8.0+

```bash
cd logistica/backend

# Copiar y configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de MySQL

# Instalar dependencias
npm install

# Iniciar servidor
npm start
# → http://localhost:3001
```

### 3. Frontend

Abre `frontend/index.html` directamente en el navegador, o sírvelo con cualquier servidor estático:

```bash
# Opción A: Python (sin instalar nada extra)
cd logistica/frontend
python3 -m http.server 8080
# → http://localhost:8080

# Opción B: VS Code Live Server (extensión)
# Opción C: npx serve
npx serve logistica/frontend
```

---

## Usuarios de prueba

| Usuario           | Email                      | Contraseña | Rol            |
|-------------------|----------------------------|------------|----------------|
| Admin Principal   | admin@logistica.co         | Admin123   | Administrador  |
| Carlos Repartidor | carlos@logistica.co        | Admin123   | Transportador  |
| Ana Repartidora   | ana@logistica.co           | Admin123   | Transportador  |
| Tienda El Éxito   | tienda@cliente.co          | Admin123   | Cliente        |
| Boutique Moda     | boutique@cliente.co        | Admin123   | Cliente        |

---

## Funcionalidades por rol

### 👤 Cliente
- Crear envíos individuales o múltiples destinos simultáneos
- Ver bandeja con historial de sus paquetes
- Rastrear envíos por código de seguimiento

### 🔵 Administrador
- Dashboard con métricas en tiempo real
- Bandeja con TODOS los envíos
- Asignar envíos a transportadores (con notificación automática)
- Cambiar a cualquier estado: `Recibido`, `En Tránsito`, `Entregado`, `Devolución`, `Reprogramado`
- Gestión de usuarios (crear clientes, transportadores, admins)
- Exportar Excel con datos financieros
- Notificaciones en tiempo real de nuevos pedidos

### 🟡 Transportador
- Ver únicamente sus envíos asignados
- Actualizar estado (NO puede usar `Recibido`)
- Notificación cuando el admin le asigna un envío

---

## API Endpoints principales

```
POST   /api/auth/login                     Login
POST   /api/auth/register                  Registro
GET    /api/auth/me                        Usuario actual

GET    /api/envios                         Lista según rol
GET    /api/envios/:id                     Detalle + historial
GET    /api/envios/seguimiento/:codigo     Trazabilidad pública
POST   /api/envios                         Crear envío(s)
PATCH  /api/envios/:id/estado              Cambiar estado
PATCH  /api/envios/:id/asignar             Asignar transportador (admin)
GET    /api/envios/export/excel            Exportar Excel (admin)

GET    /api/usuarios                       Lista usuarios
GET    /api/usuarios/transportadores       Solo transportadores
POST   /api/usuarios                       Crear usuario (admin)

GET    /api/notificaciones                 Lista notificaciones
GET    /api/notificaciones/count           Contador sin leer
PATCH  /api/notificaciones/leer-todas      Marcar todas leídas
```

---

## Tarifa fija

`$10.000 COP` por envío — configurada en `backend/routes/envios.js` en la constante `TARIFA_FIJA`.

---

## Consideraciones para producción

1. Cambiar `JWT_SECRET` en `.env` por un valor aleatorio largo y seguro
2. Configurar `CORS` en `server.js` para permitir solo tu dominio
3. Usar HTTPS
4. Crear usuario MySQL con permisos mínimos (no usar root)
5. Agregar rate limiting (`express-rate-limit`)

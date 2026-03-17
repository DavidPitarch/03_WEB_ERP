# ERP Siniestros del Hogar

Sistema ERP para gestión del ciclo de vida completo de expedientes de siniestros del hogar.

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Cloudflare Workers + Hono
- **Base de datos**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Email**: Resend
- **Async**: Cloudflare Queues + Cron Triggers

## Estructura

```
apps/
  backoffice-web/     → Backoffice (React SPA)
  edge-api/           → API backend (Cloudflare Workers)
  operator-pwa/       → PWA operario (futuro)
  customer-portal/    → Portal cliente (futuro)
  expert-portal/      → Portal perito (futuro)
  supplier-portal/    → Portal proveedor (futuro)
packages/
  types/              → Tipos TypeScript compartidos
  domain/             → Lógica de dominio (máquina de estados)
  ui/                 → Componentes UI compartidos (futuro)
supabase/
  migrations/         → Migraciones SQL
  seed/               → Datos iniciales
  policies/           → RLS policies
docs/
  architecture/       → Documentación de arquitectura
  adr/                → Architecture Decision Records
```

## Arranque rápido

### Prerrequisitos
- Node.js ≥ 20
- pnpm ≥ 9
- Cuenta Supabase (proyecto creado)
- Cuenta Cloudflare (opcional para dev, requerido para deploy)

### 1. Instalar dependencias
```bash
pnpm install
```

### 2. Configurar Supabase
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar las migraciones SQL en `supabase/migrations/` en orden
3. Ejecutar el seed en `supabase/seed/`
4. Copiar URLs y claves

### 3. Configurar variables de entorno
```bash
# Frontend
cp apps/backoffice-web/.env.example apps/backoffice-web/.env

# Edge API
cp apps/edge-api/.dev.vars.example apps/edge-api/.dev.vars
```

Rellenar con las claves de tu proyecto Supabase.

### 4. Crear usuario inicial
En el dashboard de Supabase → Authentication → crear usuario y asignarle el rol `admin` en `user_roles`.

### 5. Arrancar en desarrollo
```bash
pnpm dev
```

Esto arranca:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:8787

## Primer vertical slice funcional

El primer slice implementa:
- Login con Supabase Auth
- Layout autenticado con navegación
- Listado de expedientes con filtros y paginación
- Detalle de expediente (datos, asegurado, compañía, operario)
- Timeline cronológica (comunicaciones + cambios de estado + citas)
- Creación de cita (modal)
- Transición controlada de estado (validada en backend)
- Historial de estados y auditoría automática
- Eventos de dominio registrados

## Decisiones de arquitectura

Ver [docs/adr/](docs/adr/) para ADRs completas.

Resumen:
- **Máquina de estados estricta** — transiciones solo vía backend
- **Event-driven** — toda mutación genera evento de dominio
- **RBAC + RLS** — doble barrera de seguridad
- **Auditoría total** — toda acción deja traza

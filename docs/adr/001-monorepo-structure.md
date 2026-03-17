# ADR-001: Estructura monorepo

## Estado: Aceptado

## Contexto
Necesitamos organizar múltiples aplicaciones (backoffice, PWA operario, portales, edge API) y paquetes compartidos (dominio, tipos, validadores, UI).

## Decisión
Monorepo con pnpm workspaces. Estructura `/apps` para desplegables, `/packages` para código compartido, `/supabase` para migraciones y políticas.

## Razones
- Compartir tipos y lógica de dominio sin publicar paquetes.
- Cambios atómicos cross-app.
- CI unificada.
- pnpm por eficiencia de disco y lockfile determinista.

## Consecuencias
- Requiere pnpm ≥ 9.
- Build pipeline debe manejar dependencias entre packages.

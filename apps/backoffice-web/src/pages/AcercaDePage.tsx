import { Info, Code2, Globe, Mail, Shield, Zap } from 'lucide-react';

const VERSION = '1.0.0';
const BUILD_DATE = '2026-03';

export function AcercaDePage() {
  return (
    <div className="page-stub">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={20} /> Acerca de GUAI ERP
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* Versión */}
        <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 10, padding: 24, border: '1px solid var(--color-border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Información del sistema</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Aplicación" value="GUAI ERP — Backoffice" />
            <Row label="Versión" value={VERSION} />
            <Row label="Build" value={BUILD_DATE} />
            <Row label="Entorno" value={import.meta.env.MODE === 'production' ? 'Producción' : 'Desarrollo'} />
          </div>
        </div>

        {/* Stack técnico */}
        <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 10, padding: 24, border: '1px solid var(--color-border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Code2 size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Stack tecnológico</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Frontend" value="React 18 + TypeScript + Vite" />
            <Row label="Backend" value="Cloudflare Workers + Hono v4" />
            <Row label="Base de datos" value="Supabase PostgreSQL" />
            <Row label="Autenticación" value="Supabase Auth (JWT)" />
            <Row label="Deploy" value="Cloudflare Pages + Workers" />
          </div>
        </div>

        {/* Desarrollador */}
        <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 10, padding: 24, border: '1px solid var(--color-border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Desarrollador</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Empresa" value="Pitarch Dev" />
            <Row label="Web" value="pitarch.dev" />
          </div>
        </div>

        {/* Soporte */}
        <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 10, padding: 24, border: '1px solid var(--color-border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Soporte</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Email" value="soporte@pitarch.dev" />
            <Row label="Horario" value="L–V 9:00–18:00" />
          </div>
        </div>

        {/* Seguridad */}
        <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 10, padding: 24, border: '1px solid var(--color-border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Seguridad y privacidad</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Cifrado" value="TLS 1.3 en tránsito" />
            <Row label="Datos en reposo" value="AES-256 (Supabase)" />
            <Row label="Roles y acceso" value="RBAC + RLS (9 roles)" />
            <Row label="WAF" value="Cloudflare WAF activo" />
            <Row label="Auditoría" value="Log completo de acciones" />
          </div>
        </div>

      </div>

      <p style={{ marginTop: 32, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
        GUAI ERP v{VERSION} · © {new Date().getFullYear()} Pitarch Dev · Todos los derechos reservados
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

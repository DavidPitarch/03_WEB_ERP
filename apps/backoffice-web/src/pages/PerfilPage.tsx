import { useState } from 'react';
import { User, Lock, BadgeCheck, Mail, AtSign, PhoneCall } from 'lucide-react';
import { useUserProfile, useChangePassword } from '@/hooks/useUserProfile';

// ─── Validación de contraseña ─────────────────────────────────────────────────

const PASSWORD_RULES = {
  minLength:    (v: string) => v.length >= 12,
  maxLength:    (v: string) => v.length <= 80,
  hasUppercase: (v: string) => /[A-Z]/.test(v),
  hasSpecial:   (v: string) => /[^a-zA-Z0-9]/.test(v),
};

function validateNewPassword(value: string): string | null {
  if (!PASSWORD_RULES.minLength(value))    return 'Mínimo 12 caracteres';
  if (!PASSWORD_RULES.maxLength(value))    return 'Máximo 80 caracteres';
  if (!PASSWORD_RULES.hasUppercase(value)) return 'Al menos una letra mayúscula';
  if (!PASSWORD_RULES.hasSpecial(value))   return 'Al menos un carácter especial (!@#$%...)';
  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PerfilPage() {
  const { data: profile, isLoading, isError } = useUserProfile();
  const changePassword = useChangePassword();

  const [oldPassword,  setOldPassword]  = useState('');
  const [newPassword,  setNewPassword]  = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const [touched, setTouched] = useState({ old: false, new: false, new2: false });
  const [successMsg, setSuccessMsg] = useState('');

  // Errores client-side
  const errorOld  = touched.old  && !oldPassword ? 'Introduce tu contraseña actual' : null;
  const errorNew  = touched.new  && newPassword  ? validateNewPassword(newPassword) : null;
  const errorNew2 = touched.new2 && newPassword2 && newPassword !== newPassword2
    ? 'Las contraseñas no coinciden'
    : null;

  const mutationError = changePassword.error instanceof Error
    ? changePassword.error.message
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ old: true, new: true, new2: true });
    setSuccessMsg('');

    if (!oldPassword)                       return;
    if (validateNewPassword(newPassword))   return;
    if (newPassword !== newPassword2)       return;

    try {
      await changePassword.mutateAsync({ oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
      setTouched({ old: false, new: false, new2: false });
      setSuccessMsg('Contraseña actualizada correctamente');
    } catch {
      // el error se expone vía changePassword.error
    }
  }

  // ─── Datos de perfil para la ficha ───────────────────────────────────────

  const PROFILE_FIELDS = profile ? [
    { icon: User,      label: 'Nombre completo', value: profile.nombre_completo || '—' },
    { icon: BadgeCheck, label: 'NIF',             value: profile.nif             || '—' },
    { icon: Mail,      label: 'Correo electrónico', value: profile.email          || '—' },
    { icon: PhoneCall, label: 'Extensión',        value: profile.extension       || '—' },
    { icon: AtSign,    label: 'Usuario',           value: profile.username        || '—' },
  ] : [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page-perfil">

      {/* Cabecera */}
      <div className="page-header">
        <h2>Datos de usuario</h2>
      </div>

      <div className="perfil-layout">

        {/* ── Sección A: ficha de datos ── */}
        <section className="form-section-v2 perfil-card">
          <h3 className="form-section-v2__title">
            <User size={16} />
            Mi perfil
          </h3>

          {isLoading && (
            <p className="perfil-loading">Cargando datos...</p>
          )}

          {isError && (
            <p className="perfil-error">No se pudieron cargar los datos del perfil.</p>
          )}

          {profile && (
            <ul className="perfil-list">
              {PROFILE_FIELDS.map(({ icon: Icon, label, value }) => (
                <li key={label} className="perfil-list__item">
                  <span className="perfil-list__icon"><Icon size={14} /></span>
                  <div className="perfil-list__content">
                    <span className="perfil-list__label">{label}</span>
                    <span className="perfil-list__value">{value}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Sección B: cambio de contraseña ── */}
        <section className="form-section-v2 perfil-password">
          <h3 className="form-section-v2__title">
            <Lock size={16} />
            Cambio de contraseña
          </h3>

          <form onSubmit={handleSubmit} noValidate>

            <div className="form-group-v2">
              <label className="form-label required" htmlFor="old-pass">
                Contraseña actual
              </label>
              <input
                id="old-pass"
                type="password"
                className={`form-control${errorOld ? ' error' : ''}`}
                placeholder="Introduce tu contraseña actual"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, old: true }))}
                autoComplete="current-password"
              />
              {errorOld && <p className="form-error-msg">{errorOld}</p>}
            </div>

            <hr className="perfil-hr" />

            <div className="form-group-v2">
              <label className="form-label required" htmlFor="new-pass1">
                Nueva contraseña
              </label>
              <input
                id="new-pass1"
                type="password"
                className={`form-control${errorNew ? ' error' : ''}`}
                placeholder="Introduce la nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, new: true }))}
                autoComplete="new-password"
              />
              {errorNew
                ? <p className="form-error-msg">{errorNew}</p>
                : <p className="form-hint">12-80 caracteres, al menos una mayúscula y un carácter especial.</p>
              }
            </div>

            <div className="form-group-v2">
              <label className="form-label required" htmlFor="new-pass2">
                Repetir nueva contraseña
              </label>
              <input
                id="new-pass2"
                type="password"
                className={`form-control${errorNew2 ? ' error' : ''}`}
                placeholder="Repite la nueva contraseña"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, new2: true }))}
                autoComplete="new-password"
              />
              {errorNew2 && <p className="form-error-msg">{errorNew2}</p>}
            </div>

            {mutationError && (
              <div className="perfil-alert perfil-alert--error">
                {mutationError}
              </div>
            )}

            {successMsg && (
              <div className="perfil-alert perfil-alert--success">
                {successMsg}
              </div>
            )}

            <div className="form-actions-v2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

          </form>
        </section>

      </div>
    </div>
  );
}

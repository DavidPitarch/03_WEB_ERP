import { useState } from 'react';
import { Landmark, Plus, Search, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import {
  useEmpresasFacturadoras,
  useCreateEmpresaFacturadora,
  useUpdateEmpresaFacturadora,
  useDeleteEmpresaFacturadora,
} from '@/hooks/useMasters';
import type { EmpresaFacturadora } from '@erp/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmpresaForm {
  nombre: string;
  nombre_comercial: string;
  cif: string;
  direccion: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  telefono: string;
  email: string;
  prefijo_facturas: string;
  prefijo_abonos: string;
  activa: boolean;
}

const FORM_DEFAULT: EmpresaForm = {
  nombre: '',
  nombre_comercial: '',
  cif: '',
  direccion: '',
  codigo_postal: '',
  localidad: '',
  provincia: '',
  telefono: '',
  email: '',
  prefijo_facturas: '',
  prefijo_abonos: '',
  activa: true,
};

function empresaToForm(e: EmpresaFacturadora): EmpresaForm {
  return {
    nombre:           e.nombre,
    nombre_comercial: e.nombre_comercial ?? '',
    cif:              e.cif,
    direccion:        e.direccion ?? '',
    codigo_postal:    e.codigo_postal ?? '',
    localidad:        e.localidad ?? '',
    provincia:        e.provincia ?? '',
    telefono:         e.telefono ?? '',
    email:            e.email ?? '',
    prefijo_facturas: e.prefijo_facturas ?? '',
    prefijo_abonos:   e.prefijo_abonos ?? '',
    activa:           e.activa,
  };
}

// ─── EditModal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  empresa: EmpresaFacturadora | null;
  onClose: () => void;
  onSave: (form: EmpresaForm) => void;
  isPending: boolean;
  error?: string | null;
}

function EditModal({ empresa, onClose, onSave, isPending, error }: EditModalProps) {
  const [form, setForm] = useState<EmpresaForm>(() =>
    empresa ? empresaToForm(empresa) : { ...FORM_DEFAULT }
  );

  const set = <K extends keyof EmpresaForm>(k: K, v: EmpresaForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const isValid = form.nombre.trim().length > 0 && form.cif.trim().length > 0;

  return (
    <div
      className="modal-overlay-v2"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-v2 modal-v2--lg">
        {/* Header */}
        <div className="modal-v2__header">
          <h3 className="modal-v2__title">
            {empresa ? `Editar — ${empresa.nombre}` : 'Nueva empresa facturadora'}
          </h3>
          <button className="modal-v2__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Body */}
        <div className="modal-v2__body">
          {/* ── Datos fiscales ─────────────────────────────────────── */}
          <div className="form-section-title">Datos fiscales</div>
          <div className="form-grid form-grid--2">
            <div className="form-group">
              <label className="form-label">Razón social <span className="required">*</span></label>
              <input
                className="form-control"
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre legal completo"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre comercial</label>
              <input
                className="form-control"
                value={form.nombre_comercial}
                onChange={e => set('nombre_comercial', e.target.value)}
                placeholder="Alias corto"
              />
            </div>
            <div className="form-group">
              <label className="form-label">CIF / NIF <span className="required">*</span></label>
              <input
                className="form-control"
                value={form.cif}
                onChange={e => set('cif', e.target.value.toUpperCase())}
                placeholder="B12345678"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                className="form-control"
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                placeholder="9XX XXX XXX"
              />
            </div>
            <div className="form-group form-group--full">
              <label className="form-label">Domicilio</label>
              <input
                className="form-control"
                value={form.direccion}
                onChange={e => set('direccion', e.target.value)}
                placeholder="Calle, número, piso..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">C.P.</label>
              <input
                className="form-control"
                value={form.codigo_postal}
                onChange={e => set('codigo_postal', e.target.value)}
                placeholder="08001"
                maxLength={10}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Población</label>
              <input
                className="form-control"
                value={form.localidad}
                onChange={e => set('localidad', e.target.value)}
                placeholder="Barcelona"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Provincia</label>
              <input
                className="form-control"
                value={form.provincia}
                onChange={e => set('provincia', e.target.value)}
                placeholder="Barcelona"
              />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail contacto</label>
              <input
                type="email"
                className="form-control"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="facturacion@empresa.com"
              />
            </div>
          </div>

          {/* ── Facturación ─────────────────────────────────────────── */}
          <div className="form-section-title" style={{ marginTop: '1.25rem' }}>Facturación</div>
          <div className="form-grid form-grid--2">
            <div className="form-group">
              <label className="form-label">Prefijo facturas</label>
              <input
                className="form-control"
                value={form.prefijo_facturas}
                onChange={e => set('prefijo_facturas', e.target.value.toUpperCase())}
                placeholder="FAC"
                maxLength={20}
                style={{ textTransform: 'uppercase' }}
              />
              <span className="form-hint">Ej: FAC → FAC2026-0001</span>
            </div>
            <div className="form-group">
              <label className="form-label">Prefijo abonos</label>
              <input
                className="form-control"
                value={form.prefijo_abonos}
                onChange={e => set('prefijo_abonos', e.target.value.toUpperCase())}
                placeholder="ABO"
                maxLength={20}
                style={{ textTransform: 'uppercase' }}
              />
              <span className="form-hint">Ej: ABO → ABO2026-0001</span>
            </div>
          </div>

          {/* ── Estado ──────────────────────────────────────────────── */}
          <div className="form-section-title" style={{ marginTop: '1.25rem' }}>Estado</div>
          <label className="form-check">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={e => set('activa', e.target.checked)}
            />
            <span>Empresa activa</span>
          </label>

          {error && (
            <div className="alert alert--error" style={{ marginTop: '1rem' }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-v2__footer">
          <button className="btn-secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={() => onSave(form)}
            disabled={!isValid || isPending}
          >
            {isPending ? 'Guardando…' : empresa ? 'Guardar cambios' : 'Crear empresa'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function ConfirmDialog({ message, onConfirm, onCancel, isPending }: ConfirmDialogProps) {
  return (
    <div className="modal-overlay-v2" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-v2" style={{ maxWidth: 440 }}>
        <div className="modal-v2__header">
          <h3 className="modal-v2__title">Confirmar acción</h3>
          <button className="modal-v2__close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-v2__body">
          <p style={{ margin: 0 }}>{message}</p>
        </div>
        <div className="modal-v2__footer">
          <button className="btn-secondary" onClick={onCancel} disabled={isPending}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EmpresasPage ─────────────────────────────────────────────────────────────

export function EmpresasPage() {
  const [search, setSearch]           = useState('');
  const [showInactivas, setShowInactivas] = useState(false);
  const [editTarget, setEditTarget]   = useState<EmpresaFacturadora | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmpresaFacturadora | null>(null);
  const [apiError, setApiError]       = useState<string | null>(null);

  const { data: res, isLoading } = useEmpresasFacturadoras();
  const createMut = useCreateEmpresaFacturadora();
  const updateMut = useUpdateEmpresaFacturadora();
  const deleteMut = useDeleteEmpresaFacturadora();

  const all: EmpresaFacturadora[] = (res as any)?.data ?? [];

  const filtered = all.filter(e => {
    if (!showInactivas && !e.activa) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.nombre.toLowerCase().includes(q) ||
      (e.nombre_comercial ?? '').toLowerCase().includes(q) ||
      e.cif.toLowerCase().includes(q) ||
      (e.localidad ?? '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => { setApiError(null); setEditTarget('new'); };
  const openEdit   = (e: EmpresaFacturadora) => { setApiError(null); setEditTarget(e); };
  const closeModal = () => setEditTarget(null);

  const handleSave = (form: EmpresaForm) => {
    setApiError(null);
    const payload = {
      nombre:           form.nombre.trim(),
      nombre_comercial: form.nombre_comercial.trim() || null,
      cif:              form.cif.trim(),
      direccion:        form.direccion.trim() || null,
      codigo_postal:    form.codigo_postal.trim() || null,
      localidad:        form.localidad.trim() || null,
      provincia:        form.provincia.trim() || null,
      telefono:         form.telefono.trim() || null,
      email:            form.email.trim() || null,
      prefijo_facturas: form.prefijo_facturas.trim() || null,
      prefijo_abonos:   form.prefijo_abonos.trim() || null,
      activa:           form.activa,
    };

    if (editTarget === 'new') {
      createMut.mutate(payload, {
        onSuccess: () => closeModal(),
        onError: (err: any) => setApiError(err?.message ?? 'Error al crear la empresa'),
      });
    } else if (editTarget) {
      updateMut.mutate({ id: editTarget.id, ...payload }, {
        onSuccess: () => closeModal(),
        onError: (err: any) => setApiError(err?.message ?? 'Error al guardar'),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err: any) => {
        setDeleteTarget(null);
        alert((err as any)?.message ?? 'No se pudo eliminar la empresa');
      },
    });
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__left">
          <Landmark size={22} style={{ color: 'var(--primary)' }} />
          <div>
            <h2 className="page-title">Empresas Facturadoras</h2>
            <p className="page-subtitle">Sociedades del grupo habilitadas para emitir facturas y liquidar operarios</p>
          </div>
        </div>
        <div className="page-header__actions">
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Nueva empresa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={15} className="search-box__icon" />
          <input
            className="search-box__input"
            placeholder="Buscar por nombre, CIF o población…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className="form-check" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={showInactivas}
            onChange={e => setShowInactivas(e.target.checked)}
          />
          <span>Mostrar inactivas</span>
        </label>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="page-loading">Cargando empresas…</div>
      ) : filtered.length === 0 ? (
        <div className="page-empty">
          <Landmark size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>{all.length === 0 ? 'No hay empresas registradas.' : 'No hay resultados para la búsqueda.'}</p>
          {all.length === 0 && (
            <button className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={openCreate}>
              Crear primera empresa
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CIF</th>
                <th>Localidad</th>
                <th>Teléfono</th>
                <th>Prefijos</th>
                <th style={{ width: 80, textAlign: 'center' }}>Estado</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(empresa => (
                <tr key={empresa.id} style={!empresa.activa ? { opacity: 0.55 } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{empresa.nombre}</div>
                    {empresa.nombre_comercial && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {empresa.nombre_comercial}
                      </div>
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: 'var(--text-sm)' }}>{empresa.cif}</code>
                  </td>
                  <td>
                    {empresa.localidad
                      ? <>{empresa.localidad}{empresa.provincia ? ` (${empresa.provincia})` : ''}</>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td>{empresa.telefono ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td>
                    {(empresa.prefijo_facturas || empresa.prefijo_abonos) ? (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {empresa.prefijo_facturas && <><strong>FAC:</strong> {empresa.prefijo_facturas} </>}
                        {empresa.prefijo_abonos && <><strong>ABO:</strong> {empresa.prefijo_abonos}</>}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {empresa.activa ? (
                      <CheckCircle size={16} style={{ color: 'var(--green-600)' }} />
                    ) : (
                      <XCircle size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-secondary btn--sm"
                        onClick={() => openEdit(empresa)}
                        title="Editar"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        className="btn-link btn--sm"
                        style={{ color: 'var(--red-600)' }}
                        onClick={() => setDeleteTarget(empresa)}
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            {filtered.length} empresa{filtered.length !== 1 ? 's' : ''}
            {!showInactivas && all.some(e => !e.activa) && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                ({all.filter(e => !e.activa).length} inactiva{all.filter(e => !e.activa).length !== 1 ? 's' : ''} oculta{all.filter(e => !e.activa).length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {editTarget !== null && (
        <EditModal
          empresa={editTarget === 'new' ? null : editTarget}
          onClose={closeModal}
          onSave={handleSave}
          isPending={isPending}
          error={apiError}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          message={`¿Eliminar "${deleteTarget.nombre}" (${deleteTarget.cif})? Esta acción no se puede deshacer. Si tiene expedientes asociados, la operación será rechazada.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMut.isPending}
        />
      )}
    </div>
  );
}

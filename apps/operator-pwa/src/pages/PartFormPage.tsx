import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadToSignedUrl, enqueueParte } from '@/lib/api';
import { saveDraft, loadDraft, clearDraft } from '@/lib/offline-queue';
import { storeBlob } from '@/lib/offline-blobs';
import { EvidenceUploader } from '@/components/EvidenceUploader';
import type { UploadedEvidence } from '@/components/EvidenceUploader';
import { SignaturePad } from '@/components/SignaturePad';
import type { ResultadoVisita, CreateParteRequest, UploadInitResponse } from '@erp/types';

const RESULTADO_LABELS: Record<ResultadoVisita, string> = {
  completada: 'Completada',
  pendiente: 'Pendiente',
  ausente: 'Ausente',
  requiere_material: 'Requiere material',
};

export function PartFormPage() {
  const { id: expedienteId, citaId } = useParams<{ id: string; citaId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: claimRes } = useQuery({
    queryKey: ['operator-claim', expedienteId],
    queryFn: () => api.get<any>(`/claims/${expedienteId}`),
    enabled: !!expedienteId,
  });
  const claim = claimRes && 'data' in claimRes ? claimRes.data : null;

  // Form state
  const [trabajosRealizados, setTrabajosRealizados] = useState('');
  const [trabajosPendientes, setTrabajosPendientes] = useState('');
  const [materialesUtilizados, setMaterialesUtilizados] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [resultado, setResultado] = useState<ResultadoVisita>('completada');
  const [motivoResultado, setMotivoResultado] = useState('');
  const [requiereNuevaVisita, setRequiereNuevaVisita] = useState(false);
  const [uploadedEvidencias, setUploadedEvidencias] = useState<UploadedEvidence[]>([]);
  const [firmaPath, setFirmaPath] = useState<string | null>(null);
  const [firmaUploading, setFirmaUploading] = useState(false);
  const [firmaError, setFirmaError] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Load draft on mount
  useEffect(() => {
    if (!expedienteId || !citaId) return;
    const draft = loadDraft(expedienteId, citaId) as any;
    if (draft) {
      setTrabajosRealizados(draft.trabajosRealizados ?? '');
      setTrabajosPendientes(draft.trabajosPendientes ?? '');
      setMaterialesUtilizados(draft.materialesUtilizados ?? '');
      setObservaciones(draft.observaciones ?? '');
      setResultado(draft.resultado ?? 'completada');
      setMotivoResultado(draft.motivoResultado ?? '');
      setRequiereNuevaVisita(draft.requiereNuevaVisita ?? false);
    }
  }, [expedienteId, citaId]);

  // Auto-save draft on changes
  useEffect(() => {
    if (!expedienteId || !citaId || submitted) return;
    const timer = setTimeout(() => {
      saveDraft(expedienteId, citaId, {
        trabajosRealizados, trabajosPendientes, materialesUtilizados,
        observaciones, resultado, motivoResultado, requiereNuevaVisita,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [trabajosRealizados, trabajosPendientes, materialesUtilizados, observaciones, resultado, motivoResultado, requiereNuevaVisita, expedienteId, citaId, submitted]);

  const mutation = useMutation({
    mutationFn: (data: CreateParteRequest) => api.post(`/claims/${expedienteId}/parts`, data),
    onSuccess: (res) => {
      if (res && 'data' in res && res.data) {
        setSubmitted(true);
        clearDraft(expedienteId!, citaId!);
        qc.invalidateQueries({ queryKey: ['operator-claim', expedienteId] });
        qc.invalidateQueries({ queryKey: ['agenda'] });
        navigate(`/claim/${expedienteId}`);
      } else if (res && 'error' in res && res.error) {
        if (res.error.code === 'OFFLINE' || res.error.code === 'NETWORK_ERROR') {
          // Enqueue for later sync
          handleOfflineSubmit();
        } else {
          setError(res.error.message);
        }
      }
    },
    onError: () => {
      handleOfflineSubmit();
    },
  });

  const handleOfflineSubmit = () => {
    const serverEvidenciaIds = uploadedEvidencias.filter((e) => !e.blobKey).map((e) => e.id);
    const evidenceBlobKeys = uploadedEvidencias.filter((e) => !!e.blobKey).map((e) => e.blobKey!);

    const payload = {
      expediente_id: expedienteId!,
      cita_id: citaId!,
      trabajos_realizados: trabajosRealizados,
      trabajos_pendientes: trabajosPendientes || undefined,
      materiales_utilizados: materialesUtilizados || undefined,
      observaciones: observaciones || undefined,
      resultado,
      motivo_resultado: motivoResultado || undefined,
      requiere_nueva_visita: requiereNuevaVisita,
      firma_storage_path: firmaPath ?? undefined,
      evidencia_ids: serverEvidenciaIds,
      ...(evidenceBlobKeys.length > 0 ? { evidence_blob_keys: evidenceBlobKeys } : {}),
    };
    enqueueParte(expedienteId!, payload);
    clearDraft(expedienteId!, citaId!);
    setSubmitted(true);
    navigate(`/claim/${expedienteId}`);
  };

  const handleFirmaSave = async (blob: Blob) => {
    setFirmaUploading(true);
    setFirmaError('');
    try {
      const initRes = await api.post<UploadInitResponse>('/uploads/init', {
        expediente_id: expedienteId,
        filename: `firma_${Date.now()}.png`,
        content_type: 'image/png',
      });

      if (!initRes || !('data' in initRes) || !initRes.data) {
        const errorCode = (initRes as any)?.error?.code;
        if (errorCode === 'OFFLINE' || errorCode === 'NETWORK_ERROR') {
          const blobKey = `firma:${expedienteId}:${citaId}:${Date.now()}`;
          await storeBlob(blobKey, blob);
          setFirmaPath(`offline:${blobKey}`);
        } else {
          setFirmaError('Error al iniciar subida de firma');
        }
        setFirmaUploading(false);
        return;
      }

      const init = initRes.data as UploadInitResponse;
      const ok = await uploadToSignedUrl(init.signed_url, blob);
      if (!ok) {
        setFirmaError('Error al subir firma. Intente de nuevo.');
        setFirmaUploading(false);
        return;
      }

      await api.post('/uploads/complete', {
        upload_id: init.upload_id,
        storage_path: init.storage_path,
        expediente_id: expedienteId,
        cita_id: citaId,
        clasificacion: 'general',
        nombre_original: 'firma_cliente.png',
        mime_type: 'image/png',
        tamano_bytes: blob.size,
      });
      setFirmaPath(init.storage_path);
    } catch {
      // Network down — store firma in IndexedDB
      try {
        const blobKey = `firma:${expedienteId}:${citaId}:${Date.now()}`;
        await storeBlob(blobKey, blob);
        setFirmaPath(`offline:${blobKey}`);
      } catch {
        setFirmaError('Error al guardar firma');
      }
    }
    setFirmaUploading(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!trabajosRealizados.trim()) {
      setError('Debe describir los trabajos realizados');
      return;
    }
    if ((resultado === 'ausente' || resultado === 'requiere_material') && !motivoResultado.trim()) {
      setError('Debe indicar motivo para este resultado');
      return;
    }

    // If any blobs are stored offline, always use the queue path
    const hasOfflineBlobs = uploadedEvidencias.some((e) => e.blobKey) || firmaPath?.startsWith('offline:');
    if (hasOfflineBlobs) {
      handleOfflineSubmit();
      return;
    }

    mutation.mutate({
      expediente_id: expedienteId!,
      cita_id: citaId!,
      trabajos_realizados: trabajosRealizados,
      trabajos_pendientes: trabajosPendientes || undefined,
      materiales_utilizados: materialesUtilizados || undefined,
      observaciones: observaciones || undefined,
      resultado,
      motivo_resultado: motivoResultado || undefined,
      requiere_nueva_visita: requiereNuevaVisita,
      firma_storage_path: firmaPath ?? undefined,
      evidencia_ids: uploadedEvidencias.map((e) => e.id),
    });
  };

  return (
    <div className="op-part-form">
      <h2>Parte de intervención</h2>
      {claim && (
        <div className="op-part-summary">
          <strong>{(claim as any).numero_expediente}</strong> — {(claim as any).tipo_siniestro}
          <br />
          <span className="op-muted">{(claim as any).direccion_siniestro}, {(claim as any).localidad}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="op-field">
          <label>Resultado de la visita *</label>
          <div className="op-result-grid">
            {(['completada', 'pendiente', 'ausente', 'requiere_material'] as ResultadoVisita[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`op-result-btn ${resultado === r ? 'active' : ''}`}
                onClick={() => setResultado(r)}
              >
                {RESULTADO_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {(resultado === 'ausente' || resultado === 'requiere_material') && (
          <div className="op-field">
            <label>Motivo *</label>
            <textarea value={motivoResultado} onChange={(e) => setMotivoResultado(e.target.value)} rows={2} required />
          </div>
        )}

        <div className="op-field">
          <label>Trabajos realizados *</label>
          <textarea
            value={trabajosRealizados}
            onChange={(e) => setTrabajosRealizados(e.target.value)}
            rows={4}
            placeholder="Describa los trabajos realizados..."
            required
            maxLength={5000}
          />
        </div>

        <div className="op-field">
          <label>Trabajos pendientes</label>
          <textarea value={trabajosPendientes} onChange={(e) => setTrabajosPendientes(e.target.value)} rows={2} placeholder="Si quedan trabajos pendientes..." maxLength={2000} />
        </div>

        <div className="op-field">
          <label>Materiales utilizados</label>
          <textarea value={materialesUtilizados} onChange={(e) => setMaterialesUtilizados(e.target.value)} rows={2} placeholder="Materiales empleados..." maxLength={2000} />
        </div>

        <div className="op-field">
          <label>Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} placeholder="Notas adicionales..." maxLength={2000} />
        </div>

        <div className="op-field">
          <label className="op-checkbox-label">
            <input type="checkbox" checked={requiereNuevaVisita} onChange={(e) => setRequiereNuevaVisita(e.target.checked)} />
            Requiere nueva visita
          </label>
        </div>

        <EvidenceUploader
          expedienteId={expedienteId!}
          citaId={citaId!}
          onUploaded={(evs) => setUploadedEvidencias(evs)}
        />

        <SignaturePad onSave={handleFirmaSave} disabled={firmaUploading} />
        {firmaPath && <div className="op-firma-ok">{firmaPath.startsWith('offline:') ? 'Firma guardada (offline)' : 'Firma guardada'}</div>}
        {firmaUploading && <div className="op-muted">Guardando firma...</div>}
        {firmaError && <div className="op-error">{firmaError}</div>}

        {error && <div className="op-error">{error}</div>}

        <button type="submit" className="op-btn-primary op-btn-full" disabled={mutation.isPending || firmaUploading}>
          {mutation.isPending ? 'Enviando parte...' : 'Enviar parte'}
        </button>
      </form>
    </div>
  );
}

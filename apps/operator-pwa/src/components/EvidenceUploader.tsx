import { useState, useRef } from 'react';
import { api, uploadToSignedUrl } from '@/lib/api';
import type { UploadInitResponse, EvidenciaClasificacion } from '@erp/types';

interface UploadedEvidence {
  id: string;
  nombre: string;
  clasificacion: EvidenciaClasificacion;
  preview?: string;
}

interface FailedUpload {
  nombre: string;
  error: string;
}

interface Props {
  expedienteId: string;
  citaId: string;
  onUploaded: (evidencias: UploadedEvidence[]) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function EvidenceUploader({ expedienteId, citaId, onUploaded }: Props) {
  const [evidencias, setEvidencias] = useState<UploadedEvidence[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [clasificacion, setClasificacion] = useState<EvidenciaClasificacion>('general');
  const [failures, setFailures] = useState<FailedUpload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    setFailures([]);
    const newEvidencias: UploadedEvidence[] = [];
    const newFailures: FailedUpload[] = [];
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(`Subiendo ${i + 1} de ${fileArray.length}...`);

      if (file.size > MAX_FILE_SIZE) {
        newFailures.push({ nombre: file.name, error: 'Archivo demasiado grande (máx 20MB)' });
        continue;
      }

      try {
        // 1. Init upload
        const initRes = await api.post<UploadInitResponse>('/uploads/init', {
          expediente_id: expedienteId,
          filename: file.name,
          content_type: file.type,
        });

        if (!initRes || !('data' in initRes) || !initRes.data) {
          const msg = initRes && 'error' in initRes && initRes.error ? initRes.error.message : 'Error al iniciar subida';
          newFailures.push({ nombre: file.name, error: msg });
          continue;
        }
        const init = initRes.data as UploadInitResponse;

        // 2. Upload to signed URL (with retries)
        const ok = await uploadToSignedUrl(init.signed_url, file);
        if (!ok) {
          newFailures.push({ nombre: file.name, error: 'Error al subir archivo' });
          continue;
        }

        // 3. Register evidence
        const completeRes = await api.post<{ id: string }>('/uploads/complete', {
          upload_id: init.upload_id,
          storage_path: init.storage_path,
          expediente_id: expedienteId,
          cita_id: citaId,
          clasificacion,
          nombre_original: file.name,
          mime_type: file.type,
          tamano_bytes: file.size,
        });

        if (completeRes && 'data' in completeRes && completeRes.data) {
          newEvidencias.push({
            id: (completeRes.data as any).id,
            nombre: file.name,
            clasificacion,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          });
        } else {
          newFailures.push({ nombre: file.name, error: 'Error al registrar evidencia' });
        }
      } catch {
        newFailures.push({ nombre: file.name, error: 'Error de red' });
      }
    }

    const updated = [...evidencias, ...newEvidencias];
    setEvidencias(updated);
    onUploaded(updated);
    setFailures(newFailures);
    setUploadProgress('');
    setUploading(false);

    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (id: string) => {
    const updated = evidencias.filter((e) => e.id !== id);
    setEvidencias(updated);
    onUploaded(updated);
  };

  return (
    <div className="op-evidence">
      <div className="op-evidence-header">
        <h3>Evidencias fotográficas</h3>
        <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value as EvidenciaClasificacion)} className="op-select-sm">
          <option value="antes">Antes</option>
          <option value="durante">Durante</option>
          <option value="despues">Después</option>
          <option value="general">General</option>
        </select>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        className="op-btn-upload"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? uploadProgress || 'Subiendo...' : `Añadir fotos${evidencias.length > 0 ? ` (${evidencias.length})` : ''}`}
      </button>

      {failures.length > 0 && (
        <div className="op-error" style={{ marginTop: '0.5rem' }}>
          {failures.map((f, i) => (
            <div key={i}>{f.nombre}: {f.error}</div>
          ))}
        </div>
      )}

      {evidencias.length > 0 && (
        <div className="op-evidence-grid">
          {evidencias.map((ev) => (
            <div key={ev.id} className="op-evidence-item">
              {ev.preview ? (
                <img src={ev.preview} alt={ev.nombre} className="op-evidence-thumb" />
              ) : (
                <div className="op-evidence-file">{ev.nombre}</div>
              )}
              <span className="op-evidence-label">{ev.clasificacion}</span>
              <button type="button" className="op-evidence-remove" onClick={() => remove(ev.id)}>&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

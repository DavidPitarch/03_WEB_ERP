export function isValidEvidenceStoragePath(expedienteId: string, storagePath: string): boolean {
  const normalized = storagePath.trim().replace(/\\/g, '/');
  const expectedPrefix = `evidencias/${expedienteId}/`;

  return normalized.startsWith(expectedPrefix) && !normalized.includes('..');
}

export function isValidEvidenceStoragePath(expedienteId, storagePath) {
    const normalized = storagePath.trim().replace(/\\/g, '/');
    const expectedPrefix = `evidencias/${expedienteId}/`;
    return normalized.startsWith(expectedPrefix) && !normalized.includes('..');
}

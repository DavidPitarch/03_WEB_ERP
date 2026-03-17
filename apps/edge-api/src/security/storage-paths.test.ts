import { describe, expect, it } from 'vitest';
import { isValidEvidenceStoragePath } from './storage-paths';

describe('isValidEvidenceStoragePath', () => {
  it('accepts storage paths under the expediente prefix', () => {
    expect(isValidEvidenceStoragePath('exp-1', 'evidencias/exp-1/file.jpg')).toBe(true);
    expect(isValidEvidenceStoragePath('exp-1', 'evidencias\\exp-1\\folder\\file.jpg')).toBe(true);
  });

  it('rejects paths pointing to another expediente', () => {
    expect(isValidEvidenceStoragePath('exp-1', 'evidencias/exp-2/file.jpg')).toBe(false);
  });

  it('rejects traversal attempts', () => {
    expect(isValidEvidenceStoragePath('exp-1', 'evidencias/exp-1/../exp-2/file.jpg')).toBe(false);
  });
});

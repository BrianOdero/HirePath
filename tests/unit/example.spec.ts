import { describe, expect, test } from 'vitest';
import { parseJobDescription } from '@/core/services/mockInterviewApi';

describe('parseJobDescription', () => {
  test('extracts role and company from a title line', () => {
    const { role, company } = parseJobDescription(
      'Senior Frontend Engineer at M-KOPA\nWe are hiring a senior frontend engineer.'
    );
    expect(role).toBe('Senior Frontend Engineer');
    expect(company).toBe('M-KOPA');
  });

  test('falls back to first content line when no company pattern matches', () => {
    const { role, company } = parseJobDescription('Data Analyst needed for a fast-growing team');
    expect(role).toBe('Data Analyst needed for a fast-growing team');
    expect(company.length).toBeGreaterThan(0);
  });
});

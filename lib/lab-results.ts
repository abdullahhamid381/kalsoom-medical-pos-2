import Database from 'better-sqlite3';

export type RefRange = {
  id: number;
  test_id: number;
  gender: 'any' | 'male' | 'female';
  age_min: number;
  age_max: number;
  value_type: 'numeric' | 'text';
  low: number | null;
  high: number | null;
  unit: string | null;
  normal_text: string | null;
  critical_low: number | null;
  critical_high: number | null;
  notes: string | null;
};

/** Picks the best-matching reference range for a test given the patient's age/gender.
 *  Gender-specific rows outrank 'any'; among ties, the narrower age band wins. */
export function resolveReferenceRange(
  db: Database.Database,
  testId: number,
  ageYears: number | null,
  gender: string | null
): RefRange | null {
  const g = (gender || 'any').toLowerCase();
  const age = ageYears ?? 30; // sensible adult default when patient age is unknown
  const range = db
    .prepare(
      `SELECT * FROM lab_test_reference_ranges
       WHERE test_id = ? AND age_min <= ? AND age_max >= ? AND (gender = ? OR gender = 'any')
       ORDER BY (gender != 'any') ASC, (age_max - age_min) ASC
       LIMIT 1`
    )
    .get(testId, age, age, g) as RefRange | undefined;
  return range || null;
}

/** Compares a numeric value against a resolved range and returns the flag. Critical bounds win over low/high. */
export function computeFlag(range: RefRange | null, valueNumeric: number | null): 'low' | 'normal' | 'high' | 'critical' | null {
  if (!range || valueNumeric == null) return null;
  if (range.critical_low != null && valueNumeric <= range.critical_low) return 'critical';
  if (range.critical_high != null && valueNumeric >= range.critical_high) return 'critical';
  if (range.low != null && valueNumeric < range.low) return 'low';
  if (range.high != null && valueNumeric > range.high) return 'high';
  return 'normal';
}

/** Suggests a flag for a free-text result: 'normal' on a case/whitespace-insensitive match to normal_text, else null. */
export function computeTextFlag(range: RefRange | null, valueText: string | null): 'normal' | null {
  if (!range || !valueText || !range.normal_text) return null;
  return valueText.trim().toLowerCase() === range.normal_text.trim().toLowerCase() ? 'normal' : null;
}

export function formatRangeDisplay(range: RefRange | null): string {
  if (!range) return '—';
  if (range.value_type === 'text') return range.normal_text || '—';
  if (range.low != null && range.high != null) return `${range.low} - ${range.high}${range.unit ? ' ' + range.unit : ''}`;
  if (range.high != null) return `< ${range.high}${range.unit ? ' ' + range.unit : ''}`;
  if (range.low != null) return `> ${range.low}${range.unit ? ' ' + range.unit : ''}`;
  return '—';
}

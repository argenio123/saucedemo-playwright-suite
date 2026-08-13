import type { TestInfo } from '@playwright/test';

/**
 * Structured case reporting, mirroring the convention already used by the
 * CMSAP suite in tests/helpers.ts: every test contributes one row keyed by its
 * TC number so the run can be reconciled against the written test plan.
 *
 * Tests only annotate. The rows are assembled and written by CaseReporter in
 * utils/case-reporter.ts, which runs in the main process - writing from inside
 * the tests races between parallel workers and loses rows.
 */

export type CaseResult = {
  tc: string;
  title: string;
  status: 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
  actual: string;
  durationMs: number;
  defect?: string;
  remarks?: string;
};

/**
 * Attach the observed behaviour to the running test. Whatever is noted here
 * becomes the "actual result" column of the report, which is what a reviewer
 * reads - so write it as a sentence, not as a variable dump.
 */
export function note(testInfo: TestInfo, actual: string) {
  testInfo.annotations.push({ type: 'actual', description: actual });
}

/** Flag a defect reference against the running test. */
export function defect(testInfo: TestInfo, id: string, remarks?: string) {
  testInfo.annotations.push({ type: 'defect', description: id });
  if (remarks) testInfo.annotations.push({ type: 'remarks', description: remarks });
}

export function tcFromTitle(title: string): string | null {
  return title.match(/TC-\d{3}/)?.[0] ?? null;
}

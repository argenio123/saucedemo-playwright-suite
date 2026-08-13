import * as fs from 'fs';
import * as path from 'path';
import type {
  FullConfig, FullResult, Reporter, Suite, TestCase, TestResult,
} from '@playwright/test/reporter';
import { tcFromTitle, type CaseResult } from './report';

/**
 * Writes one row per TC number into results/saucedemo/case-results.{json,csv}.
 *
 * This is a reporter rather than an afterEach hook on purpose. Hooks run inside
 * the worker processes, so with fullyParallel enabled four workers race on the
 * same file and rows are silently lost - which is exactly what happened on the
 * first run of this suite (27 of 56 cases survived). Reporters run once, in the
 * main process, and see every result.
 */
class CaseReporter implements Reporter {
  private readonly rows = new Map<string, CaseResult>();
  private readonly outputDir = 'results';

  onBegin(_config: FullConfig, _suite: Suite) {
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const tc = tcFromTitle(test.title);
    if (!tc) return;

    // Retries produce several results for one case; the last one is the truth.
    const previous = this.rows.get(tc);
    if (previous && result.retry < (previous as any).__retry) return;

    const annotations = [
      ...((result as any).annotations ?? []),
      ...test.annotations,
    ] as Array<{ type: string; description?: string }>;

    const collect = (type: string) =>
      annotations
        .filter(a => a.type === type && a.description)
        .map(a => a.description!.trim())
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(' ');

    const observed = collect('actual');
    const failure = result.errors
      .map(e => (e.message ?? '').replace(/\[\d+m/g, '').split('\n')[0].trim())
      .filter(Boolean)
      .join(' | ');

    const status: CaseResult['status'] =
      result.status === 'passed' ? 'PASSED'
        : result.status === 'skipped' ? 'SKIPPED'
          : 'FAILED';

    const row: CaseResult = {
      tc,
      title: test.title.replace(/^TC-\d{3}\s*/, ''),
      status,
      actual: observed || failure || 'Executed as specified.',
      durationMs: result.duration,
      defect: collect('defect') || undefined,
      remarks: collect('remarks') || undefined,
    };
    (row as any).__retry = result.retry;
    this.rows.set(tc, row);
  }

  onEnd(_result: FullResult) {
    const rows = [...this.rows.values()]
      .sort((a, b) => a.tc.localeCompare(b.tc, undefined, { numeric: true }))
      .map(({ ...r }) => {
        delete (r as any).__retry;
        return r;
      });

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(this.outputDir, 'case-results.json'),
      JSON.stringify(rows, null, 1),
    );

    // A CSV as well, because the written test plan is maintained in a sheet.
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Test Case ID', 'Title', 'Status', 'Actual Result', 'Defect', 'Remarks', 'Duration (ms)'].join(','),
      ...rows.map(r => [
        esc(r.tc), esc(r.title), esc(r.status), esc(r.actual),
        esc(r.defect ?? ''), esc(r.remarks ?? ''), r.durationMs,
      ].join(',')),
    ].join('\n');
    fs.writeFileSync(path.join(this.outputDir, 'case-results.csv'), csv, 'utf8');

    const passed = rows.filter(r => r.status === 'PASSED').length;
    const failed = rows.filter(r => r.status === 'FAILED').length;
    const defects = [...new Set(rows.map(r => r.defect).filter(Boolean))];

    console.log(`\nCase report: ${rows.length} case(s) - ${passed} passed, ${failed} failed.`);
    if (defects.length) console.log(`Defects raised: ${defects.join(', ')}`);
    console.log(`Written to ${this.outputDir}/case-results.json and .csv`);
  }
}

export default CaseReporter;

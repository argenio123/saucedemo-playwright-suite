import { test, expect } from '../fixtures/test';
import { note, defect } from '../utils/report';
import * as fs from 'fs';

/**
 * Bridges the k6 load test into Testomat.io.
 *
 * The k6 step in the Performance workflow writes k6-summary.json. This test
 * reads it, turns k6's threshold results into a single pass/fail case, and
 * reports it through the Testomat.io reporter that is already wired into
 * playwright.config.ts. The effect: k6's server-side load result appears in
 * Testomat.io as TC-063, alongside the Playwright cases, with the key numbers
 * and - when the run streamed to Grafana - a link to the dashboard.
 *
 * Testomat.io shows the verdict and the headline metrics; Grafana holds the
 * full charts. The link joins the two.
 */

const SUMMARY = 'k6-summary.json';

test.describe('k6 performance results @Sdb4ab150', () => {

  test('TC-063 k6 load test meets its performance thresholds @T18c64d40', async ({}, testInfo) => {
    if (!fs.existsSync(SUMMARY)) {
      note(testInfo, `No k6 summary was produced (${SUMMARY} not found), so the load-test result could not be evaluated. The k6 step must run before this test and export its summary.`);
      test.skip(true, `${SUMMARY} not found`);
      return;
    }

    const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
    const metrics: Record<string, any> = summary.metrics ?? {};

    // In k6's summary export, a threshold value is `true` when it was breached
    // (failed) and `false` when it held. Collect every breach.
    const breaches: string[] = [];
    for (const [metricName, m] of Object.entries(metrics)) {
      const thresholds = m?.thresholds;
      if (!thresholds) continue;
      for (const [expr, breached] of Object.entries(thresholds)) {
        if (breached === true) breaches.push(`${metricName} ${expr}`);
      }
    }

    // Headline numbers, defended against metrics that may be absent.
    const p95 = metrics.http_req_duration?.['p(95)'];
    const avg = metrics.http_req_duration?.avg;
    const errorRate = metrics.http_req_failed?.value;
    const checks = metrics.checks;
    const httpReqs = metrics.http_reqs?.count;
    const grafanaUrl = process.env.K6_GRAFANA_RUN_URL;

    const fmt = (n: unknown, d = 2) => (typeof n === 'number' ? n.toFixed(d) : 'n/a');

    const headline = [
      httpReqs != null ? `${httpReqs} requests` : null,
      avg != null ? `avg ${fmt(avg)} ms` : null,
      p95 != null ? `p95 ${fmt(p95)} ms` : null,
      errorRate != null ? `error rate ${fmt((errorRate as number) * 100)}%` : null,
      checks ? `${checks.passes}/${checks.passes + checks.fails} checks passed` : null,
    ].filter(Boolean).join(', ');

    const verdict = breaches.length
      ? `Thresholds breached: ${breaches.join('; ')}.`
      : 'All performance thresholds were met.';

    note(testInfo, `k6 executed the server-side load test: ${headline}. ${verdict}${grafanaUrl ? ` Grafana dashboard: ${grafanaUrl}` : ''}`);

    if (breaches.length) {
      defect(testInfo, 'PERF-K6-001', `k6 thresholds breached: ${breaches.join('; ')}.`);
    }

    expect(breaches, 'every k6 threshold must be met').toHaveLength(0);
  });
});

import { test, expect } from '../fixtures/test';
import { note, defect } from '../utils/report';
import * as fs from 'fs';

/**
 * Bridges the k6 load test into Testomat.io.
 *
 * The k6 step in the Performance workflow writes k6-summary.json. These tests
 * read it and turn k6's server-side metrics into individual pass/fail cases,
 * reported through the Testomat.io reporter wired into playwright.config.ts.
 * The effect: k6's load-test result appears in Testomat.io alongside the
 * Playwright cases, and - when the run streamed to Grafana - each carries a
 * link to the dashboard.
 *
 * TC-063 is the overall threshold gate. TC-064 to TC-070 break the result down
 * one metric at a time, so a reviewer sees exactly which dimension regressed
 * rather than a single red light.
 *
 * Testomat.io shows the verdict and the numbers; Grafana holds the full charts.
 */

const SUMMARY = 'k6-summary.json';

type Metrics = Record<string, any>;

/** Load the k6 metrics, or null when the summary is absent. */
function loadMetrics(): Metrics | null {
  if (!fs.existsSync(SUMMARY)) return null;
  const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
  return summary.metrics ?? {};
}

const fmt = (n: unknown, d = 2) => (typeof n === 'number' ? n.toFixed(d) : 'n/a');
const grafana = () => {
  const url = process.env.K6_GRAFANA_RUN_URL;
  return url ? ` Grafana dashboard: ${url}` : '';
};

test.describe('k6 performance results @Sdb4ab150', () => {

  test('TC-063 k6 load test meets its performance thresholds @T18c64d40', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) {
      note(testInfo, `No k6 summary was produced (${SUMMARY} not found), so the load-test result could not be evaluated. The k6 step must run before this test and export its summary.`);
      test.skip(true, `${SUMMARY} not found`);
      return;
    }

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

    const p95 = metrics.http_req_duration?.['p(95)'];
    const avg = metrics.http_req_duration?.avg;
    const errorRate = metrics.http_req_failed?.value;
    const checks = metrics.checks;
    const httpReqs = metrics.http_reqs?.count;

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

    note(testInfo, `k6 executed the server-side load test: ${headline}. ${verdict}${grafana()}`);
    if (breaches.length) defect(testInfo, 'PERF-K6-001', `k6 thresholds breached: ${breaches.join('; ')}.`);
    expect(breaches, 'every k6 threshold must be met').toHaveLength(0);
  });

  test('TC-064 Request failure rate stays under one percent @T39af5c52', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) { test.skip(true, `${SUMMARY} not found`); return; }
    const BUDGET = 0.01;

    const rate = metrics.http_req_failed?.value;
    expect(rate, 'http_req_failed must be reported').not.toBeUndefined();
    expect.soft(rate as number, 'request failure rate').toBeLessThan(BUDGET);

    note(testInfo, `The server-side failure rate was ${fmt((rate as number) * 100)}% against a ${BUDGET * 100}% budget - the proportion of requests the server did not answer successfully under load.${grafana()}`);
    if ((rate as number) >= BUDGET) defect(testInfo, 'PERF-K6-002', `Failure rate ${fmt((rate as number) * 100)}% exceeds ${BUDGET * 100}%.`);
  });

  test('TC-065 The 95th percentile response time is within budget @Tb4e6375a', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) { test.skip(true, `${SUMMARY} not found`); return; }
    const BUDGET_MS = 1000;

    const p95 = metrics.http_req_duration?.['p(95)'];
    expect(p95, 'p(95) must be reported').not.toBeUndefined();
    expect.soft(p95 as number, 'p95 response time').toBeLessThan(BUDGET_MS);

    note(testInfo, `The 95th-percentile response time was ${fmt(p95)} ms against a ${BUDGET_MS} ms budget - the slowest experience for all but the worst 5% of requests, the standard tail-latency guard.${grafana()}`);
    if ((p95 as number) >= BUDGET_MS) defect(testInfo, 'PERF-K6-003', `p95 ${fmt(p95)} ms exceeds ${BUDGET_MS} ms.`);
  });

  test('TC-066 The 90th percentile response time is within budget @Tf9fca052', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) { test.skip(true, `${SUMMARY} not found`); return; }
    const BUDGET_MS = 800;

    const p90 = metrics.http_req_duration?.['p(90)'];
    expect(p90, 'p(90) must be reported').not.toBeUndefined();
    expect.soft(p90 as number, 'p90 response time').toBeLessThan(BUDGET_MS);

    note(testInfo, `The 90th-percentile response time was ${fmt(p90)} ms against a ${BUDGET_MS} ms budget - the experience for the bulk of users once the fastest nine in ten are set aside.${grafana()}`);
    if ((p90 as number) >= BUDGET_MS) defect(testInfo, 'PERF-K6-004', `p90 ${fmt(p90)} ms exceeds ${BUDGET_MS} ms.`);
  });

  test('TC-067 The average response time is within budget @Tc716b8ed', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) { test.skip(true, `${SUMMARY} not found`); return; }
    const BUDGET_MS = 600;

    const avg = metrics.http_req_duration?.avg;
    expect(avg, 'avg must be reported').not.toBeUndefined();
    expect.soft(avg as number, 'average response time').toBeLessThan(BUDGET_MS);

    note(testInfo, `The average response time under load was ${fmt(avg)} ms against a ${BUDGET_MS} ms budget. The average is easily skewed by outliers, so it is read alongside the percentile cases rather than alone.${grafana()}`);
    if ((avg as number) >= BUDGET_MS) defect(testInfo, 'PERF-K6-005', `Average ${fmt(avg)} ms exceeds ${BUDGET_MS} ms.`);
  });

  test('TC-068 Every functional check passes under load @Tf8203cc7', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) { test.skip(true, `${SUMMARY} not found`); return; }

    const checks = metrics.checks;
    expect(checks, 'checks must be reported').not.toBeUndefined();
    const passes = checks?.passes ?? 0;
    const fails = checks?.fails ?? 0;
    expect.soft(fails, 'failed checks under load').toBe(0);

    note(testInfo, `${passes} of ${passes + fails} functional checks passed while the system was under load - the status-code and body assertions in the k6 script held up at concurrency, not only for a single request.${grafana()}`);
    if (fails > 0) defect(testInfo, 'PERF-K6-006', `${fails} functional check(s) failed under load.`);
  });

  test('TC-069 Throughput meets the minimum request rate @T875cda61', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) { test.skip(true, `${SUMMARY} not found`); return; }
    const MIN_RPS = 1;

    const rate = metrics.http_reqs?.rate;
    const count = metrics.http_reqs?.count;
    expect(rate, 'http_reqs rate must be reported').not.toBeUndefined();
    expect.soft(rate as number, 'requests per second').toBeGreaterThanOrEqual(MIN_RPS);

    note(testInfo, `The system sustained ${fmt(rate)} requests per second (${count ?? 'n/a'} in total) against a floor of ${MIN_RPS} req/s. A collapse in throughput is a sign the server is shedding or queueing load rather than serving it.${grafana()}`);
    if ((rate as number) < MIN_RPS) defect(testInfo, 'PERF-K6-007', `Throughput ${fmt(rate)} req/s is below the ${MIN_RPS} req/s floor.`);
  });

  test('TC-070 The slowest response has no severe outlier @Te8e03c2d', async ({}, testInfo) => {
    const metrics = loadMetrics();
    if (!metrics) { test.skip(true, `${SUMMARY} not found`); return; }
    const BUDGET_MS = 3000;

    const max = metrics.http_req_duration?.max;
    expect(max, 'max must be reported').not.toBeUndefined();
    expect.soft(max as number, 'slowest single response').toBeLessThan(BUDGET_MS);

    note(testInfo, `The slowest single response was ${fmt(max)} ms against a ${BUDGET_MS} ms ceiling. The percentile cases can stay green while one request stalls badly; this case catches that worst-case outlier.${grafana()}`);
    if ((max as number) >= BUDGET_MS) defect(testInfo, 'PERF-K6-008', `Slowest response ${fmt(max)} ms exceeds ${BUDGET_MS} ms.`);
  });
});

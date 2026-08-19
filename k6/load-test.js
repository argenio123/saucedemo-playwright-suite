import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Server-side load test.
 *
 * TARGET POLICY - read before changing BASE_URL.
 * Generating concurrent load against a host you do not own is indistinguishable
 * from a denial-of-service attack. SauceDemo belongs to Sauce Labs and MUST NOT
 * be used here. The default target below, test.k6.io, is published by Grafana
 * specifically to receive load tests. Point this at your own deployed
 * application or another sandbox you control - never at a third-party site.
 */
const BASE_URL = __ENV.BASE_URL || 'https://test.k6.io';

export const options = {
  // Grafana Cloud k6 settings. Used only when the run is sent to the cloud
  // (cloud-run-locally: false in the workflow); ignored on a pure local run.
  // projectID ties the run to the "Default project" in the k6 app, which is
  // what makes it appear under Testing & synthetics -> Performance.
  cloud: {
    projectID: 8414590,
    distribution: {
      ashburn: { loadZone: 'amazon:us:ashburn', percent: 100 },
    },
  },
  stages: [
    { duration: '30s', target: 10 }, // ramp up to 10 virtual users
    { duration: '1m', target: 10 },  // hold at 10
    { duration: '30s', target: 0 },  // ramp down
  ],
  // Thresholds turn this from a report into a gate: k6 exits non-zero when one
  // is breached, which fails the GitHub Actions job.
  thresholds: {
    http_req_failed: ['rate<0.01'],    // under 1% of requests may error
    http_req_duration: ['p(95)<800'],  // 95th percentile under 800 ms
    checks: ['rate>0.99'],             // over 99% of checks must pass
  },
};

export default function () {
  const res = http.get(BASE_URL);

  check(res, {
    'status is 200': r => r.status === 200,
    'body is not empty': r => (r.body ? r.body.length > 0 : false),
  });

  sleep(1);
}

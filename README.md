# SauceDemo Test Automation Suite

Playwright + TypeScript regression suite for <https://www.saucedemo.com/>, built
on the Page Object Model, with a k6 + Grafana Cloud performance layer wired into
the same Testomat.io and GitHub Actions pipeline.

**70 test cases, TC-001 to TC-070:**

- **TC-001 to TC-056** — functional regression (auth, catalogue, cart, checkout, e2e)
- **TC-057 to TC-062** — client-side performance measured with Playwright
- **TC-063 to TC-070** — server-side load performance measured with k6, streamed to Grafana

Last verified: 19 Aug 2026.

## Quick start

```
npm install
npx playwright install chromium
npm test
```

The functional and Playwright performance cases run with no extra setup. The k6
cases (TC-063 to TC-070) need a k6 summary present - see **Performance testing**
below.

## Layout

```
saucedemo_playwright_august_2026/
├── data/                       Reference data - the source of truth
│   ├── users.ts                  The six published accounts and their behaviour
│   └── products.ts               Names, prices, tax rate, checkout customer
├── pages/                      Page Objects, one per screen
│   ├── login.page.ts
│   ├── inventory.page.ts
│   ├── cart.page.ts
│   └── checkout.page.ts
├── fixtures/
│   └── test.ts                 Custom fixtures: page objects, shopper, diagnostics
├── utils/
│   ├── report.ts               note() / defect() annotation helpers
│   └── case-reporter.ts        Writes the TC-numbered case report (JSON + CSV)
├── k6/
│   └── load-test.js            k6 load script (thresholds + Grafana Cloud config)
├── specs/
│   ├── 01-authentication.spec.ts        TC-001 to TC-015
│   ├── 02-inventory.spec.ts             TC-016 to TC-026
│   ├── 03-cart.spec.ts                  TC-027 to TC-036
│   ├── 04-checkout.spec.ts              TC-037 to TC-048
│   ├── 05-e2e-and-nonfunctional.spec.ts TC-049 to TC-056
│   ├── 06-performance.spec.ts           TC-057 to TC-062  (Playwright client-side)
│   └── 07-k6-performance-result.spec.ts TC-063 to TC-070  (k6 result bridge)
├── .github/workflows/
│   └── saucedemo.yml           CI: runs k6, then the suite; launchable from Testomat.io
└── playwright.config.ts
```

## Commands

| Command | What it does |
|---|---|
| `npm test` | Full suite, 4 workers, headless |
| `npm run test:headed` | Visible browser, single worker |
| `npm run test:debug` | Playwright Inspector, step through |
| `npm run test:cart` | One spec (also `:auth`, `:inventory`, `:checkout`, `:e2e`) |
| `npm run report` | Open the HTML report |
| `k6 run --summary-export=k6-summary.json k6/load-test.js` | Run the load test locally and produce the summary the k6 cases read |

Do not pass `--reporter=` on the command line - it replaces the reporter list in
the config and the TC case report will not be written.

## Output

| Path | Contents |
|---|---|
| `results/case-results.json` | One row per TC number with the observed result |
| `results/case-results.csv` | The same rows, for the test plan spreadsheet |
| `results/html/` | Playwright HTML report with traces and video |
| `results/evidence/` | Screenshots captured by specific cases |
| `k6-summary.json` | k6 metrics (git-ignored; produced at runtime) |

## Functional result: known defect detections

**Five functional failures are correct.** SauceDemo publishes four deliberately
defective accounts. These cases exist to prove the suite detects faults, not to
confirm a happy path.

| Case | Defect | What is detected |
|---|---|---|
| TC-026 | DEF-SD-002 | `problem_user` serves one image for all six products |
| TC-048 | DEF-SD-003 | An empty cart can be checked out to a $0.00 order |
| TC-052 | DEF-SD-005 | `problem_user` checkout form does not retain typed input |
| TC-053 | DEF-SD-006 | `error_user` cannot add three products or complete an order |
| TC-054 | DEF-SD-007 | `visual_user` renders the cart control 186 px out of position |

DEF-SD-004 is recorded as a note rather than a failure: `performance_glitch_user`
signs in around 5 seconds slower than the reference account, inside the agreed
20-second budget but worth tracking.

**TC-048 is the only application-design finding** among the five - the others are
faults SauceDemo injects on purpose. An empty cart reaching a $0.00 order is a
genuine gap and would be worth raising with a BA on a real product.

The CI workflow encodes this: it fails the build only if a case outside those
five fails, so a real regression is never hidden by the expected red.

## Performance testing

Two independent layers, both reported into Testomat.io.

### Client-side (Playwright, TC-057 to TC-062)

Measured against SauceDemo itself. Single-session, browser-paced measurement -
the same footprint as the functional suite, so it is a legitimate observation of
one user's experience, not load. Covers page load and TTFB, First and Largest
Contentful Paint, page weight, per-step checkout timing, and the slow account's
degraded budget.

### Server-side load (k6 + Grafana, TC-063 to TC-070)

`k6/load-test.js` ramps to 10 virtual users against **`test.k6.io`** (Grafana's
public load sandbox - never SauceDemo, which is third-party infrastructure) and
enforces thresholds. When authenticated it streams to Grafana Cloud k6 for the
full charts.

`specs/07-k6-performance-result.spec.ts` reads `k6-summary.json` and turns k6's
metrics into Testomat.io cases:

| Case | Asserts | Budget |
|---|---|---|
| TC-063 | All k6 thresholds met (overall gate) | — |
| TC-064 | Request failure rate | < 1% |
| TC-065 | p95 response time (tail latency) | < 1000 ms |
| TC-066 | p90 response time | < 800 ms |
| TC-067 | Average response time | < 600 ms |
| TC-068 | Functional checks under load | 0 failures |
| TC-069 | Throughput (requests/second) | ≥ 1 req/s |
| TC-070 | Worst-case single response | < 3000 ms |

TC-063 is the overall gate; TC-064 to TC-070 break the result down so a reviewer
sees *which* dimension regressed rather than one red light. Each carries a defect
id (`PERF-K6-001` to `008`) and, when the run streamed to Grafana, the dashboard
link.

Budgets are deliberately lenient: GitHub runners and shared sandboxes are slower
and noisier than a developer machine, so the thresholds catch a gross regression,
not milliseconds. Treat the recorded numbers as the signal.

## The round trip: Testomat.io ↔ GitHub Actions ↔ Grafana

```
Testomat.io  ── select a folder, Launch on CI ──▶  GitHub Actions (saucedemo.yml)
     ▲                                                 1. install k6
     │  cases show pass/fail + metrics                 2. authenticate to Grafana
     │  + Grafana dashboard link                       3. run k6 ──stream──▶ Grafana
     │                                                 4. capture the Grafana run URL
     └────────── Playwright reports results ◀────────  5. run the Playwright suite
```

Because the workflow runs **k6 before** the Playwright suite, launching any
folder from Testomat.io works: the k6 cases find their `k6-summary.json` and run
instead of skipping. If k6 never ran (e.g. a workflow that only runs Playwright),
TC-063 to TC-070 skip by design rather than reporting a result they do not have.

Grafana holds the charts; Testomat.io shows the verdict, the headline numbers,
and a link across to the dashboard. Testomat.io does not embed Grafana's graphs -
it is a test-management tool, not a dashboard.

## Design notes

- **Expectations live in `data/`, never read from the application.** If a price
  changes in the app, TC-018 fails. A suite that reads its expectations from the
  system under test cannot detect a regression in that system.
- **Reporting is a Playwright reporter, not an `afterEach` hook.** Hooks run in
  worker processes; with four parallel workers they race on the results file and
  lose rows - observed on the first run, where 27 of 56 cases survived. Reporters
  run once, in the main process.
- **Defect probes use `expect.soft()`** so a case records the complete observed
  behaviour before failing, instead of stopping at the first assertion.
- **The `shopper` fixture resets app state on teardown**, because SauceDemo
  persists the cart client-side and it would otherwise leak between tests.
- **Tax rounds, it does not truncate.** Confirmed against the application: an
  item total of $29.99 produces $2.40, not $2.39.
- **k6 never targets SauceDemo.** A load test generates concurrent traffic;
  aiming that at infrastructure you do not own is a denial-of-service. The load
  sandbox `test.k6.io` exists to receive it.

## Testomat.io

Set the API key first. Copy `.env.example` to `.env` and fill it in, or set
`TESTOMATIO` in your shell for the session.

**Import the test cases:**

```
npm run testomatio:preview      # lists what would be imported, sends nothing
npm run testomatio:import       # creates the suites and cases
npm run testomatio:update-ids   # writes the @T ids back into the spec files
```

Run `testomatio:update-ids` once. The ids it writes are what stop every later
sync from creating duplicate cases, and are what the CI grep filter matches.

**Report run results:** with `TESTOMATIO` set, `npm test` pushes the run
automatically - the reporter is wired into `playwright.config.ts` and stays
silent when the variable is absent.

**Launch from Testomat.io:** Runs → New Run → select a folder (e.g. *k6
performance results*) → Launch on CI. Testomat.io dispatches the workflow with
the selected case ids as the `grep` input; the workflow runs k6, then the
selected cases, and reports back.

## CI

`.github/workflows/saucedemo.yml` runs on push to `main`, on a weekday schedule,
and on manual dispatch. The manual trigger is what Testomat.io calls when you
launch a run from its UI. It installs k6, runs the load test (streaming to
Grafana when authenticated), then runs the Playwright suite.

**Repository secrets** (Settings → Secrets and variables → Actions - never commit):

| Secret | Purpose | Required? |
|---|---|---|
| `TESTOMATIO` | Report results to Testomat.io | Yes |
| `K6_CLOUD_TOKEN` | Stream k6 to Grafana Cloud (a k6 **Stack token**, not a Grafana service-account token) | Optional |
| `K6_CLOUD_PROJECT_ID` | Grafana k6 project the run belongs to | Optional |

Without the two k6 secrets, k6 still runs locally on the runner and the k6 cases
still report their metrics to Testomat.io - only the Grafana dashboard link is
absent. The Grafana stack slug is set in the workflow (`--stack <slug>`) and in
`k6/load-test.js` (`options.cloud.projectID`); update both if the project moves.

# SauceDemo Test Automation Suite

Playwright + TypeScript regression suite for <https://www.saucedemo.com/>, built
on the Page Object Model. **56 test cases, TC-001 to TC-056.**

Last verified: 13 Aug 2026 - 51 passed, 5 defect detections (see below).

## Quick start

```
npm install
npx playwright install chromium
npm test
```

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
├── specs/
│   ├── 01-authentication.spec.ts        TC-001 to TC-015
│   ├── 02-inventory.spec.ts             TC-016 to TC-026
│   ├── 03-cart.spec.ts                  TC-027 to TC-036
│   ├── 04-checkout.spec.ts              TC-037 to TC-048
│   └── 05-e2e-and-nonfunctional.spec.ts TC-049 to TC-056
├── .github/workflows/
│   └── saucedemo.yml           CI, launchable from Testomat.io
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

Do not pass `--reporter=` on the command line - it replaces the reporter list in
the config and the TC case report will not be written.

## Output

| Path | Contents |
|---|---|
| `results/case-results.json` | One row per TC number with the observed result |
| `results/case-results.csv` | The same rows, for the test plan spreadsheet |
| `results/html/` | Playwright HTML report with traces and video |
| `results/evidence/` | Screenshots captured by specific cases |

## Expected result: 51 pass, 5 fail

**The five failures are correct.** SauceDemo publishes four deliberately
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

## Design notes

- **Expectations live in `data/`, never read from the application.** If a price
  changes in the app, TC-018 fails. A suite that reads its expectations from the
  system under test cannot detect a regression in that system.
- **Reporting is a Playwright reporter, not an `afterEach` hook.** Hooks run in
  worker processes; with four parallel workers they race on the results file and
  lose rows - observed on the first run of this suite, where 27 of 56 cases
  survived. Reporters run once, in the main process.
- **Defect probes use `expect.soft()`** so a case records the complete observed
  behaviour before failing, instead of stopping at the first assertion.
- **The `shopper` fixture resets app state on teardown**, because SauceDemo
  persists the cart client-side and it would otherwise leak between tests.
- **Tax rounds, it does not truncate.** Confirmed against the application: an
  item total of $29.99 produces $2.40, not $2.39.

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
sync from creating duplicate cases.

**Report run results:** with `TESTOMATIO` set, `npm test` pushes the run
automatically - the reporter is wired into `playwright.config.ts` and stays
silent when the variable is absent.

**Known gap:** the importer parses source statically and reports **51** tests,
not 56. TC-010 to TC-015 are generated by a loop in `01-authentication.spec.ts`
and appear to it as a single templated entry. Either add those five manually in
Testomat.io, or unroll the loop into six explicit `test(...)` calls.

## CI

`.github/workflows/saucedemo.yml` runs on push to `main`, on a weekday schedule,
and on manual dispatch. The manual trigger is what Testomat.io calls when you
launch a run from its UI.

Required repository secret: **`TESTOMATIO`** - your project API key. Add it under
Settings → Secrets and variables → Actions. Never commit it.

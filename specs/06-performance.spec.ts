import { test, expect } from '../fixtures/test';
import { LoginPage } from '../pages/login.page';
import { InventoryPage } from '../pages/inventory.page';
import { note, defect } from '../utils/report';

/**
 * Client-side performance measurement against SauceDemo.
 * Covers TC-057 to TC-062.
 *
 * This is single-session, browser-paced measurement - the same traffic
 * footprint as the functional suite - so it is a legitimate observation of
 * how the application performs for one user. It is NOT load testing: no
 * concurrency is generated. Server-side load is exercised separately by the
 * k6 job, which targets a sandbox built to receive load, never SauceDemo.
 *
 * Budgets are deliberately lenient. GitHub's shared runners are slower and
 * noisier than a developer machine, so these thresholds are set to catch a
 * gross regression, not to police milliseconds. Treat the recorded numbers as
 * the signal and the pass/fail as a guard rail.
 */

/** Read the Navigation Timing entry for the current page. */
async function navigationTiming(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      load: Math.round(nav.loadEventEnd - nav.startTime),
      transferKB: Math.round(nav.transferSize / 1024),
    };
  });
}

/**
 * First Contentful Paint, in milliseconds, or null if the browser never
 * reports it. The paint entry can lag the load event, so this waits for it via
 * PerformanceObserver rather than reading once and giving up.
 */
async function firstContentfulPaint(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<number | null>(resolve => {
        const existing = performance.getEntriesByName('first-contentful-paint')[0];
        if (existing) {
          resolve(Math.round(existing.startTime));
          return;
        }
        const observer = new PerformanceObserver(list => {
          const fcp = list.getEntriesByName('first-contentful-paint')[0];
          if (fcp) {
            observer.disconnect();
            resolve(Math.round(fcp.startTime));
          }
        });
        observer.observe({ type: 'paint', buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 3000);
      }),
  );
}

/** Largest Contentful Paint via PerformanceObserver, with a settle timeout. */
async function largestContentfulPaint(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<number | null>(resolve => {
        let last = 0;
        const observer = new PerformanceObserver(list => {
          const entries = list.getEntries();
          last = entries[entries.length - 1].startTime;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        // LCP is only final once interaction or a quiet period settles it.
        setTimeout(() => {
          observer.disconnect();
          resolve(last ? Math.round(last) : null);
        }, 2500);
      }),
  );
}

/** Count and total transfer weight of every resource the page fetched. */
async function resourceProfile(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const bytes = res.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    return { count: res.length, totalKB: Math.round(bytes / 1024) };
  });
}

test.describe('Client-side performance', () => {

  test('TC-057 The login page loads within budget', async ({ page }, testInfo) => {
    const BUDGET_LOAD_MS = 6000;
    const BUDGET_TTFB_MS = 2000;

    await page.goto('/', { waitUntil: 'load' });
    const timing = await navigationTiming(page);

    expect.soft(timing.ttfb, 'time to first byte').toBeLessThan(BUDGET_TTFB_MS);
    expect.soft(timing.load, 'full page load').toBeLessThan(BUDGET_LOAD_MS);

    note(testInfo, `Login page navigation timing: TTFB ${timing.ttfb} ms (budget ${BUDGET_TTFB_MS}), DOMContentLoaded ${timing.domContentLoaded} ms, full load ${timing.load} ms (budget ${BUDGET_LOAD_MS}), initial document ${timing.transferKB} KB.`);

    if (timing.load >= BUDGET_LOAD_MS) {
      defect(testInfo, 'PERF-SD-001', `Login page load of ${timing.load} ms exceeds the ${BUDGET_LOAD_MS} ms budget.`);
    }
  });

  test('TC-058 First Contentful Paint on the login page is fast', async ({ page }, testInfo) => {
    const BUDGET_FCP_MS = 3000;

    await page.goto('/', { waitUntil: 'load' });
    const fcp = await firstContentfulPaint(page);

    expect.soft(fcp, 'FCP must be reported').not.toBeNull();
    if (fcp !== null) {
      expect.soft(fcp, 'first contentful paint').toBeLessThan(BUDGET_FCP_MS);
    }

    note(testInfo, `First Contentful Paint on the login page was ${fcp ?? 'not reported'} ms against a ${BUDGET_FCP_MS} ms budget - the point at which the user first sees content rather than a blank page.`);
  });

  test('TC-059 The catalogue renders within budget after login', async ({ page }, testInfo) => {
    const BUDGET_MS = 5000;
    const login = new LoginPage(page);
    const inventory = new InventoryPage(page);

    await login.goto();
    const started = Date.now();
    await login.loginExpectingSuccess('standard_user');
    await inventory.expectLoaded();
    const renderMs = Date.now() - started;

    const lcp = await largestContentfulPaint(page);

    expect.soft(renderMs, 'catalogue render after submit').toBeLessThan(BUDGET_MS);

    note(testInfo, `From login submit to a fully rendered catalogue took ${renderMs} ms against a ${BUDGET_MS} ms budget. Largest Contentful Paint on the catalogue was ${lcp ?? 'not reported'} ms.`);
  });

  test('TC-060 The catalogue page weight stays within budget', async ({ page }, testInfo) => {
    const BUDGET_REQUESTS = 40;
    const BUDGET_KB = 3000;
    const login = new LoginPage(page);
    const inventory = new InventoryPage(page);

    await login.goto();
    await login.loginExpectingSuccess('standard_user');
    await inventory.expectLoaded();

    const profile = await resourceProfile(page);

    expect.soft(profile.count, 'request count').toBeLessThan(BUDGET_REQUESTS);
    expect.soft(profile.totalKB, 'total transferred weight').toBeLessThan(BUDGET_KB);

    note(testInfo, `The catalogue fetched ${profile.count} resources totalling ${profile.totalKB} KB, against budgets of ${BUDGET_REQUESTS} requests and ${BUDGET_KB} KB. A rising request count or page weight is an early signal of front-end bloat.`);
  });

  test('TC-061 Each step of the purchase journey stays within budget', async ({ shopper, page, cartPage, checkoutPage }, testInfo) => {
    const STEP_BUDGET_MS = 4000;
    const steps: Record<string, number> = {};

    const timed = async (label: string, action: () => Promise<unknown>) => {
      const started = Date.now();
      await action();
      steps[label] = Date.now() - started;
    };

    await timed('add to cart', () => shopper.addToCart('Sauce Labs Backpack'));
    await timed('open cart', () => shopper.openCart());
    await timed('checkout', () => cartPage.checkout());
    await timed('overview', () => checkoutPage.proceedToOverview());
    await timed('finish', () => checkoutPage.finish());

    const breaches = Object.entries(steps).filter(([, ms]) => ms >= STEP_BUDGET_MS);
    for (const [, ms] of Object.entries(steps)) {
      expect.soft(ms, 'each journey step').toBeLessThan(STEP_BUDGET_MS);
    }

    const summary = Object.entries(steps).map(([k, v]) => `${k} ${v} ms`).join(', ');
    note(testInfo, `Each checkout step was timed against a ${STEP_BUDGET_MS} ms budget: ${summary}. ${breaches.length ? `Over budget: ${breaches.map(([k]) => k).join(', ')}.` : 'Every step was within budget.'}`);

    if (breaches.length) {
      defect(testInfo, 'PERF-SD-002', `Checkout steps over budget: ${breaches.map(([k, v]) => `${k} (${v} ms)`).join(', ')}.`);
    }
  });

  test('TC-062 The slow account stays within the degraded budget', async ({ page }, testInfo) => {
    // performance_glitch_user is SauceDemo's intentionally slow account. This
    // records the degradation rather than pretending it is fast, and guards a
    // looser ceiling so a genuine hang is still caught.
    const DEGRADED_BUDGET_MS = 20_000;
    const login = new LoginPage(page);
    const inventory = new InventoryPage(page);

    await login.goto();
    const started = Date.now();
    await login.loginExpectingSuccess('performance_glitch_user');
    await inventory.expectLoaded();
    const signInMs = Date.now() - started;

    expect.soft(signInMs, 'even the degraded account must not hang').toBeLessThan(DEGRADED_BUDGET_MS);

    note(testInfo, `performance_glitch_user reached the catalogue in ${signInMs} ms. This account is deliberately slow; the assertion guards a ${DEGRADED_BUDGET_MS} ms ceiling so a real hang is still distinguished from the expected degradation.`);
  });
});

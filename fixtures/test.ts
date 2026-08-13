import { test as base, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { InventoryPage } from '../pages/inventory.page';
import { CartPage } from '../pages/cart.page';
import { CheckoutPage } from '../pages/checkout.page';

/** Anything the browser complained about while a test was running. */
export type PageDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
};

type Fixtures = {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  /** Signed in as standard_user and sitting on the catalogue. */
  shopper: InventoryPage;
  diagnostics: PageDiagnostics;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },

  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },

  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },

  /**
   * Attaches listeners before the first navigation so nothing is missed, then
   * hands the collected faults to the test. Used by the non-functional specs.
   */
  diagnostics: async ({ page }, use) => {
    const diag: PageDiagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };

    page.on('console', msg => {
      if (msg.type() === 'error') diag.consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => diag.pageErrors.push(err.message));
    page.on('response', res => {
      if (res.status() >= 400) diag.failedRequests.push(`${res.status()} ${res.url()}`);
    });

    await use(diag);
  },

  shopper: async ({ loginPage, inventoryPage }, use) => {
    await loginPage.goto();
    await loginPage.loginExpectingSuccess('standard_user');
    await inventoryPage.expectLoaded();

    await use(inventoryPage);

    // Leave the account as it was found. The site persists the cart in local
    // storage, so without this the next test inherits the previous basket.
    await inventoryPage.resetAppState().catch(() => {});
  },
});

export { expect };
export type { Page };

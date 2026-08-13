import { expect, Locator, Page } from '@playwright/test';
import { CHECKOUT_CUSTOMER } from '../data/products';

/** Covers all three checkout screens: information, overview and confirmation. */
export class CheckoutPage {
  // Step one - customer information
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly continueButton: Locator;
  readonly cancelButton: Locator;
  readonly error: Locator;

  // Step two - order overview
  readonly summaryItems: Locator;
  readonly summaryItemNames: Locator;
  readonly subtotalLabel: Locator;
  readonly taxLabel: Locator;
  readonly totalLabel: Locator;
  readonly finishButton: Locator;

  // Confirmation
  readonly completeHeader: Locator;
  readonly completeText: Locator;
  readonly backHomeButton: Locator;

  readonly title: Locator;

  constructor(readonly page: Page) {
    this.firstName = page.locator('#first-name');
    this.lastName = page.locator('#last-name');
    this.postalCode = page.locator('#postal-code');
    this.continueButton = page.locator('#continue');
    this.cancelButton = page.locator('#cancel');
    this.error = page.locator('[data-test="error"]');

    this.summaryItems = page.locator('.cart_item');
    this.summaryItemNames = page.locator('.inventory_item_name');
    this.subtotalLabel = page.locator('.summary_subtotal_label');
    this.taxLabel = page.locator('.summary_tax_label');
    this.totalLabel = page.locator('.summary_total_label');
    this.finishButton = page.locator('#finish');

    this.completeHeader = page.locator('.complete-header');
    this.completeText = page.locator('.complete-text');
    this.backHomeButton = page.locator('#back-to-products');

    this.title = page.locator('.title');
  }

  async fillInformation(
    first: string = CHECKOUT_CUSTOMER.firstName,
    last: string = CHECKOUT_CUSTOMER.lastName,
    postal: string = CHECKOUT_CUSTOMER.postalCode,
  ) {
    if (first) await this.firstName.fill(first);
    if (last) await this.lastName.fill(last);
    if (postal) await this.postalCode.fill(postal);
  }

  async submitInformation() {
    await this.continueButton.click();
  }

  async proceedToOverview(
    first?: string,
    last?: string,
    postal?: string,
  ) {
    await this.fillInformation(first, last, postal);
    await this.submitInformation();
    await this.page.waitForURL(/checkout-step-two\.html/);
  }

  async errorText(): Promise<string> {
    return (await this.error.textContent())?.trim() ?? '';
  }

  /** Pull the money value out of labels such as "Item total: $32.39". */
  private async amount(label: Locator): Promise<number> {
    const text = (await label.textContent()) ?? '';
    const match = text.match(/\$([0-9.,]+)/);
    if (!match) throw new Error(`No amount found in label: "${text}"`);
    return Number(match[1].replace(/,/g, ''));
  }

  async itemTotal(): Promise<number> {
    return this.amount(this.subtotalLabel);
  }

  async tax(): Promise<number> {
    return this.amount(this.taxLabel);
  }

  async total(): Promise<number> {
    return this.amount(this.totalLabel);
  }

  async overviewNames(): Promise<string[]> {
    return (await this.summaryItemNames.allTextContents()).map(s => s.trim());
  }

  async finish() {
    await this.finishButton.click();
    await this.page.waitForURL(/checkout-complete\.html/);
  }

  async expectOrderConfirmed() {
    await expect(this.completeHeader).toHaveText(/Thank you for your order/i);
  }

  async backHome() {
    await this.backHomeButton.click();
    await this.page.waitForURL(/inventory\.html/);
  }
}

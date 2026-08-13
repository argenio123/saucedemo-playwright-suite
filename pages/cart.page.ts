import { expect, Locator, Page } from '@playwright/test';

/** The basket at /cart.html */
export class CartPage {
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly quantities: Locator;
  readonly checkoutButton: Locator;
  readonly continueShoppingButton: Locator;
  readonly title: Locator;

  constructor(readonly page: Page) {
    this.items = page.locator('.cart_item');
    this.itemNames = page.locator('.inventory_item_name');
    this.itemPrices = page.locator('.inventory_item_price');
    this.quantities = page.locator('.cart_quantity');
    this.checkoutButton = page.locator('#checkout');
    this.continueShoppingButton = page.locator('#continue-shopping');
    this.title = page.locator('.title');
  }

  async goto() {
    await this.page.goto('/cart.html', { waitUntil: 'domcontentloaded' });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/cart\.html/);
    await expect(this.title).toHaveText('Your Cart');
  }

  async names(): Promise<string[]> {
    return (await this.itemNames.allTextContents()).map(s => s.trim());
  }

  async quantityValues(): Promise<number[]> {
    return (await this.quantities.allTextContents()).map(s => Number(s.trim()));
  }

  async lineTotal(): Promise<number> {
    const prices = (await this.itemPrices.allTextContents()).map(s =>
      Number(s.replace(/[^0-9.]/g, '')),
    );
    const qty = await this.quantityValues();
    return Math.round(prices.reduce((sum, p, i) => sum + p * (qty[i] ?? 1), 0) * 100) / 100;
  }

  async removeItem(productName: string) {
    await this.items.filter({ hasText: productName }).getByRole('button', { name: 'Remove' }).click();
  }

  async checkout() {
    await this.checkoutButton.click();
    await this.page.waitForURL(/checkout-step-one\.html/);
  }

  async continueShopping() {
    await this.continueShoppingButton.click();
    await this.page.waitForURL(/inventory\.html/);
  }
}

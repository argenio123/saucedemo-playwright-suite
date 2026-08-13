import { expect, Locator, Page } from '@playwright/test';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

/** The product catalogue at /inventory.html and the shared app shell. */
export class InventoryPage {
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly itemDescriptions: Locator;
  readonly itemImages: Locator;
  readonly sortDropdown: Locator;
  readonly cartLink: Locator;
  readonly cartBadge: Locator;
  readonly menuButton: Locator;
  readonly menuCloseButton: Locator;
  readonly logoutLink: Locator;
  readonly resetLink: Locator;
  readonly title: Locator;

  constructor(readonly page: Page) {
    this.items = page.locator('.inventory_item');
    this.itemNames = page.locator('.inventory_item_name');
    this.itemPrices = page.locator('.inventory_item_price');
    this.itemDescriptions = page.locator('.inventory_item_desc');
    this.itemImages = page.locator('.inventory_item_img img');
    this.sortDropdown = page.locator('[data-test="product-sort-container"]');
    this.cartLink = page.locator('.shopping_cart_link');
    this.cartBadge = page.locator('.shopping_cart_badge');
    this.menuButton = page.locator('#react-burger-menu-btn');
    this.menuCloseButton = page.locator('#react-burger-cross-btn');
    this.logoutLink = page.locator('#logout_sidebar_link');
    this.resetLink = page.locator('#reset_sidebar_link');
    this.title = page.locator('.title');
  }

  async goto() {
    await this.page.goto('/inventory.html', { waitUntil: 'domcontentloaded' });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/inventory\.html/);
    await expect(this.title).toHaveText('Products');
  }

  /** The card for one product, located by its visible name. */
  card(productName: string): Locator {
    return this.items.filter({ hasText: productName });
  }

  async addToCart(productName: string) {
    await this.card(productName).getByRole('button', { name: 'Add to cart' }).click();
  }

  async removeFromCart(productName: string) {
    await this.card(productName).getByRole('button', { name: 'Remove' }).click();
  }

  /** 0 when the badge is absent, which is how an empty cart renders. */
  async cartCount(): Promise<number> {
    if ((await this.cartBadge.count()) === 0) return 0;
    return Number(((await this.cartBadge.textContent()) ?? '0').trim());
  }

  async names(): Promise<string[]> {
    return (await this.itemNames.allTextContents()).map(s => s.trim());
  }

  async prices(): Promise<number[]> {
    return (await this.itemPrices.allTextContents()).map(s =>
      Number(s.replace(/[^0-9.]/g, '')),
    );
  }

  async sortBy(option: SortOption) {
    await this.sortDropdown.selectOption(option);
    // The list re-renders client-side; wait for the first card to settle.
    await expect(this.itemNames.first()).toBeVisible();
  }

  async imageSources(): Promise<string[]> {
    return this.itemImages.evaluateAll(els =>
      els.map(e => (e as HTMLImageElement).getAttribute('src') ?? ''),
    );
  }

  async openMenu() {
    await this.menuButton.click();
    await expect(this.logoutLink).toBeVisible();
  }

  async closeMenu() {
    await this.menuCloseButton.click();
    await expect(this.logoutLink).toBeHidden();
  }

  async logout() {
    await this.openMenu();
    await this.logoutLink.click();
    await this.page.waitForURL('**/', { timeout: 15_000 }).catch(() => {});
  }

  async resetAppState() {
    await this.openMenu();
    await this.resetLink.click();
    await this.closeMenu().catch(() => {});
  }

  async openCart() {
    await this.cartLink.click();
    await this.page.waitForURL('**/cart.html');
  }

  async openProduct(productName: string) {
    await this.card(productName).locator('.inventory_item_name').click();
    await this.page.waitForURL(/inventory-item\.html/);
  }
}
